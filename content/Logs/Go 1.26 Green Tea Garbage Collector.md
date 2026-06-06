---
tags:
  - golang
created: 2026-06-06T00:00:00
updated: 2026-06-06T00:00:00
permalink: /Logs/go-1-26-green-tea-garbage-collector
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Go 1.25에서 실험적 도입, Go 1.26에서 기본 탑재된 새 GC
> - 기존 mark-sweep 방식을 유지하되, 메모리 페이지 단위로 스캔하여 최대 40% GC 성능 향상
> - 512바이트 미만 소형 객체를 8KiB span 단위로 처리하여 CPU 캐시 효율 개선

> [!cite]+ Source
> <iframe width="560" height="315" src="https://www.youtube.com/embed/l4lneZYtjQg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

---

### 1. Mark-Sweep GC란

Green Tea를 이해하려면 먼저 기존 mark-sweep 방식을 알아야 한다.

가비지 컬렉터(GC)는 프로그램이 더 이상 사용하지 않는 메모리를 자동으로 회수하는 장치다. Mark-sweep은 GC의 가장 기본적인 알고리즘으로, 이름 그대로 두 단계로 동작한다.

##### Mark 단계

프로그램이 현재 사용 중인 변수(루트)에서 출발하여, 포인터를 따라가며 도달할 수 있는 모든 객체에 "사용 중" 표시를 한다.

```
루트 변수 → 객체A → 객체B → 객체D
                  → 객체C
```

위 예시에서 A, B, C, D는 루트에서 도달 가능하므로 "살아있는" 객체다. 어디서도 참조하지 않는 객체 E가 있다면, mark되지 않는다.

##### Sweep 단계

힙 메모리 전체를 훑으면서, mark되지 않은 객체의 메모리를 회수한다. 위 예시에서 객체 E가 이 단계에서 해제된다.

> [!note]+ Mark-Sweep의 한계
> 단순하고 확실하지만, mark 단계에서 **모든 살아있는 객체를 포인터로 따라가야 한다**는 점이 성능 병목이다. 객체가 메모리 곳곳에 흩어져 있으면, 포인터를 따라갈 때마다 CPU 캐시 미스가 발생한다.

---

### 2. 포인터 추적(Pointer Chasing)의 문제

Mark 단계에서 GC는 객체 안의 포인터를 읽고, 그 포인터가 가리키는 다음 객체로 점프하는 과정을 반복한다. 이것이 **포인터 추적(pointer chasing)**이다.

```
객체A (주소 0x1000) → 포인터 → 객체B (주소 0x8F00) → 포인터 → 객체C (주소 0x2400)
```

문제는 객체들이 메모리에서 **연속된 위치에 있지 않다**는 것이다. 객체가 할당·해제를 반복하면 힙 전체에 흩어지게 되고, 다음 객체의 주소가 예측 불가능한 위치로 점프한다. 이것이 **랜덤 포인터 추적**이다.

CPU는 메모리를 읽을 때 주변 데이터를 캐시 라인(보통 64바이트) 단위로 함께 가져온다. 연속된 메모리를 읽으면 이미 캐시에 올라와 있어 빠르지만, 랜덤한 주소로 점프하면 매번 메인 메모리까지 가야 한다.

- **캐시 히트** (L1 캐시): ~1ns
- **캐시 미스** (메인 메모리): ~100ns

100배 차이가 나기 때문에, 객체가 수백만 개인 프로그램에서 GC 성능이 크게 저하된다.

---

### 3. Green Tea GC의 접근

Go 1.26부터 기본 활성화된 새로운 가비지 컬렉터다. 기존 GC와 동일한 mark-sweep 방식을 사용하지만, 개별 객체가 아닌 **메모리 페이지 단위**로 스캔하여 랜덤 포인터 추적 문제를 해결한다.

- 전역 수준에서는 페이지 단위로 추적
- 페이지 내부에서는 개별 객체를 로컬로 추적
- 512바이트 미만 소형 객체를 8KiB span 단위로 묶어서 처리

기존 GC가 `객체A → 객체B → 객체C`를 포인터로 하나씩 쫓아갔다면, Green Tea는 **8KiB 페이지 안의 객체들을 순서대로 쭉 스캔**한다. 랜덤 점프 대신 순차 읽기가 되므로 CPU 캐시 프리페칭이 동작하고, 캐시 히트율이 올라간다.

---

### 4. 성능 개선

- 대부분의 워크로드에서 GC 시간 약 10% 감소
- 일부 워크로드에서 최대 40% 감소
- 최신 AMD64 CPU에서 추가 10% 개선 기대

---

### 5. 적용 방법

Go 1.26에서는 기본 활성화되어 별도 설정이 필요 없다.

```bash
# Go 1.25에서 실험적 사용
GOEXPERIMENT=greenteagc go build

# Go 1.26에서 비활성화 (옵트아웃, 1.27에서 제거 예정)
GOEXPERIMENT=nogreenteagc go build
```
