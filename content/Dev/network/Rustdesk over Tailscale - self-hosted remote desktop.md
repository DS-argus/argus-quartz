---
tags:
  - network
  - VPN
  - DevOps
created: 2026-06-16T09:20:00
updated: 2026-06-16T09:20:00
permalink: /Dev/network/rustdesk-over-tailscale
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Rustdesk는 TeamViewer 대안인 오픈소스 원격 데스크톱. Windows·macOS·Linux 모두 지원
> - 일반적으로 NAT를 넘기 위해 자체 relay 서버를 VPS에 띄워야 함
> - Tailscale을 연결 패브릭으로 쓰면 노드끼리 직접 연결되어 relay 서버가 필요 없음
> - 설정 핵심은 permanent password 지정 + enable direct IP access 체크
> - tailnet IP를 입력해 접속하며, Magic DNS 이름은 인식하지 못함

> [!cite]+ Source
> <iframe width="560" height="315" src="https://www.youtube.com/embed/27apZcZrwks" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

---

### 1. 배경 - 원격 데스크톱과 NAT 문제

##### 원격 데스크톱이란

원격 데스크톱은 다른 컴퓨터의 화면을 내 컴퓨터로 가져와 마치 그 앞에 앉은 것처럼 조작하는 기술이다. 가족 PC 기술 지원이나 외부에서 집·회사 PC에 접속할 때 쓴다. 대표 도구가 TeamViewer다.

그런데 TeamViewer는 시간이 지나며 "사업용으로 쓰는 것 아니냐"는 팝업이 잦아졌다. 그렇다고 OS 기본 도구(Microsoft 원격 데스크톱, Apple 화면 공유 VNC)를 쓰자니 **방화벽을 넘는 일**이 번거롭다. 코드만 입력하면 연결되는 편의성도 없어서 포트 포워딩 같은 설정을 직접 해야 한다.

##### NAT 통과(NAT traversal)가 어려운 이유

대부분의 가정·회사 네트워크는 [[8. IP 주소|사설 IP]] 뒤에 있고 [[방화벽과 원격 접속|방화벽]]으로 보호된다. 외부에서 내 PC로 직접 들어오려면,

- 방화벽에 포트를 열어야 하는데, 원격 제어 포트를 여는 건 큰 보안 구멍이고,
- 아니면 중간에서 양쪽 트래픽을 중계하는 **relay 서버**를 둬야 한다.

결국 이 NAT 통과를 누가 대신 처리해 주느냐에 따라 원격 데스크톱 도구의 편의성이 갈린다.

---

### 2. Rustdesk란

Rustdesk는 대부분 무료로 쓸 수 있는 오픈소스 TeamViewer 대안이다. 등장한 지 꽤 됐지만, **자체 호스팅 서버**로 원격 데스크톱을 직접 운영할 수 있다는 점이 핵심이다.

- Windows, macOS, Linux 세 운영체제에 모두 접속 가능 (단일 클라이언트에서)
- 스케일링, 코덱 변경, 이미지 품질 조정, 복사·붙여넣기 지원
- VNC도 비슷한 일을 해왔지만, Rustdesk는 클라이언트·서버 설정에서 번거로운 부분을 알아서 처리해 준다

기본 사용법을 따르면 Rustdesk 역시 NAT를 넘으려고 **자체 relay 서버**를 VPS에 띄우라고 안내한다. 리소스는 적게 먹지만, 모든 트래픽이 클라우드의 relay 노드를 거쳐 들어갔다 나오는(hairpinning) 구조라 그리 깔끔하진 않다.

---

### 3. Tailscale과 결합하면 relay가 사라진다

[[Headscale - Tailscale 대안 오픈소스 메시 VPN|Tailscale]]은 WireGuard 기반 메시 VPN이고, NAT 통과야말로 가장 잘하는 일이다. 노드끼리 **직접(P2P) 연결**되며 종단 간 암호화된 WireGuard 터널로 통신한다.

