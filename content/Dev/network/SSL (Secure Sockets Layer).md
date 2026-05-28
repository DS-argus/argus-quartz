---
tags:
  - network
  - SSL
  - TLS
created: 2025-06-11T13:10:12
updated: 2025-06-11T13:10:59
permalink: /Dev/network/ssl-secure-sockets-layer
---
### SSL (Secure Sockets Layer)

인터넷 통신을 암호화하여 데이터 보안을 제공하는 프로토콜

- 데이터 암호화로 통신 보안 유지
- 서버와 클라이언트 간 신원 인증
- 데이터 무결성 보장 (변조 방지)
---
### SSL 작동 방식

1. 클라이언트가 서버에 연결 요청
2. 서버가 인증서를 클라이언트에 전달
3. 클라이언트가 인증서 신뢰 여부 확인
4. 양측이 암호화 방식 협상 후 세션 키 생성
5. 세션 키를 사용해 암호화된 통신 시작
---
### SSL 인증서 종류

- DV (Domain Validation): 도메인 소유권 확인
- OV (Organization Validation): 기업 신원 확인
- EV (Extended Validation): 기업의 법적 존재와 신뢰성 검증
---
### SSL 주요 사용처

- 웹사이트 HTTPS 통신 (웹 브라우저와 서버 간)
- 이메일 암호화 (SMTP, IMAP)
- 데이터 전송 및 API 통신 보안
---
### SSL과 TLS 차이점

- TLS (Transport Layer Security)는 SSL의 후속 프로토콜로 현재 표준으로 사용
- 일반적으로 SSL이라는 용어로 통칭됨