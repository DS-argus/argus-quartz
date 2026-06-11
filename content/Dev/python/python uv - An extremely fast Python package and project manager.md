---
tags:
  - python
  - uv
  - package_manager
created: 2026-01-31T17:59:32
updated: 2026-06-11T21:22:35
permalink: /Dev/python/python-uv-an-extremely-fast-python-package-and-project-manager
---
> [!info]+ UV?
> - 파이썬 프로젝트 관리 all in one 도구
> - rust기반으로 매우 빠름
> - pip, virtualenv, venv, conda, pyenv, pipenv, poetry 등... 수많은 도구들 대신 uv 사용합시다
> - https://docs.astral.sh/uv/

> [!tip]+ pyenv 프로젝트에서 uv 프로젝트로 바꾸기
> 1. pyenv 가상환경 활성화 상태에서 `pip freeze > requirements.txt`
> 2. `.python-version`이 가상환경 이름으로 되어 있는 경우 버전으로 수정(uv 호환 목적)
> 3. 프로젝트 루트 경로에서 `uv init --bare` 로 `pyproject.toml` 생성
> 4. `uv add -r requirements.txt` 로 `.venv/`, `uv.lock` 생성


---
### 1. 설치
다양한 플랫폼에서 CLI로 설치가 가능하다

```bash
# Mac/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh 

# Window
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex" 

# HomeBrew 
brew install uv

# PyPI : pip으로도 설치 가능
pip install uv
```

---
### 2. Python 설치

uv를 통해 다양한 python 버전을 쉽게 설치하고 관리할 수 있다
##### uv python list
```bash
# 설치된, 설치 가능한 모든 파이썬 버전 최신 patch 확인가능 (pyenv등으로 설치된 것도 나옴)
uv python list                    

uv python list --only-installed   # 설치된 것만
uv python list --only-downloads   # 다운로드 가능한 것만
uv python list --managed-python   # uv가 설치/관리하는 것만
uv python list --all-versions     # 가능한 patch 전부
uv python list --all-platforms    # 모든 os에서 전부

uv python list 3.13               # 3.13 버전 리스트
```

##### uv python install
```bash
# .python-version(s) 파일에 있는 버전 (모두) 설치, 없으면 가장 최신 버전 설치
uv python install                 

uv python install --default       # 위와 동일, python/python3 executables 설치

uv python install 3.12 --default  # 3.12 버전 설치
uv python install '>=3.8, <3.10'  # 3.8 이상 3.10 미만 버전 설치
uv python install 3.9 3.10 3.11   # 여러 버전 동시 설치
uv python install pypy            # 특정 implementation 설치

uv python install -f 3.12         # 존재하는 executables 대체 (reinstall)
```


##### uv python pin 
현재 경로에서 사용하고 싶은 python 버전을 고정할 수 있다   (pyenv local, global과 동일)
```bash
uv python pin                    # 현재 .python-version 버전 출력
uv python pin 3.12.9             # 3.12.9로 .python-version 파일이 생성 (없으면 설치)
uv python pin --global 3.12.4    # 3.12.4를 전역 python으로 설정
```

##### uv python uninstall
```bash
uv python uninstall 3.12.9       # 3.12.9 버전 uninstall
uv python uninstall --all        # 설치된 모든 버전 uninstall
```

##### uv python upgrade (Experimental)
```bash
uv python upgrade 3.12           # 3.12버전을 가장 최신 path release로 업데이트
uv python upgrade                # 설치된 모든 버전 업데이트
```

##### uv python find
```bash
uv python find                   # 현재 경로 기준 설정된 python executable
uv python find '>3.12'           # 3.13보다 큰 버전 python executable 
uv python find 3.13              # 3.13.x와 매칭되는 python executable 
```


---
### 3. uv 프로젝트

기존에 새로운 프로젝트를 시작하려면 원하는 python 버전을 설치하고, 가상환경을 만들고, 활성화 시키고, 패키지를 설치하는 과정 등을 거쳐야 했지만, 이제 uv를 통해 바로 환경을 편하게 생성할 수 있다

