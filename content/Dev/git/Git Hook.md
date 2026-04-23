---
tags:
  - git
  - automation
  - DevOps
created: 2026-04-23T00:00:00
updated: 2026-04-23T00:00:00
permalink: /Dev/git/git-hook
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> Git Hook은 커밋, 푸시, 머지 등 Git 동작의 특정 시점에 자동으로 스크립트를 실행하는 이벤트 시스템이다. 린트 검사, 커밋 메시지 규칙 강제, 민감 정보 유출 방지, 배포 자동화 등 다양한 용도로 활용하며, Husky·pre-commit·Lefthook 같은 도구로 팀 전체가 동일한 Hook을 공유할 수 있다.

---

### 1. Git Hook이란

프로그래밍에서 Hook은 **특정 이벤트가 발생할 때 자동으로 실행되는 코드**를 의미한다. Git Hook도 같은 원리다. `git commit`, `git push` 같은 Git 동작이 일어날 때, 사전에 등록해둔 스크립트가 자동으로 실행된다.

#### 1-1. .git/hooks/ 디렉토리 구조

`git init`으로 저장소를 만들면 `.git/hooks/` 디렉토리가 자동 생성되고, 샘플 스크립트가 들어있다.

```bash
ls .git/hooks/
# applypatch-msg.sample  pre-commit.sample
# commit-msg.sample      pre-push.sample
# post-update.sample     pre-rebase.sample
# pre-applypatch.sample  prepare-commit-msg.sample
# ...
```

`.sample` 확장자를 제거하면 해당 Hook이 활성화된다. 스크립트는 Bash, Python, Node.js 등 실행 가능한 언어라면 무엇이든 사용할 수 있다.

```bash
# pre-commit Hook 활성화
mv .git/hooks/pre-commit.sample .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

#### 1-2. 동작 원리

Git Hook의 핵심은 **종료 코드(exit code)** 기반 제어다.

- 종료 코드 `0` → 동작 계속 진행
- 종료 코드 `0 이외` → 동작 중단

이 단순한 규칙으로 커밋 차단, 푸시 거부 같은 제어가 가능해진다. 단, 모든 Hook이 동작을 차단하는 것은 아니고, `post-*` 계열 Hook은 동작이 이미 완료된 뒤에 실행되므로 알림이나 후처리 용도로만 쓸 수 있다.

---

### 2. Client-side Hook

개발자의 로컬 환경에서 실행되는 Hook이다. 가장 자주 쓰이는 Hook들이 여기에 속한다.

#### 2-1. 커밋 관련 Hook

커밋 과정은 내부적으로 여러 단계로 나뉘며, 각 단계마다 Hook 지점이 있다.

##### pre-commit

```
git commit 실행 → [pre-commit] → 스테이징 영역 스냅샷 생성 → ...
```

커밋이 만들어지기 **직전**에 실행된다. 가장 널리 사용되는 Hook이다.

- 린트 검사 (eslint, flake8 등)
- 코드 포매팅 (prettier, black 등)
- 민감 정보(API 키, 비밀번호) 유출 감지
- 타입 체크

```bash
#!/bin/sh
# 스테이징된 파일에서 console.log 검출 시 커밋 차단
if git diff --cached --name-only | xargs grep -l 'console.log' 2>/dev/null; then
  echo "console.log가 남아있습니다."
  exit 1
fi
```

##### prepare-commit-msg

커밋 메시지 편집기가 열리기 **전에** 실행된다. 기본 커밋 메시지를 자동으로 채울 때 유용하다.

- 브랜치 이름에서 이슈 번호를 추출해 메시지에 삽입
- 머지 커밋, 스쿼시 커밋의 기본 메시지 수정

```bash
#!/bin/sh
# 브랜치 이름이 feat/ISSUE-123 형태면 커밋 메시지에 [ISSUE-123] 자동 추가
BRANCH=$(git symbolic-ref --short HEAD)
ISSUE=$(echo "$BRANCH" | grep -oE '[A-Z]+-[0-9]+')
if [ -n "$ISSUE" ]; then
  sed -i.bak -e "1s/^/[$ISSUE] /" "$1"
