---
tags:
  - CLI
  - terminal
  - zsh
created: 2026-04-20T00:00:00
updated: 2026-06-22T00:00:00
permalink: /Dev/workflow/zsh-startup-file-loading-order
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> zsh는 셸이 시작될 때 여러 설정 파일을 순서대로 읽는다. `.zshenv` → `.zprofile` → `.zshrc` → `.zlogin` → `.zlogout` 순서이며, 셸 유형(로그인/비로그인, 인터랙티브/비인터랙티브)에 따라 읽히는 파일이 다르다. 대부분의 설정은 `.zshrc`에, 환경 변수는 `.zshenv`에 넣으면 된다.

> [!cite]+ Source
> - 🔗 [How Do Zsh Configuration Files Work? - freeCodeCamp](https://www.freecodecamp.org/news/how-do-zsh-configuration-files-work/)
> - 🔗 [Zsh Configuration Files - Baeldung](https://www.baeldung.com/linux/zsh-configuration-files)
> - 🔗 [An Introduction to the Z Shell - Startup Files](https://zsh.sourceforge.io/Intro/intro_3.html)

---

### 1. 왜 설정 파일이 여러 개인가

zsh(또는 bash)가 실행되는 방식은 하나가 아니다.

- **로그인 셸** : 시스템에 처음 접속할 때 (SSH, 터미널 앱 첫 실행)
- **비로그인 셸** : 이미 로그인된 상태에서 새 셸을 여는 경우 (tmux 새 패인, 셸 안에서 `zsh` 실행)
- **인터랙티브 셸** : 사용자가 직접 명령어를 입력하는 셸
- **비인터랙티브 셸** : 스크립트 실행 시 자동으로 뜨는 셸 (cron, shell script)

상황마다 필요한 설정이 다르니 파일도 나뉘어 있다.

지금 쓰는 셸이 어떤 유형인지는 직접 확인할 수 있다.

```bash
echo $0                                       # 맨 앞에 '-'(-zsh)가 붙으면 로그인 셸
[[ -o login ]] && echo "login shell"          # 로그인 셸이면 출력
[[ -o interactive ]] && echo "interactive shell"  # 인터랙티브 셸이면 출력
```

`-o`는 zsh의 셸 옵션 상태를 검사하는 문법이다. SSH로 갓 접속한 셸은 보통 로그인 + 인터랙티브, tmux 새 패인은 비로그인 + 인터랙티브, 스크립트 실행은 비인터랙티브로 잡힌다.

---

### 2. 로딩 순서

큰 흐름은 이렇다.

```
.zshenv → .zprofile → .zshrc → .zlogin → (셸 사용) → .zlogout
```

더 정확히는 각 단계마다 **시스템 전역 파일이 먼저, 사용자 파일이 그다음**으로 읽힌다.

```
/etc/zshenv       →  $ZDOTDIR/.zshenv      (항상)
/etc/zprofile     →  $ZDOTDIR/.zprofile    (로그인 셸)
/etc/zshrc        →  $ZDOTDIR/.zshrc       (인터랙티브 셸)
/etc/zlogin       →  $ZDOTDIR/.zlogin      (로그인 셸)
        ────────── 셸 사용 ──────────
$ZDOTDIR/.zlogout →  /etc/zlogout          (로그인 셸 종료)
```

`$ZDOTDIR`은 사용자 설정 파일이 모여 있는 디렉토리다(아래 4번 참고). 따로 지정하지 않으면 기본값이 홈 디렉토리(`$HOME`)라서, `$ZDOTDIR/.zshrc`는 곧 익숙한 `~/.zshrc`가 된다. 종료 단계인 `.zlogout`만 사용자 파일이 시스템 파일보다 먼저 읽힌다는 점은 기억해 둘 만하다.

> [!info]+ 시스템 전역 파일 경로
> 시스템 전역 파일은 배포판마다 위치가 다르다. macOS는 `/etc/zshenv`, `/etc/zprofile`, `/etc/zshrc`처럼 `/etc` 바로 아래에 두지만, Debian·Ubuntu·Arch 등은 `/etc/zsh/` 디렉토리 안에 둔다. 사용자 설정이 자꾸 덮어써진다면 이 전역 파일 경로부터 확인하면 된다.

---

### 3. 각 파일의 역할

##### `.zshenv`

- **모든 셸 유형**에서 항상 읽힌다 (로그인/비로그인, 인터랙티브/비인터랙티브 전부)
- 환경 변수(`PATH`, `EDITOR`, `LANG` 등)를 설정하는 곳
- 스크립트 실행 시에도 읽히므로 **출력을 생성하는 명령은 넣지 않는다**

```bash
# ~/.zshenv
export EDITOR="nvim"
export LANG="en_US.UTF-8"
```

##### `.zprofile`

- **로그인 셸**에서만 읽힌다
- `.zshrc`보다 먼저 실행된다
- `PATH` 추가, 로그인 시 1회만 실행할 설정을 넣는 곳
- bash의 `.bash_profile`에 해당한다

```bash
# ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

##### `.zshrc`

- **인터랙티브 셸**에서만 읽힌다
- alias, 함수, 프롬프트, 플러그인, key binding 등 대부분의 설정이 여기에 들어간다
- 가장 많이 편집하는 파일

```bash
# ~/.zshrc
alias ls="eza --icons=always"
alias ll="eza -lah --icons=always"

source "$(brew --prefix)/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
source "$(brew --prefix)/share/zsh-autosuggestions/zsh-autosuggestions.zsh"

eval "$(starship init zsh)"
eval "$(zoxide init zsh)"
```

##### `.zlogin`

- **로그인 셸**에서 `.zshrc` 이후에 읽힌다
- 로그인 시 실행할 명령(시스템 정보 출력, 메일 확인 등)을 넣는 곳
- `.zprofile`과 역할이 비슷해서 잘 사용하지 않는다

##### `.zlogout`

- **로그인 셸 종료 시** 읽힌다
- 임시 파일 정리, 세션 종료 로그 등에 사용

---

### 4. 설정 파일 위치 바꾸기 — ZDOTDIR

지금까지는 설정 파일이 홈 디렉토리(`~/.zshrc`)에 있다고 가정했다. 하지만 `ZDOTDIR` 환경 변수를 설정하면 zsh는 사용자 설정 파일을 홈이 아닌 다른 디렉토리에서 찾는다. `~/.config/zsh`처럼 한곳에 모아 두면 홈 디렉토리가 점(`.`) 파일로 어수선해지지 않고 설정을 묶어서 관리할 수 있다.

```bash
# ZDOTDIR을 지정하면 그 아래에서 설정 파일을 찾는다
export ZDOTDIR="$HOME/.config/zsh"
# 이후 .zprofile, .zshrc, .zlogin, .zlogout 은 모두 $ZDOTDIR 에서 로드된다
```

> [!warning]+ .zshenv 만은 예외
> `ZDOTDIR`을 설정하는 코드 자체가 어딘가에서 먼저 실행되어야 한다. 그래서 **`.zshenv`만은 `ZDOTDIR`의 영향을 받지 않고 항상 `$HOME`(또는 `/etc`)에서 읽힌다.** `ZDOTDIR`을 지정하는 줄은 반드시 `~/.zshenv`에 둬야 하고, 나머지 파일은 `$ZDOTDIR` 안으로 옮기면 된다.

위치를 옮기고 나면 파일 배치는 다음과 같다.

| 파일 | 위치 |
| :--- | :--- |
| `.zshenv` | `~/.zshenv` (항상 홈에 고정) |
| `.zprofile`, `.zshrc`, `.zlogin`, `.zlogout` | `$ZDOTDIR` (예: `~/.config/zsh`) |

---

### 5. 셸 유형별 로딩 정리

| 파일 | 로그인 + 인터랙티브 | 비로그인 + 인터랙티브 | 비인터랙티브 (스크립트) |
| :--- | :---: | :---: | :---: |
| `.zshenv` | O | O | O |
| `.zprofile` | O | - | - |
| `.zshrc` | O | O | - |
| `.zlogin` | O | - | - |
| `.zlogout` | O (종료 시) | - | - |

> [!tip]+ macOS 터미널 참고
> macOS의 Terminal.app과 iTerm2는 새 탭/창을 열 때마다 **로그인 셸**로 실행한다. 그래서 `.zprofile`이 매번 읽힌다. 반면 tmux 새 패인이나 VS Code 내장 터미널은 **비로그인 셸**이므로 `.zprofile`을 읽지 않는다.

---

### 6. 실전 가이드

어디에 뭘 넣어야 할지 모르겠다면 아래 기준을 따른다.

| 설정 내용 | 넣을 파일 |
| :--- | :--- |
| 환경 변수 (`PATH`, `EDITOR`) | `.zshenv` 또는 `.zprofile` |
| Homebrew PATH (`brew shellenv`) | `.zprofile` |
| alias, 함수, 프롬프트 | `.zshrc` |
| 플러그인 (syntax-highlighting 등) | `.zshrc` |
| 로그인 시 1회 실행 명령 | `.zprofile` |
| 스크립트에서도 필요한 변수 | `.zshenv` |

> [!note]+ PATH를 어디에 넣을까?
> `PATH`는 `.zshenv`에 넣으면 스크립트에서도 사용 가능하지만, macOS의 `/usr/libexec/path_helper`가 `.zprofile` 단계에서 PATH를 재정렬하는 경우가 있다. Homebrew PATH 같은 것은 `.zprofile`에 넣는 것이 안전하다.
