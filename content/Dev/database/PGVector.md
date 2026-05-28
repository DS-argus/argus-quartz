---
tags:
  - postgresql
  - vectorDB
created: 2025-08-09T13:42:56
updated: 2025-08-19T15:10:14
permalink: /Dev/database/pgvector
---

> [!abstract]+ TL;DR
> - source :  https://github.com/pgvector/pgvector
> - 전문적인 vector DB가 여러 개 있지만 postgreSQL에서 쉽게 쓸 수 있다는 것이 큰 메리트

---

### 1. PGVector란
PostgreSQL에 벡터를 직접 저장해 similarity search 기능을 사용할 수 있는 오픈 소스 확장 모듈로 문서의 의미적 유사도 검색, 추천 시스템 등 벡터 기반 AI 응용을 전문 벡터 DB 없이도 구현할 수 있다.   
또한 PostgreSQL의 ACID 트랜잭션, 복제, 백업, JOIN 등의 **모든 기능과 통합**되므로 일관성과 관리 측면에서 장점이 있다.   

---
### 2. 특징
1. **다양한 거리 함수 지원** : 벡터 간 유사도를 계산하기 위한 여러 *거리/유사도 지표*를 기본 제공하며, 연산자로 간편히 사용할 수 있음
	- 유사도 종류 : 값이 작을수록 더 가깝다고 판단
		- L2 distance  `<->`
		- Inner product `<#>`  : 값이 작을수록 더 가깝게 해석하기 위해 음수를 붙여서 반환
		- Cosine distance `<=>`  : 1-cosine similarity 를 반환
		- L1 distance `<+>`
		- Hamming `<~>`
		- Jaccard `<\%>`

		    
2. **벡터 전용 데이터 타입**: vector(n) 형태로 *n차원 벡터 타입*을 정의하여 테이블 컬럼에 사용할 수 있음
	- 단일 정밀도(float4) 벡터 외에도 절반 정밀도(float2)인 halfvec, 희소벡터 sparsevec, 이진벡터 bit 등의 타입을 제공
	- vector 타입은 최대 2,000차원까지 지원(halfvec은 4,000차원)
	- 2,000차원을 초과하는 임베딩은 PCA 등 차원 축소를 통해 줄이거나, 부득이한 경우 PGVector 대신 배열 컬럼(double precision[] 등)에 저장할 수도 있으나 이러한 경우 인덱스를 활용한 빠른 검색은 제한
	    
3. **정확한 검색과 근사 최근접 이웃(ANN) 검색** : 기본적으로 완전 탐색(정확한 최근접 이웃 검색)
	- 반면 대량의 벡터에 대해 더 빠른 검색이 필요하면 *근사 최근접 탐색(ANN)* 을 지원하는 특수 인덱스를 추가하여 속도를 높일 수 있음
	- *HNSW*(Hierarchical Navigable Small World)와 *IVFFlat*(Inverted File Index) 두 가지 ANN 인덱스를 제공 
	- 일부 정확도를 희생하고도 검색 속도를 대폭 향상
	    
4. **SQL과의 자연스러운 통합**: PGVector로 저장한 벡터는 *일반 SQL 쿼리에서 다른 컬럼과 함께 사용 가능*  
	- 벡터 유사도 조건과 다른 속성의 필터 조건을 결합하거나, JOIN을 통해 *메타데이터와 임베딩을 함께 활용*하는 복잡한 질의를 수행
	- 벡터 검색 전용 DB를 사용할 때보다 개발 생산성이 높고, 데이터 일관성 유지가 용이
	- PostgreSQL 클라이언트를 지원하는 모든 언어에서 접근할 수 있어(C, Python, Java, Go 등) 하나의 데이터베이스에 다양한 애플리케이션을 연계하기 쉬움
	    