fi
```

##### commit-msg

커밋 메시지 작성이 끝난 뒤, 커밋이 확정되기 **전에** 실행된다. 메시지 내용을 검증하는 용도다.

- Conventional Commits 형식 강제 (`feat:`, `fix:`, `docs:` 등)
- 메시지 길이 제한
- 이슈 번호 포함 여부 확인

```bash
#!/bin/sh
# Conventional Commits 형식이 아니면 차단
if ! head -1 "$1" | grep -qE '^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+'; then
  echo "커밋 메시지가 Conventional Commits 형식이 아닙니다."
  echo "예: feat: 로그인 기능 추가"
  exit 1
fi
```

##### post-commit

커밋이 **완료된 후** 실행된다. 종료 코드와 무관하게 커밋은 이미 완료된 상태이므로, 알림 전송이나 로그 기록 같은 후처리에 사용한다.

#### 2-2. 이메일 관련 Hook

`git am` 명령으로 이메일 패치를 적용할 때 사용되는 Hook이다. 메일링 리스트 기반 워크플로에서 주로 쓰인다.

| Hook | 시점 | 용도 |
|------|------|------|
| `applypatch-msg` | 패치 적용 전 | 커밋 메시지 검증 |
| `pre-applypatch` | 패치 적용 후, 커밋 전 | 패치 결과 검증 (테스트 실행 등) |
| `post-applypatch` | 커밋 완료 후 | 알림 전송 |

> [!info]+ 참고
> 이메일 패치 워크플로는 Linux 커널 같은 대규모 오픈소스 프로젝트에서 주로 사용된다. GitHub/GitLab 기반 PR 워크플로에서는 거의 쓰이지 않는다.

#### 2-3. 기타 Client-side Hook

##### pre-rebase

`git rebase` 실행 전에 동작한다. 이미 푸시된 커밋의 rebase를 방지하는 데 사용할 수 있다.

```bash
#!/bin/sh
# main 브랜치에서의 rebase 차단
if [ "$(git symbolic-ref --short HEAD)" = "main" ]; then
  echo "main 브랜치에서 rebase할 수 없습니다."
  exit 1
fi
```

##### post-rewrite

`git commit --amend`나 `git rebase`처럼 기존 커밋을 **다시 쓰는** 명령 이후에 실행된다.

##### post-checkout

`git checkout`이나 `git switch`로 브랜치를 전환한 후 실행된다.

- 브랜치별로 다른 환경 변수 설정
- 의존성 자동 설치 (`npm install` 등)
- 빌드 캐시 정리

##### post-merge

`git merge` 완료 후 실행된다. 머지 후 의존성을 다시 설치하거나, 마이그레이션 스크립트를 실행하는 데 활용한다.

##### pre-push

`git push` 실행 전, 리모트에 데이터가 전송되기 **직전**에 실행된다.

- 전체 테스트 스위트 실행
- 보호 브랜치(main, production)로의 직접 푸시 차단
- 대용량 파일 푸시 방지

```bash
#!/bin/sh
# main 브랜치로 직접 push 차단
BRANCH=$(git symbolic-ref --short HEAD)
if [ "$BRANCH" = "main" ]; then
  echo "main 브랜치로 직접 push할 수 없습니다. PR을 사용하세요."
  exit 1
fi
```

---

### 3. Server-side Hook

Git 서버(원격 저장소)에서 실행되는 Hook이다. 팀 전체에 일괄 적용되며, 클라이언트가 우회할 수 없다는 점이 Client-side Hook과의 핵심 차이다.

##### pre-receive

클라이언트가 `git push`를 보내면, 서버가 ref를 업데이트하기 **전에** 실행된다. 푸시 전체를 한 번에 수락하거나 거부한다.

- 브랜치 보호 정책 강제
- 커밋 메시지 규칙 서버 측 검증
- 특정 파일 패턴 푸시 거부 (바이너리, 대용량 파일 등)

##### update

`pre-receive`와 비슷하지만, 업데이트되는 **각 브랜치마다** 개별적으로 실행된다. 특정 브랜치만 선택적으로 거부할 수 있다.

```bash
#!/bin/sh
# release/* 브랜치는 특정 사용자만 push 허용
REF=$1
if echo "$REF" | grep -q "refs/heads/release/"; then
  if [ "$USER" != "release-manager" ]; then
    echo "release 브랜치는 release-manager만 push할 수 있습니다."
    exit 1
  fi
