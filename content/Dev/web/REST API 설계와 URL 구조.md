---
tags:
  - web
  - backend
  - network
  - HTTP
created: 2026-05-23T00:00:00
updated: 2026-05-23T00:00:00
permalink: /Dev/web/rest-api-design-and-url-structure
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - URL은 scheme, host, port, path, query string, fragment로 구성되며 각 요소가 라우팅과 처리에 관여
> - REST API는 리소스를 URL로, 행위를 HTTP 메서드로 표현하는 설계 원칙
> - API Gateway / Reverse Proxy가 외부 URL을 내부 서비스 경로로 변환 (path rewrite)
> - Base path, endpoint path, path prefix의 차이를 이해하면 Ingress/Proxy 설정이 쉬워짐

---

### 1. URL의 구조

API를 이해하려면 먼저 URL이 어떻게 생겼는지 분해할 수 있어야 한다.

```
https://api.example.com:443/v2/users/123?fields=name,email&sort=desc#section1
└─┬──┘ └──────┬───────┘└┬┘ └─────┬─────┘ └────────────┬────────────┘└────┬───┘
scheme      host      port     path              query string         fragment
```

| 요소 | 역할 | 예시 |
| --- | --- | --- |
| **Scheme** | 프로토콜 | `http`, `https` |
| **Host** | 서버 주소 (도메인 또는 IP) | `api.example.com`, `10.150.100.39` |
| **Port** | 서비스 접근 포트 | `443`, `8080`, `5000` (생략 시 scheme 기본값) |
| **Path** | 리소스 위치 | `/v2/users/123` |
| **Query String** | 필터/정렬 등 부가 파라미터 | `?fields=name&sort=desc` |
| **Fragment** | 클라이언트 측 앵커 (서버에 전송되지 않음) | `#section1` |

이 중 API 설계에서 가장 중요한 것은 **Path**다.

---

### 2. REST API — 리소스 중심 설계

REST(Representational State Transfer)는 [[REST vs gRPC vs GraphQL - API 통신 방식 비교|API 통신 방식]] 중 가장 널리 쓰인다. 핵심 원칙은 다음과 같다.

#### 2-1. URL = 리소스, HTTP 메서드 = 행위

REST에서 URL은 "무엇을(what)"을 나타내고, HTTP 메서드는 "어떻게(how)"를 나타낸다.

```
GET    /users          → 사용자 목록 조회
GET    /users/123      → 사용자 #123 조회
POST   /users          → 새 사용자 생성
PUT    /users/123      → 사용자 #123 전체 수정
PATCH  /users/123      → 사용자 #123 부분 수정
DELETE /users/123      → 사용자 #123 삭제
```

URL에 동사를 넣지 않는 것이 원칙이다.

```
❌ GET  /getUser/123
❌ POST /createUser
✅ GET  /users/123
✅ POST /users
```

#### 2-2. 계층적 리소스

리소스 간 관계는 URL 경로로 표현한다.

```
GET /users/123/posts          → 사용자 #123의 게시글 목록
GET /users/123/posts/456      → 사용자 #123의 게시글 #456
GET /users/123/posts/456/comments  → 해당 게시글의 댓글 목록
```

#### 2-3. HTTP 메서드 정리

| 메서드 | 용도 | 멱등성 | 안전성 | 요청 Body |
| --- | --- | --- | --- | --- |
| `GET` | 조회 | O | O | 없음 |
| `POST` | 생성 | X | X | 있음 |
| `PUT` | 전체 교체 | O | X | 있음 |
| `PATCH` | 부분 수정 | X | X | 있음 |
| `DELETE` | 삭제 | O | X | 보통 없음 |

**멱등성(Idempotent)**: 같은 요청을 여러 번 보내도 결과가 동일. PUT으로 같은 데이터를 10번 보내도 결과는 같지만, POST로 10번 보내면 10개가 생성된다.

**안전성(Safe)**: 서버 상태를 변경하지 않음. GET은 안전하지만 DELETE는 안전하지 않다.

#### 2-4. 상태 코드

서버는 응답에 [[14. HTTP|HTTP 상태 코드]]를 포함한다.

| 범위 | 의미 | 대표 코드 |
| --- | --- | --- |
| `2xx` | 성공 | `200 OK`, `201 Created`, `204 No Content` |
| `3xx` | 리다이렉션 | `301 Moved Permanently`, `304 Not Modified` |
| `4xx` | 클라이언트 오류 | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found` |
| `5xx` | 서버 오류 | `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable` |

```
201 Created        → POST 성공 시 (새 리소스 생성됨)
204 No Content     → DELETE 성공 시 (반환할 Body 없음)
400 Bad Request    → 요청 형식 오류 (필수 필드 누락 등)
401 Unauthorized   → 인증 필요 (토큰 없음/만료)
403 Forbidden      → 인증됐지만 권한 없음
404 Not Found      → 리소스 없음
422 Unprocessable  → 형식은 맞지만 비즈니스 로직 위반
```

---

### 3. URL Path의 실무 구조

실제 운영 환경에서 URL path는 여러 층으로 나뉜다.

```
https://api.example.com/v2/models/abc123/simulation/inferRequest
                        └┬┘ └──────────┬──────────┘ └─────┬────┘
                      version       base path          endpoint
                        └──────────────┬───────────────────┘
                                  full request path
