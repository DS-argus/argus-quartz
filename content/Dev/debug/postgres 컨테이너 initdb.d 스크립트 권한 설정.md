---
tags:
  - troubleshooting
  - docker
created: 2025-06-27T14:48:31
updated: 2025-06-27T15:00:50
permalink: /Dev/debug/postgres-container-initdb-script-permissions
---
### 상황
- database 및 table 생성 스크립트 (.sh, .sql)을 컨테이너 시작할 때 바로 실행시키기 위해 `/docker-entrypoint.initdb.d/`에 복사
- 권한을 부여하기 위해 다음과 같이 실행했으나  permission denied 오류 발생  
	```dockerfile
	FROM postgres:14-alpine
	
	COPY init-scripts/ /docker-entrypoint-initdb.d/
	
	RUN chmod +x /docker-entrypoint-initdb.d/*
	```

---
### 원인
- `chmod +x`는 실행 비트(x)만 더해 600 → 700으로 변환  
	- 읽기(r) 권한은 여전히 소유자만 가짐  
	- [[Linux Permission Numbers|참고]]
- 빌드 단계 파일 소유자는 root  
- 컨테이너 런타임에 `/usr/local/bin/docker-entrypoint.sh`가 `gosu postgres`로 권한을 postgres 사용자에 내려 실행  
	- postgres는 root 소유 700 파일을 **읽을(read) 권한이 없어** 스크립트 실행 불가  
- 결국 소유자·읽기 권한 불일치로 permission denied 발생  

---
### 해결
- 빌드 단계에서 소유자와 퍼미션을 postgres에게 맞춤  
	```dockerfile
	FROM postgres:14-alpine
	
	# ① 스크립트를 postgres:postgres 소유로 복사 → COPY --chown 은 Docker 17.09+ 지원
	COPY --chown=postgres:postgres init-scripts/ /docker-entrypoint-initdb.d/
	
	# ② 전체 디렉터리 + 파일에 실행·읽기 권한 부여
	RUN chmod -R 755 /docker-entrypoint-initdb.d
	```
- 또는 호스트에서 미리 `chmod +rx init-scripts/*` 수행  
- 커스텀 entrypoint에서 `chown/chmod` 후 `exec gosu postgres "$@"` 호출도 가능  
- 핵심은 postgres 계정이 스크립트를 **읽고 실행**할 수 있게 755 또는 소유자 변경 적용  