---
tags:
  - tmux
  - multiplexer
url: 
created: 2025-05-23T19:50:40
updated: 2025-05-23T23:19:30
permalink: /Dev/workflow/terminal-multiplexers-and-tmux
related: 
---
### 터미널 멀티플렉서란? 

**터미널 멀티플렉서 (Terminal Multiplexer)** 는 하나의 터미널 창 안에서 여러 개의 터미널 세션을 동시에 실행하고 관리할 수 있게 해주는 도구이다  
마치 하나의 모니터에서 여러 화면을 나눠 사용하는 느낌이라고 생각하면 되며, 가장 중요한 특징 중 하나는 _사용자의 연결이 끊어지더라도 원격 프로세스가 계속 실행_ 되도록하는데 유용하다

##### 왜 필요한가?

기본적인 터미널에서는 한 번에 하나의 작업만 수행할 수 있다. 하지만 서버 작업을 하거나 딥러닝 코드를 돌리는 등 다양한 개발 환경에서는 다음과 같은 상황이 자주 발생한다
- 백그라운드에서 코드를 실행하면서 다른 로그도 동시에 보고 싶을 때
- 하나의 SSH 접속 안에서 여러 개의 작업을 병렬로 돌리고 싶을 때
- 긴 작업을 실행해두고 중간에 연결이 끊겨도 이어서 다시 작업하고 싶을 때

이런 경우 터미널 멀티플렉서를 사용하면 다음과 같은 이점을 얻을 수 있다
- 하나의 터미널 세션 안에서 여러 창/패널 분할 가능
- 세션을 끊어도 실행 중인 작업이 유지됨 (재접속 가능)
- 터미널 환경에서도 복잡한 작업을 동시에 효율적으로 수행 가능

사실 여러 창을 분할하고 탭을 만드는 작업의 경우, 그냥 직접 새로운 터미널을 열어도 되긴하고 최근 많은 _터미널 에뮬레이터 (terminal emulator)[^1]_ 에서 다 지원하는 기능이긴하다    


하지만 매번 직접 여는건 불편할 뿐더러 작업 중인 세션을 유지하고 재접속하는 기능은 없는 경우가 대부분이기 때문에 터미널 멀티플렉서를 따로 활용할 수 있으면 유용하다

### tmux : 대표적인 오픈소스 터미널 멀티플렉서

