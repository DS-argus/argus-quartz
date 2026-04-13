---
tags:
  - python
created: 2026-04-12T00:00:00
updated: 2026-04-12T00:00:00
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - 직렬화(Serialization)는 메모리에 있는 객체를 저장하거나 전송할 수 있는 형태로 변환하는 것
> - JSON은 사람이 읽을 수 있고 언어 간 호환이 되는 텍스트 포맷, pickle은 Python 전용 바이너리 포맷
> - 외부 시스템과 통신하면 JSON, Python 내부 저장이면 pickle, 대규모 데이터 파이프라인이면 Avro/Protobuf

> [!info]+ Sources
> - [Python 공식 문서 — json](https://docs.python.org/3/library/json.html)
> - [Python 공식 문서 — pickle](https://docs.python.org/3/library/pickle.html)
> - [Python 공식 문서 — struct](https://docs.python.org/3/library/struct.html)

---
### 1. 직렬화란

##### 왜 필요한가

Python에서 객체를 만들면 메모리에 존재한다. 그런데 이 객체를 파일에 저장하거나, 네트워크로 보내거나, 다른 프로세스에 전달하려면 **메모리 바깥으로 꺼내야** 한다. 문제는 메모리 속 객체는 포인터, 참조, 내부 구조가 뒤섞여 있어서 그 상태 그대로는 저장하거나 전송할 수 없다는 것이다.

**직렬화(Serialization)** 는 이 메모리 속 객체를 **연속된 바이트 또는 문자열**로 변환하는 과정이다. 반대로 바이트/문자열에서 객체를 복원하는 것을 **역직렬화(Deserialization)** 라고 한다.

```
메모리 속 객체 → [직렬화] → 바이트/문자열 → [역직렬화] → 메모리 속 객체
```

> [!tip]+ 직렬화의 다른 이름들
> 같은 개념을 문맥에 따라 다르게 부른다.
> - **Serialization / Deserialization** — 가장 일반적인 표현
> - **Marshalling / Unmarshalling** — RPC, 네트워크 통신에서 주로 사용
> - **Pickling / Unpickling** — Python 고유 표현
> - **Encoding / Decoding** — JSON 등 텍스트 포맷에서 주로 사용

##### 직렬화가 없으면 어떻게 되나

```python
user = {"name": "alice", "age": 30, "scores": [95, 87, 92]}

# 파일에 저장하고 싶다면?
with open("user.txt", "w") as f:
    f.write(str(user))  # "{'name': 'alice', 'age': 30, 'scores': [95, 87, 92]}"

# 다시 읽으면?
with open("user.txt", "r") as f:
    data = f.read()
    print(type(data))  # <class 'str'> — dict가 아니라 문자열이다
    # eval(data)로 복원할 수는 있지만 보안상 절대 하면 안 된다
```

`str()`로 변환하면 형태만 비슷할 뿐 타입 정보가 사라진다. 직렬화는 이 문제를 **타입과 구조를 보존하면서** 해결한다.

---
### 2. 직렬화가 쓰이는 곳

직렬화는 데이터가 메모리 바깥으로 나가는 거의 모든 곳에서 쓰인다.

| 상황 | 직렬화 대상 | 주로 쓰는 포맷 |
|------|------------|---------------|
| REST API 요청/응답 | dict, 리스트 → HTTP body | JSON |
| 파일 저장 (설정, 상태) | 객체 → 파일 | JSON, YAML, pickle |
| 메시지 큐 (Kafka, RabbitMQ) | 메시지 객체 → 바이트 | JSON, Avro, Protobuf |
| 캐시 (Redis, Memcached) | 객체 → 바이트 | pickle, JSON, msgpack |
| DB 저장 (BLOB, JSON 컬럼) | 객체 → 바이트/문자열 | JSON, pickle |
| RPC (gRPC, Thrift) | 함수 인자/반환값 → 바이트 | Protobuf, Thrift |
| 프로세스 간 통신 (IPC) | 객체 → 바이트 | pickle |
| ML 모델 저장 | 학습된 모델 → 파일 | pickle, joblib, ONNX |

> [!note]+ DE 관점에서의 직렬화
> 데이터 파이프라인에서는 직렬화 포맷 선택이 성능과 호환성에 직결된다. Kafka에 JSON으로 메시지를 넣으면 사람이 읽기 쉽지만 느리고 크다. Avro나 Protobuf를 쓰면 스키마가 강제되고 바이너리라 빠르지만 디버깅이 어렵다.

---
### 3. 직렬화 포맷 비교

##### 텍스트 포맷

| 포맷 | 특징 | 장점 | 단점 |
|------|------|------|------|
| **JSON** | key-value 구조, 웹 표준 | 사람이 읽기 쉬움, 언어 간 호환 | 바이너리 데이터 불가, 느림 |
| **XML** | 태그 기반, 엔터프라이즈 | 스키마 검증(XSD), 네임스페이스 | 장황함, 파싱 느림 |
| **YAML** | 들여쓰기 기반 | 가독성 최고, 설정 파일에 적합 | 파싱 느림, 스펙이 복잡 |
| **CSV** | 행/열 구조 | 단순, 스프레드시트 호환 | 중첩 구조 불가, 타입 정보 없음 |

##### 바이너리 포맷

| 포맷 | 특징 | 장점 | 단점 |
|------|------|------|------|
| **pickle** | Python 전용 | Python 객체 거의 전부 지원 | Python에서만 사용 가능, 보안 취약 |
| **Protobuf** | Google, 스키마 필수 (.proto) | 빠름, 언어 간 호환, 타입 안전 | 스키마 정의 필요, 사람이 읽기 불가 |
| **Avro** | Apache, 스키마 내장 | 스키마 진화 지원, Hadoop 생태계 | Java 중심 생태계 |
| **MessagePack** | JSON과 유사한 구조 | JSON보다 빠르고 작음 | 스키마 없음 |

> [!tip]+ 선택 기준
> - **사람이 읽어야 한다** → JSON, YAML
> - **Python 내부에서만 쓴다** → pickle
> - **언어 간 호환 + 성능** → Protobuf, MessagePack
> - **대규모 데이터 파이프라인** → Avro, Protobuf

---
### 4. Python json 모듈

JSON은 가장 널리 쓰이는 텍스트 직렬화 포맷이다. Python의 `json` 모듈은 표준 라이브러리에 포함되어 있다.

##### 기본 사용법

```python
import json

# 직렬화 (Python → JSON 문자열)
data = {"name": "alice", "age": 30, "scores": [95, 87, 92]}
json_str = json.dumps(data)
print(json_str)  # {"name": "alice", "age": 30, "scores": [95, 87, 92]}

# 역직렬화 (JSON 문자열 → Python)
restored = json.loads(json_str)
print(restored["name"])  # alice
print(type(restored))    # <class 'dict'>
```

##### 파일 입출력

```python
# 파일에 저장
with open("data.json", "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# 파일에서 읽기
with open("data.json", "r") as f:
    loaded = json.load(f)
```

`dump`/`load`는 파일 객체를 받고, `dumps`/`loads`는 문자열을 다룬다. **s**는 string의 약자다.

##### Python ↔ JSON 타입 변환 규칙

| Python | JSON | 비고 |
|--------|------|------|
| `dict` | `object` | |
| `list`, `tuple` | `array` | tuple은 list로 변환됨 (복원 시 구분 불가) |
| `str` | `string` | |
| `int`, `float` | `number` | |
| `True` / `False` | `true` / `false` | |
| `None` | `null` | |

이 외의 타입(`datetime`, `set`, 커스텀 클래스 등)은 **기본적으로 직렬화할 수 없다**.

```python
from datetime import datetime

json.dumps({"now": datetime.now()})
# TypeError: Object of type datetime is not JSON serializable
```

##### 커스텀 객체 직렬화 — default 파라미터

`default` 파라미터에 변환 함수를 넘기면 기본 지원하지 않는 타입도 직렬화할 수 있다.

```python
from datetime import datetime, date

def json_default(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, set):
        return list(obj)
    raise TypeError(f"직렬화 불가: {type(obj)}")

data = {
    "created": datetime(2026, 4, 12, 15, 30),
    "tags": {"python", "serialization"},
}

json_str = json.dumps(data, default=json_default, ensure_ascii=False)
print(json_str)
# {"created": "2026-04-12T15:30:00", "tags": ["python", "serialization"]}
```

##### 커스텀 역직렬화 — object_hook

JSON을 읽을 때 dict를 원하는 객체로 자동 변환할 수 있다.

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int

def as_user(dct):
    if "name" in dct and "age" in dct:
        return User(**dct)
    return dct

json_str = '{"name": "alice", "age": 30}'
user = json.loads(json_str, object_hook=as_user)
print(user)        # User(name='alice', age=30)
print(type(user))  # <class 'User'>
```

##### pretty-print 옵션

```python
data = {"users": [{"name": "alice", "age": 30}, {"name": "bob", "age": 25}]}

# 기본 — 한 줄
json.dumps(data)

# indent로 보기 좋게
print(json.dumps(data, indent=2, ensure_ascii=False))
# {
#   "users": [
#     {
#       "name": "alice",
#       "age": 30
#     },
#     ...
#   ]
# }

# separators로 공백 제거 (전송 시 크기 절약)
json.dumps(data, separators=(",", ":"))
# {"users":[{"name":"alice","age":30},{"name":"bob","age":25}]}
```

---
### 5. Python pickle 모듈

pickle은 Python 전용 바이너리 직렬화 포맷이다. JSON과 달리 **Python 객체를 거의 그대로** 저장하고 복원할 수 있다.

##### 기본 사용법

```python
import pickle

data = {"name": "alice", "scores": [95, 87, 92], "active": True}

# 직렬화 (Python → 바이트)
pickled = pickle.dumps(data)
print(type(pickled))  # <class 'bytes'>

# 역직렬화 (바이트 → Python)
restored = pickle.loads(pickled)
print(restored)  # {'name': 'alice', 'scores': [95, 87, 92], 'active': True}
```

##### 파일 입출력

```python
# 파일에 저장 (바이너리 모드)
with open("data.pkl", "wb") as f:
    pickle.dump(data, f)

# 파일에서 읽기
with open("data.pkl", "rb") as f:
    loaded = pickle.load(f)
```

##### pickle이 JSON보다 강력한 점

pickle은 Python 객체의 타입과 구조를 그대로 보존한다.

```python
from datetime import datetime
from collections import defaultdict
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int

data = {
    "user": User("alice", 30),
    "created": datetime(2026, 4, 12),
    "counter": defaultdict(int, {"a": 1, "b": 2}),
    "numbers": {1, 2, 3},
}

# pickle은 이 모든 것을 그대로 직렬화/역직렬화할 수 있다
pickled = pickle.dumps(data)
restored = pickle.loads(pickled)

print(type(restored["user"]))     # <class 'User'> — dataclass 그대로
print(type(restored["created"]))  # <class 'datetime.datetime'>
print(type(restored["counter"]))  # <class 'collections.defaultdict'>
print(type(restored["numbers"]))  # <class 'set'>
```

JSON이었다면 `User`는 dict로, `datetime`은 에러로, `set`은 list로 변환됐을 것이다.

##### 직렬화 가능한/불가능한 것

```python
# ✅ 직렬화 가능
pickle.dumps(42)                        # 숫자
pickle.dumps("hello")                   # 문자열
pickle.dumps([1, 2, 3])                 # 리스트
pickle.dumps({"key": "value"})          # 딕셔너리
pickle.dumps(User("alice", 30))         # 클래스 인스턴스
pickle.dumps(len)                       # 내장 함수

# ❌ 직렬화 불가능
pickle.dumps(lambda x: x + 1)          # TypeError — 람다
pickle.dumps(open("test.txt"))          # TypeError — 파일 객체

# ⚠️ 주의: 함수/클래스는 "이름"으로 저장된다
# 역직렬화할 때 해당 모듈에서 import 가능해야 한다
```

##### 보안 주의사항

> [!warning]+ pickle은 신뢰할 수 없는 데이터에 사용하면 안 된다
> pickle은 역직렬화 과정에서 **임의 코드를 실행**할 수 있다. 악의적으로 조작된 pickle 데이터를 `loads()`하면 시스템 명령이 실행될 수 있다.
>
> ```python
> # 이런 공격이 가능하다 (실행하지 말 것)
> import pickle
> malicious = b"cos\nsystem\n(S'rm -rf /'\ntR."
> pickle.loads(malicious)  # os.system('rm -rf /') 실행
> ```
>
> - 외부에서 받은 데이터는 **절대** pickle로 역직렬화하지 않는다
> - API 통신, 사용자 입력 등에는 JSON을 사용한다
> - pickle은 **내가 만든 데이터를 내가 쓰는 경우**에만 안전하다

##### 프로토콜 버전

pickle에는 여러 프로토콜 버전이 있다. 버전이 높을수록 효율적이다.

```python
# 최신 프로토콜 사용 (권장)
pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)

# 기본 프로토콜 확인
print(pickle.DEFAULT_PROTOCOL)  # 5 (Python 3.14 기준)
```

| 버전 | Python | 특징 |
|------|--------|------|
| 0 | 2.x | 텍스트 모드, 디버깅용 |
| 2 | 2.3+ | new-style 클래스 지원 |
| 4 | 3.4+ | 대용량 객체 지원 |
| 5 | 3.8+ | out-of-band 버퍼, 현재 기본값 |

---
### 6. 바이너리 직렬화 — Avro, Protobuf

JSON이나 pickle과 달리, Avro와 Protobuf는 **스키마를 먼저 정의**하고 그 스키마에 맞춰 직렬화한다. 데이터 파이프라인에서 메시지 포맷을 강제하고 싶을 때 사용한다.

##### Avro

Apache Avro는 Hadoop 생태계에서 탄생한 직렬화 포맷이다. **스키마가 데이터 파일에 내장**되어서 별도 코드 생성 없이 읽고 쓸 수 있다.

```bash
pip install avro
```

스키마를 JSON으로 정의한다. (`user.avsc`)

```json
{
  "namespace": "example.avro",
  "type": "record",
  "name": "User",
  "fields": [
    {"name": "name", "type": "string"},
    {"name": "age", "type": "int"},
    {"name": "email", "type": ["string", "null"]}
  ]
}
```

```python
import avro.schema
from avro.datafile import DataFileWriter, DataFileReader
from avro.io import DatumWriter, DatumReader

# 스키마 로드
schema = avro.schema.parse(open("user.avsc", "rb").read())

# 직렬화 — Avro 파일에 쓰기
writer = DataFileWriter(open("users.avro", "wb"), DatumWriter(), schema)
writer.append({"name": "alice", "age": 30, "email": "alice@example.com"})
writer.append({"name": "bob", "age": 25, "email": None})
writer.close()

# 역직렬화 — Avro 파일에서 읽기
# DatumReader()에 스키마를 넘기지 않아도 된다 — 파일 헤더에 스키마가 들어있기 때문
reader = DataFileReader(open("users.avro", "rb"), DatumReader())
for user in reader:
    print(user)
# {'name': 'alice', 'age': 30, 'email': 'alice@example.com'}
# {'name': 'bob', 'age': 25, 'email': None}
reader.close()
```

> [!note]+ Avro는 스키마를 파일에 내장한다
> Avro 파일(`.avro`)의 구조는 이렇게 생겼다:
> ```
> [파일 헤더: 스키마(JSON) + 메타데이터]
> [데이터 블록 1]
> [데이터 블록 2]
> ...
> ```
> **쓸 때** 스키마를 지정하면, 그 스키마가 파일 헤더에 함께 저장된다. 그래서 **읽을 때**는 파일만 있으면 스키마를 꺼내서 역직렬화할 수 있다. 별도의 스키마 파일(`.avsc`)이나 생성된 코드 없이도 누구든 `.avro` 파일만으로 데이터를 읽을 수 있다는 뜻이다.
>
> Protobuf는 반대다. 바이너리에 스키마가 없어서, 읽는 쪽도 `.proto`로 생성한 코드(`user_pb2.py`)를 갖고 있어야 역직렬화할 수 있다.

> [!tip]+ Avro의 기타 특징
> - 스키마 진화(evolution)를 지원한다 — 필드 추가/삭제 시 호환성 유지 가능
> - Kafka + Schema Registry 조합에서 메시지 포맷으로 많이 사용된다

##### Protobuf (Protocol Buffers)

Google이 만든 직렬화 포맷이다. `.proto` 파일로 스키마를 정의하고, **컴파일러(protoc)로 Python 코드를 생성**해서 사용한다.

```bash
pip install protobuf
# protoc 컴파일러도 별도 설치 필요 (https://protobuf.dev)
```

스키마를 `.proto` 파일로 정의한다. (`user.proto`)

```protobuf
syntax = "proto3";

message User {
  string name = 1;
  int32 age = 2;
  string email = 3;
}
```

Python 코드 생성:

```bash
protoc --python_out=. user.proto
# user_pb2.py 파일이 생성된다
```

```python
import user_pb2

# 직렬화
user = user_pb2.User()
user.name = "alice"
user.age = 30
user.email = "alice@example.com"

binary = user.SerializeToString()  # bytes
print(len(binary))  # ~30 bytes (JSON이면 ~60 bytes)

# 역직렬화
restored = user_pb2.User()
restored.ParseFromString(binary)
print(restored.name)   # alice
print(restored.age)    # 30
```

JSON 변환도 가능하다:

```python
from google.protobuf import json_format

# Protobuf → JSON
json_str = json_format.MessageToJson(user)
print(json_str)  # {"name": "alice", "age": 30, "email": "alice@example.com"}

# JSON → Protobuf
user2 = user_pb2.User()
json_format.Parse(json_str, user2)
```

> [!note]+ Protobuf의 특징
> - `.proto` → `protoc` → Python 코드 생성 과정이 필요하다 (Avro와의 핵심 차이)
> - 바이너리 크기가 JSON 대비 절반 이하로 작고, 직렬화/역직렬화 속도가 빠르다
> - gRPC의 기본 직렬화 포맷이다

##### Avro vs Protobuf

| 기준 | Avro | Protobuf |
|------|------|----------|
| 스키마 위치 | 데이터 파일에 내장 | `.proto` 파일 별도 관리 |
| 코드 생성 | 불필요 (동적 처리) | **필수** (`protoc` 컴파일) |
| 스키마 진화 | 기본 지원 (reader/writer schema 분리) | 지원 (필드 번호 기반) |
| 주 사용처 | Kafka, Hadoop, 데이터 파이프라인 | gRPC, 마이크로서비스 통신 |
| 생태계 | Java/Hadoop 중심 | 언어 중립적, Google 생태계 |

---
### 7. dataclass + 직렬화

[[Python dataclass|dataclass]]와 직렬화는 자주 함께 쓰인다. 구조화된 데이터를 JSON으로 변환하거나, API 응답을 dataclass로 매핑하는 패턴이 일반적이다.

##### dataclass → JSON (asdict 활용)

```python
from dataclasses import dataclass, asdict
import json

@dataclass
class Address:
    city: str
    zipcode: str

@dataclass
class User:
    name: str
    age: int
    address: Address

user = User("alice", 30, Address("서울", "06000"))

# asdict()로 dict 변환 후 json.dumps()
json_str = json.dumps(asdict(user), ensure_ascii=False, indent=2)
print(json_str)
# {
#   "name": "alice",
#   "age": 30,
#   "address": {
#     "city": "서울",
#     "zipcode": "06000"
#   }
# }
```

중첩된 dataclass도 `asdict()`가 재귀적으로 dict 변환해주므로 그대로 `json.dumps()`에 넣으면 된다.

##### JSON → dataclass

역방향은 자동 변환이 없어서 직접 매핑해야 한다.

```python
# 방법 1: 단순한 경우 — dict unpacking
json_str = '{"name": "alice", "age": 30}'
data = json.loads(json_str)
user = User(**data, address=Address("서울", "06000"))
```

```python
# 방법 2: 중첩 구조 — object_hook 활용
def from_json(json_str: str) -> User:
    data = json.loads(json_str)
    data["address"] = Address(**data["address"])
    return User(**data)

json_str = '{"name": "alice", "age": 30, "address": {"city": "서울", "zipcode": "06000"}}'
user = from_json(json_str)
print(user)  # User(name='alice', age=30, address=Address(city='서울', zipcode='06000'))
```

##### datetime이 포함된 dataclass

```python
from dataclasses import dataclass, field, asdict
from datetime import datetime
import json

@dataclass
class Event:
    title: str
    start: datetime
    end: datetime
    attendees: list[str] = field(default_factory=list)

def json_default(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"직렬화 불가: {type(obj)}")

event = Event(
    title="스프린트 리뷰",
    start=datetime(2026, 4, 12, 14, 0),
    end=datetime(2026, 4, 12, 15, 0),
    attendees=["alice", "bob"],
)

json_str = json.dumps(asdict(event), default=json_default, ensure_ascii=False, indent=2)
print(json_str)
# {
#   "title": "스프린트 리뷰",
#   "start": "2026-04-12T14:00:00",
#   "end": "2026-04-12T15:00:00",
#   "attendees": ["alice", "bob"]
# }
```

##### dataclass + pickle

pickle은 dataclass를 별도 변환 없이 바로 직렬화할 수 있다.

```python
import pickle

pickled = pickle.dumps(user)
restored = pickle.loads(pickled)
print(restored)         # User(name='alice', age=30, address=Address(city='서울', zipcode='06000'))
print(type(restored))   # <class 'User'>
print(restored == user) # True
```

JSON과 달리 타입이 그대로 보존되므로 변환 코드가 필요 없다. 다만 pickle의 보안 주의사항은 그대로 적용된다.

---
### 8. 언제 뭘 쓸까

| 기준 | JSON | pickle | Protobuf / Avro |
|------|------|--------|-----------------|
| 사람이 읽을 수 있는가 | O | X | X |
| 언어 간 호환 | O | **X (Python 전용)** | O |
| Python 객체 그대로 보존 | X (타입 손실) | **O** | X (스키마 변환 필요) |
| 보안 | 안전 | **위험 (임의 코드 실행)** | 안전 |
| 속도 | 보통 | 빠름 | 매우 빠름 |
| 크기 | 큼 (텍스트) | 중간 | 작음 (바이너리) |
| 스키마 강제 | X | X | **O** |

##### 판단 흐름

```
외부 시스템과 통신하는가?
├── Yes → JSON (REST API, 웹)
│         Protobuf (gRPC, 고성능)
│         Avro (Kafka, 데이터 파이프라인)
└── No → Python 내부에서만 쓰는가?
          ├── Yes → pickle (모델 저장, 캐시, IPC)
          └── 설정 파일 → YAML, JSON
```

> [!note]+ 실무 조합 예시
> - **웹 API** — 요청/응답은 JSON, 내부 캐시는 pickle
> - **데이터 파이프라인** — Kafka 메시지는 Avro, 중간 결과 캐시는 pickle
> - **ML 서빙** — 모델 저장은 pickle/joblib, API 응답은 JSON
