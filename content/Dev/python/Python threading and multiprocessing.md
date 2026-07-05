---
tags:
  - python
  - cs
  - concurrency
  - parallelism
created: 2026-02-07T21:57:46
updated: 2026-07-03T16:24:34
permalink: /Dev/python/python-threading-and-multiprocessing
---
> [!abstract]+ TL;DR
> - Python의 동시성/병렬성은 thread와 process 두 갈래이며 GIL 때문에 CPU 병렬은 process의 몫
> - `threading`은 I/O-bound에 적합한 저수준, `multiprocessing`은 GIL을 우회해 CPU-bound에 적합, `concurrent.futures`는 둘을 감싼 고수준
> - 선택 기준은 I/O-bound는 thread, CPU-bound는 process, 대규모 I/O는 asyncio

> *AI-assisted*

---
### 1. 두 갈래 — thread와 process

Python에서 여러 일을 겹치거나 나눠 돌리는 길은 크게 둘이다.

- **thread**: 한 process 안의 여러 실행 흐름. 메모리를 공유한다. 생성이 가볍다.
- **process**: 독립된 프로그램 인스턴스. 메모리가 격리된다. 여러 코어에서 진짜 병렬이 가능하다.

무엇을 고를지는 **[[Python GIL|GIL]]**(Global Interpreter Lock)이 가른다.  

CPython에는 한 순간에 하나의 thread만 Python 바이트코드를 실행하게 막는 잠금이 있어서 thread를 여러 개 띄워도 순수 Python 계산은 한 번에 하나씩만 돈다. 그래서 **CPU-bound 작업은 thread로 나눠도 빨라지지 않고** 여러 코어를 실제로 쓰려면 GIL이 process마다 따로 있는 `multiprocessing`으로 가야 한다.   

반대로 **I/O 대기 중에는 GIL이 풀리므로**, I/O-bound 작업에는 thread도 충분히 쓸모 있다.

|          | thread     | process            |
| -------- | ---------- | ------------------ |
| 메모리      | 공유(힙·전역)   | 독립(격리)             |
| CPU 병렬   | GIL이 막음    | 가능                 |
| 생성·전환 비용 | 가벼움        | 무거움(생성 + IPC)      |
| 통신       | 공유 메모리로 바로 | IPC 필요(pickle 직렬화) |
| 적합한 작업   | I/O-bound  | CPU-bound          |

---
### 2. threading — OS thread 저수준

`threading`은 OS thread 기반 동시성을 제공하는 표준 라이브러리다. I/O-bound 작업에서 대기를 겹치거나, 백그라운드 워커를 돌릴 때 쓴다.

#### thread 생성과 실행

```python
import threading

def worker(name):
    print(f"{name} 작업 중")

t = threading.Thread(target=worker, args=("A",))
t.start()   # non-blocking: worker를 새 thread에서 시작, 메인은 즉시 다음 줄로 (async launch)
# ... 이 사이 코드는 worker와 겹쳐서 돈다 (concurrent) ...
t.join()    # blocking + synchronous: worker가 끝날 때까지 메인이 Blocked로 대기 (완료를 직접 pull)
```

- **`start()`**: 새 thread를 만들어 `target` 함수를 실행한다. **non-blocking**이라 즉시 리턴하고 worker는 뒤에서 concurrent하게 돈다 — 작업만 걸어두는 **async launch**다. `run()`을 직접 부르면 새 thread 없이 현재 thread에서 실행되니 주의한다.
- **`join()`**: 해당 thread가 끝날 때까지 호출한 쪽이 기다린다. **blocking + synchronous**다 — 호출한 thread가 Blocked 상태로 잠들어 완료를 직접 기다려 회수한다(pull). 단 worker의 리턴값은 주지 않고 "끝났다"는 신호만 준다. 결과가 필요하면 `queue.Queue`나 4절의 `Future`를 쓴다.
- **`daemon`**: 위 최소 예시엔 없지만 생성 시 `Thread(target=..., daemon=True)`(또는 `t.daemon = True`)로 지정하는 옵션이다. 이렇게 만든 thread는 메인 thread가 끝나면 함께 강제 종료된다. 백그라운드 상주 작업에 쓰되, 정리 없이 죽으니 중요한 작업엔 부적합하다.

#### 동기화 primitives

