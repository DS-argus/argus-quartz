---
tags:
  - linux
  - CLI
  - bash
created: 2026-06-01T00:00:00
updated: 2026-06-14T00:43:21
permalink: /Dev/linux/bash-shell-script-2-control-flow-and-io
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - 조건문(`if`, `case`, `[[ ]]`)과 반복문(`for`, `while`, `until`)으로 흐름을 제어
> - 함수 정의와 호출, `local` 변수, 반환값 패턴
> - 파일 디스크립터(FD 0/1/2) 이해와 리다이렉션 심화 (`2>&1`, 로그 패턴)
> - Here Document 실무 활용 (`<< EOF` vs `<< 'EOF'`, SQL 패턴)
> - 파이프, 프로세스 치환, `tee`, PIPESTATUS
> - 특수 변수(`$@`, `$?`, `$$`)와 인자 파싱 패턴

---

### 1. 조건문

##### if 문

Bash의 `if`는 `if` 뒤에 오는 명령어의 종료 상태를 기준으로 분기한다  
종료 상태가 `0`이면 성공으로 보고 `then`을 실행하고, `0`이 아니면 실패로 본다

```bash
if command; then
    echo "success"
elif another_command; then
    echo "another success"
else
    echo "fail"
fi
```

조건 비교가 필요할 때는 보통 `[[ ... ]]`를 사용한다

```bash
if [[ -f "$file" ]]; then
    echo "file exists"
elif [[ -d "$file" ]]; then
    echo "directory exists"
else
    echo "not found"
fi
```

단, `[[ ... ]]`만 `if`에 올 수 있는 것은 아니다  
일반 명령어도 성공/실패를 반환하므로 그대로 조건처럼 사용할 수 있다

```bash
if grep -q "ERROR" app.log; then
    echo "error found"
fi
```

##### 비교 연산자

###### 문자열 비교

```bash
[[ "$a" == "$b" ]]     # 같은지
[[ "$a" != "$b" ]]     # 다른지
[[ "$a" < "$b" ]]      # 사전순 비교
[[ -z "$a" ]]          # 빈 문자열인지  (zero length)
[[ -n "$a" ]]          # 비어있지 않은지 (non-zero length)
[[ "$a" =~ ^[0-9]+$ ]] # 정규식 매칭
```

###### 숫자 비교

```bash
[[ $a -eq $b ]]   # ==
[[ $a -ne $b ]]   # !=
[[ $a -lt $b ]]   # <
[[ $a -le $b ]]   # <=
[[ $a -gt $b ]]   # >
[[ $a -ge $b ]]   # >=

# (( )) 안에서는 일반 연산자 사용 가능
(( a > b ))
(( a == b ))
```

###### 파일 테스트

```bash
[[ -f "$file" ]]   # 일반 파일 존재
[[ -d "$dir" ]]    # 디렉토리 존재
[[ -e "$path" ]]   # 경로 존재 (파일 또는 디렉토리)
[[ -r "$file" ]]   # 읽기 권한
[[ -w "$file" ]]   # 쓰기 권한
[[ -x "$file" ]]   # 실행 권한
[[ -s "$file" ]]   # 파일이 비어있지 않음
[[ -L "$file" ]]   # 심볼릭 링크
[[ "$a" -nt "$b" ]]  # a가 b보다 새로운 파일
```

###### 논리 연산

```bash
[[ cond1 && cond2 ]]   # AND
[[ cond1 || cond2 ]]   # OR
[[ ! condition ]]      # NOT
```

> [!note]+ `[ ]` vs `[[ ]]`
> - `[ ]`는 POSIX 호환 `test` 명령어다. 이식성이 필요하면 사용한다.
> - `[[ ]]`는 Bash 내장 키워드로, 정규식 매칭(`=~`), 패턴 글로빙, `&&`/`||` 연산을 지원한다.
> - 특별한 이유가 없으면 `[[ ]]`를 쓴다.

##### case 문

여러 패턴에 대한 분기가 필요할 때 `if`/`elif` 체인보다 깔끔하다.

```bash
case "$input" in
    start)
        echo "Starting..."
        ;;
    stop|quit)
        echo "Stopping..."
        ;;
    restart)
        echo "Restarting..."
        ;;
    *)
        echo "Unknown: $input"
        ;;
esac
```

---

