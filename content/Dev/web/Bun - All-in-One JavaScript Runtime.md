---
tags:
  - javascript
  - NodeJS
  - package_manager
  - tool
created: 2026-06-11T21:22:35
updated: 2026-06-11T21:22:35
permalink: /Dev/web/bun
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Bun은 런타임 + 패키지 매니저 + 번들러 + 테스트 러너를 하나로 합친 JavaScript 올인원 도구
> - Zig와 JavaScriptCore 엔진 기반으로 Node.js 대비 약 4배 빠른 실행 속도 주장
> - SQLite/Redis/S3 바인딩, WebSocket, 비밀번호 해싱, FFI까지 내장되어 외부 의존성 없이 풀스택 서버 구축 가능
> - `bun build --compile`로 단독 실행 바이너리 생성, Jest 호환 테스트 러너 내장
> - 패키지 매니저는 npm/yarn/pnpm과 호환되면서 10배 이상 빠름

> [!cite]+ Source
> <iframe width="560" height="315" src="https://www.youtube.com/embed/B7UltNLuqPc" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

---
### 1. Bun이란

JavaScript는 원래 브라우저 안에서만 동작하는 언어였다. 브라우저 밖(서버, CLI)에서 JavaScript를 실행하려면 **런타임**이 필요한데, 그 역할을 해온 것이 Node.js다. 그런데 실제 개발에서는 런타임만으로 부족해서 도구가 계속 늘어난다.

- 패키지 설치: npm, yarn, pnpm
- 코드 번들링: Webpack, Rollup, [[Vite - Fast Frontend Build Tool|Vite]]
- 테스트: Jest, Vitest

Bun은 이 네 가지(런타임, 패키지 매니저, 번들러, 테스트 러너)를 하나의 바이너리로 합친 도구다. Node.js가 C++와 V8 엔진으로 만들어진 것과 달리, Bun은 Zig 언어와 Apple의 JavaScriptCore 엔진으로 처음부터 새로 작성되었고, Node.js 대비 약 4배 빠른 실행 속도를 내세운다.

```bash
# 설치
curl -fsSL https://bun.sh/install | bash

# 프로젝트 생성 및 실행
bun init
bun run index.ts        # TypeScript도 트랜스파일 없이 바로 실행
```

---
### 2. 내장 웹 서버

`Bun.serve`에 라우트 객체를 넘기면 바로 API 서버가 된다. TypeScript 트랜스파일, JS/CSS 번들링, TLS, 핫 리로딩까지 자동으로 처리된다.

```ts
Bun.serve({
  routes: {
    "/": homepage,                          // HTML 파일을 import해서 그대로 서빙
    "/api/users": () => Response.json(users),
  },
});
```

콘텐츠 처리 기능도 내장되어 있다.

- **마크다운 변환**: `Bun.markdown`으로 `.md` 파일을 HTML로 변환해 바로 서빙 가능. 블로그를 만들 때 CMS 없이 처리할 수 있다
- **HTMLRewriter**: HTML에서 특정 ID/셀렉터를 찾아 내용을 바꾸는 템플릿 엔진 역할. 사용자별로 다른 내용을 동적으로 서빙할 때 사용
- **파일 파서**: YAML, JSON, TOML 파서가 내장되어 설정 파일 처리에 별도 라이브러리가 필요 없다

---
### 3. 데이터 저장소 바인딩

SQL, Redis, S3 호환 스토리지에 대한 바인딩이 내장되어 있어 드라이버 패키지를 설치하지 않아도 된다.

- **Redis**: 인메모리 키-값 저장소 직접 연결. 영상에서는 IP별 카운터를 60초 TTL로 증가시키는 rate limiter를 몇 줄로 구현하는 예시를 보여준다
- **SQLite**: `bun:sqlite` 드라이버로 서버나 CLI 앱에 파일 기반 DB를 바로 붙일 수 있다. 인메모리 모드도 지원

```ts
import { Database } from "bun:sqlite";

const db = new Database("data.db");   // ":memory:"로 인메모리 실행 가능
```

---
### 4. 인증과 네트워킹

별도 라이브러리 없이 인증 구현에 필요한 기본 요소를 제공한다.

- UUID v4/v7 생성
- `Bun.password`로 비밀번호 해싱과 검증
- 요청 객체에서 쿠키를 바로 설정하면 응답에 자동 반영되는 세션 관리

네트워킹 계층도 폭넓게 내장되어 있다.

- `fetch`로 외부 API 호출
- WebSocket: pub/sub 패턴 내장, Node.js 대비 최대 7배 빠르다고 주장. 채팅, 실시간 위치 추적 같은 양방향 통신에 사용 (프로토콜 자체가 궁금하면 [[WebSocket 프로토콜 설계의 비밀]] 참고)
- TCP/UDP 소켓, DNS 모듈 같은 저수준 프리미티브 제공

---
### 5. FFI와 저수준 연동

성능이 중요한 부분은 C, Rust, Zig로 작성한 뒤 FFI(Foreign Function Interface)로 호출할 수 있다. 영상에서는 배열 덧셈을 C로 옮겨 약 3배 빨라진 사례를 보여준다.

특이한 점은 경량 C 컴파일러인 TinyCC를 내장하고 있다는 것이다. C 소스 파일을 import하면 런타임에 바로 컴파일되므로, 일반적인 FFI처럼 동적 라이브러리를 미리 빌드해둘 필요가 없다.

---
### 6. 번들러와 테스트 러너

```bash
bun build ./index.ts --outdir ./dist     # 번들링 (Rollup/Webpack 대비 200배 빠름 주장)
bun build ./cli.ts --compile --outfile mycli   # 단독 실행 바이너리 생성

bun test                 # Jest 호환 테스트 러너
bun test --watch         # 코드 변경 시 자동 재실행
bun test --concurrent    # 테스트 병렬 실행
```

`--compile` 플래그는 런타임이 포함된 단일 바이너리를 만들어주므로, 고수준 언어로 크로스 플랫폼 CLI 앱을 배포하는 용도로 쓸 수 있다.

---
### 7. 패키지 매니저

Bun의 패키지 매니저는 npm, yarn, pnpm과 기능 동등성을 유지하면서 10배 이상 빠르다. `package.json`과 `node_modules` 구조를 그대로 사용하므로, Bun 런타임으로 전환하지 않고 기존 Node.js 프로젝트에서 설치 속도만 높이는 용도로도 쓸 수 있다.

```bash
bun install     # 기존 Node 프로젝트에서도 바로 사용 가능
bun add zod
```

패키지 매니저 생태계 전반의 비교는 [[Package Manager Landscape - Why npm and How Tools Get Distributed]] 참고.

---
### 8. 도입 판단

> [!tip]+ 언제 쓸까
> - 새 풀스택 프로젝트나 CLI 도구: 도구 체인이 하나로 줄어드는 이점이 가장 큼
> - 기존 Node 프로젝트: `bun install`만 먼저 도입해 설치 속도 개선 가능
> - 주의: Node.js 생태계와 대부분 호환되지만, 네이티브 애드온 등 일부 패키지는 동작이 다를 수 있어 운영 전 검증 필요