**tmux** 는 아마도 가장 쉽게 접할 수 있는 터미널 멀티플렉서일 것이다    
[오픈소스](https://github.com/tmux/tmux)로 운영되고 있고 여전히 활발하게 개선이 이루어지고 있으며 tmux는 Unix 기반 OS를 위한 멀티플렉서이기 때문에 linux와 macOS에서 사용가능하다

##### tmux 설치 및 접속

linux에서는 apt, 맥북에서 tmux는 homebrew로 설치해서 사용하면 된다
```shell
apt get tmux          // linux
brew install tmux     // macOS
```

그리고 다음 명령어로 tmux에 접속할 수 있다
```shell
tmux
```

그럼 다음과 같이 하단 부분이 초록색으로 변하면서 (못생긴) 화면으로 입장한다   

![[터미널 멀티플렉서와 tmux - 2025-05-23 - 20-57-50.png|682x376]]


##### tmux 화면 구성 : Session, Window, Pane

tmux의 화면을 구성하는 3가지 요소는 다음과 같다

1. Session : **하나의 작업 공간**
	- tmux 작업의 가장 상위 단위
	- 여러 window를 포함할 수 있으며 세션 단위로 생성, 종료, 분리 (detach), 접속 (attach) 할 수 있다
2. Window : **작업 공간 안에 있는 탭**
	- 하나의 session 안에서 사용하는 가상 터미널 탭
	- 하나의 window는 기본적으로 하나의 shell을 포함하며, 여러 개의 window를 동시에 생성하고 전환할 수 있다
3. Pane : **탭 안에 있는 split view**
	- 하나의 window 안을 가로 또는 세로로 나누어 만든 화면 분할 단위
	- 각 pane은 독립적인 shell을 실행할 수 있어 병렬 작업이 쉽게 가능하다

![[터미널 멀티플렉서와 tmux - 2025-05-23 - 21-00-32.png|690x414]][^3]


아까 `tmux` 명령어를 통해 접속한 화면을 다시 보자

![[터미널 멀티플렉서와 tmux - 2025-05-23 - 20-57-50.png|682x376]]

지금 첫번째 Session에 접속을 해서 하나의 pane으로 구성된 window를 보고 있는 것이다


### tmux 명령어

이제 tmux를 자유자재로 활용하기 위해서 명령어를 익혀야하는데 아래 명령어들만 익숙해져도 충분하다고 생각한다
- session 생성, 종료, detach, attach
- window 생성, window 간 이동, window 제거
- pane 생성, pane 간 이동, pane 제거
- session, window 이름 설정
- session, window, pane 간 편하게 이동

기본적으로 tmux session에 접속해서 어떤 명령어를 입력하기 위해서는 prefix인 `ctrl + b` 를 누르고 입력해야하고 tmux 밖에서 tmux 관련 조작을 하려면 `tmux`로 시작하면 된다

> [!tip] Note
> tmux 환경을 사용해보면 몇 가지 불편함이 있다
> - prefix `ctrl+b` 조합
> - pane 관련 명령어
> - 마우스 사용 불가 등...
> 
> 이런 점을 조금이나마 개선한 설정 파일과 플러그인을 아래에 추가했고, 명령어에도 바꾸기 이전과 이후를 모두 적었다


##### Session 관련 명령어
- 새로운 session 시작
	```shell
	tmux
	tmux new -s <session-name> // session 이름 부여
	```


- 현재 session에서 나오기
	```
	<prefix> + d
	```



- 현재 존재하는 session 목록 확인
	```
	tmux ls
	```




- 만들어진 session에 재접속
	```
	tmux attach -t <session-name>
	tmux at  // 최근 접속 session에 바로 attach
	```




- session 이름 변경
	```
	<prefix> + $
	```



- session 종료
	```
	exit
	<prefix> + &                          // 세션 내 마지막 window 종료
	tmux kill-session -t <session-name>   // tmux 밖에서 특정 세션 종료
	```



##### Window 관련 명령어
- 새로운 window 생성
	```
	<prefix> + c
	```




- window 간 이동 : 다음 (n), 이전 (p)
	```
	<prefix> + n, p
	```




- window 이름 변경
	```
	<prefix> + ,
	```




- window 제거
	```
	exit
	<prefix> + &  // kill 확인 여부 물어봄
	```

##### Pane 관련 명령어

- pane 좌우 분할
	```
	<prefix> + %      // 바꾸기 전
	<prefix> + |      // 바꾼 후
	```




- pane 상하 분할
	```
	<prefix> + ""     // 바꾸기 전
	<prefix> + -      // 바꾼 후
	```




- pane 간 이동
	```
	<prefix> + 방향키     // 바꾸기 전
	<prefix> + h,j,k,l  // 바꾼 후 (vim 방향키 : h(왼), j(아래), k(위), l(오))
	```




- 현재 pane 최대화 및 원상복구 (기존에 없는 명령어)
	```
	<prefix> + m
	```




- pane 제거
	```
	exit
	<prefix> + x   // kill 확인 여부 물어봄
	```

##### 기타 명령어

- session, window, pane 간 이동 화면
	```
	<prefix> + s
	```
	- 이후 화살표 혹은 vim 방향키로 원하는 session, window, pane으로 이동한 후 enter를 누르면 이동된다




- copy 모드 : 원래 tmux에서는 마우스 사용이 불가능해서 스크롤이 안되기 때문에 copy 모드 진입해서 이동해야 함
	```
	<prefix> + [     // copy 모드 진입
	ctrl + c or q or esc         // copy 모드 나가기
	```
	- 진입 후에는 화살표로 이동할 수 있고 영역을 선택하여 복사를 할 수 있다
	- 하지만 추후 tmux 설정에서 마우스를 사용할 수 있게 하면 굳이 사용할 일은 없어보인다



### 내가 사용하는 tmux configuration

tmux 관련 여러 설정들은 home directory에 `.tmux.conf`를 만들어서 그 안에 작성해주면 된다

prefix 변경, 명령어 수정, 마우스 사용 허용 등 다양한 요소를 지정할 수 있고  
더 나아가면 plugin을 설치해서 더 많은 기능 및 tmux 내부 테마를 꾸밀 수 있다

나는 [다음](https://github.com/DS-argus/dotfiles/blob/main/tmux/.tmux.conf)과 같이 tmux를 사용하고 있고 이 설정에 대한 비교적 자세한 설명은 이전에 작성한 [블로그 글](https://blog.naver.com/parksoungpark/223765738016)을 확인하면 된다

여기서는 간단하게 내 설정 파일을 그냥 바로 적용하는 방법에 대해서만 간단히 정리한다

##### 적용 방법
1. home directory로 이동해서 tmux 접속
2. .tmux.conf라는 파일을 만들어 [다음](https://github.com/DS-argus/dotfiles/blob/main/tmux/.tmux.conf) 내용 복사 후 저장
3. 플러그인 설치를 위한 플러그인 매니저 tpm (tmux plugin manager)다운로드
	```shell
	git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
	```
	- 앞으로 설치한 플러그인이 저장될 `~/.tmux/plugins/` 폴더가 생기고 그 안에 `tpm/` 폴더 생성
4. 수정한 `.tmux.conf` 를 적용
	```shell
	tmux source-file ~/.tmux.conf
	```
	- `.tmux.conf`를 수정할 때마다 적용을 해줘야하고 위의 설정 파일에서 이 명령어도 `<prefix>+ r`로 수정했다
	- 여기까지 하고 prefix가 `ctrl + space`로 바뀌었다면 잘 적용된 것이다
5. 이제 `.tmux.conf` 에 있는 플러그인 목록들을 인식했으니 설치를 해준다
	```shell
	<prefix> + I
	```
	- 위의 설정 파일에서 prefix를 `ctrl + space`로 수정했다
	- `prefix + U` : `./tmux.conf`에 있는 플러그인 업데이트
	- `prefix + alt + u` : `./tmux.conf`에 없는 플러그인 제거 (그냥 `~/.tmux/plugins/` 폴더에 가서 해당 플러그인 폴더를 삭제해도 된다)

6. 성공적으로 설치가 완료된 후 tmux session을 종료한 다음 다시 접속해보면 테마가 바뀌어 있을 것이다
	- 아이콘이 깨지면 nerd font 를 설치해야할 수 있다
	- macOS에서 테마가 적용 안되면 `brew install bash`를 해보면 도움이 될 수 있다

### 내가 주로 활용하는 방법

나는 local에서도 tmux를 많이 활용한다  
각 session을 마치 작업대처럼 사용해서 window, pane 등을 보관했다가 필요할 때 재접속해서 그대로 사용하며 resurrect 플러그인을 이용해서 컴퓨터가 꺼지더라도 다시 사용했던 session, window, pane을 모두 불러온다

![[터미널 멀티플렉서와 tmux - 2025-05-23 - 23-01-58.png|640x353]]














[^1]: 보통 명령어를 입력하고 확인할 수 있는 CLI 환경을 제공하는 소프트웨어로 iterm2, xterm, wezterm, kitty, ... 다양한 에뮬레이터가 있다
[^3]: https://arcolinux.com/everthing-you-need-to-know-about-tmux-panes/
