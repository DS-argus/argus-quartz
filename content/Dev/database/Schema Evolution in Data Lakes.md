---
tags:
  - data_engineering
  - Data
  - architecture
  - etl
  - kafka
created: 2026-08-12T00:00:00
updated: 2026-08-12T00:00:00
permalink: /Dev/database/schema-evolution-in-data-lakes
---

> [!abstract]+ TL;DR
> - 데이터 레이크는 파일을 고치지 않으므로 스키마가 다른 파일이 한 테이블에 공존
> - 판단 기준은 호환성 방향. backward는 컨슈머 먼저, forward는 프로듀서 먼저 배포
> - 컬럼 이름 변경과 타입 변경이 위험 구간. 파일 포맷만으로는 못 풀고 테이블 포맷의 field-id가 필요

> *AI-assisted*

---

### 1. 스키마는 계속 바뀐다

테이블을 한 번 설계하고 끝나는 경우는 없고 바뀌는 이유도 대체로 셋으로 좁혀진다.

- **신규 지표 요구**: 마케팅에서 유입 채널별 분석을 요청하면 `utm_source` 컬럼이 붙는다
- **소스 시스템 변경**: 상류 서비스가 `user_name`을 `first_name`과 `last_name`으로 쪼개면 그대로 따라온다
- **CDC로 들어오는 DDL**: 운영 DB에서 `ALTER TABLE`이 실행되면 변경 이벤트가 파이프라인으로 흘러온다

운영 DB라면 `ALTER TABLE`로 끝날 일인데 데이터 레이크에서는 아래 이유로 사정이 다르다.

- **스키마가 흩어져 있다**: DB는 카탈로그에 스키마 정의가 하나뿐이고 데이터 파일도 DB 프로세스만 만진다. 레이크는 파일마다 자기 스키마를 품고 있어 고칠 대상이 수십만 개다
- **원자성이 없다**: DB의 DDL은 락을 걸고 커밋하므로 중간 상태가 노출되지 않는다. 파일 10만 개를 다시 쓰는 도중에 누가 조회하면 절반은 옛 스키마 절반은 새 스키마인 상태가 그대로 보인다
- **쓰는 주체가 여럿이다**: DB는 단일 진입점이다. 레이크의 같은 경로에는 Spark 배치, Flink 스트리밍, 다른 팀 job이 각자 쓴다. "지금부터 새 스키마로 쓰세요"를 강제할 주체가 없다

---

### 2. 파일을 고치지 않기 때문에 생기는 문제

배치가 돌 때마다 테이블에 파일이 쌓이고 각 파일에는 그때의 스키마가 박혀 있다.

```text
s3://lake/orders/
  dt=2024-03-01/part-0.parquet    id, user_name, amount
  dt=2024-03-02/part-0.parquet    id, user_name, amount
  ...
  dt=2026-08-01/part-0.parquet    id, user_name, amount, country   ← 컬럼 추가
  dt=2026-08-02/part-0.parquet    id, user_name, amount, country
```

컬럼을 추가했다고 2024년 파일을 다시 쓰지는 않는다.

- **재작성 비용**: 페타바이트를 다시 쓰려면 시간과 컴퓨트가 그만큼 든다
- **객체 스토리지 제약**: S3 객체는 부분 수정이 안 된다. 통째로 덮어쓰는 것만 가능하다
- **읽는 쪽이 여럿**: 대시보드, ML 파이프라인, 리버스 ETL이 각자 다른 시점에 배포된다. 모두를 한 번에 맞출 수 없다

그래서 **한 테이블 안에 스키마가 다른 파일이 공존하는 상태**를 전제로 설계한다. 읽는 시점에 차이를 흡수하는 규칙이 스키마 진화다.

> [!note]+ writer schema와 reader schema
> - **writer schema**: 그 파일을 만들 때 쓴 스키마. 파일에 박혀 바뀌지 않는다
> - **reader schema**: 지금 읽는 코드가 기대하는 스키마
> - 둘이 어긋난 자리를 어떻게 메울지가 스키마 진화의 실체이고 파일이 불변이므로 맞추는 일은 항상 읽는 쪽에서 일어난다

