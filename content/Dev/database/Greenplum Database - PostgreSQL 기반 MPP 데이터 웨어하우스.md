---
tags:
  - database
  - greenplum
  - postgresql
  - data_engineering
created: 2026-06-06T10:00:00
updated: 2026-06-06T17:30:12
permalink: /Dev/database/greenplum-database-mpp-data-warehouse
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Greenplum은 PostgreSQL을 기반으로 한 MPP(대규모 병렬 처리) 데이터 웨어하우스
> - Coordinator(마스터)가 쿼리를 받아 여러 Segment(워커)에 분산 처리
> - PostgreSQL과 SQL 호환성을 유지하면서 대규모 분석 워크로드에 특화
> - OLTP는 PostgreSQL, OLAP/대규모 분석은 Greenplum이 적합

> [!cite]+ Source
> - [About the Greenplum Architecture - Broadcom TechDocs](https://techdocs.broadcom.com/us/en/vmware-tanzu/data-solutions/tanzu-greenplum/7/greenplum-database/admin_guide-intro-arch_overview.html)
> - [Relationship and difference between Greenplum and PostgreSQL](https://greenplum.org/relationship-and-difference-between-greenplum-and-postgresql/)

---

### 1. MPP란

MPP(Massively Parallel Processing)는 **여러 대의 독립적인 노드가 각자의 CPU, 메모리, 디스크를 가지고 하나의 작업을 병렬로 처리하는 아키텍처**다. Shared Nothing 아키텍처라고도 한다.

일반 데이터베이스(PostgreSQL, MySQL 등)는 하나의 서버에서 모든 데이터를 처리한다. 데이터가 수십 TB 이상으로 커지면 단일 서버의 CPU, 메모리, 디스크 I/O가 병목이 된다. MPP는 데이터를 여러 노드에 쪼개서 저장하고, 쿼리도 각 노드에서 병렬로 실행한 뒤 결과를 합친다.

```
[일반 DB - 단일 서버]
클라이언트 → 서버(CPU + 메모리 + 디스크) → 전체 데이터 스캔

[MPP - 병렬 처리]
클라이언트 → Coordinator → Segment 1 (데이터 1/N 스캔)
                         → Segment 2 (데이터 1/N 스캔)
                         → Segment 3 (데이터 1/N 스캔)
                         → 결과 취합 후 반환
```

---

### 2. Greenplum 아키텍처

Greenplum은 내부적으로 **여러 개의 PostgreSQL 인스턴스가 하나의 DBMS처럼 동작하는 구조**다. PostgreSQL 12를 기반으로 구축되어 있다.

##### 핵심 구성 요소

| 구성 요소                    | 역할                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **Coordinator (Master)** | 클라이언트 연결을 받고 쿼리를 파싱/최적화하여 Segment에 분배. 글로벌 시스템 카탈로그(메타데이터)만 저장하고 사용자 데이터는 저장하지 않음  |
| **Segment**              | 실제 데이터를 저장하고 쿼리를 실행하는 워커. 각 Segment는 독립적인 PostgreSQL 인스턴스. 호스트당 CPU 코어에 따라 2~8개 배치 |
| **Interconnect**         | Segment 간 데이터 교환을 담당하는 네트워크 레이어. 기본적으로 UDPIFC(흐름 제어가 있는 UDP) 사용                    |

```
         ┌──────────────┐
         │  Coordinator │  ← 클라이언트 연결, 쿼리 계획
         │  (Master)    │
         └──────┬───────┘
                │ Interconnect (UDPIFC)
         ┌──────┼──────┐
         │      │      │
         ▼      ▼      ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Segment1 │ │Segment2 │ │Segment3 │ ← 각각 독립 PostgreSQL 인스턴스
│(Primary)│ │(Primary)│ │(Primary)│
│ Mirror ↔│ │ Mirror ↔│ │ Mirror ↔│ ← 다른 호스트에 미러 배치
└─────────┘ └─────────┘ └─────────┘
```

##### 데이터 분산 방식

테이블 생성 시 **분산 키(Distribution Key)**를 지정한다. 이 키의 해시 값에 따라 각 행이 어느 Segment에 저장될지 결정된다.

```sql
-- 분산 키 지정
CREATE TABLE orders (
    order_id    INT,
    customer_id INT,
    amount      DECIMAL(10,2)
) DISTRIBUTED BY (customer_id);

-- 랜덤 분산 (분산 키가 마땅치 않을 때)
CREATE TABLE logs (
    log_time TIMESTAMP,
    message  TEXT
) DISTRIBUTED RANDOMLY;
```

> [!tip]+ 분산 키 선택이 성능을 좌우한다
> - JOIN이 잦은 컬럼을 분산 키로 잡으면 Segment 간 데이터 이동(Motion)이 줄어든다
> - 카디널리티가 높은(값이 고르게 분포된) 컬럼이 좋다
> - 분산 키가 편향되면 특정 Segment에 데이터가 몰려 병렬 처리의 이점이 사라진다

---

### 3. PostgreSQL과의 관계

Greenplum은 PostgreSQL의 **포크(fork)**다. 독립적인 DB가 아니라 PostgreSQL 코드베이스를 기반으로 MPP 기능을 얹은 것이다.

##### 공유하는 것

- SQL 문법 대부분 호환 (DDL, DML, 함수, 데이터 타입)
- `psql` 클라이언트로 접속 가능
- PL/pgSQL, PL/Python 등 프로시저 언어
- MVCC 기반 트랜잭션 모델
- 드라이버 호환 (JDBC, ODBC, libpq)

##### 다른 것

| 항목 | PostgreSQL | Greenplum |
|------|------------|-----------|
| 아키텍처 | 단일 서버 (SMP) | 다중 서버 분산 (MPP) |
| 주요 용도 | OLTP (트랜잭션 처리) | OLAP (분석 쿼리) |
| 데이터 규모 | 수백 GB~수 TB | 수십 TB~PB |
| 스케일링 | 수직 확장 (Scale-up) | 수평 확장 (Scale-out, Segment 추가) |
| 쿼리 옵티마이저 | PostgreSQL 플래너 | GPORCA (비용 기반 병렬 옵티마이저) + PostgreSQL 플래너 |
| 스토리지 | Heap (행 지향) | Heap + Append-Optimized (행/열 선택 가능) |
| 인덱스 활용 | 적극적 (B-tree, GIN 등) | 제한적 (풀스캔이 더 빠른 경우가 많음) |
| 단건 INSERT/UPDATE | 빠름 | 느림 (분산 오버헤드) |
| 대규모 집계/조인 | 단일 서버 한계 | 병렬 처리로 빠름 |

---

### 4. Greenplum만의 기능

##### 열 지향 스토리지 (Column-Oriented Storage)

행 전체가 아니라 **컬럼 단위로 데이터를 저장**한다. 분석 쿼리에서 특정 컬럼만 읽으면 되므로 I/O가 크게 줄어든다.

```sql
CREATE TABLE sales (
    sale_date  DATE,
    product_id INT,
    quantity   INT,
    amount     DECIMAL(10,2)
)
WITH (appendoptimized=true, orientation=column, compresstype=zstd)
DISTRIBUTED BY (product_id);
```

- `orientation=column`: 열 지향 저장
- `compresstype=zstd`: 같은 타입의 데이터가 연속으로 저장되므로 압축률이 높음

##### Append-Optimized (AO) 스토리지

대량 INSERT에 최적화된 스토리지 포맷이다. PostgreSQL의 기본 Heap 스토리지는 행 단위 UPDATE/DELETE에 유리하지만, 분석 워크로드는 대부분 대량 적재 후 읽기 위주이므로 AO가 더 적합하다.

##### GPORCA 옵티마이저

Greenplum 전용 비용 기반 쿼리 옵티마이저다. 멀티테이블 조인, 파티션 테이블, 서브쿼리 등 복잡한 분석 쿼리의 실행 계획을 PostgreSQL 플래너보다 효율적으로 생성한다.

##### 외부 테이블과 gpfdist

외부 데이터를 SQL로 직접 조회하거나 병렬로 적재할 수 있다.

```sql
-- 외부 테이블 정의 (gpfdist 사용)
CREATE EXTERNAL TABLE ext_logs (
    log_time TIMESTAMP,
    message  TEXT
)
LOCATION ('gpfdist://etl-host:8080/logs/*.csv')
FORMAT 'CSV' (HEADER);

-- 외부 테이블에서 내부 테이블로 병렬 적재
INSERT INTO logs SELECT * FROM ext_logs;
```

`gpfdist`는 파일 서버 역할을 하며, 각 Segment가 병렬로 파일을 직접 읽어간다. 단일 `COPY` 명령보다 수배~수십 배 빠르다.

> [!note]+ gpload
> `gpload`는 `gpfdist` + `INSERT/UPDATE` + 에러 처리를 YAML 설정 파일로 감싼 래퍼 유틸리티다. ETL 파이프라인에서 반복적인 적재 작업에 많이 사용한다. 자세한 내용은 [[ETL 데이터 이동과 적재|ETL 적재 메커니즘]] 참고.

---

### 5. 언제 어떤 걸 쓸까

| 상황 | 추천 |
|------|------|
| 웹 앱 백엔드, CRUD | **PostgreSQL** |
| 수백 GB 이하 분석 | **PostgreSQL** (충분히 빠름) |
| 수 TB 이상 데이터 웨어하우스 | **Greenplum** |
| 실시간 단건 트랜잭션 | **PostgreSQL** |
| 대규모 배치 집계/리포팅 | **Greenplum** |
| ETL 파이프라인의 타겟 DB | **Greenplum** (gpfdist 병렬 적재) |

> [!tip]+ 실무에서 흔한 조합
> PostgreSQL을 OLTP용 운영 DB로, Greenplum을 OLAP용 분석 DB로 함께 사용하는 구성이 많다. 운영 DB에서 Greenplum으로 ETL 파이프라인을 구성해 데이터를 적재하고, 분석/리포팅 쿼리는 Greenplum에서 실행한다.

---

### 6. 현재 상태와 대안

Greenplum은 원래 Pivotal이 개발했고, VMware를 거쳐 현재 Broadcom 산하에 있다. 오픈소스 버전도 존재하지만, Broadcom 인수 이후 커뮤니티 활동이 위축되고 있다.

대안으로 떠오르는 도구들:

| 도구 | 특징 |
|------|------|
| **Apache Spark** | 대규모 분산 처리. SQL 인터페이스(Spark SQL) 지원 |
| **ClickHouse** | 열 지향 OLAP DB. 단일 서버에서도 빠른 집계 |
| **DuckDB** | 임베디드 OLAP DB. 로컬 분석에 강점 |
| **Cloudberry DB** | Greenplum의 오픈소스 포크. 커뮤니티 주도 |

---

### 관련 노트

- [[PostgreSQL 설치 및 세팅]] — PostgreSQL 기본 설치 및 초기 설정
- [[ETL 데이터 이동과 적재]] — gpload/gpfdist 적재 방식 상세
