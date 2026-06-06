---
tags:
  - etl
  - data_integration
  - data_engineering
  - bulk_load
  - greenplum
created: 2026-06-06T10:00:00
updated: 2026-06-06T23:03:01
permalink: /Dev/database/etl-data-movement-and-loading
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - File to DB는 파싱과 입력 품질이 핵심 난이도, DB to DB는 소스 부하와 증분 추출이 핵심 난이도
> - 적재 성능은 row-by-row INSERT → batch INSERT → bulk load → 병렬 외부 테이블 순으로 차이가 큼
> - ORACLE_LOADER는 Oracle 외부 테이블 access driver, gpload/gpfdist는 Greenplum 병렬 적재 유틸리티
> - 같은 source-target 매핑이라도 적재 경로에 따라 성능이 수십~수백 배 다를 수 있음

---

### 1. File to DB

파일(CSV, 고정폭, 로그 등)을 DB에 적재하는 패턴이다.

##### 흐름

```
파일 수신 → 포맷 해석 → 레코드 분리 → 컬럼 파싱
→ 타입 변환 → 정제/검증 → 에러 레코드 분리 → 타깃 DB 적재
```

##### 파일은 "신뢰할 수 없는 입력"이다

DB 테이블은 컬럼, 타입, 제약 조건이라는 형식이 있다. 반면 파일은 구조를 정해 놓았더라도 항상 품질 문제가 생긴다.

- delimiter가 깨지거나 escape 규칙이 엇갈림
- fixed-width offset이 밀림
- 문자셋 불일치 (UTF-8 vs EUC-KR 등)
- 빈 값과 null 표현 방식이 불일정

file to db의 첫 번째 문제는 적재가 아니라 **파싱**이다.

##### 설계 시 결정해야 하는 것

- bad record가 있으면 전체를 실패시킬 것인가, reject file로 분리할 것인가
- header/trailer 검증 여부
- 중복 레코드 처리 전략
- staging table을 거칠 것인가, 바로 적재할 것인가
- commit 단위 (건수 / 파일 단위)

##### 병목 지점

- 파일 읽기 (대용량 I/O)
- 파싱과 타입 변환 (CPU)
- 정렬, join, deduplication (메모리/디스크)
- row-by-row INSERT (DB 쪽 병목)
- commit 단위가 작으면 로그 부하 증가

---

### 2. DB to DB

소스 DB에서 데이터를 추출해 타깃 DB에 적재하는 패턴이다. 양쪽 다 구조화된 시스템이라 단순해 보이지만, 소스가 **살아 있는 운영 시스템**인 경우가 많아 오히려 설계 난이도가 높다.

##### 흐름

```
소스 DB 연결 → 추출 범위 결정 → 조회 실행
→ 네트워크 전송 → 타입/스키마 매핑 → 타깃 적재 → 정합성 검증
```

##### 핵심 문제: 소스 시스템 부하

파일은 받은 뒤 마음대로 처리하면 되지만, DB는 조회 한 번이 source 시스템의 CPU, I/O, lock, 네트워크에 영향을 준다.

- source 쿼리를 **언제** 돌릴 것인가 (배치 창)
- **full load**인가 **incremental load**인가
- watermark를 무엇으로 잡을 것인가 (timestamp, sequence, key)
- source consistency를 어떤 수준까지 보장할 것인가

##### 타입 체계의 차이

서로 다른 DBMS 간 이관에서는 타입 번역 문제가 생긴다.

- 날짜/타임존 표현 차이
- 숫자 정밀도와 scale 차이
- char/varchar padding 규칙 차이
- empty string과 null 의미 차이

##### 증분 처리

full load는 느려도 단순하다. 실무에서 어려운 것은 incremental load다.

- 마지막 추출 시점 이후 데이터만 가져와야 함
- UPDATE와 INSERT 구분
- DELETE 반영 전략
- source timestamp의 신뢰성
- 재실행 시 duplicate/missing 방지

---

### 3. File to DB vs DB to DB

| 항목 | File to DB | DB to DB |
|------|------------|----------|
| 입력의 신뢰도 | 낮음 (포맷 오류 가능) | 상대적으로 높음 |
| 주요 리스크 | 파싱 실패, bad record | 소스 부하, 증분 기준 오류 |
| 핵심 설계 포인트 | 포맷 해석, reject 처리 | 추출 범위, incremental 기준 |
| 성능 병목 | 파싱 + 적재 | 조회 + 네트워크 + 적재 |
| 재실행 기준 | 파일 / 배치 단위 | watermark / commit 단위 |
| 운영 핵심 질문 | 파일이 정상 도착했는가 | 소스를 안전하게 읽었는가 |

같은 target DB 적재라도 **source가 바뀌면 완전히 다른 운영 문제**를 갖게 된다.

---

### 4. 실행 구조: 2-Tier vs 3-Tier

