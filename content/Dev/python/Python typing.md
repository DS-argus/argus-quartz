---
tags:
  - python
  - typing
created: 2026-04-13T00:00:00
updated: 2026-04-14T21:53:32
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Python은 동적 타입 언어라 변수에 아무 타입이나 넣을 수 있지만, 프로젝트가 커지면 "이 변수가 뭔지" 알기 어려워진다
> - `typing` 모듈은 타입 힌트를 선언하는 도구 모음이며, 런타임에는 아무 영향이 없고 **IDE 자동완성과 타입 체커(mypy)를 위한 것**이다
> - 함수 인자/반환값, 변수, 컬렉션의 원소 타입까지 명시할 수 있다

> [!info]+ Sources
> - [Python 공식 문서 — typing](https://docs.python.org/3/library/typing.html)
> - [Python 공식 문서 — Type Hints HOWTO](https://docs.python.org/3/howto/annotations.html)
> - [mypy 공식 문서](https://mypy.readthedocs.io/)

---
### 1. Why typing

##### Python은 동적 타입 언어다

Python은 변수에 타입을 선언하지 않아도 된다. 편하지만 문제가 있다.

```python
def calculate_total(price, quantity, discount):
    return price * quantity * (1 - discount)
```

이 함수만 보면 알 수 없는 것들:
- `price`가 `int`인지 `float`인지 `str`인지?
- `discount`가 0.1 같은 비율인지, 10 같은 퍼센트인지?
- 반환값은 뭔지?

##### 타입 힌트를 추가하면

```python
def calculate_total(price: float, quantity: int, discount: float) -> float:
    return price * quantity * (1 - discount)
```

코드 자체가 문서가 된다. 그리고 IDE가 이 정보를 활용한다:
- **자동완성** — `price.`을 치면 float의 메서드가 뜬다
- **오류 감지** — `calculate_total("100", 2, 0.1)` 같은 실수를 잡아준다
- **리팩토링** — 타입을 바꾸면 영향받는 곳을 IDE가 알려준다

> [!tip]+ 타입 힌트는 강제가 아니다
> Python은 타입 힌트를 **런타임에 무시**한다. 힌트와 다른 타입을 넣어도 에러가 나지 않는다.
> ```python
> def greet(name: str) -> str:
>     return f"Hello, {name}"
>
> greet(123)  # 런타임 에러 없음, 정상 실행됨
> ```
> 타입을 강제하려면 mypy 같은 타입 체커를 별도로 실행하거나, [[Python pydantic|Pydantic]]처럼 런타임 검증을 하는 라이브러리를 사용해야 한다.

---
### 2. Basic type hints

##### 변수 타입 힌트

```python
name: str = "alice"
age: int = 30
height: float = 175.5
is_active: bool = True
```

##### 함수 인자와 반환값

```python
def add(a: int, b: int) -> int:
    return a + b

def greet(name: str) -> str:
    return f"Hello, {name}"

# 반환값이 없는 함수
def log(message: str) -> None:
    print(message)
```

##### 기본값이 있는 인자

```python
def connect(host: str, port: int = 5432, timeout: float = 30.0) -> None:
    ...
```

여기까지는 `typing` 모듈 없이 내장 타입만으로 충분하다.

---
### 3. Collection types

리스트, 딕셔너리 등의 **안에 뭐가 들어있는지**를 표현하려면 제네릭 표기가 필요하다.

##### list, dict, set, tuple

```python
# Python 3.9+ : 내장 타입을 그대로 사용
names: list[str] = ["alice", "bob"]
scores: dict[str, int] = {"alice": 95, "bob": 87}
tags: set[str] = {"python", "typing"}

# tuple은 각 위치의 타입을 지정
point: tuple[float, float] = (1.0, 2.0)
rgb: tuple[int, int, int] = (255, 128, 0)

# 가변 길이 tuple
numbers: tuple[int, ...] = (1, 2, 3, 4, 5)
```

```python
# Python 3.8 이하: typing에서 import
from typing import List, Dict, Set, Tuple

names: List[str] = ["alice", "bob"]
scores: Dict[str, int] = {"alice": 95}
```

> [!note]+ Python 3.9 이후
> Python 3.9부터 `list[str]`, `dict[str, int]`처럼 내장 타입을 직접 제네릭으로 쓸 수 있다. `typing.List`, `typing.Dict`는 더 이상 필요 없다.

##### 중첩 컬렉션

```python
# 2차원 리스트
matrix: list[list[int]] = [[1, 2], [3, 4]]

# 딕셔너리 안에 리스트
user_tags: dict[str, list[str]] = {
    "alice": ["python", "data"],
    "bob": ["java", "spring"],
}

# 리스트 안에 튜플
coordinates: list[tuple[float, float]] = [(1.0, 2.0), (3.0, 4.0)]
```

##### 함수에 적용

```python
def average(scores: list[float]) -> float:
    return sum(scores) / len(scores)

def invert(d: dict[str, int]) -> dict[int, str]:
    return {v: k for k, v in d.items()}

def unique_words(text: str) -> set[str]:
    return set(text.lower().split())
```

---
### 4. Optional and Union

##### Union — 여러 타입 중 하나

변수가 여러 타입일 수 있을 때 사용한다.

```python
# Python 3.10+
def parse_id(value: int | str) -> str:
    return str(value)

# Python 3.9 이하
from typing import Union

def parse_id(value: Union[int, str]) -> str:
    return str(value)
```

```python
# 실전: 설정값이 문자열 또는 숫자일 수 있는 경우
def get_config(key: str) -> str | int | float:
    ...
```

##### Optional — None이 될 수 있는 타입

`Optional[X]`는 `X | None`과 동일하다. 값이 없을 수 있는 경우에 사용한다.

```python
# Python 3.10+
def find_user(user_id: int) -> str | None:
    ...

# Python 3.9 이하
from typing import Optional

def find_user(user_id: int) -> Optional[str]:
    ...
```

```python
# 실전: 검색 결과가 없을 수 있는 경우
def search(query: str) -> list[str] | None:
    results = db.search(query)
    return results if results else None

# 기본값이 None인 인자
def connect(host: str, port: int = 5432, password: str | None = None) -> None:
    ...
```

> [!tip]+ Optional vs Union
> `Optional[str]`은 정확히 `str | None`이다. "선택적"이라는 뜻이 아니라 **None이 될 수 있다**는 뜻이다.
> ```python
> # 이 둘은 동일
> def f(x: Optional[str]) -> None: ...
> def f(x: str | None) -> None: ...
> ```
> Python 3.10 이상이면 `|` 문법이 더 직관적이므로 `Optional` 대신 `str | None`을 쓰는 것이 권장된다.

---
### 5. Any

타입을 제한하고 싶지 않을 때 사용한다. 모든 타입과 호환된다.

```python
from typing import Any

def log(value: Any) -> None:
    print(value)

data: Any = "hello"
data = 123      # OK
data = [1, 2]   # OK
```

```python
# dict의 값이 뭐든 될 수 있는 경우
config: dict[str, Any] = {
    "host": "localhost",
    "port": 5432,
    "debug": True,
    "tags": ["a", "b"],
}
```

> [!note]+ Any vs object
> `Any`는 타입 체크를 **완전히 끈다**. `object`는 모든 타입의 부모이지만 해당 타입의 메서드를 쓸 수 없다.
> ```python
> def f(x: Any) -> None:
>     x.foo()      # 타입 체커가 무시 — 에러 안 잡힘
>
> def g(x: object) -> None:
>     x.foo()      # 타입 체커 에러 — object에 foo가 없으므로
> ```
> 가능하면 `Any` 대신 구체적인 타입을 쓰는 것이 좋다.

---
### 6. Callable

함수를 인자로 받거나 반환할 때 사용한다.

```python
from collections.abc import Callable

# "str을 받아서 int를 반환하는 함수"를 인자로 받는다
def apply(func: Callable[[str], int], value: str) -> int:
    return func(value)

result = apply(len, "hello")   # 5
result = apply(int, "42")      # 42
```

```python
# 인자 없이 str을 반환하는 함수
def run(factory: Callable[[], str]) -> str:
    return factory()

# 여러 인자를 받는 함수
def on_event(callback: Callable[[str, int], None]) -> None:
    callback("click", 42)
```

```python
# 인자 타입을 제한하지 않을 때
from typing import Any

loose: Callable[..., str]   # 아무 인자나 받고 str을 반환
```

```python
# 실전: 데코레이터 타입 힌트
from collections.abc import Callable
from functools import wraps

def retry(max_attempts: int) -> Callable:
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            for i in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception:
                    if i == max_attempts - 1:
                        raise
        return wrapper
    return decorator
```

---
### 7. Literal and Final

##### Literal — 특정 값만 허용

```python
from typing import Literal

def open_file(path: str, mode: Literal["r", "w", "a"]) -> None:
    ...

open_file("data.txt", "r")      # OK
open_file("data.txt", "x")      # 타입 체커 에러
```

```python
# 실전: 방향, 상태 등 제한된 값
def move(direction: Literal["up", "down", "left", "right"]) -> None:
    ...

def set_log_level(level: Literal["DEBUG", "INFO", "WARNING", "ERROR"]) -> None:
    ...
```

> [!tip]+ Literal vs Enum
> 둘 다 값을 제한하는 용도지만 쓰임새가 다르다.
> - `Literal` — 타입 힌트 전용, 런타임에 효과 없음, 간단한 경우에 적합
> - `Enum` — 런타임에도 동작, 메서드 추가 가능, 복잡한 경우에 적합

##### Final — 재할당 금지

```python
from typing import Final

MAX_RETRIES: Final = 3
MAX_RETRIES = 5   # 타입 체커 에러

API_URL: Final[str] = "https://api.example.com"
```

```python
# 클래스에서 상수 선언
class Config:
    TIMEOUT: Final[int] = 30
    BASE_URL: Final[str] = "https://api.example.com"

# 상속 시 오버라이드 불가
class CustomConfig(Config):
    TIMEOUT = 60   # 타입 체커 에러
```

---
### 8. TypeAlias and NewType

##### TypeAlias — 긴 타입에 이름 붙이기

타입이 복잡해지면 별칭을 만들어 가독성을 높일 수 있다.

```python
# Python 3.12+
type UserId = int
type UserMap = dict[UserId, str]
type Matrix = list[list[float]]
type Handler = Callable[[str, int], None]
```

```python
# Python 3.10~3.11
from typing import TypeAlias

UserId: TypeAlias = int
UserMap: TypeAlias = dict[UserId, str]
Matrix: TypeAlias = list[list[float]]
```

```python
# 별칭을 사용하면 함수 시그니처가 깔끔해진다
def transform(data: Matrix) -> Matrix:
    ...

def get_user(users: UserMap, uid: UserId) -> str:
    return users[uid]
```

##### NewType — 같은 타입이지만 구분하고 싶을 때

`NewType`은 기존 타입과 동일하게 동작하지만, 타입 체커가 **별개의 타입으로 취급**한다.

```python
from typing import NewType

UserId = NewType("UserId", int)
ProductId = NewType("ProductId", int)

def get_user(uid: UserId) -> str:
    ...

user_id = UserId(42)
product_id = ProductId(42)

get_user(user_id)      # OK
get_user(product_id)   # 타입 체커 에러 — ProductId != UserId
get_user(42)           # 타입 체커 에러 — int != UserId
```

런타임에는 아무 효과가 없다. `UserId(42)`는 그냥 `42`를 반환한다. 타입 체커만을 위한 장치다.

> [!note]+ TypeAlias vs NewType
> - `TypeAlias` — 긴 타입의 **축약**. `UserId`와 `int`는 완전히 동일하게 취급
> - `NewType` — 기존 타입과 **구분**. `UserId`와 `int`는 별개의 타입으로 취급

---
### 9. TypedDict

딕셔너리의 키별로 타입을 지정할 수 있다. API 응답이나 설정 같은 **스키마가 고정된 dict**에 유용하다.

```python
from typing import TypedDict

class UserDict(TypedDict):
    name: str
    age: int
    email: str

user: UserDict = {"name": "alice", "age": 30, "email": "alice@example.com"}
```

```python
# 일부 키가 선택적인 경우
class UserDict(TypedDict, total=False):
    name: str       # 선택
    age: int        # 선택
    email: str      # 선택

# 필수 + 선택 조합 (Python 3.11+)
from typing import Required, NotRequired

class UserDict(TypedDict):
    name: str                       # 필수 (기본)
    age: int                        # 필수 (기본)
    nickname: NotRequired[str]      # 선택
```

```python
# 실전: API 응답 타입 정의
class ApiResponse(TypedDict):
    status: int
    data: list[dict[str, str]]
    message: str

def handle_response(resp: ApiResponse) -> None:
    if resp["status"] == 200:
        for item in resp["data"]:
            print(item)
```

> [!note]+ TypedDict vs [[Python dataclass|dataclass]]
> 둘 다 구조화된 데이터를 표현하지만 다르다.
> - `TypedDict` — 결과물이 **dict 그대로**. JSON 직렬화가 필요 없고, 기존에 dict를 쓰던 곳에 타입만 추가하고 싶을 때
> - `dataclass` — 결과물이 **클래스 인스턴스**. 메서드 추가, `.` 접근, 비교 연산 등이 필요할 때

---
### 10. Protocol

"이 메서드를 가지고 있으면 이 타입으로 인정한다"는 **구조적 타이핑(Structural Typing)** 을 구현한다. Java의 인터페이스와 비슷하지만, 명시적으로 상속하지 않아도 된다.

```python
from typing import Protocol

class Closable(Protocol):
    def close(self) -> None:
        ...

# 이 함수는 close() 메서드가 있는 객체면 뭐든 받는다
def cleanup(resource: Closable) -> None:
    resource.close()
```

```python
# 파일 객체 — close()가 있으니 Closable
f = open("test.txt")
cleanup(f)   # OK

# 커스텀 클래스 — close()가 있으니 Closable (상속 불필요)
class DatabaseConnection:
    def close(self) -> None:
        print("DB 연결 종료")

cleanup(DatabaseConnection())   # OK

# close()가 없는 클래스
class PlainObject:
    pass

cleanup(PlainObject())   # 타입 체커 에러
```

```python
# 실전: 여러 메서드를 요구하는 Protocol
class Readable(Protocol):
    def read(self, size: int = -1) -> str:
        ...

    def readline(self) -> str:
        ...

def process(source: Readable) -> list[str]:
    lines = []
    while line := source.readline():
        lines.append(line)
    return lines
```

> [!tip]+ Protocol vs ABC(Abstract Base Class)
> - `ABC` — 상속이 필수. `class MyFile(ABC):`처럼 명시적으로 상속해야 한다
> - `Protocol` — 상속 불필요. 메서드 시그니처만 맞으면 된다 (duck typing의 정적 버전)

---
### 11. TypeVar and Generic

함수나 클래스가 **여러 타입에 대해 동일하게 동작**할 때, 타입 변수를 사용해 "입력 타입과 출력 타입의 관계"를 표현한다.

##### TypeVar

```python
from typing import TypeVar

T = TypeVar("T")

def first(items: list[T]) -> T:
    return items[0]

# 타입 체커가 추론:
first([1, 2, 3])        # T = int → 반환 타입 int
first(["a", "b"])       # T = str → 반환 타입 str
```

`T`가 없으면 이렇게 쓸 수밖에 없다:

```python
# Any를 쓰면 반환 타입 정보가 사라진다
def first(items: list[Any]) -> Any:
    return items[0]

result = first([1, 2, 3])   # result의 타입: Any (int가 아님)
```

##### Bound — 상한 제약

```python
T = TypeVar("T", bound=str)

# T는 str 또는 str의 서브클래스만 가능
def to_upper(s: T) -> T:
    return s.upper()
```

##### Python 3.12+ 문법

Python 3.12부터는 TypeVar를 별도로 선언하지 않아도 된다.

```python
# Python 3.12+
def first[T](items: list[T]) -> T:
    return items[0]

# 클래스에도 사용 가능
class Stack[T]:
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

stack = Stack[int]()
stack.push(1)      # OK
stack.push("a")    # 타입 체커 에러
```

---
### 12. Version changes

| 버전       | 주요 변경                                                       |
| -------- | ----------------------------------------------------------- |
| 3.5      | `typing` 모듈 도입                                              |
| **3.9**  | 내장 제네릭 (`list[int]`, `dict[str, int]`). `typing.List` 등 불필요 |
| **3.10** | `X \| Y` union 문법. `Optional[X]` 대신 `X \| None`             |
| 3.11     | `TypedDict`에 `Required`, `NotRequired` 추가                   |
| **3.12** | `type` 문, 제네릭 문법 `def f[T]()`, `class C[T]:`                |

> [!tip]+ 어떤 버전 문법을 쓸까
> - Python 3.10+ → `int | str`, `str | None` 사용 (가장 깔끔)
> - Python 3.9 → `list[int]` 사용, Union은 `typing.Union`
> - Python 3.8 이하 → `typing.List[int]`, `typing.Optional[str]`
>
> `from __future__ import annotations`를 파일 맨 위에 쓰면 3.7~3.9에서도 `list[int]`, `int | str` 문법을 사용할 수 있다. (문자열로 평가가 지연되는 방식)

---
### 13. Practical examples

지금까지 배운 것들을 조합한 실전 예시들이다.

##### API client

```python
from typing import Any, TypedDict

class ApiResponse(TypedDict):
    status: int
    data: dict[str, Any]
    error: str | None

def fetch(url: str, params: dict[str, str] | None = None) -> ApiResponse:
    ...

def extract_field(response: ApiResponse, field: str) -> Any:
    return response["data"].get(field)
```

##### Data pipeline

```python
from collections.abc import Callable, Iterable

type Transform = Callable[[dict[str, Any]], dict[str, Any]]

def pipeline(
    data: Iterable[dict[str, Any]],
    transforms: list[Transform],
) -> list[dict[str, Any]]:
    results = list(data)
    for transform in transforms:
        results = [transform(item) for item in results]
    return results

# 사용
def add_timestamp(record: dict[str, Any]) -> dict[str, Any]:
    record["processed_at"] = "2026-04-13"
    return record

def normalize_keys(record: dict[str, Any]) -> dict[str, Any]:
    return {k.lower(): v for k, v in record.items()}

output = pipeline(raw_data, [normalize_keys, add_timestamp])
```

##### Config with defaults

```python
from dataclasses import dataclass, field
from typing import Final, Literal

LOG_LEVELS = Literal["DEBUG", "INFO", "WARNING", "ERROR"]

@dataclass
class AppConfig:
    host: str = "localhost"
    port: int = 8080
    debug: bool = False
    log_level: LOG_LEVELS = "INFO"
    allowed_origins: list[str] = field(default_factory=list)

    MAX_CONNECTIONS: Final[int] = 100
```

##### Repository pattern

```python
from typing import TypeVar, Protocol

class HasId(Protocol):
    id: int

T = TypeVar("T", bound=HasId)

class Repository:
    def __init__(self) -> None:
        self._store: dict[int, HasId] = {}

    def save(self, entity: T) -> T:
        self._store[entity.id] = entity
        return entity

    def find(self, entity_id: int) -> HasId | None:
        return self._store.get(entity_id)
```
