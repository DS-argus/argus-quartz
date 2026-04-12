---
tags:
  - python
  - regex
  - re
created: 2026-04-12T00:00:00
updated: 2026-04-12T00:00:00
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> Python `re` 모듈의 핵심 함수, 패턴 문법, 플래그, 명명된 그룹, 실전 패턴, 성능 최적화, 버전별 변경사항, 서드파티 `regex` 모듈 비교, 흔한 함정까지 정규 표현식의 전체를 정리한 글이다


---
### 1. 정규 표현식이란

정규 표현식(Regular Expression, regex)은 문자열에서 특정 패턴을 찾거나 치환하기 위한 표현 체계다. 로그 파싱, 입력 검증, 텍스트 추출 등 문자열 처리가 필요한 거의 모든 곳에서 사용된다.

Python에서는 표준 라이브러리인 `re` 모듈을 통해 regex를 지원한다.

```python
import re
```


---
### 2. re 모듈 핵심 함수

#### 함수 요약

| 함수 | 설명 | 반환값 |
|---|---|---|
| `re.match(pattern, string)` | 문자열 **시작**에서만 매칭 | `Match` 또는 `None` |
| `re.search(pattern, string)` | 문자열 **전체**를 스캔하여 첫 번째 매칭 | `Match` 또는 `None` |
| `re.fullmatch(pattern, string)` | 문자열 **전체**가 패턴과 일치하는지 확인 | `Match` 또는 `None` |
| `re.findall(pattern, string)` | 겹치지 않는 모든 매칭을 리스트로 반환 | `list[str]` |
| `re.finditer(pattern, string)` | 모든 매칭을 이터레이터로 반환 | `iterator[Match]` |
| `re.sub(pattern, repl, string)` | 매칭된 부분을 치환 | `str` |
| `re.split(pattern, string)` | 패턴 기준으로 문자열 분리 | `list[str]` |
| `re.compile(pattern)` | 패턴을 미리 컴파일하여 재사용 | `Pattern` 객체 |

#### match vs search vs fullmatch

```python
import re

re.match(r'\d+', 'abc123')      # None (시작이 숫자가 아님)
re.search(r'\d+', 'abc123')     # Match '123' (어디서든 첫 매칭)
re.fullmatch(r'\d+', '123')     # Match (전체가 숫자)
re.fullmatch(r'\d+', '123a')    # None (전체가 일치하지 않음)
```

#### findall vs finditer

```python
re.findall(r'\d+', 'a1 b22 c333')   # ['1', '22', '333']

for m in re.finditer(r'\d+', 'a1 b22 c333'):
    print(m.span(), m.group())
# (1, 2) '1'
# (4, 6) '22'
# (8, 11) '333'
```

`finditer`는 `Match` 객체를 하나씩 반환하므로 대용량 데이터에서 메모리 효율이 좋다.

#### sub

```python
re.sub(r'\d+', 'NUM', 'a1 b22')                          # 'aNUM bNUM'
re.sub(r'\d+', lambda m: str(int(m.group()) * 2), 'a1 b2')  # 'a2 b4'
```

`repl` 인자에 함수를 전달하면 매칭마다 동적으로 치환할 수 있다.

#### split

```python
re.split(r'[,;]\s*', 'one, two;three')   # ['one', 'two', 'three']
```

#### compile

```python
pattern = re.compile(r'\b\w{3}\b')
pattern.findall('the cat sat on a mat')   # ['the', 'cat', 'sat', 'mat']
```

반복 사용되는 패턴은 컴파일해두면 성능에 유리하다.

#### Match 객체 주요 메서드

```python
m = re.search(r'(\d+)-(\d+)', 'code: 123-456')

m.group()       # '123-456'  전체 매칭
m.group(0)      # '123-456'  group()과 동일
m.group(1)      # '123'      첫 번째 캡처 그룹
m.group(2)      # '456'      두 번째 캡처 그룹
m.groups()      # ('123', '456')
m.start()       # 6
m.end()         # 13
m.span()        # (6, 13)
```


---
### 3. 패턴 문법 총정리

#### 문자 클래스 (Character Classes)

