---
tags:
  - cs
  - linux
created: 2026-07-04T00:00:00
updated: 2026-07-05T14:30:14
permalink: /Dev/CS/system-call
---
> [!abstract]+ TL;DR
> - syscall은 권한이 제한된 유저 프로그램이 커널에게 특권 작업을 요청하는 유일한 공식 통로
> - user mode와 kernel mode의 권한 분리가 존재 이유이며, 호출마다 모드 전환 비용이 붙음
> - read·write·mmap·fork 등 I/O·메모리·프로세스 작업이 전부 syscall이고, 라이브러리 함수는 그 얇은 껍데기

> *AI-assisted*

---
### 1. 왜 있나 — 권한이 나뉘어 있어서

CPU는 권한이 다른 두 모드로 돈다.

- **user mode**: 권한이 제한된 상태. 우리가 짠 프로그램은 여기서 실행된다(x86의 ring 3)
- **kernel mode**: 뭐든 할 수 있는 특권 상태. 커널만 여기서 실행된다(ring 0)

유저 프로그램은 user mode에 갇혀 **하드웨어나 커널 자원을 직접 건드릴 수 없다.** 디스크에 직접 쓰거나, 네트워크 카드를 조작하거나, 다른 프로세스의 메모리를 보는 게 전부 금지다. 이유는 둘이다.

- **보안**: 아무 프로그램이나 디스크·메모리·장치를 직접 만지면 격리가 무너진다
- **안정성**: 잘못된 접근 하나가 시스템 전체를 망가뜨리면 안 된다

그래서 이런 **특권 작업**이 필요하면 커널에 부탁해야 하고, 그 부탁의 통로가 system call이다.

---
### 2. syscall이란 — 커널에 일을 시키는 공식 창구

**system call**(syscall, 시스템 콜)은 유저 프로그램이 커널에게 특권 작업을 요청하는 인터페이스다.   
커널이 유저 공간에 노출한 "허용된 요청 목록"이라, 유저는 아무 커널 함수나 부르는 게 아니라 **커널이 열어둔 syscall만** 부를 수 있다. 리눅스에는 대략 수백 개가 있다.

비유하면, 호텔 손님(유저 프로그램)은 자기 방에만 있을 수 있고 주방·전기실·금고(하드웨어·커널 자원)엔 못 들어간다. 음식이 필요하거나 설비를 고치려면 **프런트에 전화**(syscall)해서 직원(커널)에게 부탁한다. 직원은 마스터키(kernel mode)를 갖고 어디든 가고, 손님은 방(user mode)에 갇혀 있다.

즉 syscall은 **유저 공간과 커널 공간을 가르는 선이자, 그 선을 넘는 유일한 통제된 문**이다.

---
### 3. 무엇이 syscall인가

특권이 필요한 작업은 카테고리별로 이렇게 나뉜다.

| 분류         | 대표 syscall                                                        |
| ---------- | ----------------------------------------------------------------- |
| 파일·디스크 I/O | `open`, `read`, `write`, `close`, `lseek`, `stat`, `fcntl`, `dup` |
| 네트워크       | `socket`, `bind`, `listen`, `accept`, `connect`, `send`, `recv`   |
| 프로세스       | `fork`, `execve`, `exit`, `wait`, `clone`                         |
| 메모리        | `mmap`, `munmap`, `brk`                                           |
| 시간·스케줄     | `nanosleep`, `clock_gettime`, `sched_yield`                       |
| 동기화·IPC    | `futex`, `pipe`, `shmget`                                         |
| I/O 감시     | `select`, `poll`, `epoll_create1`, `epoll_ctl`, `epoll_wait`      |

공통점은 전부 **커널만 할 수 있는 일**이다. 반대로 **syscall이 아닌 것**도 분명하다.   
순수 계산(`a + b`), 메모리 안 데이터 조작, `strlen`·`memcpy` 같은 유저 공간 처리 등은 커널 도움 없이 CPU가 user mode에서 직접 처리하므로 syscall이 아니다.

---
### 4. 어떻게 동작하나 — 모드 전환

각 syscall에는 **번호**가 붙는다(x86-64 리눅스에서 `read`는 0, `write`는 1, `open`은 2 식이다). 호출 흐름은 이렇다.

```text {3,7}
유저 프로그램 (user mode)
   │  ① syscall 번호(rax) + 인자(rdi, rsi, rdx, ...)를 레지스터에 세팅
   │  ② `syscall` 명령 실행 ──── 모드 전환 ────▶
   ▼
커널 (kernel mode)
   │  ③ syscall table[번호]에서 핸들러를 찾아 실행 (권한 검사 + 실제 작업)
   │  ④ 결과를 rax에 담아 복귀 ──── 모드 전환 ────▶
   ▼
유저 프로그램 (user mode) — 반환값을 받고 이어서 실행
```

핵심은 ②·④의 **모드 전환**이다.   
특수한 CPU 명령(x86-64의 `syscall`, 예전에는 소프트웨어 인터럽트 `int 0x80`)이 user mode에서 kernel mode로 넘어가며 커널의 고정된 진입점으로 점프시키고, 커널은 번호로 처리기를 찾아 실행한 뒤 다시 user mode로 돌려보낸다.   
유저 프로그램은 커널의 임의 코드를 못 부르고, 오직 이 정해진 진입점으로 **번호로 지정된 syscall만** 요청할 수 있다.

---
### 5. 왜 비싼가, 그리고 줄이는 법