fi
```

##### post-receive

푸시가 완료된 후 실행된다. 서버 측 후처리에 활용한다.

- CI/CD 파이프라인 트리거
- 배포 자동화
- 채팅/이메일 알림 전송
- 이슈 트래커 자동 업데이트

> [!tip]+ Server-side Hook이 중요한 이유
> Client-side Hook은 `--no-verify` 옵션으로 우회할 수 있지만, Server-side Hook은 우회가 불가능하다. 팀 전체에 반드시 적용해야 하는 정책은 Server-side Hook으로 걸어야 한다.

---

### 4. Hook 실전 활용 예시

#### 4-1. 린트/포매터 자동 실행 (pre-commit)

커밋 전에 스테이징된 파일만 대상으로 린트와 포매팅을 실행한다. 전체 프로젝트를 검사하면 느리기 때문에 **변경된 파일만** 검사하는 것이 핵심이다.

```bash
#!/bin/sh
# 스테이징된 JS/TS 파일만 eslint 실행
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|tsx)$')
if [ -n "$FILES" ]; then
  npx eslint $FILES || exit 1
fi
```

#### 4-2. 커밋 메시지 컨벤션 강제 (commit-msg)

팀에서 Conventional Commits 같은 메시지 규칙을 정하더라도, 사람이 매번 기억하기는 어렵다. `commit-msg` Hook으로 자동 검증하면 규칙이 자연스럽게 정착된다.

#### 4-3. 민감 정보 유출 방지 (pre-commit)

`.env` 파일이 `.gitignore`에 있더라도, 코드 안에 하드코딩된 API 키나 비밀번호는 잡아내지 못한다.

```bash
#!/bin/sh
# AWS 키 패턴 감지
if git diff --cached | grep -qE 'AKIA[0-9A-Z]{16}'; then
  echo "AWS Access Key가 감지되었습니다. 커밋을 중단합니다."
  exit 1
fi
```

> [!note]+ 전문 도구 활용
> 단순 정규식보다는 [gitleaks](https://github.com/gitleaks/gitleaks)나 [detect-secrets](https://github.com/Yelp/detect-secrets) 같은 전문 도구를 pre-commit Hook에 연결하는 것이 더 안정적이다.

#### 4-4. 배포 자동화 (post-receive)

서버의 `post-receive` Hook으로 특정 브랜치에 푸시가 오면 자동 배포를 실행할 수 있다.

```bash
#!/bin/sh
while read oldrev newrev refname; do
  if [ "$refname" = "refs/heads/main" ]; then
    echo "main 브랜치 배포 시작..."
    GIT_WORK_TREE=/var/www/app git checkout -f main
    cd /var/www/app && npm install && npm run build
  fi
done
```

---

### 5. Hook 관리 도구

`.git/hooks/` 디렉토리는 Git이 추적하지 않기 때문에, 팀원들과 Hook을 공유하려면 별도 도구가 필요하다. 프로젝트의 기술 스택에 따라 적합한 도구를 선택하면 된다.

#### 5-1. Husky (Node.js)

Node.js 프로젝트에서 가장 널리 쓰이는 Git Hook 관리 도구다. `package.json`과 함께 버전 관리되므로 팀 전체가 동일한 Hook을 공유한다.

```bash
# 설치
npm install --save-dev husky

# 초기화 (.husky/ 디렉토리 생성)
npx husky init
```

`.husky/pre-commit` 파일을 수정해 Hook을 등록한다.

```bash
# .husky/pre-commit
npx lint-staged
```

> [!info]+ lint-staged와의 조합
> Husky는 보통 [lint-staged](https://github.com/lint-staged/lint-staged)와 함께 쓴다. lint-staged는 스테이징된 파일만 대상으로 린트/포매팅을 실행해 속도를 높여준다.

#### 5-2. pre-commit framework (Python)

Python 생태계에서 표준처럼 쓰이는 도구다. YAML 설정 파일 하나로 다양한 Hook을 선언적으로 관리한다. Python 프로젝트가 아니어도 사용할 수 있다.

```bash
# 설치
pip install pre-commit
```

`.pre-commit-config.yaml` 파일로 Hook을 설정한다.

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-added-large-files
  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black
```

