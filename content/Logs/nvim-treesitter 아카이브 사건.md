---
tags:
  - neovim
  - treesitter
  - terminal
created: 2026-04-20T00:00:00
updated: 2026-09-10T14:37:05
permalink: /Logs/nvim-treesitter-archive-incident
---
> [!abstract]+ TL;DR
> - 2026년 4월 nvim-treesitter 아카이브 사건과 유지보수 부담
> - 2026년 9월 10일 확인 기준, 아카이브 해제와 `main` 개발 지속
> - Neovim 0.12 이상을 요구하는 `main`과 0.11용으로 동결된 `master`의 구분

> *AI-assisted*

---

### Tree-sitter

Tree-sitter는 소스 코드를 파싱해서 구문 트리(AST)를 만들어주는 파서 생성기다. 기존 정규식 기반 구문 강조보다 정확하고 코드 접기나 텍스트 오브젝트 선택 같은 기능도 가능하게 해준다.

각 언어마다 별도의 파서(grammar)가 필요하며 **nvim-treesitter**는 이 파서를 설치하고 관리하는 Neovim 플러그인이다.

---

### What happened

2026년 3월, 메인테이너가 [[Neovim 0.12 릴리즈 정리|Neovim 0.12]]를 필수로 하는 전면 재작성을 했다. 0.11 사용자를 위해 frozen master 브랜치도 따로 제공했지만 하위 호환을 요구하는 이슈와 PR이 계속 올라왔다. 결국 2026년 4월 3일 [프로젝트를 아카이브했다](https://byteiota.com/nvim-treesitter-archived-13k-star-plugin-shut-down-2026/).

GitHub 아카이브는 저장소를 read-only로 전환하는 기능이다. 코드는 남아있고 clone/fork는 되지만 새 이슈·PR 작성과 커밋 push는 막힌다. 소유자가 아카이브를 해제하면 저장소 활동을 재개할 수 있다.

---

### Community reaction

커뮤니티 여론은 대체로 메인테이너 편이었다.

- HN 댓글 대다수가 메인테이너의 결정을 지지
- "오픈소스 사용자들이 공짜 점심을 기대한다"는 비판이 많았다
- 한 개발자는 "이런 일 때문에 오픈소스 배포 자체가 불안하다"고 토로
- 오래 써온 유저들은 아쉬움과 함께 감사하다는 반응

[ThePrimeagen](https://youtube.com/watch?v=53t6PllRXOI)도 이 사건을 영상으로 다뤘다. 그는 평소부터 오픈소스 메인테이너의 번아웃과 사용자 entitlement 문제를 비판적으로 다뤄온 유튜버다. 오픈소스 메인테이너의 60%가 무급이고 44%가 번아웃을 경험한다는 조사 결과도 있다.

---

### 이후 소식 (2026년 9월 10일 확인)

저장소는 아카이브가 해제된 상태이며 `main`에서 개발이 이어지고 있다. 공식 저장소의 [7월 18일 Discussion](https://github.com/nvim-treesitter/nvim-treesitter/discussions/8643)에는 사용자가 아카이브 해제에 감사를 전한 글이 올라왔다. 이 글은 메인테이너의 재개 공지는 아니므로 해제일을 특정하는 근거로 삼지는 않는다.

- **7월 19일, Python 성능 수정**: [f-string injection query 수정](https://github.com/nvim-treesitter/nvim-treesitter/commit/7248feaca45e4d944591497964bc19afa89ad1c6)으로 Neovim의 match limit 제거 이후 발생할 수 있는 성능 저하에 대응했다.
- **9월 1일, Protocol Buffers 지원 갱신**: [proto parser와 query 업데이트](https://github.com/nvim-treesitter/nvim-treesitter/commit/427e9222363d07c32d6db6169e4049c28d58d141)가 반영됐다. `proto2`·`proto3` anonymous node 제거를 포함한 breaking change다.

[현재 README](https://github.com/nvim-treesitter/nvim-treesitter#readme)는 `main`과 `master`를 다음과 같이 구분한다.

| 브랜치 | 요구 버전과 상태 | 설정 시 확인할 점 |
| --- | --- | --- |
| `main` | Neovim 0.12 이상, 개발 지속 | 기존 설정과 호환되지 않는 전면 재작성 버전. README에 맞춰 설정을 다시 구성 |
| `master` | Neovim 0.11 호환용, 동결 상태 | 기존 버전을 유지하려면 브랜치를 명시적으로 지정 |

> [!note]+ 업데이트: 플러그인과 파서 버전 맞추기
> - `main`은 `tree-sitter-cli` 0.26.1 이상을 요구하며 lazy-loading을 지원하지 않음
> - 플러그인을 갱신할 때 설치한 파서도 `:TSUpdate`로 갱신해야 함
> - 구문 강조와 접기는 Neovim 내장 기능을 사용하며 별도 활성화 설정이 필요함
