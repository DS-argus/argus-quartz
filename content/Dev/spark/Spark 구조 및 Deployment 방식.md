---
tags:
  - spark
created: 2025-06-15T09:26:27
updated: 2025-06-17T17:14:45
permalink: /Dev/spark/spark-architecture-and-deployment-models
---

> [!note]+ 정리한 이유
> 다양한 환경에서 spark를 실행하고 spark-submit을 해봤는데 각각 구체적으로 어떤 식으로 동작하는지 이해가 안가서 정리

> [!abstract]+ TL;DR
> 1. **spark를 docker에서 단일 컨테이너로 실행하고 추가 옵션 X**  -> _local 모드_
> 2. **docker compose로 master, worker 실행하고 `--master spark://spark-master:7077`** -> _standalone + client 모드_
> 	- spark-master 컨테이너에는 master daemon JVM이 위치해있고 여기서 submit하면 Driver JVM이 하나 더 생성
> 	- 동일한 네트워크에 속해서 spark-master라는 서비스 이름으로 연결
> 3. **docker compose로 airflow와 함께 실행해서 SparkSubmitOperator 사용하고 추가 옵션 X** -> _standalone + client 모드_
> 	- airflow 컨테이너에서 submit이 실행되기 때문에 Java,  Spark 관련 패키지 설치 필요
> 	- cluster 모드로 실행하면 Driver JVM은 안 생기지만 그래도 submit은 해야해서 관련 패키지가 필요
> 	- airflow 컨테이너 그 자체로 실행하려면, REST/K8s Operator 등 다른 제출 메커니즘 필요

---
### Spark 구조
보통 분산 환경 (Cluster 모드)에서의 Spark 구조는 다음과 같이 표현한다   

![[Spark 동작 원리 뿌시기 - 2025-06-15 - 17-29-20.png|695x420]]

##### Spark Application : Spark API를 사용해 만든 User Program
- 우리가 Spark를 통해 실행하고 싶은 스크립트
- Spark Driver와 Spark Executor로 구성 
##### Spark Driver : Spark application을 구성하며 SparkSession을 담당
- 역할 
	- Cluster Manager와 소통
	- executor들을 위한 resource를 manager에게 요청
	- spark operation을 DAG 계산으로 변경, 스케줄링, executor에게 분배
	- resource 할당되면 executor와 직접 소통
- Spark Driver는 Spark Session을 통해 Spark Executor와 ClusterMmanager와 같은 분산 component들에 access

##### Spark Session : Spark의 모든 기능에 접근할 수 있는 통합된 단일 Entrypoint
- 역할
	- JVM 런타임 파라미터 생성
	- DataFrame, dataset 정의
	- 데이터 소스에서 읽기
	- catalog metadata 접근
	- Spark SQL쿼리 issue 등...
- Spark-shell에서는 SparkSession이 생성되어 있고 spark 혹은 sc로 접근 가능
	- 1.x에서는 직접 각 context를 만들어야했음
	- 2.x에서는 JVM 당 SparkSession 만들어서 여러 spark operation 실행 가능
	- 2.0 버전에서부터 SparkContext, SQLContext, HiveContext, SparkConf, StreamingContext 역할 모두 흡수

