---
tags:
  - obsidian
  - plugin
  - vim
created: 2026-06-18T22:18:16
updated: 2026-06-18T22:33:02
permalink: /Obsidian/vim-reading-navigation-plugin
---
> [!abstract]+ TL;DR
> - 읽기 모드에서 죽어버리는 vim 내비게이션을 되살리는 Obsidian 플러그인
> - `j`/`k` 줄 단위, `d`/`u`·`Ctrl+D`/`Ctrl+U` 반 페이지, `gg`/`G` 양 끝 스크롤
> - `f`로 화면의 링크에 라벨을 띄워 키보드만으로 이동하는 Vimium식 링크 힌트

---

Obsidian에서 vim 키 바인딩을 켜놓고 쓴다. 편집할 때는 `j`, `k`로 잘 돌아다니는데, 읽기 모드로 바꾸는 순간 다 먹통이 된다.   
글을 읽을 때는 깔끔하게 읽기 모드로 보고 싶은 경우가 더 많아서, 읽는 중에도 키보드로 휙휙 넘기고 싶었다.

그래서 찾아봤더니 마침 딱 맞는 게 있었다. [vim-scrolling](https://github.com/xlongfeng/obsidian-vim-scrolling)이라는 플러그인인데, 읽기 모드에서도 `j`/`k`로 스크롤하고 `gg`, `G`로 위아래 끝까지 점프가 된다. 필요한 기능만 딱 들어있어서 한참 잘 썼다.

다만 쓰다 보니 기존 크롬에서 사용하던 Vimium 익스텐션과 비교하여 살짝 아쉬운 게 두 개 있었다.

하나는 반 페이지 스크롤. `Ctrl+D`/`Ctrl+U`로만 되는데 나는 그냥 `d`/`u`로 누르는 게 편했다. 읽기 모드엔 어차피 편집 기능이 없으니 `d`, `u`로 해도 큰 문제가 없을 것 같았다 (원작자한테 추가해달라고 이슈도 남겨봤는데 원본은 vim 표준에 충실하게 두고 싶다는 답이 왔다)

다른 하나는 링크였다. 읽다가 링크를 누르려면 결국 마우스로 손이 갔다. 크롬에서 Vimium으로 `f` 눌러서 링크마다 라벨 띄우고 키보드로 점프하던 게 워낙 편했어서, 그 느낌을 읽기 모드에도 넣고 싶었다.

그래서 두 개를 붙였다.

- `Ctrl` 없이 `d`/`u`로도 반 페이지 스크롤
- `f`를 누르면 화면에 보이는 링크마다 라벨이 뜨고, 라벨을 입력하면 그 링크로 점프. 내부 문서는 미리보기까지 뜨고, `Enter`로 이동(외부 링크는 URL이 열린다), `Esc`로 취소.

결과적으로 읽는 동안 마우스에 손 안 대고 vim 키만으로 거의 다 된다. 딱 원하던 그림이다.

### 써보려면

스토어엔 안 올린 개인용 fork라 직접 빌드해서 넣어야 한다.   
https://github.com/DS-argus/obsidian-vim-scrolling

```bash
git clone https://github.com/DS-argus/obsidian-vim-scrolling vim-reading-nav
cd vim-reading-nav
npm install
npm run build
```

빌드하면 나오는 `main.js`, `manifest.json`, `styles.css`를 볼트의 `.obsidian/plugins/vim-reading-nav/`에 넣고 Obsidian을 다시 켜면 된다. 두 가지만 켜져 있으면 된다 — **Vim key bindings**(설정 → 에디터), 그리고 링크 미리보기를 쓰려면 **Page Preview** 코어 플러그인.
