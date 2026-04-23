---
tags:
  - neovim
  - treesitter
  - terminal
created: 2026-04-20T00:00:00
updated: 2026-04-20T22:49:56
permalink: /Logs/nvim-treesitter-archive-incident
---
> [!abstract]+ TL;DR
> 2026년 4월, 13k star의 nvim-treesitter 플러그인이 아카이브되었다. Neovim 0.12 필수 요구에 불만을 품은 사용자들의 이슈 폭주가 원인.

> [!cite]+ Source
> - [No More Treesitter on NeoVim - ThePrimeagen](https://youtube.com/watch?v=53t6PllRXOI)
> - [Nvim-Treesitter Archived: 13K-Star Plugin Shut Down - byteiota](https://byteiota.com/nvim-treesitter-archived-13k-star-plugin-shut-down-2026/)

---

### Tree-sitter

Tree-sitter는 소스 코드를 파싱해서 구문 트리(AST)를 만들어주는 파서 생성기다. 기존 정규식 기반 구문 강조보다 정확하고, 코드 접기나 텍스트 오브젝트 선택 같은 기능도 가능하게 해준다.

각 언어마다 별도의 파서(grammar)가 필요한데, **nvim-treesitter**가 이 파서들을 설치/관리해주는 Neovim 플러그인이었다.

---

### What happened

2026년 3월, 메인테이너가 [[Neovim 0.12 릴리즈 정리|Neovim 0.12]] 필수로 전면 리라이트를 진행했다. 0.11 사용자를 위해 frozen master 브랜치도 따로 제공했지만, 하위 호환을 요구하는 이슈와 PR이 계속 올라왔다. 결국 2026년 4월 3일 프로젝트를 아카이브했다.

GitHub 아카이브란 저장소를 read-only로 전환하는 것이다. 코드는 남아있고 clone/fork는 되지만 이슈, PR, 커밋은 전부 차단된다. 사실상 "더 이상 유지보수하지 않겠다"는 선언.

---

### Community reaction

커뮤니티 여론은 대체로 메인테이너 편이었다.

- HN 댓글 대다수가 메인테이너의 결정을 지지
- "오픈소스 사용자들이 공짜 점심을 기대한다"는 비판이 많았다
- 한 개발자는 "이런 일 때문에 오픈소스 배포 자체가 불안하다"고 토로
- 오래 써온 유저들은 아쉬움과 함께 감사하다는 반응

ThePrimeagen도 이 사건을 영상으로 다뤘다. 그는 평소부터 오픈소스 메인테이너의 번아웃과 사용자 entitlement 문제에 비판적인 입장을 보여온 유튜버다. 참고로 오픈소스 메인테이너의 60%가 무급이고 44%가 번아웃을 경험한다는 조사 결과도 있다.

