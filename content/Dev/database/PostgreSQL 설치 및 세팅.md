---
tags:
  - database
  - postgresql
created: 2025-08-06T00:00:00
updated: 2025-08-06T14:58:52
---
### 1. Why PostgreSQL?

![[PostgreSQL 설치 및 세팅 - 2025-08-06 - 13-00-53.png|753x471]]


PostgreSQL은 **오픈 소스 관계형 데이터베이스 관리 시스템(RDBMS)**으로, 높은 **확장성**과 엄격한 **SQL 표준 준수**를 강조하는 대표적인 데이터베이스다

##### 주요 장점
1. 풍부한 기능과 SQL 표준 준수
	- PostgreSQL은 SQL:2016을 비롯한 최신 SQL 표준의 대부분을 구현하여, 데이터베이스 간 이식성과 호환성이 뛰어남
	- **Common Table Expressions (CTE)**, **Window 함수**, **Subquery** 등 고급 SQL 기능들을 일찍부터 제공
	- **트랜잭션 무결성(ACID)**을 철저히 지키며, 복잡한 작업도 일관성 있게 처리

2. JSONB를 통한 NoSQL 수준의 유연성 
	- 9.4 버전부터 도입된 **JSONB 자료형**을 통해 문서 지향 데이터 저장소 수준의 유연성을 제공
	- JSON 문서를 **이진 형태로 저장**하여 빠른 검색과 인덱싱을 지원하며, 키-값 쌍에 대한 조회, 중첩 구조 파싱, 부분 업데이트에 효율적
3. 강력한 데이터 타입 시스템과 확장성
	- 기본적인 정수, 문자, 날짜 타입 외에도 다양한 타입 지원
		- **배열(array)** 타입을 지원하여 하나의 컬럼에 복수의 값을 저장 가능
		- **SON/JSONB**, **hstore(키-값 저장)**, **XML**과 같은 반정형 데이터 타입도 폭넓게 제공
		- **범위(range)** 타입(예: INT4RANGE, TSTZRANGE)은 시작과 끝 값을 하나의 필드로 관리하여 기간 겹침 여부 등의 복잡한 질의를 간편하게 처리할 수 있음
	- **확장 가능 구조(Extensibility)**를 갖추고 있어, 사용자 정의 데이터 타입, 함수, 연산자를 손쉽게 만들 수 있음
		- PostGIS 확장을 설치하면 geometry 타입과 지리 연산자들이 추가되어 PostgreSQL이 **전문 GIS 데이터베이스**로 변모
		- 사용자 정의 함수는 PL/pgSQL은 물론 Python, R, JavaScript 등 다양한 언어로 작성할 수 있어, 데이터 처리 로직을 DB 내부에 캡슐화하여 활용하기에도 용이

4. 우수한 동시성 제어 (MVCC) 성능
	- 다중 사용자 환경에서도 높은 성능과 일관성을 보장
		- 읽기 작업은 쓰기 작업을 블로킹하지 않고, 오래 실행되는 쿼리도 **스냅샷 격리 수준**에서 일관된 결과를 얻을 수 있음
		- 오라클 등 상용 DB에 견줄만한 수준의 동시성 처리로 평가받음
	- **쿼리 최적화기(Query Planner)** 또한 지속적으로 개선되어, 복잡한 조인이나 하위쿼리도 효율적으로 실행계획을 수립
	- 인덱스도 B-Tree, 해시, GIN, GiST 등 다양한 유형을 지원하여, 텍스트 검색이나 JSON 필드 검색 등 특수한 용도의 쿼리도 최적화 가능
		- GIN 인덱스를 사용하면 JSONB 데이터 내 특정 키를 가지는 행을 매우 빠르게 찾을 수 있음
		- GiST 인덱스를 통해 범위 타입이나 지리 좌표의 근접 검색 등을 구현

5. 파티셔닝을 통한 대용량 데이터 관리
	- 10버전부터 선언적 파티셔닝을 도입하여, 범위(range) 또는 목록(list) 단위로 테이블을 분할할 수 있고, 11버전에서는 해시(hash) 파티셔닝도 추가
	- 파티셔닝된 테이블은 쿼리 시에 필요한 파티션만 검색하므로, 수억 건 이상의 테이블에서도 **쿼리 성능과 관리 편의성**을 향상시킬 수 있음

