---
tags:
  - python
  - security
created: 2026-06-05T10:00:00
updated: 2026-06-15T10:00:00
permalink: /Dev/python/python-cryptography-2-aes-rsa-hashing
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - AES-GCM은 Fernet보다 유연한 대칭 키 암호화 방식
> - RSA는 공개 키/개인 키 쌍을 사용하는 비대칭 암호화. 소수 p, q에서 n, e, d가 결정되는 구조
> - 실무에서는 데이터는 AES로, AES 키는 RSA로 암호화하는 하이브리드 방식을 사용
> - 해싱은 단방향 변환으로 비밀번호 저장 등에 사용

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

##### RSA 키의 수학적 원리

RSA 키는 다음 값들로 구성된다. 각 값이 어떻게 결정되는지 작은 숫자 예시로 살펴보자.

```text
p, q  → 개인키를 만들 사람이 랜덤하게 고르는 큰 소수
n     → p × q 로 계산됨
φ(n)  → (p - 1) × (q - 1) 로 계산됨
e     → φ(n)과 서로소인 공개 지수. 보통 65537을 사용
d     → e × d ≡ 1 mod φ(n) 을 만족하는 모듈러 역원
```

p = 61, q = 53으로 예시를 들면 다음과 같다.

```text
n = 61 × 53 = 3233
φ(n) = 60 × 52 = 3120

e = 17 선택 (gcd(17, 3120) = 1 이므로 가능)

d = ?
  17 × d ≡ 1 mod 3120 을 만족하는 값
  17 × 2753 = 46801 = 1 + 15 × 3120
  → d = 2753

공개키 = (n=3233, e=17)
개인키 = (n=3233, d=2753)
```

| 값 | 의미 | 공개 여부 | 결정 방식 |
|---|---|---|---|
| p, q | 큰 소수 | 비밀 | 랜덤 생성 |
| n | p × q | 공개 | 계산 |
| φ(n) | (p-1)(q-1) | 비밀 | 계산 |
| e | 공개 지수 | 공개 | 조건 만족하는 값 선택 |
| d | 개인 지수 | 비밀 | e의 모듈러 역원으로 계산 |

암호화와 복호화는 이 관계를 이용한다.

```text
암호화: C = M^e mod n
복호화: M = C^d mod n
```

e × d ≡ 1 mod φ(n) 이라는 관계 덕분에 `M^(e×d) mod n = M`이 성립하고, 암호화한 것을 복호화하면 원본이 복원된다.

Python으로 직접 확인할 수 있다.

```python
import math

p, q = 61, 53
n = p * q
phi = (p - 1) * (q - 1)
e = 17

print(f"gcd(e, phi): {math.gcd(e, phi)}")  # 1

# Python 3.8+에서 모듈러 역원 계산
d = pow(e, -1, phi)
print(f"d: {d}")             # 2753
print(f"e*d mod phi: {(e * d) % phi}")  # 1

# 암호화 / 복호화
message = 65
ciphertext = pow(message, e, n)    # 2790
decrypted = pow(ciphertext, d, n)  # 65

print(f"message: {message}, ciphertext: {ciphertext}, decrypted: {decrypted}")
```

##### 공개키로 복호화할 수 없는 이유

공개키에는 `(n, e)`만 있고 `d`는 없다. `d`를 알아내려면 `φ(n)`이 필요하고, `φ(n)`을 계산하려면 `n`을 소인수분해해서 `p`, `q`를 알아야 한다.

```text
n = 3233 → 61 × 53 (작은 숫자는 쉽게 분해됨)
```

실제 RSA-2048에서는 `n`이 617자리 정도의 숫자다. 이 크기의 소인수분해는 현재 컴퓨팅 능력으로 현실적으로 불가능하다. 그래서 공개키만으로는 개인키를 알아낼 수 없다.

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
### 3. 하이브리드 암호화

##### 왜 RSA로 데이터 전체를 암호화하지 않는가

RSA는 두 가지 단점이 있다.

- **느리다** : 대칭 키 암호화보다 수백 배 느리다
- **크기 제한이 있다** : RSA-2048 + OAEP 기준 한 번에 약 190바이트까지만 암호화 가능하다

실무에서 다루는 데이터는 보통 이보다 훨씬 크다. 반면 AES 대칭 키는 16~32바이트로, RSA로 암호화하기에 충분히 작다. 그래서 실무에서는 이렇게 역할을 나눈다.

