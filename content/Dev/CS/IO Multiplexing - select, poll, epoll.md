---
tags:
  - cs
  - network
  - linux
created: 2026-07-03T00:00:00
updated: 2026-07-05T14:10:24
permalink: /Dev/CS/io-multiplexing-select-poll-epoll
---
> [!abstract]+ TL;DR
> - I/O multiplexing은 한 스레드가 여러 fd를 동시에 감시하다 준비된 것만 처리하는 기법 — 연결당 스레드의 확장 한계를 넘는 방법
> - select→poll→epoll은 "매 호출마다 전체 fd를 커널에 넘기고 O(n)로 스캔"하던 비용을, epoll이 "관심 목록 한 번 등록 + 준비된 것만 반환"으로 없앤 진화
> - epoll의 커널 자료구조와 edge-triggered 동작을 이해하면 event loop·asyncio·nginx의 밑바탕이 잡힘

> *AI-assisted*

---
### 1. 왜 필요한가 — 연결당 스레드의 한계

서버가 수만 개의 연결을 동시에 다뤄야 한다고 하자. 가장 단순한 방법은 **연결 하나에 스레드 하나**를 배정하고 각 스레드가 자기 소켓을 `read`로 기다리는 것이다. 코드는 직관적이지만 규모가 커지면 무너진다.

- 스레드마다 스택(대략 수 MB)이 붙어 메모리가 금세 바닥난다
- 스레드 수천 개를 스케줄링하면 일하는 시간보다 [[Concurrency and Parallelism|context switch]] 하는 시간이 늘어난다
- 대부분의 연결은 사실 **놀고 있다**. 채팅 서버라면 각 사용자는 대개 입력을 기다리는 중이다

여기서 낭비가 보인다. 거의 놀고 있는 연결마다 스레드 하나를 통째로 묶어두는 것이다. 이 문제가 유명한 **C10K**(연결 1만 개를 한 서버가 감당하기)다.

해법의 방향은 반대다. **스레드 하나가 모든 연결을 감시하다가, 실제로 데이터가 온 연결만 골라 처리**한다. 이것이 I/O multiplexing이고 select에서 poll, epoll로 이어지며 발전해온 세 세대의 도구다.

---
### 2. fd와 blocking — "준비됐다"가 무엇인가

리눅스에서 [[Socket|소켓]]·파일·파이프는 모두 **파일 디스크립터**(fd)로 다뤄진다.  
소켓 fd가 **읽을 준비됨**이란 그 수신 버퍼에 데이터가 도착해 있다는 뜻이고 **쓸 준비됨**이란 송신 버퍼에 여유가 있다는 뜻이다.

문제는 기본 `read`가 **blocking**이라는 데 있다. 데이터가 없으면 그 스레드를 재워(Blocked) 도착할 때까지 세운다.   
그래서 blocking `read` 하나로는 **한 번에 fd 하나만** 기다릴 수 있다. 여러 연결을 한 스레드로 기다리려면 다른 수단이 필요하다.

fd에 **`O_NONBLOCK`** 플래그를 켜면(열 때 지정하거나 이미 열린 fd에 `fctnl`이라는 이미 열린 fd의 속성을 바꾸는 [[System Call|syscall]] 을 토글) 그 fd의 I/O가 blocking하지 않게 된다.   
이 fd에 `read`를 부르면 읽을 데이터가 있을 땐 바로 가져오지만 **데이터가 없으면 스레드를 재우지 않고 즉시 `EAGAIN`[^1]을 돌려주고 돌아온다**.  
그럼 모든 fd를 돌며 non-blocking `read`를 반복하면 되지 않을까 싶지만 그건 준비되지 않은 fd까지 계속 되묻느라 코어를 태우는 [[Busy Polling and Spinlock|busy polling]]이 된다.

**I/O multiplexing은 그 중간이다.** 커널에게 "이 fd들을 감시하다가 준비된 게 생기면 알려달라"고 맡기고 준비된 게 없으면 스레드는 잠든다. 되묻는 낭비도 없고 스레드 하나로 수많은 fd를 기다린다.

---
### 3. I/O multiplexing이라는 발상

