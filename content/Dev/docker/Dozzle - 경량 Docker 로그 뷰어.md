---
tags:
  - docker
  - DevOps
  - logging
created: 2026-05-16T10:00:00
updated: 2026-05-16T10:00:00
permalink: /Dev/docker/dozzle
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Dozzle은 Docker 소켓 마운트만으로 컨테이너 로그를 실시간 조회하는 경량 웹 UI
> - ELK 스택 같은 풀 옵저버빌리티 파이프라인 없이 빠르게 로그 확인 가능
> - JSON 구조화 로그에 SQL 쿼리, 로그 레벨 필터링, ntfy 알림 연동 지원
> - Docker Compose / Swarm / Kubernetes(K3s) 모두 지원

> [!cite]+ Source
> - [Stop Overengineering Logs. Use This Instead - DevOps Toolbox](https://youtube.com/watch?v=ztjlsmJcVnE)

---

### 1. Dozzle이 해결하는 문제

컨테이너 로그를 확인하려면 보통 `docker logs`를 반복 실행하거나, ELK/Grafana Loki 같은 풀스택 옵저버빌리티 파이프라인을 구축한다. 전자는 불편하고, 후자는 홈랩이나 소규모 환경에서는 과도하다.

Dozzle은 그 사이를 채우는 도구다. Docker 소켓만 마운트하면 컨테이너 로그를 웹 UI로 실시간 확인할 수 있다.

---

### 2. 핵심 기능

- **실시간 로그 스트리밍**: 컨테이너별 stdout/stderr 분리 필터링
- **로그 레벨 색상 코딩**: debug/info/warning/error를 시각적으로 구분
- **멀티 패널 레이아웃**: 여러 컨테이너 로그를 나란히 비교
- **SQL 분석**: JSON 구조화 로그를 DuckDB 기반 SQL로 즉석 쿼리 (클라이언트 사이드 실행)
- **알림 시스템**: 로그 패턴 매칭, CPU/메모리 메트릭, 컨테이너 이벤트(start/stop/restart) 기반 알림
- **알림 대상**: Slack, Discord, ntfy 웹훅 지원
- **리소스 모니터링**: CPU/메모리 사용량 대시보드

---

### 3. 실행 방법

```bash
docker run -d --name dozzle \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 8080:8080 \
  amir20/dozzle:latest
```

Kubernetes에서는 환경 변수 `DOZZLE_MODE=k8s`를 설정하고 pod get/list/watch 권한을 부여한다.

---

### 4. Dozzle vs lazydocker

[lazydocker](https://github.com/jesseduffield/lazydocker)는 터미널 TUI 기반의 Docker 관리 도구다. 로그 확인뿐 아니라 컨테이너 재시작, 삭제, 이미지 정리 등 **관리 기능**을 제공한다. Dozzle과 목적이 다르다.

| 항목 | Dozzle | lazydocker |
|------|--------|------------|
| 인터페이스 | 웹 브라우저 UI | 터미널 TUI |
| 주요 목적 | 로그 스트리밍/조회 | 컨테이너 전반 관리 |
| 컨테이너 제어 | 읽기 전용 (관리 기능 없음) | 재시작, 삭제, 리빌드, prune |
| 리소스 모니터링 | 웹 대시보드 | ASCII 그래프 (터미널 내) |
| 원격 접근 | HTTP로 네트워크 접근 가능 | SSH로 호스트 접속 필요 |
| 로그 분석 | SQL 쿼리, 레벨 필터링, 알림 | 단순 로그 뷰어 |
| 설치 | Docker 이미지 실행 | 싱글 바이너리 |

> [!tip]+ 선택 기준
> - 여러 사람이 로그를 보거나 원격 환경 → **Dozzle** (웹 UI)
> - 터미널에서 직접 컨테이너를 조작하며 관리 → **lazydocker** (TUI)
> - 둘 다 가볍고 Go로 작성되어 있어서 함께 사용해도 충돌 없음

---

### 5. 참고 사항

- Docker 공식 스폰서 오픈소스, DockerHub 3억+ pulls
- Go로 작성됨, 매우 작은 리소스 풋프린트
- Podman 지원은 제한적 (소켓 설정 차이)
- 유료 클라우드 옵션에서 AI 로그 요약, 이메일/Telegram 알림 등 추가 기능 제공