| 패턴 | 의미 |
|---|---|
| `.` | 개행 제외 모든 문자 (`re.DOTALL`이면 개행 포함) |
| `\d` / `\D` | 숫자 / 비숫자 |
| `\w` / `\W` | 단어 문자 `[a-zA-Z0-9_]` / 비단어 문자 |
| `\s` / `\S` | 공백 / 비공백 |
| `[abc]` | a, b, c 중 하나 |
| `[a-z]` | a부터 z까지 |
| `[^abc]` | a, b, c를 제외한 문자 |

> [!note]+ \w와 유니코드
> Python 3에서 `\w`는 기본적으로 유니코드 단어 문자를 포함한다. `re.ASCII` 플래그를 사용하면 `[a-zA-Z0-9_]`로 제한된다.

#### 수량자 (Quantifiers)

| 패턴 | 의미 | 동작 |
|---|---|---|
| `*` | 0회 이상 | Greedy |
| `+` | 1회 이상 | Greedy |
| `?` | 0 또는 1회 | Greedy |
| `{m}` | 정확히 m회 | - |
| `{m,n}` | m~n회 | Greedy |
| `*?`, `+?`, `??`, `{m,n}?` | 위의 Lazy 버전 | Lazy (최소 매칭) |
| `*+`, `++`, `?+`, `{m,n}+` | 위의 Possessive 버전 (3.11+) | 백트래킹 불가 |

##### Greedy vs Lazy

```python
text = '<a> b <c>'
re.search(r'<.*>', text).group()     # '<a> b <c>'  Greedy: 최대한 많이
re.search(r'<.*?>', text).group()    # '<a>'        Lazy: 최소한
```

Greedy는 가능한 한 많이 매칭한 뒤 필요하면 되돌아가고(백트래킹), Lazy는 가능한 한 적게 매칭한 뒤 필요하면 확장한다.

#### 앵커 (Anchors)

| 패턴 | 의미 |
|---|---|
| `^` | 문자열 시작 (`re.MULTILINE`이면 각 줄 시작) |
| `$` | 문자열 끝 (`re.MULTILINE`이면 각 줄 끝) |
| `\b` | 단어 경계 |
| `\B` | 비단어 경계 |
| `\A` | 문자열 절대 시작 (MULTILINE 영향 안 받음) |
| `\Z` | 문자열 절대 끝 |

```python
text = "hello world\nhello python"

re.findall(r'^hello', text)                    # ['hello'] (첫 줄만)
re.findall(r'^hello', text, re.MULTILINE)      # ['hello', 'hello'] (각 줄)

re.findall(r'\bhello\b', 'say hello world')    # ['hello']
```

#### 그룹 (Groups)

| 패턴 | 의미 |
|---|---|
| `(...)` | 캡처 그룹 |
| `(?:...)` | 비캡처 그룹 |
| `(?P<name>...)` | 명명된 캡처 그룹 |
| `(?P=name)` | 명명된 역참조 |
| `\1`, `\2` | 번호 기반 역참조 |
| `(?>...)` | 원자적 그룹 (3.11+) |

#### 전후방 탐색 (Lookahead / Lookbehind)

| 패턴 | 의미 | 예시 |
|---|---|---|
| `(?=Y)` | 긍정 전방 탐색 | `foo(?=bar)` -> "foobar"의 "foo" |
| `(?!Y)` | 부정 전방 탐색 | `foo(?!bar)` -> "foobaz"의 "foo" |
| `(?<=Y)` | 긍정 후방 탐색 | `(?<=foo)bar` -> "foobar"의 "bar" |
| `(?<!Y)` | 부정 후방 탐색 | `(?<!foo)bar` -> "xyzbar"의 "bar" |

> [!tip]+ Lookbehind 제약
> `re` 모듈의 lookbehind는 **고정 길이**만 허용한다. 가변 길이가 필요하면 서드파티 `regex` 모듈을 사용해야 한다.

```python
# 비밀번호 강도 체크: 최소 8자, 대문자+소문자+숫자 포함
pattern = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$'
bool(re.match(pattern, 'Hello123!'))   # True
bool(re.match(pattern, 'hello123'))    # False (대문자 없음)
```

#### OR 연산자

```python
re.findall(r'cat|dog', 'I have a cat and a dog')   # ['cat', 'dog']

# 그룹과 함께 사용
re.findall(r'(?:cat|dog)s?', 'cats and dogs')       # ['cats', 'dogs']
```