핵심은 **fd 여러 개를 인자로 받아, 그중 하나라도 준비될 때까지 blocking하다가, 준비된 것들을 알려주는 시스템 콜** 하나다.

- 준비된 fd가 없으면 호출 스레드는 잠든다(Blocked): CPU를 쓰지 않는다
- 어떤 fd가 준비되면 커널이 스레드를 깨운다
- 스레드는 준비된 fd만 처리하고 다시 호출로 돌아가 잠든다

이 순환 하나가 event loop의 핵심 동작이다. select·poll·epoll이 바로 이 순환을 구현하며 select에서 epoll로 갈수록 fd를 많이 감시할 때의 비용이 줄어든다.

---
### 4. select() — 최초의 해법과 세 가지 한계

가장 오래된 표준이다. fd 집합을 **비트마스크**(`fd_set`)로 표현하고 매크로로 켜고 끈다.

```c {10,12}
#include <sys/select.h>

fd_set allset, rset;             // allset = 감시할 fd 전체 목록, rset = select에 넘길 작업용 사본
FD_ZERO(&allset);                // 목록을 비운다 (비트를 전부 0으로)
FD_SET(listen_fd, &allset);      // listen 소켓을 감시 목록에 추가 (새 연결이 오는지 지켜봄)
int maxfd = listen_fd;           // 등록된 fd 중 가장 큰 번호 (select에 넘길 범위)

for (;;) {                       // 서버 메인 루프
    rset = allset;               // 사본을 만든다 — select가 rset을 "준비된 fd만 남긴 집합"으로 덮어쓰므로 원본(allset)은 보존
    select(maxfd + 1, &rset, NULL, NULL, NULL);   // 커널에 감시를 맡긴다. 하나라도 준비될 때까지 이 스레드는 blocking(잠듦)

    for (int fd = 0; fd <= maxfd; fd++) {   // 어떤 fd가 준비됐는지 모르니 0번부터 maxfd까지 전부 확인 (O(n) 스캔)
        if (!FD_ISSET(fd, &rset)) continue; // 이 fd가 준비 목록에 없으면 건너뜀
        if (fd == listen_fd) {              // 준비된 게 listen 소켓이면 = 새 연결 요청이 도착했다는 뜻
            int conn = accept(listen_fd, NULL, NULL);   // 연결을 수락해 클라이언트용 fd(conn) 생성
            FD_SET(conn, &allset);          // 새 연결도 감시 목록에 추가 (다음 루프부터 지켜봄)
            if (conn > maxfd) maxfd = conn; // conn이 더 크면 범위(maxfd)를 넓힌다
        } else {                            // 준비된 게 기존 클라이언트 연결이면 = 데이터가 도착했다는 뜻
            char buf[1024];                 // 읽어 들일 데이터를 담을 버퍼
            int r = read(fd, buf, sizeof buf);          // 이미 준비된 소켓이라 바로 읽힌다
            if (r <= 0) { close(fd); FD_CLR(fd, &allset); }  // 0=상대가 연결을 닫음, 음수=에러 → fd 닫고 감시 목록에서 제거
            else write(fd, buf, r);         // 읽은 만큼 그대로 돌려보냄 (에코 서버)
        }
    }
}
```

감시할 fd를 `fd_set`에 채우고 `select`를 부른다. 커널은 하나라도 준비될 때까지 재웠다가, 준비된 fd들을 **`rset`에 표시해** 돌려준다. 돌아오면 `FD_ISSET`으로 전체를 훑어 준비된 fd를 찾아 처리한다.

동작은 하지만 fd가 많아지면 세 가지가 발목을 잡는다.

1. **fd 개수 상한**: `fd_set`은 크기가 고정된 비트마스크라 `FD_SETSIZE`(보통 1024)를 넘는 fd를 감시할 수 없다.
2. **매 호출마다 전체 복사**: `select`가 `rset`을 준비된 집합으로 덮어쓰기 때문에 루프마다 `rset = allset`으로 다시 채워야 하고 이 집합이 호출마다 user 공간과 kernel 공간 사이를 통째로 복사된다.
3. **반환 후 전체 스캔**: `select`는 "몇 개가 준비됐다"만 알려줄 뿐 **어떤 fd인지는 안 알려준다.** 그래서 준비된 fd를 찾으려 전체를 `FD_ISSET`으로 O(n) 훑어야 한다. 커널도 내부적으로 감시 fd 전체를 매번 검사한다.

