---
tags:
  - database
  - backend
  - postgresql
  - cs
created: 2026-08-17T00:00:00
updated: 2026-09-05T19:27:49
permalink: /Dev/database/transaction-boundaries-and-pitfalls
---

> [!abstract]+ TL;DR
> - 트랜잭션 시작 시점이 클라이언트마다 달라 autocommit 기본값 확인이 먼저
> - 경계 기준은 하나. 함께 실패해야 하는 것만 묶고 외부 호출은 밖으로 뺌
> - 시퀀스와 외부 부수 효과는 롤백을 따르지 않으므로 재시도 설계가 별도로 필요

> *AI-assisted*

---

### 1. 트랜잭션은 언제 시작되는가

[[Database Transactions - ACID and Isolation Levels|트랜잭션]]을 쓸 때 처음 걸리는 곳은 **내가 지금 트랜잭션 안에 있는지 모른다는 점**이다.

`BEGIN`을 안 쳤는데 열려 있기도 하고 쳤다고 생각했는데 안 열려 있기도 하다. 클라이언트마다 기본값이 다르기 때문이다.

| 클라이언트                                                                                        | autocommit 기본   | 트랜잭션이 열리는 시점                           |
| -------------------------------------------------------------------------------------------- | --------------- | -------------------------------------- |
| [psql](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-VARIABLES)             | on              | `BEGIN`이나 `START TRANSACTION`을 직접 칠 때  |
| [psycopg3](https://www.psycopg.org/psycopg3/docs/basic/transactions.html)                    | off             | **첫 쿼리를 보낼 때 자동으로.** `SELECT` 하나로도 열린다 |
| [JDBC](https://docs.oracle.com/en/java/javase/21/docs/api/java.sql/java/sql/Connection.html) | on              | `setAutoCommit(false)` 이후 첫 쿼리         |
| [SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/core/connections.html)                    | off (autobegin) | 첫 `execute()` 호출 때 **자동으로 열린다**        |
| [Django ORM](https://docs.djangoproject.com/en/stable/topics/db/transactions/)               | on              | **가장 바깥** `atomic()` 블록에 들어갈 때         |

autocommit이 켜져 있으면 **문장 하나가 곧 트랜잭션 하나**다. `UPDATE` 두 줄을 나란히 실행하면 트랜잭션 두 개로 나뉘어 중간에 남이 끼어들 수 있다.

**끄면 반대가 된다.** psycopg3와 SQLAlchemy 2.0은 `BEGIN`을 안 써도 첫 문장에서 트랜잭션을 열고 **명시적으로 닫기 전까지 유지한다.**
[psycopg 문서](https://www.psycopg.org/psycopg3/docs/basic/transactions.html)에서 다음과 같이 명시하고 있다.

> By default even a simple `SELECT` will start a transaction: in long-running programs, if no further action is taken, the session will remain *idle in transaction*

조회만 하는 코드도 커밋하지 않으면 `idle in transaction`으로 남는다.

지금 상태는 서버에서 확인한다.

```sql
SELECT pid, state, xact_start, query
FROM pg_stat_activity WHERE pid = pg_backend_pid();
```

- `state`가 `idle`이면 트랜잭션 밖
- `idle in transaction`이면 열어놓고 아무것도 안 하는 중
- `xact_start`가 채워져 있으면 그 시각부터 트랜잭션이 열려 있다

> [!warning]+ 주의: 같은 코드가 환경마다 다르게 돈다
> - 로컬에서 psql로 검증한 SQL을 애플리케이션에 옮기면 트랜잭션 경계가 달라진다
> - 라이브러리를 바꾸면 경계가 달라진다. psycopg3와 SQLAlchemy는 안 열어도 열리고 JDBC와 Django는 안 닫아도 닫힌다
> - 프레임워크를 바꿀 때는 기본값부터 확인한다

---

### 2. 어디서 닫을 것인가

경계 기준은 하나다. **함께 실패해야 하는 것만 묶는다.**

실전에서는 이렇게 바꿔 물으면 판단이 빠르다. **"이게 실패하면 앞의 것도 취소돼야 하나?"** 아니라면 다른 트랜잭션으로 나눈다.

후보는 대체로 셋이다.

| 범위    | 언제 맞나             | 위험               |
| ----- | ----------------- | ---------------- |
| 문장 단위 | 단순 조회, 독립적인 단건 갱신 | 여러 문장의 정합성을 못 지킴 |
| 작업 단위 | 대부분의 경우           | 없음. 기본으로 삼는다     |
| 요청 단위 | 짧고 DB만 건드리는 API   | 외부 호출이 끼면 오래 열림  |

넓게 잡을 때와 좁게 잡을 때 잃는 것이 다르다.

- **넓게 잡으면**: 락 유지 시간 증가, 커넥션 점유, MVCC 죽은 버전 회수 지연
- **좁게 잡으면**: 중간 상태가 밖에서 보임, 일부만 반영되고 끝남

주문 처리를 예로 들면 이렇게 갈린다.

```python
# 하나로 묶는다: 재고와 주문은 함께 실패해야 한다
with conn.transaction():
    decrease_stock(item_id, qty)
    create_order(user_id, item_id, qty)

# 밖으로 뺀다: 알림이 실패해도 주문은 살아 있어야 한다
send_notification(user_id)
```

> [!tip]+ 경계를 못 정하겠을 때
> - 되돌리면 안 되는 것이 하나라도 있으면 그 지점이 경계다
> - 애매하면 좁게 시작한다. 나중에 넓히는 편이 반대보다 쉽다

---

### 3. 트랜잭션 안에 넣으면 안 되는 것

후속 처리로 분리할 수 있는 작업은 비동기로 넘겨 동기 트랜잭션의 쓰기 범위를 줄일 수 있다.

경계를 넓게 잡는 것 자체보다 **안에 무엇이 들어가느냐**가 문제인 경우가 많다.

- **외부 API 호출**: 상대가 느리면 그 시간만큼 트랜잭션이 열려 있다. 타임아웃이 30초면 30초 동안 락과 커넥션을 쥔다
- **사용자 입력 대기**: 화면을 띄워놓고 응답을 기다리는 구조는 트랜잭션 안에 들어가면 안 된다
- **무거운 계산**: DB와 무관한 연산은 트랜잭션 밖에서 끝내고 결과만 들고 들어간다
- **대용량 파일 처리**: 업로드와 파싱은 밖에서 한다

트랜잭션이 열려 있는 동안 붙잡고 놓지 않는 자원이 셋이다.

- **커넥션**: 풀에서 하나가 계속 빠져 있다
- **락**: 같은 행을 기다리는 트랜잭션이 줄을 선다
- **스냅샷**: 이 트랜잭션이 볼지 모르는 옛 버전을 못 지운다

> [!warning]+ 주의: `idle in transaction`이 남기는 것
> - 트랜잭션을 열고 아무 일도 안 하는 상태다. 애플리케이션이 외부 응답을 기다리는 중이거나 커밋을 잊었을 때 생긴다
> - PostgreSQL에서는 [[Concurrency Control - MVCC, OCC, and Locking|`VACUUM`이 죽은 행을 회수하지 못한다]]. 이 세션이 옛 버전을 볼지도 모르기 때문이다
> - **세션 하나가 테이블 전체의 회수를 막는다.** 갱신이 잦은 테이블이면 며칠 만에 크기가 몇 배가 된다
> - 커넥션 풀도 함께 마른다. 풀 크기가 20인데 5개가 이 상태면 실질 동시성이 15다
> - `idle_in_transaction_session_timeout`으로 강제 종료를 걸어둔다

---

### 4. 실패한 뒤에 벌어지는 일

트랜잭션 중간에 에러가 나면 그다음 동작이 DB마다 다르다.

PostgreSQL은 트랜잭션 전체를 실패 상태로 돌린다.

```text
ERROR:  duplicate key value violates unique constraint "users_email_key"

-- 이후 어떤 문장을 보내도
ERROR:  current transaction is aborted,
        commands ignored until end of transaction block
```

첫 에러 이후 모든 문장이 거부된다. `ROLLBACK`이나 `COMMIT`으로 트랜잭션을 닫기 전까지 아무것도 못 한다. 로그에 두 번째 메시지만 잔뜩 쌓여 원인을 못 찾는 경우가 여기서 생긴다.

MySQL은 다르다. 문장 하나만 실패하고 트랜잭션은 살아 있어 다음 문장이 그대로 실행된다.

| DB | 에러 1건이 났을 때 |
| --- | --- |
| PostgreSQL | 트랜잭션 전체가 aborted. 나머지 전부 거부 |
| MySQL | 그 문장만 실패. 나머지는 계속 실행 |

MySQL에서 돌던 배치를 PostgreSQL로 옮기면 여기서 깨진다. "실패한 건은 건너뛰고 계속"이 통하지 않는다.

#### SAVEPOINT로 한 건만 버리기

반복 적재에서 일부 실패를 흡수하려면 `SAVEPOINT`를 쓴다.

```sql
BEGIN;
SAVEPOINT sp;
INSERT INTO users VALUES (...);       -- 중복 키로 실패
ROLLBACK TO SAVEPOINT sp;             -- 이 건만 취소. 트랜잭션은 살아난다
RELEASE SAVEPOINT sp;

SAVEPOINT sp;
INSERT INTO users VALUES (...);       -- 다음 건은 정상 진행
RELEASE SAVEPOINT sp;
COMMIT;
```

`ROLLBACK TO SAVEPOINT`가 aborted 상태를 그 지점까지 되감아준다. PostgreSQL에서 "실패한 건만 건너뛰기"를 구현하는 방법이다.

> [!note]+ SAVEPOINT: 중첩 트랜잭션이 아니다
> - 트랜잭션 안에 트랜잭션을 만드는 게 아니라 되감을 지점을 표시해두는 것이다
> - `RELEASE`해도 커밋되지 않는다. 확정은 바깥 `COMMIT` 시점에 한꺼번에 일어난다
> - 바깥이 롤백되면 안에서 성공한 것도 전부 사라진다
> - ORM의 중첩 `atomic()` 블록이 내부적으로 이걸 쓴다

> [!warning]+ 주의: SAVEPOINT를 건마다 잡으면
> - 반복 횟수만큼 서버 자원이 쌓인다. 수만 건 루프에서는 부담이 눈에 띈다
> - 실패가 드물면 SAVEPOINT 없이 가다가 에러가 났을 때만 트랜잭션을 다시 여는 편이 싸다
> - 대량 적재라면 `INSERT ... ON CONFLICT DO NOTHING`으로 애초에 실패를 안 만드는 쪽을 먼저 본다

---

### 5. 롤백해도 돌아오지 않는 것

`ROLLBACK`은 트랜잭션 안의 변경만 되돌린다. 밖에 있는 것은 그대로 남는다.

#### 시퀀스

> [!note]+ 시퀀스: 번호를 하나씩 발급하는 카운터
> - 테이블·인덱스와 같은 급의 DB 객체다. 안에 든 것은 "몇 번까지 나갔는지" 하나뿐이다
> - `nextval()`이 다음 번호를 꺼내면서 카운터를 올린다. `currval()`은 이 세션이 마지막에 받은 값을 보여줄 뿐 올리지 않는다
> - `bigserial`이나 `GENERATED ALWAYS AS IDENTITY`로 컬럼을 만들면 시퀀스가 딸려 붙는다. `orders` 테이블의 `id`면 이름이 `orders_id_seq`다
> - INSERT에서 `id`를 넘기지 않으면 DB가 대신 `nextval`을 부른다. 직접 칠 일은 거의 없다

```sql
BEGIN;
SELECT nextval('orders_id_seq');   -- 42
ROLLBACK;

SELECT nextval('orders_id_seq');   -- 43. 42는 영영 사라졌다
```

[PostgreSQL 시퀀스 함수 문서](https://www.postgresql.org/docs/current/functions-sequence.html)가 이유를 적어놓았다.

> the value obtained by `nextval` is not reclaimed for re-use if the calling transaction later aborts

되돌리려면 시퀀스에 락을 걸어야 하는데 그러면 번호를 받으려는 트랜잭션이 전부 줄을 선다. **동시성을 위해 일부러 트랜잭션 밖에 뒀다.**

MySQL의 `AUTO_INCREMENT`도 같다.

> [!warning]+ 주의: 연속된 번호를 요구하는 요건
> - 문서에서 언급했듯이 PostgreSQL 시퀀스로는 gapless 번호를 만들 수 없다
> - 롤백뿐 아니라 `INSERT ... ON CONFLICT`에서도 구멍이 생긴다. 충돌을 감지하기 전에 `nextval`을 이미 부르기 때문이다
> - 세금계산서 번호처럼 빠짐없이 이어져야 하는 값은 별도 테이블에 락을 걸고 발급하거나 커밋 이후 후처리로 매긴다
> - PK에 구멍이 생기는 것 자체는 문제가 아니다. 그걸 업무 번호로 노출할 때 문제가 된다

#### 외부 부수 효과

트랜잭션이 커버하는 범위는 그 DB 안까지다.

| 동작 | 롤백되나 |
| --- | --- |
| `INSERT` · `UPDATE` · `DELETE` | 된다 |
| 시퀀스 소비 | 안 된다 |
| 외부 API 호출 | 안 된다 |
| 큐 메시지 발행 | 안 된다 |
| 메일 발송 | 안 된다 |
| 파일 쓰기 | 안 된다 |

대응은 두 갈래다.

- **커밋 이후로 미룬다**: 가장 단순하다. 다만 커밋과 후속 동작 사이에서 죽으면 유실된다
- **outbox를 쓴다**: 보낼 내용을 같은 트랜잭션 안에서 테이블에 적어두고 별도 프로세스가 읽어 발송한다. 트랜잭션이 롤백되면 발송 대상도 함께 사라진다

```python
# 커밋 안에서: 보낼 내용만 기록
with conn.transaction():
    create_order(...)
    insert_outbox(topic="order.created", payload=...)

# 별도 워커가 outbox를 읽어 실제로 발송
```

> [!note]+ Transactional Outbox: 테이블 하나로 만드는 설계 패턴
> - 구현은 애플리케이션 몫이다. 발송 대기 테이블과 그것을 읽어 보내는 워커를 직접 만든다
> - 필요한 것이 테이블과 트랜잭션뿐이라 PostgreSQL·MySQL·Oracle 어디서나 같게 만든다
> - 워커를 여러 대 띄우려면 `FOR UPDATE SKIP LOCKED`로 집어간다. 같은 행을 두 번 보내지 않는다
> - 발송에 성공하고 완료 표시를 남기기 전에 죽으면 다시 보낸다. 받는 쪽에서 중복을 걸러야 한다

---

### 6. DDL과 트랜잭션

스키마 변경을 트랜잭션으로 묶을 수 있는지가 DB마다 갈린다.

**PostgreSQL은 DDL도 롤백된다.**

```sql
BEGIN;
ALTER TABLE users ADD COLUMN phone text;
UPDATE users SET phone = '';
-- 여기서 실패하면
ROLLBACK;   -- 컬럼 추가까지 없던 일이 된다
```

마이그레이션 전체를 한 트랜잭션으로 묶으면 중간에 실패해도 되돌릴 수 있다. 끊긴 스키마가 남지 않는다.

**MySQL은 DDL이 암묵적 커밋을 일으킨다.**

[MySQL 문서](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html) 표현은 이렇다.

> implicitly end any transaction active in the current session, as if you had done a `COMMIT` before executing the statement

```sql
START TRANSACTION;
INSERT INTO users VALUES (...);     -- 아직 커밋 안 됨
ALTER TABLE users ADD COLUMN phone text;
-- 이 시점에 앞의 INSERT까지 함께 확정된다
ROLLBACK;                            -- 되돌릴 것이 없다
```

`CREATE`·`ALTER`·`DROP`·`TRUNCATE` 계열 전부가 해당한다. `GRANT`·`REVOKE` 같은 권한 문장과 `LOCK TABLES`도 마찬가지다.

> [!warning]+ 주의: MySQL에서 반쯤 적용된 마이그레이션
> - 마이그레이션이 중간에 실패하면 앞 단계는 확정되고 뒤는 안 된 상태로 멈춘다
> - 되돌리려면 역방향 스크립트를 직접 실행해야 한다. 자동 롤백이 없다
> - 그래서 MySQL 쪽 마이그레이션 도구는 단계를 잘게 쪼개고 각 단계를 멱등하게 만드는 방향으로 간다
> - `START TRANSACTION`과 `SET autocommit = 1` 자체도 암묵적 커밋을 일으킨다. 트랜잭션 안에서 다시 `START TRANSACTION`을 치면 앞의 것이 커밋된다

DDL이 잡는 락은 성격이 또 달라서 PostgreSQL에서도 `ALTER TABLE` 한 줄이 서비스를 멈출 수 있다.

---

### 7. ORM에서의 경계

ORM은 트랜잭션 경계를 숨긴다. 편하지만 어디서 열리고 닫히는지 모르면 앞의 함정을 그대로 밟는다.

#### flush와 commit은 다르다

```python
session.add(order)
session.flush()    # SQL이 실행됐다. 트랜잭션은 아직 열려 있다
                   # order.id는 채워진다. 다른 세션에서는 안 보인다
session.commit()   # 여기서 확정된다
```

`flush`는 파이썬 객체 상태를 SQL로 만들어 실행하는 동작이고 `commit`은 트랜잭션을 닫는 동작이다. 자동 생성된 ID가 필요해서 `flush`를 부르고는 커밋했다고 착각하는 경우가 있다.

#### 경계는 블록으로 지정한다

| 프레임워크          | 지정 방식                           |
| -------------- | ------------------------------- |
| SQLAlchemy     | `with session.begin():` 블록      |
| Django         | `with transaction.atomic():` 블록 |
| Django (요청 단위) | `ATOMIC_REQUESTS = True` 설정     |

`ATOMIC_REQUESTS`를 켜면 **요청 하나가 트랜잭션 하나**가 된다. 편하지만 트랜잭션 안에 외부 호출이 들어가는 문제가 그대로 발생한다.

> [!warning]+ 주의: 요청 단위 트랜잭션과 외부 호출
> - `ATOMIC_REQUESTS`가 켜진 상태에서 뷰 안에 결제 API 호출이 있으면 그 왕복 시간 내내 트랜잭션이 열려 있다
> - 외부 호출이 있는 뷰는 `non_atomic_requests`로 빼거나 호출을 커밋 이후로 옮긴다
> - 세션을 요청보다 오래 살려두면 커넥션이 풀로 돌아가지 않는다

---

### 8. 재시도 가능하게 만들기

트랜잭션이 실패하는 것 자체는 정상이다. 문제는 다시 돌렸을 때 같은 결과가 나오느냐다.

#### 재시도해도 되는 에러만 재시도한다

| SQLSTATE | 의미 | 재시도 |
| --- | --- | --- |
| `40001` | 직렬화 실패 | 한다 |
| `40P01` | 데드락 | 한다 |
| `23505` | 유니크 제약 위반 | 대개 무의미 |
| `23503` | 외래 키 위반 | 무의미 |
| `22P02` | 타입 변환 실패 | 무의미 |

앞의 둘은 **다시 하면 성공할 수 있는** 실패다. 뒤의 셋은 입력이 잘못된 것이라 몇 번을 돌려도 같다. 구분 없이 재시도 루프를 돌리면 잘못된 요청에 부하만 준다.

```python
RETRYABLE = {"40001", "40P01"}

for _ in range(3):
    try:
        with conn.transaction():
            do_work()
        break
    except psycopg.Error as e:
        if e.sqlstate not in RETRYABLE:
            raise          # 재시도해도 같은 결과인 에러는 바로 올린다
else:
    raise RuntimeError("재시도 한도 초과")
```

#### 재시도 범위는 트랜잭션 전체다

커밋만 다시 시도하는 것은 의미가 없다. 읽은 값 자체가 무효라서 **읽기부터 다시 해야 한다.** 그래서 재시도 루프가 트랜잭션 블록 바깥에 있어야 한다.

#### 부수 효과가 있으면 재시도가 위험해진다

앞서 본 부수 효과 문제와 이어진다. 트랜잭션 안에서 외부 API를 호출했다면 재시도할 때마다 그 호출이 반복된다.

```python
# 위험: 재시도할 때마다 결제가 다시 일어난다
with conn.transaction():
    charge_payment(...)      # 외부 호출
    create_order(...)

# 안전: 외부 호출은 밖에서 한 번만
payment_id = charge_payment(...)      # 멱등 키를 함께 보낸다

for _ in range(3):                    # 재시도해도 결제는 반복되지 않는다
    try:
        with conn.transaction():
            create_order(payment_id=payment_id)
        break
    except psycopg.Error as e:
        if e.sqlstate not in RETRYABLE:
            raise
```

**재시도를 전제로 설계하면 트랜잭션 안은 DB 작업만 남는다.** 외부 호출을 트랜잭션 밖으로 빼야 하는 이유가 하나 더 늘어난다.

[[Database Transactions - ACID and Isolation Levels#5. 격리 수준 네 단계|Serializable]]을 쓰면 재시도가 선택이 아니라 필수가 된다. 격리 수준을 올리기 전에 이 구조부터 갖춰둔다.
