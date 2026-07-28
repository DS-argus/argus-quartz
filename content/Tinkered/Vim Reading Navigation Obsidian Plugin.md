---
tags:
  - obsidian
  - plugin
  - vim
created: 2026-06-18T22:18:16
updated: 2026-07-28T21:36:31
permalink: /Tinkered/vim-reading-navigation-plugin
---
> [!abstract]+ TL;DR
> - 읽기 모드에서 죽어버리는 vim 내비게이션을 되살리는 Obsidian 플러그인
> - `j`/`k`·`d`/`u` 스크롤과 `f` 링크 힌트로 마우스 없이 읽기 모드 탐색
> - 원작자 승인을 받아 커뮤니티 플러그인 스토어에 정식 등록

> *AI-assisted*

---

Obsidian에서 vim 키 바인딩을 켜놓고 쓴다. 편집할 때는 `j`, `k`로 잘 돌아다니는데, 읽기 모드로 바꾸는 순간 다 먹통이 된다.   
글을 읽을 때는 깔끔하게 읽기 모드로 보고 싶은 경우가 더 많아서 읽는 중에도 키보드로 휙휙 넘기고 싶었다.

그래서 찾아봤더니 마침 딱 맞는 게 있었다. [vim-scrolling](https://github.com/xlongfeng/obsidian-vim-scrolling)이라는 플러그인인데, 읽기 모드에서도 `j`/`k`로 스크롤하고 `gg`, `G`로 위아래 끝까지 점프가 된다. 필요한 기능만 딱 들어있어서 한참 잘 썼다.

다만 쓰다 보니 기존 크롬에서 사용하던 Vimium 익스텐션에 비하면 살짝 아쉬운 게 두 개 있었다.

하나는 반 페이지 스크롤. `Ctrl+D`/`Ctrl+U`로만 되는데 나는 그냥 `d`/`u`로 누르는 게 편했다. 읽기 모드엔 어차피 편집 기능이 없으니 `d`, `u`로 해도 큰 문제가 없을 것 같았다 (원작자한테 추가해달라고 이슈도 남겨봤는데 원본은 vim 표준에 충실하게 두고 싶다는 답이 왔다)

다른 하나는 링크였다. 읽다가 링크를 누르려면 결국 마우스로 손이 갔다. 크롬에서 Vimium으로 `f` 눌러서 링크마다 라벨 띄우고 키보드로 점프하던 게 워낙 편했어서 그 느낌을 읽기 모드에도 넣고 싶었다.

그래서 두 개를 붙였다.

- `Ctrl` 없이 `d`/`u`로도 반 페이지 스크롤
- `f`를 누르면 화면에 보이는 링크마다 라벨이 뜨고 라벨을 입력하면 그 링크로 점프. 내부 문서는 미리보기까지 뜨고, `Enter`로 이동(외부 링크는 URL이 열린다), `Esc`로 취소.

결과적으로 읽는 동안 마우스에 손 안 대고 vim 키만으로 거의 다 된다. 딱 원하던 그림이다.

---

### 커뮤니티 플러그인 등록까지

개인용 fork로 한동안 쓰다가 커뮤니티 플러그인 스토어에 정식으로 올렸다. 이제 [Vim Reading Navigation](https://github.com/DS-argus/vim-reading-nav)이라는 이름으로 검색해서 설치할 수 있다.

fork를 스토어에 올리는 것 자체는 정상 경로다. 올리기 전에 세 가지를 확인했다.

- **라이선스**: 원본이 0BSD라 수정·재배포에 제약이 없다
- **fork 정책**: [Developer Policies](https://docs.obsidian.md/Developer+policies)상 원작자의 공개 승인이 있거나, 연락이 닿지 않고 원본이 6개월 이상 무활동이면 등록할 수 있다. 어느 쪽이든 원작자 크레딧은 필수
- **선례**: Slides Extended처럼 스토어에 승인된 fork가 이미 있다

원작자 승인은 원본 repo에 issue로 요청했다. 예전에 남긴 기능 제안 issue를 인용해 upstream 기여를 먼저 시도했던 흐름을 보여주고 "approved 한마디면 된다"고 적어 원작자의 부담을 줄였다. 이틀 만에 승인 코멘트를 받았고 그 permalink가 승인 증거가 된다.

#### 릴리즈 자동화

릴리즈는 로컬 명령에서 시작해 CI가 끝까지 처리한다.

```bash
npm version patch               # 버전 동기화 + 태그 생성
git push origin master --tags   # 태그 push → release workflow 트리거
```

- **버전 동기화**: `npm version`이 package.json의 `version` 스크립트 훅으로 `version-bump.mjs`를 실행한다. manifest.json의 버전을 올리고 versions.json에 `"새 버전": minAppVersion` 항목을 추가한다
- **태그 규칙**: Obsidian은 release 태그와 manifest 버전이 일치해야 한다. `.npmrc`에 `tag-version-prefix=""`를 넣어 태그가 `v1.1.1`이 아니라 `1.1.1`로 생기게 했다
- **빌드 검증**: push·PR마다 lint workflow가 Node 20·22 matrix에서 빌드와 eslint를 돌린다

태그가 push되면 release workflow가 이어받는다. 핵심만 발췌하면 이렇다.

```yaml
on:
    push:
        tags: ["*"]
permissions:
    contents: write
    attestations: write
    id-token: write
steps:
    # actions/checkout → setup-node → npm ci → npm run build
    - uses: actions/attest-build-provenance@v2
      with:
          subject-path: |
              main.js
              styles.css
    - run: gh release create "${GITHUB_REF_NAME}" main.js manifest.json styles.css
```

- **빌드**: `npm run build`가 `tsc -noEmit` 타입 검사를 통과해야 esbuild production 번들을 만든다
- **출처 증명**: `attest-build-provenance`가 빌드 산출물에 attestation을 첨부한다. 스토어 자동 리뷰가 확인하는 항목이고 `gh attestation verify main.js --repo DS-argus/vim-reading-nav`로 누구나 검증할 수 있다
- **release 생성**: 태그 이름 그대로 release를 만들고 `main.js`·`manifest.json`·`styles.css`를 자산으로 첨부한다

#### 제출과 리뷰 대응

제출은 [community.obsidian.md](https://community.obsidian.md)에 로그인해 repo URL을 웹으로 넣으면 끝난다. obsidian-releases repo에 `community-plugins.json` PR을 보내던 옛 방식은 폐기됐고 지금 그 파일은 디렉토리에서 자동 미러링되는 산출물이다. 플러그인 id는 전역에서 유일해야 하고 obsidian이라는 단어를 넣을 수 없다.

제출하면 자동 리뷰(Scorecard)가 돈다. 실제로 받은 피드백은 3건이었다.

- **Issues disabled**: fork는 Issues 탭이 기본으로 꺼져 있다. `gh repo edit --enable-issues`로 활성화
- **README links to another repository with the same name**: upstream과 repo 이름이 같아 생긴 오탐. repo를 플러그인 id인 `vim-reading-nav`로 rename하니 발동 조건이 사라졌다. GitHub 리다이렉트 덕에 기존 링크도 안전하다. 단, 구 이름으로 새 repo를 만들면 리다이렉트가 끊긴다
- **Missing artifact attestations**: 위의 release workflow에 attestation 단계를 추가해 해결

> [!warning]+ 주의: 공식 문서에 없는 것들
> - fork repo는 소유자가 Actions 탭에서 workflow를 수동으로 켜기 전까지 어떤 트리거도 돌지 않는다
> - 제출 목록의 Request review는 자동 재검사가 아니라 사람 리뷰 요청이다. 자동 리뷰를 다시 돌리려면 버전을 올린 새 release가 필요하다
> - Publish 후 앱 검색에 뜨기까지 배치 전파가 몇 단계 있다. 실측으로 4-5시간 걸렸다

---

### 써보려면

이제 커뮤니티 플러그인으로 설치하면 된다. 설정 → Community plugins → Browse에서 **Vim Reading Navigation**을 검색한다.

직접 빌드해서 쓰는 방법도 그대로 있다.

```bash
git clone https://github.com/DS-argus/vim-reading-nav
cd vim-reading-nav
npm install
npm run build
```

빌드하면 나오는 `main.js`, `manifest.json`, `styles.css`를 볼트의 `.obsidian/plugins/vim-reading-nav/`에 넣고 Obsidian을 다시 켜면 된다. 두 가지만 켜져 있으면 된다: **Vim key bindings**(설정 → 에디터), 그리고 링크 미리보기를 쓰려면 **Page Preview** 코어 플러그인.
