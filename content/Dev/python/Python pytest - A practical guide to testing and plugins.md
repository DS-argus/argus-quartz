---
tags:
  - python
  - pytest
  - test
created: 2026-06-12T20:35:00
updated: 2026-06-14T18:00:00
permalink: /Dev/python/python-pytest-a-practical-guide-to-testing-and-plugins
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - pytest는 Python 테스트 프레임워크. `assert` 한 줄로 검증하고, `pytest` 명령으로 테스트를 자동으로 찾아 실행
> - 핵심 기능 4가지: 테스트 자동 탐색, fixture(준비 작업 재사용), parametrize(입력만 바꿔 반복), 풍부한 실행 옵션
> - mocking은 `pytest-mock`, 커버리지는 `pytest-cov`처럼 기능을 플러그인으로 확장
> - 본체는 "플러그인을 끼우는 프레임워크"이고 생태계가 넓어서 비동기·Django·병렬 실행까지 전부 커버
> - unittest는 표준 라이브러리라는 점 외엔 우위가 없고, hypothesis는 경쟁자가 아니라 pytest 위에 얹는 보완재

> [!info]+ pytest?
> - Python에서 가장 널리 쓰이는 테스트 프레임워크
> - `assert` 문 하나로 검증, 클래스/상속 없이 함수만으로 테스트 작성
> - `pytest` 명령 한 번으로 테스트 파일을 자동으로 찾아 실행하고 결과를 보기 좋게 출력
> - fixture, parametrize, 마커 등으로 반복을 줄이고, 플러그인으로 기능 확장
> - https://docs.pytest.org/

---

### 1. 설치와 첫 테스트

패키지 설치는 [[python uv - An extremely fast Python package and project manager|uv]] 기준으로 작성한다. 테스트 도구는 개발용이므로 `--dev`로 설치한다.

```bash
uv add --dev pytest
```

검증할 함수와 테스트를 만들어 본다. 파일 두 개면 충분하다.

```python
# calculator.py
def add(a, b):
    return a + b
```

```python
# test_calculator.py
from calculator import add

def test_add():
    assert add(1, 2) == 3
```

실행은 `pytest` 한 줄이다. 인자 없이 실행하면 현재 폴더 아래 테스트 파일을 알아서 찾아 실행한다.

```bash
uv run pytest
```

```text
test_calculator.py .                                        [100%]

========================= 1 passed in 0.01s =========================
```

여기서 `test_add` 함수를 **내가 직접 호출한 적이 없다**. pytest가 파일을 뒤져 `test_`로 시작하는 함수를 찾아 대신 실행한다. 그래서 pytest는 단순 라이브러리가 아니라 내 테스트 코드를 가져다 실행하는 **프레임워크**다.

---

### 2. assert — pytest의 핵심

pytest의 가장 큰 장점은 단언(assertion)을 그냥 파이썬 `assert` 문으로 한다는 데 있다. 별도 메서드를 외울 필요가 없다.

```python
def test_assertions():
    assert add(1, 2) == 3            # 같은가
    assert add(1, 2) != 4            # 다른가
    assert add(-1, 1) == 0
    assert isinstance(add(1, 2), int)
    assert "py" in "pytest"          # 포함 여부
    assert [1, 2] == [1, 2]          # 리스트 비교
```

실패하면 pytest가 값을 풀어서 보여준다. 이걸 assertion introspection이라고 한다. 어디서 왜 틀렸는지 바로 드러난다.

```python
def test_fail_example():
    assert add(1, 2) == 5
```

```text
    def test_fail_example():
>       assert add(1, 2) == 5
E       assert 3 == 5
E        +  where 3 = add(1, 2)

test_calculator.py:5: AssertionError
```

`assert 3 == 5`, 그리고 `3 = add(1, 2)`까지 자동으로 보여준다. 실패 메시지를 직접 작성하지 않아도 된다. 필요하면 메시지를 덧붙일 수도 있다.

```python
def test_with_message():
    result = add(1, 2)
    assert result == 3, f"기대값 3, 실제값 {result}"
```

#### 부동소수점 비교 — pytest.approx

부동소수점은 `==`로 비교하면 안 된다. `0.1 + 0.2`는 정확히 `0.3`이 아니기 때문이다. 이럴 때 `pytest.approx`를 쓴다.

```python
import pytest

def test_float():
    assert 0.1 + 0.2 == pytest.approx(0.3)
```

---

### 3. 테스트 탐색 규칙

