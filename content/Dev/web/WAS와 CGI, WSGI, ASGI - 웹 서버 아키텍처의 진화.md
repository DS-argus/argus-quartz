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
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> 웹 요청이 서버에 도착해서 애플리케이션 코드까지 전달되는 과정에는 여러 인터페이스가 존재한다. CGI → WSGI → ASGI 순으로 발전했으며, 각각 RFC나 PEP 같은 공식 스펙이 존재한다. "WAS"는 공식 표준 용어가 아니라 업계 관용어다.

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

쉽게 말해 **HTTP 요청을 받아서 응답을 보내는 프로그램**이 Web Server다. Nginx, Apache가 대표적이다.

#### WAS (Web Application Server) — 공식 표준 용어가 아니다

"WAS"는 RFC나 W3C 같은 표준 기관에서 정의한 용어가 **아니다**.

- **Java 생태계**에서는 [Jakarta EE](https://jakarta.ee/specifications/)(구 Java EE) 스펙이 Application Server의 구성 요소(Servlet Container, EJB Container 등)를 정의한다. Tomcat, JBoss, WebLogic 같은 제품이 이 스펙을 구현한다.
- **그 외 생태계**(Python, Node.js, Go 등)에서는 "Application Server"라는 분류 자체를 잘 쓰지 않는다. Python에서는 그냥 "WSGI 서버", "ASGI 서버"라고 부른다.
- **"WAS"라는 약어**는 주로 한국 IT 업계에서 관용적으로 사용하는 표현이다. 영어권에서는 "Application Server"라고 부르지 "WAS"라는 줄임말은 거의 쓰지 않는다.

> [!info]+ 왜 한국에서 WAS를 많이 쓸까?
> 2000년대 한국 기업 SI 프로젝트가 대부분 Java 기반이었고, WebLogic·JEUS·Tomcat 같은 제품을 "WAS"로 통칭하는 관행이 굳어졌다. 공식 용어가 아니라 업계 은어에 가깝다.

#### 결국 핵심은 "인터페이스"

Web Server(Nginx 등)와 애플리케이션 코드(Django, FastAPI 등) 사이를 **어떻게 연결하느냐**가 중요하다. 이 연결 방식이 CGI, WSGI, ASGI이고, 이것들은 각각 공식 스펙이 있다.

---

### 2. CGI - Common Gateway Interface

가장 오래된 방식이다.

```
클라이언트 요청 → Web Server → [새 프로세스 생성] → 스크립트 실행 → 응답 → [프로세스 종료]
```

- 웹 서버가 요청을 받으면 **매번 새로운 프로세스를 생성**해서 외부 프로그램(Perl, Python 등)을 실행한다
- 프로그램이 표준 출력(stdout)으로 HTML을 출력하면 웹 서버가 이를 클라이언트에 전달한다
- 요청이 끝나면 프로세스를 종료한다

> [!tip]+ CGI의 한계
> 요청마다 프로세스를 생성/종료하기 때문에 동시 접속이 많아지면 서버 자원이 급격히 소모된다. 1000명이 동시에 접속하면 1000개의 프로세스가 뜬다.

---

### 3. WSGI - Web Server Gateway Interface

CGI의 문제를 해결하기 위해 Python 진영에서 만든 표준 인터페이스(PEP 3333)다.

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

### 4. ASGI - Asynchronous Server Gateway Interface

WSGI의 비동기 확장 버전이다.

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

> [!tip]+ 언제 뭘 쓸까?
> - 관리자 페이지, 인증, ORM 등 **배터리 포함**이 필요하면 → Django
> - 빠른 API 서버, WebSocket, 비동기 처리가 핵심이면 → FastAPI
> - Django도 3.0부터 ASGI 배포를 지원하고, 이후 버전에서 async view/ORM이 점진적으로 확대되고 있다

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
