---
tags:
  - neovim
  - markdown
  - tool
created: 2026-06-10T00:00:00
updated: 2026-06-10T20:46:48
permalink: /Obsidian/zennotes
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - ZenNotes는 Vim 모션을 네이티브로 지원하는 키보드 중심 로컬 마크다운 노트 앱
> - CodeMirror 6 기반 에디터에 KaTeX, Mermaid, TikZ 등 라이브 프리뷰 지원
> - 데스크톱(Electron), 셀프호스트(Docker), 웹 세 가지 런타임 제공
> - MCP 서버 내장으로 Claude 등 AI 도구와 볼트 직접 연동 가능
> - Obsidian 볼트 호환을 지원하면서도 Vim 사용자에 최적화된 워크플로우 제공

> [!cite]+ Source
> <iframe width="560" height="315" src="https://www.youtube.com/embed/661XzULWfVU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

---
### 1. ZenNotes란

ZenNotes는 Adib Hanna가 만든 키보드 중심의 로컬 마크다운 노트 앱이다. "Vim 사용자는 더 나은 도구를 받을 자격이 있다"는 생각에서 출발했다.

핵심 철학은 세 가지다.

- **Plain Files First**: 모든 노트가 로컬 `.md` 파일로 저장된다. 별도 DB 없이 파일 시스템 그대로 사용
- **Keyboard-First**: Vim 모션이 "흉내"가 아니라 네이티브로 동작한다. which-key 오버레이, 퍼지 파인더, 버퍼 전환 등 터미널 사용자에게 익숙한 UX 제공
- **Preview as Workflow**: 편집/프리뷰/분할/핀 모드를 자유롭게 전환하며 작업 가능

---
### 2. 주요 기능

- **에디터**: CodeMirror 6 기반. 헤딩 폴딩, 코드 블록 하이라이팅, 위키 링크, 콜아웃, 각주 지원
- **렌더링**: GFM, KaTeX(수식), Mermaid(다이어그램), TikZ, JSXGraph 라이브 프리뷰
- **검색**: ripgrep 또는 fzf 백엔드로 볼트 전체 텍스트 검색
- **MCP 서버**: 내장 MCP 서버로 Claude, Codex 등 AI 도구가 볼트에 직접 접근 가능
- **CLI**: `zen` 명령어로 터미널에서 노트 관리. macOS Raycast 확장도 지원

---
### 3. 런타임 구조

```text
apps/desktop      → Electron (macOS, Windows, Linux)
apps/web          → Vite/PWA 브라우저
apps/server       → Go 백엔드 (파일 I/O, 볼트 접근)
packages/app-core → 공유 React 로직
packages/shared-ui → 공유 UI 컴포넌트
```

데스크톱과 웹이 동일한 코어를 공유하므로 기능 차이가 없다. 셀프호스트는 Docker로 `make up` 한 줄이면 된다.

---
### 4. Obsidian과의 비교

| 항목 | ZenNotes | Obsidian |
| :--- | :--- | :--- |
| Vim 지원 | 네이티브 (실제 Vim 엔진) | 플러그인 (제한적) |
| 저장 형식 | 로컬 `.md` 파일 | 로컬 `.md` 파일 |
| 볼트 호환 | Obsidian 볼트 읽기 가능 | - |
| 셀프호스트 | Docker 지원 | 불가 |
| MCP 연동 | 내장 | 커뮤니티 플러그인 |
| 플러그인 생태계 | 초기 단계 | 매우 풍부 |
| 그래프 뷰 | 미지원 | 지원 |

Vim을 주력으로 쓰는 사용자에게는 ZenNotes가 더 자연스러운 편집 경험을 제공하지만, 플러그인 생태계와 커뮤니티 규모는 Obsidian이 압도적이다.

---
### 5. 참고

- 공식 사이트: zennotes.org
- GitHub: ZenNotes/zennotes
- 개발자: Adib Hanna (@adibhanna)
