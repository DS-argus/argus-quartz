---
tags:
  - python
  - security
created: 2026-06-05T10:00:00
updated: 2026-06-05T10:00:00
permalink: /Dev/python/python-cryptography-2-aes-rsa-hashing
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - AES-GCM은 Fernet보다 유연한 대칭 키 암호화 방식
> - RSA는 공개 키/개인 키 쌍을 사용하는 비대칭 암호화
> - 해싱은 단방향 변환으로 비밀번호 저장 등에 사용
> - 상황별로 적절한 암호화 방식을 선택하는 것이 중요

> [!info]+ 이전 글
> [[Python cryptography 1 - Fernet]]에서 Fernet 기반 대칭 키 암호화를 다뤘다. 이 글에서는 Fernet으로 해결하기 어려운 상황에서 사용할 수 있는 저수준 API를 다룬다.

---
### 1. AES 직접 사용하기

Fernet은 내부적으로 AES-128-CBC를 사용하지만, 키 길이나 모드를 바꿀 수 없다. `cryptography`의 hazmat 레이어를 사용하면 AES를 직접 제어할 수 있다.

##### AES-GCM이란

AES-GCM(Galois/Counter Mode)은 현재 가장 널리 권장되는 대칭 키 암호화 모드다.

- **암호화 + 인증을 한번에** 처리한다 (Authenticated Encryption)
- 별도의 HMAC 계산이 필요 없다
- AES-256 등 더 긴 키를 사용할 수 있다
- 스트리밍/청크 단위 처리가 가능하다

##### 기본 사용법

```python
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# 1. 키 생성 (256비트 = 32바이트)
key = AESGCM.generate_key(bit_length=256)

# 2. nonce 생성 (12바이트 권장)
nonce = os.urandom(12)

# 3. 암호화
aesgcm = AESGCM(key)
ciphertext = aesgcm.encrypt(nonce, b"secret data", None)

# 4. 복호화
plaintext = aesgcm.decrypt(nonce, ciphertext, None)
print(plaintext)  # b'secret data'
```

> [!warning]+ nonce는 절대 재사용하면 안 된다
> 같은 키로 같은 nonce를 두 번 사용하면 암호화가 깨진다. 매 암호화마다 `os.urandom(12)`로 새로 생성하고, ciphertext와 함께 저장해야 한다.

##### AAD (Associated Authenticated Data)

`encrypt`의 세 번째 인자는 AAD다. 암호화하지는 않지만 **무결성을 검증하고 싶은 데이터**를 넣는다.

```python
# 헤더 정보는 암호화하지 않되, 변조 여부는 검증
aad = b"user_id=42"
ciphertext = aesgcm.encrypt(nonce, b"secret data", aad)

# 복호화 시 같은 AAD를 넘겨야 성공
plaintext = aesgcm.decrypt(nonce, ciphertext, aad)

# AAD가 다르면 InvalidTag 예외
aesgcm.decrypt(nonce, ciphertext, b"user_id=99")
# cryptography.exceptions.InvalidTag
```

##### Fernet vs AES-GCM 비교

| 항목          | Fernet      | AES-GCM          |
| ----------- | ----------- | ---------------- |
| 난이도         | 쉬움          | 중간               |
| 키 길이        | 128비트 고정    | 128/192/256비트 선택 |
| 모드          | CBC + HMAC  | GCM (인증 내장)      |
| nonce/IV 관리 | 자동          | 직접 관리            |
| 대용량 파일      | 부적합         | 적합               |
| 용도          | 간단한 데이터 암호화 | 세밀한 제어가 필요할 때    |

---
### 2. 비대칭 키 암호화 (RSA)

대칭 키가 같은 열쇠로 잠그고 여는 금고였다면, RSA는 **우체통**과 같다. 누구나 우편물을 넣을 수 있지만(공개 키로 암호화), 열어서 꺼내는 것은 열쇠를 가진 주인만 가능하다(개인 키로 복호화).

- 공개 키 : 누구에게나 공개. 암호화에 사용
- 개인 키 : 본인만 보유. 복호화에 사용

##### 키 쌍 생성

```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

# 개인 키 생성
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

# 공개 키 추출
public_key = private_key.public_key()
```

##### 키를 파일로 저장/불러오기

```python
# 개인 키 저장 (PEM 형식)
pem_private = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.BestAvailableEncryption(b"passphrase"),
)
Path("private.pem").write_bytes(pem_private)

# 공개 키 저장
pem_public = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo,
)
Path("public.pem").write_bytes(pem_public)

# 개인 키 불러오기
loaded_private = serialization.load_pem_private_key(
    Path("private.pem").read_bytes(),
    password=b"passphrase",
)

# 공개 키 불러오기
loaded_public = serialization.load_pem_public_key(
    Path("public.pem").read_bytes(),
)
```

##### 암호화 / 복호화

```python
# 공개 키로 암호화
ciphertext = public_key.encrypt(
    b"secret message",
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None,
    ),
)

# 개인 키로 복호화
plaintext = private_key.decrypt(
    ciphertext,
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None,
    ),
)
print(plaintext)  # b'secret message'
```

> [!note]+ RSA는 작은 데이터만 암호화할 수 있다
> RSA-2048 기준 최대 약 190바이트까지만 암호화 가능하다. 큰 데이터는 AES로 암호화하고, AES 키만 RSA로 암호화하는 하이브리드 방식을 사용한다.

##### 디지털 서명 / 검증

