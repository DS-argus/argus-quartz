---
tags:
  - git
  - github
  - CLI
created: 2025-05-14
updated: 2025-05-21T22:21:11
---
> [!info] gh란?
>- GitHub에서 공식 제공하는 **CLI(Command Line Interface)** 도구
>- 터미널에서 _GitHub와 관련된 작업(예: PR 생성, 이슈 관리, 저장소 복제 등)_ 을 처리할 수 있게 해주는 툴

##### 설치 (macOS 기준)
- Homebrew를 이용한 설치
	``` shell
	brew install gh
	```

- 버전 확인

	```shell
	gh --version
	```

---

##### 인증 및 기본 설정
- GitHub계정으로 CLI 로그인 → 초기 세팅 진행 (~/.config/gh/config.yml, host.yml에 저장)
	```shell
	gh auth login
	```
- GitHub계정 CLI 로그아웃
	```shell
	gh auth logout
	```
- 현재 인증 상태 확인
	```shell
	gh auth status
	```
- 인증 토큰 갱신
	```shell
	gh auth refresh
	```

---
##### 저장소 관련
- git clone
	```shell
	gh repo clone <user/repo>
	```
- 새로운 GitHub 저장소 생성
	```shell
	gh repo create
	```
- 현재 연결된 GitHub 저장소 정보 확인
	```shell
	gh repo view
	```
- 현재 연결된 GitHub 저장소 목록 확인
	```shell
	gh repo list
	```
---
##### 브랜치 & PR
- 현재 브랜치에서 PR 생성
	```shell
	gh pr create --base main --head feature --title "제목"
	```
- 현재 저장소의 열려 있는 PR 목록 확인
	```shell
	gh pr list
	```
- PR 번호 123번의 상세 정보 확인
	```shell
	gh pr view 123
	```
- PR 번호 123번의 브랜치를 로컬에 체크아웃
	```shell
	gh pr checkout 123
	```
- PR을 merge
	```shell
	gh pr merge 123
	```
- 현재 브랜치의 PR 상태 요약 (커밋 포함)
	```shell
	gh pr status
	```
---
##### 이슈
- 현재 저장소의 열려 있는 이슈 목록 보기
	```shell
	gh issue list
	```
- 이슈 번호 34의 상세 내용 보기
	```shell
	gh issue view 34
	```
- 새 이슈 생성
	```shell
	gh issue create --title "버그 발생" --body "상세내용"
	```
- 이슈 닫기
	```shell
	gh issue close <number>
	```
---
##### 워크플로우 (GitHub Actions[^2])
- 워크플로우 목록 확인
	```shell
	gh workflow list
	```
- 실행된 워크플로우 러닝 목록
	```shell
	gh run list
	```
- 워크플로우 실행 상세 보기
	```shell
	gh run view <run-id>
	```
- 워크플로우 실행 실시간 모니터링
	```shell
	gh run watch <run-id>
	```
- 워크플로우 다시 실행
	```shell
	gh run rerun <run-id>
	```
---
##### Discussions (토론)
- Discussions 목록 보기
	```shell
	gh discussion list
	```
- 특정 Discussion 보기
	```shell
	gh discussion view <number>
	```
- 새 Discussion 생성
	```shell
	gh discussion create
	```
---
##### Gist[^1]
- Gist 생성
	```shell
	gh gist create <file>
	```
- Gist 목록 확인
	```shell
	gh gist list
	```
- 특정 Gist 보기
	```shell
	gh gist view <id>
	```
---
##### 기타 유용한 명령어
- 모든 gh 명령어와 사용법 요약 보기
	```shell
	gh help
	```
- 외부 gh 확장 기능 설치
	```shell
	gh extension install <name>
	```
- alias 설정
	```shell
	gh alias set co 'pr checkout'
	```

[^1]: 코드 조각, 메모, 설정 파일 등을 간편하게 저장하고 공유할 수 있도록 해주는 GitHub의 경량 버전 저장소 서비스

[^2]: 코드 변경 이벤트를 기반으로 테스트, 빌드, 배포 등 다양한 작업을 자동화할 수 있게 해주는 GitHub의 CI/CD 워크플로우 도구
