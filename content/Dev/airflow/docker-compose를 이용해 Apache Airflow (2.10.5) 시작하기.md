---
tags:
  - docker
  - docker-compose
  - airflow
created: 2025-06-02T15:22:37
updated: 2025-06-28T11:52:29
permalink: /Dev/airflow/getting-started-with-apache-airflow-2-10-5-using-docker-compose
---
### docker-compose를 활용한 Airflow 세팅

Airflow는 여러가지 component들이 필요하기 때문에 이를 local에서 세팅하는 것이 상당히 귀찮다 (다른 것도 마찬가지...)

하지만 docker를 이용하면 local 환경에 구애받지 않고 편하게 세팅이 가능하며,  
docker-compose를 이용하면 여러 서비스들을 각기 다른 컨테이너로 올려서 더 안전하고 편리하게 실행시킬 수 있다  

따라서 Apache Airflow [docs](https://airflow.apache.org/docs/apache-airflow/2.10.5/howto/docker-compose/index.html#fetching-docker-compose-yaml)도 이 방법을 제공한다

##### 1. docker-compose.yaml 다운로드
다음 명령어를 통해 다운받으면 `docker-compose.yaml` 이 생긴다
```bash
curl -LfO 'https://airflow.apache.org/docs/apache-airflow/2.10.5/docker-compose.yaml'
```

뒤에서 살펴보겠지만 Apache Airflow 2.10.5 버전의 경우 총 9개의 서비스로 구성이 되어있다.
1. **airflow-init**
	- 역할: 환경 변수 및 자원 체크, 디렉토리 생성/권한 설정, Airflow 버전 확인 (초기화 one-shot 컨테이너)
2. **airflow-scheduler**
	- 역할: DAG의 실행 시점 계산, 태스크 분배/스케줄 관리
3. **airflow-webserver**
	- 역할: Airflow의 웹 UI 및 REST API 제공 (기본 포트: 8080)
4. **postgres**
	- 역할: Airflow의 메타데이터 DB (DAG, 태스크, 로그 등 저장)
5. **airflow-cli**
	- 역할: Airflow 명령행(CLI) 실행 전용 컨테이너
	- 특징: 다른 서비스 영향 없이 단독으로 `airflow` 명령 실행, 일회성/테스트 명령에 적합
	- 장점: 불필요한 서비스 기동 방지, 독립성
	- 대안: `docker compose exec webserver ...`로도 대체 가능
6. **airflow-triggerer**
	- 역할: Deferrable Operator(비동기 센서 등) 백그라운드 처리 전담
	- 특징: 대기 시간이 긴 작업을 효율적으로 관리, 리소스 절약
	- 필요한 경우: Async Sensor, Deferrable Operator 사용 시 필수
7. **airflow-worker**
	- 역할: CeleryExecutor 기반의 태스크 병렬 처리(작업자)
8. **redis**
	- 역할: CeleryExecutor의 브로커(메시지 큐)
	- 특징: 태스크 분산/스케줄링에 필수
9. **flower**
	- 역할: Celery 작업자 모니터링 웹 UI (5555 포트)
	- 특징: 실시간 작업 현황 시각화, profiles 옵션으로 선택적 기동


##### 2. 필요한 폴더 및 user ID 생성
Apache Airflow에서는 기본적으로 4개의 폴더와 Airflow 서버에서 사용할 UserID가 필요하다  
폴더를 생성해주고,  필요한 UserID를 `.env` 파일에 추가해서 추후 컨테이너 실행 시 이 값을 읽을 수 있게 해준다
```bash
mkdir -p ./dags ./logs ./plugins ./config
echo -e "AIRFLOW_UID=$(id -u)" > .env
```

##### 3. Airflow Init 서비스 실행
Airflow  서비스를 본격적으로 구동하기 전에 필요한 요소가 갖추어져있는지 확인하고 필요한 설정을 초기화 하는 단계이다
```shell
docker compose up airflow-init
```

`docker-compose.yaml`에 depends_on 옵션으로 redis, postgres 서비스가 정상적으로 실행 (healthy) 된 후 컨테이너를 시작하라고 되어 있어서  
성공적으로 수행되면 redis, postgres 컨테이너가 실행 중인 상태가 된다

> [!warning] 최소 메모리 요구량
> Airflow는 최소 4GB 이상의 메모리를 필요로 하기 때문에 이를 사전에 확인할 수 있는 docker 명령어도 제공하고 있다
> ```shell
> docker run --rm "debian:bookworm-slim" bash -c 'numfmt --to iec $(echo $(($(getconf _PHYS_PAGES) * $(getconf PAGE_SIZE))))'
> ```

##### 4. Airflow 실행
이제 다음 명령어로 모든 서비스를 컨테이너화하면 Airflow를 사용할 수 있다
```shell
docker compose up
```

`http://localhost:8080`으로 접속해서 id, password로 airflow, airflow를 입력하면 다음과 같이 예시 Dag들이 있는 Web UI를 확인할 수 있다

![[docker-compose를 이용한 Apache Airflow _2.10.5) 시작하기 - 2025-06-02 - 15-52-09.png|818x543]]


