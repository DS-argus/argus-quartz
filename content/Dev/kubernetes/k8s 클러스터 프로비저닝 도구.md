---
tags:
  - k8s
  - provisioning
created: 2025-06-04T23:16:25
updated: 2025-06-04T23:27:14
---
> [!abstract]+ TL;DR
> - **Docker Desktop** 로컬 개발 → `kind` 빠른 테스트  
> - 베어메탈·VM → `kubeadm`으로 기본 부트스트랩 후 필요 시 `Kubespray`로 확장  
> - 클라우드 운영 → `kOps`(AWS/GCP)로 완전 자동화  

---
### Kubernetes 클러스터 프로비저닝 툴 비교

- Provisioning : 필요한 리소스 (서버, 네트워크, 스토리지 등)를 할당/설치/구성해서 쓸 수 있게 준비하는 일
- k8s cluster provisioning method : 쿠버네티스 마스터/워커 노드 구성, 네트워킹, 인증 등 전체 클러스터를 자동 또는 수동으로 준비하는 다양한 방식 
##### 1. kubeadm
- **Type**: Upstream CLI 부트스트랩 도구  
- **어디서 쓰나**: 베어메탈·VM·클라우드 VM, Docker Desktop에서는 `kubeadm` 프로비저너(legacy) 선택 가능  
	- [kubeadm 공식 문서](https://kubernetes.io/docs/reference/setup-tools/kubeadm/)
	- [Docker Desktop - Kubernetes 안내](https://docs.docker.com/desktop/features/kubernetes/#cluster-provisioning-method)
- **장점**
	- 공식 Best-Practice “최단 경로”, Conformance 통과 가능  
		- [kubeadm로 클러스터 만들기](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
	- 학습용·소규모 프로덕션까지 범용
- **단점**
	- IaaS 리소스(노드, LB, 네트워크)를 사용자가 직접 준비
	- Docker Desktop 기준 싱글-노드·프로비저닝 속도 느림  
##### 2. kind (Kubernetes IN Docker)
- **Type**: 컨테이너-노드 로컬 클러스터  
- **어디서 쓰나**: 로컬 개발·CI; Docker Desktop에서 `kind` 프로비저너(빠른 멀티-노드)로 선택 가능  
	- [kind GitHub](https://github.com/kubernetes-sigs/kind)
	- [Docker Desktop - Kubernetes 안내](https://docs.docker.com/desktop/features/kubernetes/#cluster-provisioning-methodk)
- **장점**
	- 컨테이너 몇 초 안에 부팅 → 테스트·CI 최적  
		- [kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)
	- `kind create cluster --nodes N`으로 다중 노드 시뮬레이션
- **단점**
	- 컨테이너 네트워킹 특성상 대용량·퍼시스턴트 스토리지 테스트 제약
	- ECI(Enhanced Container Isolation) 보호 제한적  

##### 3. kOps (Kubernetes Operations)
- **Type**: 클라우드(API) 자동화 CLI(AWS·GCP)  
	- %%  %%[AWS - kOps 블로그](https://aws.amazon.com/blogs/compute/kubernetes-clusters-aws-kops/)
- **장점**
	- EC2·Route 53·ELB 등 인프라부터 K8s 롤링 업그레이드까지 코드로 관리
	- 다중 AZ/HA 구성·Add-on 자동 설치
- **단점**
	- AWS 중심(GCP 베타) → 멀티 클라우드 한계
	- CLI 학습 필요, IAM·DNS 준비 필수  

##### 4. Kubespray
- **Type**: Ansible 플레이북 기반 멀티-노드 자동화  
	- [Kubespray GitHub](https://github.com/kubernetes-sigs/kubespray)
	- [Kubespray 사용 예시 글](https://dev.to/esthernnolum/provisioning-kubernetes-clusters-with-kubespray-1a2i)  
- **장점**
	- 베어메탈·온프렘·모든 클라우드 대응 ― 인프라 독립
	- Calico/Flannel, HA ETCD, Cloud Provider 모듈 등 변수화
- **단점**
	- Ansible/SSH 인벤토리 관리 지식 요구
	- 버전 업·인프라 변경 시 플레이북 충돌 가능성  

---
### 비교

|     Tool      |            설치 대상             |      자동화 범위      |       주요 장점       |          주요 한계          |
| :-----------: | :--------------------------: | :--------------: | :---------------: | :---------------------: |
|  **kubeadm**  | 기존 노드(BM/VM), Docker Desktop | K8s 부트스트랩·업그레이드  | 공식 최단 경로, 호환성 최고  | IaaS 수동 준비, 로컬 싱글-노드 한계 |
|   **kind**    |           로컬 컨테이너            |   로컬 클러스터 전과정    |   가장 빠름, CI 친화    |      네트워킹·스토리지 제약       |
|   **kOps**    |           AWS(GCP)           |   인프라+K8s 전과정    | 프로덕션 HA, 롤링 업그레이드 |      클라우드 종속, 러닝커브      |
| **Kubespray** |          임의 IaaS/BM          | K8s 전과정(Ansible) |   인프라 독립, 옵션 유연   |      Ansible 관리 복잡      |
