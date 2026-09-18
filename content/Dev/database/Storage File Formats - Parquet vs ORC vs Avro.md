---
tags:
  - data_engineering
  - Data
  - database
  - hadoop
  - performance
created: 2026-08-11T00:00:00
updated: 2026-09-09T22:45:18
permalink: /Dev/database/storage-file-formats-parquet-vs-orc-vs-avro
---

> [!abstract]+ TL;DR
> - Parquet과 ORC는 열 단위로, Avro는 행 단위로 바이트를 배치하는 저장 포맷
> - 열 저장이 분석에서 빠른 이유는 안 읽는 컬럼을 건너뛰고 같은 타입끼리 모여 압축이 잘 되며 통계로 블록을 걸러내기 때문
> - 스캔은 Parquet, Hive 스택은 ORC, 스트리밍 수집과 스키마 진화는 Avro

> *AI-assisted*

---

### 1. 파일 포맷이 정하는 것

파일 포맷은 값을 디스크에 어떤 순서로 늘어놓을지, 어디에 통계를 적어둘지, 어떻게 압축할지를 정한다.
(파일 포맷은 테이블 정의에 관여하지 않는다. 테이블 정의는 [[Open Table Formats - Iceberg vs Delta Lake vs Hudi|테이블 포맷]]이 맡는다)

```text
테이블 포맷   어느 시점에 어떤 파일이 테이블에 속하는가   Iceberg / Delta / Hudi
      ↓
파일 포맷     한 파일 안에서 바이트를 어떻게 배치하는가   Parquet / ORC / Avro
      ↓
객체 스토리지  바이트를 어디에 두는가                    S3 / GCS / HDFS
```

셋 다 규격이 공개돼 있어 특정 벤더 도구 없이 읽고 쓸 수 있지만 설계 목표는 갈린다.

- **Parquet**: 분석 스캔. 열 저장, 통계 기반 스킵
- **ORC**: 분석 스캔 + Hive 결합. 열 저장, 내장 인덱스
- **Avro**: 레코드 전달과 스키마 진화. 행 저장

Parquet과 ORC를 묶어 부를 때는 columnar file format, 셋을 함께 가리킬 때는 storage format이라고 쓴다.

스키마를 파일 안에 넣어서 외부 카탈로그 없이 파일 하나만 건네도 해석된다. 이런 성질을 **self-describing**이라고 부른다.

| 대상 | 스키마 적용 시점 | 스키마 저장 위치 |
| --- | --- | --- |
| RDBMS | 테이블 스키마를 정의하고 데이터를 쓸 때 검증 | DB 카탈로그 |
| Parquet, ORC, Avro 파일 | 스키마에 맞춰 쓰고 읽을 때 파일의 스키마 참조 | 파일 내부 |
| CSV, JSON | 읽는 쪽에서 필드 타입을 지정하거나 추론 | 파일 자체에 필드 타입을 정의한 스키마 없음 |

CSV도 읽는 시점에 스키마를 입히지만 self-describing은 아니다. 헤더 줄이 있어도 타입 정보가 없어 읽는 쪽이 추측한다.
self-describing은 뒤에 나오는 Parquet footer와 Avro 헤더, 그리고 [[Schema Evolution in Data Lakes|스키마 진화]]의 전제가 된다.

> [!note]+ self-describing: 과학 데이터에서 온 설계
> - 1988년 HDF, 1989년 netCDF가 이 방식을 표방했다. 위성 관측처럼 수십 년 보관하는 데이터에서 파일과 스키마 문서가 분리되면 나중에 해석할 수 없다는 문제를 풀려던 설계다
> - 데이터 엔지니어링에는 2009년 Avro가 들여왔고 2013년 Parquet과 ORC가 열 저장에 결합했다
> - Hive는 스키마를 메타스토어에 두고 HDFS에는 구분자로 나뉜 텍스트를 뒀다. 엔진이 늘면서 각자 메타스토어 연동을 구현해야 했고 파일을 다른 클러스터로 복사하면 스키마가 함께 이동하지 않았다

---

### 2. 행 저장과 열 저장

주문 테이블에 `id`, `user`, `amount`, `ts` 네 컬럼이 있다고 할 때 같은 데이터라도 디스크에 놓는 순서는 달라진다.

```text
행 저장 (CSV, JSON, Avro)
[1|kim|1200|10:00][2|lee|300|10:01][3|park|8900|10:02]
 ← 레코드 하나가 붙어 있음

열 저장 (Parquet, ORC)
[1|2|3][kim|lee|park][1200|300|8900][10:00|10:01|10:02]
 ← 같은 컬럼 값이 붙어 있음
```