5. **확장성과 대용량 처리** : PGVector는 실세계 애플리케이션의 요구에 맞게 *수백만 개 이상의 벡터도 관리*할 수 있도록 설계
	- PostgreSQL 자체의 튼튼한 스케일 업/아웃 기능(파티셔닝, 병렬 쿼리, 복제 등)을 함께 활용하면 벡터 데이터량이 증가해도 안정적으로 성능을 유지 
		- 예를 들어, 색인 없는 경우에도 PostgreSQL의 parallel sequential scan[^1]을 통해 다수 코어로 유사도 연산을 병렬화
		- 초기 데이터 로드 후 인덱싱이나 파티션 나누기를 통해 대규모 벡터셋을 다룰 수 있음
	- PostgreSQL의 WAL 로그[^2]를 통한 PITR[^3], 스트리밍 복제[^4]도 그대로 활용 가능하므로 벡터 데이터 또한 고가용성을 확보할 수 있음

---
### 3. 장단점
##### 장점
1. **기존 DB와의 통합**
	- 별도의 벡터 전용 DB를 구축하지 않고 *기존 PostgreSQL 환경에 통합*하여 사용하므로 운영 복잡도가 낮음
	- 트랜잭션, 보안, 백업 등 *Postgres의 성숙한 기능*들을 그대로 사용할 수 있음
	- 하나의 DB에서 업무 데이터와 임베딩을 함께 관리할 수 있어 *데이터 정합성*이 높고, 표준 SQL로 질의 가능
	- 팀원들이 학습 커브 없이 활용 가능하며 개발 생산성이 높음
	    
2. **다양한 활용과 정확성**
	- 기본 설정에서 *정확한 최근접 이웃 검색*(완전 탐색)을 제공하므로 결과의 *정확도(재현율)* 면에서 우수
	- 필요할 경우 벡터 유사도 임계값을 지정한 *범위 검색*도 가능하며 (WHERE embedding <-> '벡터' < 임계값 형태 ), SUM/AVG 같은 집계함수도 벡터에 적용할 수 있어 통계 벡터 산출에도 활용 가능
	- 응용 분야도 *검색, 추천, 이상탐지* 등 범용적이며, 텍스트 임베딩부터 이미지 임베딩까지 폭넓게 지원
	    
3. **확장성 & 성능 선택지**
	- 데이터 규모나 요구 성능에 맞춰 *유연하게 선택*할 수 있음 
	- 인덱스 없이도 수만~수십만 건 규모에서는 충분히 사용 가능하고, 데이터가 늘어나면 *근사 최근접(ANN) 인덱스*를 추가하여 성능을 높일 수 있음 
	- *HNSW 그래프 인덱스*와 *IVFFlat 인덱스*를 제공하므로, 상황에 따라 적합한 방식을 골라 *속도와 정확도의 균형*을 맞출 수 있음
		- HNSW는 높은 정확도와 빠른 질의가 장점이고 IVFFlat은 메모리 사용이 적고 인덱스 생성이 빠른 점이 장점
	- *병렬처리, 파티셔닝* 등 PostgreSQL의 성능 기법을 함께 활용하면 대량의 벡터도 효율적으로 처리할 수 있음
		    
4. **오픈 소스 및 생태계**
	- PGVector는 활발히 발전 중인 오픈 소스 프로젝트로서 PostgreSQL 커뮤니티와 다양한 기업들에 의해 개선되고 있음
	- 무료로 사용할 수 있고, 버전 업에 따라 성능 최적화나 기능 추가(HNSW 지원, 인덱스 병렬 구축 등)도 빠르게 이뤄지고 있음
	- LangChain 같은 *오픈소스 프레임워크와 쉽게 연동*되어 백엔드 벡터스토어로 활용할 수 있고 , Supabase 등의 서비스에서 기본 지원하는 등 *생태계*가 형성되어 있음