```

| 용어 | 설명 | 예시 |
| --- | --- | --- |
| **Version prefix** | API 버전 | `/v1`, `/v2` |
| **Base path** | 리소스 그룹 또는 서비스 단위 경로 | `/models/abc123/simulation` |
| **Endpoint path** | 특정 기능에 대응하는 최종 경로 | `/inferRequest`, `/health` |
| **Full request path** | 클라이언트가 보내는 전체 path | `/v2/models/abc123/simulation/inferRequest` |

#### API 버전 관리 방식

| 방식 | 예시 | 특징 |
| --- | --- | --- |
| URL path | `/v1/users`, `/v2/users` | 가장 직관적, 캐싱 유리 |
| Query string | `/users?version=2` | URL이 깔끔하지만 캐싱 복잡 |
| Header | `Accept: application/vnd.api+json;version=2` | URL이 가장 깔끔하지만 테스트 불편 |

실무에서는 URL path 방식이 가장 널리 쓰인다.

---

### 4. API Gateway와 Path Routing

실제 서비스에서는 클라이언트의 요청이 직접 애플리케이션에 도달하지 않는다. 중간에 [[Proxy와 Reverse Proxy|Reverse Proxy]]나 API Gateway가 위치한다.

```
클라이언트
    │
    ▼
┌──────────────────┐
│  API Gateway /   │  ← 외부 URL 수신
│  Reverse Proxy   │  ← 인증, 로깅, rate limit
│  (Nginx, Envoy)  │  ← path rewrite
└────────┬─────────┘
         │
    ┌────┴─────┐
    ▼          ▼
┌────────┐ ┌────────┐
│ Service│ │ Service│  ← 내부 서비스
│   A    │ │   B    │
│ :5000  │ │ :8000  │
└────────┘ └────────┘
```

#### 4-1. Path routing

외부 URL의 path를 기준으로 어떤 내부 서비스로 보낼지 결정한다.

```
/api/users/*     → User Service (:5000)
/api/orders/*    → Order Service (:8000)
/api/payments/*  → Payment Service (:3000)
```

#### 4-2. Path rewrite

외부 path와 내부 서비스의 path가 다를 때, 중간에서 변환한다.

```
외부: /api/models/abc123/simulation/inferRequest
                    ↓ path rewrite
내부: /inferRequest    (Flask route가 처리)
```

외부에서는 `/api/models/abc123/simulation/inferRequest`로 호출하지만, 실제 Flask 서버는 `/inferRequest`만 알면 된다. Gateway가 앞부분을 잘라내고(strip) 전달한다.

#### 4-3. Prefix vs Exact routing

| 방식 | 매칭 | 적합한 경우 |
| --- | --- | --- |
| **Prefix** | `/api/users`로 시작하는 모든 경로 매칭 | 서비스 단위로 여러 endpoint를 함께 노출 |
| **Exact** | `/api/users/123` 정확히 일치할 때만 매칭 | 특정 endpoint 하나만 노출 (보안상 범위 최소화) |

Kubernetes Ingress에서는 `pathType: Prefix` 또는 `pathType: Exact`로 지정한다.

---

### 5. REST API 설계 체크리스트

좋은 REST API를 설계할 때 점검할 항목이다.

##### URL 설계

- [ ] URL에 동사가 아닌 **명사**(리소스)를 사용했는가
- [ ] 복수형을 일관적으로 사용했는가 (`/users`, `/posts`)
- [ ] 계층 관계가 URL 구조에 반영되었는가
- [ ] API 버전이 명시되었는가 (`/v1/...`)

##### HTTP 메서드

- [ ] CRUD에 맞는 메서드를 사용했는가 (GET/POST/PUT/DELETE)
- [ ] GET 요청이 서버 상태를 변경하지 않는가

##### 응답

- [ ] 적절한 상태 코드를 반환하는가 (200만 반환하지 않는가)
- [ ] 에러 응답에 충분한 정보가 포함되어 있는가
- [ ] 페이지네이션이 필요한 목록 API에 구현되어 있는가

##### 인프라

- [ ] API Gateway/Reverse Proxy 뒤에 위치하는가
- [ ] path rewrite가 필요한 경우 문서화되었는가
- [ ] HTTPS를 사용하는가

---

### 6. 참고 자료

- [HTTP 공식 사양 — RFC 9110](https://httpwg.org/specs/rfc9110.html)
- [RESTful API 설계 가이드 — Microsoft](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- [HTTP Status Codes — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [API Gateway Pattern — Kong](https://konghq.com/learning-center/api-gateway)