핵심 문제는 3번이다. fd가 1만 개이고 그중 **딱 하나만** 준비돼도, 매 호출마다 1만 개를 검사하고 1만 개를 스캔한다. 감시 대상이 늘수록 준비된 개수와 무관하게 비용이 선형으로 커진다. 이게 확장의 벽이다.

그런데 이 O(n)은 비트마스크라는 **자료형 탓이 아니다.** 왜 그런지는 커널이 select를 어떻게 처리하는지 봐야 드러나는데, 그 내부를 다음 절에서 연다.

> [!note]+ 왜 처음부터 배열이 아닌 비트마스크로 구현되었을까?
> `fd_set`을 비트마스크로 한 건 1983년 4.2BSD 제약에 맞는 합리적 설계였다. 당시엔 fd가 몇 개 안 됐고(연결 수천은 상상 밖), 작은 집합에선 "fd N이 준비됐나"를 비트 하나로 O(1)에 검사하는 비트마스크가 배열보다 빠르고 콤팩트했으며, 고정 크기라 스택에 올려 할당 없이 쓸 수 있었다. 상한은 그때 닿을 일이 없는 값이었다. 배열로 다시 한 게 poll이지만 O(n) 문제는 그대로였고, 진짜 도약은 자료형이 아니라 epoll의 커널 설계였다. 다만 select가 표준 ABI가 된 뒤엔 자료형을 못 바꿔, poll·epoll을 별도 인터페이스로 얹었다.

---

### 5. select은 커널 안에서 어떻게 자고 깨나 — 대기 큐와 wake_up

쓰는 법만 봐선 안 보이지만, `select`를 부르면 커널 안에서 대략 이렇게 돈다. 이 sleep/wake 메커니즘은 poll·epoll도 그대로 공유하니 여기서 한 번에 정리한다.

```c {5,8}
// 커널 안 select 처리 (개념적 의사코드)
copy_in(fd_sets);                    // ① user → kernel: fd_set 세 개를 복사
for (fd = 0; fd < nfds; fd++)        // ② 전체 순회
    if (fd_in_set(fd)) {
        ready |= poll_fd(fd);        //    준비 상태 확인 (fd 타입별 poll 연산)
        register_wait(fd, current);  //    아직이면 그 fd 대기 큐에 이 스레드 등록
    }
if (!ready) sleep_until_wakeup();    // ③ 아무것도 준비 안 됨 → 스레드 재움 (Blocked)
// ... 등록한 fd가 준비돼 대기 큐가 깨우면 여기서 재개 ...
for (fd = 0; fd < nfds; fd++)        // ④ 처음부터 다시 전체 순회
    if (fd_ready(fd)) mark_result(fd);   //    이번엔 준비된 fd만 결과에 표시
copy_out(result_sets);               // ⑤ kernel → user: 결과 되돌림 (입력을 덮어씀)
return ready_count;
```

각 fd의 준비 여부는 그 fd 타입(소켓·파이프·파일)이 저마다 구현한 `poll` 연산(`->poll()`)으로 묻는다.   
위 의사코드의 `poll_fd`가 이 `->poll()`을 부르는 자리이고, 아래 `sock_poll`이 그 소켓 구현이다. 참고로 6절의 `poll()` 시스템 콜과는 이름만 같은 다른 층위다.

핵심은 **커널에 관심 목록을 남겨두는 상태가 없다**는 점이다.   
매 호출마다 fd_set을 통째로 주고받고(①·⑤), 0부터 nfds까지를 **두 번 훑는다**(② 등록할 때, ④ 깨어난 뒤). 준비된 게 하나여도 전체를 스캔한다.

##### `->poll()` — 확인과 대기 큐 등록

`->poll()`은 select가 훑을 때 **두 가지를 동시에** 한다.

