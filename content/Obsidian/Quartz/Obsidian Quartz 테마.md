---
tags:
  - Obsidian
  - Quartz
created: 2025-05-21T22:34:20
updated: 2025-05-22T16:39:20
---
### Quartz-Theme
Obsidian의 가장 큰 장점은 아주 많은 테마를  선택할 수 있다는 점이다.  
[Style Settings](https://github.com/mgmeyers/obsidian-style-settings) 플러그인까지 활용하면 정말 건드리지 못하는 곳이 없다 싶을 정도로 커스터마이징이 가능하다.

내 local theme으로는 [Anuppuccin](https://github.com/AnubisNekhet/AnuPpuccin) +  style settings 플러그인을 활용해 아래와 같이 사용하고 있다

![[Obsidian Quartz 테마 - 2025-05-21 - 22-40-20.png|470x269]]

하지만 Quartz로 만든 블로그는 직접 config 파일을 만지는 방법 이외에는 뚜렷한 방도가 없어보였는데 너무 귀찮았기 때문에 검색을 해보았고 다음 GitHub repository를 찾을 수 있었다

https://github.com/saberzero1/quartz-themes?tab=readme-ov-file

### 사용법
Readme에 친절하게 설명이 되어 있다  
나는 Github Actions를 사용한 방법이 아닌 Local로 설치하는 방법을 사용했다

`action.sh`를 quartz repository에 다운받아서 원하는 테마를 다음과 같이 설치했다

```shell
./action.sh anuppuccin
```

만약 action.sh가 실행되지 않는다면 권한을 부여해야한다
```shell
chmod +x action.sh
```

성공적으로 설치가 끝나면 quartz repository 내 다음 경로에 해당 내용이 추가된다

![[Obsidian Quartz 테마 - 2025-05-21 - 22-47-09.png|470x457]]

그리고 `quartz/styles/custom.scss`에 `@use "./themes";` 이 추가되며 build할 때 적용이 되는 것으로 보인다

새로운 테마로 바꾸고 싶으면 그냥 `action.sh`를 다시 실행시켜주면 된다

### 추가적인 변경

이후 추가적으로 수정하고 싶은 사항이 있다면 `styles/themes/` 폴더 내에 있는 `_dark.scss, _light.scss, _index.scss`를 수정해주면 된다

나는 다음 부분들을 추가적으로 수정했다
- header의 색이 header 종류마다 다르게 수정
- header마다 크기와 굵기 수정
	- header별 크기와 굵기가 기존 `quartz/styles/base.scss`로 적용이 되고 있어 해당 파일을 직접 수정했다 (더 나은 방법이 있는지 모르겠다)
- 블로그의 전체적인 배경색이 내 local obsidian 테마와 유사하게 수정
- anuppuccin 테마에서 사용하는 font가 아니라 내가  `quartz.config.ts`에서 설정한 font가 적용되도록 수정



