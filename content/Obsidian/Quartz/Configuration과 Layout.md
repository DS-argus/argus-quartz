---
tags:
  - obsidian
  - Quartz
created: 2025-05-22T15:14:54
updated: 2025-06-06T15:37:24
permalink: /Obsidian/Quartz/configuration-and-layout
---
### Quartz의 기본 Configuration

Configuration을 설정할 수 있는 `quartz.config.ts` 는 크게 configuration 부분과 plugins 부분으로 나뉘고 plugins는 또 3개로 나뉜다
- [configuration](https://quartz.jzhao.xyz/configuration)
	- 블로그 좌측 상단 제목, analytics 설정, 게시글 날짜, 기본 언어, url, 색상, 폰트...
- [plugins](https://quartz.jzhao.xyz/configuration#plugins)
	- transformers: contents를 읽고 의미 있는 정보로 가공하는 역할
	- filters: 임시글이나 제외할 contents를 거르는 역할
	- emitters: :  필요한 contents를 모아서 보여주는 역할

```ts title="quartz.config.ts"
const config: QuartzConfig = {
	configuration: {...
	},

	plugins: {
		transformers: [...
		],
		filters: [...
		],
		emitters: [...
		]
	}
}

export default config
```

---
### Quartz의 기본 Layout

[Layout](https://quartz.jzhao.xyz/layout)은 `quartz.layout.ts`에서 설정할 수 있고 크게 3개의 Layout으로 나눌 수 있다
- Shared Page : 모든 페이지에서 공유되는 layout
	- 블로그 이름, 댓글창, 하단 문구, ...
- Default Content Page : 노트의 내용을 담고 있는 layout
	- 노트 제목, 프론트매터, 태그
	- 좌측 : 파일탐색기, 검색창, light/dark 모드 전환, ...
	- 우측 : 그래프, 목차, 백링크
- Default List Page : 노트 목록을 보여주는 페이지의 layout (파일 탐색기에서 폴더이름을 클릭한 경우)

```ts title="quartz.layout.ts"
export const sharedPageComponents: SharedLayout = {
	head: [],
	header: [],
	afterBody: [],
	footer: [],
}

export const defaultContentPageLayout: PageLayout = {
	beforeBody: [],
	left: [],
	right: [],
}

export const defaultListPageLayout: PageLayout = {
	beforeBody: [],
	left: [],
	right: [],
}
```



기본 제공되는 configuration과 layout에서 수정하거나 추가하고 싶은 부분이 있다면  
일단 공식 docs의 feature 혹은 plugins를 참고해서 원하는 기능이 있는지 확인해보고 만약 없다면 대부분 위의 두 파일을 건드리면 된다.


### 내가 수정한 부분
1. Transformers plugin의 TableOfContents 파라미터 maxDepth을 5로 수정
	- 나는 보통 header 3, 5를 많이 사용해서 default값 3에서 5으로 수정했다
2. Shared Page에 [[Obsidian Quartz Blog 시작하기#^0dc00b|댓글창]], [[Obsidian Quartz Blog 시작하기#^45a2bf|Recent Notes]] 기능 추가
	- Recent Notes의 경우 afterBody에 넣어서 `index.md` 내용이 먼저 나오고 하단에 Recent Notes 가 나오도록 했다 ^ccdc30
3. Shared Page 하단에 내 개인 GitHub, LinkedIn, Naver blog 링크와 아이콘 추가
	- 기존 footer에 있는 내용을 내 개인 계정 링크로 수정했다
	- 그리고 텍스트보다 아이콘으로 링크를 걸고 싶어서 `quartz/components/Footer.tsx` 부분도 추가로 수정했다

	![[Configuration과 Layout - 2025-05-22 - 15-57-22.png|470x116]]

1. ~~Default Content left에 있는 Explorer 설정에서 폴더와 노트 앞에 icon 추가~~
	- ~~[다음](https://quartz.jzhao.xyz/features/explorer#add-emoji-prefix)을 참고했다~~
	- 다시 제거. useSavedState를 false로 수정해서 항상 클릭하지 않은 폴더는 닫혀 있도록 했다
2. explorer에서 파일이름이 긴 경우 ... 처리
	- `explorer.scss`와 `Explorer.tsx`를 수정
		```css title="explorer.scss"
		...
		.folder-title,
		.file-title {
		  display: inline-block;
		  max-width: 160px;
		  font-size: 0.83rem;
		  line-height: 1;  
		  white-space: nowrap;
		  overflow: hidden;
		  text-overflow: ellipsis;
		  vertical-align: middle;
		}
		```

		```ts title="Explorer.tsx"
		...
		       <template id="template-file">
		          <li>
		            {/* <a href="#"></a> */}              // 기존
		            <a href="#" class="file-title"></a>   // 수정
		          </li>
		        </template>
		...
		```