---
### 4. 플래그

| 플래그 | 약어 | 인라인 | 설명 |
|---|---|---|---|
| `re.IGNORECASE` | `re.I` | `(?i)` | 대소문자 무시 |
| `re.MULTILINE` | `re.M` | `(?m)` | `^`, `$`가 각 줄의 시작/끝에도 매칭 |
| `re.DOTALL` | `re.S` | `(?s)` | `.`이 개행 문자도 매칭 |
| `re.VERBOSE` | `re.X` | `(?x)` | 공백과 주석 허용 (가독성 향상) |
| `re.ASCII` | `re.A` | `(?a)` | `\w`, `\d` 등을 ASCII 전용으로 제한 |

#### 플래그 조합

비트 OR(`|`)로 여러 플래그를 동시에 사용할 수 있다.

```python
pattern = re.compile(r'hello world', re.IGNORECASE | re.MULTILINE)
```

#### VERBOSE 활용

복잡한 패턴에 주석을 달아 가독성을 높일 수 있다.

```python
email_pattern = re.compile(r"""
    [a-zA-Z0-9._%+-]+    # 사용자명
    @                     # @ 구분자
    [a-zA-Z0-9.-]+       # 도메인
    \.[a-zA-Z]{2,}       # TLD (.com, .co.kr 등)
""", re.VERBOSE)
```

#### 인라인 플래그

패턴 안에서 직접 플래그를 지정할 수도 있다. 특정 그룹에만 적용하는 것도 가능하다.

```python
# 전체 패턴에 적용
re.findall(r'(?i)hello', 'Hello HELLO hello')   # ['Hello', 'HELLO', 'hello']

# 특정 그룹에만 적용
re.findall(r'(?i:hello) WORLD', 'Hello WORLD hello WORLD')
# ['Hello WORLD', 'hello WORLD']
```


---
### 5. 명명된 그룹과 역참조

#### 명명된 그룹

`(?P<name>...)`으로 그룹에 이름을 붙이면 인덱스 대신 이름으로 접근할 수 있다.

```python
m = re.search(r'(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})', '2026-04-12')

m.group('year')     # '2026'
m.group('month')    # '04'
m.groupdict()       # {'year': '2026', 'month': '04', 'day': '12'}
```

#### 역참조 (Backreference)

이미 캡처한 그룹의 내용을 패턴 안에서 다시 참조한다.

```python
# 연속 중복 단어 찾기
re.search(r'\b(?P<word>\w+)\s+(?P=word)\b', 'the the cat').group()
# 'the the'

# 번호 기반 역참조
re.sub(r'(\w+) (\w+)', r'\2 \1', 'hello world')   # 'world hello'
```

#### sub에서 명명된 그룹 활용

```python
# 날짜 형식 변환: YYYY-MM-DD -> DD/MM/YYYY
re.sub(
    r'(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})',
    r'\g<day>/\g<month>/\g<year>',
    '2026-04-12'
)
# '12/04/2026'
```


---
### 6. 실전 패턴 모음

자주 사용되는 패턴들을 정리했다. 복사해서 바로 사용할 수 있다.

#### 이메일

```python
email = r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'

re.findall(email, 'contact me at user@example.com or admin@test.co.kr')
# ['user@example.com', 'admin@test.co.kr']
```

#### URL

```python
url = r'https?://(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*'

re.findall(url, 'visit https://example.com/path?q=1 for more')
# ['https://example.com/path?q=1']
```

#### IPv4 주소

```python
ipv4 = r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'

re.findall(ipv4, 'server: 192.168.1.1, invalid: 999.999.999.999')
# ['192.168.1.1']
```

#### 한국 전화번호

```python
phone_kr = r'0\d{1,2}-\d{3,4}-\d{4}'

re.findall(phone_kr, '연락처: 010-1234-5678, 02-123-4567')
# ['010-1234-5678', '02-123-4567']
```

#### 날짜 (YYYY-MM-DD)

```python
date_iso = r'\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])'

re.findall(date_iso, '기간: 2026-01-15 ~ 2026-04-12')
# ['2026-01-15', '2026-04-12']
```

#### 한글만 추출

```python
korean = r'[가-힣]+'

re.findall(korean, '안녕하세요 hello 세계 world')
# ['안녕하세요', '세계']
```

