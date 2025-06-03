---
tags:
  - docker
  - network
created: 2025-06-04T08:59:41
updated: 2025-06-04T00:38:37
---
### Docker 네트워크의 기본 구조

도커 네트워크는 실제 리눅스 네트워크 인프라 위에 다양한 네트워크 드라이버와 IPAM 드라이버가 계층처럼 올라가고, 그 위에서 도커 엔진이 논리적 네트워크를 만들어 컨테이너와 연결한다.

![[docker 네트워크 - 2025-05-30 - 09-01-46.png|665x457]][^1]


##### Network Infrastructure
  - 실제 리눅스의 네트워크 인터페이스 (eth0, wlan0 등), 브리지, 라우터, iptables, ipvs 같은 커널 네트워크 기능이 돌아가는 기반 계층

##### Network Driver
  - 네트워크의 종류 (bridge, overlay, macvlan 등)를 정하고, 리눅스 커널 자원 (브리지 디바이스, VXLAN 등)을 실제로 만드는 플러그인 계층
  - bridge는 로컬 브리지, overlay는 멀티호스트 분산 네트워크, macvlan은 호스트 NIC처럼 동작

##### IPAM Driver
  - IP Address Management. 각 네트워크의 IP 풀, 서브넷을 관리하고 컨테이너마다 IP를 할당
  - 기본 IPAM 외에 외부 DHCP 등 커스텀 드라이버도 가능

##### Docker Engine
  - 위 드라이버 계층을 통합
  - 사용자가 `docker network create`, `docker network connect` 같은 명령을 내리면 실제 네트워크 리소스와 IP 할당, 라우팅 정책 등을 처리

##### Docker Network
  - 논리적으로 만들어진 네트워크 단위
  - bridge, overlay, macvlan, host, none 등 다양한 유형이 있고 컨테이너를 특정 네트워크에 연결하면, 리눅스 내에서 실제 네트워크 리소스 (예: 브리지, VXLAN 등)가 생성

##### Network Sandbox
  - 컨테이너마다 생성되는 네트워크 격리 공간
  - 네임스페이스로 격리되어 자신의 가상 이더넷 (veth), 라우팅 테이블, iptables 룰, /etc/hosts, /etc/resolv.conf를 따로 보유

##### Endpoint
  - 네트워크에 컨테이너가 붙을 때 만들어지는 연결점
  - 컨테이너의 veth 인터페이스 한 쪽이 host 브리지(네트워크)로, 한 쪽이 컨테이너 네임스페이스로 연결
  - 하나의 컨테이너가 여러 네트워크에 여러 endpoint로 동시에 붙을 수도 있음

---
### 도커에서 지원하는 네트워크 드라이버

> [!note] 
> 이 중에서 **bridge, host, none**이 로컬 기본 내장  
> **overlay, macvlan, ipvlan**은 환경/플러그인에 따라 지원(일부 OS에서는 제한 있음)  
> 대부분의 네트워크 요구는 bridge, overlay, host 조합만으로 충분히 해결 가능.
##### bridge  
- 기본값. 단일 호스트 내에서 컨테이너끼리 통신할 수 있게 해주는 가상 브리지 네트워크.
- 각 컨테이너마다 내부 IP 할당, 호스트와는 NAT로 통신.
- `docker network create` 기본 옵션.
- 사용 예: 여러 웹앱, DB를 한 서버에서 따로 띄울 때

##### host  
- 컨테이너가 호스트의 네트워크 네임스페이스를 100% 공유  
- 별도 IP/NAT 없이, 호스트에서 열려있는 포트에 직접 접근.
- 포트 매핑(`-p`) 옵션 무의미
- 주로 퍼포먼스 극대화, 로우레벨 네트워크 접근이 필요할 때 사용
##### none  
- 네트워크 미연결 상태
- 컨테이너가 네트워크 인터페이스를 갖지 않음(인터넷, 내부 통신 모두 불가)
- 외부 네트워크와 완전히 격리된 실험, 보안 환경 등에 사용
##### overlay  
- 여러 호스트(멀티서버)에서 컨테이너 네트워크를 가상으로 연결
- VXLAN 등 터널링 기술로, 서버 간 컨테이너끼리 같은 네트워크에 있는 것처럼 통신
- Docker Swarm, Kubernetes 등 오케스트레이션 환경에서 필수
##### macvlan  
- 컨테이너가 실제 물리 NIC처럼 동작(고유 MAC 주소/IP 부여)
- 호스트 네트워크와 컨테이너가 L2 스위치처럼 직접 통신 가능
- IoT, 레거시 시스템 연동 등, 물리망 통합이 필요한 상황에 적합
##### ipvlan  
- macvlan과 비슷하지만, IP 주소만 분리해 여러 컨테이너에 부여
- MAC 주소는 공유, IP만 독립
- 고성능 네트워크 분리가 필요할 때 사용

---
### macOS와 Linux에서 도커 네트워크 구조 차이