6. 복제 및 고가용성 지원
	- 기본적으로 **WAL(Write-Ahead Logging)** 기반의 **스트리밍 복제**를 지원하여, 주 서버의 트랜잭션 로그를 실시간으로 보조 서버에 적용함으로써 **핫 스탠바이**를 운용할 수 있음
	- 9.6 버전 이후로는 다중 병렬 복제 슬롯 및 **논리적 복제(logical replication)**도 지원되어 유연성 추가
	- **동기식 복제(synchronous replication)** 옵션을 사용하면 주 서버에서 커밋된 트랜잭션이 최소 하나의 스탠바이에 안전하게 기록되기 전까지 완료되지 않도록 할 수 있어, 장애 시에도 데이터 손실을 최소화

7. 활발한 커뮤니티와 오픈 소스 생태계
	- 전 세계에 걸친 **활발한 개발자 커뮤니티**를 자랑
	- 오픈 소스 프로젝트인 만큼 **라이선스** 또한 유연하여, PostgreSQL 라이선스(BSD 계열)를 통해 기업에서 소스 코드를 자유롭게 수정 및 활용
	- 다양한 **확장 생태계**가 조성되어 있어, 필요에 따라 특화된 기능을 쉽게 도입
	- 시계열 데이터에 최적화된 TimescaleDB, 분산 처리에 특화된 Citus, 머신러닝 벡터 검색을 지원하는 PGVector 등의 확장이 모두 PostgreSQL 위에서 동작

##### 다양한 활용 사례
- **웹 애플리케이션의 메인 데이터베이스**
	- 전자상거래, 소셜 네트워킹, 콘텐츠 관리 시스템 등 수많은 웹서비스 백엔드에서 PostgreSQL이 핵심 DB로 사용 중 
	- 예를 들어 Instagram, Reddit 등 여러 대형 서비스가 PostgreSQL을 주요 DBMS로 활용하고 있으며, 수천만 명의 사용자 데이터를 안정적으로 관리하면서 서비스 확장에 대응하고 있음
	- Django나 Rails 같은 현대 웹 프레임워크도 PostgreSQL을 우선 지원하여, 개발자가 특별한 설정 변경 없이 손쉽게 PostgreSQL을 사용할 수 있음
	- 이런 일반 웹 서비스에서 PostgreSQL은 트랜잭션 일관성과 적절한 성능을 바탕으로 안정적인 운영을 가능케 함
	    
- **데이터 웨어하우스 및 BI**
	- 과거에는 대규모 분석을 위해 Oracle, Teradata 같은 고가의 DW 솔루션을 사용했지만, 최근에는 PostgreSQL 기반의 **Greenplum**이나 Amazon Redshift처럼 오픈 소스에 기반한 대안이 부상
	-  Greenplum은 PostgreSQL를 MPP(Massively Parallel Processing) 아키텍처로 확장하여 페타바이트급 데이터를 분산 처리하는 데이터 웨어하우스로 활용되며, 금융권이나 통신사에서 대용량 로그 분석용으로 활용
	- PostgreSQL 본연의 창 함수, 집계 최적화 기능을 사용해 중소 규모에서는 별도 DW 없이도 **OLTP-OLAP 겸용**으로 활용하는 경우도 있음
	    
- **GIS(지리정보 시스템)**
	- PostgreSQL의 확장인 **PostGIS**는 사실상 업계 표준의 오픈 소스 GIS 데이터베이스로 평가
	- PostGIS를 통해 도형(폴리곤), 좌표, 거리 계산 등의 공간 자료 연산을 SQL로 수행할 수 있으며, 전 세계 도시 정보 시스템, 내비게이션, 위치 기반 서비스들이 PostGIS로 구축되어 있음
	    
- **JSON 데이터 저장 및 조회**
	- 앞서 언급한 JSONB 기능을 활용하여, 모바일 앱의 사용자 설정이나 로그 데이터처럼 스키마가 가변적인 JSON 데이터를 PostgreSQL에 직접 저장하는 사례가 많음
	- 이처럼 PostgreSQL은 전통적인 RDBMS 역할 뿐 아니라 **NoSQL Document DB 대용**으로도 활용되어, 하나의 DB로 멀티 모델을 소화하는 플랫폼이 되고 있음
	    