### 2. 반복문

##### for 문

```bash
# 리스트 순회
for item in apple banana cherry; do
    echo "$item"
done

# 배열 순회
for item in "${arr[@]}"; do
    echo "$item"
done

# 범위 (Bash 4.0+)
for i in {1..5}; do
    echo "$i"
done

# 범위 + 증가값
for i in {0..20..5}; do
    echo "$i"  # 0, 5, 10, 15, 20
done

# C-style
for ((i = 0; i < 10; i++)); do
    echo "$i"
done

# 파일 순회
for file in *.txt; do
    echo "Processing $file"
done
```

##### while / until

```bash
# while — 조건이 참인 동안
count=0
while [[ $count -lt 5 ]]; do
    echo "$count"
    ((count++))
done

# until — 조건이 참이 될 때까지
count=0
until [[ $count -ge 5 ]]; do
    echo "$count"
    ((count++))
done

# 파일을 한 줄씩 읽기
while IFS= read -r line; do
    echo "$line"
done < input.txt
```

> [!note]+ `while IFS= read -r line` 분해
> - `IFS=` : 줄의 앞뒤 공백을 보존 (기본 IFS는 공백/탭/줄바꿈)[^1]
> - `read -r` : 백슬래시를 이스케이프로 해석하지 않음
> - `< input.txt` : 파일을 while 루프의 stdin으로 연결
>
> 이 패턴이 파일을 줄 단위로 읽는 가장 안전한 방법이다.

##### break / continue

```bash
for i in {1..10}; do
    [[ $i -eq 3 ]] && continue  # 3 건너뛰기
    [[ $i -eq 7 ]] && break     # 7에서 중단
    echo "$i"
done
```

---

### 3. 함수

##### 기본 구조

```bash
# 선언 (function 키워드는 생략 가능)
greet() {
    local name="$1"
    echo "Hello, $name"
}

# 호출
greet "World"
```

##### 인자와 반환값

```bash
add() {
    local a=$1
    local b=$2
    echo $((a + b))  # 결과를 stdout으로 출력
}

# 결과를 변수에 담기
result=$(add 3 5)
echo "$result"  # 8
```

> [!note]+ `return`은 종료 코드(0~255)만 반환한다
> 실제 값을 반환하려면 `echo`로 출력하고 `$()`로 캡처하는 패턴을 쓴다.
> ```bash
> is_even() {
>     (( $1 % 2 == 0 )) && return 0 || return 1
> }
> if is_even 4; then echo "짝수"; fi
> ```

##### local 변수

```bash
outer() {
    local x=10
    inner() {
        local x=20
        echo "inner: $x"  # 20
    }
    inner
    echo "outer: $x"      # 10
}
```

> [!tip]+ 함수 내 변수는 항상 `local`로 선언하자
> `local` 없이 선언하면 전역 변수가 되어 의도치 않은 부작용이 생길 수 있다.

> [!info]+ `local var=$(cmd)` 주의점
> `local`이 명령어 치환의 종료 코드를 가린다. `set -e`를 쓰고 있다면 오류가 무시될 수 있다.
> ```bash
> # 나쁜 예: $(cmd) 실패해도 local이 성공(0)을 반환
> local result=$(failing_command)
>
> # 좋은 예: 선언과 할당을 분리
> local result
> result=$(failing_command)
> ```

---

### 4. 리다이렉션과 파일 디스크립터

##### 파일 디스크립터 기초

모든 프로세스는 기본 3개의 파일 디스크립터(FD)를 가진다.

| FD  |   이름   | 설명    |
| :-: | :----: | :---- |
|  0  | stdin  | 표준 입력 |
|  1  | stdout | 표준 출력 |
|  2  | stderr | 표준 에러 |

##### 쉬운 모델 - 입 1개와 출구 2개

FD를 직관적으로 잡으면 이렇다. 프로세스는 **입**(stdin) 1개와 **출구 2개**(stdout, stderr)를 가진 존재다.

- **stdin**(0) = 입: 데이터를 받아먹는 입구
- **stdout**(1) = 정상 결과를 내보내는 출구
- **stderr**(2) = 에러를 내보내는 별도 출구