pytest가 "무엇을 테스트로 인식하는가"에는 규칙이 있다. 이 규칙만 지키면 등록이나 import 없이 자동으로 수집된다.

| 대상 | 규칙 |
| --- | --- |
| 파일 | `test_*.py` 또는 `*_test.py` |
| 함수 | `test_`로 시작 |
| 클래스 | `Test`로 시작 (`__init__` 없어야 함) |
| 클래스 내 메서드 | `test_`로 시작 |

네 규칙을 한꺼번에 다 만족해야 하는 건 아니다. 파일 규칙만 필수이고, 그 안에서는 **함수 방식이냐 클래스 방식이냐**에 따라 갈린다.

```python
# 방식 1) 함수 스타일 - 가장 흔함. 파일 + 함수, 두 규칙이면 끝
# test_calc.py
def test_add():
    assert add(1, 2) == 3
```

```python
# 방식 2) 클래스로 묶기 - 관련 테스트를 그룹화하고 싶을 때만
# 이때는 클래스 + 메서드 규칙이 세트로 적용된다
# test_calc.py
class TestCalculator:
    def test_add(self):
        assert add(1, 2) == 3

    def test_add_negative(self):
        assert add(-1, -1) == -2
```

| 작성 방식 | 만족해야 할 규칙 |
| --- | --- |
| 함수 방식 | 파일 + 함수 (2개) |
| 클래스 방식 | 파일 + 클래스 + 메서드 (3개) |

대부분 함수 방식으로 쓰며, 이때 표의 "클래스" 관련 두 규칙은 해당 사항이 없다. 규칙을 어긴 파일·함수는 에러 없이 그냥 수집에서 빠진다. 예를 들어 파일명이 `helper.py`면 그 안에 `test_`로 시작하는 함수가 있어도 통째로 무시된다.

> [!tip]+ 규칙은 바꿀 수도 있다
> 이 네이밍 규칙은 기본값일 뿐, `pyproject.toml`의 `python_files`, `python_classes`, `python_functions` 옵션으로 변경할 수 있다. 다만 팀 관례상 기본값을 그대로 쓰는 경우가 대부분이다.

실무에서는 테스트 코드를 `tests/` 폴더에 모은다. 이때 그냥 `uv run pytest`만 치면 pytest가 프로젝트 루트 전체를 뒤지므로, 범위를 좁히려면 매번 경로를 붙여 `uv run pytest tests/`처럼 실행해야 한다. `pyproject.toml`에 탐색 경로를 한 번 지정해두면 이 경로를 생략할 수 있다.

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

이렇게 두면 인자 없이 `uv run pytest`만 쳐도 `tests/`만 탐색한다.

---

### 4. 테스트 실행 — 알아두면 좋은 옵션

`pytest`는 옵션으로 실행 범위와 출력을 세밀하게 조절한다. 실무에서 자주 쓰는 것들이다.

```bash
uv run pytest                          # 전체 실행
uv run pytest tests/test_calc.py       # 특정 파일만
uv run pytest tests/test_calc.py::test_add   # 특정 함수만

uv run pytest -v                       # 테스트 이름까지 자세히 출력
uv run pytest -q                       # 간결하게 출력
uv run pytest -s                       # print() 출력 보이게 (캡처 끄기)

uv run pytest -x                       # 첫 실패에서 즉시 중단
uv run pytest --maxfail=2              # 2개 실패하면 중단

uv run pytest -k "add and not negative"   # 이름으로 필터링
uv run pytest -m slow                  # 특정 마커만 실행

uv run pytest --lf                     # 마지막에 실패한 것만 (last-failed)
uv run pytest --ff                     # 실패한 것 먼저 실행 (failed-first)
```

`-m`의 '마커(marker)'는 테스트에 붙이는 꼬리표다. `slow`, `integration`처럼 분류해두고 골라 실행할 때 쓰는데, 다는 법과 활용은 9번 섹션에서 다룬다.

특히 `-k`는 자주 쓴다. 테스트 이름의 일부 문자열로 필터링하며 `and`, `or`, `not`을 조합할 수 있다.

```bash
# 이름에 'user'가 들어가고 'delete'는 안 들어간 테스트만
uv run pytest -k "user and not delete"
```

> [!tip]+ 개발 중에는 -x --lf 조합
> 실패하는 테스트를 고칠 때는 `pytest -x --lf`가 편하다. 마지막에 실패한 테스트만, 그것도 첫 실패에서 멈춰 실행하므로 한 번에 하나씩 잡아나갈 수 있다. TDD 레드-그린 사이클과 잘 맞는다.

