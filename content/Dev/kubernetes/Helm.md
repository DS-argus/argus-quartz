---
tags:
  - helm
  - k8s
created: 2025-06-12T14:02:14
updated: 2025-06-12T14:03:08
permalink: /Dev/kubernetes/helm
---
### Helm이란?

Helm은 Kubernetes에서 사용되는 애플리케이션 패키지 매니저임  
Kubernetes 리소스를 **차트(chart)**라는 형태로 미리 정의하여 간단히 배포할 수 있게 해줌

---
### Helm의 주요 개념

- **차트(Chart)**:  
  Kubernetes 리소스를 정의한 Helm 패키지로, YAML 파일들의 모음임  
  차트는 쉽게 공유하고 관리할 수 있으며, 버전 관리도 지원됨

- **릴리스(Release)**:  
  Helm 차트를 실제 Kubernetes 클러스터에 설치한 특정 인스턴스임  
  Helm을 통해 차트를 배포하면 각각의 배포본이 **릴리스**라는 이름을 가짐

- **레포지토리(Repository)**:  
  Helm 차트를 저장하고 공유하는 공간으로, GitHub 저장소나 웹 서버 등을 활용할 수 있음

---
### Helm의 장점

- 복잡한 Kubernetes 리소스 관리를 간편화  
- 설정 파일 중복 방지  
- 버전 관리 및 롤백 기능 제공  
- 다양한 애플리케이션을 표준화된 형태로 쉽게 배포 가능

---
### Helm 명령어 예시

- 차트 생성
```bash
helm create mychart
```

- 차트 설치
```bash
helm install myrelease mychart
```

- 설치된 릴리스 확인
```bash
helm list
```

- 릴리스 업그레이드
```bash
helm upgrade myrelease mychart
```

- 릴리스 삭제
```bash
helm uninstall myrelease
```

---
### Helm의 구성요소

- **values.yaml**: 설정값을 정의하는 파일로, 환경에 따라 손쉽게 변경 가능
- **templates/**: Kubernetes 리소스가 정의된 템플릿 파일들이 위치하는 폴더
- **Chart.yaml**: 차트 메타데이터 및 의존성 정보 포함

---
### Docker & Docker Compose vs Kubernetes & Helm 비교 요약

| 도구             | 역할           | 비유적 대응     |
| -------------- | ------------ | ---------- |
| Docker         | 컨테이너 생성 및 실행 | Kubernetes |
| Docker Compose | 컨테이너 집합 관리   | Helm       |

즉, Helm은 Kubernetes 환경에서 Docker Compose처럼 애플리케이션을 쉽게 관리하고 배포하는 도구라고 생각하면 이해하기 쉬움