syscall은 일반 함수 호출보다 비싸다. 같은 user mode 안에서 점프만 하면 되는 함수와 달리, syscall은 **권한 레벨을 바꾸고 커널로 들어갔다 나오는 왕복**이 붙는다. 레지스터 저장·복원, 모드 전환, 파이프라인·캐시 영향까지 더해 대략 수십에서 수백 나노초가 든다. 함수 호출이 수 나노초인 것과 대비된다.

그래서 성능이 중요한 시스템은 **syscall 횟수를 줄이는** 방향으로 설계된다.

- **batching**: 여러 작업을 한 번의 syscall로 묶는다. `writev`(여러 버퍼를 한 번에 쓰기), `sendmmsg`(여러 메시지 한 번에), 그리고 [[IO Multiplexing - select, poll, epoll#7. epoll — 관심 목록을 커널이 들고 있는다|epoll]]이 관심 목록을 매번 넘기지 않고 `epoll_ctl`로 한 번만 등록하는 것도 같은 발상이다
- **vDSO**: `gettimeofday`·`clock_gettime`처럼 읽기 전용이고 빈번한 일부 호출은, 커널이 해당 데이터를 유저 공간에 매핑해줘 **모드 전환 없이** 처리하게 한다. 시간 조회에 매번 커널로 안 들어가도 된다
- **io_uring**: 최신 리눅스의 비동기 I/O 인터페이스. 유저와 커널이 공유하는 링 버퍼로 요청·완료를 주고받아 I/O마다 syscall을 부르지 않는다. 고성능 서버가 syscall 병목을 줄이는 최신 수단이다

---
### 6. 라이브러리 함수는 syscall의 껍데기

보통 syscall을 직접 부르지 않고 **라이브러리 함수로** 부른다. 여기서 "함수인가 syscall인가"는 층위를 나눠 봐야 한다.

- **얇은 래퍼**: C의 `read()`·`write()`는 glibc가 제공하는 래퍼다. 레지스터를 세팅하고 `syscall` 명령을 실행하는, 사실상 syscall 그 자체의 껍데기다
- **고수준 함수**: `printf`는 서식을 처리한 뒤 결국 `write` syscall로 화면에 낸다. `malloc`은 대개 유저 공간에서 미리 확보한 메모리를 관리하다, 부족할 때만 `brk`·`mmap` syscall로 커널에서 더 받아온다
- **다른 언어**: Python의 `open()`·`socket`·`time.sleep()`도 CPython이 C 레벨에서 해당 syscall을 부른다

직접 부르고 싶으면 libc의 범용 래퍼를 쓸 수 있다.

```c
#include <unistd.h>
#include <sys/syscall.h>

write(1, "hi\n", 3);                 // 보통은 이렇게 (libc 래퍼)
syscall(SYS_write, 1, "hi\n", 3);    // 실제로 내려가는 모습 (번호로 직접)
```

---
### 7. 눈으로 보기 — strace

프로그램이 실제로 어떤 syscall을 부르는지는 `strace`로 엿볼 수 있다.

```bash
strace ./program        # 실행하는 모든 syscall을 순서대로 출력
strace -c ls            # syscall별 호출 횟수·시간 요약
strace -f python app.py # 자식 프로세스까지 추적
```

`-c` 요약을 보면 프로그램이 커널에 무엇을 얼마나 요청하는지 한눈에 들어온다.

```
% time     calls    syscall
------ --------- ----------------
 ...      ...     openat
 ...      ...     read
 ...      ...     write
 ...      ...     mmap
```

성능 문제를 팔 때도 유용하다. 같은 일을 하면서 syscall을 과도하게 부르면(예: 한 바이트씩 `read`) 여기서 드러난다.

---
### 8. blocking과 syscall — 대기는 syscall 안에서 일어난다
[[Concurrency and Parallelism#blocking / non-blocking — "기다리는 동안 호출자의 흐름이 멈추나"|blocking / non-blocking]]에서  "블로킹 대기"가 실제로 벌어지는 자리가 바로 syscall 내부다.   
blocking `read`·`accept`·`futex`는 조건이 안 맞으면 **syscall 안에서 커널이 호출 스레드를 재운다**(Blocked). 커널이 그 스레드를 해당 자원의 대기 큐에 걸고 sleep시켰다가, 준비되면 깨워 syscall을 마저 진행시킨다.

- **blocking**: syscall이 조건 충족까지 안 돌아온다. 그동안 스레드는 커널 안에서 잠들어 CPU를 놓는다
- **non-blocking**(`O_NONBLOCK`): 지금 못 하면 syscall이 즉시 `EAGAIN`을 돌려주고 돌아온다. 재우지 않는다

그래서 Blocked 상태, [[Busy Polling and Spinlock|busy polling]]에서 스레드를 재우는 비용, [[IO Multiplexing - select, poll, epoll|epoll]]이 준비될 때까지 `epoll_wait`에서 잠드는 것이 전부 "syscall 안에서 커널이 스레드를 sleep시킨다"는 한 메커니즘의 다른 얼굴이다.

---
### 9. 관련 개념

- [[Python GIL]]: 커널이 존재를 모르는 유저 공간 잠금. syscall의 반대편에 있다
- [[IO Multiplexing - select, poll, epoll]]: select·epoll이 모두 syscall이고, epoll은 그 호출·전달을 줄인다
- [[Socket]]: `socket`·`send`·`recv`가 syscall이며, fd의 세 층 구조도 여기서 이어진다
- [[Concurrency and Parallelism]]: context switch와 blocking 모두 커널이 syscall·인터럽트를 계기로 주도한다