- **검색 및 전문(full-text) 검색**
	- 검색이라 하면 흔히 ElasticSearch를 떠올리지만, PostgreSQL도 **Full Text Search** 기능을 내장
	- to_tsvector, to_tsquery 등의 함수를 이용하면 텍스트 컬럼에 대한 색인과 검색을 DB 내부에서 수행할 수 있고, GIN 인덱스를 결합하면 매우 빠른 전문 검색이 가능
	- 규모가 아주 크지 않다면 별도 검색엔진 없이 PostgreSQL만으로 기본적인 검색 기능을 구현해 운영 비용을 줄일 수 있음 
	    
- **AI 및 머신러닝 피쳐 스토어**
	- **PGVector** 확장은 벡터 임베딩 데이터를 PostgreSQL에 저장하고 비슷한 벡터를 근접 탐색할 수 있게 해줌
	- 이를 활용하면 추천 시스템이나 자연어 임베딩 검색 등을 PostgreSQL에서 직접 수행할 수 있어, 추가적인 벡터 DB 없이도 **AI 기능을 기존 데이터베이스에 통합** 가능 
	- OpenAI 등의 사례에서도 PGVector를 활용해 문서 임베딩을 PostgreSQL에 저장하고 유사 문서를 검색하는 방식이 소개되어 있으며, 이를 통해 **PostgreSQL이 AI 시대의 데이터 요구까지 포용**하는 확장성을 보여줌

##### PostgreSQL 연관 생태계 프로젝트
1. PostgreSQL (Core 프로젝트)
	- 커뮤니티가 개발 및 유지보수하는 메인 PostgreSQL 엔진은 모든 생태계 프로젝트의 기반
	- 이 코어 엔진은 SQL 표준 기능, 저장소 엔진, WAL 기반 복제 등을 포함하며, 범용 DBMS로서의 역할 수행
	- 커뮤니티 PostgreSQL은 연 1회 메이저 업데이트로 지속적인 발전을 이루고 있고, 앞서 설명한 다양한 확장(extension)들이 이 코어 위에서 구동
	- **모든 연관 프로젝트의 근간**이 되는 만큼, PostgreSQL 코어의 신뢰성, 성능 향상이 곧 생태계 전체의 발전으로 이어짐
2. EnterpriseDB (EDB)
	- **EnterpriseDB(EDB)**는 PostgreSQL 생태계에서 상용 지원과 부가 기능을 제공하는 대표적인 기업
	- PostgreSQL의 엔터프라이즈 생태계를 담당하여, **상용 DB 수준의 지원과 편의성을 오픈 소스 PostgreSQL 사용자에게 제공**하는 역할
	- PostgreSQL을 기반으로 한 **EDB Advanced Server**를 배포하는데, 여기에는 Oracle과의 호환성을 높이는 기능들이 추가되어 있음
		- Oracle의 PL/SQL 구문을 거의 그대로 실행할 수 있도록 함수와 패키지를 지원하고, Oracle 호환 툴이나 이중화 솔루션을 제공하여 **기존 Oracle 사용 기업이 PostgreSQL로 쉽게 전환** 가능
3. Greenplum
	- PostgreSQL를 기반으로 한 오픈 소스 병렬 데이터베이스 프로젝트로 친숙한 PostgreSQL 인터페이스를 사용하면서도 **빅데이터 분석**에 대응할 수 있음
	- 각 노드에서 독립적인 PostgreSQL 프로세스(세그먼트)를 돌리고 중앙 마스터 노드가 쿼리를 분배하는 구조로, 수십 테라바이트 이상의 데이터도 선형적으로 처리할 수 있음
	- 일반 PostgreSQL과 구조가 달라 완벽히 호환되는 것은 아니므로, OLTP보다는 **OLAP/배치 분석** 용도로 특화
	- 기업에서는 Greenplum을 데이터 마트나 대시보드 분석 용도로 사용하고, 실시간 트랜잭션은 PostgreSQL 코어에 맡기는 식으로 **적재적소에 활용**
