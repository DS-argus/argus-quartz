---
tags:
  - python
created: 2026-04-12T00:00:00
updated: 2026-04-12T21:53:16
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - `@dataclass`는 데이터를 담는 클래스의 boilerplate(`__init__`, `__repr__`, `__eq__` 등)를 자동 생성해주는 데코레이터
> - Python 3.7에서 도입 (PEP 557), "기본값이 있는 mutable namedtuple"로 이해하면 쉽다
> - 설정 객체, API 응답 매핑, DTO 등 **값을 구조화해서 담는 모든 곳**에서 유용하다

> [!info]+ Sources
> - [Python 공식 문서 — dataclasses](https://docs.python.org/3/library/dataclasses.html)
> - [PEP 557 — Data Classes](https://peps.python.org/pep-0557/)

---
### 1. 왜 dataclass인가

Python에서 데이터를 담는 클래스를 만들려면 반복 코드가 많다.

##### 일반 클래스로 작성하면
```python
class User:
    def __init__(self, name: str, age: int, email: str):
        self.name = name
        self.age = age
        self.email = email

    def __repr__(self):
        return f"User(name={self.name!r}, age={self.age!r}, email={self.email!r})"

    def __eq__(self, other):
        if not isinstance(other, User):
            return NotImplemented
        return (self.name, self.age, self.email) == (other.name, other.age, other.email)
```

필드가 3개뿐인데 20줄이다. 필드가 늘어날 때마다 `__init__`, `__repr__`, `__eq__`를 전부 수정해야 한다.

##### dataclass로 작성하면
```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int
    email: str
```

이게 전부다. `__init__`, `__repr__`, `__eq__`가 자동 생성된다.

```python
u1 = User("alice", 30, "alice@example.com")
u2 = User("alice", 30, "alice@example.com")

print(u1)        # User(name='alice', age=30, email='alice@example.com')
print(u1 == u2)  # True
```

> [!tip]+ 핵심
> dataclass는 새로운 자료구조가 아니다. **일반 클래스에 boilerplate 메서드를 자동으로 붙여주는 데코레이터**일 뿐이다. 생성된 클래스는 일반 클래스와 완전히 동일하게 동작한다.

---
### 2. 기본 사용법

##### 자동 생성되는 메서드 (boilerplate)

Python 클래스에는 `__`로 감싸진 특수 메서드(dunder method)가 있다. 객체를 출력하거나, 비교하거나, 해시값을 구할 때 Python이 내부적으로 호출하는 메서드다. 이것들을 직접 정의하지 않으면 `object`에서 상속받은 기본 동작이 적용되는데, 대부분 데이터 클래스에서 원하는 동작과 다르다.

| 메서드          | 역할                        | 정의 안 했을 때 (일반 클래스)                  | dataclass 자동 생성              |
| ------------ | ------------------------- | ----------------------------------- | ---------------------------- |
| `__init__()` | 객체 생성 시 초기화               | 인자 없는 빈 생성자                         | 필드를 파라미터로 받아 `self.필드 = 값`   |
| `__repr__()` | `print()`, 디버깅 시 출력       | `<User object at 0x7f...>` (메모리 주소) | `User(name='alice', age=30)` |
| `__eq__()`   | == 비교                     | 객체 identity 비교 (`is`와 동일)           | 필드 값 비교                      |
| `__hash__()` | `dict` 키, `set` 원소로 사용할 때 | `id()` 기반 해시                        | `frozen=True`일 때 필드 기반 해시    |
| `__lt__()` 등 | `<`, `<=`, `>`, `>=` 비교   | `TypeError` (비교 불가)                 | `order=True`일 때 필드 튜플 비교     |

가장 자주 겪는 함정은 `__eq__`다.

```python
# 일반 클래스 — 값이 같아도 다른 객체면 False
class User:
    def __init__(self, name):
        self.name = name

print(User("alice") == User("alice"))  # False (메모리 주소가 다르니까)
```

```python
# dataclass — 값이 같으면 True
@dataclass
class User:
    name: str

print(User("alice") == User("alice"))  # True (필드 값을 비교하니까)
```

`__repr__`도 마찬가지다.

```python
# 일반 클래스
class User:
    def __init__(self, name):
        self.name = name

print(User("alice"))  # <User object at 0x7f3b2c1d4a90> — 디버깅할 때 쓸모없다
```

```python
# dataclass
@dataclass
class User:
    name: str

print(User("alice"))  # User(name='alice') — 바로 내용이 보인다
```

##### 기본값 지정

```python
@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080
    debug: bool = False
```

```python
c = Config()
print(c)  # Config(host='localhost', port=8080, debug=False)

c2 = Config(host="0.0.0.0", debug=True)
print(c2)  # Config(host='0.0.0.0', port=8080, debug=True)
```

일반 함수의 기본 인자와 같은 규칙이 적용된다. **기본값이 없는 필드가 있는 필드보다 앞에 와야 한다.**

```python
# ❌ TypeError 발생
@dataclass
class Bad:
    x: int = 0
    y: int       # 기본값 없는 필드가 뒤에 오면 안 됨

# ✅ 올바른 순서
@dataclass
class Good:
    y: int
    x: int = 0
```

##### 메서드 추가

dataclass라고 해서 메서드를 못 넣는 게 아니다. 일반 클래스와 동일하게 메서드를 추가할 수 있다.

```python
@dataclass
class Rectangle:
    width: float
    height: float

    def area(self) -> float:
        return self.width * self.height

    def is_square(self) -> bool:
        return self.width == self.height
```

```python
r = Rectangle(3.0, 4.0)
print(r.area())      # 12.0
print(r.is_square())  # False
```

---
### 3. 기존 방식과 비교

데이터를 담는 방법은 여러 가지다. 각각 언제 적합한지 비교한다.

##### dict
```python
user = {"name": "alice", "age": 30, "email": "alice@example.com"}
```

##### NamedTuple
```python
from typing import NamedTuple

class User(NamedTuple):
    name: str
    age: int
    email: str
```

##### dataclass
```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int
    email: str
```

##### 비교표

| 기준 | dict | NamedTuple | dataclass |
|------|------|------------|-----------|
| 타입 힌팅 | X (값에 대해 없음) | O | O |
| 자동 `__repr__` | X | O | O |
| 자동 `__eq__` | O (값 비교) | O | O |
| mutable | O | **X (불변)** | O (기본) / X (`frozen=True`) |
| 기본값 | O | O | O |
| 속성 접근 | `d["name"]` | `u.name` | `u.name` |
| IDE 자동완성 | X | O | O |
| 메서드 추가 | X | 제한적 | O |
| 상속 | X | 제한적 | O |
| 언팩 | X | O (`*u`) | X (별도 구현 필요) |

> [!note]+ 언제 뭘 쓸까
> - **dict** → 스키마가 유동적이거나 JSON을 임시로 다룰 때
> - **NamedTuple** → 불변이어야 하고, 튜플 언팩이 필요하며, 가볍게 쓸 때
> - **dataclass** → 필드가 명확하고, mutable이 필요하거나, 메서드/상속이 필요할 때

##### dataclass의 언팩(unpack)

NamedTuple은 내부가 `tuple`이라 `x, y = point`가 바로 되지만, dataclass는 일반 클래스라서 `__iter__`가 없어 기본적으로 언팩이 안 된다.

```python
from typing import NamedTuple
from dataclasses import dataclass, astuple, asdict

class NTPoint(NamedTuple):
    x: int
    y: int

@dataclass
class DCPoint:
    x: int
    y: int

x, y = NTPoint(1, 2)   # OK — tuple이니까
x, y = DCPoint(1, 2)   # TypeError: cannot unpack non-iterable DCPoint object
```

언팩이 필요하면 `astuple()`을 쓰거나, `__iter__`를 직접 추가하면 된다.

```python
# 방법 1: astuple()로 변환 후 언팩
from dataclasses import astuple

p = DCPoint(1, 2)
x, y = astuple(p)

# 방법 2: __iter__ 구현
@dataclass
class Point:
    x: int
    y: int

    def __iter__(self):
        return iter(astuple(self))

x, y = Point(1, 2)  # OK
```

대부분의 경우 `.x`, `.y`로 접근하는 게 명시적이고 권장되는 방식이다. 언팩은 좌표처럼 순서가 자명한 경우에만 쓰는 게 좋다.

##### NamedTuple의 함정

NamedTuple은 내부적으로 tuple이라서 **다른 타입끼리도 값만 같으면 동일하다고 판단**한다.

```python
from typing import NamedTuple

class Point(NamedTuple):
    x: int
    y: int

class Pair(NamedTuple):
    first: int
    second: int

print(Point(1, 2) == Pair(1, 2))  # True — 의도하지 않은 동작
```

dataclass는 클래스 타입까지 비교하므로 이 문제가 없다.

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

@dataclass
class Pair:
    first: int
    second: int

print(Point(1, 2) == Pair(1, 2))  # False
```

---
### 4. field()와 기본값

##### field() 기본 사용

`field()`를 통해 필드별로 세밀한 제어가 가능하다.

```python
from dataclasses import dataclass, field

@dataclass
class Product:
    name: str
    price: float
    tags: list[str] = field(default_factory=list)
    internal_id: str = field(repr=False, default="N/A")
    discount: float = field(compare=False, default=0.0)
```

```python
p = Product("노트북", 1500000.0, ["전자기기", "컴퓨터"])
print(p)  # Product(name='노트북', price=1500000.0, tags=['전자기기', '컴퓨터'], discount=0.0)
# internal_id는 repr=False라 출력에서 제외된다
```

##### field() 주요 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `default` | MISSING | 필드의 기본값 |
| `default_factory` | MISSING | 기본값을 생성하는 함수 (mutable 기본값에 필수) |
| `init` | True | `__init__` 파라미터에 포함할지 |
| `repr` | True | `__repr__` 출력에 포함할지 |
| `compare` | True | `__eq__` 등 비교에 포함할지 |
| `hash` | None | `__hash__`에 포함할지 (None이면 compare 값을 따름) |
| `kw_only` | False | keyword-only 파라미터로 설정 |
| `metadata` | None | 커스텀 메타데이터 딕셔너리 |

##### 가변 기본값 함정

Python에서 mutable 기본값은 모든 인스턴스가 같은 객체를 공유하는 유명한 함정이다. dataclass는 이걸 **컴파일 타임에 잡아준다**.

```python
# ❌ dataclass가 TypeError를 발생시킨다
@dataclass
class BadExample:
    items: list = []
# TypeError: mutable default <class 'list'> for field items is not allowed:
# use default_factory
```

```python
# ✅ default_factory 사용
@dataclass
class GoodExample:
    items: list = field(default_factory=list)
    config: dict = field(default_factory=dict)
    scores: set = field(default_factory=set)
```

```python
a = GoodExample()
b = GoodExample()
a.items.append(1)
print(a.items)  # [1]
print(b.items)  # [] — 각 인스턴스가 독립적인 리스트를 가진다
```

##### 복잡한 기본값

`default_factory`에는 어떤 callable이든 넣을 수 있다.

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class LogEntry:
    message: str
    level: str = "INFO"
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict = field(default_factory=lambda: {"version": "1.0"})
```

```python
log = LogEntry("서버 시작")
print(log)
# LogEntry(message='서버 시작', level='INFO', timestamp=datetime(...), metadata={'version': '1.0'})
```

##### init=False와 계산 필드

`init=False`로 지정하면 생성자에서 받지 않고, `__post_init__`에서 계산할 수 있다.

```python
@dataclass
class Circle:
    radius: float
    area: float = field(init=False)

    def __post_init__(self):
        self.area = 3.14159 * self.radius ** 2
```

```python
c = Circle(5.0)
print(c)  # Circle(radius=5.0, area=78.53975)
```

##### metadata 활용

`metadata`는 [[Python 직렬화(Serialization)|직렬화]] 라이브러리나 검증 로직에서 필드 정보를 참조할 때 유용하다.

```python
from dataclasses import dataclass, field, fields

@dataclass
class APIResponse:
    status_code: int = field(metadata={"json_key": "statusCode"})
    body: str = field(metadata={"json_key": "responseBody"})
    headers: dict = field(default_factory=dict, metadata={"json_key": "headers"})

# 메타데이터 조회
for f in fields(APIResponse):
    print(f"{f.name} -> JSON key: {f.metadata.get('json_key')}")
# status_code -> JSON key: statusCode
# body -> JSON key: responseBody
# headers -> JSON key: headers
```

---
### 5. 데코레이터 옵션

`@dataclass` 데코레이터에는 클래스 전체의 동작을 제어하는 파라미터가 있다.

```python
@dataclass(init=True, repr=True, eq=True, order=False,
           frozen=False, slots=False, kw_only=False)
```

##### frozen — 불변 객체 만들기

`frozen=True`로 설정하면 인스턴스 생성 후 필드 값을 변경할 수 없다.

```python
@dataclass(frozen=True)
class Coordinate:
    lat: float
    lng: float
```

```python
c = Coordinate(37.5665, 126.9780)
c.lat = 0.0  # FrozenInstanceError 발생
```

frozen dataclass는 `__hash__`가 자동 생성되므로 dict 키나 set 원소로 사용할 수 있다.

```python
locations = {
    Coordinate(37.5665, 126.9780): "서울",
    Coordinate(35.1796, 129.0756): "부산",
}
print(locations[Coordinate(37.5665, 126.9780)])  # 서울
```

##### order — 비교 연산자 자동 생성

`order=True`로 설정하면 `<`, `<=`, `>`, `>=` 연산자가 자동 생성된다. 필드를 튜플로 변환해서 순서대로 비교한다.

```python
@dataclass(order=True)
class Version:
    major: int
    minor: int
    patch: int
```

```python
versions = [Version(2, 1, 0), Version(1, 9, 5), Version(2, 0, 3)]
print(sorted(versions))
# [Version(major=1, minor=9, patch=5), Version(major=2, minor=0, patch=3), Version(major=2, minor=1, patch=0)]

print(Version(2, 0, 0) > Version(1, 9, 9))  # True
```

##### slots — 메모리 최적화

`slots=True`(Python 3.10+)로 설정하면 `__slots__`가 자동 생성된다. 이게 왜 메모리를 절약하는지 이해하려면 Python이 객체의 속성을 저장하는 방식을 알아야 한다.

**기본 동작 — `__dict__` 방식**

일반 Python 객체는 내부에 `__dict__`라는 딕셔너리를 갖고 있다. 속성을 추가하면 이 딕셔너리에 key-value로 저장된다.

```python
@dataclass
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
print(p.__dict__)  # {'x': 1.0, 'y': 2.0}

# 딕셔너리라서 아무 속성이나 자유롭게 추가할 수 있다
p.z = 3.0
print(p.__dict__)  # {'x': 1.0, 'y': 2.0, 'z': 3.0}
```

딕셔너리는 유연하지만 오버헤드가 크다. 해시 테이블 자체의 메모리, 키 문자열 객체, 동적 리사이징 등이 인스턴스마다 붙는다.

**`__slots__` 방식**

`__slots__`를 사용하면 `__dict__`를 생성하지 않는다. 대신 속성을 **고정된 위치의 슬롯(배열)**에 저장한다. C 구조체의 필드처럼 각 속성이 미리 정해진 오프셋에 위치하는 방식이다.

```python
@dataclass(slots=True)
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
print(p.__slots__)  # ('x', 'y')

# __dict__가 없다
hasattr(p, '__dict__')  # False

# 선언하지 않은 속성은 추가할 수 없다
p.z = 3.0  # AttributeError: 'Point' object has no attribute 'z'
```

**실제 메모리 차이**

```python
import sys
from dataclasses import dataclass

@dataclass
class DictPoint:
    x: float
    y: float

@dataclass(slots=True)
class SlotPoint:
    x: float
    y: float

d = DictPoint(1.0, 2.0)
s = SlotPoint(1.0, 2.0)

print(sys.getsizeof(d) + sys.getsizeof(d.__dict__))  # 344 bytes
print(sys.getsizeof(s))                                # 48 bytes
```

인스턴스 하나당 수십~백 바이트 차이가 나므로, 100만 개를 만들면 수십~수백 MB 차이가 된다.

```
일반 (dict):  [객체 헤더] → [__dict__] → {해시 테이블: "x"→1.0, "y"→2.0}
slots:        [객체 헤더] → [slot 0: 1.0] [slot 1: 2.0]
```

> [!tip]+ slots는 언제 쓸까
> 인스턴스를 수만~수백만 개 생성하는 경우(데이터 파이프라인, 이벤트 로그 등)에 메모리 차이가 체감된다. 소량이면 체감 없다.

> [!note]+ slots의 제약
> - 선언하지 않은 속성을 동적으로 추가할 수 없다
> - 다중 상속 시 부모 클래스도 `__slots__`를 정의해야 제대로 동작한다
> - `__dict__`가 없으므로 `vars(obj)` 대신 `dataclasses.fields()`로 필드를 조회해야 한다

##### kw_only — keyword-only 파라미터 강제

`kw_only=True`(Python 3.10+)로 설정하면 모든 필드가 keyword-only가 된다. 필드 수가 많을 때 실수 방지에 좋다.

```python
@dataclass(kw_only=True)
class DatabaseConfig:
    host: str
    port: int
    user: str
    password: str
    database: str
```

```python
# ❌ TypeError — 위치 인자로 전달 불가
db = DatabaseConfig("localhost", 5432, "admin", "secret", "mydb")

# ✅ 반드시 keyword로 전달
db = DatabaseConfig(host="localhost", port=5432, user="admin",
                    password="secret", database="mydb")
```

필드 단위로도 제어할 수 있다. `KW_ONLY` 센티넬을 사용하면 해당 위치 이후의 필드만 keyword-only가 된다.

```python
from dataclasses import dataclass, KW_ONLY

@dataclass
class Request:
    url: str              # 위치 인자 OK
    method: str = "GET"   # 위치 인자 OK
    _: KW_ONLY
    headers: dict = None  # keyword-only
    timeout: int = 30     # keyword-only
```

```python
r = Request("https://api.example.com", "POST", headers={"Authorization": "Bearer ..."})
```

---
### 6. `__post_init__`과 InitVar

##### `__post_init__` — 초기화 후처리

`__init__`이 실행된 직후 자동으로 호출된다. 필드 값 검증, 계산 필드 생성 등에 사용한다.

```python
@dataclass
class Temperature:
    celsius: float
    fahrenheit: float = field(init=False)
    kelvin: float = field(init=False)

    def __post_init__(self):
        self.fahrenheit = self.celsius * 9 / 5 + 32
        self.kelvin = self.celsius + 273.15
```

```python
t = Temperature(100)
print(t)
# Temperature(celsius=100, fahrenheit=212.0, kelvin=373.15)
```

##### 값 검증

```python
@dataclass
class Age:
    value: int

    def __post_init__(self):
        if self.value < 0:
            raise ValueError(f"나이는 음수일 수 없습니다: {self.value}")
        if self.value > 150:
            raise ValueError(f"비현실적인 나이입니다: {self.value}")
```

```python
Age(25)   # OK
Age(-1)   # ValueError: 나이는 음수일 수 없습니다: -1
```

##### 값 정규화

```python
@dataclass
class Tag:
    name: str

    def __post_init__(self):
        self.name = self.name.strip().lower()
```

```python
t = Tag("  Python  ")
print(t)  # Tag(name='python')
```

##### InitVar — 초기화 전용 파라미터

`InitVar`로 선언한 필드는 `__init__`에만 존재하고 인스턴스 속성으로는 저장되지 않는다. `__post_init__`의 인자로 전달된다.

```python
from dataclasses import dataclass, field, InitVar

@dataclass
class User:
    name: str
    age: int
    birth_year: InitVar[int] = None

    def __post_init__(self, birth_year: int | None):
        if birth_year is not None:
            self.age = 2026 - birth_year
```

```python
u1 = User("alice", age=30)
print(u1)  # User(name='alice', age=30)

u2 = User("bob", age=0, birth_year=1995)
print(u2)  # User(name='bob', age=31)
# birth_year는 인스턴스에 저장되지 않는다
```

##### 실전 예시 — DB 조회 결과로 초기화

```python
from dataclasses import dataclass, field, InitVar

@dataclass
class Product:
    name: str
    price: float
    category: str = field(init=False, default="미분류")
    raw_data: InitVar[dict | None] = None

    def __post_init__(self, raw_data: dict | None):
        if raw_data:
            self.category = raw_data.get("category", "미분류")
            if "discount_rate" in raw_data:
                self.price *= (1 - raw_data["discount_rate"])
```

```python
data = {"category": "전자기기", "discount_rate": 0.1}
p = Product("키보드", 100000, raw_data=data)
print(p)  # Product(name='키보드', price=90000.0, category='전자기기')
```

---
### 7. 유틸 함수

dataclasses 모듈은 인스턴스를 변환하거나 조회하는 유틸 함수를 제공한다.

##### asdict() — 딕셔너리 변환

```python
from dataclasses import dataclass, asdict

@dataclass
class Address:
    city: str
    zipcode: str

@dataclass
class User:
    name: str
    age: int
    address: Address
```

```python
u = User("alice", 30, Address("서울", "06000"))

print(asdict(u))
# {'name': 'alice', 'age': 30, 'address': {'city': '서울', 'zipcode': '06000'}}
```

중첩된 dataclass도 재귀적으로 변환된다. JSON 직렬화할 때 유용하다.

```python
import json
json.dumps(asdict(u), ensure_ascii=False)
# '{"name": "alice", "age": 30, "address": {"city": "서울", "zipcode": "06000"}}'
```

##### astuple() — 튜플 변환

```python
from dataclasses import astuple

print(astuple(u))
# ('alice', 30, ('서울', '06000'))
```

##### replace() — 일부 필드만 바꾼 새 인스턴스

원본을 수정하지 않고 복사본을 만든다. `frozen=True`인 dataclass에서 특히 유용하다.

```python
from dataclasses import replace

@dataclass(frozen=True)
class Config:
    host: str
    port: int
    debug: bool = False
```

```python
prod = Config("api.example.com", 443)
dev = replace(prod, host="localhost", port=8080, debug=True)

print(prod)  # Config(host='api.example.com', port=443, debug=False)
print(dev)   # Config(host='localhost', port=8080, debug=True)
```

##### fields() — 필드 정보 조회

```python
from dataclasses import fields

for f in fields(User):
    print(f"name={f.name}, type={f.type}, default={f.default}")
# name=name, type=<class 'str'>, default=MISSING
# name=age, type=<class 'int'>, default=MISSING
# name=address, type=<class 'Address'>, default=MISSING
```

직렬화 라이브러리나 ORM을 직접 만들 때 필드 메타정보를 동적으로 읽는 용도로 쓴다.

---
### 8. 언제 쓰고, 언제 안 쓸까

##### dataclass가 적합한 경우
- **설정/환경 객체** — DB 접속 정보, API 설정 등 구조화된 값
- **API 응답/요청 매핑** — JSON 스키마가 고정된 데이터
- **DTO (Data Transfer Object)** — 함수 간, 레이어 간 데이터 전달
- **도메인 모델** — 비즈니스 로직이 포함된 값 객체
- **테스트 픽스처** — 테스트 데이터를 깔끔하게 구성

```python
# 설정 객체
@dataclass(frozen=True)
class RedisConfig:
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: str | None = None

# API 응답 매핑
@dataclass
class PaginatedResponse:
    items: list[dict]
    total: int
    page: int
    per_page: int
    has_next: bool = field(init=False)

    def __post_init__(self):
        self.has_next = self.page * self.per_page < self.total
```

##### dataclass가 아닌 게 나은 경우

| 상황 | 더 나은 선택 | 이유 |
|------|-------------|------|
| 스키마가 유동적인 JSON | `dict` | 필드가 매번 달라지면 dataclass 정의가 의미 없음 |
| 불변 + 튜플 언팩이 필요 | `NamedTuple` | `x, y = point` 패턴을 자주 쓸 때 |
| 복잡한 검증/변환 로직 | `pydantic` 또는 `attrs` | dataclass의 `__post_init__`만으로 부족할 때 |
| 단순 2~3개 값을 임시로 묶을 때 | `tuple` 또는 `dict` | 클래스 정의 오버헤드가 오히려 큼 |
| ORM 모델 | `SQLAlchemy Model` 등 | ORM은 자체 메타클래스 시스템이 있음 |

> [!note]+ dataclass vs pydantic
> [[Pydantic|pydantic]]은 **런타임 타입 검증과 자동 변환**이 핵심이다. `age: int`에 `"30"`(문자열)을 넣으면 pydantic은 자동으로 `int(30)`으로 변환하지만, dataclass는 그대로 `"30"`이 들어간다. API 입력 검증이 필요하면 pydantic, 내부 데이터 구조화만 필요하면 dataclass가 적합하다.

> [!note]+ dataclass vs attrs
> attrs(2015)는 사실 dataclass(2017, PEP 557)보다 먼저 나왔고, dataclass가 attrs에서 영감을 받아 만들어졌다. attrs는 validator, converter 같은 기능을 기본 제공해서 `__post_init__`으로 직접 구현해야 하는 검증/변환을 선언적으로 처리할 수 있다.
> ```python
> from attrs import define, field
> from attrs.validators import gt, instance_of
>
> @define
> class User:
>     name: str = field(validator=instance_of(str))
>     age: int = field(validator=gt(0))
>
> User("alice", -1)  # ValueError — validator가 자동으로 검증
> ```
> dataclass는 **표준 라이브러리**라 설치가 필요 없고 대부분의 경우 충분하다. 필드별 검증/변환이 복잡해지면 attrs를 고려하면 된다.
