---
tags:
  - python
  - regex
  - re
created: 2026-04-12T00:00:00
updated: 2026-04-13T07:36:36
permalink: /Dev/python/python-regex
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - 정규 표현식(regex)은 문자열에서 패턴을 찾기 위한 미니 언어다
> - Python에서는 `re` 모듈로 사용하며, 패턴 문법을 이해하면 로그 파싱, 입력 검증, 텍스트 추출 등에 바로 활용할 수 있다
> - 이 글은 패턴 문법부터 단계별로 따라가며 익히는 구성이다

> [!info]+ Sources
> - [Python 공식 문서 — re](https://docs.python.org/3/library/re.html)
> - [Python 공식 문서 — Regular Expression HOWTO](https://docs.python.org/3/howto/regex.html)

---
### 1. 정규 표현식이란

정규 표현식(Regular Expression, regex)은 **문자열에서 특정 패턴을 찾기 위한 표현 체계**다. 문자열 안에서 "이런 모양의 텍스트를 찾아줘"라고 말하는 미니 언어라고 생각하면 된다.

Python에서는 표준 라이브러리인 `re` 모듈을 사용한다.

```python
import re

# "숫자가 연속된 부분"을 찾아줘
re.findall(r'\d+', '주문번호 12345, 수량 3개')
# ['12345', '3']
```

이 한 줄을 이해하려면 `\d+`가 뭔지, `findall`이 뭔지 알아야 한다. 먼저 패턴 문법부터 하나씩 배워보자.

> [!info]+ raw string (r'...')
> regex 패턴은 항상 `r'...'` 형태로 작성한다. `r`을 붙이면 Python이 백슬래시를 이스케이프 처리하지 않기 때문에 `\d`, `\b` 같은 regex 문법을 그대로 쓸 수 있다.
> ```python
> # ❌ r 없이 쓰면 \b가 백스페이스(\x08)로 해석됨
> re.search('\bword\b', 'a word here')     # None
>
> # ✅ raw string
> re.search(r'\bword\b', 'a word here')    # Match
> ```

---
### 2. 패턴 기초 — 글자 하나 매칭하기

regex의 가장 기본은 **글자 하나를 매칭하는 규칙**이다.

##### 리터럴 매칭

일반 문자는 그 자체를 매칭한다.

```python
re.findall(r'a', 'banana')
# ['a', 'a', 'a']

re.findall(r'hello', 'say hello to hello world')
# ['hello', 'hello']
```

##### 메타 문자

regex에서 특별한 의미를 가진 문자들이 있다. 이것들을 **메타 문자**라 한다.

```
. ^ $ * + ? { } [ ] \ | ( )
```

이 문자를 글자 그대로 매칭하려면 앞에 `\`를 붙인다.

```python
re.findall(r'\.', 'version 3.11.0')    # ['.', '.']
re.findall(r'\$', 'price: $100')       # ['$']
re.findall(r'\(', 'func(x)')           # ['(']
```

##### . (점) — 아무 글자 하나

`.`은 줄바꿈(`\n`)을 제외한 **아무 글자 하나**를 매칭한다.

```python
re.findall(r'a.c', 'abc adc a1c a c aXXc')
# ['abc', 'adc', 'a1c', 'a c']
# 'aXXc'는 a와 c 사이에 글자가 2개라 매칭 안 됨
```

##### 문자 클래스 `[...]` — 이 중에 하나

대괄호 안에 나열한 문자 중 **하나**를 매칭한다.

```python
re.findall(r'[aeiou]', 'hello world')
# ['e', 'o', 'o']

# 범위 지정
re.findall(r'[a-z]', 'Hello 123')
# ['e', 'l', 'l', 'o']

re.findall(r'[0-9]', 'abc 123 def')
# ['1', '2', '3']

# 여러 범위 조합
re.findall(r'[a-zA-Z0-9]', 'Hi! 3?')
# ['H', 'i', '3']
```

##### `[^...]` — 이것 빼고 전부

`^`를 대괄호 안 맨 앞에 쓰면 **나열한 문자를 제외한** 나머지를 매칭한다.

```python
re.findall(r'[^0-9]', 'abc 123')
# ['a', 'b', 'c', ' ']

re.findall(r'[^aeiou ]', 'hello world')
# ['h', 'l', 'l', 'w', 'r', 'l', 'd']
```

##### 미리 정의된 문자 클래스

자주 쓰는 패턴은 축약형이 있다.

| 축약형  | 의미                | 동등한 표현           |
| ---- | ----------------- | ---------------- |
| `\d` | 숫자                | `[0-9]`          |
| `\D` | 숫자가 아닌 것          | `[^0-9]`         |
| `\w` | 단어 문자 (글자, 숫자, _) | `[a-zA-Z0-9_]`   |
| `\W` | 단어 문자가 아닌 것       | `[^a-zA-Z0-9_]`  |
| `\s` | 공백 (스페이스, 탭, 줄바꿈) | `[ \t\n\r\f\v]`  |
| `\S` | 공백이 아닌 것          | `[^ \t\n\r\f\v]` |

```python
re.findall(r'\d', 'abc 123')      # ['1', '2', '3']
re.findall(r'\w', 'hi! 3?')       # ['h', 'i', '3']
re.findall(r'\s', 'a b\tc\nd')    # [' ', '\t', '\n']
```

대문자는 소문자의 반대라고 기억하면 된다. `\d`↔`\D`, `\w`↔`\W`, `\s`↔`\S`.

> [!note]+ \w와 한글
> Python 3에서 `\w`는 유니코드 단어 문자를 포함하므로 **한글도 매칭**된다.
> ```python
> re.findall(r'\w', '안녕 hello 세계')
> # ['안', '녕', 'h', 'e', 'l', 'l', 'o', '세', '계']
> ```
> ASCII만 매칭하고 싶으면 `re.ASCII` 플래그를 사용한다. (플래그는 뒤에서 다룬다)

---
### 3. 패턴 확장 — 반복 (수량자)

지금까지는 글자 하나를 매칭했는데, 수량자(Quantifier)를 통해 **몇 번 반복되는지**를 지정할 수 있다

##### `*` — 0번 이상

```python
re.findall(r'ab*c', 'ac abc abbc abbbc')
# ['ac', 'abc', 'abbc', 'abbbc']
# b가 0번(ac), 1번(abc), 2번(abbc), 3번(abbbc) 모두 매칭
```

##### `+` — 1번 이상

```python
re.findall(r'ab+c', 'ac abc abbc abbbc')
# ['abc', 'abbc', 'abbbc']
# b가 0번인 'ac'는 매칭 안 됨
```

##### `?` — 0번 또는 1번

```python
re.findall(r'colou?r', 'color colour')
# ['color', 'colour']
# u가 있어도 되고 없어도 됨

re.findall(r'https?://', 'http://a https://b')
# ['http://', 'https://']
```

##### `{m}` — 정확히 m번

```python
re.findall(r'\d{3}', '1 12 123 1234')
# ['123', '123']
# 1234에서 앞 3자리 '123'이 매칭됨
```

##### `{m,n}` — m번 이상 n번 이하

```python
re.findall(r'\d{2,4}', '1 12 123 1234 12345')
# ['12', '123', '1234', '1234']
```

##### 수량자와 문자 클래스 조합

여기서부터 regex가 강력해진다. 지금까지 배운 것들을 조합해보자.

```python
# \d+ : 숫자가 1번 이상 연속
re.findall(r'\d+', '주문번호 12345, 수량 3개')
# ['12345', '3']

# \w+ : 단어 문자가 1번 이상 연속
re.findall(r'\w+', 'hello world 123')
# ['hello', 'world', '123']

# [a-z]+ : 소문자가 1번 이상 연속
re.findall(r'[a-z]+', 'Hello World 123')
# ['ello', 'orld']

# [A-Za-z]+ : 영문자가 1번 이상 연속
re.findall(r'[A-Za-z]+', 'Hello World 123')
# ['Hello', 'World']
```

##### Greedy vs Lazy

수량자는 기본적으로 **Greedy**(탐욕적)하다. 조건을 만족하는 선에서 **최대한 긴 문자열**을 잡는다.

```python
html = '<b>bold</b> and <i>italic</i>'

re.findall(r'<.*>', html)
# ['<b>bold</b> and <i>italic</i>']
# .* 가 가능한 한 길게 먹어서, 첫 < 부터 마지막 > 까지 전부 하나로 잡힘
```

수량자 뒤에 `?`를 붙이면 **Lazy**(게으른)가 된다. 조건을 만족하는 선에서 **최대한 짧은 문자열**을 잡는다.

```python
re.findall(r'<.*?>', html)
# ['<b>', '</b>', '<i>', '</i>']
# .*? 가 가능한 한 짧게 먹어서, 각 < > 쌍을 하나씩 잡음
```

| Greedy  | Lazy         | 동작                       |
| ------- | ------------ | ------------------------ |
| `*`     | `*?`         | 0번 이상 (최대한 길게 vs 최대한 짧게) |
| `+`     | `+?`         | 1번 이상 (최대한 길게 vs 최대한 짧게) |
| `?`     | `??`         | 0~1번 (최대한 길게 vs 최대한 짧게)  |
| `{m,n}` | ```{m,n}```? | m~n번 (최대한 길게 vs 최대한 짧게)  |

```python
# 또 다른 예시
text = 'aaa'

re.findall(r'a+', text)    # ['aaa']  — Greedy: a를 최대한 길게
re.findall(r'a+?', text)   # ['a', 'a', 'a']  — Lazy: a를 최대한 짧게 (1개씩)
```

---
### 4. 패턴 확장 — 위치 (앵커)

앵커는 **문자를 소비하지 않고 위치만 지정**한다. "여기에 있어야 한다"는 조건을 거는 것이다.

##### `^` — 시작, `$` — 끝

```python
re.search(r'^hello', 'hello world')    # Match — 시작이 hello
re.search(r'^hello', 'say hello')      # None — 시작이 아님

re.search(r'world$', 'hello world')    # Match — 끝이 world
re.search(r'world$', 'world hello')    # None — 끝이 아님
```

```python
# ^와 $를 같이 쓰면 "전체가 이 패턴이어야 한다"
re.search(r'^\d+$', '12345')     # Match — 전체가 숫자
re.search(r'^\d+$', '123abc')    # None — 숫자가 아닌 부분 있음
```

##### `\b` — 단어 경계

단어 문자(`\w`)와 비단어 문자(`\W`) 사이의 경계를 매칭한다. 글자를 소비하지 않는다.

```python
re.findall(r'\bcat\b', 'cat catalog catfish the cat sat')
# ['cat', 'cat']
# 'catalog', 'catfish'의 cat은 단어 경계가 아니라 매칭 안 됨

re.findall(r'cat', 'cat catalog catfish the cat sat')
# ['cat', 'cat', 'cat', 'cat']
# \b 없이 쓰면 부분 매칭도 전부 잡힘
```

```python
# 실전: 특정 단어만 정확히 치환
re.sub(r'\bJava\b', 'Python', 'Java and JavaScript are different')
# 'Python and JavaScript are different'
# JavaScript의 Java는 건드리지 않음
```

##### `\A`와 `\Z` — 절대 시작/끝

`^`와 `$`는 뒤에서 배울 `MULTILINE` 플래그에 영향을 받지만, `\A`와 `\Z`는 항상 문자열의 절대 시작/끝만 의미한다.

---
### 5. 패턴 확장 — 그룹

소괄호 `()`로 패턴의 일부를 묶으면 **그룹**이 된다. 그룹은 두 가지 역할을 한다: 묶어서 수량자 적용, 매칭된 부분 캡처.

##### 기본 그룹

```python
# 그룹 없이: ab+ = a 다음에 b가 1번 이상
re.findall(r'ab+', 'ab abb abab')
# ['ab', 'abb', 'ab', 'ab']

# 그룹으로 묶기: (ab)+ = 'ab'가 1번 이상
re.findall(r'(ab)+', 'ab abb abab')
# ['ab', 'ab', 'ab']
```

> [!note]+ findall과 그룹의 관계
> `findall`은 그룹이 있으면 **그룹 내용만** 반환한다. 전체 매칭을 보려면 비캡처 그룹 `(?:...)`을 사용하거나 그룹을 제거한다.
> ```python
> re.findall(r'(\d+)-(\d+)', 'a1-2 b3-4')
> # [('1', '2'), ('3', '4')]  — 그룹 튜플
>
> re.findall(r'\d+-\d+', 'a1-2 b3-4')
> # ['1-2', '3-4']  — 전체 매칭
> ```

##### 캡처 그룹으로 부분 추출

```python
m = re.search(r'(\d+)-(\d+)-(\d+)', '전화번호: 010-1234-5678')

m.group()    # '010-1234-5678'  전체 매칭
m.group(0)   # '010-1234-5678'  group()과 동일
m.group(1)   # '010'            첫 번째 그룹
m.group(2)   # '1234'           두 번째 그룹
m.group(3)   # '5678'           세 번째 그룹
m.groups()   # ('010', '1234', '5678')
```

##### 명명된 그룹 `(?P<name>...)`

번호 대신 이름으로 접근할 수 있다. 패턴이 복잡해지면 가독성이 훨씬 좋다.

```python
m = re.search(
    r'(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})',
    '오늘은 2026-04-12'
)

m.group('year')    # '2026'
m.group('month')   # '04'
m.groupdict()      # {'year': '2026', 'month': '04', 'day': '12'}
```

##### 비캡처 그룹 `(?:...)`

묶기만 하고 캡처는 하지 않는다. 그룹 번호를 소비하지 않는다.

```python
# http 또는 https를 묶되 캡처하지 않음
re.findall(r'(?:https?://)\S+', 'visit http://a.com or https://b.com')
# ['http://a.com', 'https://b.com']
```

##### OR 연산자 `|`

`|`는 "또는"이다. 그룹과 함께 쓰면 특정 부분에만 OR을 적용할 수 있다.

```python
re.findall(r'cat|dog', 'I have a cat and a dog')
# ['cat', 'dog']

# 그룹으로 OR 범위 제한
re.findall(r'(?:cat|dog)s?', 'cats and dogs and cat')
# ['cats', 'dogs', 'cat']
```

##### 역참조 (Backreference)

캡처한 그룹을 패턴 안에서 다시 참조할 수 있다.

```python
# 연속 중복 단어 찾기
re.search(r'\b(\w+)\s+\1\b', 'the the cat').group()
# 'the the'  — \1이 첫 번째 그룹(the)과 같은 텍스트를 매칭

# 명명된 역참조
re.search(r'\b(?P<word>\w+)\s+(?P=word)\b', 'the the cat').group()
# 'the the'
```

```python
# sub에서 역참조로 순서 바꾸기
re.sub(r'(\w+) (\w+)', r'\2 \1', 'hello world')
# 'world hello'

# 명명된 그룹으로 날짜 형식 변환: YYYY-MM-DD → DD/MM/YYYY
re.sub(
    r'(?P<y>\d{4})-(?P<m>\d{2})-(?P<d>\d{2})',
    r'\g<d>/\g<m>/\g<y>',
    '2026-04-12'
)
# '12/04/2026'
```

---
### 6. re 모듈 핵심 함수

패턴 문법을 배웠으니, 이제 이 패턴을 **어떻게 사용하는지** 함수를 정리한다.

##### 함수 요약

| 함수 | 설명 | 반환값 |
|------|------|--------|
| `re.search(pattern, string)` | 문자열 **전체**를 스캔, 첫 번째 매칭 | `Match` 또는 `None` |
| `re.match(pattern, string)` | 문자열 **시작**에서만 매칭 | `Match` 또는 `None` |
| `re.fullmatch(pattern, string)` | 문자열 **전체**가 패턴과 일치 | `Match` 또는 `None` |
| `re.findall(pattern, string)` | 겹치지 않는 모든 매칭을 리스트로 | `list[str]` |
| `re.finditer(pattern, string)` | 모든 매칭을 이터레이터로 | `iterator[Match]` |
| `re.sub(pattern, repl, string)` | 매칭된 부분을 치환 | `str` |
| `re.split(pattern, string)` | 패턴 기준으로 분리 | `list[str]` |
| `re.compile(pattern)` | 패턴을 미리 컴파일 | `Pattern` 객체 |

##### search vs match vs fullmatch

```python
text = 'abc123def'

re.search(r'\d+', text)      # Match '123' — 어디서든 첫 매칭
re.match(r'\d+', text)       # None        — 시작이 숫자가 아님
re.match(r'[a-z]+', text)    # Match 'abc' — 시작이 소문자

re.fullmatch(r'\d+', '123')  # Match — 전체가 숫자
re.fullmatch(r'\d+', '123a') # None  — 전체가 일치하지 않음
```

`match`는 `^`가 암묵적으로 붙어있다고 생각하면 된다.

##### findall vs finditer

```python
re.findall(r'\d+', 'a1 b22 c333')
# ['1', '22', '333']

for m in re.finditer(r'\d+', 'a1 b22 c333'):
    print(f"위치 {m.span()}: {m.group()}")
# 위치 (1, 2): 1
# 위치 (4, 6): 22
# 위치 (8, 11): 333
```

`finditer`는 `Match` 객체를 하나씩 반환하므로 위치 정보가 필요하거나 대용량 데이터에서 메모리 효율이 좋다.

##### sub — 치환

```python
re.sub(r'\d+', 'NUM', 'a1 b22')
# 'aNUM bNUM'

# 함수를 넘기면 매칭마다 동적 치환 가능
re.sub(r'\d+', lambda m: str(int(m.group()) * 2), 'a1 b2')
# 'a2 b4'
```

##### split — 분리

```python
re.split(r'[,;]\s*', 'one, two;three,  four')
# ['one', 'two', 'three', 'four']
```

##### compile — 패턴 재사용

```python
pattern = re.compile(r'\b\w{3}\b')

pattern.findall('the cat sat on a mat')
# ['the', 'cat', 'sat', 'mat']

# 반복 사용 시 컴파일해두면 성능에 유리하다
for line in huge_log_file:
    if pattern.search(line):
        process(line)
```

##### Match 객체 주요 메서드

```python
m = re.search(r'(\d+)-(\d+)', 'code: 123-456')

m.group()       # '123-456'      전체 매칭
m.group(1)      # '123'          첫 번째 그룹
m.group(2)      # '456'          두 번째 그룹
m.groups()      # ('123', '456') 모든 그룹
m.start()       # 6              매칭 시작 위치
m.end()         # 13             매칭 끝 위치
m.span()        # (6, 13)        (시작, 끝)
```

---
### 7. 플래그

플래그는 패턴의 동작 방식을 바꾼다.

| 플래그 | 약어 | 인라인 | 설명 |
|--------|------|--------|------|
| `re.IGNORECASE` | `re.I` | `(?i)` | 대소문자 무시 |
| `re.MULTILINE` | `re.M` | `(?m)` | `^`, `$`가 각 줄의 시작/끝에도 매칭 |
| `re.DOTALL` | `re.S` | `(?s)` | `.`이 줄바꿈(`\n`)도 매칭 |
| `re.VERBOSE` | `re.X` | `(?x)` | 공백과 주석 허용 (가독성 향상) |
| `re.ASCII` | `re.A` | `(?a)` | `\w`, `\d` 등을 ASCII 전용으로 제한 |

##### IGNORECASE

```python
re.findall(r'hello', 'Hello HELLO hello', re.I)
# ['Hello', 'HELLO', 'hello']
```

##### MULTILINE

```python
text = "hello world\nhello python"

re.findall(r'^hello', text)           # ['hello'] — 첫 줄만
re.findall(r'^hello', text, re.M)     # ['hello', 'hello'] — 각 줄
```

##### DOTALL

```python
text = '<div>\nhello\n</div>'

re.search(r'<div>.*</div>', text)             # None — .이 \n 매칭 안 함
re.search(r'<div>.*</div>', text, re.S)       # Match — .이 \n도 매칭
```

##### VERBOSE — 패턴에 주석 달기

복잡한 패턴을 읽기 쉽게 만들 수 있다.

```python
email_pattern = re.compile(r"""
    [a-zA-Z0-9._%+-]+    # 사용자명
    @                     # @ 구분자
    [a-zA-Z0-9.-]+       # 도메인
    \.[a-zA-Z]{2,}       # TLD (.com, .co.kr 등)
""", re.VERBOSE)
```

##### 플래그 조합과 인라인

```python
# 여러 플래그를 | 로 조합
pattern = re.compile(r'hello', re.IGNORECASE | re.MULTILINE)

# 패턴 안에서 인라인으로 지정
re.findall(r'(?i)hello', 'Hello HELLO hello')
# ['Hello', 'HELLO', 'hello']

# 특정 그룹에만 적용
re.findall(r'(?i:hello) WORLD', 'Hello WORLD hello WORLD')
# ['Hello WORLD', 'hello WORLD']
```

---
### 8. 전후방 탐색 (Lookahead / Lookbehind)

앵커처럼 **문자를 소비하지 않고 조건만 확인**하는 패턴이다. "앞/뒤에 이게 있는 경우에만 매칭해라"는 의미다.

| 패턴 | 이름 | 의미 |
|------|------|------|
| `(?=Y)` | 긍정 전방 탐색 | 뒤에 Y가 있을 때만 매칭 |
| `(?!Y)` | 부정 전방 탐색 | 뒤에 Y가 없을 때만 매칭 |
| `(?<=Y)` | 긍정 후방 탐색 | 앞에 Y가 있을 때만 매칭 |
| `(?<!Y)` | 부정 후방 탐색 | 앞에 Y가 없을 때만 매칭 |

##### 전방 탐색 (Lookahead)

```python
# 뒤에 'bar'가 오는 'foo'만 매칭
re.findall(r'foo(?=bar)', 'foobar foobaz foo')
# ['foo']  — foobar의 foo만

# 뒤에 'bar'가 오지 않는 'foo'만 매칭
re.findall(r'foo(?!bar)', 'foobar foobaz foo')
# ['foo', 'foo']  — foobaz의 foo, 단독 foo
```

##### 후방 탐색 (Lookbehind)

```python
# 앞에 '$'가 있는 숫자만 매칭
re.findall(r'(?<=\$)\d+', 'price $100, count 50')
# ['100']

# 앞에 '$'가 없는 숫자만 매칭
re.findall(r'(?<!\$)\d+', 'price $100, count 50')
# ['00', '50']
# 100에서 $뒤의 1이 걸러지고 나머지 00이 매칭됨
```

> [!tip]+ Lookbehind 제약
> `re` 모듈의 lookbehind는 **고정 길이**만 허용한다. `(?<=\w+)`처럼 가변 길이는 에러가 난다. 가변 길이가 필요하면 서드파티 `regex` 모듈을 사용해야 한다.

##### 실전: 비밀번호 강도 체크

전방 탐색을 여러 개 조합하면 "여러 조건을 동시에 만족"하는 패턴을 만들 수 있다.

```python
# 8자 이상, 대문자 포함, 소문자 포함, 숫자 포함
pattern = r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$'

bool(re.match(pattern, 'Hello123!'))   # True
bool(re.match(pattern, 'hello123'))    # False (대문자 없음)
bool(re.match(pattern, 'HELLO123'))    # False (소문자 없음)
bool(re.match(pattern, 'Helloabc'))    # False (숫자 없음)
bool(re.match(pattern, 'Hi1!'))        # False (8자 미만)
```

각 `(?=.*X)`는 "어딘가에 X가 있어야 한다"는 조건을 위치를 소비하지 않고 건다. 그래서 조건 여러 개를 나란히 쓸 수 있다.

---
### 9. 실전 패턴 모음

자주 사용되는 패턴들을 정리했다. 복사해서 바로 사용할 수 있다.

```python
# 이메일
email = r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
re.findall(email, 'contact user@example.com or admin@test.co.kr')
# ['user@example.com', 'admin@test.co.kr']

# URL
url = r'https?://\S+'
re.findall(url, 'visit https://example.com/path?q=1 for more')
# ['https://example.com/path?q=1']

# IPv4 주소
ipv4 = r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'
re.findall(ipv4, 'server: 192.168.1.1, invalid: 999.999.999.999')
# ['192.168.1.1']

# 한국 전화번호
phone_kr = r'0\d{1,2}-\d{3,4}-\d{4}'
re.findall(phone_kr, '연락처: 010-1234-5678, 02-123-4567')
# ['010-1234-5678', '02-123-4567']

# 날짜 (YYYY-MM-DD)
date_iso = r'\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])'
re.findall(date_iso, '기간: 2026-01-15 ~ 2026-04-12')
# ['2026-01-15', '2026-04-12']

# 한글만 추출
korean = r'[가-힣]+'
re.findall(korean, '안녕하세요 hello 세계 world')
# ['안녕하세요', '세계']

# HTML 태그 제거
html_strip = r'<[^>]+>'
re.sub(html_strip, '', '<p>Hello <b>world</b></p>')
# 'Hello world'
```

> [!note]+ 실전에서의 한계
> 이메일, URL 등의 완벽한 검증은 regex만으로는 어렵다. 실무에서는 전용 라이브러리(`email-validator`, `urllib.parse`, `ipaddress`)와 병행하는 것이 좋다.

---
### 10. 성능 최적화

##### compile 활용

반복 사용되는 패턴은 미리 컴파일하면 성능이 좋다. `re` 모듈이 내부적으로 최대 512개까지 캐시하지만 명시적 컴파일이 더 확실하다.

```python
pattern = re.compile(r'\d{3}-\d{4}')

for line in huge_file:
    if pattern.search(line):
        process(line)
```

##### 재앙적 백트래킹 (Catastrophic Backtracking)

중첩된 수량자가 있는 패턴에서 매칭 실패 시 지수적으로 조합을 시도하는 현상이다.

```python
# ❌ 위험한 패턴 — 입력이 길어지면 기하급수적으로 느려진다
bad = r'(a+)+b'
# 'aaaaaaaaaaac'에 대해 매칭 실패를 확인하는 데 수 초~수 분 소요
```

해결 방법:

```python
# 패턴 단순화
good = r'a+b'

# Possessive 수량자 (Python 3.11+) — 백트래킹 차단
good = r'a++b'

# 원자적 그룹 (Python 3.11+)
good = r'(?>a+)b'
```

> [!tip]+ 성능 팁 정리
> - 가능하면 `str.startswith()`, `in` 같은 문자열 메서드를 먼저 고려한다
> - `finditer()`는 `findall()`보다 메모리 효율적이다
> - 비캡처 그룹 `(?:...)`으로 불필요한 캡처를 줄인다
> - 구체적인 문자 클래스(`[^,\n]+`)를 `.`보다 선호한다

---
### 11. 버전별 변경사항

| 버전       | 변경사항                                                |
| -------- | --------------------------------------------------- |
| 3.6      | `re.Match`, `re.Pattern`을 타입 힌트에 사용 가능              |
| 3.7      | `re.LOCALE`이 바이트 패턴 전용으로 제한                         |
| 3.8      | `\N{name}` 유니코드 이름 이스케이프 지원                         |
| **3.11** | **Possessive 수량자** (`*+`, `++`, `?+`, `{m,n}`+) 추가  |
| **3.11** | **원자적 그룹** (`(?>...)`) 추가                           |
| 3.12     | 잘못된 이스케이프 시퀀스에 대한 `DeprecationWarning` 강화           |
| 3.14     | 잘못된 이스케이프 시퀀스가 `SyntaxWarning`, 향후 `SyntaxError` 예정 |

3.11에서 추가된 Possessive 수량자와 원자적 그룹이 가장 큰 변화다.

---
### 12. re vs regex (서드파티) 비교

표준 `re` 모듈로 부족한 경우 서드파티 `regex` 모듈(`pip install regex`)을 사용할 수 있다.

| 기능 | `re` (표준) | `regex` (서드파티) |
|------|-------------|-------------------|
| 설치 | 기본 내장 | `pip install regex` |
| Possessive 수량자 | 3.11+ | 모든 버전 |
| 원자적 그룹 | 3.11+ | 모든 버전 |
| 가변 길이 Lookbehind | **불가** (고정 길이만) | 지원 |
| 유니코드 속성 `\p{L}` | 불가 | 지원 |
| 퍼지 매칭 (Fuzzy) | 불가 | 지원 |
| 겹침 매칭 (Overlapped) | 불가 | `overlapped=True` |
| 재귀 패턴 | 불가 | `(?0)`, `(?&name)` |

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
### 13. 흔한 함정과 주의사항

##### raw string 누락

```python
re.search('\bword\b', 'a word here')     # None — \b가 백스페이스로 해석
re.search(r'\bword\b', 'a word here')    # Match
```

Python 3.12부터 raw string이 아닌 패턴의 잘못된 이스케이프에 대한 경고가 강화되었다.

##### match()는 시작만 본다

```python
re.match(r'\d+', 'abc123')     # None
re.search(r'\d+', 'abc123')    # Match '123'
```

"어딘가에 있는지" 확인하려면 항상 `search`를 사용한다.

##### findall()에 그룹이 있으면 그룹만 반환

```python
re.findall(r'(\d+)-(\d+)', '1-2 3-4')
# [('1', '2'), ('3', '4')]  — 전체 매칭이 아닌 그룹 튜플

re.findall(r'\d+-\d+', '1-2 3-4')
# ['1-2', '3-4']  — 전체 매칭
```

##### DOTALL 없이 여러 줄 매칭

```python
text = '<div>\nhello\n</div>'

re.search(r'<div>.*</div>', text)             # None
re.search(r'<div>.*</div>', text, re.DOTALL)  # Match
```

##### 리터럴 백슬래시 매칭

텍스트의 `\` 하나를 매칭하려면 패턴에서 `\\`가 필요하다.

```python
re.search(r'\\', r'path\to')    # Match
```
