---
tags:
  - linux
  - CLI
  - bash
created: 2026-06-01T00:00:00
updated: 2026-06-01T20:39:32
permalink: /Dev/linux/bash-shell-script-1-basics
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Bash에서 명령어가 해석되는 과정(단어 분리, 명령어 5가지 타입)을 이해하면 디버깅이 쉬워짐
> - 특수 문자(`$`, `()`, `{}`, `<>`, `|` 등)의 역할을 알아야 스크립트를 읽을 수 있음
> - 변수, 따옴표 규칙, 파라미터 확장, 문자열 조작은 모든 스크립트의 기본 도구
> - 배열(인덱스/연관)과 glob/정규식 패턴 매칭까지 다루면 1편 완료

> [!note]+ 시리즈
> - **1편: 기초 문법과 데이터 다루기** (현재 글)
> - [[Bash Shell Script 2 - 제어 흐름과 IO|2편: 제어 흐름과 I/O]]
> - [[Bash Shell Script 3 - 텍스트 처리와 실전 패턴|3편: 텍스트 처리와 실전 패턴]]

---

### 1. 시작하기

##### Shebang

스크립트 첫 줄에 인터프리터를 지정한다.

```bash
#!/bin/bash
```

`env`를 사용하면 `bash`가 어디 설치되어 있든 PATH에서 찾아 실행한다.

```bash
#!/usr/bin/env bash
```

##### 실행 방법

```bash
# 실행 권한 부여 후 직접 실행
chmod +x script.sh
./script.sh

# bash로 명시적 실행 (권한 불필요)
bash script.sh

# 현재 쉘에서 실행 (변수/함수가 현재 쉘에 남음)
source script.sh
```

> [!tip]+ `./script.sh` vs `source script.sh`
> - `./script.sh`는 서브쉘에서 실행된다. 스크립트 내 변수가 현재 쉘에 영향을 주지 않는다.
> - `source script.sh`는 현재 쉘에서 직접 실행된다. 환경변수 설정, alias 등록 등에 사용한다.

---

### 2. 명령어와 인자

Bash는 입력을 **공백 기준으로 단어(word)로 분리**한다. 첫 번째 단어가 명령어 이름이 되고, 나머지가 인자가 된다.

```bash
cp -r src/ dest/
# cp    → 명령어
# -r    → 첫 번째 인자
# src/  → 두 번째 인자
# dest/ → 세 번째 인자
```

이 "단어 분리(word splitting)" 메커니즘이 Bash에서 따옴표가 중요한 이유다. 공백이 포함된 파일명이 의도치 않게 쪼개지기 때문이다.

```bash
file="my report.txt"
cat $file    # cat my report.txt → 인자 2개로 쪼개짐 (오류)
cat "$file"  # cat "my report.txt" → 인자 1개로 유지 (정상)
```

##### 명령어의 5가지 타입

Bash는 명령어를 찾을 때 아래 순서로 탐색한다.

| 순서  |       타입       | 설명                        | 예시                             |
| :-: | :------------: | :------------------------ | :----------------------------- |
|  1  |   **Alias**    | 텍스트 치환 단축어. 인터랙티브 쉘에서만 동작 | `alias ll='ls -la'`            |
|  2  |  **Function**  | 사용자 정의 명령 묶음              | `greet() { echo "hi"; }`       |
|  3  |  **Builtin**   | Bash 자체 내장 명령             | `cd`, `echo`, `read`, `export` |
|  4  |  **Keyword**   | Bash 문법의 일부로 특수하게 파싱됨     | `if`, `for`, `while`, `[[`     |
|  5  | **Executable** | PATH에서 찾는 외부 프로그램         | `/usr/bin/grep`, `/bin/ls`     |

```bash
# 명령어 타입 확인
type cd       # cd is a shell builtin
type ls       # ls is /bin/ls
type [[       # [[ is a shell keyword
type -a echo  # builtin과 executable 모두 표시
```

> [!info]+ `which` vs `type`
> `which`는 PATH에서 실행 파일만 찾는다. `type`은 alias, function, builtin, keyword까지 모두 보여주므로 더 유용하다.

---

### 3. 특수 문자

Bash에서 특별한 의미를 가지는 문자들을 알아야 스크립트를 읽고 쓸 수 있다.

##### 공백과 줄바꿈

공백, 탭, 줄바꿈은 **단어 구분자**다. 여러 공백은 하나와 동일하게 취급된다.

