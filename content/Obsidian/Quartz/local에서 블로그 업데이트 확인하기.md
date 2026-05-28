---
tags:
  - obsidian
  - Quartz
  - docker
created: 2025-06-02T09:41:22
updated: 2025-06-02T09:57:19
permalink: /Obsidian/Quartz/check-blog-updates-locally
---
### docker를 이용해 블로그 변경 사항 확인하기

Quartz 블로그의 내용을 수정한 후 실제 사이트에 반영하려면  
1. GitHub에 코드를 push
2. Cloudfare나 GitHub Actions 같은 CI 도구를 통해 서버에 배포    

하는 과정을 거쳐야 한다.

하지만 단순한 내용 수정이나 스타일 변경 등 간단한 테스트에도 매번 배포 과정을 반복하는 것은 비효율적이다.  
그래서 **로컬 환경에서 미리 결과를 확인할 수 있는 방법**이 필요하다.

---
### local에서 직접 빌드 및 미리보기

아래 명령어를 사용하면 로컬에서 `/content` 폴더의 변경 내용을 즉시 빌드하고,  
웹서버를 통해 결과를 바로 확인할 수 있다.

```sh
npx quartz build --serve
```

이 명령은 정적 파일을 빌드한 뒤, 자동으로 로컬 서버(보통 `localhost:8080`)를 띄워준다.  
브라우저에서 `localhost:8080`에 접속해 변경된 내용을 실시간으로 확인할 수 있다.

단, 이 방법은 **로컬에 Node.js 및 npx**가 설치되어 있어야 한다.

---
### docker를 활용한 빌드

[Quartz 공식 문서](https://quartz.jzhao.xyz/features/Docker-Support)에 따르면, **Docker를 이용해 블로그를 빌드하고 바로 웹서버로 띄우는 방법**을 제공한다.  

```bash
docker run --rm -itp 8080:8080 -p 3001:3001 -v ./content:/usr/src/app/content $(docker build -q .)
```

위 명령어는 **로컬에서 컨테이너를 실행하여, 내부에서 Quartz 빌드를 수행한 뒤 바로 웹호스팅까지 할 수 있도록** 구성되어 있다.  
실행 후에는 브라우저에서 `localhost:8080`으로 접속하면 컨테이너 내부에서 빌드된 블로그 사이트를 확인할 수 있다.

각 옵션의 의미는 다음과 같다.

- `--rm` : 컨테이너 실행이 종료되면(예: `ctrl+c`로 중단) 컨테이너 자체를 자동으로 삭제한다.
- `-it` : 컨테이너 내부에 인터랙티브한 터미널을 띄워서, 실시간으로 명령을 입력하거나 로그를 볼 수 있게 한다.
- `-p 8080:8080` : 로컬 머신의 8080 포트와 컨테이너의 8080 포트를 연결하여, 외부에서 웹사이트에 접속할 수 있게 한다.
- `-p 3001:3001` : 개발용 핫리로드(Hot Reload)[^1] 등 추가 개발 포트도 동일하게 연결한다. (보통 8080만 접속하면 됨)
- `-v ./content:/usr/src/app/content` : 로컬의 `./content` 폴더를 컨테이너 내부의 `/usr/src/app/content`에 마운트하여, 블로그 글이나 정적 파일을 실시간으로 반영할 수 있다.
- `$(docker build -q .)` : 현재 디렉터리의 `Dockerfile`(아래 참고)을 빌드해서 생성된 이미지 ID를 사용하여 컨테이너를 실행한다.  
  (`-q` 옵션으로 이미지 ID만 출력받아 바로 사용)

이처럼 Docker를 활용하면 **로컬 환경에 Node.js 등 별도의 개발 도구를 설치하지 않아도** 바로 Quartz 블로그를 빌드하고 웹서버로 띄울 수 있다.     
또한, 로컬의 파일을 컨테이너에 마운트하면 content/ 폴더의 수정 사항도 즉시 반영되어, 글을 올리기 전 미리 결과를 확인하기에 매우 편리하다.

물론 이 방법을 쓰려면 **Docker Desktop**과 같은 도커 실행 환경이 필요하다. 하지만 한 번만 설치해두면,  
- Node.js, npm 등 각종 버전 문제에 신경 쓸 필요 없이
- 어떤 운영체제에서도 똑같이 Quartz 환경을 재현할 수 있고
- 향후 배포/운영 환경(클라우드, 서버 등)으로 확장할 때도 거의 동일한 방식으로 그대로 사용할 수 있다는 큰 장점이 있다.


> [!info] Quartz Dockerfile
> Quartz 공식 레포지토리의 Dockerfile은 다음과 같다:
> 
>  ```dockerfile title="Dockerfile"
> FROM node:22-slim AS builder
> WORKDIR /usr/src/app
> COPY package.json .
> COPY package-lock.json* .
> RUN npm ci
> 
 > FROM node:22-slim
 > WORKDIR /usr/src/app
> COPY --from=builder /usr/src/app/ /usr/src/app/
> COPY . .
> CMD ["npx", "quartz", "build", "--serve"]
> ```
> 이 Dockerfile은 **멀티 스테이지 빌드** 방식을 사용한다.  
> 먼저 `node:22-slim` 이미지를 기반으로 필요한 패키지를 설치(`npm ci`)하여 `node_modules` 폴더를 생성한다.  
> 그 후, 새로운 `node:22-slim` 이미지를 다시 사용해  
> - 앞 단계에서 생성한 `/usr/src/app/`의 내용(즉, `node_modules` 포함)을 복사하고,  
> - 로컬에 있는 전체 프로젝트 파일을 추가로 복사한 뒤  
> - 마지막으로 `npx quartz build --serve` 명령어로 Quartz 사이트를 빌드하고 로컬 웹서버를 실행한다.
> 
 > 이 구조를 사용하면  
> - 불필요한 빌드 캐시/임시 파일 없이
> - 더 작은 이미지로
> - 클린하게 Quartz 블로그를 컨테이너에서 빌드 및 미리보기할 수 있다.


[^1]: 개발 중에 “자동 새로고침”이나 “실시간 변경 반영”을 해주는 내부 통신 채널. 개발자가 글이나 코드를 수정할 때, 메인 포트(8080)는 보통 웹사이트 접속용, 핫리로드 포트(3001 등)는 변경 알림/자동 갱신용으로만 사용됨
