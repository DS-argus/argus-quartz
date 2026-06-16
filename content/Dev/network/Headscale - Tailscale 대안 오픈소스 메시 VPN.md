---
tags:
  - network
  - DevOps
  - VPN
created: 2026-05-31T00:00:00
updated: 2026-05-31T23:25:41
permalink: /Dev/network/headscale-tailscale-alternative
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Tailscale은 WireGuard 기반 메시 VPN이지만 컨트롤 서버가 SaaS로 운영되어 사용자/정책 제한 존재
> - Headscale은 Tailscale 컨트롤 서버를 대체하는 오픈소스 프로젝트. Tailscale 클라이언트를 그대로 사용 가능
> - 자체 호스팅하면 무제한 사용자/정책, 낮은 지연시간, 완전한 네트워크 제어권 확보
> - K3s 클러스터 위에 Headscale 서버 + Tailscale 클라이언트 + Headplane UI로 구성 가능

> [!cite]+ Source
> - [Stop Using Tailscale. Use Open Source Instead. - DevOps Toolbox](https://youtube.com/watch?v=7Jja20nWcqo)

---

### 1. VPN vs 메시 네트워크

VPN과 메시 네트워크를 이해하려면 먼저 전통적인 VPN의 구조를 알아야 한다.

##### 전통적인 VPN

일반적인 VPN은 하나의 게이트웨이 서버를 통해 클라이언트가 내부 서버에 접근하는 구조다.

```
클라이언트 → VPN 게이트웨이 → 내부 서버들
```

이 방식의 문제는 **모든 트래픽이 게이트웨이를 경유**한다는 것이다. 물리적으로 가까운 장비에 접근할 때도 먼 곳에 있는 VPN 서버를 거쳐야 한다. 예를 들어, 같은 건물에 있는 온프레미스 서버에 접근하는데 미국 리전의 AWS VPN을 경유한다면 불필요한 지연이 발생한다.

##### 메시 네트워크

WireGuard 기반 메시 네트워크는 이와 다르다. 네트워크에 참여한 모든 노드가 서로 직접 연결되는 구조다.

```
노드 A ←→ 노드 B
  ↕       ↕
노드 C ←→ 노드 D
```

- 각 노드 쌍 사이에 경량 WireGuard 터널이 생성된다
- 게이트웨이를 거치지 않아 **지연시간이 낮다**
- 특정 노드가 죽어도 나머지 노드끼리 통신 가능하여 **장애 내성**이 높다

---

### 2. Tailscale과 Headscale

##### Tailscale이란

[[Proxy와 Reverse Proxy|Tailscale]]은 WireGuard 위에 구축된 메시 VPN 서비스다. WireGuard 자체는 설정이 복잡하지만, Tailscale은 이를 매우 간단하게 만든다.

Tailscale의 구조는 크게 두 부분으로 나뉜다.

| 구성 요소 | 역할 | 소스 |
|:---:|:---:|:---:|
| 컨트롤 서버 | 노드 등록, 키 관리, 정책 관리 | 비공개 (SaaS) |
| 클라이언트 | 각 장비에서 실행되는 WireGuard 노드 | 오픈소스 |

무료 플랜에서는 사용자 수, 정책 수, 리소스 접근이 제한된다. 그리고 핵심인 컨트롤 서버는 Tailscale 회사가 운영하는 SaaS이므로, 내부 네트워크의 키와 정책을 외부 서버에 의존하게 된다.

##### Headscale이란

Headscale은 Tailscale 컨트롤 서버를 대체하는 오픈소스 프로젝트다. GitHub에서 가장 인기 있는 Tailscale 대안 중 하나다.

핵심 포인트는 다음과 같다.

- Tailscale의 오픈소스 클라이언트를 **그대로 사용**한다
- 컨트롤 서버만 자체 호스팅으로 교체한다
- 무제한 사용자, 무제한 정책, 완전한 제어권
- Tailscale의 주요 기능 대부분을 구현 (Magic DNS, ACL 등)

> [!tip]+ 자체 호스팅의 이점
> - 무제한 사용자/정책 (무료 플랜 제한 없음)
> - 네트워크 키와 정책의 완전한 제어권
> - 홈랩/온프레미스 환경에서의 낮은 지연시간
> - SaaS 의존 없는 독립적 운영

---

### 3. Headscale 서버 설정

Headscale은 Docker 컨테이너로 배포할 수 있다. K3s 클러스터, Docker Compose, 단독 서버 등 원하는 환경에서 실행하면 된다.

##### 핵심 설정 파일

```yaml
# headscale config.yaml 주요 항목
server_url: https://headscale.example.com  # 공개 DNS로 설정
listen_addr: 0.0.0.0:8080
metrics_listen_addr: 0.0.0.0:9090
```

- `server_url`: 외부에서 접근 가능한 DNS 주소를 설정한다. 나중에 공개 DNS를 연결하되, 서비스 자체는 비공개로 유지하는 방식을 사용한다.
- `listen_addr`: 클라이언트 연결을 수신할 포트
- `metrics_listen_addr`: Prometheus 등 모니터링 메트릭 포트

##### Docker로 실행

```bash
# Headscale 공식 이미지 실행
docker run -d \
  --name headscale \
  -v /path/to/config:/etc/headscale \
  -p 8080:8080 \
  -p 9090:9090 \
  headscale/headscale:latest \
  headscale serve
```

##### 리버스 프록시 연결

Caddy나 Nginx 같은 [[Proxy와 Reverse Proxy|리버스 프록시]]를 사용해서 공개 도메인의 트래픽을 Headscale 서비스로 전달한다.

```
# Caddyfile 예시
headscale.example.com {
    reverse_proxy localhost:8080
}
```

---

### 4. 사용자와 노드 등록

Headscale은 자체 CLI를 제공한다. 컨테이너 안에서 실행해야 하므로 alias를 만들어두면 편하다.

##### CLI alias 설정

```bash
alias headscale="docker exec -it headscale headscale"
```

##### 사용자 생성

```bash
# 사용자 목록 확인
headscale users list

# 새 사용자 생성
headscale users create myuser
```

##### 노드 등록

각 장비에 Tailscale 클라이언트를 설치한 뒤, Headscale 서버를 로그인 서버로 지정한다.

```bash
# Tailscale 클라이언트 설치 후 실행
tailscale up --login-server https://headscale.example.com \
  --accept-routes \
  --accept-dns
```

이 명령을 실행하면 등록용 URL이 출력된다. 해당 URL에서 생성된 등록 명령을 서버에서 실행한다.

```bash
# 서버에서 노드 등록 승인
headscale nodes register --user myuser --key mkey:xxxxx
```

등록이 완료되면 해당 장비에 내부 IP가 할당되고, 메시 네트워크에 참여하게 된다.

```bash
# 노드 상태 확인
tailscale status
```

---

### 5. 관리 UI - Headplane

Headscale 자체에는 웹 UI가 없다. GitHub에서 여러 커뮤니티 UI 프로젝트를 찾을 수 있는데, 가장 인기 있는 옵션은 **Headplane**이다.

##### Headplane 설정

Headplane은 API 키를 통해 Headscale과 통신한다.

```bash
# Headscale에서 API 키 생성
headscale apikeys create
```

생성된 키를 Headplane 설정에 입력하면 관리 대시보드를 사용할 수 있다. 노드 상태 확인, 서브넷 승인, 사용자 관리 등을 웹에서 처리 가능하다.

---

### 6. K3s 서브넷 라우팅

홈랩에서 유용한 기능 중 하나가 **서브넷 라우팅**이다. Kubernetes 클러스터 내부의 Pod 네트워크를 외부에서 접근할 수 있게 해준다.

##### 서브넷 라우터 배포

K3s 클러스터 안에 Tailscale 컨테이너를 배포하고, 서브넷 라우터로 동작하게 한다.

```bash
# 서브넷 라우터로 Tailscale 실행
tailscale up --login-server https://headscale.example.com \
  --advertise-routes=10.42.0.0/16 \
  --accept-routes
```

- `10.42.0.0/16`은 K3s의 기본 Pod CIDR이다
- Headplane UI에서 서브넷 라우트를 승인해야 실제로 동작한다

##### 내부 서비스 접근

서브넷 라우팅이 활성화되면, 메시 네트워크에 참여한 장비에서 K3s 내부 서비스에 직접 접근할 수 있다.

```bash
# 예: Dozzle 로그 뷰어 접근
# 클러스터 내부 서비스 IP로 직접 접근 가능
curl http://10.42.x.x:8080
```

> [!note]+ 보안 고려사항
> 하나의 서브넷 라우터로 클러스터 전체를 노출하면 전통적인 VPN과 비슷한 문제가 생긴다. 더 안전한 구조는 노출하려는 애플리케이션마다 개별 Tailscale 사이드카 컨테이너를 배포하는 것이다.

---

### 7. DNS 설정 전략

내부 서비스에 IP 대신 도메인으로 접근하려면 DNS 설정이 필요하다. 몇 가지 방식이 있다.

##### Magic DNS (Headscale 내장)

Headscale은 Tailscale의 Magic DNS 기능을 구현하고 있어서, 노드 이름으로 자동 DNS 엔트리가 생성된다. 하지만 비표준 DNS 엔트리는 브라우저에서 제대로 동작하지 않는 경우가 많다.

##### AdGuard/Pi-hole DNS 재작성

로컬 DNS 서버에서 내부 도메인을 내부 IP로 재작성하는 방식이다. 광고 차단과 함께 사용할 수 있지만, 비표준 도메인에 대한 브라우저 호환성 문제는 여전히 있다.

##### 공개 DNS + 사설 IP (권장)

가장 실용적인 방법은 **공개 DNS 레코드에 사설 IP를 등록**하는 것이다.

```
logs.example.com → 10.42.x.x (사설 IP)
```

- DNS 레코드는 공개적으로 조회할 수 있지만, 실제 IP는 사설 대역이므로 메시 네트워크에 참여한 장비만 접근 가능하다
- 브라우저가 정상적인 도메인으로 인식하므로 호환성 문제가 없다
- HTTPS 인증서 발급도 정상적으로 동작한다

> [!tip]+ DNS와 HTTPS
> 공개 도메인을 사용하면 Let's Encrypt 같은 인증 기관에서 정상적으로 SSL 인증서를 발급받을 수 있다. 사설 IP를 사용하더라도 DNS 챌린지 방식으로 인증서를 발급하면 HTTPS를 적용할 수 있다.

---

### 8. 전체 구성 요약

```
[인터넷]
    ↓ (공개 DNS)
[리버스 프록시 / Caddy]
    ↓
[Headscale 컨트롤 서버] ← 노드 등록/키 관리
    ↓
[메시 네트워크]
  ├── 노드 1: 노트북 (Tailscale 클라이언트)
  ├── 노드 2: K3s 서브넷 라우터 (Tailscale 컨테이너)
  └── 노드 N: 추가 장비들
         ↓
    [K3s 내부 서비스들]
      ├── Dozzle (로그 뷰어)
      ├── AdGuard (DNS/광고 차단)
      └── 기타 애플리케이션
```

> [!info]+ Headscale vs Tailscale 비교
> | 항목 | Tailscale (무료) | Headscale |
> |:---:|:---:|:---:|
> | 사용자 수 | 제한 있음 | 무제한 |
> | 정책 수 | 제한 있음 | 무제한 |
> | 컨트롤 서버 | SaaS (비공개) | 자체 호스팅 (오픈소스) |
> | 클라이언트 | 오픈소스 | 동일 (Tailscale 클라이언트 사용) |
> | 관리 UI | 공식 대시보드 | 커뮤니티 (Headplane 등) |
> | 설정 난이도 | 매우 쉬움 | 중간 (서버 운영 필요) |

---

### 9. 관련 노트

- [[Rustdesk over Tailscale - self-hosted remote desktop]] - Tailscale 메시 위에 원격 데스크톱(Rustdesk)을 얹어 relay 서버 없이 직접 연결하는 활용 사례
