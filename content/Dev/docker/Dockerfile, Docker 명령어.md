---
tags:
  - docker
  - dockerfile
created: 2025-06-04T00:00:00
updated: 2025-06-04T00:12:09
---
### Dockerfile 명령어
##### 기본 명령어
- FROM : 베이스 이미지 지정 (필수)
	```docker
	FROM python:3.12-slim
	FROM python:3.12-slim AS build-stage
	```
	- FROM을 여려 번 사용하는 멀티 스테이지 빌드 시 AS 를 활용해 해당 base 이미지를 reference 가능 (COPY 참고)

- RUN : 셸 커맨드 실행 (이미지 생성 시 실행됨)
	``` docker
	RUN apt update && apt install -y curl
	```
	- 빌드 중 컨테이너 안에서 명령어 실행하고 그 결과를 이미지 레이어에 저장
	- FROM instruction에서 지정한 이미지에서 실행할 수 있어야 함

- ENTRYPOINT : 실행 명령을 고정시키고 싶을 때 사용 (CMD보다 우선)
	```docker
	ENTRYPOINT ["python", "main.py"]
	```
	- Dockerfile에서 설정하거나, docker run 명령어에서 명시적으로 지정

- CMD : ENTRYPOINT의 기본 인자 또는 대체 명령어
	```docker
	CMD ["python", "app.py"]
	```
	- CMD는 하나만 존재해야 함 (여러 개 쓰면 마지막 것만 유효)
	- ENTRYPOINT ["echo"], CMD ["Hello, World!"] 인 경우 docker run 하면 Hello, World! 출력
		- docker run test Hi GPT! 하면 Hi, GPT! 출력


- WORKDIR : 이후 명령어가 실행될 작업 디렉토리 설정
	```docker
	WORKDIR /app
	```


- COPY : 로컬 파일을 이미지에 복사
	```docker
	COPY . /app
	COPY requirements.txt .
	COPY --from=build-stage /build.txt /build.txt
	```
	- build-stage라고 명명한 base 이미지 내의 'build.txt'를 현재 base 이미지에 복사

- ADD : COPY처럼 파일 복사. +URL에서 다운로드하거나 압축 파일 자동 압축 해제 기능 포함
	```docker
	ADD https://example.com/file.tar.gz /files/
	```
	- 예측 가능성, 보안, 유지보수성 때문에 복사 목적인 경우 COPY를 사용하는 것을 권장


- ENV : 환경 변수 설정
	```docker
	ENV ENV_NAME=production
	```


- EXPOSE : 컨테이너가 열 포트를 명시 (실제 포트를 노출하는 건 아님)
	```docker
	EXPOSE 8080
	```

- VOLUME : 외부 마운트용 디렉토리 지정
	```docker
	VOLUME "/data"
	```
	- 컨테이너 내부 `/data` 폴더의 내용은 볼륨에 영구 저장

- ARG : 빌드 시점에서 사용할 변수 지정 (--build-arg와 함께 사용)
	```docker
	ARG VERSION=latest
	RUN echo $VERSION
	```

- USER : 특정 사용자로 명령 실행
	```docker
	USER nobody
	```


- SHELL : 기본 셸 변경 (보통 Windows용 이미지에서 사용)
	```docker
	SHELL ["powershell", "-Command"]
	```

##### 기타 명령어
- ONBUILD : 자식 Dockerfile에서 실행될 명령을 미리 정의
	```docker
	ONBUILD COPY . /app
	ONBUILD RUN pip install -r /app/requirements.txt
	```
	- 주로 base 이미지 커스터마이징에 활용
	- 예측 어려운 동작이 생길 수 있어 주의 필요

- HEALTHCHECK : 컨테이너의 상태를 모니터링하는 명령 설정
	```docker
	HEALTHCHECK --interval=30s --timeout=10s \
	  CMD curl -f http://localhost:8000/health || exit 1
	```

- LABEL : 이미지에 메타데이터 (버전, 작성자 등)를 추가
	```docker
	LABEL maintainer="argus@example.com"
	LABEL version="1.0" description="Spark ETL container"
	```

- STOPSIGNAL : docker stop 명령 시 보낼 신호를 지정
	```docker
	STOPSIGNAL SIGTERM
	```

- COPY --chown : 복사할 파일의 소유자 지정 (비루트 실행 시 유용)
	```docker
	COPY --chown=appuser:appgroup . /app
	```



---
### Docker 관련 명령어
##### 시스템/정보 확인
- 클라이언트 및 서버 버전 확인
	```shell
	docker version
	```