```bash
# Git Hook으로 등록
pre-commit install

# 전체 파일에 수동 실행
pre-commit run --all-files
```

커뮤니티에서 제공하는 수백 개의 Hook을 가져다 쓸 수 있다는 것이 큰 장점이다.

#### 5-3. Lefthook (Go)

Go로 작성된 도구로, 별도 런타임 의존성 없이 바이너리 하나로 동작한다. 설정이 간결하고 병렬 실행을 지원해 속도가 빠르다.

```bash
# 설치
brew install lefthook
```

`lefthook.yml` 파일로 설정한다.

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts,tsx}"
      run: npx eslint {staged_files}
    format:
      glob: "*.{js,ts,tsx}"
      run: npx prettier --check {staged_files}
```

```bash
# Git Hook으로 등록
lefthook install
```

#### 5-4. simple-git-hooks (Node.js)

Husky보다 가벼운 대안이다. 별도 디렉토리 없이 `package.json` 안에 Hook을 직접 선언한다. 설정 파일이 따로 없고, Hook 하나당 명령어 하나를 매핑하는 구조라서 단순한 프로젝트에 적합하다.

```bash
# 설치
npm install --save-dev simple-git-hooks
```

`package.json`에 Hook을 선언한다.

```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged",
    "commit-msg": "npx commitlint --edit $1"
  }
}
```

```bash
# Git Hook으로 등록 (package.json의 "prepare" 스크립트에 넣어두면 npm install 시 자동 실행)
npx simple-git-hooks
```

> [!info]+ Husky와의 차이
> Husky는 `.husky/` 디렉토리에 Hook별 스크립트 파일을 두는 반면, simple-git-hooks는 `package.json`에 인라인으로 선언한다. Hook 수가 적고 단순한 명령만 실행하면 simple-git-hooks가 더 간결하다.

#### 5-5. 도구 비교

| 항목 | Husky | pre-commit | Lefthook | simple-git-hooks |
|------|-------|------------|----------|------------------|
| 언어 | Node.js | Python | Go | Node.js |
| 런타임 의존성 | Node.js 필요 | Python 필요 | 없음 (바이너리) | Node.js 필요 |
| 설정 파일 | `.husky/` 디렉토리 | `.pre-commit-config.yaml` | `lefthook.yml` | `package.json` 내 인라인 |
| 병렬 실행 | 미지원 | 미지원 | 지원 | 미지원 |
| 커뮤니티 Hook | lint-staged 조합 | 수백 개 내장 저장소 | 직접 명령 지정 | 직접 명령 지정 |
| 추천 환경 | Node.js 프로젝트 | Python 또는 다국어 프로젝트 | 런타임 의존성 없이 쓰고 싶을 때 | Hook이 적고 설정을 간결하게 유지하고 싶을 때 |

---

### 6. 주의사항

- **`--no-verify`로 우회 가능**: `git commit --no-verify`를 쓰면 Client-side Hook을 건너뛸 수 있다. 반드시 지켜야 하는 규칙은 Server-side Hook이나 CI에서 이중으로 검증해야 한다.
- **`.git/hooks/`는 버전 관리 대상이 아님**: Git은 `.git/` 내부 파일을 추적하지 않는다. 팀 공유가 필요하면 위의 도구를 사용하거나, 별도 디렉토리에 스크립트를 두고 `core.hooksPath` 설정으로 연결한다.

```bash
# 커스텀 Hook 디렉토리 지정
git config core.hooksPath .githooks
```

- **실행 시간에 주의**: pre-commit Hook이 느리면 개발 흐름이 끊긴다. 전체 테스트보다는 변경 파일 대상의 가벼운 검사만 걸고, 무거운 검증은 CI에 맡기는 것이 좋다.
- **실행 권한 필수**: Hook 스크립트에 실행 권한(`chmod +x`)이 없으면 동작하지 않는다.
