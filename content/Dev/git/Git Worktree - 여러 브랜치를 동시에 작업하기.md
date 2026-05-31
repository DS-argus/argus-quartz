---
tags:
  - git
  - CLI
created: 2026-05-10T00:00:00
updated: 2026-05-10T00:00:00
permalink: /Dev/git/git-worktree
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - git worktree는 하나의 저장소에서 여러 브랜치를 각각 별도 디렉토리로 동시에 체크아웃하는 기능
> - `git stash` + `git checkout` 반복 없이 브랜치 간 병렬 작업 가능
> - 긴급 핫픽스, 코드 리뷰, AI 에이전트 병렬 실행 등에 유용
> - 대안 도구(Worktrunk, GitButler)는 worktree 관리의 번거로움을 줄여주는 래퍼/가상 브랜치 방식 제공

> [!cite]+ Source
> - [learn git worktrees in under 5 minutes - bashbunni](https://youtube.com/watch?v=8vsRb2mTBA8)
> - [Stop Using Git Worktrees. Do THIS Instead. - DevOps Toolbox](https://youtube.com/watch?v=WBQiqr6LevQ)
> - [Git Worktrees: Git Done Right - Frontend Masters Blog](https://frontendmasters.com/blog/git-worktrees-git-done-right/)

---

### 1. 문제: 브랜치 전환의 불편함

개발 중 다른 브랜치를 확인해야 하는 상황은 자주 발생한다.

- 기능 개발 중 긴급 버그 수정 요청이 들어올 때
- PR 리뷰를 위해 다른 브랜치의 코드를 직접 실행해봐야 할 때
- 두 브랜치의 동작을 나란히 비교하고 싶을 때

일반적인 워크플로우는 이렇다:

```bash
git stash           # 현재 작업 임시 저장
git checkout hotfix # 브랜치 전환
# ... 작업 ...
git checkout feature # 원래 브랜치로 복귀
git stash pop       # 임시 저장한 작업 복원
```

이 과정에서 stash 충돌, 빌드 캐시 무효화, IDE 인덱스 재구성 같은 부수 비용이 발생한다. 브랜치를 자주 오가면 체감 시간 낭비가 크다.

---

### 2. git worktree란

git worktree는 **하나의 `.git` 저장소를 공유하면서 여러 브랜치를 각각 독립된 디렉토리에 체크아웃**하는 기능이다. Git 2.5(2015)부터 기본 내장되어 있다.

핵심 개념은 단순하다:

- 기존 방식: 저장소 1개 = 작업 디렉토리 1개
- worktree 방식: 저장소 1개 = 작업 디렉토리 N개

각 worktree는 독립된 파일 시스템 경로를 가지므로, 브랜치 전환 없이 디렉토리만 이동하면 된다.

---

### 3. 기본 사용법

#### 3.1 worktree 생성

```bash
# 기존 브랜치를 새 디렉토리에 체크아웃
git worktree add ../hotfix hotfix-branch

# 새 브랜치를 만들면서 worktree 생성
git worktree add -b new-feature ../new-feature main
```

위 명령을 실행하면 `../hotfix` 디렉토리에 `hotfix-branch`가 체크아웃된다. 원래 저장소의 `.git`을 공유하므로 커밋 히스토리, 리모트 설정 등이 모두 동일하다.

#### 3.2 worktree 목록 확인

```bash
git worktree list
```

```
/home/user/project         abc1234 [main]
/home/user/hotfix          def5678 [hotfix-branch]
/home/user/new-feature     ghi9012 [new-feature]
```

#### 3.3 worktree 제거

```bash
# 디렉토리 삭제 후 정리
rm -rf ../hotfix
git worktree prune

# 또는 한 번에 제거
git worktree remove ../hotfix
```

> [!tip]+ 같은 브랜치를 두 worktree에서 동시에 체크아웃할 수 없다
> 하나의 브랜치는 한 worktree에만 연결된다. 같은 브랜치를 다른 worktree에서 열려고 하면 에러가 발생한다.

---

### 4. 실무 활용 패턴

#### 4.1 Bare clone + worktree 패턴

worktree를 본격적으로 활용할 때 많이 쓰는 구성이다:

```bash
# bare clone (작업 디렉토리 없이 .git만 클론)
git clone --bare git@github.com:user/repo.git repo
cd repo

# 브랜치별 worktree 생성
git worktree add main main
git worktree add feature/login feature/login
git worktree add hotfix/auth hotfix/auth
```

```
repo/
├── main/           # main 브랜치
├── feature/login/  # feature 브랜치
├── hotfix/auth/    # hotfix 브랜치
└── (bare .git)
```

이 방식을 쓰면 모든 브랜치가 형제 디렉토리로 나란히 존재한다.

#### 4.2 긴급 핫픽스

```bash
# 현재 feature 작업을 중단하지 않고 hotfix 시작
git worktree add ../hotfix -b hotfix/critical main
cd ../hotfix
# 수정 → 커밋 → 푸시
git worktree remove ../hotfix
```

#### 4.3 AI 에이전트 병렬 실행

Claude Code 등 AI 코딩 에이전트를 여러 작업에 동시 투입할 때 worktree가 유용하다. 각 에이전트가 독립된 worktree에서 작업하면 파일 충돌 없이 병렬 진행이 가능하다.

---

### 5. 주의사항

- **`node_modules`, 빌드 캐시**: 각 worktree마다 별도로 `npm install`이나 빌드를 실행해야 한다. 디스크 사용량이 늘어날 수 있다.
- **IDE 설정**: 일부 IDE는 worktree 구조를 제대로 인식하지 못할 수 있다. VS Code는 각 worktree 디렉토리를 별도 창으로 열면 정상 동작한다.
- **submodule**: worktree와 submodule을 함께 쓸 경우 수동 초기화가 필요할 수 있다.

---

### 6. 대안 도구

worktree의 개념은 강력하지만, 디렉토리 생성/삭제/의존성 재설치 등 관리 오버헤드가 있다. 이를 줄여주는 도구들이 있다.

#### Worktrunk

git worktree 위에 올라가는 관리 래퍼로, AI 시대의 병렬 개발 워크플로우를 위해 설계되었다. worktree 생성·정리·전환을 자동화해준다.

#### GitButler

가상 브랜치(virtual branch) 방식을 사용한다. 하나의 작업 디렉토리 안에서 변경사항을 여러 브랜치에 할당할 수 있다. 파일 단위가 아니라 변경 단위로 브랜치를 관리하므로, worktree처럼 디렉토리를 분리할 필요가 없다.

> [!note]+ worktree vs 대안 도구 선택 기준
> - 별도 도구 설치 없이 Git 기본 기능만으로 충분 → `git worktree`
> - AI 에이전트 병렬 실행이 잦고 자동화가 필요 → Worktrunk
> - 디렉토리 분리 없이 하나의 워킹 디렉토리에서 멀티 브랜치 → GitButler
