---
tags:
  - python
  - security
created: 2026-06-05T10:00:00
updated: 2026-06-05T10:00:00
permalink: /Dev/python/python-cryptography-1-fernet
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - `cryptography`는 Python 대표 암호화 라이브러리
> - `Fernet`은 대칭 키 기반의 간편한 암호화 도구
> - 키 생성 → 암호화 → 복호화 3단계로 동작
> - 키 관리(환경변수, 파일 분리)가 보안의 핵심
> - 대용량 데이터나 세밀한 제어가 필요하면 AES-GCM 등 저수준 API 사용

---
### 1. cryptography 라이브러리란

Python에서 암호화를 다룰 때 가장 많이 사용되는 라이브러리다. 해싱, 대칭/비대칭 암호화, 인증서 처리 등 암호화 관련 기능을 폭넓게 제공한다. 웹 통신에서 이런 암호화가 어떻게 쓰이는지는 [[SSL (Secure Sockets Layer)|SSL/TLS]] 참고.

```bash
pip install cryptography

# uv 사용 시
uv add cryptography
```

`cryptography`는 크게 두 가지 레이어로 나뉜다.

- **High-level (Fernet 등)** : 복잡한 설정 없이 바로 사용할 수 있는 API
- **Low-level (hazmat)** : AES, RSA 등 암호화 알고리즘을 직접 다루는 API. 이름 그대로 위험할 수 있어서 암호화에 대한 이해가 필요하다

이 글에서는 High-level API인 Fernet을 다룬다.

---
### 2. 대칭 키 암호화란

> [!tip]+ 기존 노트 참고
> 대칭 키와 공개 키 암호화의 개념은 [[17. 안전성을 위한 기술]] 에서도 다루고 있다

암호화와 복호화에 **같은 키**를 사용하는 방식이다.

##### 비유로 이해하기

자물쇠가 달린 금고를 떠올려 보자.

1. A가 금고에 비밀 문서를 넣고 **열쇠**로 잠근다
2. 잠긴 금고를 B에게 보낸다
3. B는 **같은 열쇠**로 금고를 열어 문서를 꺼낸다

여기서 핵심은 A와 B가 **똑같은 열쇠를 가지고 있어야 한다**는 것이다. 열쇠가 하나뿐이고, 이 열쇠가 잠그는 것과 여는 것 모두에 사용된다. 이것이 "대칭"이라는 이름의 이유다.

반면 비대칭 키 암호화는 **우체통**과 비슷하다. 누구나 우편물을 넣을 수 있지만(공개 키로 암호화), 우체통을 열어서 꺼내는 것은 열쇠를 가진 주인만 가능하다(개인 키로 복호화).

##### 대칭 키의 특징

| 장점            | 단점                   |
| ------------- | -------------------- |
| 속도가 빠르다       | 키를 안전하게 전달하기 어렵다     |
| 구현이 단순하다      | 키가 유출되면 모든 데이터가 노출된다 |
| 대용량 데이터에 적합하다 | 통신 상대마다 별도의 키가 필요하다  |

> [!note]+ 실무에서는
> 대칭 키 암호화는 주로 **데이터 자체를 암호화**할 때 사용한다. 상대방에게 키를 전달해야 하는 상황이라면 비대칭 키로 대칭 키를 암호화해서 보내는 하이브리드 방식을 쓴다.

---
### 3. Fernet 사용법

Fernet은 `cryptography`가 제공하는 대칭 키 암호화 도구다. 내부적으로 **AES-128-CBC + HMAC-SHA256**을 사용해서 암호화와 무결성 검증을 동시에 처리한다.

##### 기본 흐름

```python
from cryptography.fernet import Fernet

# 1. 키 생성
key = Fernet.generate_key()
print(key)
# b'ZmDfcTF7_60GrrY4vBGJSVgmYR0yGH8rrOamiLkI6mA='
# URL-safe base64로 인코딩된 32바이트 키

# 2. Fernet 객체 생성
f = Fernet(key)

# 3. 암호화
token = f.encrypt(b"hello world")
print(token)
# b'gAAAAABm...'  암호화된 토큰

# 4. 복호화
plain = f.decrypt(token)
print(plain)
# b'hello world'
```

> [!info]+ encrypt/decrypt는 bytes만 받는다
> 문자열을 암호화하려면 `.encode()`로 bytes 변환이 필요하다
> ```python
> message = "비밀 메시지"
> token = f.encrypt(message.encode("utf-8"))
> plain = f.decrypt(token).decode("utf-8")
> ```

##### 잘못된 키로 복호화하면?

```python
wrong_key = Fernet.generate_key()
wrong_f = Fernet(wrong_key)

wrong_f.decrypt(token)
# cryptography.fernet.InvalidToken 예외 발생
```

키가 다르거나 토큰이 변조되었으면 `InvalidToken` 예외가 발생한다. 데이터 무결성까지 검증하기 때문에 토큰의 일부만 바꿔도 복호화에 실패한다.