##### 단점
1. **전문 벡터 DB 대비 성능 한계**
	- PGVector는 범용 DB 위의 확장인 만큼, 동일 하드웨어에서 specialized 벡터 전용 DB (Faiss, Milvus 등) 대비 *절대 성능은 다소 떨어질 수 있음* 
	- 모든 연산이 CPU 기반으로 이뤄지며, 대용량 벡터에 대한 메모리 최적화나 GPU 가속 등이 없으므로, 수천만 단위 이상의 벡터를 실시간으로 검색해야 하는 초대형 스케일에서는 성능 병목이 생길 수 있음
	- 인덱스를 쓰지 않는 *정확 검색의 경우 선형 시간*이 들기 때문에 데이터가 많으면 속도가 느려지고, *근사 검색도 매개변수 튜닝*에 따라 속도가 크게 달라짐
	- 대규모 서비스에서는 상황에 따라 별도의 벡터DB를 고려하거나, PGVector 사용 시에도 *충분한 인덱스 튜닝과 스케일 아웃*(샤딩/파티셔닝) 전략이 필요
	    
2. **인덱싱 관련 제약**
	- ANN 인덱스는 사용자가 명시적으로 생성해야 하며, 잘못 설정할 경우 검색 정확도가 낮아질 수 있음
		- IVFFlat 인덱스는 *클러스터 개수(lists)* 를 적절히 지정하지 않으면 리콜 저하나 조회 부정확이 발생할 수 있고 , 너무 초기 단계에 인덱스를 만들면 데이터 분포가 치우쳐 제대로 작동하지 않을 수도 있음
		- IVFFlat은 *쿼리 시 검색할 리스트 수(probes)* 를 높여야 정확도가 올라가는데, 너무 낮게 잡으면 근사로 인해 일부 근접 이웃을 놓칠 수 있음 
		- HNSW 인덱스는 매개변수 m, ef_search 등을 통해 정확도-속도 균형을 잡아야 하며, 기본값(ef_search=40)으로 필터 조건 있는 질의를 하면 결과 누락이 생길 수 있어 높여야 하는 등 튜닝 포인트가 존재
	- 즉, PGVector의 인덱스는 *자동 최적화보다는 수동 조정이 필요한 부분*이 있어 실무 적용 시 벤치마크와 모니터링을 거쳐 매개변수를 맞추는 노력이 필요
	    
3. **차원 및 데이터 타입 한계**
	- 앞서 언급했듯이 vector 타입은 최대 2,000차원까지만 인덱싱이 지원
		- 매우 고차원(예: 10,000차원 이상) 임베딩의 경우 바로 인덱스를 생성할 수 없으며, 이런 경우 차원을 축소하거나 절반정밀도 타입(halfvec, 최대 4,000차원)을 고려
	- 또한 벡터 컬럼을 *정의할 때 차원을 고정*해야 하므로, 만약 다른 차원의 임베딩을 함께 저장할 필요가 있다면 여러 컬럼으로 구분하거나 별도 테이블로 관리
	- 한편 PGVector의 벡터 타입은 부동소수(float4) 정밀도를 가지는데, *보다 높은 정밀도가 필요한 경우* (예: 매우 미세한 유사도 차이를 구분해야 할 때) 기본 제공 타입으로는 어려울 수 있음
		- 이때는 차선책으로 PostgreSQL의 DOUBLE PRECISION[] 배열 등에 임베딩을 저장하고 사용자 정의 함수로 거리를 계산해야 하나, 이러한 방식은 PGVector의 인덱스를 활용하지 못해 성능이 감소
		- *정밀도와 성능 사이의 트레이드오프*를 고려해야 함
		    
4. **자원 사용 및 기타**
	- HNSW 인덱스는 메모리 사용량이 많고 구축 시간이 오래 걸릴 수 있음
		- 수백만 벡터에 대해 HNSW 생성 시 수십 GB의 메모리가 필요하고, maintenance_work_mem 파라미터를 높여줘야 함
	- 반면 IVFFlat은 k-평균 학습을 해야 하므로 *인덱스 생성 시 CPU 부하*가 높을 수 있음
		- 인덱스 크기도 데이터양에 비례하여 디스크를 차지하므로 저장공간 계획이 필요
	- PGVector는 기본적으로 PostgreSQL 싱글 노드에 의존하므로 *수평적 확장*(샤딩)은 사용자가 구현해야 함
	- 대용량 데이터셋을 여러 노드로 분산하려면 Citus와 같은 확장이나 애플리케이션 레벨 샤딩을 검토해야 하며, 이런 경우 벡터 유사도 질의를 분산 실행하는 로직이 추가로 필요할 수 있음

