---
tags:
  - troubleshooting
  - docker
  - postgresql
created: 2025-05-28T22:18:21
updated: 2025-05-28T22:22:55
permalink: /Dev/debug/postgresql-5432-port-conflict-and-missing-postgres-role
---
### 문제

FastAPI에서 PostgreSQL 데이터베이스에 연결할 때 다음 에러 발생
> `connection to server at "127.0.0.1", port 5432 failed: FATAL:  role "postgres" does not exist`  

다음 명령어를 통해 Docker로 postgres 컨테이너를 띄우고 환경변수도 올바르게 입력했지만, 계속해서 연결 오류가 났다.
>`docker run -d --name postgres_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=postgres -p 5432:5432 postgres:15` 

---

### 원인

- 로컬(호스트) 환경에 이미 PostgreSQL 16이 데몬으로 실행되고 있었고, 5432 포트를 선점하고 있었다.
- FastAPI의 DB 연결 문자열(`127.0.0.1:5432`)이 호스트(로컬) 5432 포트로 연결하도록 되어 있었다.
- docker로 띄운 postgres 컨테이너가 5432 포트에 바인딩하려 했으나, 이미 로컬 postgres가 점유 중이어서 docker 컨테이너가 5432에 바인딩되지 않거나, 바인딩 없이 실행됨.
- 결과적으로 FastAPI가 도커 컨테이너가 아닌, 로컬 postgres에 접속 시도하게 됨.
- 로컬 postgres에 'postgres'라는 유저가 존재하지 않아 “role 'postgres' does not exist” 에러가 발생.

---

### 해결

1. `lsof -i :5432` 명령어로 5432 포트가 어떤 프로세스에 의해 점유되어 있는지 확인.
2. 로컬 postgres 데몬을 완전히 중지(`brew services stop postgresql@16`).
3. docker의 postgres 컨테이너를 완전히 삭제(`docker rm -f postgres_db`) 후, 환경변수를 정확히 넣어 새로 생성.
4. 이 상태에서 docker postgres 컨테이너가 5432 포트에 정상적으로 바인딩됨을 확인.
5. FastAPI에서 127.0.0.1:5432로 접속하면 이제 도커 postgres에 연결되고, 환경변수로 생성한 유저/DB로 정상 로그인 가능.
6. 항상 DB 연결 전 5432 포트의 점유 주체를 확인하는 습관을 들임.
---

**핵심:**  
- 도커 postgres를 사용하려면 로컬 postgres 데몬을 반드시 중지하고, 컨테이너를 새로 생성해야 환경변수가 적용된 DB/유저가 정상적으로 생성된다.
- 5432 포트가 어떤 프로세스에 의해 LISTEN되고 있는지 항상 확인하는 것이 중요하다.