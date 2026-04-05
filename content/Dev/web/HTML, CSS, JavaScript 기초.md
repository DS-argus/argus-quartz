---
tags:
  - web
  - HTML
  - CSS
  - javascript
created: 2026-04-05T00:00:00
updated: 2026-04-05T21:48:05
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!note] 알아볼 내용
> 1. 웹 페이지의 3요소 — HTML, CSS, JavaScript
> 2. HTML — 구조와 콘텐츠
> 3. CSS — 스타일과 레이아웃
> 4. JavaScript — 동작과 로직
> 5. 셋이 어떻게 합쳐지는가
> 6. TypeScript
> 7. 프론트엔드 프레임워크 — React, Vue, Next.js

---
### 웹 페이지의 3요소
- 웹 브라우저가 이해하는 언어는 딱 세 가지 : **HTML, CSS, JavaScript**
- 어떤 프레임워크(React, Vue, Next.js)를 쓰든 최종적으로 브라우저에 전달되는 것은 이 세 가지

```text title="웹의 3요소 비유"
HTML  = 뼈대 (구조)     → "이 페이지에 제목, 문단, 버튼, 이미지가 있다"
CSS   = 옷 (스타일)     → "제목은 빨간색, 버튼은 둥글게, 여백은 이만큼"
JS    = 근육 (동작)     → "버튼 클릭하면 팝업 띄워, 데이터 불러와서 표시해"
```

| 역할 | HTML | CSS | JavaScript |
| :--- | :--- | :--- | :--- |
| 하는 일 | 콘텐츠 구조 정의 | 시각적 스타일 지정 | 동적 동작/로직 처리 |
| 파일 확장자 | `.html` | `.css` | `.js` |
| 없으면? | 페이지 자체가 없음 | 못생긴 페이지 (기능은 동작) | 정적 페이지 (상호작용 불가) |

---
### HTML (HyperText Markup Language) — 구조와 콘텐츠
###### 개념
- 웹 페이지의 **구조와 내용**을 정의하는 마크업 언어
- 프로그래밍 언어가 아님 — 로직이나 반복문 없이 "이 페이지에 뭐가 있는지"만 서술
- **태그(Tag)** 로 구성되며, 태그가 콘텐츠를 감싸는 형태

###### 기본 구조
```html title="HTML 기본 구조"
<!DOCTYPE html>               <!-- 이 문서가 HTML5 임을 선언 -->
<html lang="ko">              <!-- HTML 문서의 시작, 언어 지정 -->

<head>                         <!-- 메타데이터 영역 (브라우저에 보이지 않음) -->
    <meta charset="UTF-8">    <!-- 문자 인코딩 -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>내 페이지</title>    <!-- 브라우저 탭에 표시되는 제목 -->
    <link rel="stylesheet" href="style.css">  <!-- CSS 파일 연결 -->
</head>

<body>                         <!-- 실제 화면에 표시되는 콘텐츠 영역 -->
    <h1>안녕하세요</h1>         <!-- 제목 -->
    <p>이것은 문단입니다.</p>    <!-- 문단 -->
    <button>클릭</button>       <!-- 버튼 -->

    <script src="app.js"></script>  <!-- JavaScript 파일 연결 -->
</body>

</html>
```

###### 주요 태그 정리

**문서 구조 태그**

| 태그 | 역할 | 설명 |
| :--- | :--- | :--- |
| `<html>` | 최상위 컨테이너 | HTML 문서 전체를 감쌈 |
| `<head>` | 메타데이터 | 제목, CSS 연결, 인코딩 등 브라우저에 안 보이는 정보 |
| `<body>` | 본문 콘텐츠 | 실제 화면에 표시되는 모든 것 |

**콘텐츠 태그**

| 태그 | 역할 | 예시 |
| :--- | :--- | :--- |
| `<h1>` ~ `<h6>` | 제목 (크기순) | `<h1>대제목</h1>` `<h3>소제목</h3>` |
| `<p>` | 문단 | `<p>본문 텍스트</p>` |
| `<a>` | 링크 (anchor) | `<a href="https://...">클릭</a>` |
| `<img>` | 이미지 | `<img src="photo.jpg" alt="설명">` |
| `<ul>`, `<ol>`, `<li>` | 목록 | `<ul><li>항목1</li><li>항목2</li></ul>` |
| `<div>` | 범용 블록 컨테이너 | 레이아웃을 잡을 때 가장 많이 사용 |
| `<span>` | 범용 인라인 컨테이너 | 텍스트 일부에 스타일을 적용할 때 |

