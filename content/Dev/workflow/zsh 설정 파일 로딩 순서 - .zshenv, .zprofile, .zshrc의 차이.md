---
tags:
  - CLI
  - terminal
  - zsh
created: 2026-04-20T00:00:00
updated: 2026-04-20T00:00:00
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

각 상황에 필요한 설정이 다르기 때문에 파일이 나뉘어 있다.

---

### 2. 로딩 순서

```
.zshenv → .zprofile → .zshrc → .zlogin → (셸 사용) → .zlogout
```

> [!info]+ 시스템 전역 파일
> 각 파일에는 시스템 전역 버전(`/etc/zshenv`, `/etc/zprofile` 등)이 있고, 사용자별 파일(`~/.zshenv`, `~/.zprofile` 등)이 있다. 시스템 전역 파일이 먼저 읽히고, 그 다음 사용자별 파일이 읽힌다.

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

### 4. 셸 유형별 로딩 정리

| 파일 | 로그인 + 인터랙티브 | 비로그인 + 인터랙티브 | 비인터랙티브 (스크립트) |
| :--- | :---: | :---: | :---: |
| `.zshenv` | O | O | O |
| `.zprofile` | O | - | - |
| `.zshrc` | O | O | - |
| `.zlogin` | O | - | - |
| `.zlogout` | O (종료 시) | - | - |

> [!tip]+ macOS 터미널 참고
> macOS의 Terminal.app과 iTerm2는 새 탭/창을 열 때마다 **로그인 셸**로 실행한다. 따라서 `.zprofile`이 매번 읽힌다. 반면 tmux 새 패인이나 VS Code 내장 터미널은 **비로그인 셸**이므로 `.zprofile`을 읽지 않는다.

---

### 5. 실전 가이드

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
