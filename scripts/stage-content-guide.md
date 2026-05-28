# stage-content 사용 가이드

이 문서는 `scripts/stage-content.sh`와 `npm run stage:content`를 사용해서 Obsidian 글(`content/**/*.md`)과 첨부 이미지(`content/Files`)를 Git에 올리는 흐름을 설명합니다.

## 배경

- Obsidian 첨부파일 저장 위치가 `content/Files`로 고정되어 있음
- 로컬 노트 작업 중 생긴 이미지도 `content/Files`에 쌓여 `git status`가 지저분해짐
- 목표:
  - 평소에는 `content/Files` 변경을 숨기고
  - 실제 게시 글에서 참조한 이미지들만 자동으로 커밋에 포함

## 1회 설정

`.git/info/exclude`에 `content/Files/**`를 추가합니다.

효과:

- `content/Files` 신규 파일은 기본적으로 `git status`에서 보이지 않음
- 단, 스크립트가 필요한 파일은 `git add -f`로 강제 stage 가능
- `.gitignore`에는 넣지 않으므로 빌드/배포에서 첨부파일 누락을 피할 수 있음

추가로 현재 저장소는 `simple-git-hooks`를 사용해 아래 훅을 자동 설치합니다.

- `pre-commit`: `npm run stage:content -- --staged-only`

이 훅은 이미 stage된 `content/**/*.md`만 검사하고, 필요한 permalink를 자동 추가한 뒤 관련 변경을 다시 stage합니다.

## 글 발행 절차 (권장)

1. 로컬 폴더에서 작성한 글을 `content/`로 이동

```bash
mv "200. Inbox/내 글.md" "content/Dev/내 글.md"
```

2. 게시 대상 글과 첨부를 자동 stage

```bash
./scripts/stage-content.sh "content/Dev/내 글.md"
```

또는 npm 스크립트를 직접 사용해도 됩니다.

```bash
npm run stage:content -- "content/Dev/내 글.md"
```

파일명을 길게 입력하기 번거로우면 인자 없이 실행해도 됩니다.

```bash
./scripts/stage-content.sh
```

이 경우 `content/` 아래에서 변경된 markdown 파일을 자동 탐지해 먼저 stage한 뒤, 해당 글의 첨부를 자동 stage합니다.

3. stage 결과 확인

```bash
git status --short
git diff --cached --name-only
```

4. 커밋 및 푸시

```bash
git commit -m "post: 내 글 발행"
git push origin main
```

## 여러 글을 한 번에 올릴 때

```bash
./scripts/stage-content.sh "content/Dev/A.md" "content/AI/B.md"
```

```bash
npm run stage:content -- "content/Dev/A.md" "content/AI/B.md"
```

## 자동완성 사용

`bash`/`zsh`에서 경로 자동완성을 사용할 수 있습니다.

```bash
./scripts/stage-content.sh content/Dev/<TAB>
```

## 자동 탐지 모드

아무 인자 없이 실행하면 아래 markdown를 자동 탐지합니다.

- 이미 stage된 `content/**/*.md`
- 수정되었지만 아직 stage되지 않은 `content/**/*.md`
- 새로 생성된(untracked) `content/**/*.md`

실행:

```bash
./scripts/stage-content.sh
```

## pre-commit 모드

커밋 직전에 hook이 실행하는 모드는 `--staged-only`입니다.

```bash
npm run stage:content -- --staged-only
```

이 모드에서는:

- 이미 stage된 `content/**/*.md`만 검사
- 아직 stage하지 않은 다른 글은 자동으로 올리지 않음
- 첨부파일 자동 stage는 계속 수행
- 누락된 permalink는 자동 추가 후 다시 stage

커밋 훅이 이 모드로 동작하므로, 수동 실행으로도 같은 결과를 미리 확인할 수 있습니다.

## permalink 규칙

`permalink`가 이미 있으면 건드리지 않습니다.

없으면 아래 규칙으로 자동 생성합니다.

1. `content/` 이하 디렉터리 경로는 그대로 유지
2. `title`이 ASCII-safe면 `title`을 slugify해서 leaf 생성
3. `title`이 부적절하면 파일명 stem으로 fallback
4. 둘 다 부적절하면 자동 생성 실패

예시:

- `content/Dev/python/Python uv.md` -> `/Dev/python/python-uv`
- `content/Dev/python/python-uv-usage.md` + 한글 title -> `/Dev/python/python-uv-usage`

다음 경우에는 커밋이 차단됩니다.

- `title`과 파일명이 모두 한글/비ASCII라 slug 생성이 애매한 경우
- 자동 생성된 permalink가 기존 route와 충돌하는 경우

이 경우 frontmatter에 직접 `permalink`를 넣고 다시 커밋하면 됩니다.

## 스크립트 동작 상세

실행 파일:

- 래퍼: `scripts/stage-content.sh`
- 본체: `scripts/stage-content.mjs`

`stage-content.sh`는 전달받은 인자를 그대로 `node scripts/stage-content.mjs`에 넘겨 실행합니다.

1. 인자가 있으면 해당 markdown 파일을 먼저 stage

- 내부에서 `git add -- <md 경로들>` 실행

2. 인자가 없으면 변경된 `content/**/*.md`를 자동 탐지해 stage

- staged/unstaged/untracked 상태를 모두 확인

3. 현재 staged 상태에서 `content/` 하위 staged `.md` 목록 수집

- `git diff --name-only --cached --diff-filter=ACMR -- content`

4. 각 md 파일에서 permalink 보정

- 누락된 `permalink` 자동 추가
- 수정된 markdown는 다시 `git add`
- 생성 불가/충돌 시 즉시 실패

5. 각 md 파일에서 링크 추출

- Obsidian wikilink: `![[...]]`, `[[...]]`
- Markdown link: `![...](...)`, `[...](...)`

6. 링크 문자열 정리

- `#anchor`, `?query` 제거
- `http://`, `https://` 같은 외부 URL 제외
- 인코딩/이스케이프 문자 정리

7. 경로 후보 해석

- 문서 기준 상대경로
- `content/...`
- `Files/...` -> `content/Files/...`
- 파일명만 있는 경우 `content/Files/<파일명>`

8. 실제로 존재하는 `content/Files/...` 파일만 추림

9. 추린 첨부파일을 `git add -f -- ...`로 stage

- `.git/info/exclude`에 걸려 있어도 필요한 파일은 커밋 대상에 포함됨

10. 결과 요약 출력

- staged markdown 개수
- 자동 추가된 permalink 개수
- 자동 stage된 첨부 개수
- 찾지 못한 참조 경로 경고

## 참고

- `scripts/stage-content.mjs`는 "필요한 파일 자동 추가 및 permalink 보정" 용도입니다.
- permalink 로직은 `scripts/content/permalink-utils.mjs`에 분리되어 있습니다.
- 이미 과거에 올라간 불필요 이미지 정리(`git rm --cached` 등)는 별도 정리 작업이 필요합니다.