##### Linux
- 도커 데몬(dockerd)이 리눅스 커널에서 직접 실행
- 네트워크 드라이버(bridge, overlay 등)가 리눅스 네트워크 네임스페이스, 브리지(bridge), veth 페어(veth), iptables, ipvs 등 커널 기능을 네이티브하게 사용
    - 네임스페이스: 각 컨테이너마다 분리된 네트워크 환경을 제공
    - bridge(docker0): 여러 컨테이너와 호스트를 하나의 내부 가상 [[6. 스위치#스위치 여러 호스트를 연결할 수 있는 데이터 링크 계층의 네트워크 장비|스위치]]로 묶음
    - veth pair: 컨테이너 ↔ 브리지(또는 호스트) 연결용 가상 이더넷 케이블 역할
    - enp0sX, eth0 등: 리눅스 호스트의 실제 물리 [[4. NIC와 케이블#NIC (Network Interface Controller) 호스트와 유무선 통신 매체를 연결하고 정보 변환을 담당하는 MAC 주소가 부여되는 네트워크 장비|NIC]] 이름
- 컨테이너 네트워크(bridge 등)가 호스트 시스템 네트워크와 거의 1:1로 동작
- 성능, 호환성, 커스텀 네트워크 플러그인에서 제약이 없음

##### macOS
- 리눅스 커널이 없음 → 진짜 dockerd가 직접 못 돌아감
- Docker Desktop이 리눅스 가상머신(예전엔 HyperKit, 최근엔 Apple Silicon용 Lima/VM, QEMU 등) 위에 dockerd와 컨테이너를 돌림
- 실제 컨테이너 네트워크는 **VM 내부**에서만 만들어짐 (ex: 리눅스 VM 안의 bridge, veth, iptables)
    - bridge, veth, 네임스페이스 등 네트워크 구조가 모두 가상머신 내부에서만 동작
    - macOS에서 보이는 en0, en1, bridge100 등은 맥의 네트워크 인터페이스
- macOS의 네트워크는 “가상머신과 호스트 사이”에서 NAT, 포트포워딩 등으로 중계됨
    - ex: macOS의 `localhost:포트` → VM 네트워크 인터페이스 → 컨테이너
- macvlan 등 일부 고급 네트워크 기능은 동작 불가 또는 제약 있음
    - 물리 네트워크 인터페이스(macvlan 등) 직접 연결 불가
    - veth, bridge는 VM 내부에서만 사용 가능  

![[docker 네트워크 - 2025-05-30 - 10-29-51.png|663x326]]

##### 주요 차이 포인트

###### bridge 네트워크
- Linux: 컨테이너와 호스트가 같은 브리지 내에서 바로 통신 가능, iptables로 라우팅/포트포워딩 처리
- macOS: 브리지는 리눅스 VM 내부에만 존재, macOS 호스트에서 직접 브리지에 접근 불가
	- 대신 Docker Desktop이 “포트포워딩” 기능으로 맵핑해줌

###### host 네트워크
- Linux: `--network=host` 쓰면 컨테이너가 호스트의 네트워크 네임스페이스 (eth0, localhost 등)를 완전히 공유
	- 포트 매핑(`-p`)이 필요 없고, 호스트와 동일한 네트워크 환경에서 동작
- macOS: Docker Desktop에서 최근 host 네트워크 드라이버를 지원하지만, 컨테이너가 실제로 공유하는 건 **리눅스 VM 내부의 네트워크 네임스페이스**
	- macOS의 진짜 물리적 네트워크(호스트 시스템의 localhost, 공인 IP, 방화벽 등)와는 직접적으로 연결되지 않음
	- 포트포워딩이나 추가 설정 없이 “컨테이너 ↔ macOS 호스트 간 네트워크를 1:1로 공유”하는 건 불가능
	- 따라서 host 네트워크를 써도 리눅스 환경과 동작 방식, 접근 가능한 네트워크 범위가 다르니 주의 필요

###### macvlan, ipvlan
- Linux: NIC 레벨에서 가상 인터페이스 만들어 네트워크 분리, VLAN 연동도 가능
- macOS: 이런 네트워크 드라이버 아예 지원 안 하거나, 가상머신 내부 네트워크에만 한정

###### Overlay, 멀티호스트 네트워크
- Linux: overlay 네트워크 만들어서 여러 리눅스 호스트 사이에서 컨테이너 네트워크 직접 연결 가능
- macOS: overlay 자체는 VM 안에서만 돌아가고, 실제 외부 호스트/클러스터와 연결은 어렵거나 별도 터널링 필요

###### 성능
- Linux: 네트워크 I/O가 곧바로 커널로, 성능 저하 거의 없음
- macOS: 항상 “VM을 한 번 거치는 구조”라 네트워크 지연, 패킷 드롭, throughput 감소가 생길 수 있음

---
### 정리

- 네트워크 드라이버와 IPAM 드라이버가 실제 커널 리소스 생성, 주소 할당을 추상화  
- 컨테이너마다 별도 네임스페이스(=network sandbox)가 만들어져 충돌 없이 독립적으로 운영  
- 논리적 네트워크를 CLI/API로 자유롭게 만들고 여러 컨테이너가 동시에 접속 가능  
- overlay, macvlan, 3rd party CNI 플러그인 등 확장성 우수

이 구조 덕분에 한 호스트(bridge), 여러 호스트(overlay), 물리 네트워크(macvlan), 완전 독립(host/none) 등 다양한 네트워크 토폴로지를 컨테이너 환경에서 손쉽게 구현할 수 있음

[^1]: https://k21academy.com/docker-kubernetes/docker-networking-different-types-of-networking-overview-for-beginners/