#### HTML 태그 제거

```python
html_strip = r'<[^>]+>'

re.sub(html_strip, '', '<p>Hello <b>world</b></p>')
# 'Hello world'
```

#### 비밀번호 검증 (8자 이상, 대소문자+숫자+특수문자)

```python
password = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$'

bool(re.match(password, 'Passw0rd!'))   # True
bool(re.match(password, 'password'))    # False
```

> [!note]+ 실전에서의 한계
> 이메일, URL 등의 완벽한 검증은 regex만으로는 어렵다. 실무에서는 전용 라이브러리(`email-validator`, `urllib.parse`, `ipaddress`)와 병행하는 것이 좋다.


---
### 7. 성능 최적화

#### compile 활용

반복 사용되는 패턴은 미리 컴파일하면 성능이 좋아진다. `re` 모듈 내부에서도 최대 512개까지 캐시하지만, 명시적 컴파일이 더 확실하다.

```python
pattern = re.compile(r'\d{3}-\d{4}')

for line in huge_file:
    if pattern.search(line):
        process(line)
```

#### 재앙적 백트래킹 (Catastrophic Backtracking)

중첩된 수량자가 있는 패턴에서 매칭 실패 시 지수적으로 조합을 시도하는 현상이다. 입력이 길어질수록 처리 시간이 기하급수적으로 늘어난다.

```python
# 위험한 패턴
bad = r'(a+)+b'            # 'aaaaaaaaaaac' 에 대해 매우 느림
bad2 = r'((\n*.*\n*)*)'    # 중첩 수량자
```

해결 방법은 여러 가지가 있다.

##### 패턴 단순화

```python
good = r'a+b'   # 중첩 제거
```

##### Possessive 수량자 사용 (Python 3.11+)

한번 매칭한 문자를 백트래킹으로 되돌려주지 않는다.

```python
good = r'(a+)++b'   # 백트래킹 차단
```

##### 원자적 그룹 사용 (Python 3.11+)

```python
good = r'(?>a+)b'   # 그룹 안의 매칭이 확정되면 되돌아가지 않음
```

##### 구체적인 문자 클래스 사용

```python
# . 대신 구체적인 문자 클래스
r'[^,\n]+'   # . 보다 범위가 명확
```

> [!tip]+ 성능 팁 정리
> - 가능하면 `str.startswith()`, `str.endswith()`, `in` 같은 문자열 메서드를 먼저 고려한다
> - `re.finditer()`는 `re.findall()`보다 메모리 효율적이다
> - 비캡처 그룹 `(?:...)`으로 불필요한 캡처를 줄인다
> - 패턴 시작에 리터럴 문자를 두면 엔진 최적화에 도움이 된다


---
### 8. 버전별 변경사항

Python 3.x에서 regex 관련 주요 변경사항을 정리했다.

| 버전 | 변경사항 |
|---|---|
| 3.6 | `re.Match`, `re.Pattern`을 타입 힌트에 사용 가능 |
| 3.7 | `re.LOCALE`이 바이트 패턴 전용으로 제한 |
| 3.8 | `\N{name}` 유니코드 이름 이스케이프 지원 |
| **3.11** | **Possessive 수량자** (`*+`, `++`, `?+`, `{m,n}+`) 추가 |
| **3.11** | **원자적 그룹** (`(?>...)`) 추가 |
| 3.12 | 잘못된 이스케이프 시퀀스에 대한 `DeprecationWarning` 강화 |
| 3.14 | 잘못된 이스케이프 시퀀스가 `SyntaxWarning`, 향후 `SyntaxError` 예정 |

3.11에서 추가된 Possessive 수량자와 원자적 그룹이 가장 큰 변화다. 백트래킹을 제어할 수 있게 되면서 성능 문제를 언어 차원에서 해결할 수 있게 되었다.

```python
# Possessive 수량자 예시 (3.11+)
re.findall(r'0*+\d{3,}', '42 314 001 12 00984')
# ['314', '00984']
# 0*+가 선점한 0은 \d{3,}에 양보하지 않는다
```


---
### 9. re vs regex (서드파티) 비교

표준 `re` 모듈로 부족한 경우 서드파티 `regex` 모듈(`pip install regex`)을 사용할 수 있다.