---
### 4. 인덱스 : HNSW vs IVFFlat
> [!abstract]+ TL;DR
> - HNSW는 정확도 높고 검색이 빠르나 메모리/구축비용이 큼
> - IVFFlat은 가벼운 대신 튜닝 난이도가 있고 정확도가 약간 낮을 수 있음
> - 둘 다 매개변수 조정으로 성능을 개선할 여지가 크므로, 데이터 규모와 응답 속도 요구사항에 따라 적절한 인덱스를 선택하고 실험을 통해 최적의 설정을 찾아내는 것이 중요

PGVector는 두 가지 종류의 주요 근사 검색 인덱스를 제공한다
##### [HNSW (Hierarchical Navigable Small World)](https://www.youtube.com/watch?v=hCqF4tDPNBw)
- *Hierarchical Navigable Small World*를 다층으로 구축하여 근접 이웃을 찾는 방식
- *높은 검색 정확도와 낮은 지연*을 제공하며, 주어진 자원 내에서 *IVFFlat보다 전반적으로 우수한 속도-정확도 트레이드오프*를 보임
- 학습 단계 없이 그래프를 구축하므로 *테이블에 데이터가 없어도 인덱스 생성이 가능*하고, 생성 이후에도 *동시 삽입이나 삭제/업데이트가 가능한 동적 인덱스*
- 다만 *인덱스 빌드에 시간이 오래 걸리고 메모리 사용량이 큰* 점이 단점
- 벡터 차원과 거리함수에 맞는 연산자 클래스를 지정해야 함 (예: vector_l2_ops, vector_ip_ops 등)
- 튜닝 파라미터
	- `M` : 하나의 노드가 갖는 이웃 노드 개수로 추천 범위는 5~48
		- 값이 커질수록 
			- 빌드 시간, 검색 시간, 메모리 증가
			- 그래프 품질, 정확도 향상
	- `ef_construction` : 빌드 시 이웃 노드를 저장하는 후보 리스트 크기
		- 값이 커질수록 
			- 빌드 시간 증가
			- 그래프 품질, 정확도 향상, 검색 시간 감소
	- `ef` : 검색 시 방문한 이웃 노드를 저장해놓는 동적 큐
		- 해당 값 만큼의 노드를 탐색
		- 검색 개수인 K보다 커야함 
	- 데이터 경향성 : 클러스터링이 어느정도 되어있는 데이터일수록 응답 속도 빠르고 재현율 높음

##### IVFFlat (Inverted File Index)
- 벡터들을 미리 여러 *클러스터 리스트로 분할*하여 검색 시 일부 리스트만 탐색
- *k-평균 군집화*를 통해 벡터 공간을 미리 분할하므로 인덱스 생성 시 약간의 학습 시간이 들지만, HNSW에 비해 *인덱스 생성 속도가 빠르고 메모리 사용이 적은* 장점
- 대신 *검색 정확도를 높이려면 더 많은 리스트를 살펴봐야 하므로* 동일 수준의 정확도에서는 HNSW보다 느릴 수 있음
- IVFFlat 인덱스를 만들려면 몇 개의 리스트로 분할할지(lists 매개변수) 설정해야 하는데, 보통 *데이터 건수의 √N* 수준이나 *N/1000* 수준으로 시작하여 조정
	- 리스트 수가 많을수록 인덱스 크기가 커지고 구축 시간이 늘지만, *정확도*는 높아질 수 있음
