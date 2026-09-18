---
tags:
  - database
  - cs
  - backend
  - postgresql
created: 2026-08-17T00:00:00
updated: 2026-08-17T00:00:00
permalink: /Dev/database/database-transactions-acid-and-isolation-levels
---

> [!abstract]+ TL;DR
> - ACID 네 글자 중 등급이 있는 것은 I뿐. 나머지 셋은 켜고 끄는 대상이 아님
> - 격리 수준은 이름이 아니라 어떤 이상 현상이 막히는지로 판단. DB마다 실제 동작이 다름
> - Serializable은 감지만 자동. 재시도와 격리 수준 통일은 애플리케이션 몫

> *AI-assisted*

---

### 1. 트랜잭션이 푸는 문제

계좌 이체는 출금과 입금 두 번의 쓰기를 묶어야 한다.

```sql
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;  -- 출금
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;  -- 입금
```

두 문장 사이에서 프로세스가 죽으면 돈이 사라진다. 출금은 반영됐고 입금은 안 됐는데 되돌릴 방법이 없다.

**트랜잭션은 여러 문장을 하나의 단위로 묶어 전부 반영되거나 전부 취소되게 하는 장치다.** 절반만 적용된 중간 상태를 밖에서 볼 수 없게 만든다.

```sql
BEGIN;                                   -- 여기서 열린다
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;                                  -- 여기서 확정된다
```

경계를 만드는 문장은 셋이다. `BEGIN`으로 열고 `COMMIT`으로 확정하고 `ROLLBACK`으로 되돌린다.

#### 확정은 커밋뿐이다

`ROLLBACK`을 직접 치는 경우는 오히려 드물다. **커밋하지 않은 트랜잭션은 어떤 경로로 끝나든 롤백된다.**

- 애플리케이션이 예외를 던지고 빠져나가면 커밋에 도달하지 못하므로 롤백된다
- 커넥션이 끊기면 서버가 그 세션의 열린 트랜잭션을 롤백한다
- 서버가 죽으면 재시작할 때 WAL을 보고 커밋 안 된 것을 되돌린다

그래서 기본 상태는 "취소"이고 커밋만이 확정이다. 경계 설계와 재시도는 이 성질을 전제로 한다.

> [!warning]+ 주의: 롤백은 DB 안까지만 되돌린다
> - 외부 API 호출, 큐 발행, 메일 발송, 파일 쓰기는 롤백을 따르지 않는다
> - 시퀀스로 뽑은 번호도 돌아오지 않는다. `ROLLBACK` 후에도 다음 값은 그다음 번호다
> - 트랜잭션 안에 DB 작업만 두어야 하는 이유가 여기 있다

ACID는 트랜잭션이 지켜주는 성질 네 가지를 묶은 약자다.

---

### 2. A · C · I · D

각 글자가 막는 상황이 다르다.

| | 이름 | 막는 상황 | 담당 |
| --- | --- | --- | --- |
| **A** | Atomicity | 절반만 반영된 상태 | DB |
| **C** | Consistency | 제약을 어긴 상태 | DB + 애플리케이션 |
| **I** | Isolation | 남의 작업 중간이 보이는 상태 | DB |
| **D** | Durability | 커밋했는데 사라지는 상태 | DB |

- **Atomicity**: 트랜잭션 안의 문장이 전부 성공하거나 전부 취소된다. 중간 지점이 남지 않는다
- **Consistency**: 트랜잭션 전후로 제약 조건이 깨지지 않는다. `NOT NULL`, `FOREIGN KEY`, `CHECK`가 여기 해당한다
- **Isolation**: 동시에 도는 트랜잭션이 서로의 중간 상태를 보지 않는다
- **Durability**: 커밋했다고 응답했으면 그 직후 정전이 나도 데이터가 남는다

> [!note]+ C는 나머지 셋과 성격이 다르다
> - A·I·D는 DB가 알아서 지킨다. C는 절반이 애플리케이션 몫이다
> - "계좌 잔액의 총합이 변하지 않는다" 같은 규칙은 DB가 모른다. 개발자가 두 UPDATE를 한 트랜잭션에 넣어야 지켜진다
> - DB가 보장하는 C는 선언한 제약 조건까지다
> - 그래서 C를 두고 "약자(ACID)를 만들려고 끼워 넣은 글자"라는 평이 따라다닌다. 실제로 A와 D가 있으면 대부분 따라오는 성질이다