암호화와 반대 방향이다. **개인 키로 서명**하고 **공개 키로 검증**한다. 데이터가 변조되지 않았음을 증명할 때 사용한다. 실제로 [[SSL (Secure Sockets Layer)|TLS handshake]]에서 서버 인증에 이 방식이 쓰인다.

```python
from cryptography.hazmat.primitives.asymmetric import utils

message = b"this data must not be tampered"

# 개인 키로 서명
signature = private_key.sign(
    message,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH,
    ),
    hashes.SHA256(),
)

# 공개 키로 검증 (변조되지 않았으면 정상 통과)
public_key.verify(
    signature,
    message,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH,
    ),
    hashes.SHA256(),
)
# 예외가 발생하지 않으면 검증 성공

# 메시지가 변조된 경우
public_key.verify(signature, b"tampered data", ...)
# cryptography.exceptions.InvalidSignature
```

---
### 3. 해싱

해싱은 암호화와 다르다. **단방향 변환**이기 때문에 해시 값에서 원본 데이터를 복원할 수 없다.

| 구분 | 암호화 | 해싱 |
|---|---|---|
| 방향 | 양방향 (암호화 ↔ 복호화) | 단방향 (원본 → 해시) |
| 키 | 필요 | 불필요 |
| 용도 | 데이터 보호 | 무결성 검증, 비밀번호 저장 |

##### 데이터 해싱 (SHA-256)

파일이나 메시지의 무결성을 검증할 때 사용한다.

```python
from cryptography.hazmat.primitives import hashes

digest = hashes.Hash(hashes.SHA256())
digest.update(b"hello ")
digest.update(b"world")
result = digest.finalize()

print(result.hex())
# 정해진 길이의 해시 값 출력 (64자 hex)
```

##### 비밀번호 해싱과 데이터 해싱은 다르다

> [!warning]+ SHA-256으로 비밀번호를 저장하면 안 된다
> SHA-256은 속도가 빠르기 때문에 무차별 대입 공격(brute-force)에 취약하다. 비밀번호 해싱에는 **의도적으로 느린** 알고리즘을 사용해야 한다.

비밀번호 해싱에는 `bcrypt`를 사용한다.

```bash
pip install bcrypt
```

```python
import bcrypt

password = b"my_secure_password"

# 해싱 (salt 자동 생성)
hashed = bcrypt.hashpw(password, bcrypt.gensalt())
print(hashed)
# b'$2b$12$...'

# 검증
if bcrypt.checkpw(password, hashed):
    print("비밀번호 일치")
else:
    print("비밀번호 불일치")
```

| 알고리즘 | 용도 | 속도 |
|---|---|---|
| SHA-256 | 파일 무결성, 데이터 지문 | 빠름 |
| bcrypt | 비밀번호 저장 | 의도적으로 느림 |
| scrypt | 비밀번호 저장 (메모리 집약적) | 느림 |
| argon2 | 비밀번호 저장 (최신 권장) | 느림 |

---
### 4. 실전 선택 가이드

상황에 따라 어떤 암호화 방식을 선택해야 하는지 정리한다.

| 상황 | 추천 방식 | 이유 |
|---|---|---|
| API 키/토큰 저장 | Fernet | 간단하고 충분히 안전 |
| 설정 파일 암호화 | Fernet | 단일 키로 간편하게 관리 |
| 대용량 파일 암호화 | AES-GCM | 스트리밍 처리, 성능 우수 |
| 서버 간 데이터 전송 | AES-GCM + RSA (하이브리드) | 키 교환 문제 해결 |
| 비밀번호 저장 | bcrypt / argon2 | 복호화가 필요 없고 느려야 안전 |
| 파일 무결성 검증 | SHA-256 | 빠르고 충돌 저항성 높음 |
| 데이터 서명/인증 | RSA 서명 | 변조 방지 + 발신자 증명 |

> [!tip]+ 판단 기준
> - 복호화가 필요한가? → 필요 없으면 해싱
> - 키를 상대방에게 전달해야 하는가? → 전달해야 하면 RSA 또는 하이브리드
> - 데이터 크기가 큰가? → 크면 AES-GCM
> - 간단하게 끝내고 싶은가? → Fernet

---
### 5. 흔한 실수와 보안 주의사항

##### 키를 코드에 하드코딩

```python
# 절대 하면 안 되는 패턴
key = b"ZmDfcTF7_60GrrY4vBGJSVgmYR0yGH8rrOamiLkI6mA="
```

키가 git 히스토리에 남으면 삭제해도 이미 유출된 것이다. 환경변수나 시크릿 매니저를 사용해야 한다.

##### ECB 모드 사용

ECB(Electronic Codebook)는 같은 평문 블록이 항상 같은 암호문을 생성한다. 패턴이 그대로 드러나기 때문에 사용하면 안 된다. GCM이나 CBC를 사용해야 한다.

##### nonce/IV 재사용

AES-GCM에서 같은 키로 같은 nonce를 두 번 사용하면 암호화가 완전히 깨진다. 매번 `os.urandom()`으로 생성해야 한다.

##### 자체 암호화 알고리즘 구현

검증된 라이브러리를 사용해야 한다. 직접 만든 암호화는 거의 확실하게 취약점이 있다.

##### SHA-256으로 비밀번호 해싱

위에서 다뤘듯이 SHA-256은 빠르기 때문에 비밀번호 해싱에 부적합하다. bcrypt, scrypt, argon2를 사용해야 한다.

> [!tip]+ 핵심 원칙
> - 직접 만들지 말고 검증된 라이브러리를 사용한다
> - 키는 코드와 분리한다
> - nonce/IV는 매번 새로 생성한다
> - 비밀번호는 해싱, 데이터는 암호화로 구분한다
