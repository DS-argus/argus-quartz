---
tags:
  - bitnami
  - docker
  - spark
  - troubleshooting
created: 2025-06-02T23:27:34
updated: 2025-06-14T21:55:57
---
### 문제
- bitnami/spark Docker Compose 환경에서 `spark-submit` 실행 시 `basedir must be absolute: ?/.ivy2/local` 에러 발생
	```bash
	spark-submit --master spark://spark-master:7077 /opt/bitnami/spark/jobs/word_count.py
	```

- 사용한 docker-compose.yaml은 다음과 같음
	```yaml title="docker-compose.yaml"
	services:
	
	    spark-master:
		    image: bitnami/spark:latest
	        container_name : spark-master
	        environment:
	            - SPARK_MODE=master
	        ports:
	            - "7077:7077"
	            - "8080:8080"
	        volumes:
	            - ./jobs:/opt/bitnami/spark/jobs
	        networks:
	            - spark-network
	
	    spark-worker-1:
		    image: bitnami/spark:latest
	        container_name: spark-worker-1
	        environment:
	            - SPARK_MODE=worker
	            - SPARK_MASTER_URL=spark://spark-master:7077
	            - SPARK_WORKER_MEMORY=2G
	            - SPARK_WORKER_CORES=1
	        ports:
	            - "8081:8081"
	        volumes:
	            - ./jobs:/opt/bitnami/spark/jobs
	        networks:
	            - spark-network
	
	    spark-worker-2:
		    image: bitnami/spark:latest
	        container_name: spark-worker-2
	        environment:
	            - SPARK_MODE=worker
	            - SPARK_MASTER_URL=spark://spark-master:7077
	            - SPARK_WORKER_MEMORY=2G
	            - SPARK_WORKER_CORES=1
	        ports:
	            - "8082:8081"
	        volumes:
	            - ./jobs:/opt/bitnami/spark/jobs
	        networks:
	            - spark-network
	networks:
	    spark-network:
	        driver: bridge
	```

---
### 원인
- **Ivy 캐시 경로 결정 로직**  
	- Spark(Java)는 외부 라이브러리를 받을 때 `user.home/.ivy2` 를 기본 캐시 경로로 사용
	- 이때 `user.home` 값은 glibc[^1]에서 제공하는 함수인 `getpwuid()` → `/etc/passwd` 조회 결과로 계산
- **[bitnami/spark 이미지](https://hub.docker.com/r/bitnami/spark/dockerfile) 특성**  
	1. 컨테이너는 `USER 1001` 로 실행되지만 `/etc/passwd`에 UID 1001 을 가진 사용자 레코드가 없음
	2. 따라서 `getpwuid(1001)`이 “?” 문자열을 반환해서 `user.home = "?"`이 됨 
	3. Ivy가 “?/.ivy2/local” 같은 **잘못된 상대경로**를 만들고, 절대경로 검증에서 `basedir must be absolute` 예외 발생
- **nss-wrapper 라이브러리 미활성화**  
	- bitnami 이미지에는 `libnss_wrapper.so`가 들어 있음
	- 하지만 사용자 레코드를 **동적으로 생성·적용( `LD_PRELOAD` )하는 스크립트가 없음** → 오류 그대로 노출

> [!tip] 공식 Apache/Spark 이미지에서는?
> - 직접 useradd 명령어로 사용자를 등록해서 명시적으로 처리
> - OpenShift[^2]처럼 임의의 UID로 실행되어도 런타임에 동적으로 passwd 엔트리 만들어서 항상 사용자 정보 존재하도록 함

---
### 해결
1. 캐시 경로 강제 지정 : `--conf spark.jars.ivy="/tmp"` 추가
	```shell
	spark-submit --master spark://spark-master:7077 --conf spark.jars.ivy="/tmp" /opt/bitnami/spark/jobs/word_count.py
	```
	- 장점 : 가장 간단한 해결책
	- 단점 : Ivy 캐시가 `/tmp`에 쌓임

2. nss-wrapper 활성화 
	```shell
	export LD_PRELOAD=/opt/bitnami/common/lib/libnss_wrapper.so
	export NSS_WRAPPER_PASSWD=$(mktemp)
	export NSS_WRAPPER_GROUP=$(mktemp)
	echo "spark:x:1001:0:Spark:/opt/bitnami:/sbin/nologin" > "$NSS_WRAPPER_PASSWD"
	echo "spark:x:0:" > "$NSS_WRAPPER_GROUP"
	```
	- 사용자 레코드를 “가짜”로 동적 생성해 `user.home` 정상화
	- 컨테이너 재시작마다 실행 필요

3. Dockerfile 커스텀 및 docker-compose.yaml에서 각 서비스의 기존 image 부분을 build로 수정
	```dockerfile
	FROM bitnami/spark:latest
	USER root
	RUN useradd -u 1001 -m spark
	USER spark
	```

	```yaml
	    spark-master:
	        build:
	            context: .
	            dockerfile: Dockerfile
	        container_name : spark-master
	```

> 실무에서는 **(A)** 가 가장 빠르고 안전하며,    
> 장기적으로는 **(C)** (사용자 레코드 포함 커스텀 이미지)로 일관성 있게 관리하는 것을 권장

[^1]: 리눅스/유닉스 계열 OS에서 거의 모든 C/C++ 프로그램이 사용하는 기본 시스템 라이브러리. 대부분의 시스템 명령어에서 내부적으로 glibc 함수 호출

[^2]: Red Hat에서 만든 기업용 쿠버네티스 기반 컨테이너 플랫폼. 보안 강화 목적으로 각 파드/컨테이너를 임의의 UID로 실행