- 도커 시스템 정보
	```shell
	docker info
	```

- 실행 중인 컨테이너들의 리소스 사용량 모니터링
	```shell
	docker stats
	```

- 디스크 사용량 확인
	```shell
	docker system df
	```

- 사용하지 않는 이미지, 컨테이너, 볼륨 등 정리
	```shell
	docker system prune
	```

##### 이미지 

- 로컬에 저장된 이미지 목록 확인
	```shell
	docker image ls
	docker images
	```

- 이미지 태깅
	```shell
	docker tag <이미지> <새로운이름:태그>
	```

- DockerHub 등에서 이미지 다운로드
	```shell
	docker pull <이미지:태그>
	```

- Dockerfile로 이미지 build
	```shell
	docker build -t <이름:태그> <Dockerfile 경로>
	```
	- 특정 Dockerfile을 기준으로 이미지 빌드
		```shell
		docker build -t <이미지이름> -f <Dockerfile경로> .
		```
	- 다른 아키텍처로 이미지 build
		```bash
		docker buildx build --platform linux/amd64 -t <이름:태그> <Dockerfile 경로>
		```
		- `docker buildx` : 차세대 빌드 엔진으로 멀티플랫폼 빌드 지원
			- 맥 실리콘칩은 ARM 아키텍처이고 ECS에서는 대부분 amd 아키텍처
			- ARM 맥에서 amd64 서버용 이미지를 만들 수 있음

- 이미지 삭제
	```shell
	docker rmi <이미지ID or 이름>
	```


- 이미지 저장
	```shell
	docker save -o <파일명>.tar <이미지명>
	```

- 저장된 이미지 로드
	```shell
	docker load -i <파일명>.tar
	```

- 이미지 생성 이력 확인
	```shell
	docker history <이미지명>
	```

##### 컨테이너

- 실행 중인 컨테이너 목록
	```shell
	docker ps <옵션>
	```
	- `-a` : 중지된 컨테이너 포함
	- `-q` : 컨테이너 ID만 출력

- 새 컨테이너 생성 및 실행
	```shell
	docker run <옵션> <이미지>
	```
	- 주요 옵션 : `docker run --help`
		- 공통 with  `docker exec`
			- `-u <user>` : 해당 유저로 명령 실행
			- `-d` : 백그라운드 모드 실행  
			- `-i` : 인터랙티브 모드
			- `-t` : TTY 할당. 가상 터미널 붙여주는 것 => 내가 입력하는 명령어가 컨테이너에 바로 전달되고 출력도 내 터미널에 보임
				- `-it` : 인터랙티브 모드 + 터미널 연결
					- `docker run -it --name python-container python:3.11` : python shell 열림
				- `-dit` : 인터렉티브 + 백그라운드  
					- `docker run -dit --name python-container python:3.11` : container 실행 중
					- `docker exec -it python-container python` : 따로 접속
			- `--workdir` , `-w` : 작업 디렉토리 지정
			- `--privileged` : 컨테이너에 특정 권한 부여
			- `-e <key>=<val>` : 환경 변수 설정  
		- `run` 옵션
			- `--name` : container 이름 지정  
			- `--rm` : 실행 종료 시 컨테이너 자동 삭제  
			- `-p <host>:<container>` : 포트 바인딩  
			- `-v <volume이름>:<container경로>` : 볼륨 마운트  
				- volume 이름 없으면 임의의 이름으로 생성
			- `-h` : 컨테이너 호스트네임 지정
			- `--network <네트워크모드/이름>` : 사용자 정의 네트워크 지정  
			- `--restart` : 자동 재시작 정책 지정
			- `--env-file` : 환경변수 파일 (.env)로 지정
			- `--entrypoint` : 엔트리포인트 (기본 실행 명령) 지정
			- `-c` : CPU 점유 비율 설정
			- `-m` : 메모리 제한
			- `--volumes-from` : 다른 컨테이너의 도커 볼륨을 공유 (업데이트 간 상태 보존 용도에 적합)
				- volume을 따로 생성하고 -v로 볼륨 연결하는 것이 바람직ㅁ
			- `--health-cmd=<명령어>` : 헬스체크용 명령어 (실행하는 이미지 Dockerfile에 따로 HEALTHCHECK 없는 경우)
			- `--health-interval=<간격>` : 실행 주기. 기본값 30초
			- `--health-timeout=<시간>` : 실패로 간주되기 전까지 기다릴 최대 시간. 기본값 30초
			- `--health-retries=<횟수>` : 몇 번 연속 실패하면 Unhealthy로 판단할지 지정
			- `--health-start-period=<시간>` : 컨테이너 시작 후, health check 시작 전 대기하는 시간
			- `--no-healthcheck` : 이미 정의된 health check 자체 비활성화


