---
tags:
  - package_manager
  - npm
  - CLI
  - DevOps
created: 2026-04-29T00:00:00
updated: 2026-06-11T21:30:00
permalink: /Dev/web/package-manager-landscape-why-npm-and-how-tools-get-distributed
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> 새로운 CLI 도구를 설치할 때 `npm install -g`가 가장 흔한 이유는 기술적 우위가 아니라 네트워크 효과(Node.js가 이미 깔려 있으니까)와 배포 마찰의 최소화 때문이다. 하지만 Rust/Go 바이너리 배포가 빠르게 늘고 있고, brew·cargo-binstall·mise 같은 대안 채널도 성숙해지고 있다. 이 글은 npm부터 시스템 패키지 매니저, 메타 툴 매니저, 직접 바이너리 배포까지 전체 생태계를 조망한다.

---
### 동기: 왜 전부 npm install인가

새로운 개발 도구를 찾으면 설치 가이드의 첫 줄이 거의 항상 이렇게 생겼다.

```bash
npm install -g some-tool
```

Claude Code도, Vercel CLI도, Prettier도, ESLint도 전부 npm이다. 심지어 JavaScript와 전혀 관계없어 보이는 도구도 npm으로 설치한다. 처음엔 "왜 하필 npm이지?"라는 의문이 들었다. brew도 있고, cargo도 있고, pip도 있는데 왜 유독 npm이 CLI 도구 배포의 기본값이 되었을까?

답을 찾아보니 기술적 우위라기보다는 **네트워크 효과**와 **배포 마찰**의 문제였다. 그리고 이 질문을 파고들다 보니 자연스럽게 "도구를 만든 사람은 어떤 채널로 배포하는가", "각 패키지 매니저는 어떤 철학으로 설계되었는가"라는 더 넓은 그림이 보이기 시작했다.

이 글은 그 궁금증에서 출발해 패키지 매니저 생태계 전체를 정리한다.

---
### 1. npm이 CLI 배포의 기본값이 된 이유

##### 설치 기반이 압도적이다

npm은 Node.js를 설치하면 자동으로 딸려온다. 프론트엔드 개발자, 백엔드 개발자, 심지어 Python이나 Go를 주로 쓰는 개발자도 어떤 이유로든 Node.js가 깔려 있는 경우가 많다. npm 레지스트리에는 320만 개 이상의 패키지가 등록되어 있고, 연간 수조 건의 다운로드가 발생한다.

도구를 배포하는 입장에서 "유저가 이미 갖고 있을 확률이 가장 높은 패키지 매니저"를 고르면 npm이 1순위가 된다.

##### 배포 마찰이 거의 없다

```bash
# npm 패키지 배포의 전체 과정
npm init
# ... 코드 작성 ...
npm publish
```

이게 전부다. 바이너리 크로스컴파일이 필요 없고(JS는 어디서든 돌아가니까), Homebrew처럼 PR 리뷰를 기다릴 필요도 없고, apt처럼 .deb 패키지를 만들 필요도 없다. 계정 만들고 `npm publish` 한 줄이면 전 세계에서 설치할 수 있다.

##### npx라는 킬러 기능

```bash
# 설치 없이 바로 실행
npx create-next-app my-app
npx degit user/repo my-project
npx prettier --write .
```

`npx`는 패키지를 임시로 받아서 한 번 실행하고 버린다. 글로벌 설치로 시스템을 오염시키지 않아도 되고, 항상 최신 버전이 실행된다. 이런 "설치 없는 실행" 기능은 다른 패키지 매니저에는 없거나 약하다. Python의 `uvx`, `pipx`가 비슷하지만 npm/npx의 도달 범위에는 미치지 못한다.

##### 결국 네트워크 효과다

기술적으로 더 나은 대안이 있어도 "이미 다 깔려 있으니까"가 가장 강력한 이유다. Claude Code가 npm으로 배포되는 것도, Anthropic이 JavaScript 회사여서가 아니라 가장 많은 개발자에게 가장 적은 마찰로 도달할 수 있기 때문이다.

---
### 2. 패키지 매니저의 분류

패키지 매니저는 크게 네 가지로 나눌 수 있다.

| 분류 | 설명 | 대표 예시 |
| :--- | :--- | :--- |
| 언어별 패키지 매니저 | 특정 언어 생태계의 라이브러리/도구 배포 | npm, pip, cargo, go install |
| 시스템 패키지 매니저 | OS 수준에서 바이너리 설치 | brew, apt, scoop, winget |
| 메타/유니버설 툴 매니저 | 여러 도구의 버전을 통합 관리 | mise, aqua, proto, Nix |
| 직접 바이너리 배포 | 패키지 매니저 없이 바이너리 직접 전달 | GitHub Releases, curl \| sh, Docker |

