---
tags:
  - make
  - build
  - automation
  - CLI
created: 2026-06-18T00:00:00
updated: 2026-06-18T22:46:08
permalink: /Dev/linux/make-and-makefile
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - `make`는 파일의 수정 시각을 비교해 바뀐 부분만 다시 빌드하는 자동화 도구, `Makefile`은 그 작업 명세서
> - 핵심 구조는 `target: prerequisites` + 탭으로 들여쓴 `recipe` 한 묶음(rule)
> - 동작의 본질은 의존성 그래프 + 타임스탬프 비교 → 필요한 작업만 골라 실행하는 증분 빌드
> - 변수, 자동 변수(`$@ $< $^`), 패턴 규칙(`%`), 함수까지 알면 짧고 재사용 가능한 빌드 스크립트 작성 가능
> - 요즘은 컴파일뿐 아니라 긴 명령어를 짧은 태스크로 묶는 태스크 러너로도 폭넓게 사용

---

### 1. make가 뭔가

`make`는 1976년 유닉스에서 등장한 **빌드 자동화 도구**다. "어떤 결과물을 만들려면 무엇이 필요하고, 어떤 명령을 실행해야 하는지"를 규칙으로 적어두면, `make`가 그 규칙을 읽어 필요한 작업만 골라서 실행한다.

그 규칙을 적어두는 파일이 `Makefile`이다. 프로젝트 루트에 `Makefile`(또는 `makefile`)이라는 이름으로 두면 `make` 명령이 자동으로 찾아 읽는다.

원래 목적은 C/C++ 컴파일이었다. 소스 파일이 100개인 프로젝트에서 1개만 수정했을 때 전체를 다시 컴파일하면 시간이 낭비된다. `make`는 파일 수정 시각을 비교해 **바뀐 것과 거기에 의존하는 것만** 다시 빌드한다. 이걸 증분 빌드(incremental build)라고 한다.

요즘은 컴파일 외에 **자주 쓰는 긴 명령어를 짧은 이름으로 묶는 태스크 러너**로도 많이 쓴다. 긴 `docker run ...` 한 줄을 `make up`으로 줄이는 식이다. 언어와 무관하게 거의 모든 프로젝트에서 통하는 공통 인터페이스라는 점이 장점이다.

> [!note]+ make의 종류와 macOS의 함정
> 가장 널리 쓰이는 구현은 GNU Make다.   
> BSD 계열(FreeBSD 등)이 쓰는 BSD make(`bmake`)와는 함수·문법 일부가 다르다.  
> macOS의 `/usr/bin/make`도 BSD가 아니라 **GNU Make 3.81**이다.   
> 단 2006년 버전으로, 3.82부터 라이선스가 GPLv2 → GPLv3로 바뀌자 Apple이 GPLv3를 피하려고 직전 버전에 묶어둔 것이다(`/bin/bash`가 3.2에 멈춘 것과 같은 이유). 그래서 `.ONESHELL`, `.RECIPEPREFIX`, `$(file ...)` 같은 3.82+ 기능이 빠져 있다.  
> 최신 GNU Make가 필요하면 `brew install make`로 설치하며, 시스템 `make`와 충돌을 피하려 `gmake`라는 이름으로 깔린다. 이 글은 GNU Make 기준이다.

---

### 2. 기본 구조 - rule

Makefile의 모든 것은 **rule(규칙)** 단위로 이루어진다. 하나의 rule은 세 부분으로 구성된다.

```makefile
target: prerequisites
	recipe
```

- **target**: 만들려는 결과물 또는 작업 이름 (예: `app`, `build`, `test`)
- **prerequisites**: target을 만들기 전에 필요한 것들 (의존성). 다른 target이거나 파일 이름
- **recipe**: 실제로 실행할 셸 명령. **반드시 탭(Tab) 한 칸으로 들여쓴다**