여기서 핵심은 **FD 번호는 그 구멍의 번호일 뿐, 구멍이 어디에 연결될지는 고정이 아니다**라는 점이다. 기본값은 셋 다 터미널이지만, 셸이 그 연결을 다른 곳으로 바꿔 끼울 수 있다. 리다이렉션과 파이프는 전부 **"어느 구멍을 무엇에 꽂느냐"** 하나로 설명된다.

| 문법             | 하는 일 (구멍 → 꽂는 대상)                               |
| :------------- | :---------------------------------------------- |
| `cmd > f`      | stdout 출구 → 파일 f (덮어쓰기), `>>`는 이어쓰기             |
| `cmd < f`      | stdin 입구 → 파일 f                                 |
| `cmd 2> f`     | stderr 출구 → 파일 f (번호로 출구 지정)                    |
| `cmd1 \| cmd2` | cmd1의 stdout 출구 → cmd2의 stdin 입구                |
| `cmd 2>&1`     | stderr 출구 → **stdout이 현재 가리키는 곳** (출구를 출구에 합치기) |

즉 `|`는 꽂는 상대가 **다른 프로세스**, `<` `>`는 **파일**일 뿐 같은 메커니즘이다. 셸이 내부적으로 하는 일은 `dup2()` 시스템 콜로 **자식 프로세스의 FD 번호 칸이 가리키는 대상을 바꿔치기**하는 것이고, 그게 여기서 말하는 "꽂기"다.

> [!tip]+ stderr를 파이프로 보내려면
> 기본 `|`는 stdout만 넘긴다(stderr는 터미널에 남는다). 에러까지 파이프로 보내려면 먼저 stderr를 stdout에 합친다.
> ```bash
> cmd 2>&1 | grep something   # stderr를 stdout에 합친 뒤 파이프
> cmd |& grep something       # Bash 단축 문법 (위와 동일)
> ```

##### 기본 리다이렉션

```bash
# stdout을 파일로
echo "hello" > output.txt     # 덮어쓰기
echo "world" >> output.txt    # 이어쓰기

# stderr를 파일로
command 2> error.log

# stdout + stderr 모두 파일로
command > all.log 2>&1
command &> all.log             # 위와 동일 (Bash 단축 표현)

# stderr만 버리기
command 2>/dev/null

# 전부 버리기
command &>/dev/null

# stdin으로 파일 읽기
command < input.txt
```

##### `>` `>>` `<>` — 열 때의 플래그 차이

리다이렉션은 셸이 대신 파일을 열어 주는 일이다. `<` `>` `>>` `<>`는 셸이 그 파일을 `open()`으로 열 때 거는 플래그가 다를 뿐이고, 그 조합이 동작을 가른다.

| 연산자 | open() 플래그 | 효과 |
| :--- | :--- | :--- |
| `>` | `O_WRONLY`+`O_CREAT`+`O_TRUNC` | 쓰기 전용. 있으면 **0바이트로 비우고** 시작 |
| `>>` | `O_WRONLY`+`O_CREAT`+`O_APPEND` | 쓰기 전용. 항상 **끝에 이어쓰기**, 자르지 않음 |
| `<` | `O_RDONLY` | 읽기 전용 |
| `<>` | `O_RDWR`+`O_CREAT` | 읽기·쓰기 모두, **자르지 않음**. 없으면 생성 |

`>`가 열 때마다 파일을 비우는 건 `O_TRUNC` 때문이다. 내용을 지우지 않고 열려면 `>>`로 끝에 덧붙인다. `<>`는 한 FD로 읽기·쓰기를 동시에 여는 **드문** 형태라 일상 스크립트에선 거의 안 보이고, 같은 파일을 읽으며 제자리 수정하거나 `exec 3<>/dev/tcp/host/port`처럼 양방향 소켓을 열 때 정도에 쓴다.

각 플래그의 의미는 이렇다.

| 플래그 | 의미 |
| :--- | :--- |
| `O_RDONLY` / `O_WRONLY` / `O_RDWR` | 접근 모드 — 읽기 / 쓰기 / 읽기+쓰기. 셋 중 하나는 필수 |
| `O_CREAT` | 파일이 없으면 만든다 |
| `O_EXCL` | `O_CREAT`와 함께 쓰면, 이미 있을 때 실패(원자적 생성). `set -o noclobber`의 `>`가 이걸 쓴다 |
| `O_TRUNC` | 열 때 0바이트로 자른다 |
| `O_APPEND` | 매 쓰기를 항상 파일 끝에서 한다 |