uv의 핵심이라고 볼 수 있는 5개의 명령어는 다음과 같다
1. uv init
2. uv add
3. uv lock
4. uv sync
5. uv run
##### uv init
python 버전을 지정하지 않으면 사용 가능한 것을 찾으며, 그것도 없다면 설치까지 직접 진행한다 
```bash
uv init myproj              # myproj 폴더 만들고 그 안에 필요한 기본 파일 생성
uv init                     # 현재 폴더에서 기본 파일 생성

uv init --app myapp         # 앱 만드는 프로젝트 (기본값)
uv init --lib mylib         # 라이브러리 만드는 프로젝트, src/mylib/ 폴더 생성
uv init --package pkg       # 빌드/배포 가능한 패키지 구조로 세팅 src/pkg/ 폴더 생성

uv init myapp --python 3.11 # 이 프로젝트는 최소 3.11 이상으로 시작 (.python-version도 맞춰 생성)
uv init myapp --no-pin-python # .python-verseion 아예 안만들고 시작

uv init --bare              # pyproject.toml만 만들기 (기존 repo에 최소한의 변화만 줘서 uv 도입)
```

###### 예시
`uv init`으로 생성한 프로젝트 내부는 다음과 같다 (`--app` 옵션기준)  
![[UV 파이썬 패키지 매니저 - 2026-01-31 - 18-54-16.png|648x356]]

git 초기화, `main.py` 및 `README.md` 까지 생성해주며,  
python 버전 및 의존성관리를 위한 `.python-version`, `pyproject.toml` 파일도 보인다

- `.python-version` : 현재 프로젝트에서 사용할 python 버전 선언
- `pyproject.toml` : 프로젝트 표준 메타데이터 + 의존성 범위 선언 (`requests>=2, <3` 등)
	```toml
	[project]
	name = "myproj"
	version = "0.1.0"
	description = "Add your description here"
	readme = "README.md"
	requires-python = ">=3.12"
	dependencies = []
	```
	- project의 이름, 버전, 설명이 포함
	- requires-python : 최소 요구 파이썬 버전 명시
	- dependencies  : 추후 `uv add`로 필요한 패키지 추가

##### uv add
python 패키지 설치를 위해서는 `pip install` 대신 다음 명령어를 사용하면 된다  
`pyproject.toml`에 dependency가 추가되며 동시에 가상환경이 `.venv/`폴더로 생성된다
```bash
uv add pandas numpy

uv add 'pandas>=2'
uv add "requests>=2.5; python_version >= '3.10'"   # marker 추가. 특정 조건에서 특정 버전 사용 지정

uv add --dev pytest                                # 개발용 의존성 dev그룹으로 추가

# 임의의 그룹만들어서 의존성 추가. uv run, sync할 때 지정 가능
uv add --group lint ruff                           

# pyproject.toml만 수정하고 .venv에는 설치 X. 나중에 uv sync로 한번에 반영
uv add --no-sync pandas                            
```

###### 예시
`uv add pandas`를 한 후, `pyproject.toml`은 다음과 같이 변한다
```toml {8}
[project]
name = "myproj"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "pandas>=3.0.0",
]
```

그리고 `uv.lock`이라는 파일도 생기는데 그 안을 보면 pandas가 '3.0.0' 버전으로 고정되어 있고 numpy 등 다른 패키지도 확인할 수 있다
```toml
version = 1
revision = 3
requires-python = ">=3.12"
resolution-markers = [...]

[[package]]
name = "numpy"
version = "2.4.1"
source = {...}
sdist = {...}
wheels = [...]

[[package]]
name = "pandas"
version = "3.0.0"
...

[[package]]
name = "python-dateutil"
...

[[package]]
name = "six"
...

[[package]]
name = "tzdata"
...
```

`uv tree`를 실행하면 pandas에 필요한 다른 의존성 있는 패키지들이 함께 설치된 것임을 알 수 있다  
![[UV 파이썬 패키지 매니저 - 2026-01-31 - 20-15-04.png|648x356]]

