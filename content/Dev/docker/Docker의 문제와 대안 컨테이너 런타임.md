---
tags: 
created: 2025-06-04T19:42:42
updated: 2025-06-03T22:26:23
permalink: /Dev/docker/docker-limitations-and-alternative-container-runtimes
---
> [!success] 참고영상
> <iframe width="560" height="315" src="https://www.youtube.com/embed/NGAxHC0f1wU?si=lP6eWK_NLg_txMPY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

---
### 1. 왜 “탈 Docker”가 이슈인가?

Docker는 2013년 **컨테이너 + 손쉬운 CLI** 로 센세이션을 일으켰지만, 업계 표준(OCI)[^2]과 클라우드 네이티브 생태계가 성숙하면서 몇 가지 한계가 부각

- **데몬 의존 구조** 
	- `dockerd`(root 권한)가 항상 상주 → 단일 실패 지점(SPOF)[^1], 잠재적 권한 상승 위험  
	- `dockerd → containerd → runc` 3단 호출 + Windows/Mac은 추가 VM 계층 ⇒ 오버헤드
- **Kubernetes 변화** 
    - v1.24 이후 Dockershim 제거 → kubelet이 Docker를 직접 호출하지 않음
    - containerd·CRI-O를 기본으로 쓰는 클러스터가 표준화
- **라이선스·비즈니스 리스크**
	- 2021 Docker Desktop 유료화, 2023 Docker Hub 무료 팀 플랜 폐지 소동
	- 기업·오픈소스 단체가 “대안 찾아야 하나?” 모드 돌입
- **모놀리식 도구 ⇔ 모듈형 파이프라인**  
	- 빌드·런·푸시가 한 CLI에 묶여 있어 세분화·자동화가 어려움 
	- BuildKit, Ko, Kaniko 같은 전문 빌더·레지스트리 툴로 분화 중

> 이제는 **목적별 경량 런타임**을 조합하는 흐름이 대세.

---
### 2. 대안 런타임 5선 깊이 있게 보기

##### containerd : Docker에서 추출한 고수준 데몬
- 이미지 풀·스토어·컨테이너 생애주기 관리만 담당, runc 등 저수준 런타임 호출.  
- 강점
	- Kubernetes와 CRI로 직접 통합 → Dockershim X, 오버헤드↓  
	- `nerdctl` CLI 덕분에 Docker-like 경험  
	- 광범위한 플러그인: snapshotter, Firecracker 통합 등
- 주의
	- 빌드/Compose UI 없음 → BuildKit·Helm·Kustomize 등과 조합 필요
- 실무 Tip  
	- 대부분의 클라우드 K8s(GKE, EKS 등)는 이미 containerd를 기본 런타임으로 사용  
	- 데스크톱 개발자는 Docker 대신 “Rancher Desktop + containerd” 구성이 인기

##### Podman : Red Hat 주도, libpod 기반 CLI
- 각 컨테이너 = 개별 프로세스
- 강점
	- **루트 권한 불필요** (rootless) → 보안·운영성↑  
	- 데몬 상주 X → 메모리·CPU 풋프린트 최소  
	- Docker와 1:1 CLI + `podman generate kube` 로 K8s 매니페스트 변환
- 주의
	- Windows/Mac에서는 내부 VM(예: QVMM) 띄워야 해 최초 설정 번거로움  
	- Docker Compose 완전 호환은 `podman-compose` 등 외부 툴 의존
- 실무 Tip  
	- RHEL·Fedora·CentOS 8+ 기본 엔진, 정부·금융권 내부망에서 빠르게 채택  
	- Docker Desktop 라이선스 회피용으로 **Podman Desktop**이 각광

##### CRI-O : Kubelet ↔ OCI runtime 중계 전용
- 기능을 ‘필수’로만 한정.  
- 강점
	- 코드베이스 작고 쿠버네티스 버전과 1:1 매칭 → 테스트 조합 감소  
	- 기본 runtime은 runc, 필요 시 Kata Containers 등으로 핫스왑 가능
- 주의
	- K8s 환경 밖에서는 사실상 쓸 일이 없음  
	- 독립 CLI·빌더 없음 → 개발용엔 부적합
- 실무 Tip  
	- Red Hat OpenShift 4 기본 런타임, 대규모 금융권 K8s에서도 운영 사례 다수  
	- kubeadm 설치 → `--cri-socket=unix:///var/run/crio/crio.sock`로 간편 교체

