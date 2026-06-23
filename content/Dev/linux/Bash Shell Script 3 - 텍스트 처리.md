---
tags:
  - linux
  - CLI
  - bash
created: 2026-06-01T00:00:00
updated: 2026-06-21T00:00:00
permalink: /Dev/linux/bash-shell-script-3-text-processing
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - 텍스트 도구는 **바꾸는 것**(`tr`·`sed`·`awk`, 표현력이 커서 따로)과 **골라내는 것**(`grep`·`head`/`tail`·`cut`·`sort`/`uniq`·`shuf`, 파이프로 조합)으로 나뉨
> - `printf`는 `echo`보다 안전하고 이식성이 좋음 (특수문자, 포맷 제어)
> - 변형 도구는 `tr`(문자) → `sed`(줄) → `awk`(필드)로 복잡도가 올라감
> - `read`로 한 줄씩 읽고, `IFS="$DELIM" read -ra`로 구분자 기반 파싱
> - 같은 일은 간단한 도구부터: `grep`/`cut`으로 될 일에 `awk`를 꺼내지 않기

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

### 2. 텍스트 도구 분류 — 바꾸기 vs 골라내기

본격적으로 도구를 보기 전에 지도를 그려 둔다. 셸의 텍스트 도구는 하는 일에 따라 크게 둘로 갈린다. 이 분류를 잡고 가면 "이 일에 뭘 쓰지"가 빨리 정해진다.

- **바꾸는 도구** (변형): 입력을 받아 **내용을 고쳐서** 내보낸다. 치환·삭제·재배열처럼 표현할 게 많아 각자 작은 언어에 가깝다. 그래서 `tr`·`sed`·`awk`는 아래에서 **하나씩 따로** 다룬다.
- **골라내는 도구** (선택/필터): 입력에서 **일부만 추려서** 내보낸다. 각자 한 가지 일만 하고 옵션 몇 개로 끝나므로, 외워서 쓰기보다 파이프로 이어 붙인다. `grep`·`head`/`tail`·`cut`·`sort`/`uniq`·`shuf`가 여기 속해서 **한 섹션에 모았다**.

| 분류 | 하는 일 | 도구 | 이 글에서 |
| :--- | :--- | :--- | :--- |
| 출력 | 텍스트를 만들어 내보냄 | `printf`, `echo` | 개별 (1번) |
| 변형 | 입력을 **바꿔서** 출력 | `tr`, `sed`, `awk` | 각각 따로 |
| 선택 | 입력의 **일부만** 골라냄 | `grep`, `head`/`tail`, `cut`, `sort`/`uniq`, `shuf` | 한 섹션에 모음 |

> [!tip]+ 복잡도 순서로 올라가기
> 같은 일을 여러 도구로 할 수 있을 땐 **간단한 쪽부터** 고른다. 문자만 바꾸면 `tr`, 줄 단위 치환이면 `sed`, 필드·조건·집계가 필요하면 `awk`. 골라내기도 마찬가지로 `grep`/`cut`으로 끝날 일에 `awk`를 꺼내지 않는다.

> [!note]+ 텍스트 도구가 아닌 것들
> `date`(날짜 포맷)나 `ss`(네트워크 소켓)는 스크립트에서 자주 보이지만 텍스트를 처리하는 도구가 아니다. 이런 명령과 견고한 스크립트 작성법은 [[Bash Shell Script 4 - 실전 스크립트 패턴|4편]]에서 다룬다.

---

### 3. tr — 문자 변환/삭제

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

### 4. sed — 스트림 편집기

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

### 5. awk — 패턴 매칭 + 필드 처리

`awk`는 텍스트를 **필드**(열) **단위**로 처리하는 프로그래밍 언어다. `tr`(문자), `sed`(줄)보다 한 단계 강력하다.

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

##### BEGIN {} pattern {} END {} — awk의 큰 흐름

awk 프로그램은 세 종류의 블록으로 짜인다. 입력을 한 줄씩 읽으면서 가운데 블록을 반복하고, 그 앞뒤를 BEGIN과 END가 한 번씩 감싼다.

```bash
awk '
BEGIN { ... }      # 입력을 읽기 전에 딱 한 번 (변수 초기화, 구분자 설정, 헤더 출력)
pattern { action } # 각 줄마다: pattern이 참인 줄에서만 action 실행
END   { ... }      # 모든 줄을 다 읽은 뒤 딱 한 번 (집계 결과 출력)
' file
```