##### 확장과 치환 관련

|    문자     | 용도             | 예시                        |
| :-------: | :------------- | :------------------------ |
|    `$`    | 변수/파라미터 확장     | `$HOME`, `${var}`         |
|   `$()`   | 명령어 치환         | `$(date +%Y)`             |
|  `$(())`  | 산술 확장          | `$((a + b))`              |
| `` ` ` `` | 명령어 치환 (레거시)   | `` `date` ``              |
|   `{}`    | 중괄호 확장 / 변수 구분 | `{1..5}`, `${var}_suffix` |

##### 리다이렉션과 파이프

|  문자  | 용도                      | 예시                   |
| :--: | :---------------------- | :------------------- |
| `>`  | stdout을 파일로 (덮어쓰기)      | `echo hi > out.txt`  |
| `>>` | stdout을 파일로 (이어쓰기)      | `echo hi >> out.txt` |
| `<`  | 파일을 stdin으로             | `sort < data.txt`    |
| `\|` | 파이프 (stdout → 다음 stdin) | `ls \| grep txt`     |
| `2>` | stderr를 파일로             | `cmd 2> err.log`     |
| `&>` | stdout+stderr 모두 파일로    | `cmd &> all.log`     |

##### 제어와 실행

| 문자 | 용도 | 예시 |
|:---:|:---|:---|
| `;` | 명령어 순차 실행 | `cd dir; ls` |
| `&&` | 앞 명령 성공 시 실행 | `make && make install` |
| `\|\|` | 앞 명령 실패 시 실행 | `cd dir \|\| exit 1` |
| `&` | 백그라운드 실행 | `sleep 10 &` |
| `()` | 서브쉘에서 실행 | `(cd /tmp; ls)` |
| `{}` | 현재 쉘에서 그룹 실행 | `{ echo a; echo b; }` |

##### 글로빙과 패턴

| 문자 | 용도 | 예시 |
|:---:|:---|:---|
| `*` | 0개 이상의 임의 문자 | `*.txt` |
| `?` | 정확히 1개의 임의 문자 | `file?.log` |
| `[]` | 문자 클래스 | `[abc]`, `[0-9]` |
| `~` | 홈 디렉토리 | `~/Documents` |
| `#` | 주석 | `# 이건 주석` |
| `\` | 이스케이프 (특수 문자 무효화) | `echo \$HOME` |

> [!note]+ `()` vs `{}`
> - `(commands)` — 서브쉘에서 실행. 내부 변수 변경이 밖에 영향을 주지 않는다.
> - `{ commands; }` — 현재 쉘에서 실행. 변수 변경이 유지된다. 닫는 `}` 앞에 `;`이 필요하다.
> ```bash
> x=1; (x=2; echo "inside: $x"); echo "outside: $x"
> # inside: 2, outside: 1
>
> x=1; { x=2; echo "inside: $x"; }; echo "outside: $x"
> # inside: 2, outside: 2
> ```

---

### 4. 변수

##### 기본 변수

```bash
# 선언 (= 앞뒤에 공백 없어야 함)
name="world"
count=42

# 사용
echo "Hello, $name"
echo "Count is ${count}"
```

> [!note]+ `$var` vs `${var}`
> 대부분의 경우 `$var`로 충분하지만, 변수명 바로 뒤에 문자가 붙을 때는 `${var}`로 구분해줘야 한다.
> ```bash
> file="report"
> echo "${file}_2026.txt"  # report_2026.txt
> echo "$file_2026.txt"    # 빈 문자열 (file_2026이라는 변수를 찾음)
> ```

##### 따옴표 규칙

```bash
name="Bash"

echo "Hello $name"   # Hello Bash (변수 치환됨)
echo 'Hello $name'   # Hello $name (그대로 출력)
echo "It's $name"    # It's Bash
```

|   따옴표    | 변수 치환 | 용도                     |
| :------: | :---: | :--------------------- |
| `"쌍따옴표"` |   O   | 변수를 포함한 문자열            |
| `'홑따옴표'` |   X   | 리터럴 문자열                |
|    없음    |   O   | 단순 값 (공백 있으면 단어 분리 발생) |

> [!tip]+ 따옴표 사용 원칙
> "확신이 없으면 쌍따옴표를 쓴다."   
> 변수를 쌍따옴표 없이 사용하면 단어 분리(word splitting)와 글로빙(pathname expansion)이 발생할 수 있다.

##### 명령어 치환

```bash
# $() 방식 (권장)
today=$(date +%Y-%m-%d)