`SELECT sum(amount) FROM orders`를 실행하면 차이가 드러난다.

- **행 저장**: 레코드를 처음부터 끝까지 읽으면서 `amount` 위치의 값만 꺼낸다. 안 쓰는 컬럼도 디스크에서 올라온다
- **열 저장**: `amount` 블록만 읽는다. 컬럼이 100개고 하나만 쓰면 I/O가 1/100로 줄어든다

압축률도 벌어진다. 열 저장은 같은 타입, 비슷한 값이 인접해 있어서 사전 인코딩이나 반복 제거의 효과가 크다. 행 저장은 정수 옆에 문자열이 오고 그 옆에 타임스탬프가 오므로 패턴을 찾기 어렵다.

레코드 하나를 통째로 꺼내거나 새 레코드 하나를 덧붙이는 작업은 행 저장이 유리하다. 열 저장에서 한 행을 재구성하려면 컬럼 수만큼 위치를 찾아 조립해야 한다.

---

### 3. Parquet

쓰임이 가장 넓은 포맷이라 구조부터 자세히 본다.

#### 3.1 물리 구조

Parquet 파일은 네 겹으로 나뉜다.

```text
PAR1                          ← magic bytes
├── Row Group 0 (기본 128MB)
│   ├── Column Chunk: id
│   │   ├── Page 0 (기본 1MB)
│   │   ├── Page 1
│   │   └── ...
│   ├── Column Chunk: user
│   └── Column Chunk: amount
├── Row Group 1
├── ...
├── Footer (FileMetaData)
│   ├── 스키마
│   └── Row Group별 · Column Chunk별 메타데이터
│       └── min / max / null 개수 / 오프셋 / 인코딩
├── footer 길이 (4바이트)
└── PAR1
```

- **Row Group**: 행을 일정 크기로 자른 단위. 병렬 처리와 스킵의 기본 단위다
- **Column Chunk**: 한 Row Group 안에서 컬럼 하나에 해당하는 연속 구간
- **Page**: 실제 압축·인코딩이 적용되는 최소 단위
- **Footer**: 스키마와 모든 통계가 파일 끝에 모여 있다