따라서 접속하려는 모든 장비가 같은 tailnet의 노드라면,

- Rustdesk relay 서버를 따로 띄울 필요가 없다.
- tailnet IP만 입력하면 OS와 무관하게 어떤 Rustdesk 노드에도 연결된다.
- Rustdesk는 Tailscale이 만든 오버레이 네트워크 **위에 얹혀 동작하는 레이어**가 된다.

> [!info]+ relay vs 직접 연결
> 일반 Rustdesk는 클라우드 relay 노드를 경유(hairpinning)한다. Tailscale을 쓰면 노드 간 직접 터널이 생겨 지연이 줄고, 별도 서버 운영 부담이 없다. 메시 네트워크의 이점은 [[Headscale - Tailscale 대안 오픈소스 메시 VPN]]에서 더 자세히 다룬다.

##### 성능 참고

영상에서는 Factorio 게임을 원격으로 돌려 성능을 보여준다. H.265 코덱에 약 8Mbps, 30fps 수준인데, 약간의 지연은 있어도 영상 시청이나 일반 작업에는 충분하다. (게이밍이 목적이라면 Sunshine·Moonlight·Parsec 같은 전용 도구가 더 낫다.)

---

### 4. 설정 방법

각 노드에 Tailscale 클라이언트를 설치해 tailnet에 합류시킨 뒤, Rustdesk를 설치하고 아래 두 가지를 설정한다.

##### 1) 영구 비밀번호 설정

Rustdesk 클라이언트에서 ID 옆 점 세 개 메뉴 → **Security** → **Unlock security settings** → 아래로 스크롤해 **Use permanent password**를 켜고 비밀번호를 지정한다. 매번 일회용 코드를 받지 않고 무인 접속(unattended)을 하려는 것이다.

##### 2) 직접 IP 접근 허용

같은 보안 설정에서 **Enable direct IP access** 체크박스를 반드시 켠다. 이걸 켜야 상대방 ID·비밀번호 대신 **tailnet IP 주소**를 입력해 접속할 수 있다.

```
접속 박스에 입력: <원격 노드의 Tailscale IP>
```

> [!warning]+ Magic DNS 이름은 안 됨
> Rustdesk 클라이언트는 Tailscale의 Magic DNS 이름(예: `ubu-test`)을 인식하지 못한다. 이름을 넣으면 "ID does not exist"가 뜬다. 반드시 **실제 IP 주소**를 입력해야 정상 동작한다. (Magic DNS 자체에 대한 설명은 [[Headscale - Tailscale 대안 오픈소스 메시 VPN]] 참고)

---

### 5. 왜 유용한가 - 어디서든 접속

진짜 장점은 밖에 나가 봐야 드러난다. 노트북을 집 밖으로 들고 나가도,

- 방화벽 포트를 열 필요 없고,
- 공개 relay 서버를 운영할 필요도 없다.

카페에서 5G로 공용 인터넷에 붙으면 그 노트북은 Tailscale을 통해 다시 tailnet에 합류한다. 이제 **추가 설정 없이** 집에 둔 편집용 노트북이나 게이밍 PC에 책상 앞에 앉은 것처럼 접속할 수 있다. Tailscale이 네트워크 토폴로지를 아예 안 보이게 가려 주는 셈이다.

설정 과정을 요약하면, 각 노드에 (1) Tailscale 설치로 tailnet 합류, (2) Rustdesk 설치, (3) 무인 비밀번호 지정, (4) 직접 IP 접근 허용. 이게 전부다.

---

### 6. 관련 노트

- [[Headscale - Tailscale 대안 오픈소스 메시 VPN]] - Tailscale/WireGuard 메시 VPN의 구조와 자체 호스팅
- [[방화벽과 원격 접속]] - 방화벽과 원격 접속의 기초
- [[8. IP 주소]] - 사설 IP와 NAT 통과의 배경