```c {3,5,6}
// 소켓의 poll 연산 (개념적, 실제 tcp_poll 단순화)
int sock_poll(fd, poll_table *pt) {
    poll_wait(fd, &socket->wait_queue, pt);   // ① 이 스레드를 소켓 대기 큐에 등록
    int mask = 0;
    if (수신 버퍼에 읽을 데이터 있음)  mask |= POLLIN;    // ② 지금 준비 상태를 마스크로 반환
    if (송신 버퍼에 여유 있음)         mask |= POLLOUT;
    return mask;
}
```

- ①은 이 스레드를 그 fd의 **대기 큐**에 걸어둔다: 대기 큐는 **커널 안에, fd별로 있는 자료구조**다("준비되면 여기로 깨워달라"는 등록부)
- ②는 지금 당장 준비됐는지를 비트마스크로 돌려준다

##### 깨움 — 데이터 도착 코드가 wake_up

전부 준비 안 돼 스레드가 잠들면, 깨우는 것은 **데이터 도착 코드**다.   
소켓이라면 NIC가 패킷을 받아 인터럽트를 걸고, 커널 네트워크 스택이 그 데이터를 처리해 **소켓 수신 버퍼에 넣는다.**   
버퍼가 채워지는 순간 `sk_data_ready`[^2]를 통해 소켓 코드가 그 소켓의 대기 큐를 깨운다.

```c
// 패킷이 도착해 소켓 수신 버퍼를 채운 뒤
sk_data_ready(socket);   // → wake_up(&socket->wait_queue) → 거기 걸린 스레드를 깨움
```

즉 `->poll()`은 **지금 확인 + 깨움 경로 등록**(pull + 등록)이고, 실제로 잠을 깨우는 건 **데이터 쪽이 대기 큐를 미는 `wake_up`**(push)이다.

##### 단계별 Blocked ↔ Running 전이

위 조각들을 자료구조 수준에서 한 순서로 꿰면 이렇다. 등장하는 커널 자료구조는 넷이다.

- **`task_struct`**: 스레드마다 하나. `state` 필드를 가짐(`TASK_RUNNING`·`TASK_INTERRUPTIBLE` 등)
- **run queue**: CPU마다 하나. `TASK_RUNNING` 상태의 스레드를 담고, 스케줄러가 여기서 다음 실행 대상을 고른다
- **`wait_queue_head`**: fd마다 하나. 그 fd를 기다리는 스레드들의 연결 리스트
- **`wait_queue_entry`**: wait queue의 노드. `task_struct` 포인터 + wake function을 담는다

**Phase A — select 호출 → 잠듦**(Running → Blocked)

1. 스레드가 `select` 진입 (지금 `state = TASK_RUNNING`)
2. select가 감시 fd마다 `->poll()` 호출 → `poll_wait()`이 각 fd의 `wait_queue_head`에 이 스레드용 `wait_queue_entry`를 추가
3. 어느 fd도 준비 안 됨 → select가 `state`를 `TASK_INTERRUPTIBLE`로 바꾸고 `schedule()` 호출
4. `schedule()`이 이 스레드를 run queue에서 제거하고 다른 스레드에 CPU를 넘김 → 이 스레드는 Blocked. 단 감시하던 모든 fd의 `wait_queue_head`엔 엔트리로 등록돼 있음

**Phase B — 데이터 도착 → wake_up**(Blocked → Runnable)

5. 어떤 fd에 데이터 도착 → 데이터 도착 코드(`sk_data_ready` 등)가 그 fd의 `wait_queue_head`에 `wake_up()` 호출
6. `wake_up()`이 그 wait queue의 엔트리 리스트를 순회하며 각 엔트리의 wake function 호출
7. wake function(`try_to_wake_up`)이 그 엔트리가 가리키는 `task_struct`에 대해:
   - `state`를 `TASK_RUNNING`으로 변경
   - 그 스레드를 run queue에 추가(enqueue)
   - 깨운 스레드가 더 높은 우선순위면 리스케줄(선점) 플래그 설정
5. 이제 스레드는 Runnable 
	- **"실행 준비됨"의 실체 = `task_struct.state == TASK_RUNNING` + run queue 멤버십**이고, 이 둘을 7번이 wake_up 경로에서 기록