**폼(입력) 태그**

| 태그 | 역할 | 예시 |
| :--- | :--- | :--- |
| `<form>` | 입력 폼 컨테이너 | `<form action="/submit" method="POST">` |
| `<input>` | 입력 필드 | `<input type="text" placeholder="이름">` |
| `<button>` | 버튼 | `<button type="submit">전송</button>` |
| `<select>` | 드롭다운 | `<select><option>옵션1</option></select>` |
| `<textarea>` | 여러 줄 입력 | `<textarea rows="5"></textarea>` |

**시맨틱 태그 (의미를 가진 태그)**
- `<div>`로 다 할 수 있지만, 의미를 명확히 하기 위해 사용
- 검색 엔진 최적화(SEO)와 접근성(Accessibility)에 유리

| 태그 | 의미 | `<div>` 대신 쓰는 이유 |
| :--- | :--- | :--- |
| `<header>` | 페이지/섹션 상단 | 로고, 네비게이션 영역 |
| `<nav>` | 네비게이션 | 메뉴, 링크 모음 |
| `<main>` | 메인 콘텐츠 | 페이지의 핵심 내용 |
| `<article>` | 독립적인 콘텐츠 | 블로그 글, 뉴스 기사 |
| `<section>` | 주제별 구획 | 관련 콘텐츠 그룹 |
| `<footer>` | 하단 정보 | 저작권, 연락처 |
| `<aside>` | 부가 정보 | 사이드바, 관련 링크 |

```html title="시맨틱 태그 활용 예시"
<body>
    <header>
        <nav>
            <a href="/">홈</a>
            <a href="/about">소개</a>
        </nav>
    </header>

    <main>
        <article>
            <h1>글 제목</h1>
            <p>글 내용...</p>
        </article>

        <aside>
            <h3>관련 글</h3>
            <ul><li><a href="/other">다른 글</a></li></ul>
        </aside>
    </main>

    <footer>
        <p>© 2026 My Blog</p>
    </footer>
</body>
```

###### 태그의 속성 (Attributes)
- 태그에 추가 정보를 부여하는 `이름="값"` 쌍

```html title="자주 쓰는 속성"
<!-- id : 페이지 내에서 고유한 식별자 (하나만 존재) -->
<div id="main-content">...</div>

<!-- class : 여러 요소에 동일 스타일을 적용할 때 (여러 개 가능) -->
<p class="highlight bold">강조 텍스트</p>

<!-- href : 링크 대상 URL -->
<a href="https://google.com" target="_blank">새 탭에서 열기</a>

<!-- src : 외부 리소스 경로 (이미지, 스크립트 등) -->
<img src="photo.jpg" alt="사진 설명">
<script src="app.js"></script>

<!-- style : 인라인 CSS (가급적 비추천, CSS 파일 사용 권장) -->
<p style="color: red;">빨간 글씨</p>
```

---
### CSS (Cascading Style Sheets) — 스타일과 레이아웃
###### 개념
- HTML 요소의 **시각적 표현**을 정의하는 스타일 언어
- 색상, 크기, 여백, 위치, 애니메이션 등 화면에 보이는 모든 것을 제어
- "Cascading" : 여러 스타일 규칙이 겹칠 때 우선순위에 따라 **단계적으로 적용**된다는 의미

###### CSS 적용 방법 3가지
```html title="CSS 적용 방법"
<!-- 1. 외부 파일 (가장 권장) -->
<head>
    <link rel="stylesheet" href="style.css">
</head>

<!-- 2. <style> 태그 (해당 페이지에만 적용) -->
<head>
    <style>
        h1 { color: blue; }
    </style>
</head>

<!-- 3. 인라인 스타일 (비추천 — 유지보수 어려움) -->
<p style="color: red; font-size: 16px;">빨간 글씨</p>
```

