---
tags:
  - linux
  - CLI
  - bash
created: 2026-06-01T00:00:00
updated: 2026-06-03T20:58:32
permalink: /Dev/linux/bash-shell-script-3-text-processing-and-patterns
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - `tr`, `sed`, `awk`는 텍스트 처리의 3대 도구. 복잡도 순서대로 사용
> - `printf`는 `echo`보다 안전하고 이식성이 좋음 (특수문자, 포맷 제어)
> - `IFS="$DELIM" read -ra` 패턴으로 구분자 기반 문자열 파싱 가능
> - `grep -q`, `head`, `cut`, `sort`, `uniq` 등 한 줄 도구를 파이프로 조합하는 것이 Bash의 핵심
> - Job Control(`&`, `wait`, `jobs`)과 에러 핸들링(`set -euo pipefail`, `trap`)으로 견고한 스크립트 작성
> - BashPitfalls 핵심 실수들을 알면 디버깅 시간이 줄어듦

---

### 1. printf vs echo

`echo`는 간단하지만 쉘마다 동작이 다르고, 특수문자 처리가 불안정하다.

```bash
# echo의 문제점
echo -e "\x07"    # Bash에서는 벨 소리, 일부 쉘에서는 "-e \x07" 출력
echo "$user_input" # $user_input에 -n이나 -e가 있으면 옵션으로 해석됨
```

`printf`는 C 스타일 포맷을 사용하며 모든 POSIX 쉘에서 동일하게 동작한다.

```bash
# printf 기본
printf "Hello, %s\n" "$name"
printf "Count: %d, Rate: %.2f%%\n" 42 3.14

# 특수문자 안전하게 출력
printf '%s\n' "$user_input"    # 어떤 입력이든 안전

# 16진수 바이트 생성
DELIM=$(printf '\x07')         # BEL 문자를 구분자로 사용

# 제로패딩 숫자
printf '%03d\n' 7              # 007
```

|  비교   |        echo        |        printf        |
| :---: | :----------------: | :------------------: |
|  줄바꿈  |       자동 추가        |      `\n` 명시 필요      |
| 포맷 지정 |         불가         | `%s`, `%d`, `%.2f` 등 |
|  이식성  |       쉘마다 다름       |       POSIX 표준       |
|  안전성  | 입력값이 옵션으로 해석될 수 있음 |      포맷과 데이터 분리      |

> [!tip]+ 언제 뭘 쓸까
> - 단순 메시지 출력: `echo "done"` (충분함)
> - 변수 값 출력: `printf '%s\n' "$var"` (안전함)
> - 포맷팅 필요: `printf` (유일한 선택)
> - 특수 바이트 생성: `printf '\x07'` (`echo -e`는 비이식적)

---

### 2. tr — 문자 변환/삭제

`tr`은 **문자 단위**로 치환하거나 삭제하는 도구다. 단어나 패턴이 아니라 **개별 문자**를 다룬다.

```bash
# 대소문자 변환
echo "Hello World" | tr '[:lower:]' '[:upper:]'    # HELLO WORLD
echo "Hello World" | tr 'A-Z' 'a-z'                # hello world

# 문자 삭제 (-d)
echo '"hello"' | tr -d '"'                          # hello
echo "  spaces  " | tr -d ' '                       # spaces

# 문자 압축 (-s) : 연속 중복을 하나로
echo "aabbbcccc" | tr -s 'abc'                      # abc
echo "hello     world" | tr -s ' '                  # hello world

# 줄바꿈을 공백으로
cat file.txt | tr '\n' ' '

# 체이닝 : 따옴표 제거 → 공백 제거 → 소문자 변환
echo "$RAW_COL" | tr -d '"' | tr -d ' ' | tr 'A-Z' 'a-z'
```

> [!note]+ `tr`은 stdin만 읽는다
> `tr 'a' 'b' file.txt`는 동작하지 않는다. 반드시 `cat file.txt | tr 'a' 'b'` 또는 `tr 'a' 'b' < file.txt`로 써야 한다.

---

### 3. sed — 스트림 편집기

`sed`는 **줄 단위**로 텍스트를 치환, 삭제, 삽입하는 도구다. `tr`보다 강력하고, 정규식을 사용할 수 있다.

##### 기본 치환

```bash
# 첫 번째 매칭만 치환
echo "foo bar foo" | sed 's/foo/baz/'       # baz bar foo

# 모든 매칭 치환 (g 플래그)
echo "foo bar foo" | sed 's/foo/baz/g'      # baz bar baz

# 파일 직접 수정 (-i)
sed -i 's/old/new/g' file.txt               # macOS: sed -i '' 's/old/new/g'
```

##### 줄 단위 조작