`open()`에는 이 밖에도 `O_CLOEXEC`(exec 시 자동 닫기), `O_NONBLOCK`(논블로킹), `O_SYNC`(쓰기를 디스크까지 동기) 같은 플래그가 더 있지만, 셸 리다이렉션으로 직접 닿는 건 위 표 정도다.

> [!note]+ 한 번만 듣는 플래그, 계속 듣는 플래그
> `open()` 플래그는 작용 시점이 둘로 갈린다.
> - **생성 플래그**(`O_CREAT`·`O_EXCL`·`O_TRUNC` 등): **열 때 한 번**만 작용하고 끝. 나중에 바꿀 수 없다
> - **상태 플래그**(`O_APPEND`·`O_NONBLOCK` 등): 이후 입출력 동작을 바꾸고, 열려 있는 동안 `fcntl`로 **나중에 켜고 끌 수 있다**
>
> 그래서 `O_TRUNC`는 연 뒤 되돌릴 수 없지만, `O_NONBLOCK`은 이미 연 FD에 `fcntl`로 토글할 수 있다.

##### 실무 로그 패턴

프로젝트 쉘 스크립트에서 자주 보는 패턴이다.

```bash
# stdout과 stderr를 모두 로그 파일에 append
command >> "$LOG_FILE" 2>&1
```

이 한 줄을 분해하면:
1. `>>` : stdout(FD 1)을 `$LOG_FILE`에 append 모드로 연결
2. `2>&1` : stderr(FD 2)를 FD 1이 현재 가리키는 곳(= `$LOG_FILE`)으로 연결

**순서가 중요하다.** `2>&1 >> "$LOG_FILE"`로 쓰면 stderr가 아직 터미널을 가리키는 FD 1에 연결된 후 stdout만 파일로 가므로, stderr는 로그에 안 쌓인다.

##### tee — 터미널과 파일에 동시 출력

```bash
# stdout을 화면에도 보여주고 파일에도 저장
command | tee output.log

# append 모드 (-a)
command | tee -a "$LOG_FILE"

# stderr도 함께 tee로 보내기
command 2>&1 | tee -a "$LOG_FILE"
```

> [!tip]+ `tee`의 실무 용도
> 스크립트 실행 로그를 파일에 쌓으면서 터미널에서도 실시간으로 확인하고 싶을 때 사용한다.   
> `-a`(append) 옵션을 빠뜨리면 기존 로그가 날아가니 주의.

> [!Info]+ 파이프와 stdout 연결
> `|`를 사용하면 왼쪽 명령어의 `stdout`은 터미널이 아니라 오른쪽 명령어의 `stdin`으로 연결된다.  
>  그래서 `command 2>&1 | tee -a "$LOG_FILE"`에서 `2>&1`은 `stderr`를 “현재 stdout”, 즉 `tee`로 이어지는 파이프로 보내는 의미가 된다.


---

### 5. Here Document / Here String

##### Here Document

여러 줄 텍스트를 명령의 stdin으로 전달한다.

```bash
# 기본 — 변수 치환됨
cat <<EOF
Hello, $USER
Today is $(date)
EOF

# 변수 치환 없이 — 따옴표로 감싸기
cat <<'EOF'
This $variable is not expanded
$(this command too)
EOF
```

> [!info]+ `<< EOF` vs `<< 'EOF'`
> - `<< EOF` : 내부에서 `$변수`와 `$(명령)`이 치환된다.
> - `<< 'EOF'` : 모든 것이 리터럴로 처리된다. 변수 치환 없음.
>
> 종료 마커 이름은 `EOF` 고정이 아니다. 시작과 끝이 같기만 하면 된다. `QUERY`, `SQL`, `HELP` 등 용도에 맞게 쓸 수 있다.

##### 실무 SQL 패턴

쉘 스크립트에서 SQL을 깔끔하게 작성하는 데 Here Document가 유용하다.

```bash
SQL=$(cat <<EOF
SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.created_at >= '${START_DATE}'
ORDER BY o.total DESC
LIMIT 100
EOF
)

psql -h "$DB_HOST" -d "$DB_NAME" -c "$SQL"
```

