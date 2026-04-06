---
tags:
  - linux
  - permission
created: 2025-06-27T14:52:54
updated: 2026-04-06T22:07:52
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!note] 알아볼 내용
> 1. 권한의 기본 구조 — 누가, 무엇을
> 2. 숫자 표기법
> 3. `ls -l` 출력 읽기
> 4. `chmod` — 권한 변경
> 5. `chown` / `chgrp` — 소유자 변경
> 6. 자주 쓰는 권한 조합
> 7. 디렉토리 권한의 차이
> 8. umask — 기본 권한 설정
> 9. 특수 비트 — setuid, setgid, sticky

---
### 권한의 기본 구조 — 누가, 무엇을
##### "누가" — 세 부류의 사용자
- **Owner (u)** : 파일을 만든 소유자
- **Group (g)** : 소유자가 속한 그룹의 사용자들
- **Other (o)** : 그 외 모든 사용자

##### "무엇을" — 세 가지 권한

| 권한 | 기호 | 숫자 | 파일에서의 의미 |
| :--- | :---: | :---: | :--- |
| 읽기 | `r` | 4 | 파일 내용을 볼 수 있음 |
| 쓰기 | `w` | 2 | 파일 내용을 수정할 수 있음 |
| 실행 | `x` | 1 | 파일을 프로그램으로 실행할 수 있음 |

- 세 권한의 숫자를 **더해서** 조합을 표현
	- `r + w = 4 + 2 = 6` → 읽기+쓰기
	- `r + w + x = 4 + 2 + 1 = 7` → 전부 허용
	- 아무 권한 없음 = `0`

---
### 숫자 표기법
##### 0~7 숫자-권한 매핑

| 숫자 | 기호 | 권한 |
| :---: | :---: | :--- |
| 0 | `---` | 없음 |
| 1 | `--x` | 실행만 |
| 2 | `-w-` | 쓰기만 |
| 3 | `-wx` | 쓰기+실행 |
| 4 | `r--` | 읽기만 |
| 5 | `r-x` | 읽기+실행 |
| 6 | `rw-` | 읽기+쓰기 |
| 7 | `rwx` | 전부 |

##### 세 자리 조합 — Owner / Group / Other 순서
```text title="숫자 해석법"
  7    5    5
 rwx  r-x  r-x
  │    │    └── Other : 읽기+실행
  │    └─────── Group : 읽기+실행
  └──────────── Owner : 전부
```

---
### `ls -l` 출력 읽기
```bash title="파일 목록 상세 보기"
ls -l
# -rw-r--r--  1 argus  staff  4096  Apr  6 14:30 config.yaml
# drwxr-xr-x  3 argus  staff    96  Apr  6 14:30 scripts/
```

```text title="각 필드 해석"
-  rw-  r--  r--   1   argus  staff  4096  Apr 6 14:30  config.yaml
│  │    │    │     │     │      │     │          │          │
│  │    │    │     │     │      │     │          │          └ 파일명
│  │    │    │     │     │      │     │          └ 수정 시간
│  │    │    │     │     │      │     └ 파일 크기 (bytes)
│  │    │    │     │     │      └ 소유 그룹
│  │    │    │     │     └ 소유자
│  │    │    │     └ 하드링크 수
│  │    │    └ Other 권한
│  │    └ Group 권한
│  └ Owner 권한
└ 파일 타입 (- : 파일, d : 디렉토리, l : 심볼릭 링크)
```

---
### `chmod` — 권한 변경

##### 숫자 방식
```bash title="chmod 숫자 방식"
chmod 755 script.sh       # rwxr-xr-x — 실행 가능한 스크립트
chmod 644 config.yaml     # rw-r--r-- — 일반 설정 파일
chmod 600 id_rsa          # rw------- — SSH 개인키 (소유자만)
chmod 777 tmp_dir         # rwxrwxrwx — 모두 허용 (보안 주의)
```

##### 기호 방식
```bash title="chmod 기호 방식"
# u=소유자, g=그룹, o=기타, a=전체
chmod u+x script.sh       # 소유자에 실행 권한 추가
chmod g-w config.yaml     # 그룹에서 쓰기 권한 제거
chmod o=r file.txt        # 기타 사용자를 읽기만으로 설정
chmod a+r public.html     # 모든 사용자에 읽기 추가
chmod u=rwx,g=rx,o=rx script.sh   # 755와 동일
```

