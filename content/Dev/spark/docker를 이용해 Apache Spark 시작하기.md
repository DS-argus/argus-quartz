---
tags:
  - spark
  - docker
  - pyspark
created: 2025-06-07T22:10:36
updated: 2025-06-15T22:11:48
---
### docker로 spark 실행하기
기본적으로 Apache Spark는 [여기](https://spark.apache.org/downloads.html)에서 직접 다운받을 수 있다  
하지만 역시나 로컬에 설치하는 것은 귀찮아질 가능성이 농후하기 때문에 docker를 이용해서 설치해보자  


[Github](https://github.com/apache/spark-docker)을 참고하면 Apache Spark의 docker image를 받을 수 있는 source는 두 곳인 것으로 보인다
1. Apache Spark Image
	- 이름 : apache/spark
	- link : [https://hub.docker.com/r/apache/spark](https://hub.docker.com/r/apache/spark)
	- source : [apache/spark-docker](https://github.com/apache/spark-docker)
2. Spark Docker Official Image
	- 이름 : spark
	- link : [https://hub.docker.com/_/spark](https://hub.docker.com/_/spark)
	- source : [apache/spark-docker](https://github.com/apache/spark-docker) and [docker-library/official-images](https://github.com/docker-library/official-images/blob/master/library/spark)

README에서 후자인 Official image를 사용하는 것을 추천하고 있기 때문에 후자를 사용해서 설치를 해보자

https://hub.docker.com/_/spark 에 들어가면 다양한 Tag로 원하는 이미지를 다운 받을 수 있다  
pyspark를 사용할 것이기 때문에 python3와 최신 java 17이 있는 이미지를 실행해보자

```bash
docker run -it --name spark-container -v ./:/opt/spark/work-dir spark:python3-java17 /bin/bash
```

그러면 컨테이너 내부 `/opt/spark/work-dir`에 접속할 수 있다


> [!note]+ 이건 spark를 어떻게 실행한거지?
> - 만약 내 노트북에서 위 명령어로 spark를 실행한 뒤, 후술할 spark-submit으로 job 제출한 경우
> 	- `--master`의 기본 값은 local이기 때문에 local 모드로 실행되며 Spark Driver, Executor 모두 하나의 JVM 안에서 실행
> - 만약 standalone으로 실행하려면?
> 	- 컨테이너 내부에서
> 		- `./sbin/start-master.sh`로 Master daemon 가동
> 		- `./sbin/start-worker.sh spark://localhost:7077`로 worker daemon 가동
> 		- `jps -l`로 잘 실행되었는지 확인 가능
> 	- spark-submit할 때 `--master` 옵션 추가
> - 자세한 내용은 [[Spark 구조 및 Deployment 방식]]

---
### 예제 실행 해보기

이제 잘 동작하는지 실행해볼 수 있다  
먼저 `docker run`에서 마운트한 현재 디렉토리에 다음을 추가한다
1. [mnmcount.py](https://github.com/databricks/LearningSparkV2/blob/master/chapter2/py/src/mnmcount.py)
2. [data/mnm.dataset.csv](https://github.com/databricks/LearningSparkV2/blob/master/chapter2/py/src/data/mnm_dataset.csv)

그리고 spark container에 접속한 뒤 `/opt/spark/bin`으로 이동해서 다음을 실행한다
```bash
./spark-submit ../work-dir/mnmcount.py ../work-dir/data/mnm_dataset.csv
```

> [!note]+ spark-submit
> - spark-submit 명령어를 사용하면 pyspark 스크립트(여기서는 mnmcount.py)를 독립 실행형 Spark 애플리케이션으로 실행할 수 있음
> - 이 명령은 Spark 클러스터 (혹은 로컬 모드)에서 드라이버 프로세스를 기동하여, 코드를 분산 환경에서 병렬로 실행
> - spark-submit을 활용하면 로컬 환경뿐 아니라 standalone, YARN, Kubernetes 등 다양한 클러스터 환경에서 동일한 코드로 대규모 데이터 처리 가능


그럼 긴 로그 중간중간에 다음과 같은 실행 결과를 확인할 수 있다
```text {1,12,22,25}
# 출력 1
+-----+------+-----+
|State|Color |Count|
+-----+------+-----+
|TX   |Red   |20   |
|NV   |Blue  |66   |
|CO   |Blue  |79   |
|OR   |Blue  |71   |
|WA   |Yellow|93   |
+-----+------+-----+

# 출력 2
+-----+------+----------+
|State|Color |sum(Count)|
+-----+------+----------+
|CA   |Yellow|100956    |
|WA   |Green |96486     |
|CA   |Brown |95762     |
|TX   |Green |95753     |
....

# 출력 3
Total Rows = 60

# 출력 4
+-----+------+----------+
|State|Color |sum(Count)|
+-----+------+----------+
|CA   |Yellow|100956    |
|CA   |Brown |95762     |
|CA   |Green |93505     |
|CA   |Red   |91527     |
|CA   |Orange|90311     |
|CA   |Blue  |89123     |
+-----+------+----------+
```


이 결과가 뭔진 모르지만 우선 돌아가는 것을 확인했다

---
### 예제 파일 분석
##### mnm_dataset.csv
이 데이터셋은 미국 각 주별로 다양한 색상의 M&M 초콜릿 개수를 샘플링해 집계한 것으로 총 100,000개의 line으로 구성되어 있으며 데이터의 일부를 확인해보면 다음과 같다
```
State,Color,Count
TX,Red,20
NV,Blue,66
CO,Blue,79
OR,Blue,71
WA,Yellow,93
WY,Blue,16
...
```

##### mnmcount.py
```python {10-13,19-22,28-31,38-42}
from __future__ import print_function
import sys
from pyspark.sql import SparkSession

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: mnmcount <file>", file=sys.stderr)
        sys.exit(-1)

    spark = (SparkSession
        .builder
        .appName("PythonMnMCount")
        .getOrCreate())
        
    # get the M&M data set file name
    mnm_file = sys.argv[1]
    
    # read the file into a Spark DataFrame
    mnm_df = (spark.read.format("csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .load(mnm_file))
        
    mnm_df.show(n=5, truncate=False)

    # aggregate count of all colors and groupBy state and color
    # orderBy descending order
    count_mnm_df = (mnm_df.select("State", "Color", "Count")
                    .groupBy("State", "Color")
                    .sum("Count")
                    .orderBy("sum(Count)", ascending=False))

    # show all the resulting aggregation for all the dates and colors
    count_mnm_df.show(n=60, truncate=False)
    print("Total Rows = %d" % (count_mnm_df.count()))

    # find the aggregate count for California by filtering
    ca_count_mnm_df = (mnm_df.select("*")
                       .where(mnm_df.State == 'CA')
                       .groupBy("State", "Color")
                       .sum("Count")
                       .orderBy("sum(Count)", ascending=False))

    # show the resulting aggregation for California
    ca_count_mnm_df.show(n=10, truncate=False)

```
하이라이트한 부분이 pyspark를 이용한 핵심 부분이다
- **SparkSession 생성**
	- pyspark에서 병렬 분산 처리를 시작하려면 먼저 SparkSession 객체를 생성해야 함
	- SparkSession은 클러스터와 연결하고 작업 실행의 시작점 역할
- **데이터 로드**
	- csv 파일을 Spark 자료형인 DataFrame으로 읽음
	- option("header", "true")로 첫 번째 줄을 컬럼명으로 인식, option("inferSchema", "true")로 컬럼 타입을 자동 추론
	- 로드된 데이터프레임에서 일부 행을 mnm_df.show(n=5, truncate=False)로 출력해 데이터 구조 확인 
- **GroupBy, Aggregation (집계 연산)**
	- groupBy("State", "Color").sum("Count") 구문을 사용해 State와 Color별로 M&M 개수의 총합을 집계
	- orderBy("sum(Count)", ascending=False)로 합계가 많은 순서대로 정렬
- **필터링 (추가 Transformation)** 
	- where(mnm_df.State == 'CA')로 State가 'CA'(캘리포니아)인 데이터만 추출
	- 동일하게 groupBy, sum, orderBy를 적용해 캘리포니아 내에서 색상별 M&M 개수 집계를 수행


수행한 작업 자체는 pandas를 이용해서 쉽게 할 수 있는 간단한 작업이지만,  
데이터셋이 커질수록 spark의 분산/병렬 처리 효과로 인해 처리 속도에서 상당한 이득을 볼 수 있을 것이다

---
### dockerfile 살펴보기
위에서 다운 받은 Dockerfile을 살펴보자

[docker official image Github](https://github.com/docker-library/official-images/blob/master/library/spark)에 가면 spark 공식 이미지들의 tag와 Dockerfile을 볼 수 있다
```text {2,5}

Tags: 4.0.0-scala2.13-java17-python3-ubuntu, 4.0.0-python3, 4.0.0, python3-java17
Architectures: amd64, arm64v8
GitCommit: 4bd1dbce94797b5b387b784db6b378069a8b6328
Directory: ./4.0.0/scala2.13-java17-python3-ubuntu

```

##### `spark:python3-java17` Dockerfile
해당 Directory로 가면 [Dockerfile](https://github.com/apache/spark-docker/blob/master/4.0.0/scala2.13-java17-python3-ubuntu/Dockerfile)을 찾을 수 있다

```dockerfile
FROM spark:4.0.0-scala2.13-java17-ubuntu

USER root

RUN set -ex; \
    apt-get update; \
    apt-get install -y python3 python3-pip; \
    rm -rf /var/lib/apt/lists/*

USER spark
```

`spark:4.0.0-scala2.13-java17-ubuntu` 라는 base image에 python과 pip을 설치한 것을 알 수 있다

- set -ex : 에러 발생 시 빌드 중단 + 실행되는 모든 명령어를 콘솔에 출력
- python3와 python3-pip 설치
- apt의 패키지 인덱스 파일 (캐시) 삭제해 이미지 용량 최적화

##### `spark:4.0.0-scala2.13-java17-ubuntu` Dockerfile
그럼 저 base image의 [Dockerfile](https://github.com/apache/spark-docker/tree/master/4.0.0/scala2.13-java21-ubuntu)을 살펴보자
```dockerfile
FROM eclipse-temurin:17-jammy

ARG spark_uid=185

RUN groupadd --system --gid=${spark_uid} spark && \
    useradd --system --uid=${spark_uid} --gid=spark spark

RUN set -ex; \
    apt-get update; \
    apt-get install -y gnupg2 wget bash tini libc6 libpam-modules krb5-user libnss3 procps net-tools gosu libnss-wrapper; \
    mkdir -p /opt/spark; \
    mkdir /opt/spark/python; \
    mkdir -p /opt/spark/examples; \
    mkdir -p /opt/spark/work-dir; \
    chmod g+w /opt/spark/work-dir; \
    touch /opt/spark/RELEASE; \
    chown -R spark:spark /opt/spark; \
    echo "auth required pam_wheel.so use_uid" >> /etc/pam.d/su; \
    rm -rf /var/lib/apt/lists/*

# Install Apache Spark
# https://downloads.apache.org/spark/KEYS
ENV SPARK_TGZ_URL=https://archive.apache.org/dist/spark/spark-4.0.0/spark-4.0.0-bin-hadoop3.tgz \
    SPARK_TGZ_ASC_URL=https://archive.apache.org/dist/spark/spark-4.0.0/spark-4.0.0-bin-hadoop3.tgz.asc \
    GPG_KEY=4DC9676CEF9A83E98FCA02784D6620843CD87F5A

RUN set -ex; \
    export SPARK_TMP="$(mktemp -d)"; \
    cd $SPARK_TMP; \
    wget -nv -O spark.tgz "$SPARK_TGZ_URL"; \
    wget -nv -O spark.tgz.asc "$SPARK_TGZ_ASC_URL"; \
    export GNUPGHOME="$(mktemp -d)"; \
    gpg --batch --keyserver hkps://keys.openpgp.org --recv-key "$GPG_KEY" || \
    gpg --batch --keyserver hkps://keyserver.ubuntu.com --recv-keys "$GPG_KEY"; \
    gpg --batch --verify spark.tgz.asc spark.tgz; \
    gpgconf --kill all; \
    rm -rf "$GNUPGHOME" spark.tgz.asc; \
    \
    tar -xf spark.tgz --strip-components=1; \
    chown -R spark:spark .; \
    mv jars /opt/spark/; \
    mv RELEASE /opt/spark/; \
    mv bin /opt/spark/; \
    mv sbin /opt/spark/; \
    mv kubernetes/dockerfiles/spark/decom.sh /opt/; \
    mv examples /opt/spark/; \
    ln -s "$(basename /opt/spark/examples/jars/spark-examples_*.jar)" /opt/spark/examples/jars/spark-examples.jar; \
    mv kubernetes/tests /opt/spark/; \
    mv data /opt/spark/; \
    mv python/pyspark /opt/spark/python/pyspark/; \
    mv python/lib /opt/spark/python/lib/; \
    mv R /opt/spark/; \
    chmod a+x /opt/decom.sh; \
    cd ..; \
    rm -rf "$SPARK_TMP";

COPY entrypoint.sh /opt/

ENV SPARK_HOME=/opt/spark

WORKDIR /opt/spark/work-dir

USER spark

ENTRYPOINT [ "/opt/entrypoint.sh" ]
```

여기서 하는 작업은 대충 다음과 같다
- 기본 설정
	-  **Java 17 (Temurin, Ubuntu Jammy) 기반 이미지 사용**
		- Spark는 자바 기반, 안정적이고 범용적인 Temurin OpenJDK 17을 Ubuntu Jammy(22.04) 리눅스 환경 위에 올림
	- **Spark uid를 185로 선언**
		- 컨테이너 보안 및 권한 관리 차원에서, spark라는 전용 유저·그룹의 UID/GID를 185로 고정 선언
	- **gid가 185인 system group 및 uid, gid가 185인 spark라는 user 생성**
		- 시스템 그룹과 사용자를 직접 생성해, 추후 파일 소유권, 프로세스 권한, 보안 격리에 사용
	- **Spark 환경에 필요한 필수 패키지 설치**
		- Spark, Hadoop 연동, 컨테이너 실행, 인증, 네트워킹 등에 필요한 패키지들(gnupg2, wget, bash, tini, libc6, libpam-modules, krb5-user, libnss3, procps, net-tools, gosu, libnss-wrapper 등)을 apt로 설치
	- **/opt/spark/python, /opt/spark/examples, /opt/spark/work-dir 등 생성 및 적절한 권한 부여**
		- Spark 실행·예제·파이썬 연동 등 필요한 경로를 미리 만들고, spark 유저에게 소유권을 부여해 실행 중 권한 문제 방지
	- **캐시 삭제해서 이미지 최적화**
		- 패키지 인덱스 등 임시 파일/캐시(`/var/lib/apt/lists/*`)를 삭제해 Docker 이미지 용량을 최소화. 컨테이너 배포/전송 효율 개선
- Apache Spark 설치
    - **spark binary 및 서명 파일 URL, GPG 공개 키 ID 환경변수로 지정**
		- 빌드 시점에 사용할 Spark 바이너리(.tgz)와 GPG 서명(.asc) 파일, 검증에 사용할 공식 GPG 공개 키를 환경변수로 선언
    - **임시 디렉토리 생성해서 그 안에서 위에서 언급한 파일들 다운로드 & 검증 & 권한 변경 & 주요 파일 /opt/spark로 이동**
        - 임시 작업 폴더를 만들고, wget으로 Spark 바이너리와 서명 파일을 다운로드
        - GPG 키를 keyserver에서 받아와 바이너리 무결성 검증 수행(공식 릴리즈인지 확인)
        - 바이너리 압축 해제 후 /opt/spark로 각종 디렉토리(jars, bin, examples 등) 이동
        - 소유자(chown)를 spark 유저로 변경해 보안성 확보
        - 불필요해진 임시 폴더, 검증 파일, 캐시 삭제로 최적화
    - **로컬의 entrypoint.sh 복사**
        - Dockerfile이 있는 위치의 entrypoint.sh(컨테이너 부팅 시 실행 스크립트)를 /opt/entrypoint.sh로 복사
        - 이 파일은 driver, executor, bash 등 실행 분기를 담당하며, 컨테이너 표준 진입점 역할
    - **home 경로 설정**
        - 환경변수 SPARK_HOME을 /opt/spark로 세팅해, 내부적으로 Spark 관련 실행 경로가 일관되게 동작하도록 함
    - **작업경로로 이동해서 entrypoint.sh 실행**
        - 작업 디렉토리를 /opt/spark/work-dir로 설정(WORKDIR), 이후 모든 컨테이너 커맨드는 이 폴더에서 실행됨.
        - 최종적으로 entrypoint.sh가 엔트리포인트로 동작해 컨테이너 시작과 동시에 원하는 작업(드라이버, 익스큐터, bash 등)을 수행할 수 있게 함

##### entrypoint.sh
위 Dockerfile 마지막에 들어가는 entrypoint의 내용은 다음과 같다 
```bash
#!/bin/bash

set -eo pipefail

attempt_setup_fake_passwd_entry() {
  # Check whether there is a passwd entry for the container UID
  local myuid; myuid="$(id -u)"
  # If there is no passwd entry for the container UID, attempt to fake one
  # You can also refer to the https://github.com/docker-library/official-images/pull/13089#issuecomment-1534706523
  # It's to resolve OpenShift random UID case.
  # See also: https://github.com/docker-library/postgres/pull/448
  if ! getent passwd "$myuid" &> /dev/null; then
      local wrapper
      for wrapper in {/usr,}/lib{/*,}/libnss_wrapper.so; do
        if [ -s "$wrapper" ]; then
          NSS_WRAPPER_PASSWD="$(mktemp)"
          NSS_WRAPPER_GROUP="$(mktemp)"
          export LD_PRELOAD="$wrapper" NSS_WRAPPER_PASSWD NSS_WRAPPER_GROUP
          local mygid; mygid="$(id -g)"
          printf 'spark:x:%s:%s:${SPARK_USER_NAME:-anonymous uid}:%s:/bin/false\n' "$myuid" "$mygid" "$SPARK_HOME" > "$NSS_WRAPPER_PASSWD"
          printf 'spark:x:%s:\n' "$mygid" > "$NSS_WRAPPER_GROUP"
          break
        fi
      done
  fi
}

if [ -z "$JAVA_HOME" ]; then
  JAVA_HOME=$(java -XshowSettings:properties -version 2>&1 > /dev/null | grep 'java.home' | awk '{print $3}')
fi

SPARK_CLASSPATH="$SPARK_CLASSPATH:${SPARK_HOME}/jars/*"
for v in "${!SPARK_JAVA_OPT_@}"; do
    SPARK_EXECUTOR_JAVA_OPTS+=( "${!v}" )
done

if [ -n "$SPARK_EXTRA_CLASSPATH" ]; then
  SPARK_CLASSPATH="$SPARK_CLASSPATH:$SPARK_EXTRA_CLASSPATH"
fi

if ! [ -z "${PYSPARK_PYTHON+x}" ]; then
    export PYSPARK_PYTHON
fi
if ! [ -z "${PYSPARK_DRIVER_PYTHON+x}" ]; then
    export PYSPARK_DRIVER_PYTHON
fi

# If HADOOP_HOME is set and SPARK_DIST_CLASSPATH is not set, set it here so Hadoop jars are available to the executor.
# It does not set SPARK_DIST_CLASSPATH if already set, to avoid overriding customizations of this value from elsewhere e.g. Docker/K8s.
if [ -n "${HADOOP_HOME}"  ] && [ -z "${SPARK_DIST_CLASSPATH}"  ]; then
  export SPARK_DIST_CLASSPATH="$($HADOOP_HOME/bin/hadoop classpath)"
fi

if ! [ -z "${HADOOP_CONF_DIR+x}" ]; then
  SPARK_CLASSPATH="$HADOOP_CONF_DIR:$SPARK_CLASSPATH";
fi

if ! [ -z "${SPARK_CONF_DIR+x}" ]; then
  SPARK_CLASSPATH="$SPARK_CONF_DIR:$SPARK_CLASSPATH";
elif ! [ -z "${SPARK_HOME+x}" ]; then
  SPARK_CLASSPATH="$SPARK_HOME/conf:$SPARK_CLASSPATH";
fi

# SPARK-43540: add current working directory into executor classpath
SPARK_CLASSPATH="$SPARK_CLASSPATH:$PWD"

# Switch to spark if no USER specified (root by default) otherwise use USER directly
switch_spark_if_root() {
  if [ $(id -u) -eq 0 ]; then
    echo gosu spark
  fi
}

case "$1" in
  driver)
    shift 1
    CMD=(
      "$SPARK_HOME/bin/spark-submit"
      --conf "spark.driver.bindAddress=$SPARK_DRIVER_BIND_ADDRESS"
      --conf "spark.executorEnv.SPARK_DRIVER_POD_IP=$SPARK_DRIVER_BIND_ADDRESS"
      --deploy-mode client
      "$@"
    )
    attempt_setup_fake_passwd_entry
    # Execute the container CMD under tini for better hygiene
    exec $(switch_spark_if_root) /usr/bin/tini -s -- "${CMD[@]}"
    ;;
  executor)
    shift 1
    CMD=(
      ${JAVA_HOME}/bin/java
      "${SPARK_EXECUTOR_JAVA_OPTS[@]}"
      -Xms"$SPARK_EXECUTOR_MEMORY"
      -Xmx"$SPARK_EXECUTOR_MEMORY"
      -cp "$SPARK_CLASSPATH:$SPARK_DIST_CLASSPATH"
      org.apache.spark.scheduler.cluster.k8s.KubernetesExecutorBackend
      --driver-url "$SPARK_DRIVER_URL"
      --executor-id "$SPARK_EXECUTOR_ID"
      --cores "$SPARK_EXECUTOR_CORES"
      --app-id "$SPARK_APPLICATION_ID"
      --hostname "$SPARK_EXECUTOR_POD_IP"
      --resourceProfileId "$SPARK_RESOURCE_PROFILE_ID"
      --podName "$SPARK_EXECUTOR_POD_NAME"
    )
    attempt_setup_fake_passwd_entry
    # Execute the container CMD under tini for better hygiene
    exec $(switch_spark_if_root) /usr/bin/tini -s -- "${CMD[@]}"
    ;;

  *)
    # Non-spark-on-k8s command provided, proceeding in pass-through mode...
    exec "$@"
    ;;
esac
```

여기서 하는 작업은 다음과 같다  
- set -eo pipefail 옵션으로 스크립트 실행 중 에러 발생 시 즉시 종료
- attempt_setup_fake_passwd_entry 함수로 OpenShift 등에서 발생할 수 있는 랜덤 UID 환경 문제(패스워드 엔트리 없음)를 NSS Wrapper로 해결
	- [[bitnami Spark Docker Compose 환경에서 ivy2 관련 경로 오류|이 문제]]와 관련?
- JAVA_HOME이 없으면 java 명령어로 동적으로 JAVA_HOME 경로를 추출해 세팅
- SPARK_CLASSPATH, SPARK_EXECUTOR_JAVA_OPTS 등 주요 Spark 실행 환경변수를 동적으로 조합해 세팅
- 추가적인 PySpark, Hadoop 관련 환경변수를 자동으로 export하거나 클래스패스에 반영
- 현재 디렉토리를 클래스패스에 추가해 실행 위치 기준의 리소스 접근을 가능하게 함
- switch_spark_if_root 함수로 컨테이너가 root로 실행될 경우 gosu로 spark 사용자로 권한 전환을 지원
- 첫 인자가 driver면 spark-submit 명령어로 드라이버 프로세스를 실행하고, executor면 KubernetesExecutorBackend를 기동,  그 외에는 전달받은 임의의 명령을 그대로 실행(pass-through)하는 방식을 사용
	- 예시 1 (driver): `docker run -it spark:python3-java17 driver --class org.apache.spark.examples.SparkPi local:///opt/spark/examples/jars/spark-examples.jar 10`
	- 예시 2 (executor): `docker run -it spark:python3-java17 executor`
	- 예시 3 (pass-through): `docker run -it spark:python3-java17 /bin/bash`