각 분류는 서로 경쟁하기도 하고 보완하기도 한다. 예를 들어 `ripgrep`은 cargo로도, brew로도, apt로도, GitHub Releases에서 직접 바이너리로도 설치할 수 있다. 도구 제작자가 여러 채널에 동시 배포하는 것이 일반적이다.

---
### 3. 언어별 패키지 매니저 비교

##### npm / npx — 가장 넓은 도달 범위

- **언어**: JavaScript / TypeScript
- **레지스트리**: npmjs.com (320만+ 패키지)
- **CLI 도구 설치**: `npm install -g <tool>` 또는 `npx <tool>`
- **장점**: 설치 기반 최대, npx로 무설치 실행, 배포 마찰 최소
- **단점**: Node.js 런타임 필요, JS 특유의 `node_modules` 무게감

```bash
# 글로벌 설치
npm install -g vercel

# 설치 없이 실행
npx create-next-app my-app
```

> [!info]+ optionalDependencies 패턴
> esbuild, SWC 같은 도구는 JS가 아닌 네이티브 바이너리인데도 npm으로 배포한다. 플랫폼별 바이너리를 `optionalDependencies`로 분리해서 사용자 OS에 맞는 것만 설치되게 하는 기법이다. npm의 도달 범위를 활용하면서도 네이티브 성능을 제공하는 절충안이다.

##### pip / pipx / uvx — Python 생태계

- **언어**: Python
- **레지스트리**: PyPI (60만+ 패키지)
- **CLI 도구 설치**: `pipx install <tool>` 또는 `uvx <tool>`
- **장점**: Python 사용자층 넓음, uvx는 매우 빠름
- **단점**: Python 런타임 필요, 의존성 관리가 역사적으로 복잡했음

```bash
# pipx — 격리된 환경에 CLI 도구 설치 (공식 권장)
pipx install ruff

# uvx — Rust 기반으로 훨씬 빠른 대안 (pipx 대체)
uvx ruff check .
```

> [!tip]+ pip vs pipx vs uvx
> - `pip install`: 현재 환경에 직접 설치. 의존성 충돌 위험
> - `pipx install`: 도구마다 격리된 가상환경 생성. 안전하지만 느림
> - `uvx`: pipx와 같은 개념이지만 Rust 기반으로 10~100배 빠름. 2026년 현재 가장 권장되는 방식

##### cargo / cargo-binstall — Rust 생태계

- **언어**: Rust
- **레지스트리**: crates.io
- **CLI 도구 설치**: `cargo install <tool>` 또는 `cargo binstall <tool>`
- **장점**: 싱글 바이너리 출력, 뛰어난 성능
- **단점**: `cargo install`은 소스 컴파일이라 느림, Rust 툴체인 필요

```bash
# 소스에서 컴파일 (느림, Rust 툴체인 필요)
cargo install ripgrep

# 미리 컴파일된 바이너리 다운로드 (빠름, 툴체인 불필요)
cargo binstall ripgrep
```

`cargo-binstall`은 GitHub Releases에서 미리 빌드된 바이너리를 찾아 설치한다. 바이너리가 없으면 `cargo install`로 폴백한다. Rust 도구의 진입 장벽을 크게 낮춘 도구다.

##### go install — 싱글 바이너리의 강점

- **언어**: Go
- **CLI 도구 설치**: `go install github.com/user/tool@latest`
- **장점**: 싱글 스태틱 바이너리, 런타임 의존성 없음
- **단점**: Go 툴체인 필요, 실질적 배포에는 GoReleaser 필요

```bash
# Go 모듈에서 직접 설치
go install github.com/junegunn/fzf@latest
```

Go는 크로스컴파일이 기본 내장되어 있어서 linux/darwin/windows x amd64/arm64 조합을 한 번에 빌드할 수 있다. GoReleaser를 쓰면 GitHub Releases 업로드, Homebrew formula 생성, Docker 이미지 빌드까지 자동화된다.

##### 언어별 패키지 매니저 비교표