##### 재귀 적용
```bash title="하위 파일/폴더 전체에 적용"
# 디렉토리 전체에 재귀 적용
chmod -R 755 ./deploy/

# 파일과 디렉토리를 구분해서 적용하고 싶을 때
find ./project -type f -exec chmod 644 {} \;   # 파일만 644
find ./project -type d -exec chmod 755 {} \;   # 디렉토리만 755
```

> [!tip] 숫자 vs 기호 — 언제 쓰는가
> - **숫자** : 권한을 처음부터 확실하게 지정할 때 (`chmod 755`)
> - **기호** : 기존 권한에서 일부만 추가/제거할 때 (`chmod u+x`)

---
### `chown` / `chgrp` — 소유자·그룹 변경
- 권한(permission)과 소유자(ownership)는 별개 — 둘 다 맞아야 접근 가능

```bash title="소유자/그룹 변경"
# 소유자 변경
chown newuser file.txt

# 소유자 + 그룹 동시 변경
chown newuser:newgroup file.txt

# 그룹만 변경
chgrp deploy file.txt

# 재귀 적용
chown -R appuser:appgroup ./data/
```

```bash title="실무 예시"
# 웹 서버가 읽을 수 있도록 소유자 변경
sudo chown -R www-data:www-data /var/www/html/

# 배포 디렉토리를 deploy 그룹 소유로
sudo chown -R root:deploy /opt/app/
sudo chmod -R 775 /opt/app/
```

---
### 자주 쓰는 권한 조합

| 권한 | 기호 | 용도 | 실무 예시 |
| :---: | :---: | :--- | :--- |
| `644` | `rw-r--r--` | 일반 파일 기본값 | 설정 파일, HTML, 소스 코드 |
| `600` | `rw-------` | 민감한 파일 | SSH 키(`~/.ssh/id_rsa`), `.env` |
| `755` | `rwxr-xr-x` | 실행 파일·디렉토리 기본값 | 쉘 스크립트, 공개 디렉토리 |
| `700` | `rwx------` | 개인 전용 | `~/.ssh/` 디렉토리, 개인 스크립트 |
| `775` | `rwxrwxr-x` | 그룹 공유 | 팀 배포 디렉토리 |
| `777` | `rwxrwxrwx` | 모두 허용 | `/tmp` 정도. 일반적으로 사용 금지 |
| `400` | `r--------` | 읽기 전용 (소유자만) | 인증서, 백업된 키 파일 |

> [!warning] SSH 키 권한이 맞지 않으면 접속 자체가 거부됨
> ```bash
> # SSH가 키 파일 권한이 너무 열려있으면 사용을 거부
> # Permissions 0644 for 'id_rsa' are too open. → 접속 실패
> chmod 600 ~/.ssh/id_rsa         # 개인키
> chmod 644 ~/.ssh/id_rsa.pub     # 공개키
> chmod 700 ~/.ssh                # .ssh 디렉토리
> ```

---
### 디렉토리 권한의 차이
- 파일과 디렉토리에서 `r`, `w`, `x`의 의미가 다름

| 권한 | 파일 | 디렉토리 |
| :---: | :--- | :--- |
| `r` | 내용 읽기 (`cat`) | 목록 보기 (`ls`) |
| `w` | 내용 수정 | 파일 생성/삭제/이름 변경 |
| `x` | 실행 | **진입** (`cd`) |

```bash title="디렉토리 권한 실험"
# x 없이 r만 있는 디렉토리
chmod 744 mydir/     # rwxr--r--
ls mydir/            # ✅ 목록은 보임 (r)
cat mydir/file.txt   # ❌ 진입 불가 (x 없음)
cd mydir/            # ❌ 진입 불가

# r 없이 x만 있는 디렉토리
chmod 711 mydir/     # rwx--x--x
ls mydir/            # ❌ 목록 못 봄 (r 없음)
cat mydir/file.txt   # ✅ 경로를 알면 접근 가능 (x 있음)
cd mydir/            # ✅ 진입 가능
```