- 쿼리 시에는 SET ivfflat.probes = P로 *탐색할 리스트 개수*(기본 1개)를 지정할 수 있는데, probes를 늘릴수록 더 많은 후보를 확인하여 정확도가 올라가지만 속도는 감소
	- 극단적으로 probes를 리스트 총 개수만큼 주면 전체 리스트를 다 뒤지는 셈이 되어 *정확한 검색과 동일* (이 경우 Planner는 인덱스를 쓰지 않고 Sequential Scan으로 간주)
	- 적절한 probes 값(예: 기본값 1에서 시작해 정확도가 부족하면 점차 증가)을 찾는 것이 중요
- IVFFlat도 인덱스 생성 시 벡터 차원을 지정한 연산자 클래스를 사용해야 하며 생성은 HNSW와 동일한 DDL 문법을 따름
- 참고로 *초기에 데이터가 충분히 쌓인 후 인덱스를 만드는 것*이 좋음 
	- 너무 적은 데이터로 인덱스를 만들면 각 리스트에 벡터가 고르게 분포되지 않아 성능이 저하될 수 있으므로, 이런 경우 일정량 누적 후 인덱스를 생성하거나 재작성하는 것이 권장
---
### 5. 실습
##### pgvector & pgadmin 준비
pgvector가 설치된 postgres와 pgadmin을 이용해서 간단하게 pgvector를 사용해볼 수 있다

```yml title="docker-compose.yml"
services:
  postgres:
    image: pgvector/pgvector:pg17
    container_name: postgres-pgvector
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

`http://localhost:5050`으로 접속하면 pgadmin 로그인 화면이 나오고 `docker-compose.yml`에 있는 이메일과 비밀번호로 로그인 할 수 있다

그 후 `새 서버 추가`를 선택하고 [일반]에서 이름은 'pgvector-test', [연결]에서 호스트 이름/주소는 'postgres-pgvector', 포트는 '5432', 접속 데이터베이스/사용자이름/비밀번호는 모두 'postgres'로 설정하면 정상적으로 postgreSQL과 연결이 된다

##### 테이블 생성 및 데이터 삽입
```sql
-- ================================
-- 0) 확장 설치 및 준비
-- ================================
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS doc_vectors;
CREATE TABLE doc_vectors (
  id      SERIAL PRIMARY KEY,
  title   TEXT NOT NULL,
  tags    TEXT[],
  emb     VECTOR(3)  -- 예시라 3차원, 실제에선 384/768/1536 등
);

-- ================================
-- 1) 샘플 데이터 삽입
--    - 서로 유사/상이한 주제를 섞어 배치
-- ================================
INSERT INTO doc_vectors (title, tags, emb) VALUES
  ('AI 기술 소개',        ARRAY['ai','tech'],        '[0.10, 0.20, 0.30]'),
  ('머신러닝 개요',       ARRAY['ai','ml'],          '[0.20, 0.10, 0.40]'),
  ('딥러닝 기초',         ARRAY['ai','dl'],          '[0.12, 0.18, 0.28]'),
  ('요리 레시피 모음',    ARRAY['food','recipe'],    '[0.90, 0.80, 0.70]'),
  ('베이킹 입문',         ARRAY['food','baking'],    '[0.85, 0.78, 0.69]'),
  ('유럽 여행 가이드',    ARRAY['travel','guide'],   '[0.55, 0.20, 0.15]');

-- 기준 문서 id 확인용
SELECT id, title FROM doc_vectors ORDER BY id;
```
- pgvector extension을 설치
- vector(3) 자료형으로 3차원 벡터 자료형을 선언
- list형태의 벡터를 넣어주면 vector 자료형으로 삽입

##### L2 거리를 활용한 검색 예시
```sql
-- ================================
-- 2) L2 거리 (유클리드) 검색 예시
--    연산자: <->  (작을수록 유사)
-- ================================

-- 2-1) 쿼리 벡터로 Top‑3 유사 문서
SELECT id, title, emb <-> '[0.15, 0.15, 0.30]'::vector AS l2_dist
FROM doc_vectors
ORDER BY l2_dist
LIMIT 3;

-- 2-2) 특정 문서(id=1)와 유사한 문서 Top‑3
SELECT id, title,
       emb <-> (SELECT emb FROM doc_vectors WHERE id = 1) AS l2_dist
FROM doc_vectors
WHERE id <> 1
ORDER BY l2_dist
LIMIT 3;

-- 2-3) 임계값 기반 필터 (L2 거리가 0.25 이하)
SELECT id, title
FROM doc_vectors
WHERE emb <-> '[0.15, 0.15, 0.30]'::vector <= 0.25
ORDER BY emb <-> '[0.15, 0.15, 0.30]'::vector;
```
- `::vector`를 이용해서 list형태의 값을 벡터자료형으로 변환해서 검색 가능