**Phase C — 스케줄 → 재개 → 결과 확인**(Runnable → Running → 반환)

9. 스케줄러가 이 스레드를 골라 CPU에 올림 → 실제 Running
10. 스레드는 4번의 `schedule()` 다음 지점(select 내부)에서 재개
11. select가 감시 fd 전부에 대해 다시 `->poll()` → 준비된 fd의 비트를 결과 `fd_set`에 set 
12. select가 Phase A에서 등록한 `wait_queue_entry`들을 각 wait queue에서 제거
13. select 반환 (반환값 = set된 비트 수)

정리하자면 `wake_up`이 하는 일은 **7번뿐**이다 — `state = RUNNING` + run queue enqueue.   
비트마스크나 fd 결과는 건드리지 않고, "어느 fd가 깨웠는지"도 남기지 않는다.   

그래서 11번의 전체 재스캔이 필요하다.   
epoll은 7번의 wake function을 "그 fd를 ready list에 추가"하는 콜백으로 바꿔 이 재스캔을 없앤다.

---
### 6. poll() — 상한은 풀되, O(n)은 남는다

`poll`은 비트마스크 대신 **구조체 배열**을 쓴다.

```c
#include <poll.h>

struct pollfd fds[MAX];      // 감시할 fd들의 배열. 각 원소 = { fd, events(관심), revents(발생) }
fds[0].fd = listen_fd;       // 0번 슬롯에 listen 소켓 등록
fds[0].events = POLLIN;      // 관심 이벤트 = "읽을 게 생기면"(POLLIN)
int nfds = 1;                // 현재 감시 중인 fd 개수

for (;;) {                   // 서버 메인 루프
    poll(fds, nfds, -1);     // 배열 전체를 커널에 넘겨 감시 위임. -1 = 준비될 때까지 무한 대기(blocking)
    for (int i = 0; i < nfds; i++) {   // 어떤 게 준비됐는지 모르니 배열 전체를 훑는다 (여전히 O(n) 스캔)
        if (!(fds[i].revents & POLLIN)) continue;   // 커널이 채운 발생 이벤트(revents)에 POLLIN이 없으면 건너뜀
        // ... 여기서 listen 소켓이면 accept, 아니면 read/echo (select 예시와 동일) ...
    }
}
```

두 가지가 나아졌다.   
- 하나는 `fd_set` 같은 크기 제한이 없어(파일 디스크립터 한계까지) 1024를 넘는 것
- 다른 하나가 **`events`와 `revents`의 분리** — 관심(입력)과 발생(출력)을 별도 필드로 나눈 것이다.
	- `select`의 `fd_set`은 **입력이자 출력**이라 커널이 결과(준비된 fd)로 그 위를 덮어쓴다. 그래서 원래 감시 목록이 사라지고, 매 루프 `rset = allset`으로 다시 채워야 했다.   
	- `poll`은 각 `pollfd`가 **내가 채우는 입력** (`events`)와 **커널이 채우는 출력**(`revents`)로 나뉜다. 커널은 `events`는 건드리지 않고 `revents`에만 결과를 쓰므로, 감시 목록(`events`)이 결과에 안 덮여 **그대로 재사용**된다. select의 매 호출 재초기화가 사라지는 이유다.

다만 두 번째 개선내용(`events`, `revents`의 분리)은 성능이 아니라 편의 개선에 가깝다.   
매 루프 감시 목록을 다시 만드는 번거로움 하나를 던 것뿐이라, poll의 더 의미 있는 개선은 오히려 1024 상한 제거 쪽이다.

하지만 근본은 그대로다. 여전히 전체 배열을 매 호출마다 커널에 넘기고(O(n) 복사), 돌아와 `revents`를 전부 훑는다(O(n) 스캔). `poll`은 1024 제한과 재초기화를 없앴을 뿐, **준비 개수와 무관한 선형 비용**은 그대로다.

---
### 7. epoll — 관심 목록을 커널이 들고 있는다

