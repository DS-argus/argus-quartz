---
tags:
  - cs
  - network
  - linux
  - concurrency
created: 2026-07-01T00:00:00
updated: 2026-07-03T13:46:05
permalink: /Dev/CS/busy-polling-and-spinlock
---
> [!abstract]+ TL;DR
> - busy polling은 non-blocking 자원을 멈추지 않고 반복 확인하는 synchronous 방식 — 보통은 CPU를 태우는 낭비
> - epoll 같은 준비완료 통지가 되묻기를 없애 표준이지만 수 마이크로초 지연이 아까운 저지연 도메인은 스핀을 선택
> - 고빈도 트레이딩·DPDK·SO_BUSY_POLL·spinlock이 대표 사례 — 코어 하나를 태워 지연을 사는 거래

> *AI-assisted*

---
### 1. busy polling이란

[[Concurrency and Parallelism#8. 직교하는 두 축 — synchronous/asynchronous, blocking/non-blocking|Concurrency and Parallelism]]에서 동기/비동기와 블로킹/논블로킹을 직교하는 두 축으로 갈랐다.   
그중 **synchronous + non-blocking** 조합이 busy polling의 뿌리다.

- non-blocking 호출은 지금 끝낼 수 없으면 즉시 돌아온다
- 그 결과를 그 자리서 판단하고(synchronous), 아직이면 다시 묻는다
- 이 "다시 묻기"를 멈추지 않고 반복하는 것이 **바쁜 대기**(busy polling)다

```python
sock.setblocking(False)
while True:
    try:
        data = sock.recv(4096)   # 데이터 없으면 즉시 예외
        break
    except BlockingIOError:
        pass                     # 계속 되물음 — 그동안 코어를 태움
```

스레드가 멈추지는 않는다. 대신 코어 하나를 붙잡고 "됐나?"만 반복한다.

---
### 2. 보통은 낭비다 — epoll이 표준인 이유

busy polling의 문제는 준비되지 않은 자원에도 CPU를 계속 쓴다는 점이다. 소켓 하나가 데이터를 받기까지 수십 밀리초가 걸린다면, 그 사이 수백만 번을 헛되이 되묻는다.

그래서 표준 해법은 운영체제에 감시를 맡기는 것이다.

- non-blocking 소켓 수천 개를 일일이 되묻는 대신,
- `epoll`(리눅스)·`kqueue`(BSD·macOS)에 "준비된 것만 알려달라"고 등록한다
- 준비된 자원만 골라 그때 한 번 읽는다

이러면 되묻는 낭비가 사라진다. event loop가 수천 연결을 한 스레드로 감당하는 원리다. 자세한 동작은 [[Concurrency and Parallelism#11. 비동기 I/O의 실제 동작|비동기 I/O절]]에서 다룬다.

---
### 3. 그런데도 스핀을 택하는 이유 — 재우기·깨우기 지연

blocking은 공짜가 아니다. 스레드가 blocking으로 대기하면 커널이 그 스레드를 재우고(sleep), 자원이 준비되면 다시 깨운다(wake).

이 과정에는 비용이 붙는다.

- 재우고 깨우는 두 번의 context switch
- 스케줄러가 다시 이 스레드를 골라 실행하기까지의 지연
- 깨어난 뒤 식어버린 CPU 캐시를 다시 채우는 비용

합치면 대략 **수 마이크로초**다. 대부분의 프로그램에는 무시할 값이지만 마이크로초 단위가 손익을 가르는 도메인에서는 이 지연이 아깝다. 그래서 스레드를 아예 재우지 않고 non-blocking 계속 확인하며 깨어 있게 둔다.

> [!tip]+ 트레이드오프
> busy polling은 코어 하나를 통째로 태워 그 수 마이크로초의 깨우기 지연을 없앤다. "CPU를 쓴다"가 단점이 아니라, 지연을 사기 위해 치르는 값이다.

---
### 4. 실제로 스핀을 쓰는 곳

- **고빈도 트레이딩**(HFT): 주문 지연 나노·마이크로초가 수익으로 직결된다. 스레드를 재우지 않고 스핀하며 시세를 받는다
- **DPDK[^1] 같은 커널 우회**: 커널 인터럽트에 의존하지 않고 non-blocking으로 NIC의 링 버퍼를 쉬지 않고 폴링해 패킷을 가져온다
- **리눅스 `SO_BUSY_POLL` · NAPI busy poll**: 소켓 수신 경로의 지연을 줄이려 커널이 잠깐 스핀하도록 켜는 옵션이다
- **spinlock**: 락을 기다릴 때의 스핀. 다음 절에서 따로 본다

---
### 5. spinlock — 짧은 임계 구역의 스핀

락도 같은 선택에 놓인다. 락을 못 잡았을 때 무엇을 할지가 갈린다.

- **뮤텍스**(blocking): 스레드를 재우고, 락이 풀리면 깨운다
- **spinlock**(spinning): 재우지 않고 짧게 계속 시도한다

```c
while (!try_lock(&lock)) {
    /* 아무 일도 하지 않고 다시 시도 — spin */
}
```

임계 구역이 아주 짧으면 재웠다 깨우는 비용이 임계 구역 자체보다 커진다. 이럴 때는 잠깐 스핀하며 기다리는 편이 싸다. 반대로 오래 걸리는 구역을 스핀으로 기다리면 코어를 헛돌리므로 손해다. 그래서 spinlock은 "임계 구역이 짧고 재우기 비용이 아까울 때"만 쓴다. 멀티코어 커널 내부가 대표적인 무대다.

---
### 6. 선택 기준 — blocking vs spin

|          | blocking (재우기)    | spin (busy polling) |
| -------- | ----------------- | ------------------- |
| 대기 중 CPU | 반납                | 계속 점유               |
| 깨우기 지연   | 있음(수 마이크로초)       | 거의 없음               |
| 적합한 상황   | 대기가 길거나 언제 끝날지 모름 | 대기가 짧고 지연이 손익을 가름   |
| 예        | 일반 서버 I/O, 긴 락    | HFT, 커널 우회, 짧은 락    |

blocking이 기본값이고 spin은 예외다. "언제 깨어날지 모르는 긴 대기"에는 재우는 편이 맞고 "곧 준비될 짧은 대기 + 마이크로초가 아까운 상황"에서만 스핀이 이긴다.

[^1]: 리눅스 등 범용 운영체제의 커널을 우회하여(Kernel Bypass), 사용자 공간(User Space)에서 네트워크 인터페이스 카드(NIC)와 직접 데이터를 주고받게 해주는 오픈소스 고성능 패킷 처리 프레임워크
