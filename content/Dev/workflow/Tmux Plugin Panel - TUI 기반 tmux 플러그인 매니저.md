---
tags:
  - tmux
  - CLI
  - terminal
  - plugin
created: 2026-04-29T00:00:00
updated: 2026-04-29T20:35:09
permalink: /Dev/workflow/tmux-plugin-panel
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> Tmux Plugin Panel은 Rust로 만든 TUI 기반 tmux 플러그인 매니저다. 기존 TPM(Tmux Plugin Manager)의 대안으로, 설정 파일 수정 없이 플러그인 설치/제거/업데이트가 가능하다.

> [!cite]+ Source
> - [psmux/Tmux-Plugin-Panel - GitHub](https://github.com/psmux/Tmux-Plugin-Panel)

---

### 개요

[[터미널 멀티플렉서와 tmux|tmux]] 플러그인 관리는 보통 TPM(Tmux Plugin Manager)을 사용한다. `.tmux.conf`에 플러그인을 직접 적고 `prefix + I`로 설치하는 방식이다.

Tmux Plugin Panel은 이 과정을 TUI로 감싼다. 터미널에서 `tmuxpanel`을 실행하면 플러그인 목록이 뜨고, 선택만 하면 설치된다.

---

### 주요 기능

- **플러그인 브라우징**: 40개 이상의 엄선된 플러그인을 카테고리별로 탐색
- **GitHub 검색**: TUI에서 바로 tmux 플러그인 검색
- **원클릭 관리**: 설정 파일 수정 없이 설치/제거/업데이트
- **테마 갤러리**: tmux 테마를 미리보기 후 전환
- **오프라인 지원**: 내장 레지스트리로 인터넷 없이도 작동

Rust로 작성되어 Windows, Linux, macOS에서 네이티브 바이너리로 동작한다.

---

### 설치

```bash
# macOS
brew install psmux/tap/tmuxpanel

# 또는 cargo로 설치
cargo install tmuxpanel
```

> [!note]+ TPM과의 관계
> TPM을 대체하는 도구이지만, 기존 TPM 설정과 공존할 수 있다. TPM에서 마이그레이션할 때 기존 플러그인을 자동으로 감지한다.
