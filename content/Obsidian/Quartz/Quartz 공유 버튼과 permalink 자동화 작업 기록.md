---
tags:
  - Quartz
  - Obsidian
  - blog
  - permalink
permalink: /Obsidian/Quartz/quartz-share-button-and-permalink-automation
created: 2026-04-23T00:00:00
updated: 2026-04-23T23:08:38
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> Quartz 블로그에 공유 버튼을 추가하고, permalink 기반 URL 복사, 링크 미리보기 OG 메타 삽입, permalink pre-commit 자동화를 구현한 작업 기록이다.

---

### 1. 배경

이 블로그는 [[Obsidian Quartz Blog 시작하기|Quartz]]로 운영 중인데 글을 공유할 때 세 가지 문제가 있었다.

1. *한글 URL 퍼센트 인코딩*:  파일명이 한글이면 URL이 이렇게 된다

	```
	https://study-addiction.pages.dev/Obsidian/Quartz/Obsidian-%EB%B8%94%EB%A1%9C%EA%B7%B8-%EC%B2%A8%EB%B6%80%ED%8C%8C%EC%9D%BC-%EC%9E%90%EB%8F%99-%EC%A0%95%EB%A6%AC
	```

	카카오톡이나 슬랙에 붙여넣으면 읽을 수 없다.

2. *공유 버튼 부재*:  Quartz에는 공유 버튼이 없다. 매번 주소창에서 직접 복사해야 한다.

3. *링크 미리보기 미작동*:  Quartz의 permalink는 alias redirect 방식이다. frontmatter에 `permalink: /my-post`를 넣으면 `/my-post` 경로에 redirect HTML이 생기는데, 이 HTML에 OG 메타태그가 없어서 카카오톡 등에서 미리보기가 표시되지 않는다.

---

### 2. 목표

1. **공유 버튼** — 글 제목 옆 아이콘 버튼으로 URL 복사
2. **permalink 우선 복사** — permalink가 있으면 permalink URL, 없으면 현재 URL fallback
3. **링크 미리보기 유지** — permalink URL 공유 시에도 OG 메타 정상 표시
4. **permalink 자동화** — 커밋 시 permalink 자동 생성

---

### 3. 공유 버튼 구현

#### 3-1. 컴포넌트 구조

기존 `ArticleTitle`을 수정하는 대신, `ArticleHeader`라는 래퍼 컴포넌트를 새로 만들었다.

```
ArticleHeader (신규)
├── ArticleTitle (기존, 수정 없음)
└── ShareButton (신규)
```

`quartz.layout.ts`에서 `ArticleTitle()`을 `ArticleHeader()`로 교체하면 된다.

#### 3-2. URL 결정 로직

빌드 타임에 permalink를 확인해서 `data-share-url` 속성에 절대 URL을 넣는다.

```tsx
// ShareButton.tsx
function getShareUrl(cfg, fileData) {
  const permalink = getPermalinkPath(fileData)
  if (!permalink) return undefined
  const base = new URL(`https://${cfg.baseUrl}`)
  return new URL(permalink.slice(1), base).toString()
}
```

클릭 시 런타임에서는 `data-share-url` → `data-share-path` → `window.location.href` 순으로 fallback한다.

```ts
// sharebutton.inline.ts
function getShareUrl(button: HTMLElement) {
  const absoluteUrl = button.dataset.shareUrl
  if (absoluteUrl) return absoluteUrl
  const permalinkPath = button.dataset.sharePath
  if (permalinkPath) {
    return new URL(permalinkPath, window.location.origin).toString()
  }
  return window.location.href
}
```

#### 3-3. UI

제목 우측에 원형 공유 아이콘 버튼이 표시된다. 클릭하면 체크 아이콘 + "Copied" 툴팁으로 전환되고 1.8초 후 복귀한다. 라이트/다크 테마 대응은 CSS 변수로 처리했다.

---

### 4. 링크 미리보기 — AliasRedirects 수정

Quartz의 기존 alias redirect HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=실제경로">
</head>
</html>
```

OG 태그가 없으므로 카카오톡 등에서 미리보기가 비어 있다.

`aliases.ts`의 `buildRedirectHtml` 함수를 수정해서 원본 글의 title, description, socialImage를 OG/Twitter 메타태그로 삽입했다.