---

### 5. Fixture — 준비 작업 재사용

테스트마다 똑같은 준비 작업(DB 연결, 임시 파일, 객체 생성)을 반복하면 코드가 지저분해진다.

fixture를 안 쓰면 테스트마다 같은 준비 코드를 직접 만들어야 한다.

```python
# fixture 없이 - 준비 코드가 테스트마다 중복된다
def test_user_name():
    user = {"name": "argus", "email": "argus@example.com"}   # 매번 직접 생성
    assert user["name"] == "argus"

def test_user_email():
    user = {"name": "argus", "email": "argus@example.com"}   # 또 똑같이 생성
    assert "@" in user["email"]
```

테스트가 2개라 그나마 견딜 만하지만, 준비 작업이 DB 연결처럼 복잡해지거나 테스트가 수십 개로 늘면 같은 코드가 계속 복사된다. 게다가 준비 방식이 한 번 바뀌면 모든 테스트를 일일이 고쳐야 한다.

fixture는 이 준비 작업을 함수로 한 번만 분리해두고, 테스트가 **인자 이름으로 요청**하면 pytest가 주입해주는 구조다. [[Python Dependency Injection|의존성 주입]]과 같은 발상이다.

```python
import pytest

@pytest.fixture
def sample_user():
    return {"name": "argus", "email": "argus@example.com"}

def test_user_name(sample_user):       # 인자 이름 = fixture 이름
    assert sample_user["name"] == "argus"

def test_user_email(sample_user):      # 다른 테스트에서도 재사용
    assert "@" in sample_user["email"]
```

`test_user_name(sample_user)`처럼 인자에 fixture 이름을 적기만 하면, pytest가 `sample_user()`를 실행해 그 반환값을 넘겨준다. 테스트마다 새로 호출되므로 테스트 간 상태가 섞이지 않는다.

#### setup/teardown — yield로 뒷정리

준비뿐 아니라 정리(파일 삭제, 연결 종료)가 필요하면 `yield`를 쓴다. `yield` 앞은 준비, 뒤는 정리다.

```python
@pytest.fixture
def temp_file(tmp_path):
    path = tmp_path / "data.txt"
    path.write_text("hello")
    yield path                  # 여기서 테스트로 값이 넘어감
    path.unlink()               # 테스트가 끝나면 실행 (뒷정리)

def test_read_file(temp_file):
    assert temp_file.read_text() == "hello"
```

#### scope — fixture 생성 빈도 조절

비싼 준비 작업(DB 연결 등)을 매 테스트마다 새로 만들면 느리다. `scope`로 생성 빈도를 조절한다.

```python
@pytest.fixture(scope="session")   # 전체 테스트에서 한 번만 생성
def db_connection():
    conn = create_connection()
    yield conn
    conn.close()
```

| scope | 생성 빈도 |
| --- | --- |
| `function` (기본) | 테스트 함수마다 |
| `class` | 클래스마다 한 번 |
| `module` | 파일마다 한 번 |
| `session` | 전체 실행에서 한 번 |

#### 내장 fixture

pytest가 기본 제공하는 fixture도 있다. 자주 쓰는 것만 정리한다.

```python
def test_builtin(tmp_path, capsys, monkeypatch):
    # tmp_path: 테스트용 임시 디렉터리 (Path 객체)
    (tmp_path / "a.txt").write_text("x")

    # capsys: print 출력 캡처
    print("hello")
    assert capsys.readouterr().out == "hello\n"

    # monkeypatch: 환경변수/속성 임시 변경 (자동 복구)
    monkeypatch.setenv("API_KEY", "test-key")
```

---

### 6. parametrize — 입력만 바꿔 반복 실행

같은 로직을 여러 입력으로 검증할 때는 테스트 함수를 복사하지 말고 `@pytest.mark.parametrize`로 입력 목록을 넘기면 된다. 입력 개수만큼 테스트가 자동 생성된다.

```python
import pytest

@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-1, 1, 0),
    (100, 200, 300),
])
def test_add(a, b, expected):
    assert add(a, b) == expected
```

```text
test_calc.py::test_add[1-2-3] PASSED
test_calc.py::test_add[0-0-0] PASSED
test_calc.py::test_add[-1-1-0] PASSED
test_calc.py::test_add[100-200-300] PASSED
```

