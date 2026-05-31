---
tags:
  - backend
  - architecture
  - network
  - web
created: 2026-04-29T00:00:00
updated: 2026-04-29T00:00:00
permalink: /Dev/web/rest-vs-grpc-vs-graphql
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - REST, gRPC, GraphQL은 각각 다른 문제를 해결하기 위해 만들어진 API 통신 방식. Big Tech는 대부분 이 셋을 섞어서 사용
> - SOAP은 엔터프라이즈 보안/신뢰성이 필요한 곳(금융, 의료)에서 여전히 사용
> - Webhooks는 폴링 대신 이벤트 발생 시 서버가 클라이언트를 호출하는 "역방향 API"
> - WebSocket은 양방향 실시간 통신(채팅, 주식), WebRTC는 서버 없이 P2P 직접 통신(화상회의)

> [!cite]+ Source
> - [Why Big Tech Doesn't Always Use REST? - ByteMonk](https://youtube.com/watch?v=KdZ3g_-hkA0)
> - [REST vs GraphQL vs gRPC - Design Gurus](https://www.designgurus.io/blog/rest-graphql-grpc-system-design)
> - [When to Use REST vs. gRPC vs. GraphQL - Kong](https://konghq.com/blog/engineering/rest-vs-grpc-vs-graphql)

---

### 1. API 통신이란

서비스와 서비스, 또는 클라이언트와 서버가 데이터를 주고받으려면 약속된 규칙이 필요하다. 이 규칙이 API(Application Programming Interface) 통신 방식이다.

웹 브라우저에서 서버에 페이지를 요청하는 것도, 모바일 앱이 서버에서 사용자 정보를 가져오는 것도, 내부 마이크로서비스끼리 데이터를 교환하는 것도 전부 API 통신이다.

현재 실무에서 가장 많이 쓰이는 방식은 세 가지다.

- **REST** - HTTP 기반의 리소스 중심 설계
- **gRPC** - Protocol Buffers 기반의 고성능 원격 호출
- **GraphQL** - 쿼리 기반의 유연한 데이터 요청

---

### 2. REST (Representational State Transfer)

[[REST API 설계와 URL 구조|REST]]는 2000년 Roy Fielding의 논문에서 제안된 아키텍처 스타일이다. 현재 웹 API의 사실상 표준이다.

#### 2-1. 핵심 개념

REST는 모든 것을 **리소스**로 본다. 사용자, 게시글, 주문 등 각각이 고유한 URL을 가진다.

```
GET    /users/123       → 사용자 조회
POST   /users           → 사용자 생성
PUT    /users/123       → 사용자 수정
DELETE /users/123       → 사용자 삭제
```

HTTP 메서드(GET, POST, PUT, DELETE)로 행위를 표현하고, URL로 대상을 지정한다.

#### 2-2. 데이터 포맷과 통신

- **데이터 포맷**: JSON (텍스트 기반, 사람이 읽을 수 있음)
- **프로토콜**: HTTP/1.1
- **상태 관리**: 무상태(Stateless) - 각 요청이 독립적

```json
// GET /users/123 응답
{
  "id": 123,
  "name": "Alice",
  "email": "alice@example.com",
  "posts": [1, 2, 3],
  "followers": 1500
}
```

#### 2-3. 장점과 한계

장점:
- 학습 곡선이 낮고, 생태계가 거대하다
- 브라우저가 기본 지원한다
- HTTP 캐싱을 그대로 활용할 수 있다

한계:
- **오버페칭(Over-fetching)**: 사용자 이름만 필요한데 전체 프로필이 내려온다
- **언더페칭(Under-fetching)**: 사용자와 게시글을 함께 보려면 요청을 2번 보내야 한다
- 엔드포인트가 늘어날수록 관리가 복잡해진다

---

### 3. gRPC (Google Remote Procedure Call)

gRPC는 Google이 내부에서 사용하던 Stubby를 오픈소스로 공개한 것이다. 초당 수백만 건의 내부 호출을 처리하기 위해 만들어졌다.

#### 3-1. 핵심 개념

gRPC는 **원격 함수 호출**이라는 발상에서 출발한다. 네트워크 너머의 서버 함수를 마치 로컬 함수처럼 호출한다.

```protobuf
// user.proto - 서비스 정의
// 이 파일이 user.proto라는 이름의 Protocol Buffers 명세 파일이고,
// User 관련 gRPC 서비스를 정의한다는 의미의 일반 주석

syntax = "proto3";
// 이 .proto 파일이 Protocol Buffers version 3 문법을 사용한다는 선언
// 보통 최신 gRPC 예제에서는 proto3를 많이 사용함

service UserService {
  // UserService라는 gRPC 서비스 정의 시작
  // REST API로 치면 User 관련 API 묶음, 예: /users 계열 API

  rpc GetUser (UserRequest) returns (UserResponse);
  // GetUser라는 원격 함수 정의
  // 클라이언트가 UserRequest 메시지를 보내면
  // 서버가 UserResponse 메시지 하나를 반환함
  // 즉, 요청 1개 → 응답 1개인 Unary RPC

  rpc ListUsers (Empty) returns (stream UserResponse);
  // ListUsers라는 원격 함수 정의
  // 클라이언트가 Empty 메시지를 보내면
  // 서버가 UserResponse를 여러 개 스트리밍으로 반환함
  // 즉, 요청 1개 → 응답 여러 개인 Server Streaming RPC
  // 단, 이 예시에서는 Empty 메시지가 아직 정의되어 있지 않음
}

message UserRequest {
  // UserRequest라는 메시지 타입 정의 시작
  // GetUser를 호출할 때 클라이언트가 서버로 보내는 요청 데이터 구조

  int32 id = 1;
  // id라는 필드 정의
  // 타입은 int32, 즉 32비트 정수
  // = 1은 필드 번호이며, 바이너리 직렬화에서 이 필드를 식별하는 번호
  // "첫 번째 줄"이라는 뜻이 아니라, 이 필드의 고유 태그 번호에 가까움
}

message UserResponse {
  // UserResponse라는 메시지 타입 정의 시작
  // 서버가 클라이언트에게 반환하는 사용자 응답 데이터 구조

  int32 id = 1;
  // 사용자 id 필드
  // 타입은 int32
  // 필드 번호는 1번

  string name = 2;
  // 사용자 이름 필드
  // 타입은 string
  // 필드 번호는 2번

  string email = 3;
  // 사용자 이메일 필드
  // 타입은 string
  // 필드 번호는 3번
}
```

이 `.proto` 파일 하나로 서버 스켈레톤과 클라이언트 스텁이 **자동 생성**된다. Python, Go, Java 등 다양한 언어를 지원한다.

#### 3-2. 데이터 포맷과 통신

- **데이터 포맷**: Protocol Buffers (바이너리, 사람이 읽을 수 없음)
- **프로토콜**: HTTP/2 (멀티플렉싱, 헤더 압축)
- **스트리밍**: 4가지 패턴 지원

```
Unary            : 요청 1개 → 응답 1개 (REST와 유사)
Server Streaming : 요청 1개 → 응답 여러 개
Client Streaming : 요청 여러 개 → 응답 1개
Bidirectional    : 요청/응답 동시에 여러 개
```

#### 3-3. 왜 빠른가

Protocol Buffers는 JSON 대비 메시지 크기가 작고 직렬화/역직렬화가 빠르다.

```
JSON:  {"id": 123, "name": "Alice"}  → ~30 bytes (텍스트)
Proto: 0x08 0x7B 0x12 0x05 Alice     → ~9 bytes (바이너리)
```

HTTP/2는 하나의 TCP 연결에서 여러 요청을 동시에 보낼 수 있고(멀티플렉싱), 헤더를 압축한다.

#### 3-4. 장점과 한계

장점:
- JSON 대비 직렬화 속도와 메시지 크기에서 압도적이다
- `.proto` 파일이 곧 API 문서이자 타입 계약이다
- 양방향 스트리밍으로 실시간 통신이 가능하다

한계:
- **브라우저에서 직접 호출이 안 된다** (gRPC-Web이라는 프록시 계층이 필요)
- 바이너리라서 curl로 디버깅하기 어렵다
- Protocol Buffers 학습이 필요하다

---

### 4. GraphQL

GraphQL은 Facebook이 2012년 내부용으로 만들고 2015년에 오픈소스로 공개했다. 모바일 앱에서 REST의 오버페칭/언더페칭 문제를 해결하기 위해 탄생했다.

#### 4-1. 핵심 개념

GraphQL은 **클라이언트가 필요한 데이터를 직접 명시**한다. 서버가 정해주는 게 아니라 클라이언트가 골라 받는다.

```graphql
# 사용자 이름과 최근 게시글 3개를 한 번에 요청
query {
  user(id: 123) {
    name
    posts(last: 3) {
      title
      createdAt
    }
  }
}
```

```json
// 응답 - 요청한 필드만 정확히 내려옴
{
  "data": {
    "user": {
      "name": "Alice",
      "posts": [
        { "title": "gRPC 입문", "createdAt": "2026-04-28" },
        { "title": "REST 설계", "createdAt": "2026-04-25" },
        { "title": "HTTP/2 정리", "createdAt": "2026-04-20" }
      ]
    }
  }
}
```

REST였다면 `/users/123`과 `/users/123/posts?limit=3`로 2번 요청해야 한다. GraphQL은 1번이면 된다.

#### 4-2. 데이터 포맷과 통신

- **데이터 포맷**: JSON (요청은 GraphQL 쿼리 문법, 응답은 JSON)
- **프로토콜**: HTTP (보통 단일 POST 엔드포인트 `/graphql`)
- **스키마**: 강타입 시스템으로 API 구조를 정의

```graphql
type User {
  id: Int!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  title: String!
  createdAt: String!
}
```

#### 4-3. 장점과 한계

장점:
- 오버페칭/언더페칭 문제를 근본적으로 해결한다
- 단일 엔드포인트로 모든 데이터에 접근한다
- 스키마가 곧 문서이고, 자동 완성/검증이 가능하다

한계:
- HTTP 캐싱을 활용하기 어렵다 (모든 요청이 POST)
- 서버 구현이 REST보다 복잡하다
- 잘못된 쿼리가 서버에 과부하를 줄 수 있다 (쿼리 깊이 제한 등 방어가 필요)

---

### 5. SOAP (Simple Object Access Protocol)

REST가 캐주얼한 전화라면, SOAP은 **공식 비즈니스 계약서**다. 이름에 "Simple"이 들어가지만 전혀 단순하지 않다.

모든 SOAP 메시지는 XML로 엄격한 구조(Envelope → Header → Body)를 따른다. 무겁고 장황하지만, REST에 없는 **엔터프라이즈급 보안과 신뢰성**을 내장하고 있다.

- **은행 간 송금**: 보장된 전달(guaranteed delivery)과 감사 추적(audit trail)이 필수
- **의료 시스템**: 환자 기록 교환에 엄격한 컴플라이언스 필요
- **정부 시스템**: 보안 표준 준수

> [!note]+ 언제 SOAP을 쓰는가
> 절대적인 전달 보장과 컴플라이언스 준수가 요구되는 도메인. 새 프로젝트에서 선택하는 경우는 드물지만, 레거시 시스템에서 여전히 많이 쓰인다.

---

### 6. Webhooks - 역방향 API

일반 API는 클라이언트가 서버에게 물어보는 방식(polling)이다. 30초마다 "새 메일 있어?" 하고 우체통을 확인하러 가는 셈이다.

Webhooks는 **반대로 서버가 클라이언트를 호출**한다. 우편함 대신 초인종이 달린 것이다.

동작 방식:
1. 클라이언트가 API 서비스에 **콜백 URL**을 등록한다
2. 이벤트가 발생하면 서비스가 해당 URL로 **POST 요청**을 보낸다
3. 클라이언트가 이를 받아서 처리한다

실제 사용:
- **Stripe**: 결제 성공/실패 시 Webhook 발생
- **GitHub**: 코드 push, PR 생성 시 Webhook 트리거
- **Shopify**: 주문 접수 시 Webhook 전송

> [!tip]+ Webhooks가 적합한 경우
> 워크플로우 자동화, 즉시 이벤트 알림, 시스템 간 실시간 동기화. 폴링 대비 서버 부하와 지연을 크게 줄인다.

---

### 7. WebSocket - 양방향 실시간 통신

일반 HTTP는 전화를 걸고, 답을 듣고, 끊는 방식이다. 다시 말하려면 다시 전화해야 한다. WebSocket은 **전화를 끊지 않고 계속 열어둔다**. 양쪽 모두 언제든 바로 말할 수 있다.

- REST에서는 항상 클라이언트가 먼저 요청하지만, WebSocket에서는 **서버도 먼저 데이터를 보낼 수 있다**
- 한번 연결되면 HTTP 오버헤드 없이 **즉시** 메시지를 주고받는다

적합한 사용처:
- 채팅 앱 (Slack, Discord)
- 실시간 주가/스포츠 점수
- 멀티플레이어 게임
- ChatGPT의 스트리밍 응답

---

### 8. WebRTC - P2P 직접 통신

WebRTC(Web Real-Time Communication)는 API를 넘어선 **완전한 프레임워크**다. 브라우저나 모바일 앱이 **서버 없이 직접** 통신한다.

Zoom 화상회의에서 내 영상이 Zoom 서버를 거치지 않고 **상대방 기기로 직접** 전송된다. 이것이 P2P(peer-to-peer) 통신이다.

문제는 양쪽 기기가 각자 라우터/방화벽 뒤에 있어서 서로의 실제 IP를 모른다는 것이다. WebRTC는 **Signaling**이라는 3단계 프로세스(STUN 서버, 폴백 메커니즘)로 이 연결을 수립한다.

연결 후에는 적응형 비트레이트, 코덱 협상, 지터 버퍼링 등을 **자동으로** 처리하며, 레이턴시 500ms 미만의 실시간 통신을 제공한다.

실제 사용:
- **화상회의**: Zoom, Google Meet, Discord
- **실시간 멀티플레이어 게임**: 1프레임 지연도 치명적인 경우
- **브라우저 간 파일 공유**: 서버 업로드 없이 직접 전송
- **라이브 스트리밍**: Twitch에서 스트리머-시청자 간 레이턴시 감소

> [!info]+ 모든 최신 브라우저에 내장
> 플러그인이나 별도 소프트웨어 설치 없이 동작한다.

---

### 9. 한눈에 비교

| 항목 | REST | gRPC | GraphQL |
|------|------|------|---------|
| 데이터 포맷 | JSON (텍스트) | Protobuf (바이너리) | JSON |
| 프로토콜 | HTTP/1.1 | HTTP/2 | HTTP |
| 엔드포인트 | 리소스마다 별도 URL | 서비스 메서드 단위 | 단일 (`/graphql`) |
| 타입 안전성 | OpenAPI로 보완 | `.proto`로 강제 | 스키마로 강제 |
| 스트리밍 | 제한적 | 양방향 지원 | Subscription |
| 브라우저 호환 | 완전 지원 | 프록시 필요 | 완전 지원 |
| 코드 생성 | 수동 | 자동 | 도구로 가능 |
| 학습 곡선 | 낮음 | 높음 | 중간 |

---

### 10. Big Tech는 어떻게 쓰는가

실제로 대규모 시스템은 하나만 쓰지 않는다. 상황에 따라 섞어 쓴다.

#### 6-1. 외부 API → REST 또는 GraphQL

- **GitHub**: REST API v3 + GraphQL API v4를 동시에 제공한다. 복잡한 데이터 조회는 GraphQL이 효율적이라 v4를 추가했다.
- **Stripe**: 결제 API는 REST. 단순하고 예측 가능한 동작이 중요한 결제 도메인에 적합하다.
- **Shopify**: GraphQL로 상품/주문 데이터를 유연하게 제공한다.

#### 6-2. 내부 통신 → gRPC

- **Google**: 내부 마이크로서비스 간 통신에 gRPC를 쓴다. GCP API도 gRPC를 기본 지원한다.
- **Netflix**: 수천 개의 내부 서비스가 gRPC로 통신한다. 레이턴시와 처리량이 핵심이다.
- **Uber**: 마이크로서비스 간 고성능 통신에 gRPC를 채택했다.

> [!info]+ 일반적인 패턴
> - 클라이언트(브라우저/모바일) ↔ API Gateway: **REST** 또는 **GraphQL**
> - 내부 서비스 ↔ 내부 서비스: **gRPC**
>
> 외부에는 접근성, 내부에는 성능을 우선한다.

---

### 11. 어떤 상황에서 무엇을 선택할까

**REST를 선택할 때:**
- 공개 API를 제공해야 할 때
- 팀이 REST에 익숙하고, CRUD 위주의 단순한 API일 때
- HTTP 캐싱이 중요할 때

**gRPC를 선택할 때:**
- 마이크로서비스 간 내부 통신이 잦을 때
- 레이턴시와 처리량이 핵심 요구사항일 때
- 실시간 양방향 스트리밍이 필요할 때
- IoT 등 저대역폭 환경일 때

**GraphQL을 선택할 때:**
- 다양한 클라이언트(웹, 모바일, 워치)가 각각 다른 데이터를 원할 때
- 여러 리소스를 조합해서 보여주는 화면이 많을 때
- API 버전 관리를 줄이고 싶을 때

**SOAP을 선택할 때:**
- 금융/의료/정부 등 컴플라이언스와 보장된 전달이 필수일 때
- 기존 레거시 시스템과의 연동

**Webhooks를 선택할 때:**
- 이벤트 기반 알림이 필요할 때 (결제 완료, 배포 트리거 등)
- 폴링을 제거하고 실시간 반응을 원할 때

**WebSocket을 선택할 때:**
- 채팅, 실시간 대시보드 등 양방향 지속 연결이 필요할 때
- 서버가 클라이언트에게 먼저 데이터를 보내야 할 때

**WebRTC를 선택할 때:**
- 화상/음성 통화, P2P 파일 전송 등 서버를 경유하지 않는 직접 통신이 필요할 때
- 500ms 미만의 초저지연이 요구될 때

> [!tip]+ 실무 판단 기준
> - "외부에 공개하는가?" → REST/GraphQL
> - "내부 서비스끼리인가?" → gRPC
> - "클라이언트마다 다른 데이터가 필요한가?" → GraphQL
> - "이벤트 알림이 필요한가?" → Webhooks
> - "양방향 실시간인가?" → WebSocket
> - "서버 없이 P2P인가?" → WebRTC

---

### 12. 관련 개념

- [[WAS와 CGI, WSGI, ASGI - 웹 서버 아키텍처의 진화|WAS와 WSGI, ASGI]] - 웹 서버가 요청을 받아 처리하는 구조
- [[소프트웨어 아키텍처 - Monolithic vs Microservice]] - gRPC가 활약하는 마이크로서비스 아키텍처
- [[Socket|소켓 통신]] - gRPC의 양방향 스트리밍의 기반이 되는 네트워크 통신
