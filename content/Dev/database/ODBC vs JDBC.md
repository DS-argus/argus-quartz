---
tags:
  - database
  - odbc
  - jdbc
  - data_engineering
created: 2026-06-06T10:00:00
updated: 2026-06-06T10:00:00
permalink: /Dev/database/odbc-vs-jdbc
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - ODBC는 언어 무관 DB 연결 API, JDBC는 Java 전용 DB 연결 API
> - 둘 다 "DB에 붙는 방법"을 다루는 것이지 "데이터를 빠르게 넣는 방법"이 아님
> - ODBC는 Driver Manager + DB별 드라이버 구조, JDBC는 Java API + JDBC Driver 구조
> - Windows/레거시 환경은 ODBC, JVM 기반 애플리케이션은 JDBC가 일반적

---

### 1. ODBC

ODBC(Open Database Connectivity)는 **특정 DBMS에 종속되지 않는 DB 연결 API 규격**이다. Microsoft가 설계했고, 언어에 상관없이 사용할 수 있다.

##### 구조

```
Application → ODBC Driver Manager → DB별 ODBC Driver → DBMS
```

- **Application**: DB에 접근하려는 프로그램 (ETL 도구, Python 스크립트 등)
- **Driver Manager**: ODBC 호출을 적절한 드라이버로 라우팅
- **ODBC Driver**: DBMS별로 제공되는 드라이버. 실제 DB 통신 담당

##### 핵심

- ODBC는 DB가 아니라 **인터페이스 규격**이다
- 실제 연결은 DBMS별 드라이버가 수행한다
- **DSN**(Data Source Name)으로 연결 정보를 등록/관리한다
- C, C++, Python, Go 등 어디서든 사용 가능

##### 운영에서 자주 부딪히는 것

- 드라이버 설치/버전 관리
- 시스템 DSN vs 사용자 DSN 구분
- **32bit/64bit 드라이버 불일치** — 애플리케이션과 드라이버의 비트 수가 다르면 연결 실패
- connection string 파라미터 (charset, timeout, fetch size 등)

---

### 2. JDBC

JDBC(Java Database Connectivity)는 **Java 애플리케이션이 DB에 접근하기 위한 표준 API**다. `java.sql` 패키지에 인터페이스가 정의되어 있고, 각 DBMS 벤더가 구현체(드라이버)를 JAR로 제공한다.

##### 구조

```
Java Application → JDBC API (java.sql) → JDBC Driver → DBMS
```

##### 드라이버 타입

JDBC 드라이버는 4가지 타입으로 분류된다. 실무에서 거의 대부분 Type IV를 사용한다.

| 타입 | 이름 | 특징 |
|------|------|------|
| Type I | JDBC-ODBC Bridge | ODBC를 거쳐 연결. 현재 폐기 |
| Type II | Native API | DB 클라이언트 라이브러리 필요 (예: Oracle OCI) |
| Type III | Network Protocol | 미들웨어 서버를 거쳐 연결 |
| **Type IV** | **Thin / Pure Java** | **DB와 직접 통신. 추가 설치 불필요. 가장 많이 사용** |

Oracle을 예로 들면:

| 드라이버 | 타입 | 특징 |
|----------|------|------|
| **Thin Driver** | Type IV | Pure Java. Oracle 클라이언트 설치 불필요 |
| OCI Driver | Type II | Oracle 클라이언트 라이브러리 필요. 특수 기능(RAC 등) 활용 시 |

##### 연결 예시

```java
// JDBC 기본 연결
String url = "jdbc:postgresql://localhost:5432/mydb";
Connection conn = DriverManager.getConnection(url, "user", "password");

// PreparedStatement로 쿼리
PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE age > ?");
stmt.setInt(1, 20);
ResultSet rs = stmt.executeQuery();
```

```python
# Python에서 JDBC 사용 (jaydebeapi)
import jaydebeapi

conn = jaydebeapi.connect(
    "org.postgresql.Driver",
    "jdbc:postgresql://localhost:5432/mydb",
    ["user", "password"],
    "/path/to/postgresql.jar"
)
```

---

### 3. ODBC vs JDBC 비교

| 항목 | ODBC | JDBC |
|------|------|------|
| 언어 | 언어 무관 (C API 기반) | Java 전용 |
| 드라이버 배포 | OS별 네이티브 설치 | JAR 파일 |
| 설정 | DSN 기반 | connection string / properties |
| 크로스플랫폼 | 플랫폼별 드라이버 필요 | JVM 위에서 동작하므로 이식성 좋음 |
| 주요 사용처 | Windows 환경, 레거시 시스템, 다양한 언어 | Java/JVM 애플리케이션, Spark, ETL 도구 |
| Python 연동 | `pyodbc` | `jaydebeapi`, `jpype` |

##### 선택 기준

- **Java/JVM 기반** 애플리케이션 → JDBC
- **Python, C++ 등 비JVM 언어** → ODBC 또는 DB 네이티브 드라이버
- **Spark, Flink 등 JVM 데이터 처리 엔진** → JDBC
- **Windows 환경의 레거시 ETL 도구** → ODBC

> [!note]+ 연결과 적재는 다른 문제
> ODBC든 JDBC든 DB에 **붙는 방법**을 다루는 것이다. 대량 데이터를 빠르게 적재하는 것은 bulk load, 외부 테이블 등 **적재 메커니즘**의 영역이다. 이 부분은 [[ETL 데이터 이동과 적재]]에서 다룬다.