```bash
# 특정 줄 삭제
sed '3d' file.txt              # 3번째 줄 삭제
sed '/^#/d' file.txt           # 주석 줄 삭제
sed '/^$/d' file.txt           # 빈 줄 삭제

# 특정 줄만 출력 (-n + p)
sed -n '5p' file.txt           # 5번째 줄만 출력
sed -n '3,7p' file.txt         # 3~7번째 줄

# 줄 앞/뒤에 추가
sed 's/^/PREFIX: /' file.txt   # 모든 줄 앞에 추가
sed 's/$/ SUFFIX/' file.txt    # 모든 줄 뒤에 추가
```

##### 정규식 활용

```bash
# 영숫자와 언더스코어만 남기기
echo "$RAW_COL" | sed 's/[^a-z0-9_]//g'

# 그룹 캡처와 역참조
echo "2026-06-01" | sed 's/\([0-9]*\)-\([0-9]*\)-\([0-9]*\)/\3\/\2\/\1/'
# 01/06/2026

# ERE (확장 정규식) 사용 — -E 옵션
echo "2026-06-01" | sed -E 's/([0-9]+)-([0-9]+)-([0-9]+)/\3\/\2\/\1/'
```

---

### 4. awk — 패턴 매칭 + 필드 처리

`awk`는 텍스트를 **필드(열) 단위**로 처리하는 프로그래밍 언어다. `tr`(문자), `sed`(줄)보다 한 단계 강력하다.

##### 기본 구조

```bash
awk 'pattern { action }' file
```

- **pattern**: 조건 (생략하면 모든 줄에 적용)
- **action**: 해당 줄에서 실행할 명령

```bash
# 기본: 모든 줄의 첫 번째 필드 출력
awk '{ print $1 }' file.txt

# 구분자 지정 (-F)
awk -F',' '{ print $2 }' data.csv        # CSV의 2번째 열
awk -F':' '{ print $1, $3 }' /etc/passwd # 사용자명, UID

# 조건부 출력
awk '$3 > 100 { print $1, $3 }' data.txt # 3번째 필드가 100 초과인 줄

# 내장 변수
awk '{ print NR, NF, $0 }' file.txt
# NR: 현재 줄 번호
# NF: 현재 줄의 필드 개수
# $0: 줄 전체
```

##### BEGIN / END 블록

```bash
# BEGIN: 첫 줄 처리 전에 실행
# END: 마지막 줄 처리 후에 실행
awk 'BEGIN { sum=0 } { sum += $1 } END { print "Total:", sum }' numbers.txt

# 소수점 계산
awk 'BEGIN { printf "%.2f\n", 10/3 }'    # 3.33
```

##### 실무 예제 분석

프로젝트 쉘 스크립트에서 이런 awk를 만날 수 있다.

```bash
awk -F"${DELIM}" -v start="${START_ROW}" -v col="${COL_CNT}" '
NR >= start && NR < start + 100 {
    if (NF != col) {
        printf "ERROR: column count mismatch at line %d (expected=%d, actual=%d)\n", NR, col, NF
        exit 1
    }
}
' "${CSV_FILE}"
```

한 줄씩 분해하면:

| 부분                                | 의미                          |
| :-------------------------------- | :-------------------------- |
| `-F"${DELIM}"`                    | 필드 구분자를 `$DELIM` 변수 값으로 설정  |
| `-v start="${START_ROW}"`         | 쉘 변수를 awk 내부 변수 `start`로 전달 |
| `-v col="${COL_CNT}"`             | 쉘 변수를 awk 내부 변수 `col`로 전달   |
| `NR >= start && NR < start + 100` | 패턴: `start`번째 줄부터 100줄만 처리  |
| `NF != col`                       | 현재 줄의 필드 개수가 기대값과 다르면       |
| `printf "ERROR: ..."`             | 에러 메시지 출력                   |
| `exit 1`                          | awk를 비정상 종료                 |
| `' "${CSV_FILE}"`                 | 홑따옴표로 awk 프로그램 끝, 입력 파일 지정  |

> [!info]+ awk에 쉘 변수를 전달하는 방법
> - `-v var="$SHELL_VAR"` : 안전한 방법. awk 코드가 홑따옴표 안에 있어도 동작
> - awk 코드를 쌍따옴표로 감싸면 `$` 충돌이 생긴다 (쉘이 먼저 해석하려 함)
> - 항상 `-v` 옵션을 사용하는 것이 권장됨

---

### 5. 한 줄 텍스트 도구 모음

파이프로 조합해서 쓰는 도구들을 정리한다.

##### head / tail

```bash
head -n 1 "$CSV_FILE"      # 첫 줄만 (헤더 추출)
head -n 20 file.txt         # 앞 20줄
tail -n 10 file.txt         # 뒤 10줄
tail -f /var/log/app.log    # 실시간 로그 모니터링
```

##### cut

