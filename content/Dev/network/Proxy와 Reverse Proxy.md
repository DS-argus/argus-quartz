---
tags:
  - network
  - proxy
  - reverse-proxy
created: 2025-06-11T13:07:45
updated: 2025-06-11T13:17:50
permalink: /Dev/network/proxy-and-reverse-proxy
---
### Proxy (Forward Proxy)
클라이언트를 대신하여 인터넷에 요청을 전달하고 응답을 클라이언트로 되돌려주는 중개 서버

- 클라이언트 IP 주소를 숨겨 익명성 제공 및 보안 향상
- 인터넷 접근을 관리하여 특정 웹사이트 및 콘텐츠 접근을 제한
- 캐싱을 통해 요청 속도를 개선하고 대역폭 사용량 절감
- 네트워크 활동 모니터링, 로깅을 통한 관리 및 분석 가능
- 내부 네트워크에서 외부 리소스 접근 제어 및 규제 준수

> 클라이언트 → Proxy 서버 → 인터넷 서버 → Proxy 서버 → 클라이언트

---
### Reverse Proxy
인터넷에서 클라이언트의 요청을 대신 수신하여 내부 서버로 전달하고 응답을 다시 클라이언트에게 전달하는 중개 서버

- 내부 서버의 IP 주소 및 구조를 숨겨 보안 강화 및 공격 차단
- 여러 서버 간 요청을 균등하게 분산(로드 밸런싱)하여 서비스 안정성과 가용성 향상
- SSL/TLS 암호화 통신을 중단(종료)하여 서버 부담 경감 및 관리 단순화
- 콘텐츠 압축과 캐싱으로 성능 개선 및 응답 속도 향상
- 하나의 외부 주소(URL)로 여러 내부 서비스 및 애플리케이션 통합 제공
- 내부 서버에서 발생하는 오류나 문제를 클라이언트로부터 숨김

> 클라이언트 → Reverse Proxy 서버 → 내부 서버들 → Reverse Proxy 서버 → 클라이언트
---
### Proxy vs Reverse Proxy 차이점

|  구분   |    Proxy    | Reverse Proxy |
| :---: | :---------: | :-----------: |
| 사용 주체 |    클라이언트    |      서버       |
| 주요 역할 |  클라이언트 보호   |   내부 서버 보호    |
| 요청 방향 | 클라이언트 → 인터넷 |  인터넷 → 내부 서버  |

---
### 사용 예시

- Proxy: 내부 사용자의 인터넷 접근 제어 및 보안 강화
- Reverse Proxy: 외부 요청 관리 및 내부 서버 보호

---
### 관련 노트
- [[Reverse Proxy vs Load Balancer vs API Gateway]] - Reverse Proxy, Load Balancer, API Gateway의 차이와 진화 관계
- [[Headscale - Tailscale 대안 오픈소스 메시 VPN]] - 리버스 프록시를 활용한 Headscale 서버 구성