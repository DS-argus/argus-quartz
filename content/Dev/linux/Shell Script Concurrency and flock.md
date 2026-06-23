---
tags:
  - linux
  - CLI
  - bash
created: 2026-06-23T00:00:00
updated: 2026-06-23T00:00:00
permalink: /Dev/linux/shell-script-concurrency-and-flock
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - shell script 동시성 문제는 cron 중복 실행·공유 파일 동시 수정에서 발생
> - `flock`은 파일에 잠금을 걸어 한 번에 하나만 임계 구역에 진입시키는 도구
> - flock은 **advisory lock** — 모두가 호출해야 의미가 있고 강제 차단은 아님
> - 잠금 소유자는 프로세스가 아니라 open file description(OFD), 충돌 판정은 inode 단위
> - 프로세스 종료 시 FD가 닫히며 잠금 자동 해제 — stale lock 위험이 낮음
> - 이식성 환경에선 `mkdir`·`set -o noclobber`·`ln`의 원자성으로 대체

---

### 1. 왜 필요한가 — shell script의 동시성 문제

여러 프로세스가 같은 자원을 동시에 건드리면 예측 못 한 결과가 나온다. shell script에서 가장 흔한 두 상황은 이렇다.

- **cron 중복 실행**: 5분마다 도는 작업이 한 번에 5분을 넘기면, 이전 실행이 안 끝났는데 새 실행이 또 뜬다. 백업이 겹쳐 돌거나 같은 파일을 동시에 써서 깨진다.
- **공유 파일 동시 수정**: 두 스크립트가 같은 파일에 덧붙이거나 카운터를 올리면, 읽고 쓰는 사이에 끼어들어 갱신이 유실된다.

카운터 증가만 봐도 원자적이지 않다.

```bash
# 두 프로세스가 동시에 돌면 갱신이 유실될 수 있다
count=$(cat counter.txt)            # 둘 다 "10"을 읽고
echo $((count + 1)) > counter.txt   # 둘 다 "11"을 쓴다 → 12가 아니라 11
```