###### CSS 기본 문법
```css title="CSS 기본 구조"
/* 선택자 { 속성: 값; } */

h1 {
    color: #333;              /* 글자색 */
    font-size: 24px;          /* 글자 크기 */
    font-weight: bold;        /* 글자 굵기 */
    margin-bottom: 16px;      /* 아래 바깥 여백 */
}

.card {                       /* 클래스 선택자 (.으로 시작) */
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 8px;       /* 모서리 둥글게 */
    padding: 20px;            /* 안쪽 여백 */
}

#header {                     /* ID 선택자 (#으로 시작) */
    position: fixed;          /* 스크롤해도 고정 */
    top: 0;
    width: 100%;
}
```

###### 선택자 (Selector) 정리

| 선택자 | 문법 | 대상 | 예시 |
| :--- | :--- | :--- | :--- |
| 태그 | `태그명` | 해당 태그 전체 | `p { color: gray; }` |
| 클래스 | `.클래스명` | class 속성이 일치하는 요소 | `.card { padding: 20px; }` |
| ID | `#아이디명` | id 속성이 일치하는 요소 (1개) | `#header { height: 60px; }` |
| 자손 | `A B` | A 안에 있는 모든 B | `.card p { font-size: 14px; }` |
| 직접 자식 | `A > B` | A 바로 아래의 B | `.nav > li { display: inline; }` |
| 여러 선택 | `A, B` | A와 B 모두 | `h1, h2 { color: blue; }` |

###### 자주 쓰는 CSS 속성

**텍스트 관련**

| 속성 | 설명 | 예시 |
| :--- | :--- | :--- |
| `color` | 글자색 | `color: #333;` |
| `font-size` | 글자 크기 | `font-size: 16px;` |
| `font-weight` | 굵기 | `font-weight: bold;` |
| `text-align` | 정렬 | `text-align: center;` |
| `line-height` | 줄 간격 | `line-height: 1.6;` |

**박스 모델 (Box Model)** — CSS에서 가장 중요한 개념
- 모든 HTML 요소는 **4겹의 상자**로 구성됨 (바깥 → 안쪽 순서)

| 층 (바깥 → 안쪽) | 속성 | 역할 |
| :---: | :--- | :--- |
| 1. margin | `margin: 16px;` | 바깥 여백 — 다른 요소와의 거리 |
| 2. border | `border: 1px solid #ccc;` | 테두리 — 눈에 보이는 경계선 |
| 3. padding | `padding: 20px;` | 안쪽 여백 — 테두리와 콘텐츠 사이 공간 |
| 4. content | `width: 300px; height: 200px;` | 실제 콘텐츠가 들어가는 영역 |

```css title="박스 모델 속성"
.box {
    width: 300px;              /* 콘텐츠 너비 */
    height: 200px;             /* 콘텐츠 높이 */
    padding: 20px;             /* 안쪽 여백 (상하좌우 동일) */
    padding: 10px 20px;        /* 안쪽 여백 (상하 10px, 좌우 20px) */
    border: 1px solid #ccc;    /* 테두리 */
    margin: 16px;              /* 바깥 여백 */
    margin: 0 auto;            /* 수평 가운데 정렬 */
}
```

**레이아웃 — Flexbox (현대 CSS의 핵심)**
```css title="Flexbox 레이아웃"
/* 가로 정렬 */
.row {
    display: flex;                     /* 자식 요소들을 가로로 배치 */
    justify-content: space-between;    /* 좌우로 균등 분배 */
    align-items: center;               /* 세로 가운데 정렬 */
    gap: 16px;                         /* 요소 사이 간격 */
}

/* 세로 정렬 */
.column {
    display: flex;
    flex-direction: column;            /* 세로로 배치 */
    gap: 8px;
}

/* 정가운데 배치 (가로 + 세로 모두 가운데) */
.center {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;                     /* 화면 전체 높이 */
}
```

**반응형 디자인 — 화면 크기에 따라 스타일 변경**
```css title="미디어 쿼리"
/* 기본 스타일 (모바일) */
.container {
    width: 100%;
    padding: 16px;
}

/* 태블릿 이상 (768px~) */
@media (min-width: 768px) {
    .container {
        width: 720px;
        margin: 0 auto;
    }
}

/* 데스크톱 이상 (1024px~) */
@media (min-width: 1024px) {
    .container {
        width: 960px;
    }
}
```

---
### JavaScript — 동작과 로직
###### 개념
- 웹 페이지에 **동적인 동작**을 부여하는 프로그래밍 언어
- HTML이 "뭐가 있는지", CSS가 "어떻게 보이는지"를 정의했다면 JavaScript는 **"어떻게 동작하는지"** 를 정의
- 원래 브라우저 전용이었으나, Node.js로 서버에서도 실행 가능해짐