세 블록 모두 선택이다. `{ action }`만 쓰면 전 줄에 적용되고, `pattern`만 쓰면 매칭된 줄을 그대로 출력한다. 줄을 읽고 필드로 쪼개는 루프는 awk가 자동으로 돌리므로, `for`를 직접 짤 필요가 없다.

```bash
# BEGIN에서 초기화, 본문에서 누적, END에서 출력
awk 'BEGIN { sum=0 } { sum += $1 } END { print "Total:", sum }' numbers.txt

# BEGIN만 — 입력 없이 계산기처럼
awk 'BEGIN { printf "%.2f\n", 10/3 }'    # 3.33

# END만 — 전체 줄 수 (NR은 마지막에 읽은 줄 번호)
awk 'END { print NR }' file.txt
```

##### awk 고유 문법 — 연관 배열·조건문·삼항·exit

awk는 한 줄짜리 명령처럼 보여도 안은 작은 프로그래밍 언어다. 실무에서 자주 만나는 고유 문법을 한 예제에 모아 보면 이렇다. 아래는 파일의 **첫 번째 필드에 중복이 있는지** 검사하는 코드다.

```bash
if awk '{ seen[$1]++; if (seen[$1] > 1) { duplicated = 1 } } END { exit duplicated ? 0 : 1 }' "$lease_file"; then
    echo "중복된 첫 필드가 있다"
fi
```

조각을 하나씩 뜯어보면:

| 문법 | 의미 |
| :--- | :--- |
| `seen[$1]++` | **연관 배열**(해시). 키 `$1`(첫 필드)의 값을 1 증가. 없던 키는 0에서 시작 |
| `seen[$1] > 1` | 같은 첫 필드를 두 번 이상 봤다는 뜻 |
| `if (...) { ... }` | action 안에서 쓰는 **조건문**. 괄호·중괄호 모두 C 문법과 같다 |
| `duplicated = 1` | 선언 없이 바로 쓰는 변수. awk 변수의 기본값은 0(또는 빈 문자열) |
| `END { exit ... }` | 모든 줄을 읽은 뒤 종료 코드를 정한다 |
| `duplicated ? 0 : 1` | **삼항 연산자**. 중복이 있으면 `exit 0`, 없으면 `exit 1` |

> [!info]+ awk의 `exit`와 쉘 종료 코드
> awk의 `exit N`은 그대로 awk 프로세스의 종료 코드가 된다. 그래서 `if awk '...'; then`처럼 awk를 **조건문으로 직접** 쓸 수 있다. 위 예제는 "중복이 있으면 0(참)"으로 뒤집어, `if`가 중복을 발견했을 때 분기하도록 만든 것이다.
> - 종료 코드 0 = 성공/참, 0이 아니면 실패/거짓 (쉘의 관례)
> - awk 변수는 초기화하지 않아도 숫자 자리에서는 0, 문자열 자리에서는 빈 문자열로 시작한다

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

### 6. 텍스트를 골라내는 도구 (필터)

여기 도구들은 입력에서 **일부만 골라낼 뿐** 내용을 바꾸지 않는다. `tr`/`sed`/`awk`처럼 프로그램을 짜는 게 아니라, 각자 정해진 한 가지 동작을 옵션으로 부른다. 그래서 따로따로 외우기보다 **파이프로 조합**해서 쓴다.

##### grep — 패턴으로 줄 고르기

```bash
grep "pattern" file.txt      # 기본 검색
grep -i "pattern" file.txt   # 대소문자 무시
grep -r "pattern" dir/       # 재귀 검색
grep -n "pattern" file.txt   # 줄 번호 표시
grep -c "pattern" file.txt   # 매칭 줄 수
grep -v "pattern" file.txt   # 매칭되지 않는 줄
grep -l "pattern" dir/*      # 매칭된 파일명만

# -q : quiet 모드 (출력 없이 종료 코드만)
if grep -q "ERROR" app.log; then
    echo "로그에 ERROR가 있다"
fi
```

> [!tip]+ `grep -q`는 조건 검사에 최적
> 출력이 필요 없고 "있는지 없는지"만 알면 될 때 사용한다. 종료 코드 0(매칭됨) 또는 1(없음)만 반환한다.

##### head / tail — 앞·뒤에서 자르기