| 기능 | `re` (표준) | `regex` (서드파티) |
|---|---|---|
| 설치 | 기본 내장 | `pip install regex` |
| Possessive 수량자 | 3.11+ | 모든 버전 |
| 원자적 그룹 | 3.11+ | 모든 버전 |
| 가변 길이 Lookbehind | 불가 (고정 길이만) | 지원 |
| 유니코드 속성 `\p{L}` | 불가 | 지원 |
| 퍼지 매칭 (Fuzzy) | 불가 | 지원 |
| 겹침 매칭 (Overlapped) | 불가 | `overlapped=True` |
| 부분 매칭 | 불가 | `partial=True` |
| 재귀 패턴 | 불가 | `(?0)`, `(?&name)` |
| 속도 | 일반적으로 더 빠름 | 약간 느림 |
| GIL | 매칭 중 GIL 유지 | 매칭 중 GIL 해제 |

#### regex 모듈 예시

```python
import regex

# 가변 길이 lookbehind (re에서는 불가)
regex.findall(r'(?<=\b\w+)\d+', 'pay5 dot3')
# ['5', '3']

# 유니코드 속성으로 한글 추출
regex.findall(r'\p{Hangul}+', '안녕하세요 hello 세계')
# ['안녕하세요', '세계']

# 겹침 매칭
regex.findall(r'\w{2}', 'apple', overlapped=True)
# ['ap', 'pp', 'pl', 'le']

# 퍼지 매칭 (편집 거리 1 이내 허용)
regex.search(r'(?:hello){e<=1}', 'helo')   # Match
```

> [!tip]+ 언제 regex 모듈을 쓸까
> - 가변 길이 lookbehind가 필요할 때
> - `\p{Hangul}`, `\p{Greek}` 같은 유니코드 속성이 필요할 때
> - 퍼지 매칭(오타 허용 검색)이 필요할 때
> - 그 외에는 표준 `re`로 충분하다


---
### 10. 흔한 함정과 주의사항

#### raw string을 사용하지 않는 실수

```python
# 잘못된 예: \b가 백스페이스(\x08)로 해석됨
re.search('\bword\b', 'a word here')     # None

# 올바른 예: raw string 사용
re.search(r'\bword\b', 'a word here')    # Match
```

> [!info]+ 원칙
> regex 패턴은 항상 `r'...'` (raw string)으로 작성한다.

#### match()와 search() 혼동

```python
re.match(r'\d+', 'abc123')     # None (문자열 시작부터 매칭)
re.search(r'\d+', 'abc123')    # Match '123' (어디서든 매칭)
```

`match`는 `^`가 암묵적으로 붙어있다고 생각하면 된다.

#### findall()에서 캡처 그룹이 있으면 그룹만 반환

```python
re.findall(r'(\d+)-(\d+)', 'a1-2 b3-4')
# [('1', '2'), ('3', '4')]  -- 전체 매칭이 아닌 그룹 튜플

# 전체 매칭이 필요하면 비캡처 그룹 또는 그룹 없이 사용
re.findall(r'\d+-\d+', 'a1-2 b3-4')
# ['1-2', '3-4']
```

#### 리터럴 백슬래시 매칭

텍스트의 `\` 하나를 매칭하려면 패턴에서 `\\`가 필요하다.

```python
re.search(r'\\', r'path\to')    # Match
# 일반 문자열이면 '\\\\' 네 개 필요
```

#### DOTALL 없이 여러 줄 매칭

```python
text = '<div>\nhello\n</div>'

re.search(r'<div>.*</div>', text)               # None (. 은 \n 불일치)
re.search(r'<div>.*</div>', text, re.DOTALL)    # Match
```

#### sub() 치환 문자열에서 역참조

```python
# raw string으로 역참조 사용
re.sub(r'(\w+)', r'[\1]', 'hello')    # '[hello]'
```

#### Python 3.12+ 이스케이프 경고

```python
# 3.12+에서 DeprecationWarning, 향후 SyntaxError
re.search('\d+', text)     # 경고 발생
re.search(r'\d+', text)    # 올바름
```

Python 3.12부터 raw string이 아닌 패턴의 잘못된 이스케이프에 대한 경고가 강화되었다. 미래 버전 호환성을 위해서도 항상 raw string을 사용해야 한다.
