---
tags:
  - python
  - pydantic
created: 2026-04-12T00:00:00
updated: 2026-04-12T00:00:00
permalink: /Dev/python/python-pydantic
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - pydantic은 Python의 타입 힌트를 **런타임에 강제**하는 데이터 검증 라이브러리
> - [[Python dataclass|dataclass]]는 타입 힌트가 힌트일 뿐이지만, pydantic은 실제로 검증하고 변환한다
> - [[Python fastapi]]의 요청/응답 처리, 설정 관리, 외부 데이터 파싱 등에서 핵심적으로 사용된다

> [!info]+ Sources
> - [Pydantic 공식 문서](https://docs.pydantic.dev/latest/)
> - [Pydantic — Models](https://docs.pydantic.dev/latest/concepts/models/)
> - [Pydantic — Validators](https://docs.pydantic.dev/latest/concepts/validators/)

---
### 1. pydantic이란

pydantic은 Python의 타입 힌트를 기반으로 **데이터 검증과 자동 변환**을 해주는 라이브러리다. 핵심 차이를 코드로 보면 바로 이해된다.

##### dataclass — 타입 힌트는 "힌트"일 뿐

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int

u = User(name="alice", age="30")
print(u.age)        # "30" — 문자열 그대로
print(type(u.age))  # <class 'str'>
```

`age: int`라고 적었지만 문자열 `"30"`이 그대로 들어간다. 런타임에서 타입을 확인하지 않는다.

##### pydantic — 타입을 "강제"한다

```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    age: int

u = User(name="alice", age="30")
print(u.age)        # 30 — int로 변환됨
print(type(u.age))  # <class 'int'>
```

문자열 `"30"`을 넣어도 `int`로 자동 변환된다. 변환 불가능하면 에러가 발생한다.

```python
User(name="alice", age="abc")
# ValidationError: 1 validation error for User
# age
#   Input should be a valid integer, unable to parse string as an integer
```

> [!tip]+ 설치
> pydantic은 서드파티 라이브러리다. 별도 설치가 필요하다.
> ```bash
> pip install pydantic
> ```

---
### 2. 기본 사용법

##### 모델 정의

`BaseModel`을 상속하고 필드를 타입 어노테이션으로 선언한다.

```python
from pydantic import BaseModel

class Product(BaseModel):
    name: str
    price: float
    quantity: int = 0        # 기본값
    tags: list[str] = []     # mutable 기본값도 안전 (dataclass와 달리 field() 불필요)
```

```python
p = Product(name="키보드", price="89000")  # 문자열 → float 자동 변환
print(p)
# name='키보드' price=89000.0 quantity=0 tags=[]
```

##### 자동 변환 규칙

pydantic은 가능한 한 선언된 타입으로 변환을 시도한다.

```python
class Example(BaseModel):
    a: int
    b: float
    c: str
    d: bool

e = Example(a="42", b="3.14", c=123, d="yes")
print(e)
# a=42 b=3.14 c='123' d=True
```

| 입력 | 선언 타입 | 결과 |
|------|----------|------|
| `"42"` | `int` | `42` |
| `"3.14"` | `float` | `3.14` |
| `123` | `str` | `"123"` |
| `"yes"` | `bool` | `True` |
| `"abc"` | `int` | `ValidationError` |

##### ValidationError

검증 실패 시 `ValidationError`가 발생한다. 어떤 필드에서 어떤 이유로 실패했는지 상세 정보를 제공한다.

```python
from pydantic import ValidationError

class User(BaseModel):
    name: str
    age: int
    email: str

try:
    User(name=123, age="abc", email="alice@example.com")
except ValidationError as e:
    print(e.error_count())  # 1 — age만 실패 (name은 "123"으로 변환 가능)
    print(e.errors())
    # [{'type': 'int_parsing', 'loc': ('age',), 'msg': 'Input should be a valid integer...'}]
```

---
### 3. Field()

`Field()`를 사용하면 기본값, 별칭, 검증 제약 조건 등을 필드 단위로 설정할 수 있다.

##### 기본 사용

```python
from pydantic import BaseModel, Field

class User(BaseModel):
    name: str = Field(min_length=1, max_length=50, description="사용자 이름")
    age: int = Field(ge=0, le=150, description="나이")
    email: str = Field(pattern=r"^[\w.-]+@[\w.-]+\.\w+$")
```

```python
User(name="", age=30, email="alice@example.com")
# ValidationError — name이 빈 문자열 (min_length=1 위반)

User(name="alice", age=-1, email="alice@example.com")
# ValidationError — age가 음수 (ge=0 위반)

User(name="alice", age=30, email="not-an-email")
# ValidationError — pattern 불일치
```

##### Field() 주요 옵션

| 옵션 | 용도 | 예시 |
|------|------|------|
| `default` | 기본값 | `Field(default=0)` |
| `default_factory` | mutable 기본값 | `Field(default_factory=list)` |
| `alias` | JSON 키 이름 매핑 | `Field(alias="userName")` |
| `min_length` / `max_length` | 문자열 길이 제한 | `Field(min_length=1)` |
| `ge` / `gt` / `le` / `lt` | 숫자 범위 | `Field(ge=0, le=100)` |
| `pattern` | 정규식 검증 | `Field(pattern=r"^\d{3}-\d{4}$")` |
| `description` | JSON Schema 설명 | `Field(description="사용자 ID")` |
| `exclude` | 직렬화 시 제외 | `Field(exclude=True)` |

##### alias — 외부 JSON 키와 Python 필드명 매핑

외부 API의 JSON 키가 Python 네이밍 컨벤션과 다를 때 유용하다.

```python
class User(BaseModel):
    user_name: str = Field(alias="userName")
    created_at: str = Field(alias="createdAt")

# JSON에서는 camelCase로 받고
data = {"userName": "alice", "createdAt": "2026-04-12"}
u = User(**data)

# Python에서는 snake_case로 접근
print(u.user_name)   # alice
print(u.created_at)  # 2026-04-12
```

---
### 4. 검증자 (Validator)

`Field()`의 제약 조건만으로 부족할 때, 커스텀 검증 로직을 데코레이터로 정의할 수 있다.

##### @field_validator — 필드 단위 검증

```python
from pydantic import BaseModel, field_validator

class User(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_must_be_alphanumeric(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("영문과 숫자만 허용됩니다")
        return v

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("비밀번호는 8자 이상이어야 합니다")
        if not any(c.isupper() for c in v):
            raise ValueError("대문자가 최소 1개 포함되어야 합니다")
        return v
```

```python
User(username="alice123", password="MyPass123")  # OK

User(username="alice!@#", password="MyPass123")
# ValidationError — 영문과 숫자만 허용됩니다

User(username="alice", password="short")
# ValidationError — 비밀번호는 8자 이상이어야 합니다
```

##### @field_validator의 값 변환

validator에서 값을 변환해서 반환할 수도 있다. 검증과 정규화를 동시에 처리한다.

```python
class Tag(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def normalize(cls, v: str) -> str:
        return v.strip().lower()

print(Tag(name="  Python  "))  # name='python'
```

##### @model_validator — 모델 단위 검증 (여러 필드 조합)

필드 간 관계를 검증할 때 사용한다.

```python
from pydantic import BaseModel, model_validator

class DateRange(BaseModel):
    start: str
    end: str

    @model_validator(mode="after")
    def check_date_order(self):
        if self.start >= self.end:
            raise ValueError("start는 end보다 이전이어야 합니다")
        return self
```

```python
DateRange(start="2026-01-01", end="2026-12-31")  # OK
DateRange(start="2026-12-31", end="2026-01-01")   # ValidationError
```

##### mode="before" vs mode="after"

```python
class User(BaseModel):
    name: str
    age: int

    # before: 타입 변환 전에 실행 (raw 입력값을 받음)
    @model_validator(mode="before")
    @classmethod
    def preprocess(cls, data):
        if isinstance(data, dict) and "full_name" in data:
            data["name"] = data.pop("full_name")
        return data

    # after: 타입 변환 후에 실행 (검증된 모델 인스턴스를 받음)
    @model_validator(mode="after")
    def postprocess(self):
        self.name = self.name.title()
        return self
```

```python
u = User(**{"full_name": "alice", "age": 30})
print(u.name)  # Alice — before에서 키 변환, after에서 title() 적용
```

---
### 5. 직렬화/역직렬화

pydantic은 [[Python serialization|직렬화]] 메서드를 내장하고 있다. `asdict` + `json.dumps` 조합이 필요한 [[Python dataclass|dataclass]]와 달리 한 줄로 처리된다.

##### Python 객체 → dict / JSON

```python
class Address(BaseModel):
    city: str
    zipcode: str

class User(BaseModel):
    name: str
    age: int
    address: Address

u = User(name="alice", age=30, address=Address(city="서울", zipcode="06000"))

# dict로 변환
print(u.model_dump())
# {'name': 'alice', 'age': 30, 'address': {'city': '서울', 'zipcode': '06000'}}

# JSON 문자열로 변환
print(u.model_dump_json(indent=2))
# {
#   "name": "alice",
#   "age": 30,
#   "address": {
#     "city": "서울",
#     "zipcode": "06000"
#   }
# }
```

##### dict / JSON → Python 객체

```python
# dict에서 생성
data = {"name": "bob", "age": 25, "address": {"city": "부산", "zipcode": "48000"}}
u = User.model_validate(data)

# JSON 문자열에서 생성
json_str = '{"name": "bob", "age": 25, "address": {"city": "부산", "zipcode": "48000"}}'
u = User.model_validate_json(json_str)
```

중첩된 모델도 자동으로 파싱된다. dict 안의 `{"city": "부산", "zipcode": "48000"}`이 `Address` 객체로 변환된다.

##### 직렬화 옵션

```python
class User(BaseModel):
    name: str
    password: str = Field(exclude=True)  # 직렬화 시 제외
    age: int

u = User(name="alice", password="secret123", age=30)
print(u.model_dump())
# {'name': 'alice', 'age': 30} — password 제외됨
```

```python
# 특정 필드만 포함/제외
u.model_dump(include={"name", "age"})   # {'name': 'alice', 'age': 30}
u.model_dump(exclude={"age"})           # {'name': 'alice'}
```

##### dataclass와 비교

| 작업 | dataclass | pydantic |
|------|-----------|----------|
| dict 변환 | `asdict(obj)` | `obj.model_dump()` |
| JSON 변환 | `json.dumps(asdict(obj))` | `obj.model_dump_json()` |
| dict → 객체 | 수동 매핑 필요 | `Model.model_validate(dict)` |
| JSON → 객체 | `json.loads()` + 수동 매핑 | `Model.model_validate_json(str)` |
| 중첩 객체 파싱 | 수동 | 자동 |

---
### 6. 모델 설정 (model_config)

`model_config`를 통해 모델 전체의 동작을 제어할 수 있다.

```python
from pydantic import ConfigDict
```

##### strict — 자동 변환 끄기

기본적으로 pydantic은 `"30"` → `30`처럼 변환을 시도한다. `strict=True`로 설정하면 정확한 타입만 허용한다.

```python
class StrictUser(BaseModel):
    model_config = ConfigDict(strict=True)

    name: str
    age: int

StrictUser(name="alice", age=30)    # OK
StrictUser(name="alice", age="30")  # ValidationError — str은 int가 아님
```

##### frozen — 불변 모델

dataclass의 `frozen=True`와 동일하다.

```python
class Config(BaseModel):
    model_config = ConfigDict(frozen=True)

    host: str
    port: int

c = Config(host="localhost", port=8080)
c.host = "0.0.0.0"  # ValidationError — frozen이라 변경 불가
```

##### extra — 정의하지 않은 필드 처리

```python
# forbid: 정의하지 않은 필드가 오면 에러 (기본값은 ignore)
class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str

StrictModel(name="alice", unknown_field="?")
# ValidationError — extra inputs are not permitted
```

```python
# allow: 정의하지 않은 필드도 저장
class FlexModel(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str

m = FlexModel(name="alice", custom="value")
print(m.custom)  # value
```

##### populate_by_name — alias와 필드명 둘 다 허용

```python
class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_name: str = Field(alias="userName")

# 둘 다 가능
User(userName="alice")    # OK (alias)
User(user_name="alice")   # OK (필드명)
```

---
### 7. 중첩 모델과 JSON Schema

##### 중첩 모델 자동 파싱

pydantic의 가장 강력한 기능 중 하나다. JSON의 중첩 구조를 모델 정의만으로 자동 파싱한다.

```python
class Address(BaseModel):
    city: str
    zipcode: str

class Company(BaseModel):
    name: str
    address: Address

class User(BaseModel):
    name: str
    age: int
    company: Company
    hobbies: list[str] = []
```

```python
# 깊게 중첩된 dict를 넣어도 자동으로 각 모델로 변환된다
data = {
    "name": "alice",
    "age": 30,
    "company": {
        "name": "Acme",
        "address": {
            "city": "서울",
            "zipcode": "06000"
        }
    },
    "hobbies": ["python", "coffee"]
}

u = User(**data)
print(type(u.company))          # <class 'Company'>
print(type(u.company.address))  # <class 'Address'>
print(u.company.address.city)   # 서울
```

[[Python dataclass|dataclass]]에서 같은 일을 하려면 중첩된 dict를 수동으로 매핑해야 한다.

##### JSON Schema 자동 생성

pydantic 모델에서 JSON Schema를 자동으로 생성할 수 있다. [[Python fastapi]]는 이 기능을 이용해 API 문서(Swagger UI)를 자동 생성한다.

```python
import json

schema = User.model_json_schema()
print(json.dumps(schema, indent=2))
# {
#   "properties": {
#     "name": { "type": "string", "title": "Name" },
#     "age": { "type": "integer", "title": "Age" },
#     "company": { "$ref": "#/$defs/Company" },
#     "hobbies": {
#       "items": { "type": "string" },
#       "type": "array",
#       "default": [],
#       "title": "Hobbies"
#     }
#   },
#   "required": ["name", "age", "company"],
#   ...
# }
```

---
### 8. FastAPI와의 연동

[[Python fastapi]]는 내부적으로 pydantic을 사용한다. 요청 body를 pydantic 모델로 선언하면 검증, 변환, 문서화가 자동으로 처리된다.

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI()

class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    age: int = Field(ge=0, le=150)
    email: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str

@app.post("/users", response_model=UserResponse)
async def create_user(req: CreateUserRequest):
    # req는 이미 검증/변환이 완료된 pydantic 모델
    # name이 빈 문자열이거나 age가 음수면 여기까지 오지 않는다 (422 에러)
    return UserResponse(id=1, name=req.name, email=req.email)
```

이 코드만으로 다음이 자동으로 동작한다:
- 요청 JSON → `CreateUserRequest` 검증 + 변환
- 검증 실패 시 422 Unprocessable Entity 응답 (에러 메시지 포함)
- 응답을 `UserResponse` 스키마로 직렬화
- Swagger UI(`/docs`)에 요청/응답 스키마 자동 표시

##### Query Parameter 검증

body뿐 아니라 query parameter에도 pydantic 검증을 적용할 수 있다.

```python
from fastapi import Query

@app.get("/users")
async def list_users(
    page: int = Query(ge=1, default=1),
    size: int = Query(ge=1, le=100, default=20),
    sort: str = Query(pattern=r"^(name|age|created)$", default="name"),
):
    return {"page": page, "size": size, "sort": sort}
```

---
### 9. dataclass vs pydantic 정리

| 기준 | dataclass | pydantic |
|------|-----------|----------|
| 설치 | 불필요 (표준 라이브러리) | `pip install pydantic` |
| 타입 검증 | X (힌트만) | O (런타임 검증 + 자동 변환) |
| 기본값 (mutable) | `field(default_factory=list)` | `[]` 그대로 가능 |
| 필드 제약 조건 | `__post_init__`에서 직접 구현 | `Field(ge=0, max_length=50)` |
| 커스텀 검증 | `__post_init__` | `@field_validator`, `@model_validator` |
| dict 변환 | `asdict()` | `.model_dump()` |
| JSON 변환 | `asdict()` + `json.dumps()` | `.model_dump_json()` |
| JSON → 객체 | 수동 매핑 | `.model_validate_json()` |
| 중첩 객체 파싱 | 수동 | 자동 |
| JSON Schema | X | `.model_json_schema()` |
| 불변 모델 | `frozen=True` | `model_config = ConfigDict(frozen=True)` |
| 성능 | 빠름 (boilerplate 생성일 뿐) | v2에서 크게 개선 (Rust 기반 코어) |
| FastAPI 연동 | X | 기본 통합 |

##### 판단 기준

```
외부 데이터를 받아서 검증해야 하는가?
├── Yes → pydantic
│         (API 입력, JSON 파싱, 환경변수, 사용자 입력)
└── No → 내부 데이터를 구조화만 하면 되는가?
          ├── Yes → dataclass (가볍고 표준)
          └── 검증도 약간 필요 → pydantic 또는 attrs
```

> [!note]+ 같이 쓰는 것도 가능하다
> 하나의 프로젝트에서 둘을 섞어 쓰는 것은 자연스럽다. API 경계(입출력)에서는 pydantic으로 검증하고, 내부 로직에서는 dataclass로 가볍게 데이터를 전달하는 패턴이 일반적이다.
