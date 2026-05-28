---
tags:
  - spark
created: 2025-06-14T23:42:21
updated: 2025-06-15T22:40:50
permalink: /Dev/spark/spark-submit
---
### Spark-Submit이란?
Spark job을 배치 혹은 스트리밍 형태로 실행하기 위한 공식 CLI 런처로 notebook이나 spark-shell과 함께 Spark job을 실행할 수 있는 방법 중 하나  
Spark에서 지원하는 모든 cluster manager를 동일한 인터페이스를 통해 사용할 수 있어서 유용

##### 동작원리
- 사용자가 명령어 입력 → `spark-submit` 스크립트가 환경 변수·클래스패스 세팅 후 JVM 부트스트랩
- `SparkSubmit` 클래스가 전달 파라미터 파싱 → 배포 모드(client/cluster)·클러스터 매니저에 맞는 LauncherBackend 선택
- Driver JVM 기동 → Cluster Manager 와 통신해 Executor 띄우고 태스크 스케줄
- Job 종료 시 ExitCode 반환 → 셸 스크립트가 그대로 전달해 파이프라인 실패 감지 가능
##### notebook · shell 대비 특징
- notebook / shell → REPL 인터랙티브 세션, 사용자 입력이 끊기면 종료
- spark-submit → 스크립트·워크플로 엔진(airflow, azkaban 등)에서 호출해 비대화식 실행
- 리소스·옵션 일관성 확보, CI/CD 포함 자동화에 유리

---
### [기본 구조](https://spark.apache.org/docs/4.0.0/submitting-applications.html#launching-applications-with-spark-submit)
##### spark-submit 명령어
```bash
spark-submit \
  --master <url|mode> \
  --deploy-mode <client|cluster> \
  --name <app‑name> \
  --class <main-class> \
  --conf k=v            (여러 번 사용 가능) \
  --packages g:a:v      (여러 번 사용 가능) \
  --jars a.jar,b.jar    (콤마 구분) \
  --py-files deps.zip   (PySpark) \
  --files config.json   (모든 노드로 배포) \
  --executor-memory 4g \
  --executor-cores 2 \
  --num-executors 5 \
  --driver-cores 4 \
  --driver-memory 2g \
  <application file>    (py 파일·JAR·R file) \
  [application args]
```
##### 대표적인 옵션
- `--class` : JAR 파일 안에서 어떤 Main 클래스 (main 메서드 가진 엔트리포인트)를 실행할지 spark-submit 에게 알려주는 스위치
	- 하나의 JAR 안에 여러 main 클래스 포함되어 있는 등 어느 것 실행해야할지 애매한 경우 필요
	- Java, Scala 기반 Spark 애플리케이션에만 의미있음
- `--master` : cluster의 master URL
	- local : 단일 worker thread 사용 (no parallelism)
	- local[K] : K worker threads
	- local[K, F]: K worker threads와 F번의 maxFailure[^1]
	- local[\*] : 최대한 많은 worker threads
	- local[*, F] : 최대한 많은 worker threads와 F번의 maxFailure
	- local-cluster[N, C, M] : 단일 JVM에서 N개의 worker, C cores per worker, M MiB 메모리 per worker. unit test용 local cluster mode
	- spark://HOST:PORT : Standalone cluster master에 연결. 7077이 default
	- spark://HOST1:PORT1,HOST2:PORT2 : Zookeeper 사용해서 대기 master가 있는 standalone cluster에 연결
	- yarn : client 혹은 cluster 모드로 YARN 클러스터에 연결. cluster location 환경변수로 주입필요
	- k8s://HOST:PORT : client 혹은 cluster 모드로 k8s cluster에 연결
- `--deploy-mode` : Spark Driver를 worker node에 배포할지 (cluster) 아님 외부 client에 배포할지 (client, 기본값) 
	- [[Spark 구조 및 Deployment 방식#Local 모드 및 Cluster Manager를 이용한 다양한 Deployment Modes|자세한 내용]]
- `--conf` : key=value 형태의 spark configuration. 여러개를 반복해서 입력 가능
	- spark.app.name=name : 앱 이름 오버라이드
	- spark.sql.shuffle.partitions=200 : 셔플 파티션  
	- spark.hadoop.fs.s3a.access.key=… : S3 자격 주입  
	- spark.driver.extraJavaOptions=-Duser.name=airflow : 컨테이너 HOME 문제 해결  
	- spark.ui.port=4041 : UI 포트 충돌 시 변경
- application-jar : application과 모든 dependency를 포함한 bundled jar의 path (예시 : `hdfs://path` or `file:// path`)
- application-arguments : 실행 스크립트에 필요한 인자

##### 기타 옵션

- `--executor-memory` : Executor JVM Heap (예 `4g`, `512m`)
- `--executor-cores` : Executor 당 CPU 코어 수
- `--num-executors` : Executor 개수 (Stand‑alone·YARN)
- `--driver-memory` : Driver Heap
- `--total-executor-cores` : Mesos 전용 총 코어 수
- `--jars`  : 추가 JAR classpath
- `--packages` : Maven Central Ivy 다운로드
- `--repositories` : 사설 Maven 저장소 URL
- `--py-files` : PySpark 의존 zip/egg
- `--files` : 모든 노드에 파일 배포 후 `SparkFiles.get()` 로 접근


##### 예시 스크립트
```bash
# Run application locally on 8 cores
./bin/spark-submit \
  --class org.apache.spark.examples.SparkPi \
  --master "local[8]" \
  /path/to/examples.jar \
  100

# Run on a Spark standalone cluster in client deploy mode
./bin/spark-submit \
  --class org.apache.spark.examples.SparkPi \
  --master spark://207.184.161.138:7077 \
  --executor-memory 20G \
  --total-executor-cores 100 \
  /path/to/examples.jar \
  1000

# Run on a Spark standalone cluster in cluster deploy mode with supervise
./bin/spark-submit \
  --class org.apache.spark.examples.SparkPi \
  --master spark://207.184.161.138:7077 \
  --deploy-mode cluster \
  --supervise \
  --executor-memory 20G \
  --total-executor-cores 100 \
  /path/to/examples.jar \
  1000

# Run on a YARN cluster in cluster deploy mode
export HADOOP_CONF_DIR=XXX
./bin/spark-submit \
  --class org.apache.spark.examples.SparkPi \
  --master yarn \
  --deploy-mode cluster \
  --executor-memory 20G \
  --num-executors 50 \
  /path/to/examples.jar \
  1000

# Run a Python application on a Spark standalone cluster
./bin/spark-submit \
  --master spark://207.184.161.138:7077 \
  examples/src/main/python/pi.py \
  1000

# Run on a Kubernetes cluster in cluster deploy mode
./bin/spark-submit \
  --class org.apache.spark.examples.SparkPi \
  --master k8s://xx.yy.zz.ww:443 \
  --deploy-mode cluster \
  --executor-memory 20G \
  --num-executors 50 \
  http://path/to/examples.jar \
  1000
```



[^1]: Number of continuous failures of any particular task before giving up on the job