4. PGVector
	-  PostgreSQL의 확장 모듈 중 하나로, 최근 주목받는 **벡터 데이터베이스** 기능을 PostgreSQL에 부여
	- 내부적으로 코사인 유사도나 내적(dot product) 계산을 빠르게 하기 위해 IVF, HNSW와 같은 알고리즘을 사용하며, 고차원 벡터에서도 실용적인 검색 성능을 제공

---
### 2. 설치
##### brew로 설치
homebrew를 이용해서 직접 바이너리를 다운받을 수 있다   
```bash
# 필요한 버전 검색
brew search postgresql

# 설치
brew install postgresql@16
```

`psql`, `pg_isready`같은 postgres에서 제공하는 CLI를 사용하기 위해서는  PATH 설정을 추가로 해야한다
```bash
# PATH 추가
export PATH="/opt/homebrew/opt/postresql@16/bin:$PATH"

# zsh의 경우 설정파일에 기록
echo 'export PATH="/opt/homebrew/opt/postresql@16/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```


또한, `pip install psycopg2`와 같이 Python 패키지를 wheel 없이 소스에서 빌드하거나, PostgreSQL 확장 모듈을 직접 컴파일하는 등의 경우 링크 단계와 컴파일 단계에서 필요한 파일들의 경로를 알려줄 필요가 있다
```bash
export LDFLAGS="-L/opt/homebrew/opt/postgresql@16/lib"` 
export CPPFLAGS="-L/opt/homebrew/opt/postgresql@16/include"` 
```

설치가 완료 되었으면, 다음 명령어들로 postgres daemon을 실행 및 중단할 수 있다
```bash
# 서버 시작 (백그라운드에서 항상 실행되도록 서비스 등록)
brew services start postgresql

# 실행 중인 것 확인
brew services list
pg_isready

# 서버 종료
brew services stop postgresql

# 서버 재시작 : postgresql.conf, pg_hba.conf 등 설정파일 수정했거나 문제 발생한 경우 복구
brew services restart postgresql
```

> [!note]+ postgres 설정파일
> 1. `postgresql.conf`
> 	- PostgreSQL 서버의 기본 동작(포트, 로그, 메모리, 네트워크 바인딩 등)을 정의하는 핵심 설정 파일
> 	- 위치: /opt/homebrew/var/postgresql@16/postgresql.conf
> 	- 외부 접속 허용을 위해 listen_addresses = 'localhost' 를 '\*' 로 변경하면 모든 IP에서 TCP 연결을 수락
> 2. `pg_hba.conf`
> 	- 클라이언트가 데이터베이스에 접속할 때 **누가(USER)**, **어디서(ADDRESS)**, **어떤 방식(METHOD)** 으로 인증할지 결정하는 접근 제어 리스트(ACL) 파일
> 	- 위치: /opt/homebrew/var/postgresql@16/pg_hba.conf
> 	- 형식: TYPE  DATABASE  USER  ADDRESS  METHOD
> 		- 예시 : host  all  all  127.0.0.1/32  trust
> 			- TYPE = host : TCP/IP 접속 허용
> 			- DATABASE = all : 모든 데이터베이스
> 			- USER = all : 모든 PostgreSQL 사용자
> 			- ADDRESS = 127.0.0.1/32 : 로컬 루프백 IP만 허용
> 			- METHOD = trust : 비밀번호 없이 접속 허용