```bash
cut -d',' -f2 data.csv      # CSV의 2번째 필드
cut -d':' -f1,3 /etc/passwd # 1번째, 3번째 필드
cut -c1-10 file.txt         # 각 줄의 1~10번째 문자
```

##### sort / uniq

```bash
sort file.txt               # 정렬
sort -n numbers.txt          # 숫자 기준 정렬
sort -t',' -k2 data.csv     # 2번째 필드 기준 정렬
sort -u file.txt             # 정렬 + 중복 제거

# uniq는 연속 중복만 제거하므로 sort와 함께 사용
sort file.txt | uniq
sort file.txt | uniq -c      # 중복 횟수 표시
sort file.txt | uniq -d      # 중복된 줄만 표시
```

##### grep 옵션들

```bash
grep "pattern" file.txt      # 기본 검색
grep -i "pattern" file.txt   # 대소문자 무시
grep -r "pattern" dir/       # 재귀 검색
grep -n "pattern" file.txt   # 줄 번호 표시
grep -c "pattern" file.txt   # 매칭 줄 수
grep -v "pattern" file.txt   # 매칭되지 않는 줄
grep -l "pattern" dir/*      # 매칭된 파일명만

# -q : quiet 모드 (출력 없이 종료 코드만)
if grep -q ":${PORT} " <<< "$(ss -ltn)"; then
    echo "Port $PORT is in use"
fi
```

> [!tip]+ `grep -q`는 조건 검사에 최적
> 출력이 필요 없고 "있는지 없는지"만 알면 될 때 사용한다. 종료 코드 0(매칭됨) 또는 1(없음)만 반환한다.

##### date

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

### 6. IFS와 read 심화

##### IFS란

IFS(Internal Field Separator)는 Bash가 단어를 분리할 때 사용하는 구분자다. 기본값은 공백, 탭, 줄바꿈이다.

##### 단일 명령에만 IFS 적용

```bash
IFS="$DELIM" read -ra HEADER_ARR <<< "$HEADER_LINE"
```

이 한 줄을 분해하면:

| 부분                   | 의미                                  |
| :------------------- | :---------------------------------- |
| `IFS="$DELIM"`       | 이 `read` 명령에서만 IFS를 `$DELIM` 값으로 변경 |
| `read`               | stdin에서 한 줄 읽기                      |
| `-r`                 | 백슬래시를 이스케이프로 해석하지 않음                |
| `-a HEADER_ARR`      | 읽은 값을 배열로 저장                        |
| `<<< "$HEADER_LINE"` | 변수를 stdin으로 전달 (Here String)        |

> [!info]+ `VAR=value command` 문법
> 변수 할당과 명령을 한 줄에 쓰면, 해당 변수는 **그 명령의 실행 환경에서만** 유효하다. 명령이 끝나면 변수는 원래 값으로 돌아간다.
> ```bash
> IFS=: read -ra parts <<< "a:b:c"
> echo "${parts[@]}"  # a b c
> echo "$IFS"         # 원래 IFS (변경 안 됨)
> ```
> 단, 이 문법은 **명령어가 있어야** 동작한다. `IFS=":" arr=("a" "b")`처럼 변수 할당 2개를 붙여쓰면 둘 다 현재 쉘에 영구 적용된다.

##### CSV 헤더 파싱 실전 예제

```bash
DELIM=$(printf '\x07')  # BEL 문자를 구분자로 사용
HEADER_LINE=$(head -n 1 "${CSV_FILE}")

IFS="$DELIM" read -ra HEADER_ARR <<< "$HEADER_LINE"

for col in "${HEADER_ARR[@]}"; do
    # 각 열 이름을 정규화: 따옴표 제거, 공백 제거, 소문자 변환, 특수문자 제거
    clean=$(echo "$col" | tr -d '"' | tr -d ' ' | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9_]//g')
    echo "$clean"
done
```

---

### 7. Job Control

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

### 8. 에러 핸들링

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

|  시그널   | 설명                     |
| :----: | :--------------------- |
| `EXIT` | 스크립트 종료 시 (정상/비정상 모두)  |
| `INT`  | Ctrl+C                 |
| `TERM` | `kill` 명령              |
| `ERR`  | 명령 실패 시 (`set -e`와 조합) |

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

### 9. BashPitfalls 핵심 모음

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

### 10. Bash vs sh vs zsh 차이점

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

### 11. 실전 스크립트 템플릿

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
> - `set -euo pipefail` : 3편 에러 핸들링의 핵심
> - `log()`, `die()` : `printf` 기반으로 안전하게 출력
> - `trap ... EXIT` : 임시 파일 자동 정리
> - `shift` 패턴 : 긴 옵션 지원 인자 파싱
> - `command -v` : 의존성 명령어 존재 확인
> - `main "$@"` : 메인 함수 패턴으로 구조화
