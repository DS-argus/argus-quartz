---
tags:
  - database
  - cs
  - backend
  - postgresql
created: 2026-08-17T00:00:00
updated: 2026-09-18T12:58:12
permalink: /Dev/database/concurrency-control-mvcc-occ-and-locking
---

> [!abstract]+ TL;DR
> - 충돌하는 연산의 대상과 순서를 기준으로 locking, MVCC, OCC의 역할 구분
> - 2PL의 락 유지 시간과 predicate·range를 포함한 락 범위의 분리
> - PostgreSQL의 버전 가시성, 동시 UPDATE의 행 락, 애플리케이션 OCC 검증의 조합

> *AI-assisted*

---

### 1. 충돌은 쌍으로 나뉜다

[[Database Transactions - ACID and Isolation Levels#5. 격리 수준 네 단계|격리 수준]]은 허용할 이상 현상을 정한다. 동시성 제어는 트랜잭션 실행이 그 조건을 지키도록 조정한다.

충돌을 행위자 쌍으로 나눈 뒤 읽기와 쓰기의 순서를 구분한다.

#### 1단계: 행위자 기준

| 행위자 쌍 | 충돌 조건 | 처리할 문제 |
| --- | --- | --- |
| reader ↔ reader | 둘 다 값을 바꾸지 않음 | 일반적인 데이터 충돌 없음 |
| reader ↔ writer | 읽는 동안 값이나 대상 집합이 바뀜 | dirty read, non-repeatable read, phantom |
| writer ↔ writer | 같은 값을 함께 갱신함 | lost update, dirty write |

읽기끼리는 데이터를 바꾸지 않으므로 일반적인 읽기·쓰기 충돌을 만들지 않는다. 동시성 제어는 주로 reader↔writer와 writer↔writer 사이의 순서를 다룬다.

#### 2단계: 어느 쪽이 먼저인가

reader↔writer는 연산 순서에 따라 나타나는 문제가 달라진다.

| 연산 순서             | 조건                                  | 이상 현상                        |
| ----------------- | ----------------------------------- | ---------------------------- |
| **write → read**  | T2가 T1의 미커밋 값을 읽음                   | dirty read                   |
| **read → write**  | T1이 읽은 행이나 조건 범위를 T2가 바꾸고 T1이 다시 읽음 | non-repeatable read, phantom |
| **write → write** | 둘이 같은 이전 값을 바탕으로 갱신하고 한쪽 결과가 덮임     | lost update                  |

> [!note]+ 격리 수준과 이상 현상
> - Read Committed는 dirty read를 막는다
> - Repeatable Read는 같은 행을 다시 읽을 때 값이 바뀌는 non-repeatable read를 막는다
> - Serializable은 실행 결과가 어떤 직렬 실행과 같도록 제한한다
> - DBMS마다 같은 격리 수준을 구현하는 방법과 허용하는 세부 현상이 다를 수 있다

#### 수단마다 맡는 역할이 다르다

각 수단의 역할은 충돌하는 연산의 대기, 읽을 버전의 선택, 변경의 검증으로 나뉜다.

| 수단       | 주된 역할                        | 충돌 처리 위치      |
| -------- | ---------------------------- | ------------- |
| locking  | 충돌하는 연산을 대기시켜 실행 순서를 정함      | 연산 전이나 실행 중   |
| 다중 버전 저장 | 읽는 쪽에 필요한 옛 버전을 보존함          | 읽기 시점의 가시성 판정 |
| OCC      | 작업 뒤 읽은 값이나 기준 버전이 바뀌었는지 검증함 | 반영 직전         |

같은 행의 옛 버전과 새 버전을 보관해도 어떤 버전을 읽을지, 두 트랜잭션이 동시에 수정하면 어느 쪽을 기다리게 하거나 실패시킬지는 따로 정해야 한다. [MVCC 알고리즘](https://dsf.berkeley.edu/cs286/papers/bernstein-csur1981.pdf)은 버전 관리에 이런 규칙을 결합한다.

PostgreSQL에서 A가 잔액을 `1000`에서 `900`으로 바꾸고 아직 커밋하지 않았다고 하자.

- **B가 잔액을 조회**: 일반 `SELECT`는 A의 미커밋 값 `900`을 읽지 않는다. B의 스냅샷에 보이는 이전 버전이 `1000`이면 A의 커밋을 기다리지 않고 `1000`을 읽는다
- **B도 같은 잔액을 변경**: B의 `UPDATE`는 A의 트랜잭션이 끝날 때까지 기다린다. A가 커밋하면 Read Committed에서는 변경된 행이 `WHERE` 조건에 여전히 맞으면 그 행을 갱신한다. Repeatable Read에서는 B의 스냅샷 이후 A가 변경한 행이면 오류로 중단된다

> [!note]+ 읽기와 쓰기의 락: 테이블과 행의 구분
> - **일반 조회**: `SELECT`는 테이블 수준의 `ACCESS SHARE` 락을 잡는다. 이 락은 테이블 삭제 같은 작업과 충돌하지만 `UPDATE`의 테이블 락과는 함께 유지할 수 있다
> - **행 변경**: `UPDATE`는 변경하는 행에도 락을 잡는다. 일반 `SELECT`는 이 행 락을 요청하지 않으므로 조회와 변경은 서로를 기다리지 않는다. 같은 행을 변경하려는 다른 `UPDATE`는 기다린다
> - **잠금 조회**: `SELECT FOR UPDATE`처럼 명시적으로 행 락을 요청하는 조회는 일반 `SELECT`와 달리 대기할 수 있다

---

### 2. 비관적: 락으로 막는다
> 사용자들이 동시에 같은 데이터를 수정할 것이라고 가정

비관적 방식은 연산 전에 락을 잡아 같은 대상의 충돌하는 연산을 대기시킨다.
- **공유 락**(shared, S): 읽을 때 잡는다. 여러 트랜잭션이 동시에 잡을 수 있다
- **배타 락**(exclusive, X): 쓸 때 잡는다. 하나만 잡을 수 있고 같은 대상의 공유 락과도 공존하지 못한다

| 보유 중 \ 요청 | S 요청 | X 요청 |
| --------- | ---- | ---- |
| **S 보유**  | 허용   | 대기   |
| **X 보유**  | 대기   | 대기   |

같은 대상의 S/X락이 충돌하면 요청한 연산이 대기한다. 이 호환성 규칙에 락을 유지하는 시간과 잠그는 범위를 더해야 원하는 격리 수준을 만들 수 있다.

> [!note]+ 락의 단위: 행부터 테이블까지
> - 행 락은 서로 다른 행의 작업을 함께 실행할 수 있지만 락을 관리하는 비용이 든다
> - 일부 DBMS는 많은 행 락을 페이지나 테이블 락으로 승급한다
> - PostgreSQL은 행 락 정보를 튜플 헤더에 기록하며 행 락 수가 늘어도 테이블 락으로 승급하지 않는다
> - PostgreSQL의 [락 종류](https://www.postgresql.org/docs/current/explicit-locking.html)는 테이블 단위와 행 단위로 나뉜다

#### 2PL: 락을 언제 놓느냐

락 호환성만으로는 직렬성을 보장하지 못한다. 락을 잡았다 바로 놓는 작업을 반복하면 개별 충돌은 겹치지 않아도 전체 실행 결과가 직렬 실행과 달라질 수 있다.

두 값을 서로 다른 방향으로 복사하는 예를 본다. 초기값은 `A=1`, `B=2`다.

- **T1**: A를 읽어 B에 쓴다
- **T2**: B를 읽어 A에 쓴다

두 트랜잭션을 하나씩 실행하면 결과는 다음 둘 중 하나다.

| 직렬 순서 | 실행 | 결과 |
| --- | --- | --- |
| T1 → T2 | B=1로 바꾼 뒤 T2가 B를 읽어 A=1로 변경 | A=1, B=1 |
| T2 → T1 | A=2로 바꾼 뒤 T1이 A를 읽어 B=2로 변경 | A=2, B=2 |

락을 매 연산 직후 해제하며 교차 실행하면 다른 결과가 나온다.

```text
T1  S(A) r(A)=1 해제
T2                    S(B) r(B)=2 해제
T1                                     X(B) w(B)=1 해제
T2                                                      X(A) w(A)=2 해제

결과   A=2, B=1
```

두 트랜잭션은 모두 상대가 쓰기 전의 값을 읽어 계산했다. A의 충돌 순서는 T1→T2이고 B의 충돌 순서는 T2→T1이므로 하나의 직렬 순서로 설명할 수 없다.

**2PL**([two-phase locking](https://en.wikipedia.org/wiki/Two-phase_locking))은 락 획득과 해제 순서를 제한한다.

- **Expanding phase**: 락을 획득만 하고 해제하지 않는다
- **Shrinking phase**: 락을 해제만 하고 새 락을 획득하지 않는다

한 번이라도 락을 해제한 뒤에는 새 락을 획득할 수 없다. 위 예시에서 두 트랜잭션이 필요한 S락을 계속 보유하면 다음과 같이 상호 대기가 생긴다.

```text
T1  S(A) 획득 → r(A) → X(B) 요청 ··· 대기      B는 T2가 S락 보유 중
T2  S(B) 획득 → r(B) → X(A) 요청 ··· 대기      A는 T1이 S락 보유 중
```

DBMS는 이 순환을 데드락으로 감지하고 한쪽 트랜잭션을 중단한다. 중단된 작업을 다시 처리하려면 트랜잭션을 재시도한다.

> [!note]+ 락 호환성과 2PL의 역할
> - **S/X 호환성**: 같은 논리적 대상의 충돌하는 연산을 대기시킨다
> - **2단계 규칙**: 관련 논리적 대상을 모두 잠근 스케줄을 conflict serializable하게 만든다
> - **적용 주체**: 각 트랜잭션이 자신이 획득하고 해제하는 락에 규칙을 적용한다
> - **데드락**: 2PL도 서로 다른 순서로 락을 잡으면 순환이 생길 수 있다

> [!warning]+ 주의: 데드락 처리
> - T1이 A를 잡고 B를 기다리며 T2가 B를 잡고 A를 기다리면 둘 다 상대가 락을 해제하기를 기다린다
> - DBMS는 대기 그래프의 순환을 찾아 한쪽 트랜잭션을 중단한다
> - 자원을 같은 순서로 잠그면 이 형태의 순환을 피할 수 있다. 계좌 이체라면 `id`가 작은 계좌부터 잠근다
> - PostgreSQL은 `deadlock_timeout` 이후 데드락 검사를 시작한다

```text
     획득 ───────────►│◄─────────── 해제
                     │
  Expanding phase    │     Shrinking phase
                     │
                  lock point
```

**Lock point**는 트랜잭션이 마지막 락을 획득한 시점이다. 각 트랜잭션의 lock point 순서로 직렬 순서를 정할 수 있다. 관련된 모든 논리적 대상에 호환 락을 적용한 2PL 스케줄은 conflict serializable하다.

#### 행 락과 phantom

| 충돌 | 같은 행에 건 락의 처리 | 추가로 필요한 범위 |
| --- | --- | --- |
| write → write | X락끼리 충돌해 뒤쪽이 대기 | 같은 행 |
| write → read | X락과 S락이 충돌해 읽는 쪽이 대기 | 같은 행 |
| read → write | S락과 X락이 충돌해 쓰는 쪽이 대기 | 같은 행 또는 조건 범위 |

S락을 계속 보유하면 같은 행의 값이 바뀌는 것을 막는다. S락을 해제한 뒤 같은 행을 다시 읽으려면 새 S락이 필요하지만 shrinking phase에서는 새 락을 획득할 수 없다.

조건에 맞는 행 집합을 다시 읽는 경우에는 기존 행의 락만으로 부족하다.

```text
T1  SELECT count(*) WHERE age > 30   → 10건. 기존 10행에 S락
T2  INSERT age = 35                  → 기존 행 락과 충돌하지 않음
T1  SELECT count(*) WHERE age > 30   → 11건
```

T1이 기존 행의 S락을 계속 보유해도 새 행이 조건 범위에 들어올 수 있다. 행 락만 사용하면 이 phantom을 막지 못한다.

> [!note]+ phantom 방지: 조건 범위의 변경 처리
> - **predicate lock**: 조건이 가리키는 논리적 집합을 잠근다
> - **index range lock**: 인덱스 값 사이의 범위를 잠근다. MySQL InnoDB의 gap lock이 이 방식에 속한다
> - **SSI**: 읽은 범위를 기록하고 위험한 읽기·쓰기 의존을 감지한다. PostgreSQL Serializable이 이 방식을 쓴다
> - **구분 기준**: 2PL 변형은 락의 유지 시간을 정한다. phantom 방지는 어떤 논리적 범위까지 처리하는지에 달려 있다

#### 2PL 변형

| 변형 | 락 획득·해제 규칙 | 직렬성 | 데드락 | 복구 특성 |
| --- | --- | --- | --- | --- |
| 기본 2PL | lock point 이후 | conflict serializable | 생길 수 있음 | recoverable을 보장하지 않음 |
| Conservative 2PL | 필요한 락을 작업 전에 모두 획득 | conflict serializable | 락 획득 순환 없음 | 해제 규칙에 따라 달라짐 |
| Strict 2PL (S2PL) | X락을 커밋·롤백까지 유지 | conflict serializable | 생길 수 있음 | strict |
| Strong Strict 2PL (SS2PL) | S락과 X락을 커밋·롤백까지 유지 | conflict serializable | 생길 수 있음 | strict |

> [!note]+ recoverable과 strict
> - **recoverable**: 읽은 값을 만든 트랜잭션이 먼저 커밋한 뒤 이를 읽은 트랜잭션이 커밋한다
> - **cascadeless**: 커밋한 값만 읽어 연쇄 롤백을 피한다
> - **strict**: 다른 트랜잭션의 미커밋 값을 읽거나 덮어쓰지 않는다
> - 포함 관계는 `strict → cascadeless → recoverable`이다

- **Conservative 2PL**: 작업 전에 필요한 락 집합을 알아야 한다. 실행 중 필요한 대상이 달라지는 작업에는 적용하기 어렵다
- **Strict 2PL**: X락을 종료까지 유지해 미커밋 값을 다른 트랜잭션이 읽거나 덮어쓰지 못하게 한다
- **Strong Strict 2PL**: S락과 X락을 종료까지 유지한다. 커밋 순서가 serialization order와 일치한다

PostgreSQL의 `SELECT ... FOR UPDATE`가 획득한 행 락은 트랜잭션이 끝날 때까지 유지된다.

```sql
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;   -- 행 락 획득
UPDATE accounts SET balance = 500 WHERE id = 1;
COMMIT;                                            -- 행 락 해제
```

#### 락 기반 격리 수준

다음 표는 [Berenson 등의 논문](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/tr-95-51.pdf)의 락 기반 격리 수준 모델이다.

| 격리 수준 | write lock | data-item read lock | predicate read lock | 방지하는 현상 |
| --- | --- | --- | --- | --- |
| Read Uncommitted | 커밋·롤백까지 | 없음 | 없음 | dirty write |
| Read Committed | 커밋·롤백까지 | 읽는 동안 | 읽는 동안 | dirty read |
| Repeatable Read | 커밋·롤백까지 | 커밋·롤백까지 | 읽는 동안 | non-repeatable read |
| Serializable | 커밋·롤백까지 | 커밋·롤백까지 | 커밋·롤백까지 | phantom을 포함한 비직렬 실행 |

이 모델에서 Repeatable Read와 Serializable의 차이는 predicate read lock을 유지하는 시간이다. 실제 DBMS의 격리 수준은 MVCC, 락, 의존 추적을 조합해 구현할 수 있다.

---

### 3. MVCC: 읽기를 막지 않는다

**MVCC**(Multiversion Concurrency Control)는 읽는 쪽에 필요한 옛 버전을 보존하고 스냅샷에 맞는 버전을 선택한다. 버전을 저장하는 물리 방식은 DBMS마다 다르다.

PostgreSQL은 `UPDATE`할 때 옛 튜플을 남기고 새 튜플을 만든다.

| 버전 | balance | 상태 |
| --- | --- | --- |
| 버전 1 | 1000 | T10이 만들고 T20이 갱신 대상으로 표시 |
| 버전 2 | 500 | T20이 새로 만듦 |

읽는 쪽은 쿼리의 스냅샷에 보이는 버전을 고른다. PostgreSQL Read Committed는 문장마다 새 스냅샷을 사용한다. Repeatable Read와 Serializable은 `BEGIN` 뒤 첫 조회·변경 문장에서 얻은 스냅샷을 트랜잭션 동안 사용한다.

일반 조회와 갱신은 서로 다른 버전을 사용하므로 보통 서로 기다리지 않는다.

#### PostgreSQL의 구현

각 튜플에는 트랜잭션 ID를 기록하는 필드가 있다.

- `xmin`: 이 버전을 만든 트랜잭션 ID
- `xmax`: 이 버전을 지우거나 잠근 트랜잭션 ID. 아무도 손대지 않았으면 `0`

```sql
SELECT xmin, xmax, * FROM accounts WHERE id = 1;
```

SQL 문장마다 `xmin`과 `xmax`에 기록하는 값이 다르다.

| 문장 | xmin | xmax |
| --- | --- | --- |
| `INSERT` | 새 튜플에 자기 XID | 변경하지 않음 |
| `UPDATE` | 새 튜플에 자기 XID | 옛 튜플에 자기 XID |
| `DELETE` | 변경하지 않음 | 옛 튜플에 자기 XID |
| `SELECT ... FOR UPDATE` | 변경하지 않음 | 잠금 정보를 기록 |

`INSERT`는 새 튜플을 만든다. PostgreSQL의 `UPDATE`는 옛 튜플에 `xmax`를 기록하고 새 값을 가진 튜플을 추가한다.

> [!warning]+ 주의: `xmax`와 가시성
> - [PostgreSQL system columns](https://www.postgresql.org/docs/current/ddl-system-columns.html)은 보이는 튜플의 `xmax`도 0이 아닐 수 있다고 설명한다
> - `xmax`의 트랜잭션이 아직 커밋하지 않았거나 롤백했을 수 있다
> - 행 삭제가 아니라 행 잠금을 기록한 값일 수 있다
> - 가시성은 `xmax`의 값만으로 정하지 않고 트랜잭션 상태와 스냅샷을 함께 확인한다

> [!note]+ 행 락 정보의 저장 위치
> - PostgreSQL은 행 락 정보를 튜플 헤더의 `t_xmax`에 기록한다
> - 삭제와 잠금은 `t_infomask` 등의 상태 비트로 구분한다
> - `SELECT ... FOR UPDATE`도 대상 튜플에 잠금 정보를 기록할 수 있다
> - PostgreSQL은 행 락 수가 늘어도 테이블 락으로 승급하지 않는다

##### 튜플 필드와 트랜잭션 상태

튜플의 `xmin`과 `xmax`는 SQL 문장을 실행할 때 기록된다.

```sql
BEGIN;
UPDATE accounts SET balance = 500 WHERE id = 1;
-- 옛 튜플의 xmax와 새 튜플의 xmin에 현재 XID가 기록된다
COMMIT;
```

[`pg_xact`](https://www.postgresql.org/docs/current/storage-file-layout.html)는 트랜잭션의 커밋 상태를 저장한다. PostgreSQL은 커밋할 때 수정한 튜플마다 커밋 여부를 다시 기록하지 않고 트랜잭션 상태를 사용해 가시성을 판정한다. 커밋과 롤백의 전체 비용에는 WAL 기록과 락·자원 정리 비용도 포함된다.

| 위치 | 저장 내용 | 기록 시점 |
| --- | --- | --- |
| 튜플의 `xmin`·`xmax` | 튜플을 만든 XID와 삭제·잠금한 XID | 문장 실행 중 |
| `pg_xact` | 트랜잭션의 커밋 상태 | 커밋·롤백 처리 중 |

롤백한 트랜잭션이 만든 튜플은 조회 대상에서 제외되고 `VACUUM`으로 회수된다. InnoDB는 undo log를 역순으로 적용해 변경을 되돌린다.

> [!note]+ hint bit: 읽기가 페이지를 변경할 수 있다
> - 가시성을 확인한 backend는 트랜잭션 상태를 튜플의 hint bit에 기록할 수 있다
> - hint bit를 기록하면 조회 중에도 데이터 페이지가 dirty 상태가 될 수 있다
> - 데이터 checksum을 사용하거나 `wal_log_hints=on`이면 checkpoint 이후 페이지의 첫 변경에서 full-page image가 WAL에 기록될 수 있다
> - 조회 시간에는 hint bit 기록 비용 외에 캐시 상태와 동시에 실행 중인 작업도 영향을 준다

> [!warning]+ 주의: dead tuple과 VACUUM
> - 더는 보이지 않는 옛 버전을 dead tuple이라고 한다. 회수하지 않으면 디스크를 차지하고 스캔 비용에 영향을 줄 수 있다
> - [`VACUUM`](https://www.postgresql.org/docs/current/routine-vacuuming.html)이 재사용할 수 있는 공간으로 처리한다
> - 오래 유지한 스냅샷에 필요한 옛 버전은 `VACUUM`이 회수할 수 없다
> - 부풀음은 실제 크기와 예상 크기를 비교해 확인한다. 필요한 경우 `VACUUM FULL`이나 테이블 재작성을 검토한다
> - 참고 : https://techblog.woowahan.com/9478/ (PostgreSQL MVCC, Vacuum에 대해 정리된 매우 좋은 글)

#### reader↔writer 충돌

다른 트랜잭션이 만든 버전을 읽을 때는 스냅샷에 보이는 커밋 상태와 `xmin`·`xmax`를 함께 확인한다. 자신의 트랜잭션이 만든 미커밋 변경은 같은 트랜잭션 안에서 읽을 수 있다.

**write → read**: T20이 쓰는 동안 T21이 읽는 경우다. 초기값 `balance = 1000`은 T10이 만든 버전이다.

```text
T20 (쓰는 쪽)                  T21 (읽는 쪽)
-----------------------------  -----------------------------
BEGIN
UPDATE balance = 500
                               BEGIN
                               SELECT balance  --> 1000
ROLLBACK
                               SELECT balance  --> 1000
```

`UPDATE` 직후 행은 다음 상태다.

| 버전 | xmin | xmax | balance | 상태 |
| --- | --- | --- | --- | --- |
| 버전 1 | 10 | 20 | 1000 | T20이 갱신 대상으로 표시했으나 미커밋 |
| 버전 2 | 20 | - | 500 | T20이 만들었으나 미커밋 |

T21은 다른 트랜잭션의 미커밋 버전 2를 건너뛴다. 버전 1의 `xmax=20`도 미커밋이므로 버전 1을 아직 삭제되지 않은 것으로 판정하고 `1000`을 읽는다. T20이 롤백하면 버전 2는 이후 `VACUUM`의 회수 대상이 된다.

**read → write**: T30이 Repeatable Read에서 읽는 동안 T31이 쓰는 경우다.

```text
T30 (읽는 쪽, RR)              T31 (쓰는 쪽)
-----------------------------  -----------------------------
BEGIN
SELECT balance  --> 1000
                               BEGIN
                               UPDATE balance = 500
                               COMMIT
SELECT balance  --> 1000
COMMIT
SELECT balance  --> 500
```

T30은 첫 `SELECT`에서 스냅샷을 얻는다. 그 뒤 T31이 만들고 커밋한 버전은 T30의 스냅샷에 보이지 않으므로 T30의 두 번째 `SELECT`도 `1000`을 읽는다.

| 충돌 | 락 기반 읽기 | MVCC 읽기 |
| --- | --- | --- |
| write → read | 읽는 쪽이 같은 대상의 X락 앞에서 대기 | 보이는 옛 버전을 읽음 |
| read → write | 쓰는 쪽이 같은 대상의 S락 앞에서 대기 | 새 버전을 만들 수 있음 |

> [!note]+ PostgreSQL의 스냅샷 시점
> - **Read Committed**: 문장마다 새 스냅샷을 사용한다. 위 예시라면 T30의 두 번째 `SELECT`가 `500`을 읽는다
> - **Repeatable Read**: `BEGIN` 뒤 첫 조회·변경 문장에서 얻은 스냅샷을 트랜잭션 동안 사용한다
> - **Serializable**: Repeatable Read와 같은 스냅샷 규칙에 SSI의 의존 추적을 더한다
> - PostgreSQL에서는 다른 트랜잭션의 미커밋 변경을 읽지 않는다

> [!tip]+ psql 창 두 개로 재현
> ```sql
> -- 창 1
> BEGIN;
> UPDATE accounts SET balance = 500 WHERE id = 1;   -- 커밋하지 않고 둔다
>
> -- 창 2
> SELECT balance FROM accounts WHERE id = 1;        -- 즉시 응답. 옛 값
> SELECT xmin, xmax, balance FROM accounts WHERE id = 1;
> ```
> - 창 2가 기다리지 않는지 확인한다
> - `SELECT ... FOR UPDATE`로 바꾸면 조회한 행을 잠그므로 앞선 갱신의 행 락이 해제될 때까지 기다린다

#### writer↔writer 충돌 : PostgreSQL의 동시 UPDATE

다중 버전 저장만으로는 두 갱신의 순서를 정하지 못한다.

```text
T40                            T41
-----------------------------  -----------------------------
BEGIN
UPDATE balance = 500
                               BEGIN
                               UPDATE balance = 300
                                 ... 대기 ...
COMMIT
                               (재개)
```

PostgreSQL의 두 번째 `UPDATE`는 같은 행의 락이 해제될 때까지 기다린다. Read Committed에서는 대기 뒤 검색 조건을 다시 평가할 수 있고 Repeatable Read에서는 동시 변경 때문에 serialization failure가 날 수 있다.

#### DBMS별 옛 버전 저장 위치

| DBMS | 최신 버전 | 옛 버전 |
| --- | --- | --- |
| PostgreSQL | 새 튜플을 테이블에 추가 | 옛 튜플을 테이블에 유지 |
| MySQL InnoDB | 현재 레코드를 갱신 | undo log에 기록 |
| Oracle | 현재 레코드를 갱신 | undo segment에 기록 |

InnoDB와 Oracle은 undo 정보를 사용해 스냅샷에 필요한 옛 버전을 재구성한다. PostgreSQL은 테이블 안의 여러 튜플 버전에서 가시성 조건에 맞는 값을 고른다.

---

### 4. 낙관적: 작업 뒤 검증한다

> 사용자들이 동시에 같은 데이터를 수정하는 경우가 적을 것으로 가정

[Kung과 Robinson](https://www.eecs.harvard.edu/~htk/publication/1981-tods-kung-robinson.pdf)의 **OCC**(Optimistic Concurrency Control)는 트랜잭션 작업 중 공유 데이터에 락을 걸지 않고 반영 전에 충돌을 검증한다.

1. **읽기 단계**: 데이터를 읽고 계산한다. 결과는 로컬에 둔다
2. **검증 단계**: 읽은 데이터가 그사이 다른 작업과 충돌했는지 확인한다
3. **쓰기 단계**: 검증에 성공하면 결과를 반영한다

애플리케이션에서는 버전 컬럼과 조건부 `UPDATE`로 낙관적 동시성 제어를 구현할 수 있다.

```sql
-- 읽을 때 버전도 함께 가져온다
SELECT balance, version FROM accounts WHERE id = 1;   -- version = 3

-- 반영할 때 읽었던 버전이 유지됐는지 확인한다
UPDATE accounts SET balance = 500, version = 4
WHERE id = 1 AND version = 3;
-- 영향받은 행이 0이면 version이 바뀌었거나 대상 행이 없다
```

이 SQL을 PostgreSQL에서 실행하면 `UPDATE` 자체는 테이블 락과 행 락을 사용한다. 동시에 같은 행을 갱신하면 대기한 뒤 `version = 3` 조건을 다시 평가해 영향받은 행이 0이 될 수 있다. 호출자는 행 수를 확인하고 재시도하거나 충돌로 처리한다.

ORM에서는 이를 **낙관적 잠금**이라고 부른다. Hibernate와 JPA의 `@Version`은 같은 형태의 조건부 갱신을 만든다.

> [!note]+ CAS: 값을 비교한 뒤 변경
> - compare-and-swap은 현재 값이 예상값과 같을 때만 새 값으로 바꾸는 원자적 연산이다
> - CPU의 [`CMPXCHG`](https://www.felixcloutier.com/x86/cmpxchg), SQL의 조건부 `UPDATE`, HTTP의 `If-Match`는 서로 다른 계층에서 같은 비교 후 변경 구조를 사용한다
> - 위 SQL은 값 대신 `version`을 비교 조건으로 쓴다

^57a45b

> [!warning]+ 주의: 조건부 갱신의 실패 처리
> - 영향받은 행이 0이면 갱신이 반영되지 않았다
> - 행 수를 확인하지 않으면 애플리케이션이 실패한 갱신을 성공으로 처리할 수 있다
> - 재시도 여부와 횟수는 작업의 멱등성, 충돌 빈도, 사용자 응답 정책을 기준으로 정한다
> - 버전 컬럼 방식을 lock-based DB에서 실행하면 다른 락과의 대기나 multi-resource deadlock이 생길 수 있다

---

### 5. 실제 시스템의 조합

실제 구현은 버전 가시성, 락, 충돌 검증을 용도에 따라 조합한다.

#### PostgreSQL

| 충돌 | 기본 처리 |
| --- | --- |
| reader ↔ writer | 일반 `SELECT`는 row lock 없이 스냅샷에 보이는 버전을 읽음 |
| writer ↔ writer | 같은 행의 뒤쪽 `UPDATE`가 행 락에서 대기한 뒤 격리 수준에 맞게 처리됨 |

일반 `SELECT`도 `ACCESS SHARE` relation lock은 획득한다. 이 락은 일반적인 `UPDATE`의 relation lock과 호환되므로 reader↔writer 대기를 만들지 않는다.

| 격리 수준 | PostgreSQL의 추가 규칙 |
| --- | --- |
| Read Committed (기본) | 문장마다 새 스냅샷을 사용 |
| Repeatable Read | 첫 조회·변경 문장에서 얻은 스냅샷을 트랜잭션 동안 사용 |
| Serializable | 같은 스냅샷 규칙에 SSI 의존 추적을 추가 |

위 표의 축은 격리 수준이다. 앞 표의 축은 충돌 쌍이다.

> [!note]+ SSI의 `SIReadLock`
> - 이름에 lock이 있지만 다른 트랜잭션을 대기시키지 않는다
> - PostgreSQL은 읽은 범위와 읽기·쓰기 의존을 추적하는 표식으로 사용한다
> - 위험한 의존 구조를 감지하면 트랜잭션 하나를 serialization failure로 중단한다
> - 호출자는 중단된 작업을 재시도하거나 실패로 처리한다

#### 객체 스토리지 위의 테이블 포맷

테이블 포맷은 객체 스토리지에 스냅샷 선택과 동시 커밋 검증을 추가한다. 다음 표는 각 포맷의 스냅샷 선택과 동시 쓰기 처리 예시다.

| 포맷 | reader↔writer | writer↔writer의 대표 처리 |
| --- | --- | --- |
| Iceberg | 커밋된 스냅샷을 선택 | 카탈로그에서 현재 메타데이터 포인터를 조건부 교체 |
| Delta Lake | 버전별 transaction log를 읽음 | 다음 로그 버전 커밋을 검증하고 충돌 시 작업에 따라 재시도 |
| Hudi | 타임라인의 완료된 instant를 읽음 | multi-writer OCC 모드에서 lock provider와 충돌 검증을 사용 |

Hudi에서 한 프로세스의 writer와 async table service를 조정할 때는 `InProcessLockProvider`를 사용할 수 있다. 구현과 운영 설정은 [[Open Table Formats - Iceberg vs Delta Lake vs Hudi|테이블 포맷]]에서 다룬다.

---

### 6. 선택 기준

비관적 방식과 낙관적 방식은 충돌 빈도와 충돌 뒤 처리 비용을 함께 비교한다. 애플리케이션의 버전 컬럼 OCC도 DB 내부에서는 락을 사용할 수 있으므로 두 방식을 락의 유무만으로 나누지 않는다.

| 비교 항목 | 비관적 방식 | 낙관적 방식 |
| --- | --- | --- |
| 순서를 정하는 시점 | 작업 전이나 실행 중 | 결과 반영 전 검증 시점 |
| 충돌 처리 | 대기하거나 트랜잭션 중단 | 검증 실패 후 작업별 정책 적용 |
| 평상시 비용 | 락 획득과 관리 | 버전·검증 정보 관리 |
| 실패 가능성 | 데드락, timeout, serialization failure 등 | 검증 실패, starvation, DB 락 관련 실패 등 |
| 재처리 비용 | 중단된 트랜잭션 범위 | 검증 전에 수행한 계산과 I/O 범위 |

- **같은 행의 갱신이 자주 겹치는 작업**: 재시도 비용과 락 대기 시간을 측정해 비관적 방식을 우선 검토한다
- **갱신 대상이 넓게 분산된 작업**: 충돌이 드물고 재계산이 저렴하면 낙관적 검증을 우선 검토한다
- **읽기가 많은 워크로드**: MVCC는 reader↔writer 대기를 줄이지만 쓰기 충돌과 격리 수준의 문제는 별도로 처리한다
- **조건을 읽고 여러 행을 갱신하는 작업**: 개별 행 충돌과 함께 predicate 범위의 일관성이 필요한지 확인한다

선택할 때는 충돌률, 평균·최대 대기 시간, 재시도 횟수, 한 번의 재처리 범위를 측정한다. 같은 충돌률이어도 검증 전에 많은 데이터를 읽거나 계산했다면 재처리 비용이 커진다.