> [!note]+ Durability: 어디까지 썼을 때 커밋인가
> - 커밋 시점에 데이터 파일을 고치지 않는다. **WAL**(Write-Ahead Log)에 변경 내역을 먼저 적고 `fsync`로 디스크에 밀어 넣는다
> - 데이터 파일 반영은 나중에 몰아서 한다. 순차 쓰기 한 번이 임의 위치 쓰기 여러 번보다 빠르기 때문이다
> - 죽었다 살아나면 WAL을 재생해 복구한다
> - `fsync = off`로 두면 커밋이 빨라지는 대신 D를 포기한다. 재현 가능한 배치 적재가 아니면 켜둔다

---

### 3. I만 등급이 있는 이유

A와 D는 지키거나 안 지키거나 둘 중 하나다. 절반만 원자적인 트랜잭션은 없다.

**I는 다르다.** 완벽한 격리는 트랜잭션을 한 줄로 세워 하나씩 실행하는 것인데 그러면 동시 처리량이 사라진다.

- **완벽한 격리**: T1 끝 → T2 시작 → T3 시작. 안전하지만 느리다
- **느슨한 격리**: T1 T2 T3 동시 진행. 빠르지만 이상한 값이 보인다

그래서 격리만 **어디까지 허용할지 고르는 손잡이**가 됐다.

---

### 4. 세 가지 이상 현상

격리를 느슨하게 하면 나타나는 현상에 이름이 붙어 있다. 격리 수준은 이 셋 중 무엇을 막느냐로 정의된다.

#### Dirty Read: 커밋 안 된 값을 읽는다

```text
T1                        T2
------------------------  ------------------------
UPDATE balance = 500
                          SELECT balance  --> 500
ROLLBACK
```

T2가 읽은 500은 한 번도 확정된 적 없는 값이다.

#### Non-Repeatable Read: 같은 행을 두 번 읽었는데 값이 다르다

```text
T1                        T2
------------------------  ------------------------
SELECT balance  --> 1000
                          UPDATE balance = 500
                          COMMIT
SELECT balance  --> 500
```

T1은 아무것도 안 했는데 같은 질문의 답이 바뀌었다.

#### Phantom Read: 같은 조건으로 두 번 조회했는데 행 개수가 다르다

```text
T1                             T2
-----------------------------  -----------------------------
SELECT count(*) WHERE age > 30
  --> 10
                               INSERT age = 35
                               COMMIT
SELECT count(*) WHERE age > 30
  --> 11
```

없던 행이 나타났다. 대상은 특정 행이 아니라 조건에 맞는 집합이다.

> [!note]+ Non-Repeatable Read와 Phantom의 차이
> - **Non-repeatable read**: 이미 읽은 **행의 값**이 바뀐다. 대상이 특정 행이다
> - **Phantom**: 조건에 맞는 **행의 집합**이 바뀐다. 대상이 범위다
> - 막는 방법도 다르다. 앞은 읽은 행에 락을 걸면 되지만 뒤는 아직 존재하지 않는 행이라 걸 대상이 없다. 그래서 범위 자체에 락을 걸거나 스냅샷을 고정해야 한다

---

### 5. 격리 수준 네 단계