리눅스만의 도약이다. select·poll이 **매 호출마다 감시 목록 전체를 커널에 새로 알려주던** 것을, epoll은 **한 번 등록해두고 준비된 것만 받는다.** 시스템 콜이 셋으로 나뉜다.

- `epoll_create1`: epoll 인스턴스를 만든다. 이 인스턴스 자체도 하나의 fd다
- `epoll_ctl`: 감시할 fd를 관심 목록에 **등록**(ADD)·수정(MOD)·제거(DEL). fd당 한 번만 부른다
- `epoll_wait`: 준비된 fd만 배열로 돌려받는다

```c {10}
#include <sys/epoll.h>

int epfd = epoll_create1(0);     // epoll 인스턴스 생성. 반환값 epfd도 하나의 fd다

struct epoll_event ev = { .events = EPOLLIN, .data.fd = listen_fd };   // listen 소켓을 "읽기 감시"로 등록할 설정
epoll_ctl(epfd, EPOLL_CTL_ADD, listen_fd, &ev);   // 관심 목록에 한 번만 등록 (이후 매 루프 다시 안 넘김)

struct epoll_event events[MAX];  // epoll_wait이 준비된 fd들을 담아줄 배열
for (;;) {                       // 서버 메인 루프
    int n = epoll_wait(epfd, events, MAX, -1);   // 준비된 fd만 events에 n개 담아 반환. -1 = 무한 대기(blocking)
    for (int i = 0; i < n; i++) {                // 준비된 n개만 순회 — 전체 스캔이 없다 (O(준비된 수))
        int fd = events[i].data.fd;              // 등록 때 넣어둔 fd를 그대로 꺼냄
        if (fd == listen_fd) {                   // 준비된 게 listen 소켓이면 = 새 연결 요청
            int conn = accept(listen_fd, NULL, NULL);   // 연결 수락 → 클라이언트용 fd 생성
            struct epoll_event cev = { .events = EPOLLIN, .data.fd = conn };   // 새 연결도 "읽기 감시"로 설정
            epoll_ctl(epfd, EPOLL_CTL_ADD, conn, &cev);   // 관심 목록에 추가 (역시 한 번만)
        } else {                                 // 준비된 게 기존 연결이면 = 데이터 도착
            char buf[1024];                      // 읽어 들일 데이터 버퍼
            int r = read(fd, buf, sizeof buf);   // 이미 준비된 소켓이라 바로 읽힌다
            if (r <= 0) close(fd);               // 0=상대가 닫음, 음수=에러 → close (닫으면 epoll에서 자동 제거)
            else write(fd, buf, r);              // 읽은 만큼 그대로 돌려보냄 (에코)
        }
    }
}
```

차이가 코드에 드러난다. `epoll_wait`에는 **fd 집합을 넘기지 않는다.** 관심 목록은 이미 커널이 들고 있고 준비된 fd만 `events` 배열로 돌아온다. 그래서 반환 후 스캔도 "준비된 n개"만 돈다. 전체를 훑는 select·poll의 O(n)이 사라졌다.

---
### 8. epoll의 동작 원리 — interest list와 ready list

epoll이 어떻게 O(n)을 없앴는지가 핵심이다. epoll 인스턴스는 커널 안에 **두 자료구조**를 유지한다.

```
epoll 인스턴스 (커널)
 ├─ interest list  ← epoll_ctl(ADD)로 등록된 fd들 (red-black tree)
 │     fd3, fd7, fd10, ...  (수십만 개여도 OK)
 └─ ready list     ← 준비된 fd만 (doubly linked list)
       fd7  ← 데이터 도착 → 콜백이 여기에 추가

epoll_wait → ready list만 확인 → fd7 반환 (interest list 전체는 안 봄)
```

- **interest list**: 등록된 fd 전체. red-black tree라 fd 추가·삭제·조회가 빠르다.
- **ready list**: 준비된 fd만 모인 목록.

동작은 **콜백 기반**이다. `epoll_ctl`로 fd를 등록할 때, 커널은 그 fd의 대기 큐에 **콜백을 심는다.** 나중에 그 fd가 준비 상태가 되면(예: 패킷이 도착해 소켓 수신 버퍼가 채워지면), 커널의 네트워크 코드가 그 대기 큐를 깨우고 심어둔 콜백이 실행돼 **해당 fd를 ready list에 추가**한다.