# 백틱 방식 (레거시)
today=`date +%Y-%m-%d`
```

`$()`는 중첩이 가능하다.

```bash
echo "Files: $(ls $(pwd))"
```

##### 산술 연산

```bash
a=10
b=3

# $(( )) 사용
echo $((a + b))     # 13
echo $((a / b))     # 3 (정수 나눗셈)
echo $((a % b))     # 1
echo $((a ** 2))    # 100

# 변수에 할당
result=$((a * b))

# 증감
((a++))
((b += 5))
```

> [!note]+ Bash는 정수 연산만 지원한다
> 소수점 연산이 필요하면 `bc`나 `awk`를 사용한다.
> ```bash
> echo "10 / 3" | bc -l    # 3.33333333333333333333
> awk "BEGIN {printf \"%.2f\", 10/3}"  # 3.33
> ```

##### 환경 변수 vs 지역 변수

```bash
# 환경 변수 — 자식 프로세스에 상속됨
export API_KEY="abc123"

# 지역 변수 — 현재 쉘에서만 유효
local_var="only here"

# 특정 명령에만 환경 변수 전달
DEBUG=1 ./app.sh
```

> [!info]+ 변수 이름 컨벤션
> 환경 변수는 대문자(`PATH`, `HOME`), 스크립트 내부 변수는 소문자(`count`, `file_name`)를 사용하는 것이 관례다. 대문자를 쓰면 시스템 환경 변수와 충돌할 수 있다.

---

### 5. 파라미터 확장

변수 값을 꺼내면서 동시에 가공하는 Bash의 강력한 기능이다.

##### 문자열 조작

```bash
str="Hello, World!"