[ANSI SQL-92](https://www.postgresql.org/docs/current/transaction-iso.html)가 네 단계를 정의했다. 위로 갈수록 느슨하고 아래로 갈수록 엄격하다.

| 수준 | Dirty Read | Non-Repeatable Read | Phantom |
| --- | --- | --- | --- |
| Read Uncommitted | 허용 | 허용 | 허용 |
| Read Committed | 방지 | 허용 | 허용 |
| Repeatable Read | 방지 | 방지 | 허용 |
| Serializable | 방지 | 방지 | 방지 |

- **Read Uncommitted**: 커밋 전 값까지 보인다. 쓰는 곳이 거의 없다
- **Read Committed**: 커밋된 값만 읽는다. 문장 하나마다 최신 스냅샷을 새로 뜬다
- **Repeatable Read**: 트랜잭션 시작 시점의 스냅샷을 끝까지 유지한다
- **Serializable**: 트랜잭션을 하나씩 실행한 것과 같은 결과를 보장한다

표는 **금지 목록이 아니라 허용 목록**이다. 표준은 "이 수준에서 이 현상이 일어날 수 있다"고 정할 뿐이라 더 엄격하게 구현해도 규격 위반이 아니다. 실제 DB가 이 여지를 쓴다.

---

### 6. 이름과 실제 동작이 다르다

같은 `REPEATABLE READ`를 걸어도 DB마다 결과가 다르다.

| | 기본값 | 특이사항 |
| --- | --- | --- |
| PostgreSQL | Read Committed | Read Uncommitted를 요청해도 Read Committed로 동작. Repeatable Read에서 phantom도 막힘 |
| MySQL InnoDB | [Repeatable Read](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html) | gap lock으로 phantom을 대체로 막음 |
| Oracle | Read Committed | Read Uncommitted와 Repeatable Read를 아예 지원하지 않음 |
| SQL Server | Read Committed | 옵션으로 스냅샷 기반 동작 전환 |

PostgreSQL의 Repeatable Read는 표준이 요구하는 것보다 엄격하다. 트랜잭션 시작 시점 스냅샷을 끝까지 유지하는 방식이라 phantom까지 함께 막힌다.

```sql
-- 세션 단위로 지정
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- 트랜잭션 하나에만 지정
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT ...;
COMMIT;
```

> [!warning]+ 주의: 수준 이름으로 판단하지 않는다
> - 이식성 있는 코드를 쓰려면 이름이 아니라 "어떤 이상 현상이 막히는가"를 확인한다
> - MySQL에서 돌던 배치를 PostgreSQL로 옮겼는데 결과가 달라지는 일이 여기서 생긴다
> - 특히 Repeatable Read는 두 DB의 동작 차이가 크다

---

### 7. 표준에 없는 이상 현상

ANSI가 정의한 셋으로는 부족하다는 지적이 [1995년 논문](https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/)에서 나왔다. 대표가 **write skew**다.

병원에 당직 의사가 최소 한 명은 있어야 한다고 하자. 지금 두 명이 당직이다.

```text
T1 (doctor A)                  T2 (doctor B)
-----------------------------  -----------------------------
SELECT count(*) WHERE on_call  SELECT count(*) WHERE on_call
  --> 2, so I can leave          --> 2, so I can leave
UPDATE a SET on_call = false
                               UPDATE b SET on_call = false
COMMIT
                               COMMIT
```

당직이 0명이 됐다. 두 트랜잭션 모두 규칙을 확인하고 어겼다.

같은 행을 고치지 않아서 충돌로 감지되지 않는다. Repeatable Read에서도 그대로 일어난다.

PostgreSQL은 Serializable에서 **SSI**(Serializable Snapshot Isolation)로 이를 잡는다.

```text
ERROR:  could not serialize access due to read/write dependencies among transactions
HINT:  The transaction might succeed if retried.
```

> [!tip]+ Serializable이 필요한 자리
> - "조건을 확인하고 그 결과에 따라 쓴다"가 한 트랜잭션 안에 있을 때다. 당직 예시, 재고 확인 후 차감, 중복 예약 방지가 여기 해당한다
> - 조건 검사 없이 값만 갱신하는 작업은 Read Committed로 충분하다

---

### 8. Serializable은 걸어두는 것으로 끝나지 않는다

**감지는 DB가 전부 하고 실패 처리는 애플리케이션이 전부 한다.**

`SELECT FOR UPDATE`는 걸어두면 끝이다. 기다렸다가 결국 성공한다. Serializable은 반대로 걸어두는 것이 시작이고 에러를 받아줄 코드가 없으면 갱신이 조용히 사라진다.

#### 읽은 자리를 표시해두고 남이 썼는지만 본다

```sql
SELECT count(*) FROM doctors WHERE on_call = true;
-- 조건에 걸린 인덱스 페이지와 튜플에 SIReadLock 표시가 남는다
```

`SIReadLock`은 이름이 락이지만 아무도 막지 않는다. "내가 이걸 읽었다"는 흔적일 뿐이다. `pg_locks`에서 확인할 수 있다.

```sql
SELECT locktype, relation::regclass, mode
FROM pg_locks WHERE mode = 'SIReadLock';
```

이후 다른 트랜잭션이 그 자리에 쓰면 읽기·쓰기 의존이 하나 기록된다. 이 의존이 특정 형태로 맞물리면 직렬 순서가 존재할 수 없다고 판정해 한쪽을 취소한다.

#### 개발자 몫 세 가지

**재시도 코드를 붙인다**

트랜잭션 **전체를 다시 실행**해야 한다. 커밋만 다시 시도하는 것은 의미가 없다. 읽은 값 자체가 무효라서다.

```python
for _ in range(3):
    try:
        with conn.transaction():          # ISOLATION LEVEL SERIALIZABLE
            if count_on_call() >= 2:
                set_off_duty(me)
        break
    except psycopg.errors.SerializationFailure:   # SQLSTATE 40001
        continue
else:
    raise RuntimeError("재시도 한도 초과")
```

재시도 대상 에러 구분과 부수 효과 처리는 [[Transaction Boundaries and Pitfalls|재시도 가능한 트랜잭션 설계]]에서 다룬다.

**참여하는 트랜잭션을 전부 Serializable로 맞춘다**

가장 자주 놓치는 부분이다. 보장 범위가 "커밋에 성공한 Serializable 트랜잭션 사이"로 한정된다.

```text
T1  SERIALIZABLE      SIReadLock을 남긴다   --> 추적 대상
T2  READ COMMITTED    흔적을 안 남긴다      --> 추적 대상 아님
```

T2가 규칙을 깨도 T1은 알지 못한다. 같은 테이블을 건드리는 경로가 여럿이면 배치 하나까지 전부 맞춰야 한다.

**커밋 전에 읽은 값을 밖으로 내보내지 않는다**

Serializable에서는 취소와 재시도가 정상 흐름이다. 트랜잭션 중간에 읽은 값으로 외부 API를 호출하면 취소된 시도의 호출도 밖에 남고 재시도 횟수만큼 같은 호출이 반복된다. 외부로 나가는 동작은 커밋 이후로 미룬다.

#### 자동이라서 치르는 대가

SSI는 보수적이다. 진짜 충돌인지 끝까지 따지는 대신 위험해 보이면 자른다. **실제로는 문제없었을 트랜잭션도 취소된다.**

> [!warning]+ 주의: 순차 스캔이 거짓 양성을 키운다
> - 인덱스를 못 타면 테이블 전체에 관계 수준 predicate lock이 걸려 무관한 트랜잭션까지 충돌한다. 인덱스를 타면 페이지나 튜플 단위로 좁혀진다
> - predicate lock 테이블이 메모리에 모자라도 같은 일이 생긴다. 페이지 단위 락을 관계 단위로 합치면서 충돌 범위가 넓어진다
> - `max_pred_locks_per_transaction`, `max_pred_locks_per_relation`, `max_pred_locks_per_page`로 한도를 올린다
> - 유니크 제약을 미리 확인하고 넣었는데도 위반이 나는 경우가 있다. PostgreSQL 문서에 적힌 거짓 양성이다

읽기만 하는 트랜잭션은 `READ ONLY`를 붙인다. predicate lock을 대부분 남기지 않아 부담이 줄어든다.

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY;
```

---

### 9. 격리를 실제로 구현하는 방법

지금까지는 **무엇을 보장하는가**였다. **어떻게 만들어내는가**는 별개 문제다.

```text
격리 수준        무엇을 보장할지 정하는 계약
    ↓
동시성 제어      그 계약을 지키는 수단
                 locking · MVCC · OCC
```

Read Committed 하나를 만드는 데도 방법이 갈린다. 읽는 행마다 락을 걸어 커밋 전 값에 접근을 막는 방법이 있고 버전을 여러 개 유지해 커밋된 버전만 보여주는 방법이 있다. 앞이 locking이고 뒤가 MVCC다.

[[Concurrency Control - MVCC, OCC, and Locking|동시성 제어]]에서 세 방식을 다룬다.