> [!warning]+ 가장 흔한 실수 - 탭 vs 스페이스
> recipe는 스페이스가 아니라 **탭 문자**로 들여써야 한다. 스페이스로 쓰면 `Makefile:N: *** missing separator. Stop.` 에러가 난다. 에디터가 탭을 스페이스로 바꾸지 않도록 설정해야 한다.

간단한 예시를 보자.

```makefile
hello:
	echo "Hello, Make!"
```

실행은 `make <target>` 형식이다.

```bash
make hello
# echo "Hello, Make!"
# Hello, Make!
```

`make`만 입력하면 **파일 맨 위에 있는 target**(기본 target)이 실행된다.

---

### 3. 동작 원리 - 의존성과 타임스탬프

`make`의 핵심은 단순한 명령 실행기가 아니라는 점이다. **의존성 그래프**를 만들고, **파일 수정 시각**을 비교해 정말 필요한 작업만 실행한다.

다음 rule을 보자.

```makefile
app: main.o utils.o
	gcc -o app main.o utils.o

main.o: main.c
	gcc -c main.c

utils.o: utils.c
	gcc -c utils.c
```

`make app`을 실행하면 `make`는 이렇게 판단한다.

1. `app`을 만들려면 `main.o`, `utils.o`가 필요하다 → 먼저 그것들을 확인
2. `main.o`는 `main.c`에 의존한다. `main.c`가 `main.o`보다 최신이면 다시 컴파일, 아니면 건너뜀
3. 모든 의존성이 준비되고 의존성 중 하나라도 `app`보다 최신이면 `app`을 다시 링크

즉 **target보다 prerequisite가 더 최근에 수정됐을 때만** recipe를 실행한다. `main.c`만 고쳤다면 `utils.c` 컴파일은 건너뛴다. 이것이 증분 빌드의 원리다.

> [!tip]+ 왜 빠른가
> 아무것도 바꾸지 않고 `make`를 다시 실행하면 `make: 'app' is up to date.`만 출력되고 끝난다. 모든 결과물이 의존 파일보다 최신이라 할 일이 없기 때문이다. 큰 프로젝트일수록 이 절약 효과가 크다.

---

### 4. .PHONY - 파일이 아닌 target

`build`, `test`, `clean`처럼 **실제 파일을 만들지 않는** target이 있다. 이런 건 단지 명령 묶음의 이름이다. 문제는 우연히 `clean`이라는 이름의 파일이 디렉터리에 있으면, `make`가 "`clean` 파일이 이미 최신이다"라고 판단해 recipe를 실행하지 않는다는 점이다.

이를 막으려면 `.PHONY`로 "이 target은 파일이 아니다"라고 선언한다.

```makefile
.PHONY: build test clean

build:
	go build -o app .

test:
	go test ./...

clean:
	rm -f app
```

`.PHONY`로 선언된 target은 타임스탬프 비교를 건너뛰고 **항상 실행**된다. 파일을 만들지 않는 모든 task용 target에는 붙이는 게 안전하다.

---

### 5. 변수

반복되는 값은 변수로 묶는다. 사용할 때는 `$(VAR)` 또는 `${VAR}`로 참조한다.

```makefile
CC = gcc
CFLAGS = -Wall -O2
TARGET = app

$(TARGET): main.c
	$(CC) $(CFLAGS) -o $(TARGET) main.c
```

대입 연산자가 여러 개 있고 동작이 다르다. 이 차이를 모르면 빌드가 의도와 다르게 돈다.

| 연산자 | 이름 | 동작 |
|--------|------|------|
| `=` | 재귀적 대입 | 사용하는 시점에 우변을 평가 (지연 평가) |
| `:=` | 단순 대입 | 정의하는 시점에 즉시 평가 |
| `?=` | 조건부 대입 | 변수가 아직 정의되지 않았을 때만 대입 |
| `+=` | 추가 | 기존 값 뒤에 덧붙임 |

