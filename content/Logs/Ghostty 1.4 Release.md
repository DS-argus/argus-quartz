---
tags:
  - terminal
  - performance
created: 2026-10-28T09:57:34+09:00
updated: 2026-10-28T09:57:34+09:00
permalink: /Logs/ghostty-1-4-release
description: Ghostty 1.4의 스크롤백 압축과 출력 성능 개선, Kitty 프로토콜 및 SSH 연동 확장, 업그레이드 시 확인할 설정 변경을 살펴본다.
---

> [!abstract]+ TL;DR
> - 스크롤백 압축과 출력 처리 개선에 따른 메모리·성능 변화
> - Kitty 그래픽·클립보드 지원 확대와 SSH 연결 준비 자동화
> - 선택 복사 설정 변경과 플랫폼별 업그레이드 확인 사항

> *AI-assisted*

---

### 1. Ghostty 1.4 릴리스

Ghostty 1.4.0이 2026년 10월 27일 공개됐다. 이번 버전은 출력 처리와 메모리 사용량을 개선하고 Kitty 프로토콜 지원과 SSH 연동을 확장했다. 아래 내용은 공식 [릴리스 노트](https://ghostty.org/docs/install/release-notes/1-4-0)와 구현 PR을 바탕으로 작성했으며 성능 수치는 개발팀의 측정 결과다.

---

### 2. 스크롤백 압축과 메모리 절감

스크롤백은 화면 위로 지나간 터미널 출력을 보관하는 기록이다. 로그를 오래 남기면 나중에 검색하기 편하지만 그만큼 메모리가 필요하다. 1.4는 화면에 보이지 않는 스크롤백 페이지를 터미널이 유휴 상태일 때 [압축](https://github.com/ghostty-org/ghostty/pull/13264)하고 다시 읽을 때 필요한 부분을 복원한다.

일반적인 텍스트 기록에서 압축 대상 페이지의 물리 메모리는 약 70~90% 줄었다. 이를 바탕으로 터미널당 기본 스크롤백 한도도 10 MB에서 50 MB로 늘었다. 압축률은 출력 내용에 따라 달라지며 같은 문장이 반복되는 기록일수록 유리하다.

이 기능은 macOS와 64비트 Linux에서 지원한다. 줄어드는 것은 물리 메모리이므로 가상 메모리 수치만 비교하면 효과를 확인하기 어렵다. **70~90%라는 수치는 압축 대상 스크롤백 페이지의 절감률**이며 Ghostty 프로세스 전체의 메모리 절감률과는 구분해야 한다.

---

### 3. 출력 읽기와 파싱의 병렬 처리

터미널은 프로그램의 출력을 읽은 뒤 문자와 제어 시퀀스를 해석해 화면 상태를 갱신한다. 기존 Ghostty는 PTY에서 출력을 읽고 처리하는 작업을 순차적으로 반복했다. PTY는 터미널과 프로그램 사이에서 입출력을 전달하는 가상 터미널 장치다.

macOS에서는 PTY를 한 번 읽을 때 전달되는 데이터가 약 1 KiB로 제한됐다. 큰 버퍼를 준비해도 읽기마다 처리 비용이 발생했고 Ghostty가 내용을 해석하는 동안 출력 프로그램이 대기할 수 있었다. 1.4는 별도 스레드가 PTY를 계속 읽고 기존 스레드가 앞서 읽은 데이터를 [파싱](https://github.com/ghostty-org/ghostty/pull/13209)하도록 바꿨다.

개발팀이 M4 Max와 macOS 26에서 측정한 결과, ASCII 출력 처리량은 약 25~30%, Unicode 출력 처리량은 약 55% 늘었다. 대량 출력의 처리량을 측정한 결과이므로 키 입력 반응이나 모든 TUI의 속도가 같은 비율로 개선된다고 해석하면 안 된다.

---

### 4. Kitty 그래픽과 클립보드

Kitty graphics protocol은 터미널 안에 이미지를 표시하는 규약이다. Ghostty 1.4는 [애니메이션의 프레임 전송·합성·재생 제어](https://github.com/ghostty-org/ghostty/pull/13943)를 지원한다. 이미지를 표시하는 프로그램이 이 기능을 사용하면 터미널에서도 애니메이션을 재생할 수 있다.

상대 배치도 추가돼 한 이미지를 다른 이미지에 붙여 이동시킬 수 있다. 개발팀은 이번 버전에서 공개된 Kitty graphics 규격 전체를 구현했다고 밝혔다.

클립보드에는 [OSC 5522 기반 Kitty clipboard protocol](https://ghostty.org/docs/install/release-notes/1-4-0#kitty-clipboard-protocol)이 적용됐다. 일반 텍스트뿐 아니라 이미지와 HTML도 주고받을 수 있으며 이를 활용하려면 터미널 안의 프로그램도 프로토콜을 지원해야 한다. 기본 정책은 읽기 시 권한 확인, 쓰기 허용이며 단일 쓰기 크기는 기본 64 MiB로 제한한다.

---

### 5. SSH 연결 준비를 담당하는 CLI

원격 서버가 Ghostty의 터미널 정보를 모르면 화면 제어나 키 처리에 필요한 기능을 올바르게 판단하기 어렵다. 새 [SSH wrapper](https://github.com/ghostty-org/ghostty/pull/12582)는 원격 환경을 준비하고 실제 SSH 프로그램을 실행한다.

```bash
ghostty +ssh user@example.com
```

Ghostty의 [terminfo](https://ghostty.org/docs/install/release-notes/1-4-0#ssh-integration-with-ghostty-ssh)를 원격 호스트에 설치하고 터미널 관련 환경변수를 전달한다. terminfo 설치에 실패하면 `TERM=xterm-256color`로 대체한다. terminfo는 프로그램이 터미널의 기능과 제어 방법을 조회하는 정보다.

매번 같은 wrapper를 사용하려면 셸에 alias를 둘 수 있다.

```bash
alias ssh='ghostty +ssh --'
```

---

### 6. 기존 설정과 플랫폼 요구사항

선택한 텍스트를 어디에 복사할지는 [`copy-on-select`](https://github.com/ghostty-org/ghostty/pull/12604/files)로 정한다. 새 값은 `none`, `primary`, `clipboard`, `both`이며 선택용 클립보드와 시스템 클립보드를 구분한다.

| 원하는 동작 | 설정값 |
| --- | --- |
| 선택만으로 복사하지 않음 | `none` |
| 선택용 클립보드에 복사 | `primary` |
| 시스템 클립보드에 복사 | `clipboard` |
| 두 클립보드에 복사 | `both` |

macOS 기본값은 `none`으로 바뀌었다. 1.3의 기본 선택 복사 동작을 유지하려면 다음처럼 지정한다.

```ini
copy-on-select = primary
```

기존에 `clipboard`를 지정해 두 클립보드에 복사하던 사용자는 [`both`](https://ghostty.org/docs/install/release-notes/1-4-0#breaking-changes)로 바꿔야 한다. macOS에서 명시한 `true`는 이제 시스템 클립보드 복사를 뜻하므로 원하는 대상을 직접 적는 편이 명확하다.

플랫폼별 [요구사항](https://ghostty.org/docs/install/release-notes/1-4-0#system-requirements)도 확인할 부분이다.

- **macOS**: 최소 버전은 macOS 13으로 유지하며 macOS 27 호환성을 개선했다.
- **Linux·FreeBSD의 GTK 앱**: GTK 4.18과 libadwaita 1.7이 필요하다. Ubuntu 24.04 LTS의 기본 라이브러리는 이 조건을 충족하지 못하며 Flatpak이 대안이다.

이번 릴리스에는 붙여넣기 보호, 악성 터미널 출력, 링크 처리와 관련된 [보안 수정](https://ghostty.org/docs/install/release-notes/1-4-0#security)도 포함됐다. 업그레이드 시에는 성능 개선과 함께 기존 선택 복사 동작 및 플랫폼 요구사항을 확인할 필요가 있다.