##### Inner product를 활용한 검색 예시
```sql
-- ================================
-- 3) 내적(Inner Product) 기반 검색 예시
--    연산자: <#>  (주의: "부호가 반대인 내적값"을 반환)
--    오름차순 정렬 시 내적값이 큰(유사한) 순서와 동일한 효과
-- ================================

-- 3-1) 쿼리 벡터로 Top‑3 (내적 기준)
SELECT id, title,
       emb <#> '[0.15, 0.15, 0.30]'::vector AS neg_inner_product
FROM doc_vectors
ORDER BY neg_inner_product   -- 오름차순 == 내적 큰 순
LIMIT 3;

-- 3-2) 특정 문서(id=1) 기준 Top‑3 (내적 기준)
SELECT id, title,
       emb <#> (SELECT emb FROM doc_vectors WHERE id = 1) AS neg_inner_product
FROM doc_vectors
WHERE id <> 1
ORDER BY neg_inner_product
LIMIT 3;
```
- `<#>` 를 활용해 두 벡터 간의 내적을 구하면 거리가 가까울수록 값이 큼
- pgvector에서는 기본적으로 벡터간 거리가 가까울수록 거리 metric이 작도록 처리하기 때문에 계산 결과는 음수로 나옴

##### Cosine 거리를 활용한 검색 예시
```sql
-- ================================
-- 4) 코사인 거리/유사도 기반 검색 예시
--    연산자: <=>  (코사인 "거리" = 1 - 코사인 "유사도")
--    -> 코사인 유사도 = 1 - (emb <=> query)
-- ================================

-- 4-1) 쿼리 벡터로 Top‑3 (코사인)
SELECT id, title,
       emb <=> '[0.15, 0.15, 0.30]'::vector            AS cosine_distance,
       1 - (emb <=> '[0.15, 0.15, 0.30]'::vector)      AS cosine_similarity
FROM doc_vectors
ORDER BY cosine_distance
LIMIT 3;

-- 4-2) 특정 문서(id=1) 기준 Top‑3 (코사인)
SELECT id, title,
       emb <=> (SELECT emb FROM doc_vectors WHERE id = 1)           AS cosine_distance,
       1 - (emb <=> (SELECT emb FROM doc_vectors WHERE id = 1))     AS cosine_similarity
FROM doc_vectors
WHERE id <> 1
ORDER BY cosine_distance
LIMIT 3;
```
- 내적과 마찬가지로 가까울수록 값이 1에 가깝기 때문에 1에서 값을 빼서 가까울수록 작게 표현

##### 다른 속성의 필터링과 결합
```sql
-- ================================
-- 5) 메타데이터 필터 + 유사도 검색 결합
--    (예: 태그에 'ai' 포함 문서 중에서만 코사인 Top‑3)
-- ================================
SELECT id, title,
       1 - (emb <=> '[0.15, 0.15, 0.30]'::vector) AS cos_sim
FROM doc_vectors
WHERE 'ai' = ANY(tags)
ORDER BY emb <=> '[0.15, 0.15, 0.30]'::vector
LIMIT 3;
```
- tags에 'ai'를 포함하는 책 내에서만 거리를 계산할 수 있음