즉, uv는 `pyproject.toml`을 기반으로 실제 설치되는 패키지 목록과 버전을 `uv.lock`에 기록(resolve)하는 것을 알 수 있다
> [!note]+ Resolve와 Install
> - resolve : `pyproject.toml` -> `uv.lock`
> 	- 각 패키지의 의존성 트리를 전부 확인해서 모든 제약을 동시에 만족하는 조합 탐색하여 저장
> - install : `uv.lock` ->  패키지 설치
> 	- 실제 가상환경에 패키지 설치
> - 관련 명령어
> 	- `uv lock` : resolve만 수행
> 	- `uv add` : 의존성추가 -> resolve -> install
> 	- `uv sync` : (필요시) resolve -> install
> 		- `uv sync --locked` : install만 허용 (pyproject와 다르면 실행안됨)
> 	- `uv run` :  (필요시) resolve -> (필요시) install -> 실행
> 		- `uv run --locked` : install 및 실행만 허용 (pyproject와 다르면 실행안됨)


##### uv lock
직접 `uv lock`으로 resolve만 실행할 수 있다  
앞서 `uv add --no-sync`로 `pyproject.toml`에만 dependency를 추가했거나 특정 목적을 위해 resolve를 분리시키고 싶을 때 사용하면 된다
```bash
uv lock                  # pyproject.toml 기준으로 uv.lock만 생성
```

##### uv sync
현재 `uv.lock` 내용을 기준으로 모든 패키지를 설치해서 프로젝트 environment를 업데이트한다  
`uv.lock`만 있으면 `uv sync`를 통해 해당 프로젝트의 환경을 동일하게 복제할 수 있다
```bash
uv sync                     # uv.lock 기반으로 설치 (defalut 그룹만)
uv sync --group lint        # 특정 그룹 포함해서 설치
uv sync --all-groups        # 모든 그룹 설치

uv sync --locked            # uv.lock 업데이트 없이 현재 그대로 설치 (최신 아니면 에러)
```

##### uv run
uv 로 관리하는 프로젝트에서 파이썬 스크립트를 실행할 때는 앞에 `uv run`을 붙여주면 된다  
그럼 가상환경(`uv add`로 생긴)을 활성화할 필요도 없고 알아서 경로를 잡아서 스크립트를 실행한다   


그리고 이때 `pyproject.toml`과 `uv.lock`과 실제 설치된 패키지가 일치되도록 동기화처리를 알아서 해준다
```bash
uv run python main.py                   # resolve -> install -> 실행

uv run --locked python main.py          # 현재 uv.lock 기준 실행 (최신 아니면 에러)
```



##### 기타 
###### uv export : uv.lock을 다른 lockfile 형태로 출력
```bash
uv export --format requirements.txt    # 기본값
uv export --format pylock.toml

uv export > requirements.txt           # 파일로 저장

uv export --locked --format requirments.txt  # uv.lock이 최신인 경우에만 export (아니면 에러)
uv export --frozen --format requirments.txt  # uv.lock 수정안하고 그대로 export
```

###### uv remove : 설치한 패키지 제거 및 `pyproject.toml`에서도 제거
```bash
uv remove pandas
```

###### uv version : `pyproject.toml`에 있는 프로젝트의 버전을 읽기 및 업데이트
```bash
uv version                    # 예시 : uv-test 0.1.0

uv version --bump minor       # 예시 : uv-test 0.2.0
uv version --bump major       # 예시 : uv-test 1.0.0
uv version --bump patch       # 예시 : uv-test 1.0.1
```
###### uv tree : 현재 설치된 패키지들의 의존성을 tree 형태로 출력
```bash
uv-test v0.1.0
├── matplotlib v3.10.8
│   ├── contourpy v1.3.3
│   │   └── numpy v2.4.1
│   ├── cycler v0.12.1
│   ├── fonttools v4.61.1
│   ├── kiwisolver v1.4.9
│   ├── numpy v2.4.1
│   ├── packaging v26.0
│   ├── pillow v12.1.0
│   ├── pyparsing v3.3.2
│   └── python-dateutil v2.9.0.post0
│       └── six v1.17.0
├── numpy v2.4.1
├── pandas v3.0.0
│   ├── numpy v2.4.1
│   └── python-dateutil v2.9.0.post0 (*)
└── pytest v9.0.2 (group: dev)
    ├── iniconfig v2.3.0
    ├── packaging v26.0
    ├── pluggy v1.6.0
    └── pygments v2.19.2
(*) Package tree already displayed
```