이렇게 "동시에 들어오면 안 되는 구간"을 임계 구역(critical section)이라 부른다. 한 번에 하나의 프로세스만 들어가게 만드는 것이 동시성 처리의 핵심이다. 작업을 병렬로 *돌리는* 쪽은 [[Bash Shell Script 4 - 실전 스크립트 패턴#2. Job Control|Job Control]]에서 다뤘고, 이 글은 반대로 *겹치지 않게 막는* 쪽을 다룬다.

---

### 2. 잠금의 기본 아이디어

임계 구역을 한 번에 하나만 통과시키려면 **잠금**(lock)을 쓴다. 들어가기 전에 잠금을 잡고, 나올 때 푼다. 이미 누가 잡고 있으면 기다리거나 포기한다.

shell에는 언어 차원의 뮤텍스가 없으니, **파일시스템의 원자적 연산**을 잠금으로 빌려 쓴다. 대표가 `flock`이고, 그 밖에 `mkdir`·`noclobber`·`ln`의 원자성을 이용하는 방법이 있다(7번).

---

### 3. flock — 쓰는 법

`flock`은 파일에 잠금을 걸어 한 번에 한 프로세스만 임계 구역에 들어가게 한다. 잠금은 잠금용 FD로 그 파일에 걸리고, 프로세스가 끝나 FD가 닫히면 자동으로 풀린다.

##### FD를 직접 여는 형태

```bash
exec {lock_fd}>/var/lock/myjob.lock   # 잠금용 FD 열기
if ! flock -n "$lock_fd"; then
    echo "이미 실행 중" >&2
    exit 1
fi
# --- 여기부터 한 번에 하나만 ---
long_running_job
# 스크립트가 끝나면 FD가 닫히며 잠금 해제
```

> 잠금 파일 이름의 `.lock` 확장자는 순전히 관행이다. `flock`은 확장자를 보지 않고 아무 파일에나(심지어 디렉터리에도) 걸 수 있다. 잠금의 의미는 이름이 아니라 flock과 inode에서 나온다.
##### 서브셸 블록 형태

```bash
(
    flock -n 9 || { echo "이미 실행 중"; exit 1; }
    long_running_job
) 9>/var/lock/myjob.lock
```

##### 명령을 감싸는 형태 — cron에 좋다

`flock`은 잠금을 잡은 채 명령 하나를 실행해 주기도 한다. crontab에 그대로 넣기 좋다.

```bash
# job.sh가 이미 돌고 있으면 이번 실행은 건너뛴다
flock -n /var/lock/myjob.lock /path/to/job.sh

# crontab 예시 — 5분마다, 겹치면 skip
# */5 * * * * /usr/bin/flock -n /var/lock/myjob.lock /path/to/job.sh
```

자주 쓰는 옵션:

| 옵션     | 의미                           |
| :----- | :--------------------------- |
| `-n`   | 잠겨 있으면 기다리지 않고 즉시 실패 (논블로킹)  |
| `-w N` | 최대 N초 기다린 뒤 실패               |
| `-x`   | 배타 잠금 (쓰기, 기본값)              |
| `-s`   | 공유 잠금 (읽기, 여럿이 동시에 가능)       |
| `-u`   | 잠금 해제 (보통 FD가 닫히며 자동 해제라 생략) |

`exec`와 동적 FD(`{fd}>`) 문법 자체는 [[Bash Shell Script 4 - 실전 스크립트 패턴#3. exec, 동적 FD, flock|이 글]]에서 다뤘다.

> [!tip]+ FD형 vs 래퍼형 — 언제 뭘 쓰나
> 위 세 형태는 잠금을 누가 들고 어디까지 보호하느냐가 다르다.
> - **래퍼형** `flock -n lock command`: `flock`이 직접 파일을 열고 잠근 뒤 `command`를 자식으로 실행하고, 끝나면 푼다. "명령 하나를 통째로 잠금 아래" — cron에 가장 잘 맞고 간단하다.
> - **FD형** `exec {fd}>lock; flock -n "$fd"`: 지금 도는 셸 프로세스 자신이 잠금을 든다. 외부 명령을 감싸는 게 아니라 **스크립트 중간의 한 구간**을 잠그고 같은 프로세스에서 셸 로직을 이어갈 때 쓴다. 자식을 안 띄우고, 한 번 연 잠금을 여러 단계에 걸쳐 들고 있을 수 있다.

---

### 4. advisory lock — 권고일 뿐, 강제가 아니다

flock에서 가장 자주 오해하는 지점이다. flock이 거는 잠금은 **advisory lock**(권고적 잠금)이다. 커널이 "이 파일은 잠겼으니 아무도 못 건드린다"고 강제하는 게 아니라, **flock을 호출한 쪽끼리만** 서로 양보하는 약속이다.

```bash
# A: 제대로 잠그고 들어간 프로세스
exec {fd}>/var/lock/data.lock
flock "$fd"
echo "수정 중" >> data.txt

# B: flock을 안 부르고 그냥 쓰는 프로세스
echo "끼어들기" >> data.txt   # 막히지 않는다. 그냥 써진다.
```

즉 잠금은 **모두가 같은 잠금 파일에 flock을 호출할 때만** 효력이 있다. 한 명이라도 협조하지 않으면 그대로 뚫린다. 그래서 "이 자원은 이 잠금으로 보호한다"는 규칙을 코드 전체가 지켜야 한다.

> [!info]+ advisory vs mandatory
> - **advisory**(권고): 참여자가 자발적으로 잠금을 확인한다. flock과 POSIX `fcntl` 잠금이 여기 속하고, 유닉스 잠금은 사실상 전부 권고적이다.
> - **mandatory**(강제): 커널이 `read`/`write` 자체를 막는다. Linux에도 있었지만 구현이 불안정하고 위험해 **사실상 폐기**됐다(커널 5.15부터 제거 가능, 기본 비권장). 현실적으로 셸 스크립트의 잠금은 전부 advisory라고 보면 된다.

advisory라는 사실의 실무적 함의는 둘이다.

- 잠금 파일과 실제 보호 대상은 **다른 파일이어도 된다**. 흔히 작업 파일이 아니라 별도의 `.lock` 파일에 flock을 건다. 잠금은 약속일 뿐이라 어디에 걸든 참여자만 같으면 된다.
- 잠금 파일은 내용이 비어 있어도 된다. flock은 데이터가 아니라 "열린 파일" 상태에 거는 것이라 빈 파일로 충분하다.

---

### 5. 커널은 어떻게 처리하나 — OFD와 inode

flock의 동작을 정확히 이해하려면 lock의 owner가 무엇인지 알아야 한다. 답은 프로세스도 FD 번호도 아닌 **open file description**(OFD)이다.

##### open 횟수만큼 OFD가 생긴다

```
P1: exec {fd1}>/tmp/lock   open() ─┐
P2: exec {fd2}>/tmp/lock   open() ─┼─►  OFD_1 / OFD_2 / OFD_3  ──►  inode (the lock file)
P3: exec {fd3}>/tmp/lock   open() ─┘     three separate OFDs         shared by all three
```

`open()`을 호출할 때마다 커널은 OFD(`struct file`)를 새로 만든다. 세 프로세스가 같은 경로를 열어도 OFD는 3개가 생기고, 셋 다 같은 inode를 가리킨다. 이 시점엔 lock이 하나도 없다. open과 lock은 별개의 연산이다.

##### inode와 struct file의 정체

file descriptor는 사실 3단으로 연결된다. 이 그림을 잡으면 위 동작이 또렷해진다.

```
fd (per process)  ──►  open file description (struct file)  ──►  inode (struct inode)

  fd 3 ─┐
  fd 4 ─┴─►  struct file  — one per open() call
                f_pos     : file offset
                f_flags   : status flags  (O_APPEND, O_NONBLOCK, ...)
                f_count   : reference count  (raised by fork / dup)
                f_inode   : ──►  struct inode  — one per file
                                   i_ino    : inode number
                                   i_mode   : type & permissions
                                   i_size   : size
                                   i_flctx  : lock list  (flock records live here)
```

- **inode**: the file 자체의 metadata. type·permission·size·timestamp·link count·data block 위치에 더해 **lock list**(`i_flctx`)를 품는다. 한 file당 하나이고, 같은 경로를 여러 번 열어도 inode는 하나다.
- **struct file** (open file description): `open()` 한 번을 표현한다. file offset·access mode·status flags·inode pointer·reference count를 가진다. `fork`/`dup`은 새로 만들지 않고 reference count만 올린다.

flock의 lock record는 이 중 **inode에 매달린 lock list**(`i_flctx`)에 들어가고, 각 record가 자기 owner OFD를 가리킨다. 그래서 lock은 disk에 저장되지 않는, 그 file(inode)에 붙은 **runtime metadata**다. "누가 잠갔나"는 record 안의 OFD로 식별된다. lock이 inode별로 독립이라, 한 file의 lock은 다른 file에 전혀 영향을 주지 않는다.

##### flock은 inode의 lock list에 OFD를 owner로 적는다

P1이 `flock -n "$fd1"`(exclusive)을 호출하면 커널은 이렇게 처리한다.

1. `fd1` → P1의 OFD_1로 해석
2. 그 OFD가 가리키는 inode의 flock lock list를 확인
3. 충돌하는 lock이 없으면 **owner가 OFD_1인** lock record를 inode에 추가하고 `0` 반환

이제 P2가 `flock -n "$fd2"`를 호출하면:

1. `fd2` → P2의 OFD_2로 해석
2. inode의 lock list에서 **OFD_1이 소유한 exclusive lock**을 발견
3. 그 잠금의 소유 OFD가 내 OFD와 **다르므로** 충돌 → `-n`이라 즉시 실패(`flock`이 0이 아닌 코드로 종료) → "이미 실행 중"

`-n`이 없으면 P2는 wait queue에서 잠들고, P1이 풀면 깨어나 다시 시도한다.

##### 왜 "OFD가 다르면 충돌"인가

flock의 충돌 규칙은 한 줄이다. **같은 inode에, 다른 OFD가 소유한, 호환되지 않는 lock이 있으면 충돌**이다.

| held \ requested | shared (s) | exclusive (x) |
| :--- | :---: | :---: |
| shared (s) | OK | conflict |
| exclusive (x) | conflict | conflict |

예를 들어 P1이 shared(`-s`)로 잡고 있어도 P2가 exclusive(`-x`)를 요청하면 충돌해 막힌다. exclusive는 독점을 요구하기 때문이다. 반대로 둘 다 shared면 여러 reader가 동시에 들어간다.

- 세 프로세스가 각자 open → OFD가 셋으로 갈림 → 서로 남이라 경합한다. 이게 의도한 mutual exclusion이다.
- 한 프로세스가 열고 `fork`/`dup`하면 자식은 **같은 OFD**를 물려받는다. 이때 flock은 같은 owner로 보고 충돌시키지 않는다. 둘은 하나의 lock을 공유한다.

##### lock 해제 시점

- 명시적 `flock -u`, 또는
- **OFD가 소멸할 때** — 그 OFD를 가리키는 마지막 fd가 닫힐 때. 프로세스가 정상 종료하든 `kill -9`로 죽든 커널이 fd를 전부 닫아 OFD가 정리되며 lock도 사라진다. flock이 crash에 강한 이유다. lock file은 남아도 lock 자체는 풀린다.
- 단, `dup`으로 복제한 fd가 남아 있으면 OFD reference count가 0이 아니라 lock은 유지된다.

---

### 6. flock의 함정

- **inode 기준이라 잠금 파일을 지우면 안 된다**. 누가 `rm`하고 다른 프로세스가 새로 만들면 inode가 바뀌어, 옛 inode를 잡은 잠금과 새 inode를 연 프로세스가 서로 못 막는다. 잠금 파일은 고정해 두고 지우지 않는다.
- **`>`는 매번 잘라낸다**. 잠금엔 무해하지만, 잠금 파일에 PID 같은 내용을 남기려면 `>`(O_TRUNC) 대신 `<>`로 열어 자르지 않는다. 리다이렉션 연산자별 open 플래그는 [[Bash Shell Script 2 - 제어 흐름과 IO#4. 리다이렉션과 파일 디스크립터|Bash Shell Script 2]]에 정리돼 있다.
- **네트워크 파일시스템 주의**. 오래된 NFS에서는 flock이 로컬에서만 동작하거나 제대로 안 걸릴 수 있다. 분산 환경의 잠금은 전용 도구(Redis·etcd·Consul 등)가 안전하다.
- **서브셸 블록의 변수는 밖으로 안 나온다**. `( flock ...; ... ) 9>lock` 안에서 바꾼 변수는 서브셸이 끝나면 사라진다. 결과는 파일이나 stdout으로 빼낸다.

---

### 7. flock 없이 — 이식성 있는 대안

`flock`은 Linux의 util-linux 도구라 **macOS엔 기본 탑재되지 않는다**. 양쪽에서 도는 잠금이 필요하면 파일시스템 자체의 원자적 연산을 쓴다. 핵심은 "이미 있으면 실패하는, 생성과 검사가 한 번에 일어나는" 연산이다.

##### mkdir — 디렉터리 생성의 원자성

```bash
lockdir=/tmp/myjob.lock.d
if mkdir "$lockdir" 2>/dev/null; then
    trap 'rmdir "$lockdir"' EXIT
    long_running_job
else
    echo "이미 실행 중"; exit 1
fi
```

`mkdir`은 이미 있으면 실패한다. 생성과 존재 검사가 한 연산이라 경쟁이 끼어들 틈이 없다.

##### set -o noclobber — `>`의 O_EXCL

```bash
lockfile=/tmp/myjob.lock
if ( set -o noclobber; echo "$$" > "$lockfile" ) 2>/dev/null; then
    trap 'rm -f "$lockfile"' EXIT
    long_running_job
else
    echo "이미 실행 중"; exit 1
fi
```

`noclobber`를 켜면 `>`가 기존 파일을 덮어쓰지 않고 실패한다. 내부적으로 `O_CREAT|O_EXCL`이라 원자적이다. 덤으로 PID를 적어 두면 누가 잡았는지 알 수 있다.

`ln`으로 하드링크를 거는 방법(`ln 임시파일 잠금파일`)도 원자적이라, 오래된 NFS에서까지 동작이 필요할 때 쓴다.

##### 공통 한계 — stale lock

`flock`과 달리 이 방법들은 잠금이 **파일이나 디렉터리의 존재 자체**다. 프로세스가 `kill -9`로 죽으면 `trap`이 못 돌아 잠금이 남는다. 다음 실행이 영영 막힐 수 있다. 보완책은 두 가지다. 잠금에 PID를 적고 그 PID가 살아 있는지(`kill -0 "$pid"`) 확인해 죽었으면 회수하거나, 잠금 파일이 너무 오래되면 회수한다.

| 방법 | 이식성 | 크래시 시 자동 해제 | 비고 |
| :--- | :---: | :---: | :--- |
| `flock` | Linux 중심 | O | FD가 닫히며 풀림. 가장 견고하지만 macOS 없음 |
| `mkdir` | 높음 | X | 어디서나 동작, stale 위험 |
| `noclobber` `>` | 높음 | X | PID 기록이 쉬움, stale 위험 |
| `ln` 하드링크 | 높음 | X | 오래된 NFS에서도 원자적, stale 위험 |

---

### 8. 실전 패턴 모음

##### cron 중복 방지 (한 줄)

```bash
# 이전 실행이 안 끝났으면 이번은 조용히 건너뛴다
# */5 * * * * /usr/bin/flock -n /var/lock/sync.lock /home/me/sync.sh
```

cron 스크립트엔 거의 공식처럼 쓰인다.

##### 기다렸다 실행 (타임아웃)

```bash
# 최대 30초 기다렸다가 못 잡으면 포기
flock -w 30 /var/lock/job.lock /path/to/job.sh
```

##### 잠금 파일 위치

- 재부팅 때 비워도 되는 짧은 잠금: `/run`(또는 `/var/run`), `/tmp`
- 시스템 서비스: `/var/lock`
- 사용자 단위: `$XDG_RUNTIME_DIR`

##### 관찰 — 지금 걸린 잠금 보기

Linux에선 현재 걸린 잠금을 직접 확인한다.

```bash
cat /proc/locks      # FLOCK ADVISORY WRITE ... 형태로 출력
lslocks              # 사람이 읽기 좋은 표
```

`ADVISORY`라고 찍히는 데서 flock이 권고적 잠금임이 한 번 더 확인된다.

> [!note]+ `/proc/locks`는 flock만 보여주는 게 아니다
> 커널이 들고 있는 **모든** 파일 잠금이 나오고, 타입 칸으로 종류가 갈린다.
> - `FLOCK` — `flock()` (BSD 잠금)
> - `POSIX` — `fcntl(F_SETLK)`·`lockf`
> - `OFDLCK` — open file description lock (최신 POSIX)
>
> 한 행의 대략적 형식은 `1: FLOCK ADVISORY WRITE 12345 08:01:1234567 0 EOF` 꼴이다. 순서대로 번호, 타입, 권고/강제, 모드(WRITE=exclusive·READ=shared), PID, `major:minor:inode`, 시작·끝 offset이다. flock 행은 항상 `ADVISORY`이고 inode 칸으로 어느 파일인지 식별된다.