##### ANN 인덱스 확인용 테이블 생성 및 데이터 삽입
```sql
CREATE TABLE big_vectors (
    id      bigserial PRIMARY KEY,
    emb     vector(1532),
    payload text
);

CREATE OR REPLACE FUNCTION random_vector_1532()
RETURNS vector(1532)
AS $$
	SELECT array_agg((random() * 2 - 1)::real ORDER BY i)::vector(1532)
	FROM generate_series(1, 1532) AS g(i)
$$ LANGUAGE sql VOLATILE;

-- 데이터 삽입 (10만 행 예시, 필요시 행 수 조정) : 25 secs 330 msec.
INSERT INTO big_vectors (emb, payload)
SELECT random_vector_1532(), md5(gs::text)
FROM generate_series(1, 100000) gs;
```
- 1532 차원의 벡터를 담을 수 있는 테이블 생성
- 랜덤하게 1532 차원의 벡터를 생성할 수 있는 UDF 정의
- 정의한 UDF로 100,000개의 데이터 삽입

##### ANN 인덱스 생성 전 Exact Matching 성능 확인
```sql
-- 분석 통계 업데이트
VACUUM ANALYZE big_vectors;

-- 쿼리 벡터 고정
DROP TABLE IF EXISTS qvec;
CREATE UNLOGGED TABLE qvec AS
SELECT random_vector_1532() AS q;


-- 인덱스 없이 정확탐색 성능
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, emb <-> (SELECT q FROM qvec)
FROM big_vectors
ORDER BY emb <-> (SELECT q FROM qvec)
LIMIT 10;
```
- `VACUUM`으로 dead tuple 정리하고 `ANALYZE`로 big_vectors 테이블의 통계 정보 업데이트
- 쿼리에 사용할 벡터 생성해서 WAL에 저장안되는 UNLOGGED 테이블에 저장
- 사전에 생성한 쿼리 벡터와 유사도 기반 검색 수행 -> 'Parallel Seq Scan' 수행
	```text title="인덱스 사용 X" {15}
	Limit  (cost=4167.07..4168.22 rows=10 width=16) (actual time=883.367..885.444 rows=10 loops=1)
	  Buffers: shared hit=499279 read=101982 written=4883
	  InitPlan 1
	    ->  Seq Scan on qvec  (cost=0.00..23.60 rows=1360 width=32) (actual time=0.009..0.009 rows=1 loops=1)
	          Buffers: shared hit=1
	  ->  Gather Merge  (cost=4143.47..10908.23 rows=58824 width=16) (actual time=883.365..885.440 rows=10 loops=1)
	        Workers Planned: 1
	        Workers Launched: 1
	        Buffers: shared hit=499279 read=101982 written=4883
	        ->  Sort  (cost=3143.46..3290.52 rows=58824 width=16) (actual time=878.597..878.599 rows=8 loops=2)
	              Sort Key: ((big_vectors.emb <-> (InitPlan 1).col1))
	              Sort Method: top-N heapsort  Memory: 25kB
	              Buffers: shared hit=499278 read=101982 written=4883
	              Worker 0:  Sort Method: top-N heapsort  Memory: 25kB
	              ->  Parallel Seq Scan on big_vectors  (cost=0.00..1872.30 rows=58824 width=16) (actual time=0.249..869.867 rows=50000 loops=2)
	                    Buffers: shared hit=499241 read=101982 written=4883
	Planning:
	  Buffers: shared hit=4
	Planning Time: 0.169 ms
	Execution Time: 885.477 ms
	```

##### HNSW 인덱스 생성 및 동일한 쿼리 수행
```sql
-- HNSW 인덱스 생성
DROP INDEX IF EXISTS idx_big_vectors_hnsw;
CREATE INDEX idx_big_vectors_hnsw
ON big_vectors USING hnsw (emb vector_l2_ops)
WITH (m = 16, ef_construction = 200);

ANALYZE big_vectors;

-- HNSW 쿼리 (ef_search 변경 가능)
SET hnsw.ef_search = 80;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, emb <-> (SELECT q FROM qvec)
FROM big_vectors
ORDER BY emb <-> (SELECT q FROM qvec)
LIMIT 10;
```
- 인덱스 생성에 12분 30초 정도 소요
	- 인덱스 생성과정에서 메모리를 초과하면 디스크 임시 파일을 사용해서 계속 진행 -> `NOTICE:  hnsw graph no longer fits into maintenance_work_mem after 9239 tuples`
	- 인덱스 빌드 속도는 느려질 수 있지만 완성된 인덱스 자체의 성능에는 큰 영향 없음