```makefile
A = hello
B = $(A) world   # B는 사용 시점에 평가됨
A = hi           # 이후 A를 바꾸면 B도 바뀜 → "hi world"

C := $(A) world  # := 는 이 줄에서 즉시 고정됨
```

환경 변수나 명령행에서 값을 주입할 수도 있다. 명령행 인자가 Makefile 내부 정의보다 우선한다.

```bash
make build CFLAGS="-O0 -g"
```

> [!tip]+ ?= 의 쓸모
> `PORT ?= 8080`처럼 쓰면, 외부에서 `make run PORT=3000`으로 덮어쓸 수 있고 안 주면 기본값을 쓴다. 설정 가능한 기본값을 만들 때 유용하다.

---

### 6. 자동 변수

recipe 안에서 target과 prerequisite를 매번 손으로 적으면 길고 실수하기 쉽다. `make`는 이를 대신하는 **자동 변수**(automatic variable)를 제공한다.

| 변수   | 의미                         |
| ---- | -------------------------- |
| `$@` | 현재 target 이름               |
| `$<` | 첫 번째 prerequisite          |
| `$^` | 모든 prerequisite (중복 제거)    |
| `$?` | target보다 최신인 prerequisite들 |
| `$*` | 패턴 규칙에서 `%`에 매칭된 부분        |

앞의 C 예제를 자동 변수로 다시 쓰면 훨씬 간결해진다.

```makefile
app: main.o utils.o
	gcc -o $@ $^        # $@ = app, $^ = main.o utils.o

%.o: %.c
	gcc -c $< -o $@     # $< = 입력 .c, $@ = 출력 .o
```

---

### 7. 패턴 규칙

위 예제의 `%.o: %.c`가 **패턴 규칙**(pattern rule)이다. `%`는 와일드카드로, 임의의 문자열에 매칭된다. "어떤 `.c` 파일이든 같은 이름의 `.o`로 컴파일하는 방법"을 한 번에 정의한다.

```makefile
%.o: %.c
	gcc -c $< -o $@
```

이 규칙 하나면 `main.o`, `utils.o`, `foo.o`를 각각 따로 적지 않아도 `make`가 알아서 대응되는 `.c`를 찾아 컴파일한다. 파일이 늘어나도 Makefile은 그대로다.

---

### 8. 함수

`make`에는 텍스트를 다루는 내장 함수가 있다. `$(함수명 인자,...)` 형식으로 호출한다. 파일 목록을 동적으로 만들 때 특히 유용하다.

```makefile
# 현재 디렉터리의 모든 .c 파일 찾기
SRCS = $(wildcard *.c)

# .c 확장자를 .o로 치환
OBJS = $(patsubst %.c,%.o,$(SRCS))

# 셸 명령 결과를 변수로
DATE = $(shell date +%Y-%m-%d)

app: $(OBJS)
	gcc -o $@ $^
```

자주 쓰는 함수는 다음과 같다.

- `$(wildcard 패턴)`: 패턴에 맞는 파일 목록 반환
- `$(patsubst 패턴,치환,문자열)`: 패턴 치환 (`$(SRCS:.c=.o)` 단축 문법도 동일)
- `$(shell 명령)`: 셸 명령을 실행해 출력을 값으로
- `$(filter 패턴,목록)` / `$(filter-out ...)`: 목록 필터링
- `$(foreach 변수,목록,본문)`: 반복

---

### 9. 조건문과 include

OS나 환경에 따라 다르게 동작해야 할 때 조건문을 쓴다. 조건문 키워드(`ifeq`, `else`, `endif`)는 **들여쓰지 않는다**(탭 금지).

```makefile
ifeq ($(OS),Windows_NT)
	RM = del
else
	RM = rm -f
endif

clean:
	$(RM) app
```

다른 Makefile을 끌어다 쓸 때는 `include`를 사용한다. 환경별 설정을 별도 파일로 분리할 때 흔하다.

```makefile
include config.mk
-include .env.mk   # 앞에 - 를 붙이면 파일이 없어도 에러 안 남
```

---

