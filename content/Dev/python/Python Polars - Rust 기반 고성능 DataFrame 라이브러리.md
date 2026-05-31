---
tags:
  - python
  - Data-Engineering
created: 2026-05-21T00:00:00
updated: 2026-05-21T00:00:00
permalink: /Dev/python/python-polars
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Polars는 Rust로 작성된 고성능 DataFrame 라이브러리로, Python/R/Node.js API 제공
> - Apache Arrow 컬럼 포맷, 멀티스레딩, Lazy Evaluation으로 Pandas 대비 5~30배 빠름
> - 인덱스 없음, 표현식(Expression) 기반 API, 메서드 체이닝이 핵심 설계 철학
> - Pandas를 완전히 대체하기보다, 대용량 데이터 처리와 ETL 파이프라인에서 강점 발휘

> [!cite]+ Source
> - [Polars 공식 문서](https://docs.pola.rs/)
> - [Under the Hood: What Makes Polars So Scalable and Fast?](https://endjin.com/blog/2026/01/under-the-hood-what-makes-polars-so-scalable-and-fast)
> - [Coming from Pandas — Polars User Guide](https://docs.pola.rs/user-guide/migration/pandas/)

---

### 1. Polars가 뭔가

Polars는 Rust로 작성된 DataFrame 라이브러리다. Python API를 제공하지만, 내부 연산은 모두 Rust로 실행된다. 데이터를 저장하고 처리하는 OLAP 쿼리 엔진 위에 DataFrame 인터페이스를 얹은 구조다.

```bash
pip install polars

# 주요 extras 포함
pip install 'polars[numpy,pandas,pyarrow]'

# GPU 가속 (NVIDIA)
pip install 'polars[gpu]' --extra-index-url=https://pypi.nvidia.com
```

```python
import polars as pl
```

최신 버전은 1.40.1 (2026년 4월), Python 3.10 이상을 요구한다. Pandas와 같은 목적(표 형태 데이터의 탐색, 변환, 집계)을 수행하지만, 설계 철학과 성능 특성이 크게 다르다.

---

### 2. 왜 빠른가 — 내부 아키텍처

#### 2-1. Rust 기반

- 가비지 컬렉션 없음 — GC 중단(pause) 없이 예측 가능한 성능
- Zero-cost abstraction — 컴파일러가 C 수준의 기계 코드 생성
- 메모리 안전성 — 버퍼 오버플로, use-after-free 방지
- Python의 GIL을 우회 — Rust 코드 실행 중에는 GIL이 해제되어 진짜 멀티스레딩

#### 2-2. Apache Arrow 컬럼 포맷

데이터를 행(row) 단위가 아니라 열(column) 단위로 저장한다.

- **선택적 I/O** — 필요한 컬럼만 읽어서 디스크/메모리 I/O 감소
- **SIMD 활용** — 같은 타입의 데이터가 연속 배치되어 CPU의 SIMD 명령어 활용 가능 (AVX2: 한 번에 8개 값 처리)
- **캐시 친화** — 연속 메모리 레이아웃으로 CPU L1 캐시 적중률 극대화
- **압축 효율** — 동일 타입 데이터는 dictionary, run-length, delta encoding 등으로 효과적으로 압축
- **Zero-copy** — Python으로 결과를 반환할 때 변환 없이 Arrow 메모리 포인터를 직접 전달

#### 2-3. 멀티스레딩

Polars는 자동으로 모든 CPU 코어를 활용한다. filter, groupby, 집계 같은 연산을 work-stealing 스레드 풀로 분배한다. 사용자가 따로 설정할 필요가 없다.

#### 2-4. Lazy Evaluation과 쿼리 최적화

`scan_csv()`, `scan_parquet()` 등으로 시작하면 Lazy 모드가 활성화된다. 연산을 즉시 실행하지 않고 쿼리 플랜을 먼저 만든 뒤, `.collect()` 호출 시 최적화된 플랜으로 한 번에 실행한다.

적용되는 최적화 기법은 다음과 같다.

| 최적화 | 설명 |
| --- | --- |
| Predicate pushdown | 필터 조건을 데이터 소스 읽기 단계로 밀어넣어, 불필요한 행을 아예 안 읽음 |
| Projection pushdown | 필요한 컬럼만 읽음 |
| Join optimization | 데이터 특성에 따라 최적의 조인 전략 선택 |
| Common subexpression elimination | 동일 표현식을 한 번만 계산 |

> [!info]+ 벤치마크
> 이 최적화들만으로 naive 실행 대비 5~10배 성능 향상이 가능하다. 전체적으로 Polars는 Pandas 대비 5~30배 빠르다는 결과가 다수 보고되고 있다.

#### 2-5. Streaming과 GPU 가속

메모리보다 큰 데이터셋은 `.collect(streaming=True)`로 청크 단위 처리가 가능하다. NVIDIA GPU 환경에서는 RAPIDS cuDF 엔진을 통한 GPU 가속도 지원한다.

```python
# 대용량 데이터 스트리밍 처리
result = (
    pl.scan_parquet("huge_data/*.parquet")
    .filter(pl.col("status") == "active")
    .group_by("region")
    .agg(pl.col("revenue").sum())
    .collect(streaming=True)
)

# GPU 가속 (NVIDIA)
result = lf.collect(engine="gpu")
```

---

### 3. 핵심 개념

#### 3-1. DataFrame, Series, LazyFrame

| 구조 | 설명 |
| --- | --- |
| `DataFrame` | 2차원 테이블. Eager 모드에서 사용 |
| `Series` | 단일 컬럼. DataFrame의 각 열이 Series |
| `LazyFrame` | Lazy 모드의 DataFrame. `.collect()`로 실행 |

#### 3-2. Expression (표현식)

Polars API의 핵심이다. `pl.col("name")`으로 시작해서 변환, 필터, 집계를 체이닝한다.

```python
# 표현식 예시
pl.col("price") * pl.col("quantity")           # 계산
pl.col("name").str.to_uppercase()               # 문자열 변환
pl.col("score").mean().over("group")            # 윈도우 함수
pl.when(pl.col("age") > 18).then("adult").otherwise("minor")  # 조건
```

표현식은 즉시 실행되지 않고, select, filter, with_columns 같은 **컨텍스트** 안에서 실행된다.

#### 3-3. 인덱스가 없다

Pandas와 가장 큰 차이점이다. `.loc[]`, `.iloc[]`, `set_index()` 같은 인덱스 기반 접근이 없다. 대신 `filter()`와 컬럼 기반 선택으로 모든 것을 처리한다.

---

### 4. Pandas와 비교하며 배우는 API

#### 4-1. 데이터 읽기

```python
# Pandas
df = pd.read_csv("data.csv")

# Polars (Eager)
df = pl.read_csv("data.csv")

# Polars (Lazy — 권장)
lf = pl.scan_csv("data.csv")      # LazyFrame 반환, 아직 읽지 않음
df = lf.collect()                   # 이 시점에 최적화 후 실행
```

Parquet, JSON도 동일한 패턴이다.

```python
df = pl.read_parquet("data.parquet")
lf = pl.scan_parquet("data/*.parquet")  # glob 패턴 지원
```

#### 4-2. 컬럼 선택

```python
# Pandas
df["a"]
df.loc[:, "a"]

# Polars
df.select("a")
df.select("a", "b", "c")
df.select(pl.col("a"))
```

#### 4-3. 필터링

```python
# Pandas
df[(df["price"] > 100) & (df["stock"] > 0)]

# Polars
df.filter(
    (pl.col("price") > 100) & (pl.col("stock") > 0)
)
```

#### 4-4. 컬럼 추가/변환

```python
# Pandas
df["total"] = df["price"] * df["quantity"]

# Polars
df = df.with_columns(
    (pl.col("price") * pl.col("quantity")).alias("total")
)
```

`with_columns`에 여러 표현식을 넣으면 **병렬로 실행**된다. Pandas에서 순차적으로 하나씩 추가하는 것과 다르다.

```python
df = df.with_columns(
    (pl.col("price") * pl.col("quantity")).alias("total"),
    pl.col("name").str.to_uppercase().alias("name_upper"),
    pl.col("date").dt.year().alias("year"),
)
```

#### 4-5. 조건부 컬럼

```python
# Pandas
df["status"] = df["a"].mask(df["c"] == 2, df["b"])

# Polars
df = df.with_columns(
    pl.when(pl.col("c") == 2)
      .then(pl.col("b"))
      .otherwise(pl.col("a"))
      .alias("status")
)
```

#### 4-6. GroupBy/집계

```python
# Pandas
df.groupby("region")["sales"].sum()

# Polars
df.group_by("region").agg(
    pl.col("sales").sum()
)

# 복수 집계
df.group_by("region").agg(
    pl.col("sales").sum().alias("total_sales"),
    pl.col("sales").mean().alias("avg_sales"),
    pl.col("id").count().alias("count"),
)
```

#### 4-7. 윈도우 함수

```python
# Pandas
df["group_size"] = df.groupby("category")["type"].transform(len)

# Polars
df = df.with_columns(
    pl.col("type").count().over("category").alias("group_size")
)
```

#### 4-8. 조인

```python
# Pandas
pd.merge(df1, df2, on="key", how="left")

# Polars
df1.join(df2, on="key", how="left")
```

#### 4-9. Lazy 파이프라인 (실전)

```python
# 전체 파이프라인을 Lazy로 구성
result = (
    pl.scan_csv("sales.csv")
    .filter(pl.col("year") >= 2024)
    .with_columns(
        (pl.col("price") * pl.col("qty")).alias("revenue")
    )
    .group_by("region")
    .agg(
        pl.col("revenue").sum().alias("total_revenue"),
        pl.col("order_id").count().alias("order_count"),
    )
    .sort("total_revenue", descending=True)
    .collect()  # 이 시점에 최적화 후 한 번에 실행
)
```

이 코드에서 Polars는 자동으로 다음을 수행한다.
- `year >= 2024` 필터를 CSV 읽기 단계로 pushdown
- 사용하지 않는 컬럼은 아예 읽지 않음 (projection pushdown)
- groupby + 집계를 병렬로 실행

#### 4-10. Null 처리 차이

Pandas에서는 정수 컬럼에 결측치가 있으면 float로 변환되고 `NaN`이 된다. Polars에서는 모든 타입이 `null`을 네이티브로 지원하며, 정수는 정수로 유지된다.

---

### 5. Polars vs Pandas vs DuckDB — 언제 뭘 쓸까

| 기준 | Pandas | Polars | DuckDB |
| --- | --- | --- | --- |
| 핵심 정체성 | DataFrame 라이브러리 | Rust 기반 DataFrame 엔진 | 인프로세스 분석 DB |
| 언어 | Python (C 확장) | Rust (Python 바인딩) | C++ (Python 바인딩) |
| API | Python 객체 조작 | Expression 기반 | SQL 우선 |
| 실행 방식 | Eager만 | Eager + **Lazy** | Lazy (SQL 쿼리 플래너) |
| 멀티스레딩 | 기본 싱글스레드 | 자동 멀티스레딩 | 자동 멀티스레딩 |
| 메모리 | 데이터셋의 5~10배 필요 | 데이터셋의 2~4배 | Out-of-core 지원 |
| 적합한 데이터 크기 | ~1GB | 수십 GB | 수백 GB+ |
| 생태계 통합 | scikit-learn, matplotlib 등과 최고 | Arrow 호환 도구와 원활 | S3/로컬 파일 직접 쿼리 |

> [!tip]+ 실무 조합
> - **Pandas** — ML 라이브러리(scikit-learn, statsmodels) 연동, 소규모 탐색
> - **Polars** — ETL 파이프라인, 대용량 변환/집계, feature engineering
> - **DuckDB** — 대용량 파일 직접 SQL 쿼리, 초기 데이터 정제
>
> 이 세 도구는 모두 Arrow 포맷을 지원하므로, 파이프라인에서 혼합 사용이 가능하다.

---

### 6. 참고 자료

- [Polars 공식 사이트](https://pola.rs/)
- [Polars User Guide](https://docs.pola.rs/)
- [Polars GitHub](https://github.com/pola-rs/polars)
- [Coming from Pandas — Migration Guide](https://docs.pola.rs/user-guide/migration/pandas/)
- [Pandas vs Polars vs DuckDB: What Data Scientists Should Use in 2026](https://www.analyticsinsight.net/programming/pandas-vs-polars-vs-duckdb-what-data-scientists-should-use-in-2026)