```bash
head -n 1 "$CSV_FILE"      # 첫 줄만 (헤더 추출)
head -n 20 file.txt         # 앞 20줄
tail -n 10 file.txt         # 뒤 10줄
tail -f /var/log/app.log    # 실시간 로그 모니터링
```

##### cut — 열(필드) 뽑기

```bash
cut -d',' -f2 data.csv      # CSV의 2번째 필드
cut -d':' -f1,3 /etc/passwd # 1번째, 3번째 필드
cut -c1-10 file.txt         # 각 줄의 1~10번째 문자
```

##### sort / uniq — 정렬과 중복 제거

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

##### shuf — 줄 무작위 섞기/추출

`shuf`는 입력 줄의 순서를 무작위로 섞는다. `sort`의 반대라고 보면 된다. 무작위 표본 추출이나 테스트 데이터 생성에 쓴다.

```bash
shuf file.txt                # 모든 줄을 무작위 순서로
shuf -n 5 file.txt           # 무작위로 5줄만 추출
shuf -e apple banana cherry  # 인자로 준 항목들을 섞기
shuf -i 1-100                # 1~100 범위의 숫자를 섞어서 출력
shuf -i 1-100 -n 1           # 1~100 중 무작위 정수 하나 (난수 생성)

# 무작위로 한 줄 뽑기 (예: 랜덤 명언)
shuf -n 1 quotes.txt
```

> [!tip]+ `shuf -n 1` vs `$RANDOM`
> `$RANDOM`은 0~32767 범위라 큰 범위로 늘리면 편향이 생긴다. 균등한 난수가 필요하면 `shuf -i 0-N -n 1`이 더 안전하다.

> [!note]+ macOS에는 `shuf`가 없다
> `shuf`는 GNU coreutils 도구라 Linux엔 기본 탑재지만 macOS엔 없다. `brew install coreutils`로 설치하면 `gshuf`로 쓸 수 있다. 설치가 어렵다면 BSD·GNU 공통으로 동작하는 `sort -R`(줄 무작위 정렬)로 대체한다.
> ```bash
> sort -R file.txt | head -n 5   # shuf -n 5 와 유사
> ```

---

### 7. read와 IFS

##### read 기본 — stdin에서 한 줄씩 읽기

`read`는 stdin에서 한 줄을 읽어 변수에 담는 쉘 빌트인이다. 파일을 줄 단위로 순회하거나 사용자 입력을 받을 때 쓴다.

```bash
read -r line                 # 한 줄을 읽어 line에 저장
read -r first rest           # 첫 단어는 first, 나머지는 rest (IFS 기준 분리)
read -ra arr                 # 단어들을 배열 arr에 저장
```

여러 변수를 주면 IFS로 쪼개 앞에서부터 채우고, **마지막 변수에 남은 전체**가 들어간다.

```bash
echo "a b c d" | { read -r x y z; echo "x=$x | y=$y | z=$z"; }
# x=a | y=b | z=c d   (z에 "c d"가 통째로)
```

자주 쓰는 옵션:

| 옵션 | 의미 |
| :--- | :--- |
| `-r` | 백슬래시를 이스케이프로 풀지 않음 (**항상 붙이는 게 기본**) |
| `-p "프롬프트"` | 읽기 전에 프롬프트 출력 (`read -rp "Name: " name`) |
| `-a 배열` | 입력을 배열로 저장 |
| `-d 구분자` | 줄바꿈 대신 지정한 문자까지 읽음 (`-d ''`는 NUL 구분, `find -print0`과 짝) |
| `-n N` | N글자를 읽으면 Enter 없이 즉시 반환 |
| `-s` | 입력을 화면에 표시하지 않음 (비밀번호) |
| `-t N` | N초 안에 입력이 없으면 실패 종료 |
| `-u FD` | stdin(0) 대신 지정한 파일 디스크립터에서 읽음 |

```bash
# 비밀번호 입력 (에코 끔)
read -rsp "Password: " pw; echo

# 한 글자만 받고 Enter 불필요 (y/n 즉시 반응)
read -rn1 -p "Continue? [y/n] " ans; echo

# 5초 타임아웃
if read -rt 5 -p "5초 안에 입력: " val; then
    echo "입력: $val"
else
    echo "시간 초과"
fi
```

