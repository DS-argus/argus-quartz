---
tags:
  - troubleshooting
  - docker
  - Quartz
  - NodeJS
created: 2025-06-05T10:13:36
updated: 2025-06-05T10:21:16
permalink: /Dev/debug/quartz-module-errors-in-docker
---
> [!abstract]+ TL;DR
> Quartz 원본 레포에서 [해당 pull request](https://github.com/jackyzha0/quartz/pull/1997) 참고하자...

---
### 문제
- Docker로 Quartz(Node.js) 프로젝트를 빌드·실행할 때 `Error: Cannot find module '@napi-rs/simple-git-linux-arm64-gnu'` 또는 의존성 관련 모듈을 찾을 수 없다는 에러가 발생하고 `docker run` 시 이미지 인자가 비어 있다는 에러도 동반적으로 발생
- Node 22 버전 업그레이드 되면서 cloudflare에서 배포 문제가 생겼는데 이걸 해결하려고 package.json을 만지고 해서 문제가 발생한 듯.....

---

### 원인
1. **package-lock.json 삭제**
    - Cloudflare 배포 문제로 node.js 버전을 바꾸며 `package-lock.json`을 삭제했음
    - 이후 의존성 트리가 달라짐 (하위 모듈 버전이 달라질 수 있음)
2. **node_modules 폴더의 불일치**
    - lock 파일 없이 의존성 설치(npm install)시, 환경(OS, Node/npm 버전, 패키지 최신 상태)에 따라 실제 설치되는 패키지 트리와 바이너리가 달라질 수 있음
    - 특히 M1/M2 맥북(arm64)에서 빌드하면 플랫폼별 네이티브 모듈 충돌이 자주 발생
3. **빌드/런 명령 구조의 문제**
    - 빌드가 실패하면 `docker run $(docker build -q .)`에서 run 명령어에 이미지 ID가 전달되지 않아 “이미지 인자가 없음” 에러가 발생

---

### 해결
1. **node_modules와 package-lock.json 모두 삭제**
    ```sh
    rm -rf node_modules package-lock.json
    ```
2. **의존성 재설치**
    ```sh
    npm install
    ```
    - 이 과정에서 새로운 package-lock.json이 생성됨.
3. **Docker 이미지 빌드 및 실행**
    ```sh
    docker build -t my-quartz .
    docker run --rm -it -p 8080:8080 -p 3001:3001 -v ./content:/usr/src/app/content my-quartz
    ```