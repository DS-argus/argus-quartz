---
tags:
  - network
  - SSL
  - TLS
created: 2025-06-11T13:10:12
updated: 2026-06-05T10:00:00
permalink: /Dev/network/ssl-secure-sockets-layer
---
> [!abstract]+ TL;DR
> - SSL은 인터넷 통신 암호화 프로토콜이지만 현재는 보안 취약점으로 폐기된 상태
> - TLS는 SSL의 후속 프로토콜로 현재 표준 (TLS 1.2, 1.3)
> - 일상적으로 "SSL"이라 부르지만 실제로는 TLS가 동작하는 경우가 대부분
> - TLS 1.3은 handshake 간소화, 취약한 암호 스위트 제거 등 성능과 보안을 모두 개선

---
### 1. SSL이란

SSL(Secure Sockets Layer)은 인터넷 통신을 암호화하여 데이터 보안을 제공하는 프로토콜이다. Netscape가 1995년에 설계했다.

- 데이터 암호화로 통신 보안 유지
- 서버와 클라이언트 간 신원 인증
- 데이터 무결성 보장 (변조 방지)

##### SSL 작동 방식

1. 클라이언트가 서버에 연결 요청
2. 서버가 인증서를 클라이언트에 전달
3. 클라이언트가 인증서 신뢰 여부 확인
4. 양측이 암호화 방식 협상 후 세션 키 생성
5. 세션 키를 사용해 암호화된 통신 시작

> [!note]+ 세션 키
> 세션 키는 [[17. 안전성을 위한 기술#암호와 인증서]]에서 다룬 하이브리드 방식으로 생성된다. 비대칭 키로 대칭 키(세션 키)를 안전하게 교환한 뒤, 실제 데이터 전송은 빠른 대칭 키 암호화로 처리한다.

---
### 2. SSL의 폐기

SSL은 현재 **사용해서는 안 되는** 프로토콜이다.

| 버전 | 연도 | 상태 |
|---|---|---|
| SSL 1.0 | 1994 | 공개 전 폐기 (심각한 결함) |
| SSL 2.0 | 1995 | 2011년 폐기 (RFC 6176) |
| SSL 3.0 | 1996 | 2015년 폐기 (RFC 7568) |

SSL 3.0은 **POODLE 공격**(2014년 발견)으로 인해 폐기되었다. POODLE은 SSL 3.0의 CBC 모드 패딩 처리 방식을 악용해 암호화된 데이터를 한 바이트씩 복호화할 수 있는 취약점이다.

---
### 3. TLS란

TLS(Transport Layer Security)는 SSL 3.0을 기반으로 IETF가 표준화한 후속 프로토콜이다.

| 버전 | 연도 | 상태 |
|---|---|---|
| TLS 1.0 | 1999 | 2021년 폐기 (RFC 8996) |
| TLS 1.1 | 2006 | 2021년 폐기 (RFC 8996) |
| TLS 1.2 | 2008 | 현재 사용 가능 |
| TLS 1.3 | 2018 | 현재 권장 표준 |

> [!tip]+ "SSL"이라 부르지만 실제로는 TLS
> 브라우저 주소창의 자물쇠 아이콘, "SSL 인증서", Let's Encrypt 등에서 말하는 SSL은 사실상 TLS를 의미한다. 역사적 이유로 SSL이라는 이름이 관용적으로 남아 있을 뿐이다.

---
### 4. TLS 1.2 vs TLS 1.3

TLS 1.3은 2018년에 발표된 최신 표준으로, 1.2 대비 보안과 성능이 모두 개선되었다.

##### Handshake 간소화

- TLS 1.2 : 2-RTT (왕복 2회) — ClientHello → ServerHello → 키 교환 → Finished
- TLS 1.3 : **1-RTT** (왕복 1회) — ClientHello에 키 공유 정보를 포함해서 보냄

```
# TLS 1.2 (2-RTT)
Client → Server : ClientHello
Client ← Server : ServerHello, Certificate, KeyExchange
Client → Server : KeyExchange, Finished
Client ← Server : Finished

# TLS 1.3 (1-RTT)
Client → Server : ClientHello + KeyShare
Client ← Server : ServerHello + KeyShare, Certificate, Finished
Client → Server : Finished
```

연결 설정이 빨라지므로 체감 속도가 향상된다.

##### 0-RTT (Zero Round Trip Time)

TLS 1.3에서는 이전에 연결한 적 있는 서버에 대해 **첫 메시지에 데이터를 함께 보낼 수 있다** (0-RTT Resumption). 다만 재전송 공격(replay attack)에 취약할 수 있어서 멱등하지 않은 요청에는 사용하지 않는 것이 좋다.

##### 취약한 알고리즘 제거

TLS 1.3에서는 아래 항목이 완전히 제거되었다.

- RSA 키 교환 (전방 비밀성 미지원)
- CBC 모드 암호 스위트
- RC4, DES, 3DES
- SHA-1 기반 서명
- 정적 Diffie-Hellman

> [!info]+ 전방 비밀성 (Forward Secrecy)
> 서버의 개인 키가 유출되더라도 **과거에 암호화된 통신 내용은 복호화할 수 없는** 성질이다. TLS 1.3은 모든 키 교환에 임시 Diffie-Hellman(DHE/ECDHE)을 사용하여 전방 비밀성을 강제한다. TLS 1.2에서는 RSA 키 교환을 쓰면 전방 비밀성이 보장되지 않았다.

##### TLS 1.2 vs 1.3 비교 표

| 항목 | TLS 1.2 | TLS 1.3 |
|---|---|---|
| Handshake | 2-RTT | 1-RTT (0-RTT 지원) |
| 키 교환 | RSA, DHE, ECDHE | ECDHE, DHE만 허용 |
| 전방 비밀성 | 선택 (RSA 사용 시 미지원) | 강제 |
| 암호 스위트 | 다수 (일부 취약) | 5개로 축소 (안전한 것만) |
| 암호화 모드 | CBC, GCM 등 | AEAD만 허용 (GCM, ChaCha20) |

---
### 5. SSL/TLS 인증서

##### 인증서 종류

| 종류 | 검증 대상 | 용도 |
|---|---|---|
| DV (Domain Validation) | 도메인 소유권 | 개인 블로그, 소규모 사이트 |
| OV (Organization Validation) | 기업 신원 | 기업 웹사이트 |
| EV (Extended Validation) | 기업의 법적 존재와 신뢰성 | 금융, 전자상거래 |

##### 인증서 발급 방식

- **유료 CA** : DigiCert, GlobalSign 등에서 발급
- **무료 CA** : Let's Encrypt가 대표적. DV 인증서를 자동으로 발급하고 갱신한다

```bash
# Let's Encrypt + certbot 예시
sudo certbot --nginx -d example.com
```

##### 인증서 확인

```bash
# 서버의 인증서 정보 확인
openssl s_client -connect example.com:443 -servername example.com < /dev/null 2>/dev/null | openssl x509 -noout -subject -dates -issuer

# TLS 버전 확인
openssl s_client -connect example.com:443 -tls1_3
```

---
### 6. 주요 사용처

- 웹사이트 HTTPS 통신 ([[17. 안전성을 위한 기술#HTTPS SSL/TLS를 사용하는 대표적인 프로토콜|HTTPS handshake 참고]])
- 이메일 암호화 (SMTP, IMAP)
- 데이터 전송 및 API 통신 보안
- VPN 연결 (OpenVPN 등)
- 데이터베이스 연결 암호화 (PostgreSQL, MySQL 등)