> [!warning]+ `read`가 마지막 줄을 놓치는 경우
> `while read -r line` 루프는 **줄바꿈으로 끝나지 않는 마지막 줄**을 빠뜨린다. read는 구분자(줄바꿈)를 만나야 종료 코드 0을 내는데, 파일 끝에 줄바꿈이 없으면 마지막 read가 실패 코드를 내며 루프를 끝내기 때문이다.
> ```bash
> while read -r line || [[ -n "$line" ]]; do
>     echo "$line"
> done < file.txt
> ```
> `|| [[ -n "$line" ]]`는 "read가 실패했어도 line에 내용이 남아 있으면 한 번 더 처리"하라는 뜻이다.

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

##### 실전 비교 — 각 줄의 첫 필드가 특정 값과 같은지 확인

lease 파일처럼 각 줄의 첫 필드가 포트 번호인 파일에서, 특정 포트가 이미 들어 있는지 확인한다고 하자. 같은 일을 `grep`, `awk`, `read`로 각각 풀 수 있고, 무엇을 더 하려는지에 따라 선택이 갈린다.

가정한 입력(`$lease_file`):

```
8080 web   active
9090 api   active
5432 db    idle
```

**방법 1 — grep**: 가장 짧지만 "필드" 개념이 없어 정규식으로 위치를 고정해야 한다.

```bash
# 줄 맨 앞(^)에서 포트 + 공백까지 매칭. -q는 출력 없이 종료 코드만
if grep -qE "^${PORT}[[:space:]]" "$lease_file"; then
    echo "port $PORT 사용 중"
fi
```

- 장점: 짧고 빠르다
- 단점: 줄 전체를 보는 도구라 위치 고정(`^`, 구분자)을 손으로 처리해야 한다. 구분자가 탭이나 가변 공백이면 정규식이 까다로워지고, `^${PORT}` 뒤를 안 막으면 `8080`이 `80800`에도 걸린다

**방법 2 — awk**: 필드를 직접 다루므로 의도가 가장 또렷하다.

```bash
# $1(첫 필드)이 포트와 정확히 같은 줄을 봤으면 found=1, END에서 종료 코드 결정
if awk -v p="$PORT" '$1 == p { found = 1 } END { exit found ? 0 : 1 }' "$lease_file"; then
    echo "port $PORT 사용 중"
fi
```

- 장점: `$1 == p`로 "첫 필드가 정확히 일치"를 그대로 표현. 숫자 비교라 부분 매칭 사고가 없다
- 단점: 값 하나만 확인하기엔 살짝 무겁다

> [!warning]+ `{ exit 0 } END { exit 1 }`로 짜지 말 것
> 본문 블록에서 `exit`를 부르면 awk는 곧장 종료하지 않고 **END 블록을 먼저 실행**한다. 그래서 `'$1 == p { exit 0 } END { exit 1 }'`는 매칭이 돼도 END의 `exit 1`이 코드를 덮어써 항상 실패로 끝난다. 위처럼 플래그를 세우고 종료 코드는 END에서 한 번만 정하는 게 안전하다.

**방법 3 — while read**: 셸 안에서 각 필드를 변수로 받아 뒤에 로직을 더 붙이기 좋다.

```bash
found=0
while read -r port name state _; do
    if [[ "$port" == "$PORT" ]]; then
        found=1
        break
    fi
done < "$lease_file"
[[ $found -eq 1 ]] && echo "port $PORT 사용 중 (name=$name)"
```

- 장점: 매칭된 줄의 다른 필드(`name`, `state`)까지 꺼내 셸에서 가공하기 쉽다
- 단점: 가장 장황하고 느리다. 단순 존재 확인에는 과하다

> [!tip]+ 어떤 걸 고를까
> - 단순히 "있는지 없는지"만 → `grep -q` 또는 `awk '... { exit 0 }'`
> - 필드 위치·정확 일치가 중요 → `awk` (`$1 == 값`)
> - 매칭된 줄의 다른 필드까지 셸에서 가공 → `while read -r`
>
> 파이프(`grep | awk | ...`)를 길게 잇기 전에, awk 하나로 끝나는지부터 따져보는 게 좋다.

---

지금까지가 텍스트를 읽고·바꾸고·골라내는 도구들이다. 다음 편에서는 이 도구들로 **견고한 스크립트를 짜는 법** — 임시 파일·Job Control·에러 핸들링·실전 템플릿 — 을 다룬다. [[Bash Shell Script 4 - 실전 스크립트 패턴|4편]]으로 이어진다.