테스트 4개가 따로 실행된 것으로 집계된다. 하나가 실패해도 나머지는 계속 돌아가므로, 어떤 입력에서 깨지는지 정확히 알 수 있다. 엣지 케이스를 추가할 때 줄 하나만 넣으면 되니 TDD에서 특히 유용하다.

`id`를 붙이면 결과 출력이 읽기 좋아진다.

```python
@pytest.mark.parametrize("value, expected", [
    ("", False),
    ("hello", True),
], ids=["empty_string", "non_empty"])
def test_truthiness(value, expected):
    assert bool(value) == expected
```

---

### 7. 예외 테스트 — pytest.raises

"이 입력에서는 에러가 나야 한다"를 검증할 때는 `pytest.raises`를 `with` 블록으로 쓴다.

```python
import pytest

def divide(a, b):
    if b == 0:
        raise ValueError("0으로 나눌 수 없음")
    return a / b

def test_divide_by_zero():
    with pytest.raises(ValueError):
        divide(10, 0)

def test_error_message():
    # 에러 메시지까지 검증 (정규식 매칭)
    with pytest.raises(ValueError, match="나눌 수 없음"):
        divide(10, 0)
```

블록 안에서 지정한 예외가 발생하면 통과, 발생하지 않으면 실패다.

---

### 8. Mocking — pytest-mock

외부 API 호출, DB, 현재 시각처럼 테스트에서 직접 실행하기 곤란한 부분은 가짜(mock)로 바꿔치기한다. 표준 라이브러리 `unittest.mock`을 그대로 써도 되지만, `pytest-mock`을 설치하면 `mocker` fixture로 한결 깔끔해진다.

```bash
uv add --dev pytest-mock
```

아래 예시는 파일 두 개가 짝을 이룬다. `app.py`는 **실제로 동작하는 코드**(테스트 대상)이고, `test_app.py`는 그 코드를 검증하는 테스트다. 둘은 연결돼 있다 — 테스트가 `app.py`의 `fetch_user`를 그대로 불러다 실행하되, 그 안에서 진짜 네트워크를 타는 `requests.get`만 가짜로 바꿔치기한다.

```python
# app.py - 실제 코드. 외부 API를 호출한다
import requests

def fetch_user(user_id):
    resp = requests.get(f"https://api.example.com/users/{user_id}")
    return resp.json()
```

```python
# test_app.py - 위 fetch_user를 테스트. requests.get만 가짜로 교체
from app import fetch_user

def test_fetch_user(mocker):
    # requests.get을 가짜로 교체
    mock_get = mocker.patch("app.requests.get")
    mock_get.return_value.json.return_value = {"id": 1, "name": "argus"}

    user = fetch_user(1)

    assert user["name"] == "argus"
    mock_get.assert_called_once()   # 정확히 한 번 호출됐는지 검증
```

실제 네트워크를 타지 않고도 `fetch_user`의 로직만 격리해서 검증할 수 있다. `mocker`는 테스트가 끝나면 patch를 자동으로 원상 복구하므로 뒷정리를 신경 쓸 필요가 없다.

#### patch가 동작하는 방식

`mocker.patch("app.requests.get")`은 pytest가 코드를 뒤져 알아서 찾아주는 게 아니다. 점(`.`)으로 이어진 경로를 단계별로 따라가 **마지막 속성 하나를 가짜로 교체**할 뿐이다.

```text
"app.requests.get"
  app      → app 모듈을 찾는다
  .requests → 그 모듈 안의 requests 를 찾는다
  .get      → 그 requests 의 get 속성을 가짜(Mock)로 갈아끼운다
```

여기서 중요한 점은 `app.requests`가 **전역에 하나뿐인 requests 모듈 객체**라는 것이다. 따라서 `get` 속성을 바꾸면, 테스트가 도는 동안 `requests.get`을 호출하는 `app` 안의 **모든 함수가 가짜를 받는다**. 함수마다 따로 거는 게 아니라 `get`이라는 속성 자체를 교체하기 때문이다.

```python
# app.py - requests.get을 쓰는 함수가 둘
def fetch_user(uid):
    return requests.get(f".../users/{uid}").json()

def fetch_posts(uid):
    return requests.get(f".../users/{uid}/posts").json()
```

```python
def test_fetch_user(mocker):
    mocker.patch("app.requests.get")   # get 하나 교체
    # → 이 테스트 동안 fetch_user, fetch_posts 둘 다 가짜 requests.get을 본다
    ...
```

