---
tags:
  - python
  - backend
created: 2026-04-26T00:00:00
updated: 2026-05-27T21:19:14
permalink: /dev/python/python-dependency-injection
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Dependency Injection(DI)은 클래스가 의존성을 직접 생성하지 않고 외부에서 주입받는 설계 패턴
> - Strategy 패턴과 결합하면 Open/Closed Principle을 지키면서 기능을 확장 가능
> - Python에서는 Protocol(구조적 서브타이핑)로 인터페이스를 정의하고, 전략 객체 또는 functools.partial 튜플로 경량 구현도 가능
> - 규모가 커지면 `dependency-injector` 같은 라이브러리로 의존성 그래프를 선언적으로 관리

> [!cite]+ Source
> - [Dependency Injection in Python is Awesome - Indently](https://youtube.com/watch?v=J1adhPWc-1c)
> - [Python Dependency Injection - Better Stack](https://betterstack.com/community/guides/scaling-python/python-dependency-injection/)

---

### 1. Dependency Injection이란

Dependency Injection(의존성 주입, DI)은 객체가 필요로 하는 의존성을 **스스로 만들지 않고 외부에서 넘겨받는** 설계 패턴이다.

핵심 아이디어는 간단하다.

- **DI 없이**: 클래스 내부에서 `self.db = DatabaseConnection()`처럼 직접 생성
- **DI 적용**: 생성자 파라미터로 `def __init__(self, db):`처럼 받아서 사용

이 한 가지 차이가 코드의 **결합도**, **테스트 용이성**, **교체 가능성**을 크게 바꾼다.

---

### 2. 왜 필요한가

DI 없이 의존성을 하드코딩하면 생기는 문제들이 있다.

- **테스트가 어렵다** - 클래스를 테스트할 때마다 실제 DB나 외부 API에 연결해야 한다
- **구현 교체가 힘들다** - PostgreSQL에서 MySQL로 바꾸려면 사용하는 클래스를 전부 수정해야 한다
- **결합도가 높다** - 하나를 바꾸면 연쇄적으로 다른 곳이 깨진다

> [!tip]+ 핵심 원칙
> "구체적인 구현이 아니라 인터페이스(추상)에 의존하라" - 이것이 DI의 근본 원칙이다.

---

### 3. 실전 예시 - 직렬화 포맷 전환

DI가 왜 필요한지 직렬화(serialize) 예시로 보자. 사용자 데이터를 JSON, TOML, YAML 등 여러 포맷으로 변환하는 상황이다.

#### DI 없는 코드 - 포맷을 문자열로 하드코딩

```python
@dataclass
class UserData:
    username: str
    email: str

    def serialize(self, format: str) -> str:
        if format == "json":
            return json.dumps(asdict(self))
        elif format == "toml":
            return toml.dumps(asdict(self))
        else:
            raise ValueError(f"Unknown format: {format}")

    @classmethod
    def deserialize(cls, data: str, format: str) -> "UserData":
        if format == "json":
            return cls(**json.loads(data))
        elif format == "toml":
            return cls(**toml.loads(data))
        # ...매번 elif 추가
```

YAML 포맷을 추가하려면 `serialize`와 `deserialize` **두 메서드 모두 수정**해야 한다. 이것이 **Open/Closed Principle(OCP) 위반**이다. OCP란 "확장에는 열려 있고, 수정에는 닫혀 있어야 한다"는 설계 원칙이다.

#### DI 적용 코드 - Strategy 패턴으로 주입

```python
from typing import Any, Protocol

class SerializerStrategy(Protocol):
    def serialize(self, data: dict[str, Any]) -> str: ...
    def deserialize(self, data: str) -> dict[str, Any]: ...

class JsonSerializer:
    def serialize(self, data: dict[str, Any]) -> str:
        return json.dumps(data, indent=2)
    def deserialize(self, data: str) -> dict[str, Any]:
        return json.loads(data)

class TomlSerializer:
    def serialize(self, data: dict[str, Any]) -> str:
        return toml.dumps(data)
    def deserialize(self, data: str) -> dict[str, Any]:
        return toml.loads(data)

class YamlSerializer:
    def serialize(self, data: dict[str, Any]) -> str:
        return yaml.dump(data)
    def deserialize(self, data: str) -> dict[str, Any]:
        return yaml.safe_load(data)
```

```python
@dataclass
class UserData:
    username: str
    email: str

    def serialize(self, strategy: SerializerStrategy) -> str:
        return strategy.serialize(asdict(self))

    @classmethod
    def deserialize(cls, data: str, strategy: SerializerStrategy) -> "UserData":
        return cls(**strategy.deserialize(data))
```

```python
user = UserData("alice", "alice@example.com")
print(user.serialize(JsonSerializer()))   # JSON
print(user.serialize(TomlSerializer()))   # TOML
print(user.serialize(YamlSerializer()))   # YAML
```

새 포맷(예: MessagePack)을 추가해도 **UserData 클래스는 한 줄도 수정하지 않는다**. 전략 클래스만 하나 만들면 된다. 이것이 OCP를 지키는 DI + Strategy 패턴이다.

---

### 4. 클래스 없이 경량 DI - functools.partial + tuple

영상에서는 전략을 클래스가 아닌 **tuple로 경량 구현**하는 방법도 보여준다. 간단한 경우에 유용하다.

```python
from functools import partial

# (encoder, decoder) 튜플로 전략 정의
json_strategy = (partial(json.dumps, indent=2), json.loads)
toml_strategy = (toml.dumps, toml.loads)
yaml_strategy = (partial(yaml.dump), yaml.safe_load)
```

```python
@dataclass
class UserData:
    username: str
    email: str

    def serialize(self, strategy: tuple) -> str:
        encoder, _ = strategy
        return encoder(asdict(self))

    @classmethod
    def deserialize(cls, data: str, strategy: tuple) -> "UserData":
        _, decoder = strategy
        return cls(**decoder(data))
```

```python
user = UserData("bob", "bob@example.com")
print(user.serialize(json_strategy))
print(user.serialize(yaml_strategy))
```

디자인 패턴을 엄격하게 클래스로 구현할 필요는 없다. 핵심 아이디어만 지키면 함수와 tuple로도 같은 효과를 낼 수 있다.

---

### 5. 일반적인 DI 패턴 - DB 연결 예시

직렬화 외에도, DI가 가장 흔하게 쓰이는 패턴은 DB 연결이다.

#### DI 없는 코드

```python
class UserRepository:
    def __init__(self):
        self.database = DatabaseConnection()  # 직접 생성 - 강한 결합

    def get_users(self):
        return self.database.execute_query("SELECT * FROM users")
```

`UserRepository()`를 만들면 항상 실제 DB에 연결된다. 테스트할 방법이 없다.

#### DI 적용 코드

```python
class UserRepository:
    def __init__(self, database_connection):
        self.database = database_connection  # 외부에서 주입

    def get_users(self):
        return self.database.execute_query("SELECT * FROM users")

# 프로덕션
repository = UserRepository(DatabaseConnection())

# 테스트 - Mock으로 교체
test_repo = UserRepository(MockDatabase())
```

같은 클래스를 실제 DB로도, Mock으로도 사용할 수 있다.

---

### 6. Python에서의 DI 구현 방법

Python에서 DI를 구현하는 방법은 크게 세 가지다.

#### 4-1. Constructor Injection (생성자 주입)

가장 일반적이고 권장되는 방식이다. 객체 생성 시점에 의존성을 넘긴다.

```python
class UserRepository:
    def __init__(self, database_connection):
        self.database = database_connection

    def get_users(self):
        return self.database.execute_query("SELECT * FROM users")
```

- 의존성이 명확하게 드러난다
- 불변 상태를 유지하기 좋다
- 대부분의 경우 이 방식이면 충분하다

#### 4-2. Setter Injection (세터 주입)

객체 생성 후에 의존성을 설정한다.

```python
class UserRepository:
    def __init__(self):
        self.database = None

    def set_database(self, database_connection):
        self.database = database_connection

    def get_users(self):
        return self.database.execute_query("SELECT * FROM users")
```

- 선택적 의존성에 적합하다
- 의존성이 설정되기 전에 호출되면 에러가 날 수 있다

#### 4-3. Method Injection (메서드 주입)

메서드 호출 시마다 의존성을 넘긴다.

```python
class UserRepository:
    def get_users(self, database_connection):
        return database_connection.execute_query("SELECT * FROM users")
```

- 호출마다 다른 의존성을 넘길 수 있다
- 매번 넘겨야 하므로 반복적이다

---

### 7. Python Protocol과 DI

[[Python typing|Python의 typing]] 모듈에서 제공하는 `Protocol`을 활용하면 DI를 더 안전하게 쓸 수 있다. Java의 인터페이스와 비슷한 역할이다.

```python
from typing import Protocol


class Database(Protocol):
    def execute_query(self, query: str) -> list[str]: ...


class PostgresDB:
    def execute_query(self, query: str) -> list[str]:
        # 실제 Postgres 쿼리 실행
        return ["user1", "user2"]


class MockDB:
    def execute_query(self, query: str) -> list[str]:
        return ["mock_user"]


class UserRepository:
    def __init__(self, database: Database):
        self.database = database

    def get_users(self) -> list[str]:
        return self.database.execute_query("SELECT * FROM users")
```

`Database` Protocol을 만족하는 객체라면 어떤 것이든 주입할 수 있다. 별도의 상속 없이 구조만 맞으면 된다(structural subtyping).

---

### 8. dependency-injector 라이브러리

프로젝트 규모가 커지면 의존성 연결을 수동으로 관리하기 어려워진다. `dependency-injector` 라이브러리는 이를 컨테이너로 선언적으로 관리한다.

```bash
pip install dependency-injector
```

```python
from dependency_injector import containers, providers


class Container(containers.DeclarativeContainer):
    # Singleton: 앱 전체에서 하나만 생성
    database = providers.Singleton(PostgresDB)

    # Factory: 호출할 때마다 새로 생성
    user_repository = providers.Factory(
        UserRepository,
        database=database,
    )

    user_service = providers.Factory(
        UserService,
        user_repository=user_repository,
    )


# 프로덕션
container = Container()
service = container.user_service()

# 테스트 - override로 Mock 교체
container.database.override(providers.Singleton(MockDB))
test_service = container.user_service()
```

> [!info]+ Provider 종류
> - `Singleton` - 한 번 생성 후 재사용 (DB 연결 등)
> - `Factory` - 매번 새 인스턴스 생성
> - `Configuration` - 설정값 관리

---

### 9. 테스트에서의 DI 활용

DI의 가장 큰 실용적 이점은 테스트다.

```python
import pytest


class FakeUserRepository:
    def __init__(self):
        self.users = ["alice", "bob"]

    def get_users(self):
        return self.users


def test_get_all_users():
    fake_repo = FakeUserRepository()
    service = UserService(fake_repo)

    result = service.get_all_users()

    assert result == ["alice", "bob"]
```

- 실제 DB 없이 빠르게 테스트할 수 있다
- 테스트 대상 클래스만 격리해서 검증할 수 있다
- 외부 서비스 장애와 무관하게 테스트가 안정적이다

---

### 10. 정리

| 항목     | DI 없음           | DI 적용           |
| ------ | --------------- | --------------- |
| 결합도    | 높음 (구현에 직접 의존)  | 낮음 (추상에 의존)     |
| 테스트    | 어려움 (실제 의존성 필요) | 쉬움 (Mock 주입 가능) |
| 교체 가능성 | 낮음 (코드 수정 필요)   | 높음 (주입만 변경)     |
| 복잡도    | 낮음              | 약간 증가           |

> [!note]+ 실무 팁
> - 간단한 스크립트에서는 DI가 과할 수 있다. 클래스 간 의존 관계가 생기기 시작할 때 도입하자.
> - Python은 duck typing 덕분에 Java처럼 인터페이스를 강제하지 않아도 DI가 자연스럽다.
> - `Protocol`을 쓰면 타입 힌트의 도움을 받으면서도 유연함을 유지할 수 있다.