여러 thread가 같은 자원을 동시에 건드리면 race condition이 생긴다. 접근 순서를 강제하는 도구들이다.

- **`Lock`**: 가장 기본. 한 번에 하나의 thread만 critical section에 들어가게 한다. **소유권 개념이 없어** 아무 thread나 release할 수 있고 같은 thread가 풀지 않고 또 acquire하면 **자기 자신을 기다리다 deadlock**에 빠진다(락을 못 잡은 thread를 재우느냐 스핀시키느냐의 갈림은 [[Busy Polling and Spinlock]]).
- **`RLock`**: reentrant lock. **획득한 thread가 소유권을 가지며** 그 thread는 풀지 않고도 여러 번 다시 acquire할 수 있다(재진입). 획득 횟수만큼 release해야 풀리고 **소유한 thread만** release할 수 있다. 재귀 함수나, 락을 쥔 메서드가 같은 락을 쓰는 다른 메서드를 부를 때.
- **`Event`**: thread 사이 신호 깃발. 한 thread가 `set()`하면 `wait()`하던 thread들이 깨어난다. "준비됐다"는 통지에 쓴다. 이름은 비슷해도 asyncio의 **event loop와는 무관**하다 — 그냥 boolean 플래그다.
- **`Condition`**: 특정 조건이 될 때까지 대기·통지. producer-consumer의 세밀한 제어에.
- **`Semaphore`**: 동시 진입 수를 N개로 제한. 커넥션 풀처럼 "동시 K개까지만" 허용할 때.

**`Lock`으로 공유 변수 보호**: 가장 기본 패턴이다.

```python
lock = threading.Lock()
counter = 0

def increment():
    global counter
    with lock:        # 이 블록을 한 thread씩 직렬화
        counter += 1
```

**`Lock` vs `RLock` — 소유권과 재진입.** 아래는 `Lock`이면 두 번째 획득에서 **자기 자신을 기다리며 멈춘다**(deadlock). `RLock`은 같은 thread의 재획득을 허용해 통과한다.

```python
lock = threading.RLock()   # threading.Lock()이면 아래에서 deadlock

def outer():
    with lock:
        inner()            # 락을 쥔 채 다른 함수를 부른다

def inner():
    with lock:             # 같은 thread가 또 acquire — RLock이라 통과
        ...
```

소유권으로 정리하면, `RLock`은 소유한 thread만 풀 수 있는 **진짜 mutex**고 `Lock`은 소유권이 없어 엄밀히는 **binary semaphore**에 가깝다. 실무에선 둘 다 그냥 "lock"이라 부른다.

**`Event`로 출발 신호 맞추기**: 여러 worker를 한 신호에 함께 출발시킨다. `set()`은 플래그를 올리고 `wait()`은 올라갈 때까지 Blocked로 잔다.

```python
start = threading.Event()

def worker():
    start.wait()          # set될 때까지 Blocked로 대기
    print("출발")

threading.Thread(target=worker).start()
start.set()               # 대기하던 worker를 깨움
```

**`Semaphore`로 동시 실행 수 제한**: "동시 K개까지만"을 강제한다.

```python
sem = threading.Semaphore(3)   # 동시 3개까지 허용

def fetch():
    with sem:                  # 앞선 3개가 다 차 있으면 4번째는 대기
        ...  # 외부 API 호출 등
```

#### thread 간 통신 — queue.Queue

