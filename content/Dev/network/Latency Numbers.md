---
tags:
  - cs
  - system-design
  - performance
created: 2026-04-22T00:00:00
updated: 2026-05-10T17:40:42
permalink: /dev/network/latency-numbers
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> 컴퓨터의 각 저장 계층(L1 캐시 ~ HDD)은 한 단계 내려갈 때마다 10~100배씩 느려진다. 이 숫자 감각이 있어야 캐시, DB 선택, 시스템 설계에서 올바른 판단을 내릴 수 있다.

> [!cite]+ Source
> - [메모리,SSD,HDD 레이턴시 제대로 말할 수 있나요? - 코딩하는기술사](https://youtube.com/watch?v=jNwI1ABWmbQ)
> - [Latency Numbers Every Programmer Should Know - Jonas Boner](https://gist.github.com/jboner/2841832)
> - [Humanized version - hellerbarde](https://gist.github.com/hellerbarde/2843375)

---

### 1. Latency가 왜 중요한가

시스템 성능은 처리량(throughput)만으로 결정되지 않는다. 아무리 대역폭이 넓어도, 한 번의 요청-응답에 걸리는 시간(latency)이 길면 전체 파이프라인이 병목에 걸린다.

예를 들어 DB 쿼리 한 번에 10ms가 걸리면, 직렬로 10번 호출하는 API는 최소 100ms다. 이런 감각 없이 설계하면 "왜 느린지 모르겠다"는 상황에 빠진다.

---

### 2. Memory hierarchy

컴퓨터의 저장 장치는 계층 구조로 되어 있다. 위로 갈수록 빠르고 작고 비싸며, 아래로 갈수록 느리고 크고 싸다.

```
CPU Registers  (~0.1 ns, 수 바이트)
    ↓
L1 Cache       (~1 ns, 32-64 KB/코어)
    ↓
L2 Cache       (~4-7 ns, 256 KB - 1 MB/코어)
    ↓
L3 Cache       (~20-40 ns, 8-64 MB 공유)
    ↓
Main Memory    (~100 ns, 8-512 GB)
    ↓
NVMe SSD       (~10-150 us, 256 GB - 8 TB)
    ↓
SATA SSD       (~50-200 us, 256 GB - 4 TB)
    ↓
HDD            (~5-10 ms, 1-20 TB)
    ↓
Network        (~0.5-150 ms, 무제한)
```

핵심은 각 단계가 대략 **10~100배** 느려진다는 것이다. L1 캐시에서 메인 메모리까지만 해도 200배 차이가 난다.

---

### 3. The numbers

Jeff Dean(Google)이 정리하고, Jonas Boner가 널리 알린 레이턴시 수치다. 시스템 설계 면접에서도 자주 등장한다.

| Operation               | Latency                 | 비고        |
| ----------------------- | ----------------------- | --------- |
| *L1 cache reference*    | 0.5 ns                  | 기준점       |
| Branch mispredict       | 5 ns                    | L1의 10배   |
| *L2 cache reference*    | 7 ns                    | L1의 14배   |
| Mutex lock/unlock       | 25 ns                   |           |
| *Main memory reference* | 100 ns                  | L1의 200배  |
| 1KB를 Snappy로 압축         | 3,000 ns (3 us)         |           |
| 1 Gbps 네트워크로 1KB 전송     | 10,000 ns (10 us)       |           |
| *SSD random read (4KB)* | 150,000 ns (150 us)     |           |
| 메모리에서 1MB 순차 읽기         | 250,000 ns (250 us)     |           |
| 같은 데이터센터 왕복             | 500,000 ns (0.5 ms)     |           |
| SSD에서 1MB 순차 읽기         | 1,000,000 ns (1 ms)     | 메모리의 4배   |
| *HDD seek*              | 10,000,000 ns (10 ms)   | SSD의 ~67배 |
| HDD에서 1MB 순차 읽기         | 20,000,000 ns (20 ms)   | 메모리의 80배  |
| CA → 네덜란드 → CA 패킷 왕복    | 150,000,000 ns (150 ms) | 빛의 속도 한계  |

> [!tip]+ 체감 비유: 1나노초 = 1초라면?
> L1 캐시 접근(~1 ns)을 1초로 환산하면 나머지 계층이 얼마나 걸리는지 직관적으로 보인다.
> - L1 캐시 = **1초**
> - 메인 메모리 = **1분 40초**
> - NVMe SSD = **5시간 30분**
> - SATA SSD = **28시간**
> - HDD = **약 2개월**
>
> CPU 입장에서 RAM을 기다리는 건 1~2분이지만, NVMe SSD를 기다리는 건 반나절이고, HDD를 기다리는 건 두 달 휴가다.

---

### 4. Modern hardware

위 수치는 2012년 기준이다. 최신 하드웨어에서 달라진 부분이 있다.

| Operation | 2012 | 2024+ | 변화 |
|---|---|---|---|
| SSD random read (4KB) | 150 us | 10-20 us | NVMe가 10배 빠름 |
| SSD 1MB 순차 읽기 | 1 ms | 0.2-0.5 ms | NVMe 순차 ~5 GB/s |
| Main memory reference | 100 ns | 50-100 ns | DDR5로 대역폭 개선, 레이턴시는 비슷 |
| HDD seek | 10 ms | 5-10 ms | 기계적 한계로 거의 변화 없음 |

크게 달라진 것은 **NVMe SSD**다. 기존 SATA SSD 대비 10배 가까이 빨라지면서, 순차 읽기 성능이 메모리에 근접하기 시작했다. 이 덕분에 RocksDB 같은 디스크 기반 DB도 저레이턴시 워크로드에 쓸 수 있게 되었다.

반면 DRAM 레이턴시와 HDD seek은 10년 전과 크게 다르지 않다. DRAM은 대역폭은 늘었지만 접근 지연은 물리적으로 줄이기 어렵고, HDD는 기계식 회전 구조의 한계다.

---

### 5. Practical implications

이 숫자들이 실무에서 의미하는 것을 정리한다.

#### 흔한 오해: "최신 SSD니까 충분히 빠르겠지"

NVMe SSD가 빨라진 건 사실이지만, 그래도 **RAM보다 약 200배 느리다**. "SSD로 바꿨으니까 Redis 같은 캐시가 필요 없다"는 위험한 판단이다. 하드웨어가 발전해도 계층 간 속도 격차는 계속 유지되고 있다.

#### Cache layer가 필요한 이유

DB에서 디스크를 읽으면 수 ms가 걸리지만, Redis 같은 인메모리 캐시는 ~100 ns 수준이다. 자주 읽히는 데이터를 캐시에 올리는 것만으로 **1만 배 이상** 빨라질 수 있다.

#### Sequential vs random access

앞서 다룬 수치는 모두 **랜덤 액세스** 기준이다. 랜덤은 매번 새로운 위치로 점프해야 하므로 레이턴시가 지배적이다. 반면 순차 읽기는 한번 접근한 후 연속된 데이터를 스트리밍하기 때문에 처리량(throughput)이 지배적이다. NVMe SSD의 순차 처리량은 수 GB/s에 달한다.

같은 NVMe SSD라도 **작은 랜덤 읽기 1만 번**과 **큰 파일 1개를 순차 읽기**하는 것은 성능 차이가 크다. 이것이 DB 인덱스 설계가 중요한 이유이고, LSM-tree 기반 DB(RocksDB, Cassandra)가 쓰기를 순차적으로 모아서 처리하는 이유다.

#### Network latency는 물리 법칙

빛이 광섬유를 통과하는 속도는 ~200,000 km/s다. 서울-미국 서부 간 편도 거리가 ~9,000 km이니 물리적 하한이 ~45 ms다. 기술로 줄일 수 없는 영역이므로, 사용자와 가까운 edge에 데이터를 배치하는 것이 유일한 해법이다.

#### Waterfall effect

네트워크 호출을 직렬로 3번 하면 레이턴시가 3배다. 300 ms 링크에서 3번 직렬 호출하면 900 ms. 이것이 GraphQL 배칭, 병렬 요청, 서버 사이드 렌더링이 중요한 이유다.

---

### 6. Summary table

개발자가 기억해야 할 핵심 비율을 정리한다.

- L1 → 메인 메모리: **200배**
- 메인 메모리 → SSD: **1,000배**
- SSD → HDD: **~67배**
- 같은 데이터센터 왕복 → 대륙 간 왕복: **300배**

> [!note]+ 면접에서 자주 나오는 질문
> "레이턴시 숫자를 외워라"가 아니라 **자릿수(order of magnitude)** 감각을 요구하는 것이다. ns / us / ms 단위 구분과 각 계층 간 비율을 알면 충분하다.
