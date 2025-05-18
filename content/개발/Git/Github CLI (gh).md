---
tags:
  - Git
  - GitHub
url: 
Creation Date: 2025년 5월 14일 수요일
Last modified: 2025년 5월 15일 목요일 10:06:08
related: 
---
> [!note] gh란?
>- GitHub에서 공식 제공하는 **CLI(Command Line Interface)** 도구
>- 터미널에서 GitHub와 관련된 작업(예: PR 생성, 이슈 관리, 저장소 복제 등)을 **빠르고 직관적으로 처리할 수 있게 해주는 툴**
>- Git 명령어를 대체하는 툴이 아니라, GitHub 중심 상위 기능 제공 도구
>- gh는 **GitHub 웹 인터페이스에서 하던 대부분의 작업을 CLI에서 가능하게 해주는 툴**로,  Git 자체를 대체하지 않고, **GitHub와의 연동 작업을 훨씬 효율적으로 만들어준다.**
##### 설치
`brew install gh`
`gh  --version` : 버전 확인
##### 인증 및 기본 설정
`gh auth login` : GitHub계정으로 CLI 로그인 -> 초기 세팅 진행 (~/.config/gh/config.yml, host.yml에 저장)
`gh auth logout` : GitHub계정 CLI 로그아웃
`gh auth status` : 현재 인증 상태 확인
`gh auth refresh` : 인증 토큰 갱신
##### 저장소 관련
`gh repo clone <user/repo>` : git clone과 동일
`gh repo create` : 새로운 GitHub 저장소 생성
`gh repo view` : 현재 연결된 GitHub 저장소 정보 확인
`gh repo list` : 현재 연결된 GitHub 저장소 목록 확인
##### 브랜치 & PR
`gh pr create --base main --head feature --title "제목"` : 현재 브랜치에서 PR 생성
`gh pr list` : 현재 저장소의 열려 있는 PR 목록 확인
`gh pr view 123` : PR 번호 123번의 상세 정보 확인
`gh pr checkout 123` : PR 번호 123번의 브랜치를 로컬에 체크아웃
`gh pr merge 123` : PR을 merge
`gh pr status` : 현재 브랜치의 PR 상태 요약 (커밋 포함)

##### 이슈
`gh issue list` : 현재 저장소의 열려 있는 이슈 목록 보기
`gh issue view 34` : 이슈 번호 34의 상세 내용 보기
`gh issue create --title "버그 발생" --body "상세내용"` : 새 이슈 생성
`gh issue close <number>` : 이슈 닫기
##### 워크플로우 (GitHub Actions)
`gh workflow list` : 워크플로우 목록 확인
`gh run list` : 실행된 워크플로우 러닝 목록
`gh run view <run-id>` : 워크플로우 실행 상세 보기
`gh run watch <run-id>` : 워크플로우 실행 실시간 모니터링
`gh run rerun <run-id>` : 워크플로우 다시 실행
##### Discussions (토론)
`gh discussion list` : Discussions 목록 보기
`gh discussion view <number>` : 특정 Discussion 보기
`gh discussion create` : 새 Discussion 생성
##### Gist
`gh gist create <file>` : Gist 생성
`gh gist list` : Gist 목록 확인
`gh gist view <id>` : 특정 Gist 보기
##### 기타 유용한 명령어
`gh help` : 모든 gh 명령어와 사용법 요약 보기
`gh extension install <name>` : 외부 gh 확장 기능 설치
`gh alias set co 'pr checkout'` : alias 설정