대신 patch의 **유효 시간은 그 테스트 함수 하나**다. `mocker`로 걸면 테스트가 끝나는 순간 자동 복구되므로 다른 테스트에는 영향이 없다. 그래서 보통은 "한 테스트 = 한 함수 검증"으로 짜고, 그 테스트 안에서 대상 함수만 호출하면 사실상 그 함수만 가짜를 쓰는 효과가 된다. 한 테스트에서 여러 함수를 호출해 응답을 다르게 주고 싶으면 `side_effect`를 쓰거나 테스트를 나눈다.

> [!note]+ import 방식에 따라 patch 경로가 달라진다
> 가짜로 바꿀 대상은 "정의된 곳"이 아니라 **"사용되는 곳"**의 경로를 적어야 한다. 이 차이는 import 방식이 다를 때 분명해진다.
> - `import requests` → `requests.get()` 호출 → `mocker.patch("app.requests.get")`
> - `from requests import get` → `get()` 호출 → `mocker.patch("app.get")`
>
> 두 번째 경우 `app`은 `get`이라는 자기 이름을 따로 갖게 되므로, `app.requests.get`을 patch하면 안 먹는다. `app`이 부르는 그 이름(`app.get`)을 갈아끼워야 한다.

---

### 9. 마커 — 테스트에 표시 달기

마커(marker)는 테스트에 꼬리표를 붙여 분류하거나 동작을 바꾼다. `@pytest.mark.이름` 형태다.

```python
import pytest

@pytest.mark.skip(reason="아직 구현 안 됨")
def test_future_feature():
    ...

@pytest.mark.skipif(sys.platform == "win32", reason="리눅스 전용")
def test_linux_only():
    ...

@pytest.mark.xfail(reason="알려진 버그, 수정 예정")
def test_known_bug():
    assert buggy_function() == "expected"
```

- `skip`: 무조건 건너뜀
- `skipif`: 조건이 참일 때만 건너뜀 (OS, 버전 분기)
- `xfail`: 실패할 것으로 예상 (실패해도 빨간불이 안 뜸, 알려진 버그 표시용)

#### 커스텀 마커로 분류

직접 마커를 만들어 "느린 테스트"를 분류하고 선택 실행할 수 있다. 먼저 `pyproject.toml`에 등록한다.

```toml
[tool.pytest.ini_options]
markers = [
    "slow: 실행이 오래 걸리는 테스트",
]
```

```python
@pytest.mark.slow
def test_heavy_computation():
    ...
```

```bash
uv run pytest -m slow          # slow 테스트만 실행
uv run pytest -m "not slow"    # slow 빼고 실행 (평소 빠른 실행용)
```

---

### 10. conftest.py — fixture 공유

여러 테스트 파일에서 같은 fixture를 쓰고 싶으면 `conftest.py`라는 특별한 파일에 정의한다. 이 파일의 fixture는 **import 없이** 같은 폴더와 하위 폴더의 모든 테스트에서 자동으로 쓸 수 있다.

```python
# tests/conftest.py
import pytest

@pytest.fixture
def api_client():
    client = APIClient(base_url="http://test")
    yield client
    client.close()
```

```python
# tests/test_users.py - import 없이 바로 사용
def test_get_user(api_client):
    assert api_client.get("/users/1").status_code == 200
```

`conftest.py`는 fixture 공유뿐 아니라 프로젝트 전역 설정, 커스텀 hook을 두는 자리이기도 하다. 사실상 "프로젝트 로컬 플러그인" 역할을 한다.

---

### 11. 커버리지 — pytest-cov

테스트가 코드의 어느 부분을 실제로 실행했는지 측정하려면 `pytest-cov`를 쓴다.

```bash
uv add --dev pytest-cov
```

```bash
uv run pytest --cov=src --cov-report=term-missing
```

여기서 `src`는 고정된 키워드가 아니라 **측정 대상이 되는 내 소스 코드의 경로(또는 패키지명)**다. 프로젝트 구조에 맞게 바꿔야 한다. 소스가 `src/` 폴더에 있으면 `--cov=src`, 패키지명이 `myapp`이면 `--cov=myapp`처럼 쓴다.

```text
Name                Stmts   Miss  Cover   Missing
-------------------------------------------------
src/calculator.py      24      3    88%   45-47
-------------------------------------------------
TOTAL                  24      3    88%
```

`Missing` 열의 `45-47`은 테스트가 거치지 않은 줄 번호다. 어디에 테스트를 더 써야 할지 바로 보인다.