Here Document를 `$(cat << EOF ... EOF)` 형태로 감싸면 여러 줄 SQL을 변수에 담을 수 있다. 이 패턴의 장점:
- 긴 SQL을 보기 좋게 들여쓰기 가능
- 따옴표가 많은 문자열 처리가 편함
- 변수 치환이 자연스럽게 동작

##### Here String

한 줄 입력을 stdin으로 전달한다.

```bash
grep "pattern" <<< "search in this string"

# 변수를 stdin으로 전달할 때 유용
while IFS=: read -r user _ uid _; do
    echo "$user ($uid)"
done <<< "$(getent passwd root)"
```

---

### 6. 파이프와 프로세스 치환

##### 파이프 기본

```bash
# stdout을 다음 명령의 stdin으로 연결
ls -la | grep ".txt" | wc -l
```

##### 파이프와 서브쉘 함정

파이프의 각 명령은 **서브쉘**에서 실행된다. 서브쉘에서 변경한 변수는 밖에서 보이지 않는다.

```bash
# 이 코드는 동작하지 않는다
count=0
cat file.txt | while read -r line; do
    ((count++))
done
echo "$count"  # 항상 0 (서브쉘에서 증가한 값은 소멸)

# 해결 방법 1: 리다이렉션 사용 (파이프 제거)
count=0
while read -r line; do
    ((count++))
done < file.txt
echo "$count"  # 정상 동작

# 해결 방법 2: 프로세스 치환
count=0
while read -r line; do
    ((count++))
done < <(some_command)
echo "$count"  # 정상 동작
```

##### 프로세스 치환

명령의 출력을 파일처럼 사용한다. (파일처럼 읽을 수 있는 경로로 제공하여 불필요한 파일 생기지 않음)

```bash
# 두 명령의 출력을 비교
diff <(sort file1.txt) <(sort file2.txt)

# 여러 소스를 하나로 합치기
cat <(head -5 file1.txt) <(head -5 file2.txt)
```

##### PIPESTATUS

파이프라인의 각 명령별 종료 코드를 확인할 수 있다.

```bash
false | true | false
echo "${PIPESTATUS[@]}"  # 1 0 1
```

> [!note]+ `set -o pipefail`과 함께 사용
> 기본적으로 파이프라인의 종료 코드는 마지막 명령의 것만 반영된다. `set -o pipefail`을 설정하면 파이프라인 중 하나라도 실패하면 전체가 실패로 처리된다.

---

### 7. 특수 변수

```bash
$0          # 스크립트 이름
$1 ~ $9     # 위치 인자 (1번째 ~ 9번째)
${10}       # 10번째 이상은 중괄호 필요
$#          # 인자 개수
$@          # 모든 인자 (개별 단어로)
$*          # 모든 인자 (하나의 문자열로)
$?          # 직전 명령의 종료 코드
$$          # 현재 쉘의 PID
$!          # 마지막 백그라운드 프로세스 PID
$_          # 직전 명령의 마지막 인자
```

> [!note]+ `$@` vs `$*`
> 따옴표로 감쌀 때 차이가 나타난다.
> - `"$@"` → 각 인자가 독립적인 단어로 유지된다: `"arg1" "arg2" "arg3"`
> - `"$*"` → 모든 인자가 하나로 합쳐진다: `"arg1 arg2 arg3"`
>
> 거의 모든 경우에 `"$@"`를 쓴다.

---

### 8. 인자 파싱

##### 직접 파싱 (shift 사용)

```bash
while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--name)
            name="$2"
            shift 2
            ;;
        -v|--verbose)
            verbose=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [-n name] [-v]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done
```

##### getopts (짧은 옵션만)

```bash
while getopts "n:vh" opt; do
    case "$opt" in
        n) name="$OPTARG" ;;
        v) verbose=true ;;
        h) echo "Usage: $0 [-n name] [-v]"; exit 0 ;;
        ?) exit 1 ;;
    esac
done
shift $((OPTIND - 1))  # 나머지 인자 처리
```

> [!tip]+ 긴 옵션(`--name`)이 필요하면
> `getopts`는 짧은 옵션만 지원한다. 긴 옵션이 필요하면 `shift` 패턴을 쓰거나 `getopt`(외부 명령)을 사용한다.

[^1]: Internal Field Separator . Bash가 문자열을 쪼갤 때 기준으로 삼는 구분자 목록