##### 토큰 만료 시간 설정

Fernet 토큰에는 생성 시각이 포함되어 있어서, 복호화 시 TTL(Time To Live)을 지정할 수 있다.

```python
import time

token = f.encrypt(b"temporary data")

time.sleep(5)

# 3초 TTL 설정 — 이미 5초가 지났으므로 실패
f.decrypt(token, ttl=3)
# cryptography.fernet.InvalidToken
```

임시 토큰이나 1회성 인증 코드에 유용하다.

---
### 4. 키 관리 실무 패턴

Fernet 암호화에서 가장 중요한 것은 **알고리즘이 아니라 키 관리**다. 키를 코드에 하드코딩하는 순간 암호화의 의미가 사라진다.

##### 환경변수로 관리

```python
import os
from cryptography.fernet import Fernet

key = os.environ.get("FERNET_KEY")
if key is None:
    raise RuntimeError("FERNET_KEY 환경변수가 설정되지 않았습니다")

f = Fernet(key.encode())
```

```bash
# 키 생성 후 환경변수에 등록
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
export FERNET_KEY="생성된_키_값"
```

##### 키 파일 분리

```python
from pathlib import Path
from cryptography.fernet import Fernet

KEY_PATH = Path("secret.key")

def load_or_create_key() -> bytes:
    if KEY_PATH.exists():
        return KEY_PATH.read_bytes()

    key = Fernet.generate_key()
    KEY_PATH.write_bytes(key)
    return key

key = load_or_create_key()
f = Fernet(key)
```

> [!warning]+ 키 파일은 반드시 .gitignore에 추가
> ```gitignore
> *.key
> secret.key
> ```

##### 키 로테이션

키를 주기적으로 교체해야 할 때는 `MultiFernet`을 사용한다. 새 키로 암호화하되 이전 키로 암호화된 데이터도 복호화할 수 있다.

```python
from cryptography.fernet import Fernet, MultiFernet

old_key = Fernet(old_key_bytes)
new_key = Fernet(new_key_bytes)

# 첫 번째 키가 암호화에 사용되고, 복호화는 순서대로 시도
multi = MultiFernet([new_key, old_key])

# 새 키로 암호화
token = multi.encrypt(b"data")

# 기존 토큰도 복호화 가능
plain = multi.decrypt(old_token)

# 기존 토큰을 새 키로 재암호화
new_token = multi.rotate(old_token)
```

---
### 5. 실전 예제

##### API 키 암호화 저장

설정 파일이나 DB에 API 키를 저장할 때 평문 대신 암호화해서 저장하는 패턴이다.

```python
import json
from pathlib import Path
from cryptography.fernet import Fernet

def save_api_key(api_key: str, fernet: Fernet, path: str = "config.enc.json"):
    encrypted = fernet.encrypt(api_key.encode()).decode()
    Path(path).write_text(json.dumps({"api_key": encrypted}))

def load_api_key(fernet: Fernet, path: str = "config.enc.json") -> str:
    data = json.loads(Path(path).read_text())
    return fernet.decrypt(data["api_key"].encode()).decode()

# 사용
key = Fernet.generate_key()
f = Fernet(key)

save_api_key("sk-abc123...", f)
loaded = load_api_key(f)
print(loaded)  # sk-abc123...
```

##### 파일 암호화/복호화

```python
from pathlib import Path
from cryptography.fernet import Fernet

def encrypt_file(src: str, dst: str, fernet: Fernet):
    data = Path(src).read_bytes()
    Path(dst).write_bytes(fernet.encrypt(data))

def decrypt_file(src: str, dst: str, fernet: Fernet):
    data = Path(src).read_bytes()
    Path(dst).write_bytes(fernet.decrypt(data))

# 사용
key = Fernet.generate_key()
f = Fernet(key)

encrypt_file("secret.txt", "secret.txt.enc", f)
decrypt_file("secret.txt.enc", "secret_decrypted.txt", f)
```

> [!warning]+ 대용량 파일 주의
> Fernet은 데이터 전체를 메모리에 올려서 한번에 암호화한다. 수백 MB 이상의 파일에는 적합하지 않다. 이런 경우 AES-GCM으로 청크 단위 암호화를 사용해야 한다.

---
### 6. Fernet의 한계와 대안

Fernet은 간편하지만 모든 상황에 적합하지는 않다.

| 한계 | 설명 |
|---|---|
| AES-128 고정 | 키 길이나 알고리즘을 변경할 수 없다 |
| 메모리 제약 | 전체 데이터를 메모리에 올리므로 대용량 파일에 부적합 |
| 스트리밍 불가 | 청크 단위 암호화를 지원하지 않는다 |
| 커스터마이징 불가 | IV, 모드, 패딩 등을 직접 제어할 수 없다 |

이런 한계가 있을 때는 `cryptography`의 low-level API를 사용해서 AES-GCM, RSA 등을 직접 다뤄야 한다. 
