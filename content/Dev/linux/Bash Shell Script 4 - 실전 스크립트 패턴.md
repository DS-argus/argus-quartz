---
tags:
  - linux
  - CLI
  - bash
created: 2026-06-01T00:00:00
updated: 2026-06-21T00:00:00
permalink: /Dev/linux/bash-shell-script-4-practical-patterns
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - 파일 수정은 `mktemp` 임시 파일에 쓰고 `mv`로 교체하거나 `sed -i`로 처리
> - Job Control(`&`, `wait`, `jobs`)로 여러 작업을 병렬 실행하고 대기
> - `exec`로 FD를 영구 조작하고, `flock`(또는 `mkdir` 잠금)으로 동시 실행을 막음
> - `set -euo pipefail`과 `trap`으로 실패·정리를 자동화해 견고하게
> - `date`·`ss` 등 텍스트 도구는 아니지만 스크립트에서 자주 쓰는 명령
> - BashPitfalls 핵심 실수들을 알면 디버깅 시간이 줄어듦
> - `sh`/`bash`/`zsh` 차이를 알고 실전 템플릿으로 마무리

[[Bash Shell Script 3 - 텍스트 처리|3편]]에서 텍스트를 읽고 바꾸고 골라내는 도구를 다뤘다면, 이 글은 그 도구들로 **견고한 스크립트를 짜는 실전 패턴**을 모은다. 임시 파일을 안전하게 다루는 법부터 Job Control, 에러 핸들링, 자주 쓰는 명령, 흔한 함정, 이식성, 그리고 실전 템플릿까지 본다.

---

### 1. 임시 파일과 파일 안전하게 수정하기

스크립트가 파일을 수정할 때는 원본을 곧장 덮어쓰기 전에 임시 파일을 거치는 게 안전하다. 임시 파일을 만드는 `mktemp`부터, 그것으로 파일에서 특정 줄을 지우는 실전 패턴까지 묶어 본다. (`sed`·`awk` 자체는 [[Bash Shell Script 3 - 텍스트 처리|3편]]에서 다뤘다.)

##### mktemp — 안전한 임시 파일

임시 파일 이름을 `tmp.txt`처럼 직접 짓는 건 위험하다. 이미 있으면 덮어쓰고, 여러 프로세스가 같은 이름을 동시에 쓰면 충돌하며, 예측 가능한 이름은 심볼릭 링크 공격 같은 보안 취약점이 된다. `mktemp`는 **겹치지 않는 임시 파일을 원자적으로 만들고 그 경로를 출력**한다.

```bash
tmp=$(mktemp)                 # /tmp/tmp.Ab3kZ9 같은 파일 생성, 경로를 반환
echo "작업..." > "$tmp"
rm -f "$tmp"
```

생성과 동시에 trap으로 정리를 걸어두는 게 관용구다. (`trap`은 섹션 4에서 자세히 다룬다.)

```bash
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT      # 스크립트가 어떻게 끝나든 삭제
```

**`XXXXXX` 템플릿** — 이름 끝의 연속된 `X`(최소 6개)를 mktemp가 무작위 문자로 바꿔 유일한 이름을 만든다. 템플릿을 직접 주면 용도를 알아보기 쉬운 접두사를 붙일 수 있다.

```bash
mktemp /tmp/myapp.XXXXXX           # /tmp/myapp.k2Lm9Q
mktemp myapp.XXXXXX                # 현재 디렉터리에 생성
mktemp /tmp/build-XXXXXXXX.log     # X가 많을수록 무작위 자리수가 늘어남
```

`X`는 **반드시 끝에 연속으로** 있어야 한다. 중간에 끼우면(`my.XXXXXX.log`) 도구마다 처리가 달라지므로, 접미사가 필요하면 GNU의 `--suffix`를 쓰거나 생성 후 `mv`로 붙인다.

자주 쓰는 옵션:

| 옵션 | 의미 |
| :--- | :--- |
| `-d` | 파일이 아니라 임시 **디렉터리** 생성 (`mktemp -d`) |
| `-t 접두사` | `TMPDIR`(없으면 `/tmp`) 아래에 생성 |
| `-p 디렉터리` | 생성 위치를 직접 지정 (GNU) |
| `-u` | 이름만 만들고 파일은 안 만듦 (경쟁 조건 위험 — 권장하지 않음) |