| 항목 | npm | pip/uvx | cargo | go install |
| :--- | :--- | :--- | :--- | :--- |
| 런타임 필요 | Node.js | Python | Rust 툴체인 | Go 툴체인 |
| 무설치 실행 | npx | uvx, pipx | - | - |
| 바이너리 출력 | JS (인터프리팅) | Python (인터프리팅) | 네이티브 바이너리 | 네이티브 바이너리 |
| 설치 속도 | 빠름 | uvx 빠름 / pip 보통 | binstall 빠름 / install 느림 | 보통 |
| 배포 마찰 | 매우 낮음 | 낮음 | 낮음 | 낮음 (GoReleaser 필요) |

---
### 4. 시스템 패키지 매니저 비교

시스템 패키지 매니저는 언어에 종속되지 않고 OS 수준에서 바이너리를 설치한다. 사용자에게 별도 런타임을 요구하지 않는다는 것이 가장 큰 장점이다.

##### Homebrew — macOS/Linux 개발자의 기본

```bash
brew install ripgrep
brew install --cask visual-studio-code
```

- macOS 개발자의 사실상 표준 패키지 매니저
- Linux 지원(Linuxbrew)도 성숙해져 macOS + Linux 커버 가능
- 2025년 11월 Homebrew 5.0에서 Linux ARM64 지원 추가
- 연간 2.6억 건 이상의 formula 설치 이벤트 (2025-2026 기준)

> [!note]+ Homebrew에 도구를 등록하려면
> 두 가지 경로가 있다.
> - **homebrew-core**: 공식 저장소에 PR을 보내고 리뷰를 받아야 한다. 품질 기준이 높고 시간이 걸린다.
> - **개인 tap**: `homebrew-<name>` GitHub 저장소를 만들고 formula를 작성하면 된다. 리뷰 없이 바로 배포 가능. GoReleaser가 이 과정을 자동화해준다.

##### apt / dnf — Linux 배포판 기본

```bash
# Debian/Ubuntu
sudo apt install ripgrep

# Fedora/RHEL
sudo dnf install ripgrep
```

- OS에 기본 내장되어 있어 추가 설치 불필요
- 시스템 깊숙이 통합되어 의존성 관리가 정교함
- 도구 제작자 입장에서는 .deb/.rpm 패키지 빌드, GPG 서명, 저장소 호스팅 등 배포 마찰이 매우 높음
- 업데이트 주기가 느려서 최신 버전 반영이 늦는 경우가 많음

##### Windows: Scoop / Chocolatey / winget

```bash
# winget — Windows 11 기본 내장
winget install ripgrep

# scoop — 개발자 친화적, 관리자 권한 불필요
scoop install ripgrep

# chocolatey — 가장 큰 패키지 라이브러리
choco install ripgrep
```

| 항목 | winget | scoop | chocolatey |
| :--- | :--- | :--- | :--- |
| 설치 필요 | Windows 11 기본 | 별도 설치 | 별도 설치 |
| 관리자 권한 | 필요할 수 있음 | 불필요 | 필요 |
| 패키지 수 | 8,000+ | 중간 | 10,000+ |
| 성격 | MS 공식 | 개발자 중심, 깔끔 | 기업 중심 |

##### 시스템 패키지 매니저 비교표

| 항목 | brew | apt/dnf | winget | scoop |
| :--- | :--- | :--- | :--- | :--- |
| 플랫폼 | macOS, Linux | Linux | Windows | Windows |
| 배포 마찰 | 중간 (tap은 낮음) | 높음 | 중간 | 낮음 |
| 업데이트 속도 | 빠름 | 느림 | 중간 | 빠름 |
| 런타임 요구 | 없음 | 없음 | 없음 | 없음 |

---
### 5. 메타 툴 매니저의 부상

언어별 패키지 매니저가 늘어나면서 "Node 18, Python 3.12, Go 1.22를 동시에 관리하고 싶다"는 수요가 생겼다. 메타 툴 매니저는 여러 런타임과 CLI 도구의 버전을 프로젝트 단위로 관리해주는 도구다.

##### asdf → mise: 왜 대체되고 있는가

```bash
# asdf — 원조 플러그인 기반 버전 매니저
asdf install nodejs 20.11.0
asdf local nodejs 20.11.0

# mise — asdf 호환이면서 Rust 기반으로 10~100배 빠름
mise install node@20
mise use node@20
```

- asdf는 플러그인 생태계가 크지만 셸 shim 기반이라 느리고 `.tool-versions` 파일에 의존
- mise(구 rtx)는 Rust로 작성되어 훨씬 빠르고, asdf 플러그인과 호환되며, `.env` 지원과 내장 task runner까지 제공
- GitLab Development Kit가 asdf에서 mise로 전환하는 등 실질적 대체가 진행 중

##### aqua, proto: 선언적 버전 관리

