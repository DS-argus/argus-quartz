# stage-content 사용 가이드

이 문서는 `scripts/stage-content.sh`를 사용해서 Obsidian 글(`content/**/*.md`)과 첨부 이미지(`content/Files`)를 깔끔하게 GitHub에 올리는 방법을 설명합니다.

## 배경

- Obsidian 첨부파일 저장 위치가 `content/Files`로 고정되어 있음
- 로컬 노트 작업 중 생긴 이미지도 `content/Files`에 쌓여 `git status`가 지저분해짐
- 목표:
  - 평소에는 `content/Files` 변경을 숨기고
  - 실제 게시 글에서 참조한 이미지들만 자동으로 커밋에 포함

## 1회 설정

`.gitignore`에 `content/Files/**`가 추가되어 있어야 합니다.

효과:
- `content/Files` 신규 파일은 기본적으로 `git status`에서 보이지 않음
- 단, 스크립트가 필요한 파일은 `git add -f`로 강제 stage 가능

## 글 발행 절차 (권장)

1. 로컬 폴더에서 작성한 글을 `content/`로 이동

```bash
mv "200. Inbox/내 글.md" "content/Dev/내 글.md"
```

2. 게시 대상 글과 첨부를 자동 stage

```bash
./scripts/stage-content.sh "content/Dev/내 글.md"
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

4. 각 md 파일에서 링크 추출
- Obsidian wikilink: `![[...]]`, `[[...]]`
- Markdown link: `![...](...)`, `[...](...)`

5. 링크 문자열 정리
- `#anchor`, `?query` 제거
- `http://`, `https://` 같은 외부 URL 제외
- 인코딩/이스케이프 문자 정리

6. 경로 후보 해석
- 문서 기준 상대경로
- `content/...`
- `Files/...` -> `content/Files/...`
- 파일명만 있는 경우 `content/Files/<파일명>`

7. 실제로 존재하는 `content/Files/...` 파일만 추림

8. 추린 첨부파일을 `git add -f -- ...`로 stage
- `.gitignore`에 걸려 있어도 필요한 파일은 커밋 대상에 포함됨

9. 결과 요약 출력
- staged markdown 개수
- 자동 stage된 첨부 개수
- 찾지 못한 참조 경로 경고

## 참고

- `scripts/stage-content.mjs`는 "필요한 파일 자동 추가" 용도입니다.
- 이미 과거에 올라간 불필요 이미지 정리(`git rm --cached` 등)는 별도 정리 작업이 필요합니다.