커버리지는 어떻게 "어느 줄이 테스트됐는지"를 알까? pytest-cov가 테스트를 돌리는 동안 파이썬 인터프리터에 붙어 **실제로 실행된 줄을 전부 기록**한다(파이썬의 trace 기능을 활용한다). 실행이 끝나면 소스 파일의 전체 줄과 대조해, 한 번도 실행되지 않은 줄을 `Missing`으로 보고한다. 즉 테스트가 직접 호출한 경로만 '실행됨'으로 집계되고, 테스트가 건드리지 않은 분기는 그대로 드러난다.

CI에서는 최소 커버리지를 강제할 수 있다.

```bash
uv run pytest --cov=src --cov-fail-under=80   # 80% 미만이면 실패 처리
```

> [!warning]+ 커버리지는 양이지 질이 아니다
> 커버리지 100%가 버그 없음을 뜻하지 않는다. "줄을 실행했다"와 "올바른지 검증했다"는 다르다. 숫자를 채우는 것보다 핵심 로직의 엣지 케이스를 제대로 검증하는 것이 우선이다.

---

### 12. TDD 사이클 실전

이 글의 출발점이었던 TDD를 pytest로 어떻게 도는지 정리한다. TDD는 **실패하는 테스트 먼저 → 통과하는 최소 코드 → 정리**의 반복이다.

#### Red — 실패하는 테스트 먼저

아직 없는 함수에 대한 테스트부터 쓴다.

```python
# test_password.py
from validator import is_valid_password

def test_rejects_short_password():
    assert is_valid_password("abc") is False

def test_accepts_long_password():
    assert is_valid_password("abcdefgh") is True
```

```bash
uv run pytest -x
# ImportError: cannot import name 'is_valid_password'  ← 의도된 실패
```

#### Green — 통과하는 최소 코드

테스트를 통과시킬 만큼만 구현한다.

```python
# validator.py
def is_valid_password(password):
    return len(password) >= 8
```

```bash
uv run pytest -x
# 2 passed  ← 초록불
```

#### Refactor — 정리

테스트가 지켜주는 상태에서 안심하고 코드를 다듬는다. 그리고 다음 요구사항을 다시 Red부터 시작한다.

#### 자동 재실행 — pytest-watcher

저장할 때마다 수동으로 `pytest`를 치는 건 번거롭다. `pytest-watcher`를 깔면 파일을 저장할 때마다 자동으로 테스트가 돌아간다. 레드-그린 사이클의 필수 도구다.

```bash
uv add --dev pytest-watcher
uv run ptw .          # 파일 변경 감지해서 자동 재실행
```

---

### 13. 플러그인 생태계

pytest가 표준이 된 결정적 이유는 본체가 아니라 플러그인 생태계에 있다. pytest는 테스트 수집·실행·리포팅 모든 단계에 hook을 열어둔 **프레임워크**다. 플러그인은 그 hook에 끼어들어 기능을 더한다. 브라우저와 확장 프로그램의 관계와 같다.

설치만 하면 자동 활성화된다(별도 import 불필요). 지금까지 쓴 `pytest-mock`, `pytest-cov`, `pytest-watcher`가 전부 플러그인이다. 상황별로 자주 쓰는 것들을 정리한다.

| 플러그인 | 용도 | 핵심 사용법 |
| --- | --- | --- |
| pytest-cov | 커버리지 측정 | `--cov=src` |
| pytest-mock | mocking 통합 | `mocker` fixture |
| pytest-xdist | 여러 프로세스로 병렬 실행 | `-n auto` |
| pytest-randomly | 실행 순서 랜덤화 (숨은 의존성 탐지) | 설치 시 자동 |
| pytest-watcher | 파일 저장 시 자동 재실행 | `ptw .` |
| pytest-asyncio | `async def` 테스트 지원 | `asyncio_mode="auto"` |
| pytest-django | Django 통합 | `@pytest.mark.django_db` |
| pytest-timeout | 무한 루프 강제 종료 | `--timeout=60` |
| pytest-sugar | 진행률 바, 출력 미화 | 설치 시 자동 |

테스트가 수백 개를 넘어가면 `pytest-xdist`의 병렬 실행이 체감된다.

```bash
uv add --dev pytest-xdist
uv run pytest -n auto      # CPU 코어 수만큼 분산 실행
```

> [!note]+ 병렬 실행의 전제
> 테스트끼리 전역 상태(파일, DB, 환경변수)를 공유하면 병렬 실행에서 깨진다. `pytest-randomly`로 실행 순서를 섞어 숨은 의존성을 먼저 잡아낸 뒤 병렬화하는 것이 안전하다.