### 10. 실전 패턴

##### self-documenting help target

target이 많아지면 무엇이 있는지 잊는다. 주석을 파싱해 도움말을 자동 출력하는 패턴이 널리 쓰인다.

```makefile
.PHONY: help
help: ## 사용 가능한 명령 목록 출력
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## 애플리케이션 빌드
	go build -o app .

test: ## 테스트 실행
	go test ./...
```

`make help`를 치면 각 target과 `##` 뒤의 설명이 정렬되어 나온다.

> [!tip]+ @ 의 의미
> recipe 줄 앞에 `@`를 붙이면 그 명령 자체를 화면에 출력하지 않고 결과만 보여준다. `@echo` 형태로 자주 쓴다. 기본적으로 `make`는 실행하는 명령을 그대로 에코하기 때문이다.

##### Docker 명령 래핑

언어 무관 태스크 러너로 쓰는 대표 사례다.

```makefile
.PHONY: up down logs

up: ## 컨테이너 백그라운드 실행
	docker compose up -d

down: ## 컨테이너 중지 및 제거
	docker compose down

logs: ## 로그 실시간 확인
	docker compose logs -f
```

---

### 11. 자주 만나는 함정

- **탭 vs 스페이스**: recipe는 반드시 탭. `missing separator` 에러의 90%가 이것
- **각 recipe 줄은 별도 셸에서 실행된다**: 한 줄에서 `cd`해도 다음 줄에선 원위치다. 이어서 실행하려면 `&&`로 한 줄에 잇거나 줄 끝에 `\`로 연결한다

```makefile
deploy:
	cd build && \
	./deploy.sh
```

- **변수 즉시/지연 평가 혼동**: 5번 표 참고. 순서에 민감하면 `:=`를 쓴다
- **`.PHONY` 누락**: task target에 안 붙이면 동명 파일이 있을 때 실행이 막힌다
- **`$`를 셸에 전달할 때**: Makefile에서 `$`는 변수 시작 문자다. 셸 변수 `$VAR`를 recipe에 쓰려면 `$$VAR`로 이스케이프한다

```makefile
print:
	@for f in *.txt; do echo "$$f"; done
```

---

### 12. make vs 다른 빌드 도구

`make`는 범용적이고 가볍지만 언어별 전용 도구가 더 풍부한 기능을 제공하기도 한다.

| 도구 | 영역 | 특징 |
|------|------|------|
| **make** | 범용 | 언어 무관, 어디나 설치됨, 의존성+증분 빌드. 문법이 다소 까다로움 |
| **Maven / Gradle** | JVM | 의존성 관리·라이프사이클 내장 → [[Maven vs Gradle]] |
| **npm scripts** | Node.js | `package.json`의 `scripts`로 태스크 정의 |
| **Just** | 범용 | make의 태스크 러너 부분만 떼어내 단순화한 현대적 대안 |
| **CMake / Bazel** | 대규모 C++ 등 | 빌드 설정을 생성하거나 대규모 모노레포에 특화 |

태스크 러너로만 쓴다면 `make`의 까다로운 증분 빌드 문법을 다 알 필요는 없다. recipe 대부분이 셸 스크립트이므로 [[Bash Shell Script 1 - 기초 문법과 데이터 다루기|Bash 문법]]에 익숙하면 그대로 활용할 수 있다.

---

### 13. 정리

- `make`는 **의존성 그래프 + 타임스탬프 비교**로 필요한 작업만 실행하는 빌드 자동화 도구
- `Makefile`의 기본 단위는 `target: prerequisites` + 탭으로 들여쓴 `recipe`
- 파일을 안 만드는 task target에는 `.PHONY`를 붙인다
- 변수·자동 변수·패턴 규칙·함수를 쓰면 짧고 확장 가능한 스크립트가 된다
- 컴파일 자동화든 명령어 래핑이든, "공통 진입점"으로 한 프로젝트의 작업을 표준화하는 데 유용하다