- 유사도 기반 검색 수행 -> HNSW 인덱스 사용
	```text title="HNSW index" {6}
	Limit  (cost=1169.23..1209.77 rows=10 width=16) (actual time=4.072..4.189 rows=10 loops=1)
	  Buffers: shared hit=3247
	  InitPlan 1
	    ->  Seq Scan on qvec  (cost=0.00..23.60 rows=1360 width=32) (actual time=0.006..0.007 rows=1 loops=1)
	          Buffers: shared hit=1
	  ->  Index Scan using idx_big_vectors_hnsw on big_vectors  (cost=1145.63..406552.00 rows=100000 width=16) (actual time=4.071..4.186 rows=10 loops=1)
	        Order By: (emb <-> (InitPlan 1).col1)
	        Buffers: shared hit=3247
	Planning:
	  Buffers: shared hit=1
	Planning Time: 0.068 ms
	Execution Time: 4.207 ms
	```

##### IVFFlat 인덱스 생성 및 동일한 쿼리 수행
```sql
-- 기존 hnsw 인덱스 제거
DROP INDEX IF EXISTS idx_big_vectors_hnsw;

-- IVFFlat 인덱스 생성
DROP INDEX IF EXISTS idx_big_vectors_ivf;
CREATE INDEX idx_big_vectors_ivf
ON big_vectors USING ivfflat (emb vector_l2_ops)
WITH (lists = 80);

ANALYZE big_vectors;

-- IVFFlat 쿼리 (probes 변경 가능)
SET ivfflat.probes = 10;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, emb <-> (SELECT q FROM qvec)
FROM big_vectors
ORDER BY emb <-> (SELECT q FROM qvec)
LIMIT 10;
```
- 인덱스를 여러 개 설정할 수 있긴 하지만 여기에서는 hnsw 인덱스 제거
- IVFFlat 인덱스는 메모리 초과할 경우 바로 Error -> `ERROR:  memory required is 506 MB, maintenance_work_mem is 64 MB`
	- 인덱스 빌드할 동안 `SET LOCAL maintenance_work_mem = '1GB';`으로 메모리 크기 확장
	- lists 값 낮춰서 메모리 요구량 감소
- 유사도 기반 검색 수행 -> IVFFlat 인덱스 사용
	```text title="IVFFlat index" {6}
	Limit  (cost=1254.35..1279.90 rows=10 width=16) (actual time=92.153..92.239 rows=10 loops=1)
	  Buffers: shared hit=7490 read=39200
	  InitPlan 1
	    ->  Seq Scan on qvec  (cost=0.00..23.60 rows=1360 width=32) (actual time=0.005..0.006 rows=1 loops=1)
	          Buffers: shared hit=1
	  ->  Index Scan using idx_big_vectors_ivf on big_vectors  (cost=1230.75..256750.50 rows=100000 width=16) (actual time=92.151..92.236 rows=10 loops=1)
	        Order By: (emb <-> (InitPlan 1).col1)
	        Buffers: shared hit=7490 read=39200
	Planning:
	  Buffers: shared hit=1
	Planning Time: 0.073 ms
	Execution Time: 92.257 ms
	```









[^1]: 여러 worker process가 동시에 테이블 나누어 읽는 방식

[^2]: Write Ahead Log. 변경 로그 시스템으로 실제 데이터 파일 수정하기 전에 먼저 로그에 기록하고 이후 데이터 파일에 반영해서 '장애 복구와 데이터 무결성 보장'

[^3]: Point in Time Recovery. WAL 로그를 이용해 특정 시점으로 DB 복구하는 것

[^4]: Primary에서 Standby 서버 간에 실시간으로 WAL 로그를 전달하여 복제하는 방식