#### 비동기 테스트 — pytest-asyncio

pytest는 기본적으로 `async def` 테스트를 실행하지 못한다. `pytest-asyncio`가 이벤트 루프 관리를 맡는다.

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

```python
async def test_fetch_data():
    result = await fetch_data()
    assert result["status"] == "ok"
```

#### 자작 플러그인은 conftest.py에서 시작

`conftest.py`에 정해진 이름의 hook 함수를 정의하면 그것이 곧 플러그인이다. 느린 테스트를 자동 리포트하는 예시다.

```python
# conftest.py
def pytest_terminal_summary(terminalreporter, config):
    slow = [r for r in terminalreporter.stats.get("passed", []) if r.duration > 1.0]
    if slow:
        terminalreporter.section("slow tests (> 1s)")
        for r in slow:
            terminalreporter.write_line(f"{r.duration:.2f}s  {r.nodeid}")
```

hook 함수 이름(`pytest_terminal_summary` 등)은 pytest가 정해둔 규약이며, 전체 목록은 공식 문서의 hook reference에 있다.

---

### 14. unittest와의 비교

unittest는 Python 표준 라이브러리에 내장된 테스트 프레임워크다. 별도 설치가 필요 없다는 점이 거의 유일한 장점이다. 같은 테스트를 두 방식으로 쓰면 차이가 분명하다.

```python
# unittest - 클래스 상속 + 전용 메서드
import unittest

class TestCalculator(unittest.TestCase):
    def setUp(self):
        self.calc = Calculator()

    def test_add(self):
        self.assertEqual(self.calc.add(1, 2), 3)
```

```python
# pytest - 함수 + assert 문
import pytest

@pytest.fixture
def calc():
    return Calculator()

def test_add(calc):
    assert calc.add(1, 2) == 3
```

| 항목 | unittest | pytest |
| --- | --- | --- |
| 설치 | 불필요 (표준 라이브러리) | `uv add --dev pytest` |
| 단언 | `assertEqual` 등 메서드 암기 | `assert` 문 하나 |
| 구조 | 클래스 상속 필수 | 함수만으로 가능 |
| 준비/정리 | `setUp`/`tearDown` | fixture (주입·조합 가능) |
| 파라미터화 | `subTest` (제한적) | `parametrize` 마커 |
| 플러그인 | 사실상 없음 | 넓은 생태계 |

의존성 추가가 불가능한 환경(최소 의존성 라이브러리, 일부 사내 정책)이 아니라면 pytest를 선택한다. pytest는 unittest로 작성된 기존 테스트도 그대로 돌리므로 점진적으로 옮겨가면 되고, 그래서 전환 부담이 적다.

---

### 15. hypothesis — 경쟁자가 아닌 보완재

hypothesis는 pytest를 대체하는 도구가 아니라 pytest 위에서 도는 property-based testing 라이브러리다. 먼저 솔직히 말하면 pytest만큼 모두가 쓰는 도구는 아니다. 라이브러리(파서·직렬화·자료구조), 금융·과학 계산처럼 입력이 다양하고 규칙이 명확한 코드에서 주로 쓰고, 일반적인 웹 CRUD 로직에는 굳이 안 쓰는 경우가 많다. 그래도 알아두면 좋은 이유를 예시로 본다.

```bash
uv add --dev hypothesis
```

#### 왜 필요한가 — 예시 테스트의 한계

버그는 보통 **내가 생각 못 한 입력**에 숨어 있다. 예시 테스트(`parametrize` 포함)는 내가 떠올린 케이스만 막는데, hypothesis는 입력을 자동으로 만들어내며 내가 안 떠올린 걸 공격한다. 사용법은 "이 성질은 어떤 입력에도 성립해야 한다"는 규칙을 `@given`으로 선언하는 것이다.

#### 예시 1 — 내가 빠뜨린 입력을 찾아준다

평균 구하는 함수다. 멀쩡해 보이고 예시 테스트도 통과한다.

```python
def average(nums):
    return sum(nums) / len(nums)

def test_average():
    assert average([1, 2, 3]) == 2      # 통과
    assert average([10, 20]) == 15       # 통과
```

이제 "평균은 항상 최솟값과 최댓값 사이에 있어야 한다"는 성질을 hypothesis로 검증한다.

```python
from hypothesis import given, strategies as st

@given(st.lists(st.integers()))
def test_average_in_range(nums):
    avg = average(nums)
    assert min(nums) <= avg <= max(nums)
```