##### 범용 아키텍처 패턴

2-Tier/3-Tier는 소프트웨어 아키텍처에서 널리 쓰이는 계층 분리 패턴이다. 핵심은 **클라이언트와 서버 사이에 중간 계층을 두느냐**의 차이다.

| 계층 | 2-Tier | 3-Tier |
|------|--------|--------|
| Tier 1 | 클라이언트 (UI + 로직) | 클라이언트 (UI) |
| Tier 2 | 서버 (DB) | 애플리케이션 서버 (비즈니스 로직) |
| Tier 3 | — | 서버 (DB) |

웹에서는 Web Server / WAS / DB Server 분리가 대표적이다. ETL에서도 같은 원리가 적용되는데, 중간 계층의 역할이 WAS 대신 **메타데이터 저장소(Repository)** 가 된다.

##### ETL에서의 2-Tier

```
개발 클라이언트 ↔ 실행 환경 (밀접하게 연결)
```

개발자가 작업을 만들고 바로 실행하는 구조다. Python 스크립트로 CSV를 읽어 DB에 INSERT하거나, Airflow DAG이 단일 서버에서 ETL을 직접 실행하는 경우가 여기에 해당한다. 설치와 운영이 단순하고 소규모 팀에서 빠르게 시작하기 좋지만, 팀 단위 협업, 권한 분리, 중앙 통제가 어려워 규모가 커지면 한계가 온다.

##### ETL에서의 3-Tier

```
Designer Client → Repository (메타데이터/버전 관리) → Runtime Server (실행)
```

설계하는 곳, 작업 정의를 저장하는 곳, 실제 배치가 도는 곳이 분리된다. Informatica PowerCenter(Designer / Repository / Integration Service), AWS Glue(Glue Studio / Data Catalog / Job Runner) 등이 대표적이다.

3-Tier의 핵심은 **역할 분리**다.

| 역할 | 하는 일 |
|------|---------|
| **ETL 개발자** | Designer에서 매핑/변환/SQL 로직 작성 → Repository에 체크인 |
| **ETL 운영자** | Repository에서 검토 → Runtime Server에 배포, 스케줄 설정, 모니터링, 장애 대응 |
| **DBA** | Repository DB와 Runtime Server 인프라 관리. ETL 로직 작성은 하지 않음 |

2-Tier에서는 이 역할을 한 사람이 다 하는 경우가 많다. 3-Tier는 개발자를 **"만드는 사람"**에 집중시키고 **"돌리는 사람"**과 분리할 수 있는 구조를 제공한다.

**Repository**는 ETL 작업의 정의 자체를 저장하고 관리하는 중앙 저장소다. 코드 프로젝트에서 Git이 하는 역할과 비슷하다.

Repository가 관리하는 것:
- 매핑 정의 (source 컬럼 A → target 컬럼 B)
- 변환 규칙 (타입 변환, 필터, 집계 로직)
- 연결 정보 (어떤 DB에 어떤 인터페이스로 붙는지)
- 작업 의존성 (A 작업 끝나면 B 실행)
- 변경 이력 (누가 언제 뭘 바꿨는지)

Repository가 없으면(2-Tier) 작업 정의가 개발자 로컬이나 서버 파일 시스템에 흩어져서 "누가 뭘 바꿨는지", "운영에 어떤 버전이 올라가 있는지" 추적이 어려워진다.

##### 비교

| 항목       | 2-Tier              | 3-Tier                            |
| -------- | ------------------- | --------------------------------- |
| 구성 복잡도   | 낮음                  | 높음                                |
| 역할 분리    | 개발/운영/인프라를 한 사람이 담당 | 개발자/운영자/DBA 분리 가능                 |
| 작업 정의 관리 | 로컬 파일, 서버에 직접 저장    | Repository에서 중앙 관리 + 버전 이력        |
| 배포       | 직접 복사/실행            | Repository → Runtime Server 배포 절차 |
| 모니터링     | 개발자가 로그 직접 확인       | 운영자가 중앙 모니터링 화면에서 확인              |
| 적합한 환경   | 소규모 팀, 단순 배치        | 다수 개발자, 운영 통제 필요한 환경              |

> [!note]+ 3-Tier가 "더 좋은" 것은 아니다
> 3-Tier는 "더 통제 가능한" 구조다. 소규모 환경에서 3-Tier를 도입하면 오버엔지니어링이 된다. 데이터 이동 패턴의 리스크를 보고, 그 리스크를 감당할 수 있는 실행 구조를 고르면 된다.

---

### 5. 적재 방식에 따른 성능 차이

데이터를 target DB에 넣는 방식에 따라 성능이 크게 달라진다. [[ODBC vs JDBC]]같은 연결 인터페이스로 DB에 붙는 것과, 실제로 데이터를 넣는 적재 방식은 별개의 문제다.

