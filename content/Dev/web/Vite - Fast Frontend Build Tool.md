---
tags:
  - javascript
  - web
created: 2026-06-05T00:00:00
updated: 2026-06-05T00:00:00
permalink: /Dev/web/vite-fast-frontend-build-tool
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Vite는 ES Modules 기반의 프론트엔드 빌드 도구
> - 개발 서버는 번들링 없이 즉시 시작, 프로덕션 빌드는 Rollup 사용
> - esbuild로 의존성 사전 번들링하여 속도 확보
> - React, Vue, Svelte 등 주요 프레임워크 지원

> [!info]+ Vite?
> - 프랑스어로 "빠르다"는 뜻의 프론트엔드 빌드 도구
> - Evan You(Vue.js 창시자)가 개발
> - CRA(Create React App)의 사실상 후속 대안
> - https://vite.dev/


---
### 1. 빌드 도구란

작성한 소스 코드를 **브라우저가 실행할 수 있는 형태로 변환하는 도구**다.

브라우저는 기본적으로 HTML, CSS, 순수 JavaScript만 이해한다. JSX, TypeScript, CSS Modules 같은 것들은 그대로 실행할 수 없기 때문에 변환 과정이 필요하다.

| 작업                | 설명                                         |
| ----------------- | ------------------------------------------ |
| **변환(Transform)** | JSX → JS, TypeScript → JS 등 브라우저 호환 코드로 변환 |
| **번들링(Bundle)**   | 수백 개 파일을 소수의 파일로 합침                        |
| **최적화(Optimize)** | 미사용 코드 제거, 압축(minify), 코드 스플리팅             |
| **개발 서버**         | 로컬에서 실시간 미리보기 제공                           |


---
### 2. 기존 빌드 도구의 문제

Webpack 같은 기존 번들러는 개발 서버를 시작할 때 **모든 모듈을 미리 번들링**한다.

```
[Webpack 방식]
모든 모듈 분석 → 의존성 그래프 생성 → 번들 생성 → 서버 시작
```

프로젝트 규모가 커질수록 서버 시작 시간이 길어지고, 코드를 수정해도 반영(HMR, Hot Module Replacement)이 느려지는 문제가 있었다.


---
### 3. Vite의 접근 방식

Vite는 개발과 프로덕션 빌드를 **다른 전략**으로 처리한다.

##### 개발 모드

브라우저의 네이티브 ES Modules(ESM)을 그대로 활용한다. 파일을 미리 묶지 않고, 브라우저가 모듈을 요청하면 그때 변환해서 내려준다.

```
[Vite 방식]
서버 즉시 시작 → 브라우저가 모듈 요청 → 해당 모듈만 변환하여 응답
```

> [!tip]+ ESM이란
> `import`/`export` 구문으로 모듈을 불러오는 브라우저 표준 방식이다. 별도 번들러 없이 브라우저가 직접 모듈 의존성을 해석한다.

##### 프로덕션 빌드

프로덕션에서는 **Rollup**을 사용해서 번들링한다. 트리셰이킹, 코드 스플리팅, 압축 등 최적화를 수행한다.

```bash
npx vite build    # dist/ 폴더에 최적화된 결과물 생성
```

##### 의존성 사전 번들링

`node_modules`의 라이브러리는 ESM이 아닌 경우가 많다. Vite는 **esbuild**(Go 기반)로 이를 사전 변환해둔다. 이 과정은 최초 한 번만 실행되고 캐시된다.


---
### 4. Webpack과 비교

|          | Webpack                | Vite           |
| -------- | ---------------------- | -------------- |
| 개발 서버 시작 | 전체 번들링 후 시작 (느림)       | 즉시 시작          |
| HMR 속도   | 프로젝트 커질수록 느려짐          | 모듈 단위로 교체하여 일정 |
| 프로덕션 빌드  | Webpack 자체 번들링         | Rollup 기반 번들링  |
| 설정 복잡도   | 높음 (loader, plugin 설정) | 낮음 (합리적인 기본값)  |
| 생태계      | 성숙하고 방대함               | 빠르게 성장 중       |


---
### 5. 빠른 시작

##### 프로젝트 생성

```bash
# React + TypeScript 프로젝트 생성
npm create vite@latest my-app -- --template react-ts

cd my-app
npm install
```

##### 개발 서버 실행

```bash
npm run dev    # 기본 포트: http://localhost:5173
```

##### 프로덕션 빌드

```bash
npm run build    # dist/ 폴더에 빌드 결과 생성
npm run preview  # 빌드 결과물 로컬 미리보기
```

##### 주요 템플릿

| 템플릿         | 명령어                    |
| ----------- | ---------------------- |
| React + TS  | `--template react-ts`  |
| Vue + TS    | `--template vue-ts`    |
| Svelte + TS | `--template svelte-ts` |
| Vanilla     | `--template vanilla`   |


---
### 6. 설정

프로젝트 루트의 `vite.config.ts`에서 설정한다. 대부분 기본값으로 충분하지만, 필요하면 플러그인이나 경로 등을 조정할 수 있다.

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,          // 개발 서버 포트 변경
  },
  build: {
    outDir: 'dist',      // 빌드 출력 경로
  },
})
```