```text
큰 데이터   → AES 같은 대칭키로 암호화 (빠름)
AES 키 자체 → RSA 같은 비대칭키로 암호화 (키 전달 문제 해결)
```

이런 방식으로 사용되는 대칭 키를 **세션 키(session key)**라고 부른다.

##### 하이브리드 암호화의 전체 흐름

Alice가 Bob에게 파일을 보내는 상황을 예시로 보자.

```text
1. Bob이 공개키/개인키 쌍을 만듦
2. Bob이 공개키를 Alice에게 줌
3. Alice가 랜덤한 AES 세션 키를 생성
4. Alice가 파일을 AES 세션 키로 암호화
5. Alice가 AES 세션 키를 Bob의 공개키로 암호화
6. Alice가 [암호화된 파일 + 암호화된 세션 키]를 Bob에게 전송
7. Bob이 자신의 개인키로 AES 세션 키를 복호화
8. Bob이 AES 세션 키로 파일을 복호화
```

중간에 공격자 Eve가 전송 데이터를 가로채도 Bob의 개인키가 없으면 AES 세션 키를 복호화할 수 없다. AES 키를 모르면 파일도 복호화할 수 없다. 그래서 안전하다.

> [!note]+ 공개키의 진위 확인
> Alice가 받은 공개키가 진짜 Bob의 것인지 어떻게 알까? 공격자 Eve가 자신의 공개키를 Bob의 것이라고 속이면 Eve가 데이터를 읽을 수 있다. 이 문제를 해결하기 위해 인증서와 CA를 사용한다. HTTPS가 바로 이 구조다. 자세한 내용은 [[17. 안전성을 위한 기술]] 참고.

##### Python 구현

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
import os
import base64
import json


def b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


def b64decode(data: str) -> bytes:
    return base64.b64decode(data.encode("utf-8"))


# 1. Bob: RSA 공개키/개인키 쌍 생성
bob_private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)
bob_public_key = bob_private_key.public_key()


# 2. Alice: 보낼 데이터 준비
plaintext = """
이것은 Bob에게 보내는 중요한 데이터입니다.
실제로는 PDF 파일, 이미지, JSON, DB 백업 파일 등이 될 수 있습니다.
""".encode("utf-8")


# 3. Alice: 임시 AES 세션 키 생성
aes_key = AESGCM.generate_key(bit_length=256)
nonce = os.urandom(12)


# 4. Alice: 실제 데이터는 AES-GCM으로 암호화
aesgcm = AESGCM(aes_key)
ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)


# 5. Alice: AES 키를 Bob의 RSA 공개키로 암호화
encrypted_aes_key = bob_public_key.encrypt(
    aes_key,
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None,
    ),
)


# 6. Alice → Bob: 전송할 패키지 구성
package = {
    "algorithm": "RSA-OAEP-SHA256 + AES-256-GCM",
    "encrypted_aes_key": b64encode(encrypted_aes_key),
    "nonce": b64encode(nonce),
    "ciphertext": b64encode(ciphertext),
}
serialized_package = json.dumps(package, ensure_ascii=False, indent=2)
print("Alice가 Bob에게 보내는 패키지:")
print(serialized_package)


# 7. Bob: 패키지 수신 후 RSA 개인키로 AES 키 복호화
received = json.loads(serialized_package)
decrypted_aes_key = bob_private_key.decrypt(
    b64decode(received["encrypted_aes_key"]),
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None,
    ),
)


# 8. Bob: 복호화한 AES 키로 실제 데이터 복호화
bob_aesgcm = AESGCM(decrypted_aes_key)
decrypted_plaintext = bob_aesgcm.decrypt(
    b64decode(received["nonce"]),
    b64decode(received["ciphertext"]),
    associated_data=None,
)

print("\nBob이 복호화한 원문:")
print(decrypted_plaintext.decode("utf-8"))
```

이 코드에서 역할을 정리하면 다음과 같다.

| 역할 | 사용하는 방식 | 이유 |
|---|---|---|
| 실제 데이터 암호화 | AES-GCM (대칭 키) | 빠르고 대용량 가능 |
| AES 키 전달 | RSA-OAEP (비대칭 키) | 사전에 비밀 키를 공유하지 않아도 됨 |

---
### 4. 해싱

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
### 5. 실전 선택 가이드

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
### 6. 흔한 실수와 보안 주의사항

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