- 컨테이너에서 실행 중인 프로세스 목록
	```shell
	docker container top <컨테이너ID>
	```

- 실행 중인 컨테이너 상태 확인 : CPU, 메모리, 디스크 사용량
	```shell
	docker stats
	```
	
- 실행 중인 컨테이너 중지
	```shell
	docker stop <컨테이너ID>
	```

- 중지된 컨테이너 시작 (옵션은 처음 run할 때 그대로)
	```shell
	docker start <컨테이너ID>
	```

- 컨테이너 재시작 : stop + start와 동일. 설정 변경 후 재적용, 임시 장애 복구 등
	```shell
	docker restart <컨테이너ID>
	```

- 컨테이너 삭제
	```shell
	docker rm <옵션> <컨테이너ID>
	```
	- `-f` : 실행 중인 컨테이너도 강제 삭제
	- `-v` : 해당 컨테이너와 연결된 volume 삭제
	- 모든 컨테이너 (실행 및 중지) 삭제
		```shell
		docker rm -f ${docker ps -aq}
		```

- 컨테이너에 접속
	```shell
	docker exec <옵션> <컨테이너ID/이름> <명령어>
	```
	- 주요 옵션 : `docker exec --help`
		- `-i`, `-t`, `-d` , `-e`, `-u`, `-w`, `--privileged`
	- 주요 명령어 
		- `bash`, `sh`, `python`
		- `ls -al` : 파일 목록 자세히 보기
		- `cat <파일명>` : 파일 내용 보기
		- `tail -f <로그파일>` : 로그파일 실시간 모니터링
		- `env` : 환경변수 목록 출력
		- `ps aux` : 프로세스 목록 보기

- 컨테이너 메인 프로세스에 입출력으로 직접 연결  
    ```shell
    docker attach <컨테이너ID/이름>
    ```
	- 컨테이너의 메인 프로세스(시작 커맨드)에 표준 입출력(stdin, stdout, stderr)으로 직접 연결  
		- 입력한 내용과 결과(출력)가 컨테이너의 메인 프로세스와 바로 주고받아짐
		- 여러 번 attach하면 여러 터미널이 동시에 같은 표준 입출력을 공유 (완전히 독립적이지 않음)
		- attach 상태에서 `Ctrl+C`(SIGINT) 등 신호는 컨테이너 메인 프로세스에 전달
			- 대부분의 경우 컨테이너가 종료될 수 있음
    - 주의점
        - 별도의 새 프로세스를 실행하지 않음 (새 셸이 아닌 기존 프로세스에 붙음)
        - 데몬/서비스 컨테이너(nginx, mysql 등)에서는 attach해도 인터랙티브한 입출력이 불가능할 수 있음
        - attach 후 입력 충돌, 종료 신호 주의 (실제 서비스 컨테이너에는 거의 사용하지 않음)
        - 컨테이너가 멈추거나 메인 프로세스가 종료되면 attach 세션도 종료됨
    - 주요 사용 예시
        - `docker run -it ubuntu`  : 컨테이너를 백그라운드로 띄웠을 때, 나중에 attach로 다시 표준입출력 연결
        - `docker attach <컨테이너ID>`

- 로그 출력
	```shell
	docker logs <컨테이너ID>
	```

- 상세 정보 출력 (JSON)
	```shell
	docker inspect <컨테이너ID>
	```

##### 네트워크

- 네트워크 목록
	```shell
	docker network ls
	```

- 네트워크 생성
	```shell
	docker network create <이름>
	```

- 네트워크 삭제
	```shell
	docker network rm <이름>
	```

- 네트워크 검사
	```shell
	docker network inspect <컨테이너ID/이름>
	```



##### 볼륨
- 호스트-컨테이너 파일 복사
	```shell
	docker cp <파일path> <컨테이너이름/ID>:<컨테이너path>    // local -> container
	docker cp <컨테이너이름/ID>:<컨테이너path> <로컬path>    // container -> local
	```

- 모든 볼륨 목록
	```shell
	docker volume ls
	```

- 새 볼륨 생성
	```shell
	docker volume create <이름>
	```

- 볼륨 삭제
	```shell
	docker volume rm <이름>
	```