공유 변수를 lock으로 지키는 대신, thread-safe한 `queue.Queue`로 값을 주고받는 편이 안전하다. producer가 `put()`, consumer가 `get()`하며 내부적으로 lock을 알아서 처리한다. 값을 주고받아 공유하는 이 발상은 Go의 [[Concurrency and Parallelism#14. 경쟁 조건과 동기화|channel]]과 같다(무버퍼 랑데부·`select`·`close` 같은 채널 고유 기능은 없다).

```python
import queue, threading

q = queue.Queue()

def producer():
    for i in range(5):
        q.put(i)

def consumer():
    while True:
        item = q.get()      # 큐가 비면 대기(blocking)
        print(item)
        q.task_done()
```

`threading`은 thread의 생명주기와 동기화를 세밀하게 제어할 수 있지만 그만큼 코드가 늘고 deadlock·race condition을 직접 신경 써야 한다. 단순히 "함수 N개를 동시에 돌리고 결과를 모으는" 용도라면 4절의 `concurrent.futures`가 더 간결하다.

---
### 3. multiprocessing — process 저수준

CPU-bound 작업을 여러 코어에 실제로 나누려면 process를 쓴다. 각 process는 자기만의 Python 인터프리터와 GIL이 있으므로 GIL 제약을 우회한다.

#### process 생성과 실행

```python
from multiprocessing import Process

def worker(name):
    print(f"{name} 계산 중")

if __name__ == "__main__":       # spawn 방식에서 필수
    p = Process(target=worker, args=("A",))
    p.start()
    p.join()
```

인터페이스는 `threading.Thread`와 닮았지만(`start`/`join`), 실행 단위가 독립 process라는 점이 다르다.

#### Pool — 워커 process 풀

process를 매번 만들지 않고 미리 몇 개 띄워두고 작업을 나눠 준다.

```python
from multiprocessing import Pool

def square(x):
    return x * x

if __name__ == "__main__":
    with Pool(4) as pool:
        results = pool.map(square, range(10))   # 4개 process에 분산
```

#### IPC — process 간 통신

process는 메모리가 격리돼 있어 공유 변수로 값을 못 넘긴다. 통신 수단이 따로 필요하다.

- **`Queue`** / **`Pipe`**: process 사이로 값을 주고받는 통로. 넘기는 값은 **pickle로 직렬화**된다.
- **shared memory**(`Value`, `Array`): 여러 process가 공유하는 메모리 블록. 직렬화 없이 같은 값을 본다.

넘기는 데이터가 크면 이 직렬화·전송 비용이 계산 이득을 깎아먹을 수 있다. 큰 데이터를 자주 오가는 구조라면 오히려 느려진다.

#### fork와 spawn

자식 process를 만드는 방식이 둘이다.

- **fork**(리눅스 기본): 부모 process의 메모리를 복사해 자식을 만든다. 부모 상태를 그대로 물려받는다.
- **spawn**(윈도우·macOS 기본): 새 Python 인터프리터를 처음부터 시작하고 필요한 것만 pickle로 전달한다. 그래서 자식이 부모 상태를 자동으로 물려받지 않고 실행 코드는 `if __name__ == "__main__":` 아래에 둬야 무한 재실행을 막는다.

##### 왜 spawn은 `__name__` 가드가 필요한가

가드가 필요한 이유는 **spawn 자식이 부모 스크립트를 다시 import**하기 때문이다. 빈 인터프리터로 뜬 자식은 실행할 함수 정의를 얻으려 main 모듈을 위→아래로 다시 실행하는데, 이때 process를 만드는 코드가 최상단에 노출돼 있으면 그 코드도 재실행돼 자식이 또 자식을 낳는 재귀 생성이 된다(현대 CPython은 이를 감지해 `RuntimeError`로 막는다). `__name__`은 직접 실행한 부모에선 `"__main__"`, import된 자식에선 모듈 이름이라, 가드 안의 코드는 부모에서만 돌고 자식은 건너뛴다.

그래서 배치 원칙이 갈린다 — **함수·클래스 정의는 가드 밖**에(자식이 import해 가져가야 하므로), **process를 만들고 시작하는 코드는 가드 안**에 둔다. 참고로 이 가드가 필요한 건 Python이 모듈을 import할 때 top-level 코드를 실행하기 때문이고 명시적 `main()` 진입점을 쓰는 언어(C·Go·Java 등)에는 이 footgun이 없다. fork는 재import를 안 하니 가드가 없어도 되지만 이식성을 위해 붙여두는 게 관례다.

---
### 4. concurrent.futures — 고수준 통일 인터페이스

`threading`·`multiprocessing`을 직접 다루는 대신, **작업을 풀에 던지고 결과를 `Future`로 받는** 통일된 고수준 인터페이스다. 예외·타임아웃·취소·결과 수집이 `Future`로 정리돼 코드가 짧다.

#### 핵심 3요소 — Executor, Future, submit

- **Executor**: 작업을 맡는 풀. `ThreadPoolExecutor`(thread 풀)와 `ProcessPoolExecutor`(process 풀) 둘.
- **`submit(func, *args)`**: 작업을 풀에 던지고 즉시 **`Future`를 반환**한다.
- **`Future`**: "미래에 채워질 결과"를 담는 객체. 지금은 비어 있고 작업이 끝나면 결과나 예외가 담긴다. 실행 흐름이 아니라 **[[Concurrency and Parallelism#8. 직교하는 두 축 — synchronous/asynchronous, blocking/non-blocking|결과를 담는 그릇]]** 이다.

```python
from concurrent.futures import ThreadPoolExecutor

def fetch(url):
    ...  # I/O 작업
    return len(url)

with ThreadPoolExecutor(max_workers=8) as executor:
    future = executor.submit(fetch, "https://example.com")
    result = future.result()   # 완료까지 대기 후 결과 회수
```

- **I/O-bound → `ThreadPoolExecutor`**, **CPU-bound → `ProcessPoolExecutor`**. 인터페이스가 같아 한 줄만 바꾸면 된다.

#### 여러 작업 조율

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(fetch, u) for u in urls]
    for f in as_completed(futures):   # 완료된 것부터
        print(f.result())
```

작업을 여러 개 `submit`하면 **`max_workers` 개수만큼만 동시에** 돌고 나머지는 내부 FIFO 큐에서 대기하다 워커가 비는 대로 **submit 순서대로** 투입된다(예: `max_workers=8`에 100개를 던지면 8개가 돌고 92개는 큐에서 순서대로 대기). 시작 시점을 맞추려 `Event` 같은 걸 걸 필요 없이 executor가 알아서 배분한다. 단 **완료 순서는 보장되지 않아** 먼저 끝난 것부터 받으려면 아래 `as_completed`를 쓴다. `submit`은 시작을 기다리지 않고 즉시 `Future`를 돌려주는 non-blocking 호출이다.

- **`executor.map(func, iterable)`**: 결과를 **입력 순서대로** 돌려준다.
- **`as_completed(futures)`**: **완료된 순서대로** 꺼낸다. 먼저 끝난 것부터 처리할 때.
- **`wait(futures, ...)`**: 완료 조건(전부/하나/타임아웃)을 지정해 대기.

#### Future 다루기

- **`result(timeout=None)`**: 완료까지 대기 후 결과. 타임아웃 지정 가능. 작업이 예외로 끝났으면 그 예외가 여기서 다시 터진다.
- **`done()`**: 완료 여부만 non-blocking으로 확인.
- **`exception()`**: 예외 객체를 가져온다(있으면).
- **`cancel()`**: 아직 시작 전이면 취소를 시도한다.

---
### 5. 무엇을 언제 쓰나

| 상황                        | 도구                                        |
| ------------------------- | ----------------------------------------- |
| I/O-bound, 적은·중간 규모 동시 작업 | `ThreadPoolExecutor` / `threading`        |
| CPU-bound                 | `ProcessPoolExecutor` / `multiprocessing` |
| I/O-bound, 대량(수천-수만)      | `asyncio`                                 |

선택의 큰 갈래는 이렇다.

- **작업이 느린 원인부터 구분한다.** CPU가 바쁘면(CPU-bound) process, 대기가 길면(I/O-bound) thread나 asyncio다. GIL 때문에 CPU-bound를 thread로 나누는 건 헛수고다.
- **저수준 직접 vs 고수준.** thread·process의 생명주기나 동기화를 세밀하게 제어해야 하면 `threading`·`multiprocessing`을 직접 쓰고 "함수 N개를 동시에 돌려 결과를 모으는" 흔한 패턴이면 `concurrent.futures`가 짧고 안전하다.
- **동시 작업이 수천 개 이상인 I/O**라면 thread 수천 개는 전환 비용이 커진다. 이때는 단일 thread에서 coroutine을 굴리는 asyncio가 낫다.
- **섞여 있으면 나눠 맡긴다.** 네트워크 I/O는 asyncio로 겹치고 CPU 후처리는 process pool로 분리하고 동기 전용 라이브러리는 thread로 우회하는(`asyncio.to_thread`) 식으로 실무에서 흔히 조합한다.

공유 자원을 여럿이 건드리면 어느 모델이든 [[Concurrency and Parallelism#14. 경쟁 조건과 동기화|race condition]]을 신경 써야 한다. thread는 lock·queue로, process는 격리 덕에 공유 메모리 경쟁은 적지만 공유 파일·DB 경쟁은 남는다.
