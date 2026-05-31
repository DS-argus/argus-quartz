---
tags:
  - CLI
  - terminal
  - Rust
  - package_manager
created: 2026-04-16T00:00:00
updated: 2026-06-01T00:00:00
permalink: /dev/workflow/zerobrew-a-5-20x-faster-experimental-homebrew-alternative
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> zerobrew는 Homebrew의 Rust 기반 대안으로, 동일한 패키지를 5~20배 빠르게 설치한다. 기존 `brew` 명령어를 그대로 쓸 수 있는 drop-in 구조이며, Homebrew와 별도 경로(`/opt/zerobrew`)에서 동작하므로 안전하게 병행 사용이 가능하다.

### 1. 패키지 매니저가 느린 이유

macOS에서 개발 도구를 설치할 때 대부분 Homebrew(`brew`)를 사용한다. 하지만 Homebrew는 Ruby로 작성되어 있고, 패키지 설치 시 순차적으로 다운로드하고 추출하는 구조라 체감 속도가 느리다.

특히 아래 상황에서 답답함을 느끼게 된다.

- `brew install`이 수십 초~수 분 걸리는 경우
- `brew update` 자체가 느린 경우
- CI/CD 파이프라인에서 패키지 설치가 병목이 되는 경우

이런 문제의 근본 원인은 Homebrew의 아키텍처가 병렬 처리나 캐싱 최적화에 한계가 있기 때문이다.

---

### 2. zerobrew란

[zerobrew](https://github.com/lucasgelfond/zerobrew)는 Homebrew의 drop-in 대체 CLI 도구다. Rust로 작성되어 있으며, Homebrew의 패키지 레지스트리(CDN)를 그대로 사용하면서 설치 과정만 최적화한다.

> [!info]+ 핵심 특징
> - Homebrew formulae를 **읽기 전용**으로 사용 (Homebrew 디렉토리에 쓰지 않음)
> - 별도 경로(`/opt/zerobrew`)에 설치되어 Homebrew와 충돌 없이 병행 가능
> - 기존 `brew` 명령어를 `zb`로 대체해서 사용

Python 생태계에서 [[python uv - An extremely fast Python package and project manager|uv]]가 pip/poetry를 대체하는 것과 같은 포지셔닝이다. 둘 다 Rust 기반이고, 기존 레지스트리를 활용하면서 설치 속도만 극적으로 개선한다.

---

### 3. 왜 빠른가

zerobrew가 속도를 끌어올리는 핵심 기법들은 다음과 같다.

- **Content-addressable store (SHA-256)**: 같은 내용의 파일은 한 번만 저장한다. 이미 설치된 패키지가 있으면 즉시 재사용한다.
- **APFS clonefile (Copy-on-Write)**: macOS의 APFS 파일시스템 기능을 활용해서 파일 복사 없이 링크만 생성한다. 디스크 I/O를 최소화한다.
- **병렬 다운로드**: 여러 패키지를 동시에 내려받는다.
- **스트리밍 추출/링킹**: 다운로드와 추출을 파이프라인으로 처리한다.
- **HTTP 캐싱**: 이미 받은 패키지 정보를 공격적으로 캐싱한다.

> [!tip]+ 성능 수치
> - Cold install (처음 설치): 약 **5배** 빠름
> - Warm install (캐시 있을 때): 약 **20배** 빠름
> - Re-install: 거의 즉시 완료

---

### 4. 설치 및 사용법

```bash
# 설치
curl -fsSL https://raw.githubusercontent.com/lucasgelfond/zerobrew/main/install.sh | bash
```

```bash
# 기본 사용법 (brew 대신 zb)
zb install ripgrep
zb install bat
zb uninstall ripgrep
```

> [!note]+ Homebrew와 병행 사용 권장
> zerobrew는 아직 실험적인 프로젝트다. Homebrew를 완전히 제거하고 대체하는 것보다는 **병행 사용**이 안전하다. zerobrew는 `/opt/zerobrew`에 독립적으로 설치되므로 기존 Homebrew 환경에 영향을 주지 않는다.

> [!note]+ TUI 없음
> zerobrew는 순수 CLI만 제공한다. [[터미널 세팅|taproom]] 같은 TUI는 내부적으로 `brew` 명령을 호출하는 구조이므로 zerobrew와 직접 연동되지 않는다.

---

### 5. Linux에서의 차이점

Linux에서도 zerobrew를 사용할 수 있다. 다만 APFS clonefile은 macOS 전용 기능이므로 이 최적화는 적용되지 않는다. 병렬 다운로드 등 나머지 최적화는 동일하게 동작한다.

- 설치 경로: `~/.local/share/zerobrew`

---

### 6. 참고

- [zerobrew GitHub](https://github.com/lucasgelfond/zerobrew)
- [daleseo.com 소개글](https://daleseo.com/zerobrew/)
