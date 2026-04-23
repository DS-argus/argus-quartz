---
tags:
  - bitnami
  - Cloud
  - docker
  - k8s
created: 2025-06-02T23:05:13
updated: 2025-06-02T23:17:20
permalink: /Dev/docker/bitnami-docker-images
---
> [!abstract] TL;DR
>-  Bitnami 이미지는 **“비전문가도 운영 가능한 수준까지 자동화된, 보안 강화·멀티아키 지원 컨테이너 스택”**
>- Spark·Airflow·Kafka처럼 구성 요소 많은 시스템을 **빠르게 실습**하거나 **K8s-Helm 배포를 표준화**하려면 Bitnami가 효율적 
>- 반면 **미세 조정이 필요하거나 초경량 이미지**가 목표라면 Apache 공식이 더 적합

---
### 1. Bitnami란?
- **오픈소스 애플리케이션 패키징 전문 기업**. 단일 빌드로 퍼블릭 클라우드·VM·컨테이너·쿠버네티스까지 동일한 스택을 배포하도록 설계된 카탈로그를 제공
- 2019 년 VMware(현 Broadcom Tanzu)​에 인수된 뒤 **Tanzu Application Catalog** 브랜드를 통해 기업-등급 지원도 제공

---

### 2. Bitnami 이미지의 핵심 특징
| 특징                   | 설명                                            | 장점                                    |
| -------------------- | --------------------------------------------- | ------------------------------------- |
| **Non-root 기본 설정**   | 컨테이너 UID/GID 1,000 비루트 실행                     | PodSecurity/SELinux/OCP 제약 통과, 공격면 축소 |
| **멀티아키 빌드**          | 동일 태그에 `linux/amd64`+`linux/arm64` 매니페스트 포함   | M1/M2 맥·라즈베리파이에서도 즉시 실행               |
| **보안 패치 자동화**        | 신규 CVE 감지 → 24–48 h 내 이미지 재빌드                 | 장기 운영 시 CVE 노출 최소화                    |
| **SBOM·서명 포함**       | `/opt/bitnami/*.spdx` 경로에 SPDX SBOM 내장        | 규제·감사 대응, 서드파티 스캐너 호환                 |
| **통일된 ENV·경로**       | 모든 앱이 `/opt/bitnami`, 공통 `*_PASSWORD` 변수      | Helm/Compose 템플릿 간편 재사용               |
| **Dev ↔ Prod 태그 분리** | `*-debian-11`(prod) / `*-debian-11-root`(dev) | 로컬 디버깅 편의성과 운영 보안 동시 확보               |

---
### 3. Apache 공식 이미지와 비교
| 구분      | **Bitnami**               | **Apache 공식**      |
| ------- | ------------------------- | ------------------ |
| 기본 사용자  | non-root                  | root(프로젝트마다 상이)    |
| 초기 구성   | ENV 한 줄로 TLS·클러스터·LDAP 설정 | `conf/` 직접 마운트·재빌드 |
| 업데이트 속도 | 커뮤니티 릴리스 ±1 일, CVE 전용 릴리스 | 릴리스 태그 기반(느릴 수 있음) |
| 멀티아키 지원 | amd64/arm64 동시            | 일부만 arm64          |
| 이미지 크기  | 경량(distroless Debian)     | 표준 Debian/Alpine   |
| 상용 지원   | Tanzu Application Catalog | 없음                 |

> [!example] 예시
> - *Apache Kafka*: `bitnami/kafka`는 ZooKeeper 내장·KRaft 모드 ENV 지원 → 단일 컨테이너로 로컬 POC 가능  
> - *Apache Airflow*: `bitnami/airflow-*` 3-way 스플릿(웹·스케줄러·워커) → Helm/Compose 수평 확장 그대로 이전

---
### 4. 사람들이 Bitnami를 많이 쓰는 이유
1. **배포-친화적 기본값** – SSL·클러스터 부트스트랩을 ENV로 끝냄  
2. **팀 일관성** – 동일 로그·볼륨 레이아웃 덕분에 운영 SOP 작성이 쉬움
3. **보안·컴플라이언스** – SBOM·이미지 서명 공개로 감사 대응 시간↓ 
4. **로컬-클라우드 동일 환경** – arm64 맥에서도 그대로 구동
5. **Helm 차트 연계** – K8s 베스트프랙티스를 기본 내장

---
### 5. 주의할 점
- **버전 고정**: `latest` 태그가 없으므로 `bitnami/kafka:3.7.0-debian-11-r0` 처럼 명시해야 재현성 확보
- **Docker Hub 레이트 리밋**: 2024-12-16부터 일반 Bitnami 카탈로그도 표준 리밋 적용 → CI 대량 풀링 시 캐시 필요
- **설정 파일 경로 차이**: `/opt/bitnami/<app>/conf` 경로가 공식 문서와 다를 수 있어, 설정 복사 시 주의
