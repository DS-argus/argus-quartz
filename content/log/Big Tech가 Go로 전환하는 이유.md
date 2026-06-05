---
tags:
  - golang
  - backend
created: 2026-06-05T10:00:00
updated: 2026-06-05T23:33:15
permalink: /log/big-tech-switching-to-go
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Microsoft, Reddit, Lovable, Uber가 Python/TypeScript에서 Go로 전환한 사례 정리
> - 공통 이유: 동시성 처리 성능, 단순한 문법, 네이티브 바이너리 컴파일, 서버 비용 절감
> - Go는 완전한 재작성 없이 포팅이 가능한 실용적 선택지로 부상

> [!cite]+ Source
> - [The Real Reason Big Tech Is Switching to Go - Coding with Patrik (YouTube)](https://youtube.com/watch?v=-Z813pHqSFI)

---

### Microsoft — TypeScript 컴파일러 Go 포팅

2025년 3월, Microsoft는 TypeScript 컴파일러를 Go로 포팅하겠다고 발표했다. C# 창시자 Anders Hejlsberg가 프로젝트를 이끌었고, 2026년 4월 TypeScript 7 beta로 결실을 맺었다.

포팅 동기는 속도다. 기존 TypeScript 컴파일러는 에디터 로드만 9.5초가 걸릴 정도로 느렸다.

**왜 C#이 아닌가** — 기존 컴파일러가 함수형 스타일로 작성되어 있어서 객체지향 언어인 C#으로는 포팅이 아니라 재작성이 필요했다.

**왜 Rust가 아닌가** — 기존 코드가 GC를 전제로 설계되어 있어서 Rust의 수동 메모리 관리로 전환하면 역시 전면 재작성이 필요했다.

**왜 Go인가** — Go의 관용적 코드 패턴이 기존 TypeScript 코드베이스와 유사해서 구조를 유지한 채 포팅이 가능했다. Microsoft 팀의 표현: *"Idiomatic Go strongly resembles the existing coding patterns of the TypeScript code base."*

> 결과: 빌드 속도 10배 향상, 에디터 로드 9.5초 → 1.2초

---

### Reddit — Python 모놀리스 탈피

Reddit은 오랫동안 Python 모놀리스를 운영했다. 핵심 데이터 모델(댓글, 계정, 게시물, 서브레딧)을 Go 서비스로 재구축했다.

전환 이유는 단순히 속도만이 아니었다. 모놀리스가 불안정하고, 로직이 깊이 묻혀 있으며, 팀 간 소유권이 흩어져 유지보수가 불가능한 상태였다.

Go는 같은 트래픽을 더 적은 서버와 조율로 처리할 수 있었다. Reddit은 이미 일부 서비스에서 Go를 쓰고 있었기 때문에 자연스러운 확장이었다.

테스트 전략이 흥미하다. Python 모놀리스와 Go 서비스를 동시에 운영하며 같은 입력을 주고, Go 쪽은 테스트 DB를 사용해 출력을 비교한 뒤 검증 완료 후 전환했다.

> 결과: P99 레이턴시 50% 감소. 댓글 작성이 최대 15초 걸리던 것이 개선

---

### Lovable — 동시성 병목 해결

AI 기반 앱 빌더 Lovable은 42,000줄의 Python을 Go로 재작성했다. 채팅 요청 하나가 모델 프로바이더, 내부 서비스, 스토리지 등으로 50개 이상의 HTTP 호출을 동시에 발생시키는 구조였는데, Python으로는 이 동시성을 감당하기 어려웠다.

> 결과: 서버 인스턴스 200대 → 10대, 배포 시간 15분 → 3분, 평균 응답 12% 빠름

---

### Uber — 전사적 Go 전환

Uber는 현존하는 가장 큰 Go 코드베이스 중 하나를 운영한다. Python과 Node.js에서 전환했으며, 기술팀이 아닌 경영진 레벨에서 Python을 백엔드 지원 언어에서 제외하는 결정을 내렸다.

> 결과: 동일 작업에 97% 적은 컴퓨트 사용. 장애 대응 비율 60% → 20%로 감소