---

### 3. 호환성 방향

스키마 변경을 승인할지 판단하는 기준으로, 두 방향이 있다.

```text
backward   새 스키마로 옛 데이터를 읽을 수 있다
           v2 코드 → v1 데이터 ✓

forward    옛 스키마로 새 데이터를 읽을 수 있다
           v1 코드 → v2 데이터 ✓

full       양방향 모두
```

데이터를 쓰는 쪽과 읽는 쪽을 같은 순간에 배포할 수는 없다. 어느 쪽을 먼저 올려도 안 깨지는지를 호환성 방향이 정한다.

- **backward만 보장**: 읽는 쪽(컨슈머, downstream job)을 먼저 배포한다. 새 코드가 옛 데이터를 읽을 수 있으므로 그사이 들어오는 옛 데이터도 처리된다
- **forward만 보장**: 쓰는 쪽(프로듀서, ingestion job)을 먼저 배포한다. 옛 코드가 새 데이터의 모르는 필드를 무시하고 읽는다
- **full**: 순서를 신경 쓰지 않아도 된다. 대신 허용되는 스키마 변경이 좁아진다

기본값으로 backward를 두는 곳이 많다. 분석 파이프라인에서는 과거 데이터를 다시 읽는 일이 잦아서 새 코드가 옛 데이터를 처리하지 못하면 곧바로 장애가 된다.

> [!tip]+ 방향 이름이 헷갈릴 때
> - 이름은 **새 스키마 기준**이다. backward는 "뒤쪽(옛 데이터)을 향해 호환된다"는 뜻이다
> - 판단할 때는 이름 대신 "누가 먼저 배포되어야 안 깨지나"를 물으면 빠르다
> - backward면 컨슈머 먼저, forward면 프로듀서 먼저다

---

### 4. 변경 유형별 안전도

| 변경                     | backward                    | forward        | 옛 파일 읽기 결과            |
| ---------------------- | --------------------------- | -------------- | --------------------- |
| 기본값 있는 컬럼 추가           | 안전                          | 안전             | 옛 파일은 기본값으로 채워짐       |
| 기본값 없는 컬럼 추가           | 깨짐                          | 안전             | 옛 파일에서 값을 만들 방법이 없음   |
| 컬럼 삭제                  | 안전                          | 기본값이 있던 필드면 안전 | 새 코드가 안 읽으므로 무해       |
| 컬럼 이름 변경               | `aliases`나 field-id가 있으면 안전 | 깨짐             | 대응 수단이 없으면 조용히 `null` |
| 타입 확장 (`int`→`long`)   | 안전                          | 깨짐             | 넓은 타입이 좁은 값을 담음       |
| 타입 축소 (`long`→`int`)   | 깨짐                          | 안전             | 새 코드가 옛 값을 담지 못해 예외   |
| 타입 변경 (`int`→`string`) | 깨짐                          | 깨짐             | reader가 예외를 던짐            |
| 컬럼 순서 변경               | 안전                          | 안전             | 이름으로 매칭하므로 무관         |

두 구간이 실무에서 사고를 낸다.

**컬럼 이름 변경**은 대응 수단이 없으면 에러 없이 틀린 결과를 낸다.

```sql
-- user_name을 customer_name으로 바꾸고 새 파일부터 그 이름으로 저장한 뒤
SELECT customer_name, count(*) FROM orders GROUP BY 1;
-- 2024~2025 구간이 전부 null 한 줄로 뭉친다
```

reader는 "요청한 컬럼이 이 파일에 없다"고 판단해 `null`을 돌려준다. 예외가 발생하지 않으니 집계 숫자만 조용히 어긋난다.

**타입 변경**은 그 자리에서 실패한다. `amount`를 `INT`로 쌓다가 `STRING`으로 바꾸면 옛 파일의 4바이트 정수를 문자열로 해석할 방법이 없다.

```
Parquet column cannot be converted in file s3://lake/orders/dt=2024-03-01/part-0.parquet
Column: [amount], Expected: string, Found: INT32
```

