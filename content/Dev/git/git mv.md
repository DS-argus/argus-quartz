---
tags:
  - git
url: 
created: 2025-05-23T23:40:09
updated: 2025-05-25T00:01:29
related: 
---
### 문제

만약 기존 git repository 에 속한 폴더 하나가 "Git/" 이었는데 이것을 "git/"으로 바꾸고 싶다고 해보자  
git은 파일의 변화만 추적하기 때문에 직접 폴더명을 수정해도 이 변화를 감지하지 못한다

### git mv

이때 사용할 수 있는 명령어가 `git mv` 이다.
```shell
git mv <old-name> <new-name>
```

공식 reference는 [다음](https://git-scm.com/docs/git-mv)과 같다  
폴더명, 파일명, symlink를 이동하거나 이름을 변경할 때 사용하면 된다

### 적용

현재 내가 갖고 있는 폴더 구조는  `content/Dev/Git` 이고 나는 이것을 `content/Dev/git` 으로 수정하고 싶어서 다음을 실행했다


```shell
git mv content/Dev/Git content/Dev/git
```

그럼 다음과 같은 오류가 발생한다

![[git mv - 2025-05-24 - 09-07-43.png|650x350]]


이는 기본적으로 macOS 파일시스템에서 case-insensitive, 즉 대소문자를 구분하지 않기 때문에 발생하는 문제로  
다음과 같이 중간에 거쳐가는 임시 폴더명을 만드는 것으로 살짝 우회할 수 있다

```shell
git mv content/Dev/Git content/Dev/temp     // 임시로 폴더명을 'tmp'로 바꿈
git mv content/Dev/temp content/Dev/git
```

그러면 아래와 같이 renamed라고 표시가 되는 것을 알 수 있다

![[git mv - 2025-05-24 - 23-57-36.png|650x350]]


이제 git add, commit을 해주면 원하는대로 수정이 가능하다