---
### 4. 기존 방식과 호환을 위한 명령어
uv의 메인 명령어는 
- uv init
- uv add
- uv lock
- uv sync
- uv run  
이지만, 기존 방식과 호환이 될 수 있도록 좀 더 익숙한 형태의 명령어도 제공한다

##### uv venv
```bash
uv venv --python 3.11.6               # .venv 폴더에 3.11.6 버전으로 가상환경 설치 (없으면 다운로드)
uv venv --no-project --python 3.11.6  # .python-version 있어도 3.11.6으로 가상환경 생성
uv venv --prompt myproj               # 가상환경 활성화하면 프롬프트가 (myproj)로 보임
uv venv --seed                        # venv만들 때, 기본 패키지(pip, setuptools, wheel) 초기 주입
uv venv /path/to/venv --python 3.11.6 # 기본 .venv대신 내가 지정한 경로에 가상환경 생성
```

##### uv pip
> [!note]+ uv pip 명령어 vs uv 명령어
> - uv pip compile -> uv lock
> - uv pip sync -> uv sync
> - uv pip install -> uv add
> - uv pip freeze -> uv export
###### uv pip compile : 의존성파일 기반으로 잠금파일 생성
```bash
uv pip compile requirements.in -o requirements.txt  # requirements.in -> requirements.txt (고정 버전 생성)
uv pip compile pyproject.toml -o requirements.txt   # pyproject.toml -> requirements.txt
uv pip compile requirements.in requirements-dev.in -o requirements-dev.txt # dev/test 같은 추가 요구를 합쳐서 별도 잠금 생성
uv pip compile requirements.in -o requirements.txt --upgrade-package ruff # 특정 패키지만 버전 올려서 재잠금 (나머지는 최대한 유지)
uv pip compile requirements.in --format pylock.toml -o pylock.toml # 표준 lockfile(pylock.toml)로 생성 (툴 호환 / 표준 포맷 필요할 때)
```
###### uv pip sync : 잠금 파일 기반으로 환경 생성
```bash
uv pip sync requirements.txt
uv pip sync pyloc.toml
uv pip sync --python /path/to/venv/bin/python requirements.txt
```
###### uv pip install: 패키지 추가/업데이트 설치
```bash
uv pip install flask                    # 단일 패키지 설치
uv pip install "flask[dotenv]"          # extras 포함 패키지 설치

uv pip install -e .                     # editable 설치

uv pip install -r requirements.txt      # 파일에서 일괄설치

uv pip install --python /path/to/python ruff   # 특정 파이썬 지정해서 설치
uv pip install --system ruff                   # 시스템 파이썬에 설치(CI/컨테이너에서 종종 사용)
```
###### uv pip uninstall: 패키지 제거
```bash
uv pip uninstall flask
```
###### uv pip freeze : 현재 환경의 설치 패키지를 requirements.txt 스타일로 출력
```bash
uv pip freeze                           # 화면 출력
uv pip freeze > requirements.txt        # requirements.txt로 저장
```
###### 기타
```bash
uv pip list                    # 설치된 패키지 목록
uv pip list --format json      # json 형태로 출력

uv pip show numpy              # 패키지 설치 경로
uv pip show --system numpy     # 시스템 파이썬에서 패키지 설치 경로 

uv pip tree                    # 패키지간 의존성 tree로 출력
uv pip tree --depth 2          # tree 깊이 제한

uv pip check                   # 현재 환경에 충돌/누락된 의존성 점검
```
---
### 5. 포매팅
파이썬 패키지 관련된 것은 아니지만, uv가 제공하는 유용한 기능 중 하나로 포매팅이 있다  

기존에는 코드 스타일, import 스타일을 정리하기 위해 isort, black, flake8 등을 사용했었다 
- isort : import 문 전용 정리 도구
	- 표준 라이브러리 / 서드파티 / 로컬 import 구분
	- 알파벳 순서 정렬
	- unused import 제거(제한적)
- black : 코드 포맷터
    - 줄 길이, 들여쓰기, 따옴표, 줄바꿈 등 강제