```html
<!-- 수정 후 -->
<meta property="og:title" content="글 제목">
<meta property="og:description" content="글 설명">
<meta property="og:image" content="OG 이미지 경로">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="글 제목">
<meta name="twitter:image" content="OG 이미지 경로">
<link rel="canonical" href="원본 URL">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=실제경로">
```

> [!info]+ canonical과 noindex
> `canonical`은 원본 URL을 가리켜 검색 엔진이 redirect 페이지가 아닌 원본을 색인하도록 한다. `noindex`로 redirect 페이지 자체는 검색 결과에서 제외된다.

OG 이미지는 Quartz의 `CustomOgImages` 플러그인이 생성하는 `-og-image.webp`를 자동 참조한다. 별도 지정이 필요하면 frontmatter에 `socialImage` 필드를 추가하면 된다.

---

### 5. permalink 자동화 — pre-commit Hook

#### 5-1. 자동화 시점

pre-push 시점이면 커밋이 이미 만들어진 후라 frontmatter 수정에 `--amend`가 필요하다. pre-commit이면 스테이징된 파일을 수정하고 다시 스테이지해서 같은 커밋에 포함할 수 있다.

[[Git Hook#5-4. simple-git-hooks (Node.js)|simple-git-hooks]]로 등록:

```json
{
  "simple-git-hooks": {
    "pre-commit": "npm run stage:content -- --staged-only"
  }
}
```

#### 5-2. permalink 생성 규칙

`permalink-utils.mjs`의 규칙:

1. **디렉터리 구조 유지** — `content/Dev/python/파일.md` → `/Dev/python/slug`
2. **title 우선** — frontmatter `title`이 ASCII면 slug화해서 사용
3. **파일명 fallback** — title이 non-ASCII면 파일명으로 시도
4. **둘 다 실패 시 커밋 차단** — `exit 1`로 커밋을 막고 수동 입력을 요구

slug화 로직:

```js
normalized.toLowerCase()
  .replace(/&/g, " and ")
  .replace(/\+/g, " plus ")
  .replace(/#/g, " sharp ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
```

예시: `Obsidian 블로그 첨부파일 자동 정리`(한글 title)이면 title에서 slug 생성이 불가하므로, 파일명 `Obsidian 블로그 첨부파일 자동 정리.md`도 한글이라 자동 생성 실패 → 수동으로 permalink를 지정해야 한다.

반면 title이 `Python uv - An extremely fast Python package and project manager`이면:

```
/Dev/python/python-uv-an-extremely-fast-python-package-and-project-manager
```

> [!note]+ 충돌 감지
> `content/` 전체를 스캔해서 기존 permalink와 Quartz 기본 slug를 맵에 등록한 뒤, 새 permalink가 겹치면 커밋을 차단한다.

#### 5-3. 보류한 대안

- **LLM으로 한글 제목 번역** — 일관성 보장이 어렵고 API 의존성이 생긴다
- **디렉터리명 자동 slugify** — 대부분 이미 영어라 지금은 불필요
- **`/blog/...` 별도 URL 정책** — 기존 URL 구조를 깨뜨린다

---

### 6. 검증과 운영 흐름

검증 항목:

1. Docker 환경 Quartz 빌드 → 공유 버튼 렌더링 확인
2. 공유 버튼 클릭 → 클립보드에 permalink URL 복사 확인
3. permalink URL 접속 → 원본 글로 redirect 확인
4. 카카오톡에 permalink URL 붙여넣기 → OG 미리보기 표시 확인
5. permalink 없는 새 글 커밋 → pre-commit hook이 자동 생성 및 스테이징 확인
6. title/파일명 모두 한글인 파일 커밋 → 에러 메시지와 함께 커밋 차단 확인

최종 운영 흐름:

```
새 글 작성 (Obsidian)
  → git add & git commit
  → pre-commit hook (stage-content.mjs)
    → permalink 없는 파일에 자동 생성 & 재스테이징
  → 커밋 완료
  → git push → Cloudflare Pages 빌드
  → 공유 버튼 클릭 시 permalink URL 복사
  → 카카오톡 등에서 미리보기 정상 표시
```

---

### 7. 남은 과제

- **디렉터리 한글 경로** — `content/AI/추천시스템/` 같은 한글 디렉터리는 permalink에 그대로 남는다. 이번에 `recsys`로 수동 변경했지만, 디렉터리 slug 정책이 필요하다
- **permalink 정책 고도화** — 현재는 title이 영어일 때만 자동 생성된다. 한글 title 자동 slug 생성(음역, 요약 등)은 추후 검토