---
### docker-compose.yaml  살펴보기

Airflow `docker-compose.yaml`을 보면 공통적으로 활용되는 부분을 x-airflow-common로 모아서 작성한 뒤 앵커를 활용해서 반복적으로 활용하고 있기 때문에 해당 부분을 먼저 살펴보고 각 서비스를 살펴보자

##### x-airflow-common

```yaml title="x-airflow-common"
x-airflow-common:
  &airflow-common
  # In order to add custom dependencies or upgrade provider packages you can use your extended image.
  # Comment the image line, place your Dockerfile in the directory where you placed the docker-compose.yaml
  # and uncomment the "build" line below, Then run `docker-compose build` to build the images.
  image: ${AIRFLOW_IMAGE_NAME:-apache/airflow:2.10.5}
  # build: .
  environment:
    &airflow-common-env
    AIRFLOW__CORE__EXECUTOR: CeleryExecutor
    AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
    AIRFLOW__CELERY__RESULT_BACKEND: db+postgresql://airflow:airflow@postgres/airflow
    AIRFLOW__CELERY__BROKER_URL: redis://:@redis:6379/0
    AIRFLOW__CORE__FERNET_KEY: ''
    AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION: 'true'
    AIRFLOW__CORE__LOAD_EXAMPLES: 'true'
    AIRFLOW__API__AUTH_BACKENDS: 'airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session'
    # yamllint disable rule:line-length
    # Use simple http server on scheduler for health checks
    # See https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/logging-monitoring/check-health.html#scheduler-health-check-server
    # yamllint enable rule:line-length
    AIRFLOW__SCHEDULER__ENABLE_HEALTH_CHECK: 'true'
    # WARNING: Use _PIP_ADDITIONAL_REQUIREMENTS option ONLY for a quick checks
    # for other purpose (development, test and especially production usage) build/extend Airflow image.
    _PIP_ADDITIONAL_REQUIREMENTS: ${_PIP_ADDITIONAL_REQUIREMENTS:-}
    # The following line can be used to set a custom config file, stored in the local config folder
    # If you want to use it, outcomment it and replace airflow.cfg with the name of your config file
    # AIRFLOW_CONFIG: '/opt/airflow/config/airflow.cfg'
  volumes:
    - ${AIRFLOW_PROJ_DIR:-.}/dags:/opt/airflow/dags
    - ${AIRFLOW_PROJ_DIR:-.}/logs:/opt/airflow/logs
    - ${AIRFLOW_PROJ_DIR:-.}/config:/opt/airflow/config
    - ${AIRFLOW_PROJ_DIR:-.}/plugins:/opt/airflow/plugins
  user: "${AIRFLOW_UID:-50000}:0"
  depends_on:
    &airflow-common-depends-on
    redis:
      condition: service_healthy
    postgres:
      condition: service_healthy
```