```bash
# 임시 디렉터리 (여러 파일을 모아 쓸 때)
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
cp data/* "$tmpdir/"
```

> [!tip]+ macOS와 Linux의 `-t` 차이
> 인자 없는 `mktemp`는 양쪽 다 동작하지만(macOS는 `/var/folders/...`, Linux는 `/tmp` 아래), `-t`의 의미가 다르다.
> - macOS(BSD): `-t 접두사` → `TMPDIR` 아래 `접두사.무작위`
> - Linux(GNU): `-t`는 옛 방식 옵션이고, 보통 `mktemp` 또는 명시적 템플릿을 쓴다
> - 양쪽에서 무난하려면 **명시적 템플릿**이 가장 안전하다: `mktemp "${TMPDIR:-/tmp}/myapp.XXXXXX"`

##### 파일에서 특정 줄 지우기

"N번째 줄(또는 패턴에 맞는 줄)을 파일에서 지워라"는 자주 나오는 요구다. 핵심은 대부분의 도구가 **읽기와 쓰기를 동시에 못 한다**는 점이다. 읽는 중인 파일로 결과를 바로 흘려보내면 내용이 깨진다.

```bash
# 절대 금지: 같은 파일을 입력이자 출력으로 쓰면 파일이 비워진다
grep -v "DEBUG" log.txt > log.txt   # log.txt가 0바이트가 됨
```

쉘이 `>` 리다이렉션을 명령 실행 **전에** 열면서 파일을 먼저 비우기 때문이다. 그래서 아래 세 가지 안전한 방법을 쓴다.

**방법 1 — 임시 파일에 쓰고 덮어쓰기** (가장 이식성 좋음)

```bash
tmp=$(mktemp)
grep -v "DEBUG" log.txt > "$tmp" && mv "$tmp" log.txt
```

원본을 건드리지 않고 새 파일에 결과를 만든 뒤, 성공했을 때만(`&&`) 교체한다. sed/awk가 없어도 어떤 필터(`grep`, `cut`...)와도 조합된다. 바로 위에서 본 `mktemp`로 임시 파일을 만든다.

**방법 2 — sed -i** (in-place 편집)

```bash
sed -i '3d' file.txt              # 3번째 줄 삭제 (GNU)
sed -i '/^#/d' file.txt           # 주석 줄 삭제
sed -i '/^$/d' file.txt           # 빈 줄 삭제
sed -i '2,5d' file.txt            # 2~5번째 줄 삭제

# macOS(BSD sed)는 -i 뒤에 백업 접미사가 필수. 백업을 안 만들려면 빈 문자열:
sed -i '' '3d' file.txt
```

`sed`가 내부적으로 임시 파일을 만들어 교체해 준다. 한 줄로 끝나 가장 간편하지만 GNU와 BSD의 `-i` 문법이 달라 이식성에 주의해야 한다.

**방법 3 — awk로 거르기**

```bash
# 3번째 줄만 빼고 출력 → 임시 파일로 교체
awk 'NR != 3' file.txt > "$tmp" && mv "$tmp" file.txt

# 조건으로 거르기: 첫 필드가 8080인 줄 삭제
awk '$1 != 8080' lease.txt > "$tmp" && mv "$tmp" lease.txt
```

awk는 in-place 옵션이 없어 임시 파일 패턴(방법 1)과 결합한다. 대신 `NR`(줄 번호)·필드 조건 같은 복잡한 삭제 기준을 표현하기 좋다.

| 방법 | 한 줄 | 이식성 | 복잡한 조건 |
| :--- | :---: | :---: | :--- |
| 임시 파일 + 필터 | △ | ◎ | 필터에 의존 |
| `sed -i` | ◎ | △ (GNU/BSD 차이) | 정규식·줄 범위 |
| `awk` + 임시 파일 | △ | ◎ | ◎ (필드·NR) |

---

### 2. Job Control

##### 백그라운드 실행

```bash
# & 로 백그라운드 실행
long_task &
echo "PID: $!"    # 백그라운드 프로세스의 PID

# 여러 작업 병렬 실행 후 대기
task1 &
task2 &
task3 &
wait               # 모든 백그라운드 작업 완료 대기
echo "All done"

# 특정 PID만 대기
pid1=$!
wait "$pid1"
```

