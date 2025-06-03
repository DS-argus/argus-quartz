---
tags:
  - docker
created: 2025-06-04T11:19:33
updated: 2025-06-04T00:07:39
---
### 레이어 동작 방식

##### 1. tar → gzip 저장
- 각 명령(`RUN`, `COPY` 등)은 읽기-전용 레이어를 생성
- 생성된 레이어는 **tarball[^1] 후 gzip[^2]** 으로 압축되어 디스크에 저장
- 저장 공간은 다소 줄지만, 컨테이너 실행 시 overlay-fs[^3]가 압축을 풀어 실제 크기만큼 공간을 점유

##### 2. 삭제해도 크기 복구 불가
```dockerfile
COPY model.ckpt /app/
RUN rm /app/model.ckpt   # rm으로 지워도 이전 레이어는 남는다
```
- `rm` 은 “삭제 diff”만 기록
- 최종 이미지에는 **model.ckpt가 포함된 레이어 + 빈 레이어** 두 개가 존재하여 용량이 줄지 않음 

##### 3. 중복 파일은 레이어별로 중복 저장
동일 파일을 다른 경로로 다시 `COPY` 하면 gzip 압축본이 레이어마다 반복 저장되어 용량이 증가

---

### 용량 최적화 전략

##### 1. 멀티스테이지 빌드
- 빌드·테스트·컴파일 단계 (Stage 1)와 런타임 단계(Stage 2)를 분리해 최종 이미지에 **실행에 꼭 필요한 바이너리**만 포함
	```Dockerfile
	# Stage 1 ─ 빌드
	FROM pytorch/pytorch:2.2 AS build
	COPY . /workspace
	RUN python train.py && pip wheel -w dist .
	
	# Stage 2 ─ 런타임
	FROM python:3.11-slim
	COPY --from=build /workspace/dist/*.whl /tmp/
	RUN pip install /tmp/*.whl && rm -rf /tmp
	CMD ["python", "-m", "myapp"]
	```
	- 첫 스테이지에만 대용량 데이터·컴파일 툴 설치  
	- 두 번째 스테이지는 slim 베이스 + 휠 파일만 포함

##### 2. `.dockerignore` 활용
- 빌드 컨텍스트에서 불필요·민감·대용량 파일을 제외해 전송 바이트·캐시 비교 범위를 줄임
	```dockerignore
	# 1) 빌드 산출물
	__pycache__/
	*.py[cod]
	build/
	dist/
	
	# 2) IDE 설정
	.vscode/
	.idea/
	
	# 3) 데이터·모델
	data/
	weights/
	*.ckpt
	
	# 4) 기타
	*.log
	.DS_Store
	
	# 5) 복사 허용
	!src/**
	!requirements.txt
	```
	- BuildKit[^4] `--ssh`, `--secret`, `--mount` 대상은 `.dockerignore`의 영향을 받지 않음  
	- 민감 정보 `.env*`, `private.pem` 은 `.dockerignore`로 차단하고 파이프라인에서 `--secret`으로 주입
##### 3. RUN 합치기 & 레이어 수 최소화
- 한 줄로 묶어 **레이어 하나**만 생성하고 패키지 캐시·임시 파일 즉시 삭제해 이미지 용량 최소화
	```Dockerfile
	RUN apt update && \
	    apt install -y gcc make libpq-dev && \
	    apt clean && rm -rf /var/lib/apt/lists/*
	```
##### 4. 레이어 캐시 최적화
- **변경 빈도가 낮은 명령**을 Dockerfile 상단에 배치  -> requirements가 바뀌지 않으면 이후 단계 전체 캐시 히트
	```Dockerfile
	COPY requirements.txt .
	RUN pip install -r requirements.txt
	COPY . .
	```

##### 5. 슬림·알파인 베이스 이미지
- `python:3.12-slim`, `node:20-alpine` 처럼 **필수 런타임만** 포함한 이미지를 우선 고려  
- glibc ↔ musl[^5] 차이로 바이너리 호환이 깨질 수 있으니 C 확장이 있을 땐 slim 계열이 안전

##### 6. ENV · ARG · USER
- 빌드 환경과 실행 환경에 따라 유연하게 이미지 동작을 제어
	- `ARG VERSION=latest` 로 빌드 시점 변수, `ENV ENV_NAME=prod` 로 런타임 변수 설정  
- 비루트 실행 권고 :  보안을 위해 RUN, CMD, ENTRYPOINT 등을 non-root 계정으로 실행
	```Dockerfile
	RUN useradd -m appuser
	USER appuser
	```

---
### 정리
- Docker 이미지는 **압축된 레이어 스택**이며, `COPY`·`ADD`로 포함한 모든 파일이 최종 용량에 반영
- 빌드 후 삭제해도 용량은 회수되지 않으므로 **사전에 불필요 파일을 제외**하거나 **멀티스테이지 빌드**로 구분 저장하는 것이 좋음

[^1]: 여러 파일, 디렉터리를 하나의 연속된 스트림으로 묶은 (압축 X) 패키지 형식으로 `.tar` 확장자를 가짐

[^2]: DEFLATE 알고리즘 기반 압축 포맷 및 유틸리티. tarball과 같은 단일 파일을 `.gz`로 압축해 용량 줄임. 관례상 tar와 결합해 `.tar.gz`, `.tgz`형식으로 사용

[^3]: 리눅스 커널의 유니온 파일시스템 드라이버. 여러 읽기 전용 레이어와 하나의 쓰기 레이어를 겹쳐 단일 디렉터리 트리처럼 보여줌

[^4]: 차세대 빌드 엔진으로, 병렬 빌드·고급 캐시·시크릿·SSH 마운트 등 현대적 기능을 지원해 빌드 속도와 유연성을 대폭 개선

[^5]: 경량, 고성능을 목표로 한 리눅스용 C 표준 라이브러리로 alpine 리눅스 등에서 사용