###### HTML에서 JavaScript를 연결하는 방법
```html title="JavaScript 연결"
<!-- 1. 외부 파일 연결 (가장 권장) -->
<!-- body 맨 아래에 두는 것이 관례 — HTML이 다 그려진 후 JS 실행 -->
<body>
    <h1>안녕하세요</h1>
    <button id="myBtn">클릭</button>

    <script src="app.js"></script>    <!-- 외부 JS 파일 -->
</body>

<!-- 2. <script> 태그 안에 직접 작성 -->
<script>
    console.log("Hello!");
</script>

<!-- 3. defer 속성 — head에 넣어도 HTML 파싱 후 실행 -->
<head>
    <script src="app.js" defer></script>
</head>
```

> [!info] script 태그의 위치가 중요한 이유
> - 브라우저는 HTML을 위에서 아래로 읽으며 화면을 그림 (파싱)
> - `<script>`를 만나면 **파싱을 멈추고** JS를 다운로드+실행
> - 따라서 `<head>`에 넣으면 JS 실행 중에 아직 `<body>`가 없어서 요소를 찾을 수 없음
> - 해결 방법:
> 	1. `<body>` 맨 아래에 `<script>` 배치 (전통적 방법)
> 	2. `<script defer>` 사용 (HTML 파싱 완료 후 실행)
> 	3. `<script async>` 사용 (다운로드 완료 즉시 실행, 순서 보장 안됨)

###### JavaScript 기본 문법
```javascript title="변수와 자료형"
// 변수 선언
const name = "홍길동";      // 상수 (재할당 불가) — 기본적으로 const 사용
let age = 25;               // 변수 (재할당 가능)
var old = "쓰지 마세요";     // 옛날 방식 (스코프 문제 있음, 사용 비추천)

// 자료형
const str = "문자열";                  // String
const num = 42;                       // Number (정수/실수 구분 없음)
const bool = true;                    // Boolean
const arr = [1, 2, 3];               // Array (Python의 list)
const obj = { name: "홍길동", age: 25 };  // Object (Python의 dict)
const nothing = null;                 // 의도적으로 "없음"
const notDefined = undefined;         // 아직 값이 할당되지 않음
```

```javascript title="함수"
// 함수 선언
function greet(name) {
    return `안녕하세요, ${name}님!`;     // 템플릿 리터럴 (Python의 f-string)
}

// 화살표 함수 (Arrow Function) — 현대 JS에서 가장 많이 사용
const greet = (name) => {
    return `안녕하세요, ${name}님!`;
};

// 한 줄이면 중괄호와 return 생략 가능
const greet = (name) => `안녕하세요, ${name}님!`;

// Python과 비교
// def greet(name):
//     return f"안녕하세요, {name}님!"
```

```javascript title="조건문과 반복문"
// 조건문
if (age >= 20) {
    console.log("성인");
} else if (age >= 13) {
    console.log("청소년");
} else {
    console.log("어린이");
}

// 삼항 연산자 (Python과 동일한 개념)
const status = age >= 20 ? "성인" : "미성년";
// Python: status = "성인" if age >= 20 else "미성년"

// 반복문
for (let i = 0; i < 5; i++) {
    console.log(i);
}

// 배열 순회 (Python의 for item in list)
const fruits = ["사과", "바나나", "포도"];
for (const fruit of fruits) {
    console.log(fruit);
}

// 배열 메서드 (Python의 리스트 컴프리헨션과 유사)
const doubled = [1, 2, 3].map(x => x * 2);        // [2, 4, 6]
const evens = [1, 2, 3, 4].filter(x => x % 2 === 0);  // [2, 4]
```

###### DOM 조작 — JavaScript가 HTML을 동적으로 제어하는 방법
- **DOM (Document Object Model)** : 브라우저가 HTML을 읽고 만드는 트리 구조의 객체 모델
- JavaScript는 DOM을 통해 HTML 요소를 찾고, 변경하고, 추가/삭제할 수 있음