# 길이
echo ${#str}               # 13

# 부분 문자열 (offset:length)
echo ${str:7}              # World!
echo ${str:7:5}            # World

# 치환
echo ${str/World/Bash}     # Hello, Bash! (첫 번째만)
echo ${str//l/L}           # HeLLo, WorLd! (전체 치환)

# 삭제 패턴
file="archive.tar.gz"
echo ${file#*.}            # tar.gz  (앞에서 최소 매칭 삭제)
echo ${file##*.}           # gz      (앞에서 최대 매칭 삭제)
echo ${file%.*}            # archive.tar (뒤에서 최소 매칭 삭제)
echo ${file%%.*}           # archive     (뒤에서 최대 매칭 삭제)

# 대소문자 변환 (Bash 4.0+)
echo ${str^^}              # HELLO, WORLD!
echo ${str,,}              # hello, world!
```

> [!tip]+ `#`과 `%` 기억법
> 키보드에서 `#`은 `$` 왼쪽(앞), `%`는 `$` 오른쪽(뒤)에 있다.

##### 기본값 설정

```bash
# 변수가 비어있으면 기본값 사용 (변수는 변경 안 됨)
echo ${name:-"default"}

# 변수가 비어있으면 기본값 대입까지 수행
echo ${name:="default"}

# 변수가 비어있으면 에러 메시지 출력 후 종료
echo ${name:?"name is required"}

# 변수가 설정되어 있으면 대체값 사용
echo ${name:+"exists"}
```

|      문법       |   비어있을 때    | 설정되어 있을 때 |
| :-----------: | :---------: | :-------: |
| `${var:-val}` |   val 반환    |  $var 반환  |
| `${var:=val}` | val 대입 후 반환 |  $var 반환  |
| `${var:?msg}` |  에러 출력, 종료  |  $var 반환  |
| `${var:+val}` |    빈 문자열    |  val 반환   |

---

### 6. 배열

##### 일반 배열 (인덱스 배열)

```bash
# 선언
fruits=("apple" "banana" "cherry")

# 접근
echo ${fruits[0]}      # apple
echo ${fruits[-1]}     # cherry (마지막 원소)

# 전체 원소
echo ${fruits[@]}      # apple banana cherry

# 길이
echo ${#fruits[@]}     # 3

# 추가
fruits+=("date")

# 삭제
unset fruits[1]

# 슬라이스
echo ${fruits[@]:1:2}  # 인덱스 1부터 2개
```

##### 반복

```bash
for fruit in "${fruits[@]}"; do
    echo "$fruit"
done
```

> [!tip]+ 배열 반복 시 `"${arr[@]}"` 형태로 써야 한다
> 따옴표 없이 `${arr[@]}`를 쓰면 공백이 포함된 원소가 쪼개진다.

##### 연관 배열 (딕셔너리)

Bash 4.0 이상에서 사용 가능하다.

```bash
declare -A user
user[name]="kim"
user[age]=30

echo ${user[name]}     # kim
echo ${!user[@]}       # 모든 키: name age
echo ${user[@]}        # 모든 값: kim 30
```

---

### 7. 패턴 매칭

##### Glob 패턴

Bash는 파일명을 매칭할 때 glob 패턴을 사용한다. 정규식과 다르니 혼동하지 않아야 한다.

```bash
ls *.txt          # .txt로 끝나는 모든 파일
ls file?.log      # file + 한 글자 + .log
ls [abc]*.sh      # a, b, c로 시작하는 .sh 파일
ls [!0-9]*        # 숫자로 시작하지 않는 파일
```

|   Glob   | 의미             |  정규식 대응  |
| :------: | :------------- | :------: |
|   `*`    | 0개 이상의 임의 문자   |   `.*`   |
|   `?`    | 정확히 1개의 임의 문자  |   `.`    |
| `[abc]`  | a, b, c 중 하나   | `[abc]`  |
| `[!abc]` | a, b, c가 아닌 문자 | `[^abc]` |
| `[0-9]`  | 숫자 범위          | `[0-9]`  |

##### 확장 Glob (Extended Glob)

`shopt -s extglob`을 활성화하면 더 강력한 패턴을 사용할 수 있다.

```bash
shopt -s extglob

ls !(*.log)          # .log가 아닌 모든 파일
ls @(*.txt|*.md)     # .txt 또는 .md 파일
ls +([0-9])          # 숫자로만 이루어진 이름
```

|      패턴      | 의미         |
| :----------: | :--------- |
| `?(pattern)` | 0 또는 1회 매칭 |
| `*(pattern)` | 0회 이상 매칭   |
| `+(pattern)` | 1회 이상 매칭   |
| `@(pattern)` | 정확히 1회 매칭  |
| `!(pattern)` | 매칭되지 않는 것  |

##### Recursive Glob

Bash 4.0 이상에서 `**`는 하위 디렉토리까지 재귀 탐색한다.

```bash
shopt -s globstar

ls **/*.py         # 모든 하위 폴더의 .py 파일
```

##### `[[ ]]` 안에서의 패턴 매칭

```bash
file="report_2026.csv"

# glob 패턴 (== 오른쪽을 따옴표 없이)
[[ "$file" == *.csv ]] && echo "CSV 파일"

# 정규식 (=~ 연산자)
[[ "$file" =~ ^report_[0-9]{4}\.csv$ ]] && echo "매칭됨"

# 정규식은 변수에 담아서 쓰는 것이 안전
pattern='^[0-9]+$'
[[ "12345" =~ $pattern ]] && echo "숫자만"
```

> [!note]+ Glob vs 정규식
> - **Glob**은 파일명 매칭에 사용. `*`이 "아무 문자열"을 의미한다.
> - **정규식**은 텍스트 패턴 매칭에 사용. `*`이 "앞 문자 0회 이상 반복"을 의미한다.
> - `[[ ]]` 안에서 `==`는 glob, `=~`는 정규식을 사용한다.

---

### 8. 중괄호 확장

Glob과 별개로, 중괄호 확장(brace expansion)은 Bash가 문자열을 생성하는 기능이다. 파일 존재 여부와 무관하게 동작한다.

```bash
echo {A,B,C}        # A B C
echo file{1,2,3}    # file1 file2 file3
echo {1..5}         # 1 2 3 4 5
echo {a..z}         # a b c ... z
echo {01..10}       # 01 02 03 ... 10 (제로패딩)
echo {0..20..5}     # 0 5 10 15 20 (증가값 지정)

# 실용적 활용
mkdir -p project/{src,test,docs}
cp config.yml{,.bak}    # config.yml을 config.yml.bak으로 복사
```

> [!tip]+ 중괄호 확장은 변수보다 먼저 처리된다
> ```bash
> n=5
> echo {1..$n}    # {1..5} 그대로 출력 (확장 안 됨)
> ```
> 중괄호 확장은 변수 치환보다 먼저 일어나기 때문에 `$n`이 아직 5로 바뀌지 않은 상태에서 처리된다. 변수로 범위를 만들려면 C-style for 루프 `for ((i=1; i<=n; i++))`를 사용한다.