그래서 `epoll_wait`가 하는 일은 단순하다. **ready list를 확인**해 비어 있지 않으면 그 항목들만 복사해 반환하고 비어 있으면 호출 스레드를 재운다(Blocked). 준비 이벤트가 와 ready list가 채워지면 깨운다.

결과적으로 `epoll_wait`의 비용은 **등록된 fd 수가 아니라 준비된 fd 수에 비례**한다. fd를 100만 개 등록해도 그 순간 준비된 게 3개면 3개만큼만 일한다. select·poll이 매번 100만 개를 다 훑던 것과 정반대다. 감시 목록을 커널이 계속 들고 있고(등록은 한 번), 준비 여부를 스캔이 아니라 콜백으로 알기 때문에 재검사 자체가 없다.

|          | select            | poll          | epoll               |
| -------- | ----------------- | ------------- | ------------------- |
| fd 개수 상한 | `FD_SETSIZE` 1024 | 없음            | 없음                  |
| 관심 목록 전달 | 매 호출 전체 복사        | 매 호출 전체 복사    | `epoll_ctl`로 한 번 등록 |
| 준비 fd 찾기 | 반환 후 O(n) 스캔      | 반환 후 O(n) 스캔  | 준비된 것만 반환, O(ready) |
| 커널 내부    | 매번 전체 O(n) 검사     | 매번 전체 O(n) 검사 | 콜백으로 ready list 유지  |
| 커널 상태    | 없음(매번 재전달)        | 없음(매번 재전달)    | interest list 유지    |

---
### 9. level-triggered와 edge-triggered

epoll이 "fd가 준비됐다"고 알리는 방식은 둘로 갈린다: **level-triggered**와 **edge-triggered**.   
이건 epoll이 만든 게 아니라 하드웨어 인터럽트에서 온 오래된 개념이다. 하드웨어 인터럽트는 장치(키보드·NIC 등)가 CPU에 "처리할 게 생겼다"고 보내는 전기 신호인데, 그 신호가 **높은 상태로 있는 동안** 계속 반응하면 레벨 트리거, **낮음에서 높음으로 바뀌는 순간**에만 반응하면 엣지 트리거다.   
이 "상태냐 전이냐"가 그대로 fd 통지에 적용된다.

##### 준비 상태를 덜 소비하면?

이 "상태냐 전이냐"가 fd에서 실제로 갈리는 지점은 준비된 데이터를 한 번에 다 안 읽었을 때다.

구체적으로, 소켓에 **2KB가 도착**해 "읽기 가능" 통지를 받았는데 당신이 **1KB만 읽고** 멈췄다면(1KB 남음) 다음 통지가 갈린다.

- **LT**: 아직 1KB가 남아 조건이 참이니 **또 통지한다.** 다 안 읽어도 다음에 또 알려주니 안전하고 다루기 쉽다.
- **ET**: 새 데이터가 오는 새 edge가 없으니 **다시 통지 안 한다.** 남은 1KB는 방치돼 그 연결이 멈춘 것처럼 보인다.

##### epoll에서 — 둘 다 제공, 플래그로 선택

**I/O 멀티플렉싱에서 이 둘을 고를 수 있는 건 epoll뿐이다**(select·poll은 LT 고정). 기본은 LT이고, 등록할 때 `EPOLLET`을 더하면 ET다.

```c
struct epoll_event ev = { .events = EPOLLIN | EPOLLET, .data.fd = conn };  // ET로 등록
epoll_ctl(epfd, EPOLL_CTL_ADD, conn, &ev);
```

ET는 통지·wakeup 횟수를 줄여 고부하에서 유리해 nginx 같은 서버가 쓴다. 대신 위 "덜 읽으면 방치" 때문에 계약이 붙는다.

> [!warning]+ edge-triggered의 함정
> ET에서 통지를 받으면 **`EAGAIN`이 날 때까지 버퍼를 다 읽어야** 한다. 한 번만 `read`하고 남기면, 남은 데이터에 대한 다음 통지가 오지 않아 그 연결이 영영 멈춘다. 그래서 ET는 **non-blocking fd + 다 읽는 루프**가 필수다.