```html title="DOM 조작 예시"
<h1 id="title">원래 제목</h1>
<button id="changeBtn">제목 변경</button>
<ul id="list"></ul>

<script>
// 요소 찾기
const title = document.getElementById("title");
const btn = document.getElementById("changeBtn");
const list = document.getElementById("list");

// 이벤트 리스너 — 버튼 클릭 시 동작 정의
btn.addEventListener("click", () => {
    // 텍스트 변경
    title.textContent = "변경된 제목!";

    // 스타일 변경
    title.style.color = "blue";

    // 새 요소 추가
    const li = document.createElement("li");
    li.textContent = "새 항목 추가됨";
    list.appendChild(li);
});
</script>
```

###### 비동기 처리 — JavaScript의 핵심 특징
- JavaScript는 **싱글 스레드** 언어이지만 비동기 처리로 여러 작업을 효율적으로 수행
- 서버에서 데이터를 가져오거나 타이머를 설정할 때 사용

```javascript title="비동기 처리"
// 1. 콜백 (옛날 방식)
setTimeout(() => {
    console.log("2초 후 실행");
}, 2000);

// 2. Promise
fetch("https://api.example.com/data")
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error(error));

// 3. async/await (현대 방식, 가장 권장)
// Python의 async/await와 거의 동일한 문법
async function fetchData() {
    try {
        const response = await fetch("https://api.example.com/data");
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error(error);
    }
}

// Python 비교
// async def fetch_data():
//     async with aiohttp.ClientSession() as session:
//         async with session.get("https://api.example.com/data") as resp:
//             data = await resp.json()
//             print(data)
```

###### Python vs JavaScript 문법 빠른 비교

| 개념 | Python | JavaScript |
| :--- | :--- | :--- |
| 출력 | `print("hello")` | `console.log("hello")` |
| 문자열 포맷 | `f"이름: {name}"` | `` `이름: ${name}` `` |
| 리스트/배열 | `[1, 2, 3]` | `[1, 2, 3]` |
| 딕셔너리/객체 | `{"key": "value"}` | `{key: "value"}` |
| None/null | `None` | `null` / `undefined` |
| 함수 | `def fn(x):` | `const fn = (x) => {}` |
| 클래스 | `class Foo:` | `class Foo {}` |
| 모듈 가져오기 | `import os` | `import fs from 'fs'` |
| 타입 확인 | `type(x)` | `typeof x` |
| 비동기 | `async def / await` | `async function / await` |

---
### HTML + CSS + JavaScript가 합쳐지는 구조
###### 전형적인 프로젝트 파일 구조
```text title="정적 웹사이트 구조"
my-website/
├── index.html          # 메인 페이지 (구조)
├── about.html          # 소개 페이지
├── css/
│   └── style.css       # 스타일
├── js/
│   └── app.js          # 동작/로직
└── images/
    └── logo.png        # 이미지 리소스
```

###### 하나의 완성된 예시
```html title="index.html"
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>할 일 목록</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <h1>할 일 목록</h1>
        <div class="input-area">
            <input type="text" id="todoInput" placeholder="할 일을 입력하세요">
            <button id="addBtn">추가</button>
        </div>
        <ul id="todoList"></ul>
    </div>

    <script src="js/app.js"></script>
</body>
</html>
```

```css title="css/style.css"
.container {
    max-width: 500px;
    margin: 40px auto;
    padding: 20px;
    font-family: sans-serif;
}

.input-area {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
}

.input-area input {
    flex: 1;                    /* 남은 공간 전부 차지 */
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

.input-area button {
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

#todoList li {
    padding: 8px 0;
    border-bottom: 1px solid #eee;
}
```

```javascript title="js/app.js"
const input = document.getElementById("todoInput");
const addBtn = document.getElementById("addBtn");
const todoList = document.getElementById("todoList");

addBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (text === "") return;

    const li = document.createElement("li");
    li.textContent = text;
    todoList.appendChild(li);

    input.value = "";           // 입력창 비우기
    input.focus();              // 커서를 다시 입력창으로
});

// Enter 키로도 추가 가능
input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addBtn.click();
});
```

---
### TypeScript — JavaScript에 타입을 추가한 언어
###### 개념
- Microsoft가 개발한 JavaScript의 **상위 집합(Superset)**
- JavaScript 코드에 **정적 타입**을 추가하여 컴파일 시점에 오류를 잡을 수 있음
- Python에서 타입 힌트(`def fn(x: int) -> str`)를 사용하는 것과 유사하지만, TypeScript는 컴파일러가 **강제로 검사**
- `.ts` 파일을 작성하면 컴파일러(tsc)가 `.js` 파일로 변환 → 브라우저는 JS만 이해하므로