- image : AIRFLOW_IMAGE_NAME 값이 `.env`에 없으면 apache/airflow:2.10.5 도커 이미지를 사용
	- 만약 추가 패키지 설치 등 다른 이미지 기반으로 실행하고 싶으면 image 라인 주석처리하고 Dockerfile 작성 후 build 라인 주석 해제
- environment
	- Airflow executor로 CeleryExecutor 사용
	- Airflow에서 사용할 db로 postgreSQL 사용 (user, password, db이름 모두 airflow)
	- CeleryExecutor에서 사용할 Redis 지정
	- Fernet Key는 암호화용 (빈 값이면 최초 실행 시 자동 생성)
    - DAG 생성 시 기본으로 비활성화, 예제 DAG는 기본 로드
    - API 인증방식 지정 (기본/세션 방식 모두 활성화)
    - 스케줄러 헬스체크 서버 활성화
    - pip로 추가 패키지 설치(테스트용), 운영에서는 이미지 커스텀 권장
- volumes
	- local에 생성한 `/dags`, `/logs`, `/config`, `/plugins`를 바인드 마운트
- user : 컨테이너 내부에서 프로세스를 “AIRFLOW_UID(호스트 UID) 사용자”와 “0(root) 그룹” 권한으로 실행
- depends_on
	- redis의 health check가 성공
	- postgres health check가 성공

그리고 여기에서 3개의 앵커를 지정해서 뒤에서 활용하고 있다
1. &airflow-common : image + environments + volumes + user + depends_on
2. &airflow-common-env : environments + volumes + user + depends_on
3. &airflow-common-depends-on : depends_on

##### 서비스 1. postgres
```yaml title="postgres"
  postgres:
    image: postgres:13
    environment:
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow
      POSTGRES_DB: airflow
    volumes:
      - postgres-db-volume:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "airflow"]
      interval: 10s
      retries: 5
      start_period: 5s
    restart: always
```
- image : postgres:13 사용
- environment : USER, PASSWORD, DB 모두 airflow로 설정
- volumes : 뒤에서 정의할 docker volume인 postgres-db-volume과 컨테이너의 `/var/lib/postgresql/data`를 마운트
- healthcheck : depends_on 옵션에서 health check를 성공해야 다른 서비스들이 실행되기 때문에 설정
- restart : 오류나 수동 stop 이외의 이유로 컨테이너가 중단되면 언제나 재시작

##### 서비스 2. redis
```yaml title="redis"
  redis:
    # Redis is limited to 7.2-bookworm due to licencing change
    # https://redis.io/blog/redis-adopts-dual-source-available-licensing/
    image: redis:7.2-bookworm
    expose:
      - 6379
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 30s
      retries: 50
      start_period: 30s
    restart: always
```
- expose : 컨테이너끼리 통신할 때 6379 포트 사용

##### 서비스 3. airflow-webserver
```yaml title="airflow webserver"
  airflow-webserver:
    <<: *airflow-common
    command: webserver
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: always
    depends_on:
      <<: *airflow-common-depends-on
      airflow-init:
        condition: service_completed_successfully
```
- <<: \*airflow-common  : x-airflow-common의 설정을 모두 가져옴
	- image, environment, volumes, depends_on
