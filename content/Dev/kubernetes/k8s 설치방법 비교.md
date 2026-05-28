---
tags:
  - k8s
created: 2025-06-04T22:39:43
updated: 2025-06-05T16:17:05
permalink: /Dev/kubernetes/k8s-installation-methods-compared
---
> [!abstract]+ TL;DR
> k8s 설치의 대표적인 **다섯** 가지 방법을 비교  
> - **로컬 빠른 실습** → k3d, Docker Desktop, Rancher Desktop
> - **Upstream 기능 검증** → minikube  
> - **운영·대규모** → Amazon EKS  

---
### Kubernetes 설치/운영 5가지 방법 비교

##### 1. Docker Desktop 내장 Kubernetes
- **개요**: Docker Desktop(맥·윈도우) 설정창에서 **Enable Kubernetes**만 체크하면 싱글-노드(옵션으로 멀티-노드) 클러스터가 컨테이너로 기동
- **장점**
	- 이미 Docker를 쓰고 있다면 추가 설치 거의 없음 ― GUI에서 바로 사용
	- 여러 Kubernetes 버전을 쉽게 스위치
	- Docker 네트워크·볼륨 등 기존 툴링 재사용
- **단점**
	- 데스크톱 자원(MEM/CPU) 점유율이 높음
	- 기업 환경에선 유료 구독 요구 가능
	- 로컬 전용이므로 실제 클라우드 네트워킹과 차이

##### 2. Rancher Desktop
- **개요**: k3s 기반 **Rancher Desktop**(맥·윈·리눅스)에서 버튼 한 번으로 싱글-노드 k8s. 컨테이너 런타임을 **containerd**·**dockerd** 중 선택하고, `nerdctl`·`kubectl`·`helm`을 함께 제공
- **장점**
	- 100 % 오픈소스·무료, 회사 라이선스 걱정 없음
	- GUI 슬라이더로 CPU/메모리/디스크 즉시 조절
	- k8s 버전 선택·변경이 간편, 최신 베타도 바로 테스트
	- Docker Desktop과 유사한 UX + 윈·맥·리눅스 모두 지원
	- “docker buildx” 대신 **nerdctl/buildkit** 기반 빌드 실습 가능
- **단점**
	- 아직 기능·UI가 빠르게 변동 중(안정성·문서 부족)
	- Docker Desktop과 동시 실행 시 포트 충돌 가능
	- 기업용 상용 지원(SLA)은 Rancher Prime 구독이 필요
	- 일부 윈도 환경(Wsl2)에서 네트워크 설정 제약

##### 3. k3d
- **개요**: Rancher k3s(경량 k8s)를 **Docker 컨테이너**에 올려주는 CLI 래퍼. 몇 초 만에 멀티-노드 생성·삭제
- **장점**
	- 매우 가볍고 빠름(k3s + 컨테이너 조합)
	- CI 파이프라인·GitHub Actions 등에서도 손쉽게 사용
	- `k3d cluster create --agents 3` → 멀티-노드 시뮬레이션 용이
- **단점**
	- k3s 경량화로 Upstream k8s와 100 % 기능 동일하지 않음
	- 커뮤니티 프로젝트(공식 SLA 없음)

##### 4. minikube
- **개요**: CNCF 공식 로컬 k8s 툴. Driver(Docker, Podman, VM, HyperKit 등) 선택 가능
- **장점**
	- Upstream Kubernetes 그대로 빌드 → 기능 차이 거의 없음
	- 애드온(ingress-nginx, dashboard 등)을 한 줄로 활성화
	- x86·ARM 맥 모두 지원, 드라이버 선택 폭 넓음
- **단점**
	- VM Driver 사용 시 부팅 속도·자원 소모가 k3d보다 큼
	- 멀티-노드 지원은 있지만 설정이 복잡하고 느림
	- 일부 Driver(예: Podman)는 아직 실험적

##### 5. Amazon EKS
- **개요**: AWS 매니지드 k8s 서비스. 컨트롤 플레인·ETCD·업그레이드·보안패치를 AWS가 운영
- **장점**
	- 프로덕션급 SLA, 자동 패치·백업·확장
	- VPC, IAM, ALB, EBS CSI 등 AWS 서비스와 깊이 통합
	- Fargate(서버리스)·Auto Mode 등 비용 최적화 옵션
- **단점**
	- 컨트롤 플레인 고정 월 과금 + 노드(EC2/Fargate) 비용
	- IAM·VPC·SG 등 AWS 지식 요구, 로컬 대비 복잡
	- 클러스터 생성·삭제 시간이 로컬 툴 대비 길다(수 분)

---
### 비교

|        항목        | Docker Desktop | Rancher Desktop |     k3d      |   minikube    |  Amazon EKS   |
| :--------------: | :------------: | :-------------: | :----------: | :-----------: | :-----------: |
|    **설치 위치**     |    로컬(데스크톱)    |    로컬(데스크톱)     |   로컬 컨테이너    |  로컬 VM/컨테이너   |   AWS 클라우드    |
|   **클러스터 규모**    |    1 – 3 노드    |    1 – 3 노드     |   1 – n 노드   |   1 – n 노드    |  수십 – 수백 노드   |
|    **시작 속도**     |       빠름       |       빠름        |  **가장 빠름**   | 보통(Driver 의존) |      수 분      |
|    **자원 사용량**    |       높음       |       중간        |      낮음      |      중간       |    클라우드 과금    |
| **Upstream 호환성** |       높음       |   높음(k3s 기반)    |  중간(k3s 특유)  |   **가장 높음**   |   100 %(정식)   |
|    **관리 편의성**    |     GUI 친화     |     GUI 친화      |   CLI 한 줄    |   CLI 다수 옵션   | 완전 관리형(구성 필요) |
|    **대표 용도**     |    맥북 단일 개발    |  맥/윈/리눅스 로컬 실습  | CI 테스트·경량 데모 |   기능 실습·워크숍   |  프로덕션·스케일 아웃  |