```typescript title="TypeScript 예시"
// TypeScript — 타입이 있음
function greet(name: string): string {
    return `안녕하세요, ${name}님!`;
}

greet("홍길동");    // ✅ OK
greet(123);         // ❌ 컴파일 에러: number는 string에 할당할 수 없음

// 인터페이스 — 객체의 구조를 정의
interface User {
    name: string;
    age: number;
    email?: string;    // ?는 선택적 필드 (없어도 됨)
}

const user: User = {
    name: "홍길동",
    age: 25
};
```

```text title="TypeScript → JavaScript 변환 흐름"
hello.ts  →  tsc (TypeScript 컴파일러)  →  hello.js  →  브라우저/Node.js 실행
             (타입 검사 + 변환)              (타입 정보 제거된 순수 JS)
```

---
### 프론트엔드 프레임워크 — React, Vue, Next.js
###### 왜 프레임워크를 쓰는가
- 위의 순수 HTML + CSS + JS 방식(Vanilla)은 간단한 페이지에는 충분
- 하지만 복잡한 웹 앱(Gmail, Notion, Slack 등)을 순수 JS로 만들면
	- DOM 조작 코드가 매우 복잡해짐
	- 상태 관리(어떤 데이터가 어디에 표시되는지)가 어려움
	- 코드 재사용과 유지보수가 힘듦
- 프레임워크는 이런 문제를 **컴포넌트** 기반으로 해결

###### 주요 프레임워크

| 프레임워크 | 개발 | 특징 | 비유 |
| :--- | :--- | :--- | :--- |
| **React** | Meta (Facebook) | UI 라이브러리, 컴포넌트 기반, JSX 문법 | 가장 넓은 생태계, 취업 시장 1위 |
| **Vue.js** | Evan You (개인) | 쉬운 학습 곡선, 템플릿 기반 | React보다 배우기 쉬움 |
| **Angular** | Google | 풀 프레임워크, TypeScript 기본 | 대규모 엔터프라이즈용 |
| **Next.js** | Vercel | React 기반, 서버 사이드 렌더링(SSR) | React의 "풀스택 확장판" |
| **Nuxt.js** | 커뮤니티 | Vue 기반, SSR 지원 | Vue의 "풀스택 확장판" |

###### React 맛보기 — 컴포넌트란
```jsx title="React 컴포넌트 예시 (JSX)"
// 컴포넌트 = 재사용 가능한 UI 조각
// HTML처럼 보이지만 JavaScript 안에 작성 (JSX 문법)
function TodoItem({ text, done }) {
    return (
        <li style={{ textDecoration: done ? "line-through" : "none" }}>
            {text}
        </li>
    );
}

function TodoList() {
    const todos = [
        { text: "장보기", done: false },
        { text: "운동하기", done: true },
    ];

    return (
        <ul>
            {todos.map((todo, i) => (
                <TodoItem key={i} text={todo.text} done={todo.done} />
            ))}
        </ul>
    );
}
```

> [!info] 프레임워크와 [[Node.js 패키지 관리 — npm, pnpm, node_modules|npm/pnpm]]의 관계
> - 프레임워크는 npm/pnpm을 통해 설치하는 **패키지**
> - 개발 시에는 Node.js 환경에서 빌드하고, 결과물은 브라우저에서 실행
> - `npx create-next-app` → Next.js 프로젝트 생성 → `npm run dev` → 개발 서버 실행
> - 최종적으로 브라우저에 전달되는 것은 항상 HTML + CSS + JS

---
### 전체 흐름 요약

| 브라우저가 이해하는 것 | 개발할 때 쓰는 것 | 빌드/패키지 관리 |
| :--- | :--- | :--- |
| HTML | React / Vue / Angular | npm / pnpm / yarn |
| CSS | Sass / Tailwind CSS | webpack / vite |
| JavaScript | TypeScript | Node.js |

- 개발할 때는 프레임워크(React 등)와 TypeScript로 작성
- 빌드 도구(webpack, vite)가 이를 변환
- 최종적으로 브라우저에 전달되는 것은 항상 **HTML + CSS + JavaScript**