- command : 컨테이너 실행할 때 `airflow webserver` 실행
	- 위에서 사용한 Airflow 도커 이미지 내부에 ENTRYPOINT로 'airflow'가 설정되어 있어서 실제로 `airflow webserver`가 실행
		- [참고](https://github.com/apache/airflow/blob/main/scripts/docker/entrypoint_prod.sh) (마지막 줄) : `exec "airflow" "${@}"`
- ports : 호스트 8080과 컨테이너 8080 연결
- depends_on : \*airflow-common에 depends_on이 있지만 추가로 airflow-init에 대한 dependency를 넣어야 해서 \*airflow-common-depends-on 앵커 재사용
	- airflow_init 서비스가 성공적으로 완료되면 실행

##### 서비스 4. airflow-scheduler
```yaml title="airflow-scheduler"
  airflow-scheduler:
    <<: *airflow-common
    command: scheduler
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8974/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: always
    depends_on:
      <<: *airflow-common-depends-on
      airflow-init:
        condition: service_completed_successfully
```

##### 서비스 5. airflow-worker
```yaml title="airflow-worker"
  airflow-worker:
    <<: *airflow-common
    command: celery worker
    healthcheck:
      # yamllint disable rule:line-length
      test:
        - "CMD-SHELL"
        - 'celery --app airflow.providers.celery.executors.celery_executor.app inspect ping -d "celery@$${HOSTNAME}" || celery --app airflow.executors.celery_executor.app inspect ping -d "celery@$${HOSTNAME}"'
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    environment:
      <<: *airflow-common-env
      # Required to handle warm shutdown of the celery workers properly
      # See https://airflow.apache.org/docs/docker-stack/entrypoint.html#signal-propagation
      DUMB_INIT_SETSID: "0"
    restart: always
    depends_on:
      <<: *airflow-common-depends-on
      airflow-init:
        condition: service_completed_successfully
```
- healthcheck : Celery worker가 살아 있는지 ping을 보내 확인하고 실패할 경우 다른 명령어로 체크
- environments : 추가할 내용 있어서 \*airflow-common-env 하고 추가 작성
	- DUMB_INIT_SETSID : [[DUMB_INIT_SETSID|시그널 전달 문제 해결]]

##### 서비스 6. airflow-triggerer
```yaml title="airflow-triggerer"
  airflow-triggerer:
    <<: *airflow-common
    command: triggerer
    healthcheck:
      test: ["CMD-SHELL", 'airflow jobs check --job-type TriggererJob --hostname "$${HOSTNAME}"']
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: always
    depends_on:
      <<: *airflow-common-depends-on
      airflow-init:
        condition: service_completed_successfully
```

##### 서비스 7. airflow-init
```yaml title="airflow-init"
  airflow-init:
    <<: *airflow-common
    entrypoint: /bin/bash
    # yamllint disable rule:line-length
    command:
      - -c
      - |
        if [[ -z "${AIRFLOW_UID}" ]]; then
          echo
          echo -e "\033[1;33mWARNING!!!: AIRFLOW_UID not set!\e[0m"
          echo "If you are on Linux, you SHOULD follow the instructions below to set "
          echo "AIRFLOW_UID environment variable, otherwise files will be owned by root."
          echo "For other operating systems you can get rid of the warning with manually created .env file:"
          echo "    See: https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html#setting-the-right-airflow-user"
          echo
        fi
        one_meg=1048576
        mem_available=$$(($$(getconf _PHYS_PAGES) * $$(getconf PAGE_SIZE) / one_meg))
        cpus_available=$$(grep -cE 'cpu[0-9]+' /proc/stat)
        disk_available=$$(df / | tail -1 | awk '{print $$4}')
        warning_resources="false"
        if (( mem_available < 4000 )) ; then
          echo
          echo -e "\033[1;33mWARNING!!!: Not enough memory available for Docker.\e[0m"
          echo "At least 4GB of memory required. You have $$(numfmt --to iec $$((mem_available * one_meg)))"
          echo
          warning_resources="true"
        fi
        if (( cpus_available < 2 )); then
          echo
          echo -e "\033[1;33mWARNING!!!: Not enough CPUS available for Docker.\e[0m"
          echo "At least 2 CPUs recommended. You have $${cpus_available}"
          echo
          warning_resources="true"
        fi
        if (( disk_available < one_meg * 10 )); then
          echo
          echo -e "\033[1;33mWARNING!!!: Not enough Disk space available for Docker.\e[0m"
          echo "At least 10 GBs recommended. You have $$(numfmt --to iec $$((disk_available * 1024 )))"
          echo
          warning_resources="true"
        fi
        if [[ $${warning_resources} == "true" ]]; then
          echo
          echo -e "\033[1;33mWARNING!!!: You have not enough resources to run Airflow (see above)!\e[0m"
          echo "Please follow the instructions to increase amount of resources available:"
          echo "   https://airflow.apache.org/docs/apache-airflow/stable/howto/docker-compose/index.html#before-you-begin"
          echo
        fi
        mkdir -p /sources/logs /sources/dags /sources/plugins
        chown -R "${AIRFLOW_UID}:0" /sources/{logs,dags,plugins}
        exec /entrypoint airflow version
    # yamllint enable rule:line-length
    environment:
      <<: *airflow-common-env
      _AIRFLOW_DB_MIGRATE: 'true'
      _AIRFLOW_WWW_USER_CREATE: 'true'
      _AIRFLOW_WWW_USER_USERNAME: ${_AIRFLOW_WWW_USER_USERNAME:-airflow}
      _AIRFLOW_WWW_USER_PASSWORD: ${_AIRFLOW_WWW_USER_PASSWORD:-airflow}
      _PIP_ADDITIONAL_REQUIREMENTS: ''
    user: "0:0"
    volumes:
      - ${AIRFLOW_PROJ_DIR:-.}:/sources
```

- command
	- AIRFLOW_UID 없으면 경고 메시지 출력
	- 메모리 4GB 미만, CPU 2개 미만, 디스크 10GB 미만이면 경고
	- 컨테이너에 `/opt/airflow/{logs, dags, plugins, config` 폴더 구조 생성
	- 호스트 유저인 AIRFLOW_UID를 root 그룹으로 지정 -> 파일/폴더를 마음대로 읽고 쓸 수 있음
	- airflow version 명령 실행
- environment 
	- \_AIRFLOW_DB_MIGRATE : 메타데이터 DB 스키마 최신 상태로 마이그레이션 (처음 실행하거나 업그레이드 후 스키마 변경 필요 시)
	- \_AIRFLOW_WWW_USER_CREATE : UI 로그인용 웹 사용자 생성
		- `airflow users create --username ~~` 이 실행됨
	- \_PIP_ADDITIONAL_REQUIREMENTS : 이 컨테이너는 초기화용이니 고의적으로 생략
- user : 컨테이너를 루트 사용자로 실행 (수행하는 작업이 루트 사용자 권한 필요)
	- 다른 서비스는 제한된 권한의 사용자로 작동
- volumes : 컨테이너의 `/sources`에 마운트

##### 서비스 8. airflow-cli
```yaml title="airflow-cli"
  airflow-cli:
    <<: *airflow-common
    profiles:
      - debug
    environment:
      <<: *airflow-common-env
      CONNECTION_CHECK_MAX_COUNT: "0"
    # Workaround for entrypoint issue. See: https://github.com/apache/airflow/issues/16252
    command:
      - bash
      - -c
      - airflow

```
- environment 
	- `CONNECTION_CHECK_MAX_COUNT` : Airflow CLI 실행 시, 외부 서비스 연결 검사를 몇 번까지 시도할지 지정
		- 연결 확인 아예 생략. 빠르게  CLI로 명령하고 싶을 때 사용

##### 서비스 9. flower
```yaml title="flower"
  flower:
    <<: *airflow-common
    command: celery flower
    profiles:
      - flower
    ports:
      - "5555:5555"
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:5555/"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: always
    depends_on:
      <<: *airflow-common-depends-on
      airflow-init:
        condition: service_completed_successfully
```
- profiles : 특정 서비스(컨테이너)를 “선택적으로” 실행할 수 있게 해주는 기능
	- `docker compose up --profile flower`를 해야 flower 서비스까지 실행