> [!info]+ 중첩 컬럼도 평면 Column Chunk로 펼쳐진다
> - 위 도식에서 Column Chunk는 값이 일렬로 늘어선 모양이다. 스키마에 구조체나 배열이 있으면 이 모양에 그대로 담기지 않는다
> - 이벤트 로그나 API 응답을 그대로 적재하면 이런 컬럼이 생긴다
>
> ```json
> {"id": 1, "user": {"name": "kim", "address": {"city": "Seoul"}}, "tags": ["sale", "mobile"]}
> ```
>
> - Parquet은 이 트리를 leaf node 기준으로 쪼갠다. `id`, `user.name`, `user.address.city`, `tags` 넷이 각각 Column Chunk가 된다. `user`와 `user.address`는 중간 노드라 별도 Column Chunk가 없다
> - 그래서 `SELECT user.address.city`가 그 컬럼만 읽는다. `user` 전체를 읽어 파싱하지 않는다
> - 값만 늘어놓으면 원래 모양을 잃으므로 값마다 definition level과 repetition level 두 숫자를 붙여 어느 깊이에서 null이었는지, 어디서 새 배열이 시작되는지를 기록한다. Google [Dremel](https://research.google/pubs/dremel-interactive-analysis-of-web-scale-datasets/) 논문에서 온 방식이다

읽는 순서는 뒤에서 앞이다. 마지막 4바이트로 footer 길이를 알아내고 footer를 읽어 스키마와 통계를 파악한 뒤 필요한 Column Chunk의 오프셋으로 건너뛴다.
객체 스토리지에서는 Range GET 두세 번이면 된다.

> [!info]+ Row Group 크기는 왜 128MB인가
> - HDFS 블록 하나에 Row Group 하나가 들어가면 네트워크를 타지 않고 로컬에서 읽힌다. 여기서 굳어진 기본값이다
> - 크게 잡으면 압축률과 스캔 처리량이 오르지만 메모리를 더 쓰고 스킵 단위가 거칠어진다
> - 작게 잡으면 세밀하게 걸러내지만 메타데이터 비중이 커진다. 파일이 수만 개면 footer 읽기만으로 부담이 된다

> [!warning]+ 작은 파일 문제
> - Parquet은 파일당 오버헤드가 있다. footer, 사전, 압축 블록이 매번 붙는다
> - 수 MB짜리 파일이 수십만 개면 압축률도 통계 효과도 나오지 않는다
> - 스트리밍으로 적재할 때 특히 잘 생긴다. compaction을 주기로 돌려야 한다

^060d66

#### 3.2 읽기 전에 걸러내기

열 저장의 이득 중 큰 몫은 "읽지 않는 것"에서 나오는데 줄이는 방향은 둘이다. 읽을 컬럼을 좁히는 쪽과 읽을 행을 좁히는 쪽이다.

```sql
SELECT user FROM orders WHERE amount > 5000
```

1. **projection pushdown**: 쿼리에 쓰인 `user`, `amount` Column Chunk만 읽는다. `SELECT *`를 쓰면 모든 컬럼이 필요하다
2. **predicate pushdown**: 조건에 맞는 데이터가 없는 구간을 읽기 전에 제외한다
   - **Row Group의 min/max**: `amount`의 max가 3000이면 `amount > 5000`을 만족하는 행이 없어 해당 Row Group을 건너뛴다. footer의 통계를 사용한다
   - **Bloom filter**: `WHERE user = 'kim'` 같은 등호 조건에 사용한다. Column Chunk마다 저장된 필터로 Row Group에 찾는 값이 없는지 판정한다
   - **page index**: Page 단위 min/max와 오프셋을 참조해 남은 Row Group 안에서 읽을 구간을 고른다

이때 정렬에 따라 성능이 달라진다.

- **정렬**: `amount`로 정렬해서 쓰면 Row Group마다 값 범위가 좁아져 min/max로 대부분 걸러진다.
- **무작위**: 값을 무작위 순서로 쓰면 각 Row Group의 min/max 범위가 넓어질 수 있다.
- **조건 겹침**: 조회 조건의 값 범위가 그 min/max와 자주 겹치면 통계만으로 제외할 수 있는 Row Group이 줄어든다.

같은 데이터, 같은 포맷인데 스캔량이 수십 배 벌어진다.

> [!note]+ Bloom filter: "없다"만 확실하게 답하는 비트 배열
> - 값을 해시해 비트 몇 개를 켜둔다. 찾을 때 그 비트가 하나라도 0이면 이 Row Group에 값이 없다고 확정한다
> - 비트가 전부 1이면 "있을 수도 있다"에 그친다. 실제로는 없을 수 있어 읽어봐야 안다. 불필요한 읽기 한 번으로 끝나고 결과가 틀리지는 않는다
> - 값도 개수도 위치도 담지 않는다. Parquet은 32바이트 블록 안에서 비트를 건드리는 [Split Block Bloom Filter](https://parquet.apache.org/docs/file-format/bloomfilter/)를 써서 조회 한 번이 CPU 캐시 한 줄에 들어간다
> - 해시값이라 순서 정보가 없다. `amount > 5000` 같은 범위 조건에는 쓸 수 없다
> - 크기는 예상 고유값 개수와 오탐률로 정해진다. 정밀하게 잡을수록 필터가 커지고 읽을 바이트도 늘어 이득이 상쇄된다
> - 기본은 꺼져 있다. 컬럼을 지정해 켠다
>
> ```python
> (df.write
>    .option("parquet.bloom.filter.enabled#user_id", "true")
>    .option("parquet.bloom.filter.expected.ndv#user_id", "1000000")
>    .parquet("s3://bucket/orders/"))
> ```
>
> - 모든 컬럼에 켜면 파일만 커진다. cardinality가 높고 등호로 자주 조회하는 컬럼에만 적용한다. `user_id`, `order_id`, 이메일 같은 컬럼이다

> [!note]+ pushdown: 연산을 데이터 소스 쪽으로 넘기는 것
> - 데이터는 스토리지 → reader → 엔진 순으로 올라온다. 엔진이 할 일을 아래 계층으로 넘기면 pushdown이라 부른다
> 	- **reader가 처리**: footer를 보고 필요 없는 컬럼과 구간을 읽지 않는다. 스토리지에는 필요한 바이트 범위만 요청하므로 전송량도 함께 준다
> 	- **엔진이 처리**: reader가 전부 디코딩해 올려보내고 엔진이 필요 없는 컬럼과 행을 버린다. 통계가 없는 CSV·JSON은 이 방식에 해당한다
> - 대상이 컬럼이면 projection, 조건이면 predicate다. 엔진에 따라 집계나 `LIMIT`을 넘기는 경우도 있다

#### 3.3 인코딩과 압축

Parquet은 두 단계로 크기를 줄인다. 값 자체를 다시 표현하는 [인코딩](https://parquet.apache.org/docs/file-format/data-pages/encodings/)이 먼저고 그 결과 바이트를 압축하는 게 다음이다.

| 인코딩                            | 방식                                  | 잘 맞는 데이터               |
| ------------------------------ | ----------------------------------- | ---------------------- |
| `PLAIN`                        | 값을 그대로                              | 압축 효과가 낮은 무작위 값       |
| `RLE_DICTIONARY` (사전 인코딩)      | 값을 사전에 넣고 정수 ID로 치환. ID 배열은 RLE로 저장 | 고유값이 적은 컬럼. 국가, 상태 코드  |
| `DELTA_BINARY_PACKED` (델타 인코딩) | 이전 값과의 차이만 저장                       | 증가하는 정수. 타임스탬프, 시퀀스 ID |
| `DELTA_BYTE_ARRAY` (접두사 인코딩)   | 앞 문자열과 공통 접두사 생략                    | 정렬된 URL, 경로            |
| `BYTE_STREAM_SPLIT`            | 부동소수점 바이트를 자리별로 분리                  | 센서 측정값                 |

사전 인코딩이 기본이고 고유값이 많아 사전이 커지면 자동으로 PLAIN으로 넘어간다.

> [!note]+ 사전 인코딩과 RLE: 겹쳐 쓰는 두 기법
> - **사전 인코딩**: 컬럼의 고유값을 모아 번호를 매기고 데이터 자리에는 번호만 남긴다.
> 	- `["KR","US","KR","KR","JP"]` → 사전 `0=KR, 1=US, 2=JP` + 데이터 `[0,1,0,0,2]`
> 	- 번호는 고유값 개수에 맞는 최소 비트 폭으로 채운다. 고유값 300개면 9비트
> 	- 사전이 임계를 넘으면 그 Column Chunk는 PLAIN으로 전환한다. UUID나 이메일처럼 행마다 값이 다르면 사전이 원본만큼 커진다
> 	- 일부 엔진은 디코딩 없이 사전 상태로 필터링한다. `WHERE country = 'KR'`을 정수 비교로 처리한다
> - **RLE**(run-length encoding): 같은 값의 반복을 `0이 500번` 형태로 줄인다.
> 	- 사전 인코딩은 고유값이 적을 때, RLE는 같은 값이 연속으로 놓일 때 효과적이다. 정렬하면 같은 값의 연속 구간이 길어져 RLE 효율이 오른다. 사전 크기는 고유값 개수로 정해져 정렬해도 그대로다
> - 이름의 두 조각은 서로 다른 층을 가리킨다. 사전은 별도 Dictionary Page에 `PLAIN`으로 저장되고 `RLE_DICTIONARY`는 데이터 페이지에 붙는 이름이다
> 	- `DICTIONARY`: 이 페이지의 값은 실제 값이 아니라 사전 인덱스다
> 	- `RLE`: 그 인덱스 배열을 RLE로 담았다. 반복이 길면 횟수로 접고 짧으면 비트 패킹으로 담는 하이브리드다

압축 코덱은 압축과 해제를 맡는 알고리즘 한 쌍이다. 압축률을 높일수록 CPU 비용이 늘어난다.

| 코덱     | 압축률 | CPU 사용 | 쓰임               |
| ------ | --- | ------ | ---------------- |
| Snappy | 낮음  | 적음     | 오래 쓰인 기본값        |
| Zstd   | 높음  | 중간     | 최근 기본 선택. 레벨로 조절 |
| Gzip   | 높음  | 많음     | 자주 읽지 않는 보관 데이터  |
| LZ4    | 낮음  | 가장 적음  | 압축 해제가 부담될 때     |

어느 쪽이 병목인지로 정한다. 스캔 job의 CPU 사용률은 높고 디스크 사용률은 낮다면 압축률보다 압축 해제 비용이 낮은 코덱을 선택하는 편이 처리량을 높이기 좋다. 반대로 네트워크 bandwidth가 병목이면 CPU를 더 써서라도 바이트를 줄인다.

```python
# 정렬은 쓰기 시점에 정해진다. 저장한 뒤에는 다시 쓰지 않는 한 순서가 바뀌지 않는다
(df.sortWithinPartitions("country", "user_id")
   .write.parquet("s3://bucket/orders/", compression="zstd"))
```

```sql
-- Spark 세션 기본값
SET spark.sql.parquet.compression.codec = zstd;
```

> [!tip]+ 정렬 키가 인코딩·압축 선택보다 영향이 크다
> - 필터에 자주 쓰는 컬럼으로 정렬하면 통계 스킵과 압축률이 함께 좋아진다
> - 정렬 키가 여럿이면 cardinality가 낮은 컬럼을 앞자리에 둔다. `ORDER BY country, user_id`처럼 쓰면 같은 번호가 연속으로 몰려 RLE 반복 구간이 길어진다
> - 정렬 효과는 앞쪽 키에 집중된다. `user_id`만으로 거는 필터는 이득이 적다. 여러 컬럼으로 필터가 들어오면 테이블 포맷 층의 Z-Ordering이나 Liquid Clustering을 쓴다
> - 전역 정렬은 shuffle 비용이 크다. 날짜로 파티션을 나눠 쓰는 배치라면 `sortWithinPartitions`로 충분한 경우가 많다
> - 코덱을 바꿔 얻는 차이는 이보다 작다

---

### 4. ORC (Optimized Row Columnar)

ORC는 Hive의 성능 문제를 풀려고 2013년에 나왔다. 전체 구조는 Parquet과 같고 구성 이름과 세부 배치가 다르다.

```text
├── Stripe 0 (기본 64MB)          ← Parquet의 Row Group에 해당
│   ├── Index Data               ← 1만 행마다 min/max, 위치, bloom filter
│   ├── Row Data                 ← 컬럼별 스트림
│   └── Stripe Footer
├── Stripe 1
├── File Footer                   ← 스키마, Stripe 목록, 컬럼 통계
└── Postscript                    ← 압축 방식, File Footer 길이
```

- **인덱스 위치**: ORC는 Stripe 안에 인덱스를 넣는다. Parquet은 통계를 파일 끝 footer에 모은다
- **인덱스 간격**: 기본 1만 행마다 통계를 남긴다. Parquet의 page index와 비슷한 역할을 더 일찍 갖췄다
- **타입 시스템**: Hive 타입에 맞춰 설계돼 `DECIMAL`, `TIMESTAMP` 처리가 Hive와 어긋나지 않는다
- **ACID**: Hive의 트랜잭션 테이블은 ORC를 전제로 만들어졌다. delta 파일과 base 파일을 병합해 읽는 구조가 포맷 안에 들어 있다

선택 기준은 실행 스택이다.

- **Hive·Tez**: ORC가 기본값이고 튜닝 자료도 그쪽에 많다
- **Spark·Trino·Snowflake**와 [[Python Polars - Rust 기반 고성능 DataFrame 라이브러리|Polars]]: Parquet 쪽 최적화가 앞서 있다
- **테이블 포맷**: 세 종류(Iceberg, Delta Lake, Hudi)가 모두 데이터 파일 기본값으로 Parquet을 쓴다
- **신규 프로젝트**: 대개 Parquet으로 시작한다

> [!info]+ 주의: 성능 비교는 조건에 따라 뒤집힌다
> - 압축률은 데이터 성격이 결정한다. 같은 데이터에 같은 코덱을 쓰면 두 포맷 차이는 크지 않다
> - 벤치마크에서 벌어지는 차이는 대개 포맷이 아니라 reader 구현과 통계 활용도에서 온다
> - 마이그레이션 판단은 벤치마크 수치보다 엔진 지원 범위로 하는 편이 안전하다

---

### 5. Avro

Avro는 레코드를 행 단위로 쌓으며 앞의 둘과 목적이 달라 같은 축에 놓고 우열을 가리기 어렵다.

```text
├── Header
│   ├── magic "Obj\x01"
│   ├── 스키마 (JSON)             ← 파일 안에 들어 있음
│   └── sync marker (16바이트 난수)
├── Block 0: [행 개수][바이트 수][직렬화된 레코드들][sync marker]
├── Block 1: ...
└── ...
```

- **스키마 내장**: 파일 헤더에 스키마가 JSON으로 들어 있다. 별도 코드 생성이나 스키마 레지스트리 없이 읽을 수 있다
- **스키마 진화**: 쓸 때의 스키마와 읽을 때의 스키마가 달라도 규칙에 따라 해석한다. 기본값이 있는 필드 추가, 필드 삭제, 이름 변경(alias), 타입 승격이 [규격](https://avro.apache.org/docs/1.12.0/specification/)에 정의돼 있다
- **분할 가능**: 블록마다 sync marker가 있어 파일 중간부터 읽어도 경계를 찾는다. 대용량 파일을 여러 태스크로 나눌 수 있다

쓰이는 자리도 다르다.

- **Kafka 메시지**: producer와 consumer가 Avro 스키마를 참조해 메시지를 직렬화·역직렬화한다. [Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)는 새 스키마 버전을 등록할 때 설정된 호환성 규칙을 적용한다
- **landing zone**: 원본을 그대로 받아두는 계층. 스키마가 자주 바뀌는 소스에 맞다
- **테이블 포맷 내부**: Iceberg manifest가 Avro로 저장된다. 스키마 진화가 필요하고 열 단위 스캔은 필요 없는 메타데이터에 맞는 선택이다

컬럼 하나만 필요해도 레코드 전체를 읽고 역직렬화해야 하므로 분석 스캔에는 맞지 않는다.

> [!note]+ 직렬화 포맷 축에서 본 Avro
> - Avro는 Protobuf, Thrift와 같은 [[Python serialization|직렬화 포맷]] 갈래다. 차이는 스키마를 파일에 넣느냐 코드로 생성하느냐다
> - Protobuf는 `.proto`에서 클래스를 생성해 쓰고 Avro는 런타임에 스키마를 읽어 처리한다

---

### 6. 한눈에 비교

| 항목 | Parquet | ORC | Avro |
|---|---|---|---|
| 저장 방향 | 열 | 열 | 행 |
| 출신 | Twitter + Cloudera, 2013 | Hortonworks, 2013 | Hadoop, 2009 |
| 블록 단위 | Row Group 128MB | Stripe 64MB | Block |
| 통계 위치 | 파일 끝 footer | Stripe 내부 + File Footer | 없음 |
| 세밀한 스킵 | page index | 1만 행 row index | 불가 |
| Bloom filter | Column Chunk 단위 | 1만 행 단위 | 없음 |
| 중첩 구조 | definition/repetition level | 중첩 타입 지원 | 스키마로 표현 |
| 스키마 진화 | 컬럼 추가·삭제. rename은 불가 | 컬럼 추가·삭제. rename은 불가 | 추가·삭제·rename·타입 승격 |
| 한 행 쓰기 | 비쌈 | 비쌈 | 쌈 |
| 주 사용처 | 분석 스캔 전반 | Hive 스택 | 메시지, landing zone |

---

### 7. 선택 기준

| 상황 | 선택 | 이유 |
|---|---|---|
| 레이크하우스 테이블 데이터 | Parquet | 엔진 지원이 가장 넓고 테이블 포맷 기본값 |
| Hive·Tez 기존 자산 | ORC | 타입 호환과 ACID 테이블 전제 |
| Kafka 메시지 | Avro | Schema Registry 연동, 스키마 진화 |
| 원본 보존용 landing zone | Avro | 스키마가 바뀐 데이터를 읽는 호환성 규칙 제공 |
| 컬럼 수백 개, 일부만 조회 | Parquet | projection pushdown 효과가 큼 |

> [!note]+ 레코드 조회: 파일 포맷과 저장 시스템의 선택
> - **파일 포맷**: 한 행을 복원할 때 읽을 데이터 양과 역직렬화 비용을 비교
> - **저장 시스템**: 특정 키의 레코드를 자주 조회하는 경우 키 기반 조회를 지원하는 KV 스토어 등을 별도로 검토

실무에서는 계층별로 나눠 쓰는 구성이 흔하다.

```text
소스 → Kafka(Avro) → landing zone(Avro) → 변환 → 분석 테이블(Parquet)
```

수집 단계는 스키마 변화를 견디는 쪽이, 분석 단계는 스캔이 빠른 쪽이 유리하다.

---

### 8. 테이블 포맷과 겹치는 부분

두 계층 모두 min/max 통계를 쓴다.

- **Parquet footer의 통계**: 파일 하나를 열어야 볼 수 있다. 파일을 읽기 시작한 다음의 스킵이다
- **Iceberg manifest의 통계**: 데이터 파일을 열기 전에 볼 수 있다. 어떤 파일을 열지 결정하는 단계의 스킵이다

세 단계가 순서대로 작동한다.

1. **manifest 통계**: 읽을 파일 목록 확정 (테이블 포맷)
2. **footer 통계**: 읽을 Row Group 확정 (파일 포맷)
3. **page index**: 읽을 Page 확정 (파일 포맷)

파일 내부 배치는 파일 포맷이 맡고 파일 목록 관리는 테이블 포맷이 맡는다.