> [!warning]+ 주의: 에러보다 조용한 null이 위험하다
> - 타입 변경은 파이프라인이 멈추므로 곧바로 발견된다
> - 이름 변경은 아무 신호가 없다. 대시보드 숫자가 줄어든 것을 누군가 알아챌 때까지 방치된다
> - 스키마를 바꾼 뒤에는 과거 구간을 샘플링해 `null` 비율을 확인한다

---

### 5. 파일 포맷 관점

[[Storage File Formats - Parquet vs ORC vs Avro|파일 포맷]]마다 대응 범위가 다르다.

**Avro**는 규격에 매칭 규칙을 넣었다. 파일 헤더에 writer schema가 들어 있고 읽는 쪽이 reader schema를 따로 넘기면 둘을 대조해 해석한다.

```json
{
  "name": "country",
  "type": "string",
  "default": "UNKNOWN"
}
```

```json
{
  "name": "customer_name",
  "type": "string",
  "aliases": ["user_name"]
}
```

- **`default`**: 옛 파일에 없는 필드를 이 값으로 채운다. backward 호환의 핵심 장치다
- **`aliases`**: 옛 이름을 적어두면 reader가 그 이름으로도 필드를 찾는다
- **타입 승격**: `int` → `long` → `float` → `double`, `string` ↔ `bytes`가 규격에 정의돼 있다

**Parquet과 ORC**는 스키마를 기록만 한다. 파일마다 컬럼 구성이 다를 때 어떻게 합칠지는 규격 밖이고 엔진이 정한다.

```python
# 파일별 스키마를 합쳐서 읽기. 파일 수만큼 footer를 읽어야 해서 느리다
spark.read.option("mergeSchema", "true").parquet("s3://lake/orders/")
```

컬럼 추가와 삭제는 이 방식으로 흡수되지만 이름 변경은 불가능하다. 이름이 곧 식별자라서 바꾸는 순간 다른 컬럼이 된다.

---

### 6. 테이블 포맷 관점

[[Open Table Formats - Iceberg vs Delta Lake vs Hudi|테이블 포맷]]은 이름 대신 ID로 컬럼을 식별해 이 문제를 푼다.

```text
테이블 스키마     1: order_id   2: user_name   3: amount
                                 ↓ rename
                  1: order_id   2: customer_name   3: amount

2024년 Parquet    field-id 2에 저장된 값 → 새 이름으로 그대로 읽힘
2026년 Parquet    field-id 2에 저장된 값 → 동일
```

Iceberg는 컬럼마다 `field-id`를 부여하고 Parquet 파일 안에도 그 ID를 심는다. 이름이 바뀌어도 ID로 찾으므로 기존 파일을 다시 쓸 필요가 없다.

```sql
ALTER TABLE analytics.orders RENAME COLUMN user_name TO customer_name;
-- 메타데이터만 수정된다. 데이터 파일은 그대로다
```

Delta는 Column Mapping을 켜면 같은 방식으로 동작한다.

```sql
ALTER TABLE orders SET TBLPROPERTIES (
  'delta.columnMapping.mode' = 'name',
  'delta.minReaderVersion' = '2',
  'delta.minWriterVersion' = '5'
);
```

| 동작 | Iceberg | Delta | Hudi |
|---|---|---|---|
| 컬럼 추가 | 지원 | 지원 | 지원 |
| 컬럼 삭제 | 지원 | Column Mapping 필요 | `schema.on.read` 활성화 필요 |
| 컬럼 이름 변경 | 지원 | Column Mapping 필요 | `schema.on.read` 활성화 필요 |
| 컬럼 순서 변경 | 지원 | `REPLACE COLUMNS`로 가능 | 지원 |
| 타입 승격 | 지원 | 지원 | 지원 |
| 파티션 스펙 변경 | 지원, 재작성 불필요 | Liquid Clustering으로 대응 | 제한적 |

> [!note]+ 파티션 스펙 진화: Iceberg에만 있는 것
> - 파티션 기준을 일별에서 시간별로 바꿔도 과거 데이터를 재작성하지 않는다
> - 옛 파일은 옛 스펙, 새 파일은 새 스펙으로 기록되고 query planning이 둘을 함께 처리한다
> - Hive 방식에서는 파티션 컬럼이 디렉터리 구조라 바꾸려면 전체를 다시 써야 했다