##### Kata Containers : 컨테이너마다 경량 VM(QEMU/KVM) 생성 → 호스트 커널 불공유
- 강점
	- 멀티테넌트·SaaS에서 **강력한 격리**(게스트 커널)  
	- Docker/CRI-O/containerd에 플러그인 형태로 붙어 투명 호환  
	- Ant Group, IBM Cloud 등 **대규모 실적**으로 보안·성능 검증
- 주의
	- VM 부팅 · 메모리 오버헤드 → 밀도·지연 시간 trade-off  
	- 관측성(Log/Trace)·네트워킹 튜닝 필요 → 운영 복잡
- 실무 Tip
	- K8s `RuntimeClass` 로 워크로드별 runc ↔ kata-runtime 스위칭  
	- GPU 워크로드는 드라이버 패스스루 등 추가 설정 고려

##### Firecracker : AWS Lambda·Fargate 안에서 쓰이는 초경량 VMM
- 강점
	- **수십 ms 부팅**·수 MB 메모리 ⇢ 서버리스 콜드 스타트 해결  
	- 불필요 장치 제거 → 보안 공격면 최소  
	- `firecracker-containerd` 통합으로 OCI 워크플로우 연장
- 주의
	- CLI 경험 빈약, 이미지 준비·API 호출 필요 → 일반 개발자가 직접 쓰긴 난이도↑  
	- KVM 의존 → Windows/Mac 호스트 직접 실행 불가
- 실무 Tip*
	- 서버리스 FaaS, 멀티테넌트 PaaS, CI/CD sandbox 격리 용도에 적합  
	- Kata Containers VMM 옵션으로 Firecracker 사용해 “초경량 VM + 컨테이너” 하이브리드 가능

---

### 3. “언제 어떤 런타임?” 결정 체크리스트
| 상황 | 추천 조합 | 이유 |
|------|-----------|------|
| **개발 PC에서 Docker 비용·오버헤드 부담** | Podman or Rancher Desktop+containerd | 데몬리스·무료 CLI/GUI |
| **쿠버네티스 클러스터 단순·안정·공식지원** | containerd (대부분) / CRI-O (OpenShift) | CRI 표준 구현, 테스트 범위 축소 |
| **고보안 멀티테넌시·불신 워크로드** | Kata Containers | VM 수준 격리 + OCI 호환 |
| **서버리스 & 초고밀도 배치** | Firecracker (+ containerd) | ms급 부팅, 메모리 풋프린트 최소 |
| **기존 이미지·CI 유지가 최우선** | containerd + BuildKit | Dockerfile 그대로, 빌드 속도↑ |

---

### 4. 정리
컨테이너 생태계는 “다원화”로 진화
Docker가 만들었던 추상화는 OCI 표준으로 제도화됐고, 이제는 **“경량·보안·특화”** 관점에서 런타임을 모듈처럼 갈아끼우는 시대로 접어들었음

- 시작 Tip :  
  1. **개발 환경** → Podman(데몬리스)로 가볍게 체험해보기
  2. **테스트 클러스터** → `kind` 또는 `k3s`에서 containerd 기본 설정 확인
  3. **테나시티 강화용 PoC** → Kata Containers `RuntimeClass` 적용 후 성능 계측
  4. **서버리스 실험** → Firecracker-containerd 샘플 repo 따라 Lambda-like 환경 구축

- 결국 핵심은 표준(OCI) : 이미지 형식·런타임 사양만 맞추면, 빌드·배포 파이프라인은 거의 그대로 유지
- Next Step : 런타임별 모니터링/관측성(toolchain 차이), cgroups v2·eBPF 보안 적용, Confidential Computing 연동 등을 학습하며 **“컨테이너 스택 모듈화”** 감각을 키우기

> [!abstract] 요약
>  Docker는 여전히 친숙한 입구지만, **containerd·Podman·CRI-O·Kata·Firecracker**가 만들어낸 선택지는 이미 풍성  
> 필요에 따라 갈아끼우며 **성능·보안·비용** 세 마리 토끼를 모두 잡을 수 있어야 함

[^1]: Single Point of Failure. 시스템 전체가 하나의 구성 요소에 의존하고 있을 때, 그 요소가 고장나면 전체 서비스가 멈추는 구조

[^2]: Open Container Initiative. 컨테이너 이미지, 런타임의 국제 표준으로 여러 런타임/툴끼리 자유롭게 이미지 주고받고 실행 가능