```yaml
# aqua.yaml — 프로젝트에 필요한 도구를 선언적으로 관리
registries:
  - type: standard
    ref: v4.155.1
packages:
  - name: BurntSushi/ripgrep@14.1.0
  - name: junegunn/fzf@0.46.1
```

- **aqua**: Go로 작성된 선언적 CLI 버전 매니저. 체크섬 검증과 SLSA 출처 증명 지원이 강점
- **proto**: moonrepo에서 만든 Rust 기반 멀티 언어 버전 매니저. Node.js, Python, Rust, Go 등을 하나로 관리

##### Nix / Devbox: 완전한 재현성

```bash
# Devbox — Nix를 쉽게 쓸 수 있게 감싼 도구
devbox init
devbox add ripgrep nodejs python
devbox shell  # 격리된 환경 진입
```

- **Nix**: 10만 개 이상의 패키지를 가진 완전 재현 가능한 빌드 시스템. "내 머신에서는 되는데"를 원천 차단
- **Devbox**: Nix의 학습 곡선을 `devbox.json` 하나로 단순화. 40만 개 이상의 Nix 패키지를 Nix 언어 없이 사용 가능
- Fedora 44가 Nix를 공식 저장소에 포함 승인하는 등 엔터프라이즈 도입이 가속화되고 있음

---
### 6. 도구 배포자의 선택지 — 배포 마찰 비교

도구를 만든 사람이 "어디로 배포할까"를 결정할 때 가장 중요한 것은 **첫 배포까지의 마찰**과 **유지보수 부담**이다.

| 플랫폼 | 첫 배포까지 | 유지보수 부담 | 크로스플랫폼 |
| :--- | :--- | :--- | :---: |
| npm | `npm publish` 한 줄 | 낮음 | macOS/Linux/Windows |
| PyPI | wheel 빌드 + `twine upload` | 낮음 | macOS/Linux/Windows |
| crates.io | `cargo publish` | 낮음 (10MB 제한) | macOS/Linux/Windows |
| Go 모듈 | 태그 push만 하면 자동 인덱싱 | 거의 없음 | macOS/Linux/Windows |
| Homebrew (tap) | GitHub 저장소 + formula 작성 | 낮음 | macOS/Linux |
| Homebrew (core) | PR 제출 + 리뷰 통과 | 높음 (유지보수 의무) | macOS/Linux |
| apt/dnf | .deb/.rpm 빌드 + GPG + 저장소 호스팅 | 매우 높음 | Linux only |
| GitHub Releases | CI에서 빌드 + 업로드 | 낮음 (GoReleaser 사용 시) | 전체 |
| Docker Hub | `docker build && docker push` | 낮음 | Docker가 있는 곳 어디든 |

npm의 배포 마찰이 가장 낮다는 것이 보인다. 특히 바이너리 컴파일 없이 JS만으로 배포할 수 있다는 점이 개인 개발자에게 매력적이다. 반면 apt/dnf는 패키징 복잡도가 높아서 개인이 관리하기 어렵다.

> [!tip]+ 실무에서의 멀티채널 배포
> 잘 만들어진 도구는 하나의 채널에만 의존하지 않는다. 대표적인 패턴은 이렇다.
> 1. GitHub Releases에 플랫폼별 바이너리 업로드 (GoReleaser로 자동화)
> 2. Homebrew tap에 formula 등록
> 3. npm에 wrapper 패키지 배포 (optionalDependencies로 바이너리 포함)
> 4. cargo-binstall / crates.io 등록 (Rust 도구인 경우)
> 5. 필요하면 Docker 이미지도 배포
>
> 이 전체를 CI 파이프라인 하나로 자동화하는 것이 2026년 현재의 표준 배포 방식이다.

---
### 7. 보안과 공급망 공격

패키지 매니저가 편리할수록 공격 표면도 넓어진다. 특히 npm은 규모가 큰 만큼 가장 많은 공격을 받고 있다.

##### npm — 가장 큰 표적

- **2025년 9월**: 주간 다운로드 합계 26억 건인 18개 패키지가 동시에 탈취됨. 타이포스쿼팅이 아니라 유지보수자의 자격 증명을 직접 탈취한 공격
- **Shai-Hulud 웜 (2025년 9월)**: npm 최초의 자가 전파 웜. 감염된 패키지가 자동으로 다른 패키지를 감염시켜 500개 이상으로 확산
- **TeamPCP 캠페인 (2026년 3-4월)**: axios(주간 1억 다운로드), @bitwarden/cli 타이포스쿼팅 공격. 탈취된 publish 토큰으로 웜처럼 전파
- 2025년 4분기 악성 패키지의 **99.8%가 npm에서 발생**