- 디렉토리에서 `x`는 "통과 가능" 권한 — 없으면 안에 파일이 있어도 접근 불가
- 디렉토리에는 보통 `r`과 `x`를 함께 부여 (`5` 또는 `7`)

---
### umask — 파일 생성 시 기본 권한
##### 개념
- 새 파일/디렉토리를 만들 때 **자동으로 적용되는 권한**을 결정
- "마스크"라는 이름처럼 전체 권한에서 **빼는(차단하는) 값**

##### 동작 원리
```text title="umask 계산"
파일 기본 최대 권한    : 666 (실행 권한 없음)
디렉토리 기본 최대 권한 : 777

umask 값              : 022

새 파일 권한    = 666 - 022 = 644 (rw-r--r--)
새 디렉토리 권한 = 777 - 022 = 755 (rwxr-xr-x)
```

```bash title="umask 확인 및 변경"
# 현재 umask 확인
umask
# 022

# 기호 형태로 확인
umask -S
# u=rwx,g=rx,o=rx

# umask 변경 (현재 세션)
umask 077     # 새 파일 600, 새 디렉토리 700 → 소유자만 접근

# 영구 적용하려면 ~/.bashrc 또는 ~/.zshrc에 추가
echo "umask 022" >> ~/.zshrc
```

##### 자주 쓰는 umask 값

| umask | 새 파일 | 새 디렉토리 | 용도 |
| :---: | :---: | :---: | :--- |
| `022` | 644 | 755 | 일반적인 기본값 |
| `027` | 640 | 750 | 그룹까지만 읽기 허용 |
| `077` | 600 | 700 | 소유자만 접근 (보안 강화) |

---
### 특수 비트 — setuid, setgid, sticky
- 일반 권한(3자리) 앞에 **네 번째 자리**로 표현
- 일상적으로 자주 설정하진 않지만, 시스템 파일에서 보게 됨

##### setuid (4) — 실행 시 파일 소유자 권한으로 동작
```bash title="setuid 예시"
ls -l /usr/bin/passwd
# -rwsr-xr-x 1 root root ... /usr/bin/passwd
#    ^
#    s = setuid가 설정되어 있음
```
- `passwd` 명령은 일반 사용자가 실행해도 **root 권한으로** `/etc/shadow`를 수정할 수 있음
- 소유자의 `x` 자리에 `s`로 표시됨

```bash
chmod 4755 special_binary    # setuid 설정
chmod u+s special_binary     # 기호 방식
```

##### setgid (2) — 실행 시 파일 그룹 권한으로 동작 / 디렉토리에서는 그룹 상속
```bash title="setgid 디렉토리 — 팀 공유 폴더에 유용"
# setgid가 설정된 디렉토리에서 생성한 파일은 디렉토리의 그룹을 상속
mkdir /shared
chgrp team /shared
chmod 2775 /shared

# 누가 만들든 그룹이 team으로 설정됨
touch /shared/report.txt
ls -l /shared/report.txt
# -rw-rw-r-- 1 argus team ... report.txt
```

##### sticky bit (1) — 자기 파일만 삭제 가능
```bash title="sticky bit 예시"
ls -ld /tmp
# drwxrwxrwt 15 root root ... /tmp
#          ^
#          t = sticky bit

# /tmp는 누구나 파일을 만들 수 있지만 (777)
# 다른 사용자의 파일을 삭제할 수는 없음 (sticky)
```

```bash
chmod 1777 /shared_tmp    # sticky bit 설정
chmod +t /shared_tmp      # 기호 방식
```

##### 특수 비트 요약

| 비트 | 숫자 | 기호 표시 | 대상 | 효과 |
| :--- | :---: | :---: | :--- | :--- |
| setuid | 4 | `s` (owner x 자리) | 실행 파일 | 소유자 권한으로 실행 |
| setgid | 2 | `s` (group x 자리) | 실행 파일/디렉토리 | 그룹 권한으로 실행 / 그룹 상속 |
| sticky | 1 | `t` (other x 자리) | 디렉토리 | 자기 파일만 삭제 가능 |