##### Docker
[Postgres Docker Hub](https://hub.docker.com/_/postgres)에서 다양한 버전의 postgres를 사용할 수 있다  
예를 들어 postgres 16 버전 컨테이너를 다음과 같이 실행할 수 있다
``` bash
docker run -p 5432:5432 --name postgres \
	-e POSTGRES_PASSWORD=1234 \
	-v <데이터 경로>:/var/lib/postgresql/data \
	-d postgres:16
```

컨테이너를 실행시킨 후 다음 명령어로 컨테이너에 진입하면 된다
```bash
docker exec -it postgres bash
```

##### Docker Compose
`docker-compose.yml`은 다음과 같이 작성할 수 있다

```yml
services:
  # PostgreSQL 데이터베이스
  postgres:
    image: postgres:16
    container_name: postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: pg_isready -U postgres -d postgres
      interval: 10s
      timeout: 5s
      retries: 5

  # PGAdmin - PostgreSQL 관리 웹 인터페이스
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    volumes:
      - pgadmin_data:/var/lib/pgadmin

volumes:
  postgres_data:
  pgadmin_data:
```

다음 명령어로 컨테이너를 실행하고 컨테이너에 접속할 수 있다
```bash 
docker compose up -d

docker exec -it postgres bash
```

이제부터는 Docker compose로 실행한 경우를 예시로 알아볼 것이다

---
### 3. Postgres 기본 명령어
##### 접속

이제 PostgreSQL 서버에 접속해 SQL을 실행하거나 관리 작업을 수행하는 CLI 클라이언트인 `psql` 명령어로 database에 접속해보자
```
# psql [연결 옵션] [실행 옵션]
psql -U postgres                   # User 옵션
psql -U postgres -d postgres       # User 옵션 + database 옵션
psql -U postgres -d postgres -W    # User 옵션 + database 옵션 + password 옵션 (불필요)
```

![[PostgreSQL 설치 및 세팅 - 2025-08-06 - 10-39-30.png|605x333]]

`POSTGRES_PASSWORD` 환경변수는 컨테이너가 처음 시작될 때 데이터베이스 클러스터 초기화과정이 진행되며 DB 사용자 postgres의 암호로 자동 설정된다.   
하지만 컨테이너 안에서 `psql -U postgres`를 하게 되면 내부적으로 알아서 password를 입력하지 않아도 접속이 가능하며, 컨테이너 바깥에서 접속할 때 비밀번호를 입력해야한다.
``` 
# host에서 다음 명령어를 실행하면 비밀번호를 입력해야 한다
# psql을 사용하기 위해 host에 postgresql이 설치되어 있어야 함
psql -h localhost -p 5432 -U postgres -d postgres
```
![[PostgreSQL 설치 및 세팅 - 2025-08-06 - 10-40-13.png|606x334]]


##### psql 전용 명령어

psql에서 제공하는 명령어는 `\`로 시작하고 `\?`를 통해 명령어를 확인할 수 있다  
대부분 간단한 읽기 전용 명령어이며 psql 전용이라 pgAdmin, JDBC, DBeaver나 다른 DBMS에서는 동작하지 않는다

```sql
-- 연결 / 세션
\c <DB>       -- 다른 DB 접속
\conninfo     -- 현재 연결 정보
\password     -- 비밀번호 변경
\q            -- psql 종료

-- 스키마·데이터베이스
\dn           -- 스키마 목록
\dn+          -- 스키마 목록 + 소유자·권한
\l            -- 데이터베이스 목록
\l+           -- 데이터베이스 목록 + 크기·접속

-- 권한 소유권
\z            -- 테이블·시퀀스·뷰 권한
\du           -- 모든 Role
\du+          -- 모든 Role + 설명

-- 개체 조회
\d            -- 현재 DB 모든 객체 개요
\d+           -- 현재 DB 모든 객체 개요 + 저장공간·소유자
\dt           -- 테이블 목록
\dt+          -- 테이블 목록 + 크기
\dv           -- 뷰 목록
\di           -- 인덱스 목록
\ds           -- 시퀀스 목록
\dx           -- 확장 모듈 목록
\df           -- 함수 목록
\df+          -- 함수 목록 + 정의
```



##### 관리용 SQL
```sql
SELECT current_user;                                   -- 현재 세션 사용자
SELECT current_database();                             -- 현재 접속 DB
SELECT * FROM pg_roles;                                -- 모든 역할 및 권한
SELECT * FROM information_schema.role_table_grants;    -- 역할별 테이블 권한

CREATE DATABASE mydb;                                  -- 새로운 DB 생성
CREATE USER myuser PASSWORD 'mypassword';              -- 새로운 사용자 생성

GRANT ALL PRIVILEGES ON DATABASE airflow TO airflow;   -- DB 접속·세션 권한
GRANT ALL PRIVILEGES ON SCHEMA public TO airflow;      -- 스키마 작업 권한

SHOW search_path;                                      -- 스키마 탐색 우선순위
```