##### PyPI, crates.io도 안전하지 않다

- PyPI: ML 개발자를 타겟으로 한 타이포스쿼팅 패키지 1만 건 이상 발견 (2025년)
- crates.io: `faster_log`, `async_println` 등 암호화폐 키 탈취 패키지 등장 (2025년 5월)

##### 방어의 새 표준: Trusted Publishing (OIDC)

```yaml
# GitHub Actions에서 npm에 직접 인증 (저장된 시크릿 없이)
- uses: actions/setup-node@v4
  with:
    registry-url: 'https://registry.npmjs.org'
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}  # 기존 방식

# Trusted Publishing — 토큰 자체가 불필요 (OIDC)
# npm, PyPI, crates.io 모두 지원
```

- GitHub Actions가 OIDC로 레지스트리에 직접 신원을 증명하는 방식
- 저장된 시크릿 자체를 없앰으로써 자격 증명 탈취 공격을 원천 차단
- npm은 추가로 2FA 필수화, 토큰 수명 단축(기본 7일, 최대 90일), staged publishing(단계적 배포)을 도입 중

> [!warning]+ 설치 전 확인 습관
> - 패키지 이름 오타 확인 (typosquatting 방지)
> - 다운로드 수, 마지막 업데이트 날짜, 유지보수자 수 확인
> - `npm audit` / `pip audit` / `cargo audit`로 알려진 취약점 점검
> - 가능하면 공식 문서에서 안내하는 설치 방법을 사용

---
### 8. 트렌드: npm에서 바이너리로

##### JS 도구의 Rust/Go 재작성 물결

2025-2026년, JavaScript 생태계의 핵심 도구들이 Rust나 Go로 재작성되고 있다.

| 기존 도구 (JS) | 대체 도구 (Rust/Go) | 성능 차이 |
| :--- | :--- | :--- |
| ESLint + Prettier | Biome | 20배 빠름 |
| ESLint | Oxlint (v1.0, 2025년 6월) | 50~100배 빠름 |
| webpack | Rspack, Turbopack | 10배 이상 빠름 |
| Babel | SWC | 20배 빠름 |
| Rollup | Rolldown | 수배 빠름 |

이 도구들은 Rust로 작성되었지만 여전히 npm으로도 배포된다. `optionalDependencies` 패턴으로 플랫폼별 바이너리를 npm 패키지 안에 감싸는 방식이다. npm의 도달 범위를 포기하지 않으면서 네이티브 성능을 제공하는 전략이다.

개별 도구를 넘어 런타임 차원의 움직임도 있다. Zig로 작성된 [[Bun - All-in-One JavaScript Runtime|Bun]]은 런타임, 패키지 매니저, 번들러, 테스트 러너를 하나의 바이너리로 묶어 Node.js 기반 도구 체인 전체를 대체하는 접근을 취한다.

##### cargo-binstall의 의미

Rust CLI 도구를 설치할 때 가장 큰 진입 장벽은 "Rust 툴체인을 설치해야 한다"는 점이었다. cargo-binstall은 이 문제를 해결한다. GitHub Releases에서 미리 빌드된 바이너리를 찾아 설치하므로 Rust를 몰라도 Rust 도구를 쓸 수 있다.

```bash
# Rust 툴체인 없이도 Rust 도구 설치 가능
cargo binstall ripgrep bat fd-find
```

##### JSR (JavaScript Registry)의 등장

2024년 3월 출시된 JSR은 TypeScript 우선 레지스트리다. npm을 대체하는 것이 아니라 보완하는 위치다.

- TypeScript를 직접 제공 (Deno에서는 그대로, Node.js에서는 자동 트랜스파일)
- 자동 API 문서 생성
- 2026년 초 기준 4만 개 이상의 패키지
- 오픈 거버넌스 보드 설립

##### 흐름 정리

npm이 CLI 도구 배포에서 차지하는 비중은 여전히 크지만, 새로 만들어지는 도구들은 점점 네이티브 바이너리로 이동하고 있다. 배포 채널도 다양화되어 "npm 하나만으로 배포"가 아니라 "GitHub Releases + brew + npm + cargo를 동시에"가 표준이 되어가고 있다.

개발자 입장에서는 npm만 알아도 대부분의 도구를 설치할 수 있지만, brew·mise·cargo-binstall 같은 대안을 알아두면 더 가볍고 빠른 설치가 가능하다.