- flake8 : 린터(linter)
    - 문법 오류, 스타일 위반, 안 쓰는 변수 등 검사
    - 실제 규칙은 여러 플러그인(pyflakes, pycodestyle 등)의 묶음

하지만 ruff는 uv 를 제작한 astral사에서 만든 formatter로 위 기능들을 모두 포함하고 있다  ([참고](https://brownbears.tistory.com/713))

ruff 를 직접 uv add로 설치한 뒤 `uv run ruff format`을 실행해도 되지만,    
uv format명령어를 통해 따로 설치 없이 바로 사용할 수 있다
##### uv format
```bash
uv format                       # `ruff format`과 동일
uv format --check               # reformat할 파일 있는지 확인
uv format --diff                # reformat하면 달라지는 부분 확인
```

또한 `pyproject.toml`에 관련 설정을 넣어 커스터마이징도 가능하다 ([참고](https://devocean.sk.com/blog/techBoardDetail.do?ID=167467&boardType=techBlog))
```toml
[tool.ruff]
# Exclude a variety of commonly ignored directories.
exclude = [
    ".git",
    ".venv",
]

# Code Formatting (Black) configuration
line-length = 120
indent-width = 4

# Assume Python 3.12
target-version = "py312"

[tool.ruff.lint]
# Enable Pyflakes (`F`) and a subset of the pycodestyle (`E`)  codes by default.
# Unlike Flake8, Ruff doesn't enable pycodestyle warnings (`W`) or
# McCabe complexity (`C901`) by default.
select = ["E4", "E7", "E9", "F", "I"]
ignore = []

# Allow fix for all enabled rules (when `--fix`) is provided.
fixable = ["ALL"]
unfixable = []

# Allow unused variables when underscore-prefixed.
dummy-variable-rgx = "^(_+|(_+[a-zA-Z0-9_]*[a-zA-Z0-9]+?))$"

[tool.ruff.format]
# Like Black, use double quotes for strings.
quote-style = "double"

# Like Black, indent with spaces, rather than tabs.
indent-style = "space"

# Like Black, respect magic trailing commas.
skip-magic-trailing-comma = false

# Like Black, automatically detect the appropriate line ending.
line-ending = "auto"

# Enable auto-formatting of code examples in docstrings. Markdown,
# reStructuredText code/literal blocks and doctests are all supported.
#
# This is currently disabled by default, but it is planned for this
# to be opt-out in the future.
docstring-code-format = false

# Set the line length limit used when formatting code snippets in
# docstrings.
#
# This only has an effect when the `docstring-code-format` setting is
# enabled.
docstring-code-line-length = "dynamic"
```

---
### 6. 보안 검사

2026년 6월, uv에 의존성 보안 검사 기능이 추가되었다 ([발표 글](https://astral.sh/blog/uv-audit))

공급망 공격과 CVE 증가로 의존성 검사의 중요성이 커졌는데, 기존에는 pip-audit 같은 별도 도구를 설치해서 돌려야 했다. uv는 이를 네이티브 기능으로 내장했고, Rust 구현과 lockfile 기반 최적화 덕분에 일반적인 프로젝트에서 pip-audit보다 4~10배 빠르다.

##### uv audit
의존성에서 알려진 취약점과 deprecated 패키지를 스캔한다. OSV(Open Source Vulnerabilities) 데이터베이스를 사용한다.

```bash
uv audit                # 프로젝트 의존성의 취약점/deprecated 스캔
```

`pyproject.toml`이나 `uv.toml`에서 관련 설정을 지정할 수 있다.

##### 악성코드 검사
취약점과 달리 악성 패키지는 설치 즉시 피해가 발생하므로, 설치 시점 차단이 필요하다. uv는 OSV의 MAL advisory를 활용한 경량 악성코드 조회를 `uv add`, `uv sync` 등 매 동기화 시점에 수행한다.

```bash
# 현재는 opt-in 방식: 환경변수로 활성화
UV_MALWARE_CHECK=1 uv sync
```

> [!warning]+ 주의
> - 두 기능 모두 현재 **preview 단계**라 동작과 인터페이스가 바뀔 수 있다
> - 향후 다른 취약점 데이터베이스 지원, 정적 분석 통합, requirements.txt 지원이 검토 중이다