> [!note]+ Spark Context?
> - Spark Session과 마찬가지로 entrypoint 역할을 수행  
> - 하지만 주로 RDD와 상호작용할 때 사용하는 older, low-level entrypoint
> - Spark Session은 2.0 버전부터 도입되어 DataFrames, Datasets, SQL, 다양한 라이브러리 등을 다룰 수 있는 unified interface
> 	- 내부적으로 Spark Context를 생성하기 때문에 Spark Context의 모든 함수나 특징 사용 가능
> 	- [참고](https://sunrise-min.tistory.com/entry/Apache-Spark-SparkContext-vs-SparkSession)

##### Spark Executor : Worker 노드에서 태스크 실행과 데이터 캐시를 담당하는 독립 JVM 프로세스
- 클러스터 내의 각 worker node에서 실행됨
- 역할
	- driver와 소통
	- task 실행 담당
- 대부분의 deployment modes에서 노드 당 하나의 executor 실행

##### Cluster Manager:  Nodes 관리 및 자원 할당 담당
- 데이터를 분산 처리하기 위해서 하나의 클러스터 내에 여러 대의 머신, 즉 Worker node를 구성하는데 이때 이 node들의 리소스를 관리하고 task를 배치하는 역할
- Spark에서는 다양한 cluster manager 지원
	- standalone : Spark에 포함된 간단한 클러스터 관리자로, 클러스터를 쉽게 설정할 수 있음
	- Apache Hadoop YARN : Hadoop 3의 리소스 관리자
	- Kubernetes : 컨테이너화된 애플리케이션의 배포, 확장 및 관리를 자동화하는 오픈 소스 시스템
	- ~~Apache Mesos : 4.0에서부터 지원하지 않음~~

---
### Local 모드 및 Cluster Manager를 이용한 다양한 Deployment Modes
Spark는 간단한 local 모드는 물론 다양한 Cluster manager와 함께 다양한 배포 방식을 지원하는데 먼저 요약하면 다음과 같다  
(PySpark는 standalone-cluster 모드 미지원)

| **Mode**                | **Spark driver**                      | **Spark executor**                  | **Cluster manager**                                                    |
| ----------------------- | ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Local                   | 단일 JVM에서 실행                           | driver와 동일한 JVM에서 실행                | 동일한 JVM 내 로컬 스케줄러가 대신 수행                                               |
| Standalone(client)      | `spark-submit` 프로세스 JVM(제출 노드)에서 실행   | cluster 내 각 Worker가 띄운 executor JVM | Spark Master daemon                                                    |
| Standalone(cluster)<br> | Worker node 중 하나에서 별도 Driver JVM 기동   | 위와 동일                               | 위와 동일                                                                 |
| YARN(client)            | cluster 외부 client JVM에서 실행            | YARN NodeManager의 container에서 실행    | ResourceManager가 ApplicationMaster 컨테이너 포함해 container를 NodeManager에 할당 |
| YARN(cluster)           | ApplicationMaster 컨테이너(클러스터 내) 내부 JVM | 위와 동일                               | 위와 동일                                                                  |
| k8s(client)             | cluster 외부 client JVM                 | 각 executor Pod에서 실행                 | Kubernetes API 서버/스케줄러                                                 |
| k8s(cluster)            | Driver Pod(클러스터 내) 내부 JVM             | 위와 동일                               | 위와 동일                                                                  |


우선 Spark 사용시 Cluster를 사용하지 않는다면 local 모드가 되고,  
Cluster를 사용한다면 Cluster Manager가 무엇인지에 따라, 또한 Driver의 배포 방식에 따라 client, cluster로 또 나뉘게 된다

![[Spark 동작 원리 뿌시기 - 2025-06-15 - 20-36-43.png|847x485]]

여기서 Driver 배포 방식인 client, cluster은 `spark-submit` 실행 시 옵션으로 넣어줘야하는 값으로 의미는 다음과 같다
1. **Client 모드** : Driver가 클러스터 외부(제출 Client)에서 실행되는 방식
	- 특징
		- Driver·Application 프로세스 모두 Client 측에 상주
		- 콘솔 세션 종료 시 Driver 종료 → Spark Context·Job 모두 중단
		- 터미널에서 실시간 로그·REPL 확인 가능 → 개발·디버깅 유리
	- 동작 순서
		1. Client가 `spark-submit --deploy-mode client …` 실행
		2. `spark-submit` **프로세스 내부에서 Spark Driver 즉시 기동**
		3. Driver가 Cluster Manager에게 Executor 자원 요청
		4. Cluster Manager가 각 노드에 Executor 프로세스 생성
		5. Driver ↔ Executor 간 RPC로 태스크 분배·결과 수집
	- 주요 용도: 로컬 테스트·단기 잡·상호작용형 분석
	- 장점 : 실행 즉시 로그 확인, REPL 가능, 셸 종료 = 잡 강제종료 용이
	- 단점 : 셸 터미널/SSH 세션 끊기면 Driver도 죽음 → 장기 배치에는 부적합

2. **Cluster 모드** : Driver JVM이 클러스터 내부 (Worker 노드·컨테이너·Pod)에서 실행되는 방식
	- 특징
		- Application은 클러스터 자원만 사용하며 제출 Client와 독립 실행
		- `spark-submit` 종료 후에도 Job 지속 → 장기 배치·스트리밍 적합
		- 로그·UI는 클러스터 모니터링 툴로 확인
	- 동작 순서
		1. Client가 `spark-submit --deploy-mode cluster …` 제출
		2. `spark-submit`은 Jar·파라미터 전송 후 즉시 종료
		3. Cluster Manager가 **Worker 중 하나에 Spark Driver JVM 기동**
		4. Driver가 Cluster Manager에게 Executor 리소스 요청
		5. Cluster Manager가 Executor 프로세스 생성
		6. Driver ↔ Executor 간 RPC로 태스크 분배·결과 수집
	- 주요 용도: 프로덕션 배치·대규모 스트리밍·장기 워크로드
	- 장점 : SSH 세션 끊겨도 작업 지속, Driver 실패 시 클러스터 매니저 재시작 지원
	- 단점 : 실시간 REPL 곤란, 로그 확인 위해 웹UI/로그 어그리게이터 접속 필요
	- 제한 : Stand-alone 매니저는 Python 앱의 cluster 모드 아직 미지원 (PySpark 실행 시 client만 가능)

##### Local 
- 하나의 JVM을 띄우고 그 안에서 Spark Driver, Spark Executor를 실행하는 방법
	- 'LocalSchedulerBackend'가 SparkContext 안에서 Executor 스레드 풀 생성
- Local 모드에서는 cluster가 없고 단일 노드이기 때문에 cluster 리소스 조정, 할당, 모니터링 같은 역할을 할 외부 cluster manager가 필요하지 않음
	- 단일 JVM 자체가 Scheduler 및 Resource manager 역할을 동시에 수행
	- 당연히 client/cluster 구분도 없음
- 병렬화는 스레드 레벨에서 이루어지기 때문에 **네트워크 셔플 및 네트워크 I/O 오버헤드가 거의 없음**
	- CPU 코어 수만큼 스레드로 병렬처리 가능
- Executor가 1개뿐이라 다중 Executor 상황, 애플리케이션 간 자원 경쟁, 네트워크 셔플 경험 못함
- 테스트, 디버깅, 소규모 작업용으로 적합
- 단순히 docker를 활용해 spark를 실행해서 spark-submit을 하면 local로 실행하는 것 : [[docker를 이용해 Apache Spark 시작하기|참고]]

##### Standalone
- 구조: Master·Worker daemon으로 구성된 Spark 자체 클러스터 매니저
- 실행 위치
	- Driver: cluster 내 임의 노드 JVM
	- Executor: 각 Worker 가 띄운 child JVM
	- Manager: Master 데몬이 cluster 임의 호스트에서 실행
- **만약 싱글 노드에서 Standalone 사용하면 local하고 같은 것 아닌가?**
	- local → Driver·Executor 같은 JVM
	- standalone → Driver 별도 JVM, Executor 각각 독립 + Netty RPC·loopback 셔플 발생
	- 따라서 standalone의 경우는 프로세스 격리 덕분에 다중 노드용 튜닝·장애 실험 가능
- docs: <https://spark.apache.org/docs/4.0.0/spark-standalone.html>

##### YARN
- client 모드
	- Driver: 클러스터 외부 Client JVM
	- Executor: NodeManager 컨테이너
	- Manager: ResourceManager + ApplicationMaster 컨테이너
- cluster 모드
	- Driver: ApplicationMaster 컨테이너 내부 JVM
	- Executor: NodeManager 컨테이너 동일
	- Manager: ResourceManager 가 컨테이너 할당
- docs: <https://spark.apache.org/docs/4.0.0/running-on-yarn.html>

##### Kubernetes
- client 모드(2.4+부터 지원)
	- Driver: Client JVM (물리 호스트) 또는 Driver Pod 안 JVM
	- Executor: 개별 Executor Pod
	- Manager: k8s API 서버·스케줄러(control plane)
- cluster 모드
	- Driver: 클러스터 내부 Driver Pod JVM
	- Executor: 개별 Executor Pod
	- Manager: k8s control‑plane 가 Pod 스케줄
- docs: <https://spark.apache.org/docs/4.0.0/running-on-kubernetes.html>
