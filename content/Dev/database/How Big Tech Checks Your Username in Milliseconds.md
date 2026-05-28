---
tags:
  - database
created: 2025-06-25T22:33:27
updated: 2025-06-26T00:19:33
permalink: /Dev/database/how-big-tech-checks-your-username-in-milliseconds
---
> [!success]+ 참고영상 
><iframe width="560" height="315" src="https://www.youtube.com/embed/_l5Q5kKHtR8?si=YxlAJuo1AR5VJkzq" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe> 
> 

---
### 1. 문제의식: 왜 유저네임 중복 체크가 어려운가?
- 수십억 명의 사용자가 있는 대규모 서비스에서는 단순한 DB 쿼리로는 성능, 지연, 시스템 부하 문제 발생
- 빠르고 확장성 있는 체크를 위해 다양한 고급 자료구조와 분산 시스템이 필요

---

### 2. 주요 데이터 구조 및 기술

##### 2.1 Redis Hashmap (레디스 해시맵)
- 인메모리 캐시 계층에서 사용.
- 하나의 키 아래 여러 필드-값 쌍 저장 가능.
- 각 필드는 유저네임, 값은 userID나 플래그 등.
- 존재 여부를 즉시 확인(캐시 히트 시 DB 접근 불필요).
- 메모리 한계로 모든 유저네임을 영구 저장 불가.

>비슷한 유저네임을 추천하거나, 특정 접두사로 시작하는 모든 유저네임을 찾는 기능은? -> Trie
##### 2.2 Trie (트라이, Prefix Tree)
- 문자열의 공통 접두사를 공유하는 트리 구조.
- O(M) 시간 복잡도(M=문자열 길이)로 검색 가능(데이터셋 크기와 무관).
- 자동완성, 접두사 기반 추천에 적합.
- 접두사가 겹치면 메모리 절약, 겹치지 않으면 메모리 소모 큼.
- Radix Trie 등 압축 버전 사용, 최근/자주 조회되는 데이터에 한정해 사용.
##### 2.3 B+ Tree (B+트리)
- 정렬된 대용량 데이터셋에서 효율적 검색.
- 관계형/NoSQL DB의 인덱스 구조로 널리 사용.
- O(logN) 시간 복잡도, 얕은 트리 구조로 수십억 개 데이터도 수십 번 이내 탐색.
- 범위 쿼리, 알파벳순 추천 등에 적합.
- 단일 머신 한계 → Google Spanner 등 분산 DB에서 수평 확장.

##### 2.4 Bloom Filter (블룸 필터)
- 메모리 효율적, 확률적 존재 여부 체크.
- 여러 해시함수와 비트 배열로 구성.
- "없음"은 100% 확실, No false negative
- "있음"은 오탐(false positive) 가능.
	- Why?  여러 값이 같은 비트 칸을 공유
		- 해시함수 결과가 겹치면, 실제로 추가하지 않은 값도 모든 칸이 1이 될 수 있음
	- 예시
		- "cat"추가 -> 2, 5, 7 bit  -> 1
		- "dog"추가 -> 1, 5, 8 bit -> 1
		- "rat" 추가 -> 2, 5, 8 bit -> 모두 1이기 때문에 "rat"이 있다고 잘못 판단 
- 1%의 오탐 허용 시 10억 개 유저네임도 1.2GB 내외 메모리로 관리 가능.
- 대규모 시스템에서 DB 불필요 접근 최소화에 활용. 

| Data Structure   | Lookup Speed      | Memory Usage      | Supports Prefix/Autocomplete | False Positives | Best Use Case                        |
| ---------------- | ----------------- | ----------------- | ---------------------------- | --------------- | ------------------------------------ |
| Redis Hashmap    | Very Fast         | High (in-memory)  | No                           | No              | Exact match, recent lookups cache    |
| Trie             | Fast (O(M))       | Moderate~High     | Yes                          | No              | Prefix search, autocomplete, suggest |
| B+ Tree          | Fast (O(logN))    | Moderate          | No (but supports range)      | No              | Sorted/range queries, DB index       |
| Bloom Filter     | Very Fast         | Very Low          | No                           | Yes             | First-line filter, reduce DB hits    |

---

### 3. 대규모 시스템의 실제 아키텍처

##### 1. 로드 밸런싱
   - 글로벌(예: DNS, Anycast) → 지역 데이터센터 → 로컬(예: Nginx, AWS ELB)로 트래픽 분산.

##### 2. Bloom Filter
   - 각 백엔드 서버가 메모리에 블룸 필터 복제본 유지, 주기적 동기화.
   - "없음"이면 즉시 종료, "있음"이면 다음 단계로.

##### 3. In-memory Cache (Redis/Memcached)  
   - 최근/자주 조회된 유저네임은 초고속 응답.
   - 캐시 미스 시만 DB 접근. 

##### 4. 분산 데이터베이스
   - Apache Cassandra, DynamoDB, Spanner 등.
   - 데이터 샤딩, 일관성, 수평 확장으로 수십억 건도 빠르게 처리.

##### 5. 최종 응답
   - 결과를 로드 밸런서를 통해 사용자에게 반환.

---

### 4. 각 자료구조 비교 요약

| 자료구조         | 장점                        | 단점/트레이드오프                | 주요 용도                |
|------------------|-----------------------------|-----------------------------------|-------------------------|
| Redis Hashmap    | 초고속, 정확한 일치         | 메모리 한계, 전체 저장 불가       | 최근/자주 조회 캐시      |
| Trie             | 접두사 검색, 자동완성       | 메모리 소모, 압축 필요            | 추천, 자동완성           |
| B+ Tree          | 정렬/범위 쿼리, 확장성      | 분산 관리 복잡, 단일 머신 한계    | DB 인덱스, 알파벳순 추천  |
| Bloom Filter     | 메모리 효율, 빠른 부정확인  | 오탐 가능, 실제 데이터 저장 X     | 1차 필터, DB 접근 최소화  |

---

### 5. 결론
- 대규모 서비스는 여러 자료구조와 분산 시스템을 계층적으로 조합해 "유저네임 중복 체크"를 수 ms 내에 처리.
- Bloom Filter → In-memory Cache → 분산 DB 순으로 효율적 필터링.
- 이 모든 시스템이 "이미 사용 중인 유저네임" 메시지 뒤에 숨어 있음.
