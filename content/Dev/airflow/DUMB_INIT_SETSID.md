---
tags:
  - airflow
  - Celery
created: 2025-06-02T17:00:00
updated: 2025-06-02T17:55:14
---
> [!abstract] DUMB_INIT_SETSID: "0" 의 의미
> - Celery worker 컨테이너가 **정상적으로 종료되도록** 돕는 설정
> - Docker 컨테이너 안에서 **종료 시그널이 제대로 전달되지 않는 문제**를 해결하기 위해 사용됨

### 배경

- Airflow의 `airflow-worker`는 내부적으로 **Celery worker 프로세스**를 실행
- Docker는 기본적으로 **최상위 프로세스(= PID 1)**에만 시그널을 보냄
- 일반적으로 Celery는 `SIGTERM`, `SIGINT` 같은 종료 시그널을 받아야 **깨끗하게 종료**
- 그런데 **PID 1이 Celery가 아닐 경우**, 이 시그널이 Celery에 도달하지 않고 **무시됨**

---
### Dumb-init의 역할
- Airflow Docker 이미지의 `/entrypoint`는 내부적으로 `dumb-init`이라는 작은 init 시스템을 사용
- `dumb-init`은 PID 1로 실행되며 받은 시그널을 자식 프로세스(Celery 등)에 전달
	- 즉, **정상적인 종료와 리소스 정리를 보장**

---

### `DUMB_INIT_SETSID: "0"`의 의미

- `dumb-init`은 기본적으로 **새로운 세션을 생성** (`setsid()` 호출)
- 하지만 일부 상황에서는 이로 인해 시그널 전달이 꼬일 수 있음
	- 특히 Celery처럼 자체적으로 시그널을 처리하는 애플리케이션의 경우
- `DUMB_INIT_SETSID=0`을 설정하면 **`setsid()` 호출을 비활성화**
	- 시그널이 **현재 터미널 세션 그대로** 유지되며 Celery에 전달됨

---
### 참고

- 관련 공식 문서: https://github.com/Yelp/dumb-init
- Airflow Docker: `/entrypoint`에서 `dumb-init`으로 Celery를 감쌈