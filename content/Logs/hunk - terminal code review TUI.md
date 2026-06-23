---
tags:
  - tool
  - terminal
  - git
  - DevOps
created: 2026-06-22T00:00:00
updated: 2026-06-22T00:00:00
permalink: /Logs/hunk-terminal-code-review-tui
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - `hunk`은 터미널에서 diff를 GitHub처럼 보여주는 코드 리뷰 TUI — Sentry 공동창업자 Ben Vinegar 제작
> - syntax highlighting, side-by-side/stacked 뷰, vim 모션, 라인 단위 노트(코멘트) 제공
> - 핵심은 **AI 에이전트가 코드에 코멘트를 남기는** 워크플로 — 사람 노트와 에이전트 노트가 나란히 표시
> - git과 Jujutsu(jj)를 둘 다 first-class로 지원, 하지만 세션이 끝나면 코멘트가 휘발돼 협업 공유는 약함

> [!cite]+ Source
> <iframe width="560" height="315" src="https://www.youtube.com/embed/-4fJbIF8WAs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

---

### 정리

쏟아지는 PR을 터미널에서 제대로 리뷰하자고 만든 도구다. DevOps Toolbox가 소개한 `hunk`은 Sentry 공동창업자였던 Ben Vinegar가 만들었는데, Ghostty로 유명한 Mitchell Hashimoto가 애용한다고 알려지며 주목받았다. 바탕은 OpenTUI(OpenCode를 만든 Anomaly의 프레임워크)다.

`git diff`를 예쁘게 보여주는 도구야 이미 많다. `diff-so-fancy`, Rust로 만든 `delta`, `delta` 위에 TUI를 얹은 `diffnav`가 그런 계보다. `hunk`은 단순 diff 뷰어에서 한발 더 나가 **리뷰 워크플로** 자체를 노린다는 점이 다르다.

설치와 기본 명령은 간단하다.

```bash
brew install hunk   # 또는 npm
hunk show           # 마지막 커밋의 diff
hunk diff           # 아직 커밋 안 된 working 변경
hunk session        # 백그라운드 서버 — 에이전트가 붙는 용도
hunk stash show     # stash 스택의 변경 확인
```

주요 기능을 정리하면 이렇다.

- **뷰**: GitHub 스타일 syntax highlighting, stacked / side-by-side 토글, 파일별 +/- 라인 수, 테마 지원
- **모션**: `Ctrl+D/U` 스크롤, `[ ]` hunk 이동, `gg`/`G`, `hjkl` 등 vim 키맵 그대로
- **노트**: 라인 옆 `+`로 GitHub 코멘트 같은 메모를 남김. `{ }`로 노트 간 이동. 단 git에 기록되지 않고 세션 한정이라 끝나면 사라짐
- **AI 노트**: `hunk session`이 작은 서버를 띄우면 코딩 에이전트가 diff를 읽고 코드에 코멘트를 단다. 사람이 단 노트와 에이전트 노트가 사이드바(`S`)에 색으로 구분돼 함께 보인다
- **VCS**: git뿐 아니라 Jujutsu(jj)도 first-class 지원 — Mitchell Hashimoto가 좋아하는 이유
- **설정**: `~/.config/hunk` 아래 TOML로 VCS·뷰·테마·라인번호·노트 기본값 지정

한계도 분명하다. TUI 경험은 좋지만 **협업에는 약하다.** 코멘트가 GitHub 코멘트와 동기화되지 않고 세션도 공유할 수 없다. 리뷰가 끝나면 노트는 그냥 증발한다. 혼자, 혹은 에이전트와 함께 로컬에서 빠르게 훑어보는 용도에는 맞지만 팀 리뷰를 대체하기엔 아직 갈 길이 멀다. GitHub 코멘트를 터미널로 다루는 `gh-dash` 계열과는 노리는 지점부터 다르다.