```
느림 ←─────────────────────────────────────────────────────────→ 빠름

row-by-row     batch INSERT       bulk load          병렬 외부 테이블
INSERT         (N건씩 묶음)       (DB 전용 유틸리티)       (gpfdist 등)
```

| 방식 | 동작 | 특징 |
|------|------|------|
| row-by-row INSERT | 한 건씩 INSERT + COMMIT | 가장 느림. 트랜잭션 로그 부하 큼 |
| batch INSERT | N건씩 묶어서 INSERT | 중간 성능. JDBC `addBatch()` 등 |
| bulk load | DB 전용 유틸리티로 대량 적재 | 로그 최소화, 제약 조건 지연 검사 등 DB 엔진 레벨 최적화 |
| 병렬 외부 테이블 | 파일을 DB가 직접 병렬로 읽음 | 가장 빠름. DB 아키텍처에 의존 |

---

### 6. Oracle 적재 도구

##### ORACLE_LOADER

Oracle의 **외부 테이블(External Table) access driver**다. DB 외부의 파일을 SQL로 조회할 수 있는 가상 테이블로 정의한다. 데이터를 DB에 복사하지 않고 파일을 직접 읽는 방식이다.

```sql
CREATE TABLE ext_employees (
    emp_id    NUMBER,
    emp_name  VARCHAR2(100),
    salary    NUMBER
)
ORGANIZATION EXTERNAL (
    TYPE ORACLE_LOADER
    DEFAULT DIRECTORY data_dir
    ACCESS PARAMETERS (
        RECORDS DELIMITED BY NEWLINE
        FIELDS TERMINATED BY ','
    )
    LOCATION ('employees.csv')
);

-- 일반 테이블처럼 조회
SELECT * FROM ext_employees WHERE salary > 50000;

-- 내부 테이블로 적재
INSERT INTO employees SELECT * FROM ext_employees;
```

##### SQL*Loader

CLI 기반 bulk load 유틸리티다. 제어 파일(control file)로 파일 포맷과 매핑을 정의하고, 대량 데이터를 빠르게 적재한다.

| 도구 | 역할 |
|------|------|
| **SQL*Loader** | CLI bulk load. 제어 파일 기반 |
| **ORACLE_LOADER** | 외부 테이블 access driver. SQL로 파일 접근 |
| **Data Pump** | Oracle 간 논리적 백업/복원 (expdp/impdp) |

---

### 7. Greenplum 적재 도구

[[Greenplum Database - PostgreSQL 기반 MPP 데이터 웨어하우스|Greenplum]]의 MPP 아키텍처를 활용하면 파일 적재를 병렬로 처리할 수 있다.

##### gpfdist — 파일 분배 서버

각 Segment가 파일을 **병렬로 직접 읽을 수 있도록** 분배하는 경량 HTTP 서버다. Coordinator를 거치지 않으므로 단일 COPY보다 **수배~수십 배 빠르다**.

```
                    ┌→ Segment 1 (파일 일부 읽기)
파일 → gpfdist ─────┼→ Segment 2 (파일 일부 읽기)
                    └→ Segment 3 (파일 일부 읽기)
```

```bash
gpfdist -d /data/files -p 8080 &
```

```sql
CREATE EXTERNAL TABLE ext_logs (
    log_time TIMESTAMP,
    message  TEXT
)
LOCATION ('gpfdist://etl-host:8080/logs/*.csv')
FORMAT 'CSV' (HEADER);

-- 병렬 적재
INSERT INTO logs SELECT * FROM ext_logs;
```

##### gpload — gpfdist 래퍼

gpfdist + INSERT/UPDATE + 에러 처리를 **YAML 설정 파일**로 감싼 유틸리티다. 반복적인 적재 작업을 자동화할 때 사용한다.

```yaml
VERSION: 1.0.0.1
DATABASE: warehouse
USER: etl_user
HOST: gp-coordinator
PORT: 5432
GPLOAD:
  INPUT:
    - SOURCE:
        FILE: ['/data/sales_*.csv']
    - FORMAT: csv
    - HEADER: true
  OUTPUT:
    - TABLE: public.sales
    - MODE: INSERT
  PRELOAD:
    - REUSE_TABLES: true
```

```bash
gpload -f load_sales.yml
```

> [!note]+ gpload의 내부 동작
> gpload는 내부적으로 gpfdist를 띄우고, 외부 테이블을 생성하고, INSERT/UPDATE를 실행한 뒤 정리하는 과정을 자동으로 수행한다. gpfdist의 상위 래퍼다.

---

### 관련 노트

- [[ODBC vs JDBC]] — DB 연결 인터페이스 비교
- [[Greenplum Database - PostgreSQL 기반 MPP 데이터 웨어하우스]] — Greenplum MPP 아키텍처와 분산 키 설계