---

### 7. 스트리밍 관점

Kafka에는 테이블 포맷이 없고 프로듀서와 컨슈머가 각자 배포되므로 스키마 불일치가 상시 발생한다.

```text
프로듀서 v2 배포  →  country 필드가 붙은 메시지 발행
컨슈머 A (v1)     →  country를 모름. 무시하고 읽어야 함
컨슈머 B (v2)     →  country를 사용
```

[Schema Registry](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)가 스키마를 중앙에서 관리하고 배포 전에 호환성을 검사한다. 정책을 주제별로 설정한다.

```bash
# 특정 토픽의 호환성 정책 설정
curl -X PUT http://schema-registry:8081/config/orders-value \
  -H "Content-Type: application/json" \
  -d '{"compatibility": "BACKWARD"}'
```

| 정책 | 검사 범위 |
|---|---|
| `BACKWARD` | 직전 버전과 backward 호환. 기본값 |
| `BACKWARD_TRANSITIVE` | 모든 이전 버전과 backward 호환 |
| `FORWARD` | 직전 버전과 forward 호환 |
| `FORWARD_TRANSITIVE` | 모든 이전 버전과 forward 호환 |
| `FULL` | 직전 버전과 양방향 호환 |
| `FULL_TRANSITIVE` | 모든 이전 버전과 양방향 호환 |
| `NONE` | 검사하지 않음 |

`_TRANSITIVE`가 붙은 정책은 전체 이력을 검사한다. 오래된 데이터를 다시 처리하는 파이프라인이라면 이쪽을 쓴다. 직전 버전만 보는 정책으로는 v1 데이터를 v3 코드가 읽을 수 있다는 보장이 없다.

> [!warning]+ 정책을 NONE으로 두면
> - 호환성 검사가 사라져 어떤 변경이든 등록된다
> - 컨슈머가 런타임에 역직렬화 오류로 멈춘다. 그때는 이미 문제 메시지가 토픽에 쌓인 뒤다
> - 개발 환경에서만 쓰고 운영에서는 최소 `BACKWARD`를 건다

---

### 8. 안티패턴

- **컬럼 이름 재활용**: 지운 컬럼의 이름을 다른 의미로 다시 쓰면 옛 파일의 값이 새 의미로 읽힌다. 이름은 은퇴시키고 새 이름을 만든다
- **타입으로 의미 바꾸기**: `status`를 `INT` 코드에서 `STRING` 레이블로 바꾸는 식. 새 컬럼을 만들고 옛 컬럼은 유지하다 사용처가 사라지면 지운다
- **`mergeSchema` 상시 활성화**: 편하지만 오타로 생긴 컬럼까지 스키마에 들어온다. `user_id`와 `userid`가 따로 쌓인다
- **검증 없는 변경**: 스키마를 바꾼 뒤 과거 구간의 `null` 비율을 확인하지 않으면 조용한 손실을 놓친다
- **테이블 포맷 없이 rename**: 경로 기반 Parquet 테이블에서 이름을 바꾸는 것은 데이터를 버리는 것과 같다. 옮길 방법이 없으면 전체 재작성이 유일한 수단이다

---

### 9. 층별 대응 범위

변경 유형에 따라 필요한 층이 다르다.

| 하려는 것          | 필요한 것                              |
| -------------- | ---------------------------------- |
| 컬럼 추가·삭제       | 파일 포맷만으로 가능. 엔진 설정으로 흡수            |
| 컬럼 이름 변경       | 테이블 포맷의 field-id. Avro라면 `aliases` |
| 타입 확장          | 파일 포맷 규격이 정의한 승격 범위 안에서            |
| 파티션 기준 변경      | Iceberg의 파티션 스펙 진화                 |
| 프로듀서·컨슈머 시차 흡수 | Schema Registry 호환성 정책             |

레이크를 새로 설계한다면 테이블 포맷을 처음부터 도입하는 편이 낫다.