```c
// edge-triggered: EAGAIN까지 모두 읽어야 한다
while (1) {
    ssize_t r = read(fd, buf, sizeof buf);
    if (r > 0) {
        // ... 읽은 만큼 처리 ...
    } else if (r == 0) {
        close(fd);           // 상대가 연결을 닫음
        break;
    } else {                 // r < 0
        if (errno == EAGAIN) break;   // 버퍼를 다 비웠다 — 정상 종료
        close(fd);           // 진짜 에러
        break;
    }
}
```

ET가 악명 높은 건, 이 drain을 빠뜨려도 **에러도 로그도 없이 그 연결만 조용히 멈춰** 원인 찾기가 어렵고, 작은 메시지로 테스트하면 한 번에 다 읽혀 안 걸리다 **부하가 커지면 터지기** 때문이다.   
다만 이건 raw epoll을 직접 짤 때의 함정이다.

##### 누가 정하나

개발자는 이 방식을 **구현하는 게 아니라 `EPOLLET` 플래그로 고르기만** 한다(안 주면 LT). 그마저도 **epoll API를 직접 부르는 저수준 코드에서만** 만지고, 고수준으로 갈수록 런타임·라이브러리가 대신 정한다.

| 층위                     | LT/ET를 누가 정하나                 |
| ---------------------- | ----------------------------- |
| C raw epoll            | 개발자가 `EPOLLET`로 직접            |
| nginx·redis (C 이벤트 루프) | 그 서버 저자가 직접 (nginx는 ET)       |
| Go `net` 패키지           | Go 런타임이 내부에서 (ET). 앱 코드는 안 만짐 |
| Python asyncio         | 선택기(`selectors`)가 (LT). 안 만짐  |
| Node.js                | libuv가 정함. 안 만짐               |

그래서 대부분의 앱 개발자는 LT/ET를 건드릴 일이 없고, 이벤트 루프나 커널 밀착 네트워킹을 직접 짜는 사람만 마주치는 스위치다.   
대부분은 LT로 충분하고, 극한 성능이 필요할 때만 ET의 복잡함을 감수한다.

---
### 10. epoll 위에 얹힌 상위 개념들

실무에서 epoll을 직접 부를 일은 드물고, 보통 그 위에 얹힌 상위 개념을 통해 만난다. 대표적인 것들이다.

- **event loop**: `epoll_wait` 루프에 "준비된 fd → 대응하는 콜백 실행 또는 coroutine 재개"를 얹은 것이다. Python `asyncio`, Node의 libuv, Go의 netpoller가 모두 이 구조 위에 있다.
- **nginx·redis·HAProxy**: epoll 기반 이벤트 서버라 단일(또는 소수) 스레드로 수만 연결을 감당한다.
- [[Concurrency and Parallelism]] 11절이 "OS의 준비완료 통지"라 부른 것이 정확히 epoll의 ready list이고, 그 위 event loop이 [[Python fastapi|FastAPI]]가 요청을 coroutine으로 다중화하는 바탕이다.
- [[Busy Polling and Spinlock|busy polling]]과 대비하면 선명하다. busy polling은 스레드가 직접 되물으며 코어를 태우고, epoll은 준비될 때까지 잠들었다 커널 통지로 깨어난다.

정리하면 asyncio·Node·고성능 서버의 "단일 스레드로 수천 연결"은 전부 epoll(리눅스) 또는 kqueue(BSD·macOS) 위에 세운 추상이다.

[^1]: 'Resource temporarily unavailable', 곧 "지금은 준비 안 됐으니 나중에 다시 시도하라"는 신호

[^2]: 소켓 수신 버퍼에 새로운 데이터가 도착했을 때 호출되는 핵심 콜백 함수. 기본적으로 `sock_def_readable()` 함수로 매핑되며, 데이터를 읽기 위해 대기 중인 프로세스를 깨워(Wake-up) I/O 처리를 진행하도록 알리는 역할
