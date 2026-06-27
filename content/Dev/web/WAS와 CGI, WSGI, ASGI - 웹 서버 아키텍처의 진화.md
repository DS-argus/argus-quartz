---
tags:
  - python
  - web
  - backend
  - ASGI
  - uvicorn
  - gunicorn
  - fastapi
  - django
created: 2026-04-20T00:00:00
updated: 2026-04-20T22:16:02
permalink: /Dev/web/was-cgi-wsgi-asgi-web-server-architecture-evolution
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - 운영 환경에서는 웹 서버 / 게이트웨이 인터페이스(WAS) / 웹 프레임워크 3계층으로 분리하여 각자 전문 영역에 집중
> - 게이트웨이 인터페이스는 C로 작성된 웹 서버와 Python 앱 사이의 **통역사** 역할
> - CGI(수동 게이트) → WSGI(자동 게이트, 정규직) → ASGI(AI 스마트 게이트, 비동기) 순으로 발전
> - ML 엔지니어가 FastAPI를, 백엔드 엔지니어가 Django를 선호하는 이유는 각자 업무 특성에 최적화된 기술 스택을 선택한 것

> [!cite]+ Source
> - 🔗 [Django vs FastAPI 차이점 | CGI부터 WSGI, ASGI까지 - 코딩하는초롱](https://youtube.com/watch?v=1BDV1PpByG8)
> - 🔗 [RFC 9110 - HTTP Semantics](https://httpwg.org/specs/rfc9110.html)
> - 🔗 [서버 (Web Server, CGI, WAS, WSGI)에 대한 이해](https://medium.com/svelte-seoul/%EC%84%9C%EB%B2%84-web-server-cgi-was-wsgi-%EC%97%90-%EB%8C%80%ED%95%9C-%EC%9D%B4%ED%95%B4-2ab0f9bfabd4)

---

### 1. Web Server와 Application Server

#### Web Server — 공식 정의가 있다

"Web Server"는 HTTP 표준 문서에 정의되어 있다.

> [!quote]+ RFC 9110 (HTTP Semantics) - Section 3.3
> A "server" is a program that accepts connections in order to service HTTP requests by sending HTTP responses.
>
> — [RFC 9110, IETF](https://httpwg.org/specs/rfc9110.html#server)

쉽게 말해 **HTTP 요청을 받아서 응답을 보내는 프로그램**이 Web Server다. Nginx, Apache가 대표적이다. Nginx가 내부적으로 수만 개의 연결을 어떻게 처리하고 왜 WAS 앞단에 두는지는 [[Nginx event loop and reverse proxy - why put a web server in front]]에서 다룬다.

#### WAS (Web Application Server) — 공식 표준 용어가 아니다

"WAS"는 RFC나 W3C 같은 표준 기관에서 정의한 용어가 **아니다**.

- **Java 생태계**에서는 [Jakarta EE](https://jakarta.ee/specifications/)(구 Java EE) 스펙이 Application Server의 구성 요소(Servlet Container, EJB Container 등)를 정의한다. Tomcat, JBoss, WebLogic 같은 제품이 이 스펙을 구현한다.
- **그 외 생태계**(Python, Node.js, Go 등)에서는 "Application Server"라는 분류 자체를 잘 쓰지 않는다. Python에서는 그냥 "WSGI 서버", "ASGI 서버"라고 부른다.
- **"WAS"라는 약어**는 주로 한국 IT 업계에서 관용적으로 사용하는 표현이다. 영어권에서는 "Application Server"라고 부르지 "WAS"라는 줄임말은 거의 쓰지 않는다.

> [!info]+ 왜 한국에서 WAS를 많이 쓸까?
> 2000년대 한국 기업 SI 프로젝트가 대부분 Java 기반이었고, WebLogic·JEUS·Tomcat 같은 제품을 "WAS"로 통칭하는 관행이 굳어졌다. 공식 용어가 아니라 업계 은어에 가깝다.

#### 왜 3계층으로 분리하는가

Django나 FastAPI만으로도 API 서버를 띄울 수는 있다. 하지만 운영 환경에서 그렇게 쓰면 문제가 생긴다.

- **보안 취약**: 개발용 서버는 SSL/TLS 처리, 보안 헤더 설정, DDoS 방어 같은 기본 보안 기능이 부족하다
- **정적 파일 비효율**: CSS, JS, 이미지를 Python 앱이 직접 서빙하면 엄청나게 비효율적이다
- **확장성 한계**: 로드 밸런싱, 캐싱, 압축 같은 기능을 개발 서버만으로 구현하기 어렵다
- **성능/안정성**: 개발 서버는 디버깅 편의성에 초점이 맞춰져 있어 운영 수준의 안정성을 보장하지 못한다

그래서 각 계층이 전문 분야에 집중하는 구조를 사용한다. 회사에서 팀을 나눠 업무를 분담하는 것과 같은 원리다.

#### 결국 핵심은 "게이트웨이 인터페이스"

Web Server(Nginx 등)와 애플리케이션 코드(Django, FastAPI 등) 사이를 **어떻게 연결하느냐**가 중요하다. Nginx는 C로 작성된 웹 서버인데, Python으로 작성한 코드를 직접 이해하고 실행할 수 없다. 그래서 중간에서 HTTP 요청을 애플리케이션이 이해할 수 있는 형태로 **번역**해주는 통역사가 필요하다.

게이트웨이 인터페이스의 핵심 역할:
- **프로토콜 변환**: HTTP 요청을 파싱해서 애플리케이션이 처리할 수 있는 형태로 변환
- **환경 변수 전달**: 헤더, 쿼리 파라미터, HTTP 메서드, 클라이언트 IP 등 메타데이터를 애플리케이션에 전달
- **응답 처리**: 애플리케이션이 반환한 결과를 다시 HTTP 응답 형태로 변환해서 웹 서버에 전달

이 연결 방식이 CGI, WSGI, ASGI이고, 이것들은 각각 공식 스펙이 있다.

---

### 2. CGI - Common Gateway Interface (수동 게이트)

가장 오래된 방식이다. 톨게이트에 비유하면 **차 한 대가 올 때마다 새 직원을 고용해서 요금을 받고 바로 해고**하는 방식이다.

```
클라이언트 요청 → Web Server → [새 프로세스 생성] → 스크립트 실행 → 응답 → [프로세스 종료]
```

- 웹 서버가 요청을 받으면 **매번 새로운 프로세스를 생성**해서 외부 프로그램(Perl, Python 등)을 실행한다
- 프로그램이 표준 출력(stdout)으로 HTML을 출력하면 웹 서버가 이를 클라이언트에 전달한다
- 요청이 끝나면 프로세스를 종료한다

> [!tip]+ CGI의 한계
> 요청마다 프로세스를 생성/종료하기 때문에 동시 접속이 많아지면 서버 자원이 급격히 소모된다. 1000명이 동시에 접속하면 1000개의 프로세스가 뜬다.

---

### 3. WSGI - Web Server Gateway Interface (자동 게이트)

CGI의 문제를 해결하기 위해 Python 진영에서 만든 표준 인터페이스(PEP 3333)다. 톨게이트 비유로는 **정규직 직원을 미리 고용해 두고 교대로 처리**하는 방식이다. 매번 사람을 뽑고 해고하는 비용이 사라진다.

```
클라이언트 요청 → Web Server → WSGI Server → Python 앱
                           (Gunicorn 등) (Django 등)
```

- **하나의 프로세스에서 여러 요청을 처리**한다 (CGI와의 핵심 차이)
- WSGI 서버(Gunicorn, uWSGI)가 워커 프로세스를 미리 띄워놓고 요청을 분배한다
- Python 애플리케이션은 `callable(environ, start_response)` 형태의 함수만 구현하면 된다

```python
# 가장 단순한 WSGI 앱
def application(environ, start_response):
    status = '200 OK'
    headers = [('Content-Type', 'text/plain')]
    start_response(status, headers)
    return [b'Hello, World!']
```

> [!note]+ WSGI의 한계
> WSGI는 **동기(synchronous) 전용**이다. 하나의 요청을 처리하는 동안 해당 워커는 다른 요청을 받을 수 없다. WebSocket, HTTP/2 같은 장시간 연결 프로토콜도 지원하지 않는다.

대표 조합: **Nginx + Gunicorn + Django**

---

### 4. ASGI - Asynchronous Server Gateway Interface (스마트 게이트)

WSGI의 비동기 확장 버전이다. 톨게이트 비유로는 **한 명의 직원이 동시에 수천 대의 차량을 처리**할 수 있는 스마트 게이트다. 한 차량의 카드 승인을 기다리는 동안 다른 차량을 계속 처리한다.

```
클라이언트 요청 → Web Server → ASGI Server → Python 앱
                            (Uvicorn 등) (FastAPI 등)
```

- **비동기(async/await)를 네이티브로 지원**한다
- WebSocket, HTTP/2, Server-Sent Events 등 장시간 연결 프로토콜을 처리할 수 있다
- WSGI 앱도 ASGI 서버 위에서 실행할 수 있다 (하위 호환)

```python
# 가장 단순한 ASGI 앱
async def application(scope, receive, send):
    await send({
        'type': 'http.response.start',
        'status': 200,
        'headers': [[b'content-type', b'text/plain']],
    })
    await send({
        'type': 'http.response.body',
        'body': b'Hello, World!',
    })
```

대표 조합: **Nginx + Uvicorn + FastAPI**

---

### 5. Django vs FastAPI

| 항목           | Django                | FastAPI                            |
| :----------- | :-------------------- | :--------------------------------- |
| **기본 인터페이스** | WSGI (ASGI도 지원)       | ASGI                               |
| **요청 처리**    | 동기 기본 (async view 가능) | 비동기 기본                             |
| **타입 힌트**    | 선택적                   | 필수 ([[Python pydantic\|Pydantic]]) |
| **자동 문서화**   | 별도 설정 필요              | Swagger UI 자동 생성                   |
| **ORM**      | 내장 (Django ORM)       | 없음 (SQLAlchemy 등 선택)               |
| **적합한 경우**   | 풀스택 웹앱, 관리자 패널        | API 서버, 마이크로서비스                    |

> [!tip]+ ML 엔지니어 vs 백엔드 엔지니어
> **ML 엔지니어가 FastAPI를 선호하는 이유**: AI 모델 추론, 대용량 데이터 처리, 실시간 예측 서비스는 시간이 오래 걸리고 여러 요청을 동시에 처리해야 한다. GPU가 한 이미지를 처리하는 동안 CPU가 다른 요청을 계속 받을 수 있는 비동기 처리가 핵심이다. 참고로 Uvicorn을 개발한 Tom Christie가 FastAPI에 영감을 준 인물이기도 하다 — 서버와 프레임워크가 처음부터 완벽한 호흡을 맞추도록 설계된 것이다.
>
> **백엔드 엔지니어가 Django를 선호하는 이유**: 복잡한 비즈니스 로직을 빠르게 구축하려면 ORM, 관리자 페이지, 인증 시스템, 보안 기능이 모두 내장된 "배터리 포함" 프레임워크가 유리하다. 대부분의 백엔드 작업은 동기적으로 처리해도 충분히 빠르고, Gunicorn의 멀티프로세스 방식은 CPU 집약적인 작업에 오히려 더 효율적이다.
>
> Django도 3.0부터 ASGI 배포를 지원하고, 이후 버전에서 async view/ORM이 점진적으로 확대되고 있다.

---

### 6. 전체 흐름 정리

```
[1990s]  CGI     : 요청마다 프로세스 생성 → 느림, 자원 낭비
   ↓
[2003]   WSGI    : 프로세스 재사용, 동기 처리 → Python 웹의 표준
   ↓
[2019]   ASGI    : 비동기 지원, WebSocket/HTTP2 → 현대 웹의 표준
```

| 항목 | CGI | WSGI | ASGI |
| :--- | :--- | :--- | :--- |
| **프로세스** | 요청마다 생성 | 재사용 | 재사용 |
| **동기/비동기** | 동기 | 동기 | 비동기 |
| **WebSocket** | 불가 | 불가 | 가능 |
| **대표 서버** | Apache mod_cgi | Gunicorn, uWSGI | Uvicorn, Daphne |
| **대표 프레임워크** | Perl CGI | Django, Flask | FastAPI, Starlette |