실행하면 바로 반례를 던진다.

```text
Falsifying example: test_average_in_range(nums=[])
ZeroDivisionError: division by zero
```

빈 리스트 `[]`. 평소 테스트에 `average([])`를 넣을 생각은 잘 안 한다. hypothesis는 이런 경계값을 알아서 시도해 "빈 입력 처리를 안 했네"를 드러낸다.

#### 예시 2 — 내가 몰랐던 버그를 찾아준다

진짜 강력한 건 **왕복(round-trip) 성질** 검증이다. "저장했다가 다시 읽으면 원본과 같아야 한다" 같은 규칙이다.

```python
import json

def save(data):
    return json.dumps(data)

def load(s):
    return json.loads(s)

def test_roundtrip():
    d = {"name": "argus", "age": 30}
    assert load(save(d)) == d        # 통과
```

"어떤 dict든 save 후 load하면 원본과 같아야 한다"를 hypothesis로 검증한다.

```python
@given(st.dictionaries(st.integers(), st.text()))
def test_json_roundtrip(d):
    assert load(save(d)) == d
```

```text
Falsifying example: test_json_roundtrip(d={0: ''})
assert {'0': ''} == {0: ''}
```

`{0: ''}`에서 깨진다. **JSON은 dict의 키를 무조건 문자열로 바꾸기 때문**이다. `{0: ''}`을 저장하면 `'{"0": ""}'`가 되고, 다시 읽으면 키가 정수 `0`이 아니라 문자열 `"0"`이 된다. 모르면 예시 테스트로는 절대 못 잡는 함정인데, 정수 키 dict를 일부러 테스트에 넣을 이유가 없기 때문이다. hypothesis는 그걸 알아서 찾아낸다.

#### shrinking — 반례를 최소 형태로 줄여준다

위에서 hypothesis가 보여준 게 `{12345: "qwerty"}` 같은 복잡한 입력이 아니라 `{0: ''}`였던 점을 주목하자. hypothesis는 실패를 찾으면 원인을 가장 단순한 형태로 깎아서(shrinking) 보여준다. "정수 키 하나면 깨지는구나"가 바로 보이니 디버깅이 쉽다.

#### 언제 쓸 가치가 있나

| 잘 맞는 경우 | 굳이 안 써도 되는 경우 |
| --- | --- |
| 왕복 성질 (저장/복원, 인코딩/디코딩, 파싱/포맷) | 단순 CRUD, "DB에 잘 들어가나" |
| 입력 공간이 넓은 수치·문자열 처리 | 입력이 뻔한 짧은 로직 |
| "어떤 입력에도 성립해야 하는 규칙"이 명확할 때 | 외부 의존성이 많아 mock 위주인 코드 |

평소 테스트는 pytest로 쓰고, "예시를 나열하기엔 입력이 너무 많고 지켜야 할 규칙은 명확한" 핵심 로직에만 hypothesis를 얹으면 가성비가 좋다.

---

### 16. 정리

- pytest는 `assert` 한 줄로 검증하고 테스트를 자동으로 찾아 실행하는 **프레임워크**다. 클래스도 상속도 필요 없다.
- 반복을 줄이는 3대 기능: **fixture**(준비 작업 재사용), **parametrize**(입력만 바꿔 반복), **마커**(분류·선택 실행).
- mocking은 `pytest-mock`, 커버리지는 `pytest-cov`처럼 기능을 플러그인으로 확장한다. 비동기·Django·병렬 실행도 전용 플러그인이 표준 경로다.
- 설정은 `pyproject.toml`의 `[tool.pytest.ini_options]`에 모아 팀 전체가 같은 조건으로 실행하게 만든다.
- unittest는 제약 환경용, hypothesis는 pytest 위에 얹는 보완재로 정리하면 도구 선택 고민이 끝난다.

#### 추천 시작 조합

```bash
uv add --dev pytest pytest-cov pytest-mock pytest-xdist pytest-randomly pytest-watcher
```

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra -q --strict-markers"
markers = [
    "slow: 실행이 오래 걸리는 테스트",
]
```

> [!tip]+ 디버깅할 때는 병렬과 커버리지를 끈다
> `-n auto`(병렬)와 `--cov`(커버리지)는 `pdb` 디버깅, `print` 출력과 충돌할 수 있다. 디버깅 시에는 `uv run pytest -p no:xdist -p no:cov -x -s tests/test_target.py`처럼 꺼서 실행한다.