##### jobs, fg, bg

인터랙티브 쉘에서 사용하는 명령들이다.

```bash
jobs               # 백그라운드 작업 목록
fg %1              # 1번 작업을 포그라운드로
bg %1              # 정지된 1번 작업을 백그라운드로 재개
kill %1            # 1번 작업 종료
```

> [!tip]+ 스크립트에서의 병렬 실행
> 스크립트에서는 `jobs`/`fg`/`bg`보다 `&`와 `wait`를 조합하는 것이 일반적이다.
> ```bash
> pids=()
> for url in "${urls[@]}"; do
>     curl -sO "$url" &
>     pids+=($!)
> done
> for pid in "${pids[@]}"; do
>     wait "$pid" || echo "Failed: $pid"
> done
> ```

---

### 3. exec, 동적 FD, flock

지금까지는 명령 하나하나에 리다이렉션을 붙였다(`cmd > file`). `exec`를 쓰면 **스크립트 전체의 입출력**을 한 번에 돌리거나, 파일 디스크립터(FD)를 직접 열고 닫을 수 있다. 그 위에 `flock`을 얹으면 "이 스크립트가 동시에 두 번 돌지 못하게" 막는다. (FD 기초 — 0/1/2, `2>&1` — 는 [[Bash Shell Script 2 - 제어 흐름과 IO#4. 리다이렉션과 파일 디스크립터|2편]]에서 다뤘다.)

##### exec — 두 가지 얼굴

`exec`는 뒤에 무엇이 오느냐에 따라 완전히 다르게 동작한다.

(1) **명령을 주면: 현재 프로세스를 그 명령으로 교체**

```bash
exec python app.py    # 쉘이 python으로 "변신". 이 줄 다음은 실행되지 않는다
echo "여기는 안 온다"
```

새 프로세스를 자식으로 띄우는 게 아니라 현재 쉘 자체를 덮어쓴다. 래퍼 스크립트가 환경만 세팅하고 본체로 넘길 때(`exec "$@"`) 쓴다. 프로세스가 하나 줄고 PID·시그널이 그대로 이어져, 컨테이너 진입점(entrypoint)에서 특히 흔하다.

(2) **명령 없이 리다이렉션만 주면: 스크립트 전체에 영구 적용**

```bash
exec > run.log 2>&1   # 이 줄 이후 모든 stdout/stderr가 run.log로
echo "이건 파일로 간다"
date                  # 이것도 파일로
```

매 명령에 `>> run.log`를 붙일 필요 없이, 한 줄로 이후 출력을 전부 돌린다. 로그를 파일에 모으는 스크립트에서 자주 쓴다. FD를 직접 열고 닫을 수도 있다.

```bash
exec 3< input.txt     # FD 3을 input.txt 읽기용으로 열기
read -r line <&3      # FD 3에서 한 줄
read -r line2 <&3     # 이어서 다음 줄
exec 3<&-             # FD 3 닫기

exec 4> out.txt       # FD 4를 쓰기용으로 열기
echo "hello" >&4
exec 4>&-             # 닫기
```

> [!note]+ exec로 연 FD는 언제까지 사나
> FD 번호(테이블 칸)는 그 프로세스에 종속이라, `exec {fd}>&-`로 닫거나 프로세스가 끝날 때까지 산다. 단 프로세스를 교체하는 `exec command`를 거쳐도 FD는 닫히지 않고 새 프로그램으로 넘어간다 — `FD_CLOEXEC`(close-on-exec) 플래그가 붙은 FD만 그때 닫힌다. `fork`/`dup`로 복제한 FD는 같은 열린 파일을 공유한다. 이 수명이 `flock` 잠금의 해제 시점과 직결된다(→ [[Shell Script Concurrency and flock]]).

##### 동적 FD 할당 (`{fd}`)

위에서는 FD 번호(3, 4)를 직접 골랐다. 문제는 그 번호가 이미 다른 데서 쓰이고 있을 수 있다는 점이다. `{변수}>` 문법을 쓰면 **비어 있는 FD를 쉘이 골라** 변수에 담아준다(10 이상에서 할당).

```bash
exec {logfd}>run.log       # 빈 FD를 logfd에 할당 (예: 10)
echo "via fd $logfd" >&$logfd
exec {logfd}>&-            # 닫기
```

여러 개를 열면 10, 11처럼 차례로 붙는다. 어떤 번호가 비어 있는지 모르는 범용 스크립트에서 안전하다.

> [!warning]+ 동적 FD는 Bash 4.1+
> `{fd}>` 문법은 Bash 4.1 이상에서만 동작한다. **macOS 기본 `/bin/bash`는 3.2**라 여기서는 못 쓴다(`brew install bash`로 받은 최신 bash나 Linux에서 동작). 3.2를 피할 수 없으면 번호를 직접(`exec 9>`) 쓰되, 9처럼 높은 번호를 골라 충돌을 줄인다.

##### flock — 동시 실행 막기

cron이 5분마다 도는 스크립트가 한 번에 5분을 넘기면, 이전 게 안 끝났는데 새 게 또 뜬다. `flock`은 파일에 잠금을 걸어 이미 도는 인스턴스가 있으면 새 실행을 막는다.

```bash
# 스크립트 안에서 한 구간만 잠그기
exec {lock_fd}>/var/lock/myjob.lock
flock -n "$lock_fd" || { echo "이미 실행 중" >&2; exit 1; }
# --- 여기부터 한 번에 하나만 ---
long_running_job

# 명령 하나를 통째로 잠그려면 (cron에 좋다)
# */5 * * * * /usr/bin/flock -n /var/lock/myjob.lock /path/to/job.sh
```

`-n`은 잠겨 있으면 기다리지 않고 즉시 실패한다(논블로킹). 프로세스가 끝나면 FD가 닫히며 잠금이 풀린다.

> [!tip]+ flock 더 깊이 알기
> flock이 **advisory lock**이라는 점(모두가 호출해야 효력), 잠금이 FD 번호가 아니라 OFD에 걸리는 커널 동작, `mkdir`·`set -o noclobber` 같은 macOS·이식성 대안, 옵션(`-w`·`-x`·`-s`)과 실전 패턴은 [[Shell Script Concurrency and flock]]에 따로 정리했다.

---

### 4. 에러 핸들링

##### set 옵션

```bash
#!/bin/bash
set -euo pipefail
```

|      옵션       | 동작                      |
| :-----------: | :---------------------- |
|     `-e`      | 명령이 실패하면 즉시 종료          |
|     `-u`      | 미선언 변수 사용 시 에러          |
| `-o pipefail` | 파이프라인 중 하나라도 실패하면 전체 실패 |

> [!tip]+ 디버깅할 때는 `set -x`
> 실행되는 명령을 한 줄씩 출력해준다. 특정 구간만 감싸서 쓸 수도 있다.
> ```bash
> set -x
> # 디버그 구간
> set +x
> ```

##### trap

프로세스가 시그널을 받거나 종료될 때 실행할 명령을 등록한다.

```bash
# 임시 파일 정리
tmpfile=$(mktemp)
trap "rm -f $tmpfile" EXIT

# 여러 시그널 처리
cleanup() {
    echo "Cleaning up..."
    rm -f "$tmpfile"
}
trap cleanup EXIT INT TERM

# trap 해제
trap - EXIT
```

|   시그널    | 설명                       |
| :------: | :----------------------- |
|  `EXIT`  | 스크립트 종료 시 (정상/비정상 모두)    |
|  `INT`   | Ctrl+C                   |
|  `TERM`  | `kill` 명령                |
|  `ERR`   | 명령 실패 시 (`set -e`와 조합)   |
| `RETURN` | 함수(또는 source된 스크립트)가 반환 시 |

##### trap ... RETURN — 함수 단위 정리

`EXIT`이 스크립트 **전체**가 끝날 때 한 번 실행된다면, `RETURN`은 **함수**가 반환될 때 실행된다. 정리 범위를 스크립트가 아니라 함수로 좁히고 싶을 때 쓴다. 함수 안에서 임시 자원을 열고, 그 함수가 어떤 경로로 끝나든 정리를 보장하는 용도다.

```bash
process() {
    local tmp
    tmp=$(mktemp)
    trap 'rm -f "$tmp"' RETURN   # 이 함수가 반환될 때 정리

    # ... 작업 ...
    [[ -s "$tmp" ]] || return 1   # 중간에 return해도 tmp는 정리됨

    cat "$tmp"
}
```

> [!warning]+ RETURN trap은 함수 안에서 거는 게 안전하다
> 최상위에서 건 `RETURN` trap은 기본적으로 함수 내부로 **상속되지 않는다**. 함수에서 동작시키려면 위 예시처럼 함수 안에서 직접 걸거나, `set -o functrace`(`set -T`)를 켜야 한다. 그래서 함수별 정리는 보통 함수 본문 첫 줄에서 `trap ... RETURN`을 거는 패턴을 쓴다. 이 점이 Go의 `defer`와 가장 닮은 부분이다 — `defer`도 함수가 끝날 때 실행된다.

##### 에러 처리 패턴

```bash
# || 로 실패 시 대체 동작
cd /some/dir || { echo "디렉토리 없음"; exit 1; }

# 커스텀 에러 함수
die() {
    echo "ERROR: $*" >&2
    exit 1
}

[[ -f config.yml ]] || die "config.yml not found"
```

##### 사용자 확인 프롬프트

```bash
read -rp "Continue? [y/N] " answer
[[ "$answer" =~ ^[Yy]$ ]] || exit 0
```

##### 타임아웃

```bash
# 10초 내에 완료되지 않으면 강제 종료
timeout 10 long_running_command
```

---

### 5. 그 밖에 자주 쓰는 명령

텍스트를 처리하는 도구는 아니지만, 스크립트를 짜다 보면 자주 만나는 명령들이다.

##### date — 날짜·시간 포맷

```bash
date                          # 현재 날짜/시간
date +%Y-%m-%d                # 2026-06-01
date +%H:%M:%S                # 14:30:00
date +"%Y-%m-%d %H:%M:%S"    # 2026-06-01 14:30:00
date -d "yesterday" +%Y-%m-%d # 어제 (GNU date)
date -d "+3 days" +%Y-%m-%d   # 3일 후
```

|  포맷  | 의미         |     예시     |
| :--: | :--------- | :--------: |
| `%Y` | 4자리 연도     |    2026    |
| `%m` | 월 (01-12)  |     06     |
| `%d` | 일 (01-31)  |     01     |
| `%H` | 시 (00-23)  |     14     |
| `%M` | 분 (00-59)  |     30     |
| `%S` | 초 (00-59)  |     00     |
| `%s` | Unix 타임스탬프 | 1780300200 |

##### ss — 네트워크 소켓 확인

```bash
ss -ltn
# -l : listening 소켓만
# -t : TCP만
# -n : 포트/주소를 숫자로 표시 (DNS 역조회 안 함)
```

포트 사용 여부를 확인하는 패턴:

```bash
check_port() {
    if grep -q ":${1} " <<< "$(ss -ltn)"; then
        echo "Port $1 is already in use"
        return 1
    fi
}
```

---

### 6. BashPitfalls 핵심 모음

실무에서 자주 발생하는 Bash 실수들이다.

##### `for f in $(ls *.mp3)` 하지 마라

```bash
# 나쁜 예: 파일명에 공백이 있으면 쪼개짐
for f in $(ls *.mp3); do echo "$f"; done

# 좋은 예: glob을 직접 사용
for f in *.mp3; do echo "$f"; done
```

##### 변수는 항상 따옴표로 감싸라

```bash
# 나쁜 예: 공백이 있으면 인자가 쪼개짐
cp $file $target

# 좋은 예
cp -- "$file" "$target"
```

`--`는 "여기부터는 옵션이 아니라 인자"라는 의미다. 파일명이 `-`로 시작해도 안전하다.

##### `cd` 후에는 반드시 성공 여부 확인

```bash
# 나쁜 예: cd 실패해도 다음 줄 실행
cd /some/dir
rm -rf *           # /some/dir이 없으면 현재 디렉토리가 날아감

# 좋은 예
cd /some/dir || exit 1
rm -rf *
```

##### `cmd1 && cmd2 || cmd3`은 if-then-else가 아니다

```bash
# 위험: cmd2가 실패하면 cmd3도 실행됨
make && deploy || rollback

# 안전한 방법
if make; then
    deploy
else
    rollback
fi
```

##### 파이프 서브쉘에서 변수 소실

```bash
# 나쁜 예: count가 서브쉘에서만 증가
count=0
cat file | while read -r line; do ((count++)); done
echo "$count"  # 0

# 좋은 예: 리다이렉션으로 서브쉘 회피
count=0
while read -r line; do ((count++)); done < file
echo "$count"  # 정확한 값
```

##### `echo "$foo"` 대신 `printf '%s\n' "$foo"`

```bash
foo="-n hello"
echo "$foo"           # 아무것도 출력 안 됨 (-n이 옵션으로 해석)
printf '%s\n' "$foo"  # -n hello (안전하게 출력)
```

##### `[[ $foo =~ 'regex' ]]`에서 따옴표 제거

```bash
# 나쁜 예: 따옴표가 리터럴 문자열로 만들어버림
[[ "abc123" =~ '^[a-z]+[0-9]+$' ]]  # 실패

# 좋은 예: 변수에 담아서 사용
pattern='^[a-z]+[0-9]+$'
[[ "abc123" =~ $pattern ]]           # 성공
```

---

### 7. Bash vs sh vs zsh 차이점

| 기능                | sh (POSIX) |             Bash              |      zsh      |
| :---------------- | :--------: | :---------------------------: | :-----------: |
| `[[ ]]`           |     X      |               O               |       O       |
| 배열                |     X      |         O (0-indexed)         | O (1-indexed) |
| 연관 배열             |     X      |           O (4.0+)            |       O       |
| `{1..10}` 범위      |     X      |               O               |       O       |
| `=~` 정규식          |     X      |               O               |       O       |
| `set -o pipefail` |     X      |               O               |       O       |
| 프로세스 치환 `<()`     |     X      |               O               |       O       |
| 글로빙 `**`          |     X      | O (4.0+, `shopt -s globstar`) |    O (기본)     |

> [!note]+ 이식성이 중요한 경우
> - Docker, CI/CD 환경에서는 `bash`가 없을 수 있다. Alpine 같은 최소 이미지는 `sh`(ash)만 제공한다.
> - 이식성이 중요한 스크립트는 shebang을 `#!/bin/sh`로 하고 POSIX 문법만 쓴다.
> - 대부분의 실무 스크립트는 `#!/usr/bin/env bash`로 충분하다.

---

### 8. 실전 스크립트 템플릿

```bash
#!/usr/bin/env bash
set -euo pipefail

# ─── 설정 ──────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

# ─── 유틸 ──────────────────────────────
log() { printf "[%s] %s\n" "$(date '+%H:%M:%S')" "$*"; }
err() { printf "[%s] ERROR: %s\n" "$(date '+%H:%M:%S')" "$*" >&2; }
die() { err "$@"; exit 1; }

# ─── 인자 파싱 ──────────────────────────
verbose=false
name=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--name) name="$2"; shift 2 ;;
        -v|--verbose) verbose=true; shift ;;
        -h|--help)
            echo "Usage: $0 [-n name] [-v] [-h]"
            exit 0
            ;;
        *) die "Unknown option: $1" ;;
    esac
done

# ─── 검증 ──────────────────────────────
[[ -n "$name" ]] || die "name is required (-n)"
command -v jq &>/dev/null || die "jq is not installed"

# ─── 정리 ──────────────────────────────
tmpdir=$(mktemp -d)
trap "rm -rf $tmpdir" EXIT

# ─── 메인 ──────────────────────────────
main() {
    log "Starting with name=$name"

    if $verbose; then
        log "Verbose mode enabled"
    fi

    # 작업 내용
    log "Done"
}

main "$@"
```

> [!tip]+ 이 템플릿에서 주목할 점
> - `set -euo pipefail` : §4 에러 핸들링의 핵심
> - `log()`, `die()` : `printf` 기반으로 안전하게 출력
> - `trap ... EXIT` : 임시 파일 자동 정리
> - `shift` 패턴 : 긴 옵션 지원 인자 파싱
> - `command -v` : 의존성 명령어 존재 확인
> - `main "$@"` : 메인 함수 패턴으로 구조화
