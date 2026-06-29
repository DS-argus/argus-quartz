---
tags:
  - greenplum
  - etl
  - bash
  - database
created: 2026-06-29T10:00:00
updated: 2026-06-29T10:00:00
permalink: /Tinkered/greenplum-gpload-gpfdist-port-collision
---
> [!abstract]+ TL;DR
> - gpload를 병렬 실행하면 내부에서 함께 뜨는 gpfdist의 포트가 충돌할 수 있음
> - 두 가지 해법을 비교 — 직접 구현한 flock 기반 사전 port lease와 gpload 내장 PORT_RANGE
>   - 포트 사용 가능 여부의 최종 판정자는 OS의 bind()라서, 넓은 PORT_RANGE만으로도 충돌 회피는 충분한 경우가 많음
>   - flock lease는 실행 전 포트 확정·할당 실패 기록·동시성 제한 같은 운영 관측성이 필요할 때 의미가 있음

---

### 0. 문제의 출발점

Greenplum DB에 CSV를 적재하기 위해 `gpload`를 병렬 실행하면, 내부에서 함께 실행되는 `gpfdist`의 port가 충돌할 수 있다. 이 문제를 해결하기 위해 먼저 shell script 수준에서 `flock` 기반 port lease를 구현해 보았다.

이후 `gpload` 자체에도 `PORT_RANGE` 옵션이 있다는 것을 확인했다. 그래서 이 문서는 `flock` 기반 lease와 `gpload`/`gpfdist`의 기본 port range 처리 방식을 비교하고, [gpdb-archive 소스코드](https://github.com/greenplum-db/gpdb-archive)를 기준으로 실제 동작 원리를 정리한다.  


중점적으로 다루는 내용은 다음이다.

- `flock`으로 shell script 수준의 port lease를 구현하는 방법
- Greenplum `gpload`/`gpfdist`가 port를 선택하고 충돌을 처리하는 방식

실습용 repo 경로는 [greenplum-gpload-port-lease-lab](https://github.com/DS-argus/greenplum-gpload-port-lease-lab)이다.  

---

### 1. 실습 환경 구성


#### 1.1 Docker image 선택

현재 Dockerfile은 `woblerr/greenplum:7.1.0`을 base image로 사용한다. 이 이미지는 Greenplum runtime, `psql`, `gpload`를 바로 실습할 수 있는 형태라서 이 repo의 목적에 적합하다.

#### 1.2 Dockerfile 구성

Dockerfile에서 중요한 부분은 base image와 추가 패키지다.

```dockerfile
FROM woblerr/greenplum:7.1.0

ENV GREENPLUM_DATABASE_NAME=demo

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    coreutils \
    iproute2 \
    netcat-openbsd \
    procps \
    util-linux \
  && rm -rf /var/lib/apt/lists/*
```

추가 설치 패키지의 역할은 다음 정도만 알면 된다.

- `bash`: script 실행
- `coreutils`: `seq`, `shuf`, `mktemp` 같은 기본 유틸리티
- `util-linux`: `flock`
- `iproute2`: `ss`
- `netcat-openbsd`: `nc`
- `procps`: process 확인용 기본 도구
- `ca-certificates`: package 설치와 HTTPS 통신에 필요한 인증서

#### 1.3 Greenplum demo database 접속 방식

Greenplum은 PostgreSQL 기반 database라서 기본 접속 방식도 PostgreSQL과 거의 같다. 이 repo에서는 `psql`로 demo database에 접속한다.

```bash
psql -h localhost -p 5432 -U gpadmin -d demo
```

---

### 2. Greenplum 적재 구조

#### 2.1 Greenplum 개괄

Greenplum은 PostgreSQL을 기반으로 만든 MPP database다. SQL 문법, `psql` 접속 방식, catalog 구조 등은 PostgreSQL과 닮아 있지만, 실행 구조는 단일 PostgreSQL 서버와 다르다.

MPP는 Massively Parallel Processing의 약자로, 데이터를 여러 segment에 나눠 저장하고 query나 load 작업도 여러 segment가 병렬로 처리하는 구조를 말한다.

대략적인 구성은 다음과 같다.

- coordinator: 사용자가 접속하는 진입점으로 SQL을 받고 실행 계획을 조율한다.
- segment: 실제 데이터를 나눠 저장하고, scan/join/insert 같은 작업을 병렬로 수행한다.
- distributed table: table data가 여러 segment에 분산 저장된다.
- distribution key 또는 random distribution: row를 어떤 segment에 둘지 정하는 방식이다.

`CREATE TABLE ... DISTRIBUTED RANDOMLY`로 테이블을 만들면 row가 segment들에 랜덤하게 분산된다.

뒤에서 설명할 `gpload`를 통한 적재도 이 병렬 구조 위에서 동작한다. CSV 파일을 단순히 coordinator 한 곳이 읽어서 넣는 것이 아니라, Greenplum segment들이 External Table을 통해 `gpfdist`에 접근하고 데이터를 병렬로 읽어 target table에 적재한다.

HDFS, Spark와 비교하면 다음과 같다.

- HDFS: 대용량 파일을 여러 노드에 나눠 저장하는 distributed file system으로, SQL database라기보다는 저장 계층에 가깝다.
- Spark: HDFS, S3, database 등에 있는 데이터를 읽어서 분산 처리하는 compute engine이다. batch processing, transformation, ML 작업에 강하다.
- Greenplum: SQL table을 직접 저장하고, SQL query를 MPP 방식으로 병렬 실행하는 distributed database다.

즉 HDFS는 “파일을 어디에 나눠 저장할 것인가”, Spark는 “분산 데이터를 어떻게 계산할 것인가”, Greenplum은 “SQL table을 어떻게 분산 저장하고 빠르게 조회/적재할 것인가”에 더 가깝다.

예를 들어 CSV 파일을 정제해서 Parquet으로 바꾸고 여러 소스 데이터를 조합하는 작업은 Spark가 자연스럽다. 반면 정제된 데이터를 table로 적재한 뒤 BI, SQL 분석, 집계 query를 빠르게 돌리는 용도라면 Greenplum 같은 MPP database가 자연스럽다.

#### 2.2 External Table 개괄

Greenplum의 External Table은 DB 내부 table처럼 SQL로 조회할 수 있지만, 실제 데이터는 DB 내부 heap/table storage가 아니라 외부 위치에 있는 table이다. 이 실습에서는 외부 위치가 `gpfdist://...` URL이다.

개념적으로는 다음과 같다.

```sql
CREATE EXTERNAL TABLE ext_sample (
  id    text,
  name  text,
  score text
)
LOCATION ('gpfdist://localhost:18000/workspace/gpload-workspace/data/sample_1.csv')
FORMAT 'CSV' (HEADER DELIMITER ',');
```

이 쿼리에서 중요한 부분은 `LOCATION`이다.

```sql
LOCATION ('gpfdist://localhost:18000/workspace/gpload-workspace/data/sample_1.csv')
```

이 URL은 “Greenplum segment들이 `localhost:18000`에서 떠 있는 `gpfdist`에 접속해서 해당 CSV 파일을 읽어라”라는 의미다. 즉 `gpfdist://...`는 단순 로그 문자열이 아니라 External Table 정의 안에 들어가는 실제 데이터 위치다.

External Table을 만들고 나면 일반 table처럼 `SELECT`할 수 있다.

```sql
SELECT *
FROM ext_sample;
```

그리고 실제 적재는 보통 External Table을 source로 삼아 target table에 넣는 방식으로 이뤄진다.

```sql
INSERT INTO temp_sample (
  id,
  name,
  score
)
SELECT
  id,
  name,
  score
FROM ext_sample;
```

정리하면, `gpfdist`는 파일을 serving하고, External Table은 그 파일을 SQL table처럼 읽을 수 있게 해주며, 최종 적재는 External Table에서 target table로 `INSERT`하는 방식이다. 뒤에서 나오는 `gpload`는 이 과정을 직접 손으로 작성하지 않도록 YAML을 읽고 External Table 생성, LOCATION 구성, INSERT 실행을 대신 조율해주는 도구라고 보면 된다.

#### 2.3 gpload, gpfdist의 역할

`gpload`와 `gpfdist`는 이름이 비슷하지만 역할이 다르다.

- `gpload`: YAML을 읽고 적재 과정을 조율하는 orchestrator
- `gpfdist`: CSV 파일을 Greenplum segment들이 읽을 수 있도록 열어 주는 파일 서버

중요한 점은 `gpfdist`가 DB에 직접 `INSERT`를 하는 도구가 아니라는 것이다. `gpfdist`는 파일을 제공하고, Greenplum이 External Table을 통해 그 파일을 읽는다.

#### 2.4 gpload는 적재 orchestrator다

`gpload`는 대략 다음 일을 한다.

1. YAML control file을 읽는다.
2. DB 접속 정보를 해석한다.
3. 입력 파일과 컬럼 정의를 해석한다.
4. 로컬에서 `gpfdist`를 실행한다.
5. `gpfdist://host:port/file` 형태의 LOCATION을 만든다.
6. External Table을 만든다.
7. External Table에서 target table로 데이터를 넣는다.
8. 작업이 끝나면 `gpfdist`와 임시 객체를 정리한다.

이 흐름은 `gpdb-archive/gpMgmt/bin/gpload.py`의 `start_gpfdists()`에서 잘 보인다. 이 함수는 `popenList = ['gpfdist']`를 만들고, port/file/timeout 옵션을 추가한 뒤 subprocess로 `gpfdist`를 실행한다.

소스에서 보면 `gpload`가 직접 파일을 읽는 것이 아니라, `gpfdist` command를 조립해서 subprocess로 실행한다.

```python
def start_gpfdists(self):
    self.locations = []                                    # External Table LOCATION에 들어갈 gpfdist URI 목록 초기화
    self.ports = []                                        # 실제 gpfdist가 bind한 port 목록 초기화
    ...
    popenList = ['gpfdist']                                # 실행할 command의 시작은 gpfdist binary
    self.gpfdist_ssl(popenList)                            # 다양한 옵션 추가: SSL 설정, PORT/PORT_RANGE, timeout 등
    self.gpfdist_port_options(name, availablePorts, popenList)
    file = self.gpfdist_filenames(name, popenList)
    self.gpfdist_timeout_options(popenList)
    ...
    a = subprocess.Popen(cmd, stdout=subprocess.PIPE,      # gpfdist를 subprocess로 실행하고 stdout을 pipe로 받음
                         stderr=subprocess.PIPE,
                         close_fds=cfds, shell=needshell)
    self.subprocesses.append(a)
```

#### 2.5 gpfdist는 파일 전송 서버다

`gpfdist`는 지정된 port에서 listen socket을 열고, Greenplum segment들이 파일을 읽을 수 있게 한다.

소스 기준으로 `gpfdist`는 port bind에 성공하면 stdout에 다음 형태의 메시지를 출력한다.

```text
Serving HTTP on port <port>, directory <directory>
```

`gpfdist` 쪽 소스에서는 먼저 HTTP server setup을 수행하고, 성공하면 실제 port를 stdout으로 출력한다.

```c
http_setup();  // socket bind/listen을 포함한 HTTP server 초기화

#ifdef USE_SSL  // SSL 지원 빌드인지 확인
    if (opt.ssl)  // SSL 옵션이 켜져 있으면 HTTPS로 serving한다고 출력
        printf("Serving HTTPS on port %d, directory %s\n", opt.p, opt.d);  // 실제 bind된 port와 directory 출력
    else  // SSL이 아니면 일반 HTTP serving으로 출력
        printf("Serving HTTP on port %d, directory %s\n", opt.p, opt.d);  // gpload가 이 stdout을 읽어 port를 파싱
#else  // SSL 미지원 빌드인 경우
    printf("Serving HTTP on port %d, directory %s\n", opt.p, opt.d);  // SSL 빌드가 아니면 항상 HTTP로 출력
#endif  // SSL 조건부 출력 분기 종료

fflush(stdout);  // gpload가 즉시 읽을 수 있도록 stdout buffer를 비움
```

그리고 `gpload`는 이 stdout을 읽어서 실제로 bind된 port를 알아낸다.

`gpload`는 이 문자열을 기다렸다가 port 숫자를 파싱한다.

```python
line = line.strip('\n')  # gpfdist stdout 한 줄에서 trailing newline 제거
self.log(self.LOG,'gpfdist says: ' + line)  # gpfdist가 출력한 내용을 gpload debug log에 남김
if (line.startswith('Serving HTTP on port ') or line.startswith('Serving HTTPS on port ')):  # serving 시작 메시지인지 확인
    port = int(line[21:line.index(',')])  # "Serving HTTP on port " 뒤부터 comma 전까지를 port 숫자로 파싱
    break  # 실제 bind port를 찾았으므로 stdout 대기 loop 종료
```

#### 2.6 실제 데이터 적재는 External Table을 통해 수행된다

`gpload`가 port를 알게 되면 다음과 같은 URI를 만든다.

```text
gpfdist://localhost:18000/path/to/file.csv
```

이 URI가 External Table의 `LOCATION`으로 들어간다. 그러면 Greenplum은 External Table을 scan하면서 `gpfdist`에 접속해 데이터를 읽는다.

소스에서는 실제 port를 파싱한 뒤 `self.locations`에 LOCATION URI를 추가한다.

`gpload`는 여기서 파싱한 `port`를 External Table LOCATION에 넣는다.

```python
if ssl:  # SSL SOURCE이면
    protocol = 'gpfdists'  # External Table LOCATION scheme을 gpfdists로 사용
else:  # SSL이 아니면
    protocol = 'gpfdist'  # 일반 gpfdist scheme 사용

for l in local_hostname:  # YAML LOCAL_HOSTNAME에 지정된 host들을 순회
    ...  # IPv6 host bracket 처리, file path separator 계산 등 생략
    self.locations.append('%s://%s:%d%s%s%s' %  # External Table LOCATION URI를 목록에 추가
                          (protocol, l, port, sep, '%20'.join(file), fragment))  # 실제 bind port를 URI에 반영
```

즉 전체 흐름은 다음과 같다.

```text
CSV file
  -> gpfdist가 HTTP로 제공
  -> Greenplum External Table이 gpfdist:// URI로 읽음
  -> target table에 INSERT
```

---

### 3. gpload YAML 이해

#### 3.1 기본 YAML 구조

이 repo의 `scripts/gpload/load_single_csv.sh`는 CSV 하나를 적재하기 위해 YAML을 생성한다.

핵심 구조는 다음과 같다.

```yaml
VERSION: 1.0.0.1
DATABASE: demo
USER: gpadmin
HOST: localhost
PORT: 5432
GPLOAD:
  INPUT:
    - SOURCE:
        LOCAL_HOSTNAME:
          - localhost
        PORT_RANGE: [18000, 18000]
        FILE:
          - /workspace/gpload-workspace/data/sample_1.csv
    - FORMAT: csv
    - DELIMITER: ","
    - HEADER: true
  EXTERNAL:
    - SCHEMA: public
  OUTPUT:
    - TABLE: temp_sample_1
    - MODE: INSERT
```

#### 3.2 SOURCE, FILE, FORMAT, HEADER 설정

`SOURCE`는 `gpfdist`가 열 파일과 port를 정의한다.

- `LOCAL_HOSTNAME`: Greenplum segment가 접속할 host 이름
- `PORT_RANGE`: `gpfdist`가 bind를 시도할 port 범위
- `FILE`: 제공할 CSV 파일

`FORMAT`, `DELIMITER`, `HEADER`는 External Table의 파일 파싱 방식을 정한다.

#### 3.3 OUTPUT TABLE과 MODE

`OUTPUT.TABLE`은 최종 적재 대상 테이블이고, `OUTPUT.MODE`는 적재 방식을 정한다. `gpload`가 지원하는 값은 다음 세 가지다.

- `INSERT`: External Table에서 읽은 row를 target table에 그대로 insert한다.
- `UPDATE`: External Table 데이터를 staging table에 먼저 넣고, `MATCH_COLUMNS`로 target row를 찾아 `UPDATE_COLUMNS`만 update한다.
- `MERGE`: staging table을 사용해 매칭되는 row는 update하고, 매칭되지 않는 row는 insert한다.

#### 3.4 PORT와 PORT_RANGE

YAML에는 `PORT` 또는 `PORT_RANGE`를 줄 수 있다. 이름만 보면 `PORT`는 단일 port, `PORT_RANGE`는 범위처럼 보인다. 그런데 GPDB 소스를 보면 `PORT` 처리에 주의할 점이 있다.

`gpload.py`의 `gpfdist_port_options()`는 YAML 값을 읽은 뒤 `gpfdist -p <start> -P <end>` 인자로 변환한다.

소스 핵심은 다음이다.

```python
def gpfdist_port_options(self, name, availablePorts, popenList):
    port = self.getconfig(name + ':port', int, None)  # SOURCE.PORT 값을 int로 읽음
    port_range = self.getconfig(name+':port_range', list, None)  # SOURCE.PORT_RANGE 값을 list로 읽음

    if port:  # PORT가 지정된 경우 PORT가 우선
        startPort = endPort = port
        endPort += 1  # gpload 소스상 PORT는 PORT+1까지 넘기게 됨
    elif port_range:
        startPort = int(port_range[0])  # range 첫 번째 값을 시작 port로 사용
        endPort = int(port_range[1])  # range 두 번째 값을 마지막 port로 사용
    else:  # 둘 다 없으면
        startPort = self.getconfig(name+':port',int,8000)  # 기본 시작 port는 8000
        endPort = self.getconfig(name+':port',int,9000)  # 기본 마지막 port는 9000

    ...  # port 값 검증, availablePorts와의 교집합 확인 등 생략

    popenList.append('-p')  # gpfdist 시작 port 옵션 추가
    popenList.append(str(startPort))  # 시작 port 값을 문자열로 추가

    popenList.append('-P')  # gpfdist 마지막 port 옵션 추가
    popenList.append(str(endPort))  # 마지막 port 값을 문자열로 추가
```

즉 `PORT: 18000`을 쓰면 내부적으로 `startPort=18000`, `endPort=18001`이 된다. 실제 로그에서도 `PORT: 18000` 사용 시 `gpfdist -p 18000 -P 18001` 형태가 나온다.

반대로 `PORT_RANGE: [18000, 18000]`은 시작과 끝이 모두 18000이다. 그래서 정말 한 port만 시도하게 만들고 싶다면 이 repo에서는 `PORT_RANGE: [p, p]`를 사용했다.

#### 3.5 `PORT: p`와 `PORT_RANGE: [p, p]`의 차이

정리하면 다음과 같다.

| YAML                         | gpload가 만드는 gpfdist 인자 | 의미                                     |
| ---------------------------- | ---------------------------- | ---------------------------------------- |
| `PORT: 18000`                | `-p 18000 -P 18001`          | 소스 기준으로 18000, 18001까지 시도 가능 |
| `PORT_RANGE: [18000, 18000]` | `-p 18000 -P 18000`          | 18000 하나만 시도                        |
| `PORT_RANGE: [18000, 18100]` | `-p 18000 -P 18100`          | 18000부터 18100까지 bind 재시도          |

이 차이 때문에 충돌 재현 실험에서는 `PORT_RANGE: [18000, 18000]`을 사용했다.

---

### 4. gpload와 gpfdist의 포트 선택 흐름

#### 4.1 YAML 포트 설정이 gpfdist CLI 인자로 변환되는 과정

포트 선택 흐름은 다음 순서다.

```text
YAML PORT / PORT_RANGE
  -> gpload.py gpfdist_port_options()
  -> gpfdist -p <start> -P <end>
  -> gpfdist.c에서 opt.p / opt.last_port 설정
  -> socket() / bind() / listen()
  -> 성공한 실제 port를 stdout으로 출력
  -> gpload가 stdout을 읽어 External Table LOCATION 생성
```

`gpload`가 직접 port를 bind하지 않는다. 최종적으로 port를 쓸 수 있는지는 `gpfdist`의 `bind()`가 판단한다.

#### 4.2 `gpfdist -p <start> -P <end>`의 의미

`gpfdist.c`에서 `-p`와 `-P`는 다음처럼 처리된다.

핵심은 이렇다.

```c
case 'p':  // -p 옵션 처리
    opt.last_port = opt.p = atoi(arg);  // 시작 port(opt.p)와 마지막 port(opt.last_port)를 일단 같은 값으로 설정
    break;  // -p 처리 종료
case 'P':  // -P 옵션 처리
    opt.last_port = atoi(arg);  // 마지막 port만 별도로 갱신
    break;  // -P 처리 종료
```

`-p`는 시작 port이고, `-P`는 마지막 port다. `-P`가 없으면 `-p` 하나만 쓰는 셈이다. `gpload`는 항상 `-p`와 `-P`를 같이 만들어 넘긴다.

#### 4.3 gpfdist의 bind/listen 재시도 방식

`gpfdist`는 `opt.p`부터 `opt.last_port`까지 순서대로 bind를 시도한다.

핵심 코드는 다음 구조다.

```c
/* Try each possible port from opt.p to opt.last_port */  // opt.p부터 opt.last_port까지 순서대로 시도
for (;;) {  // 성공하거나 마지막 port까지 실패할 때까지 반복
    snprintf(service,32,"%d",opt.p);  // 현재 시도할 port 번호를 문자열로 변환
    ...  // getaddrinfo, socket 생성, socket option 설정 등 생략
    if (bind(f, rp->ai_addr, rp->ai_addrlen) != 0) {  // 현재 port bind 시도
        if (errno == EADDRINUSE) {  // 이미 사용 중인 port라면
            closesocket(f);  // 실패한 socket을 닫음
            create_failed = true;  // 현재 port 생성 실패 표시
            break;  // address family 순회를 멈추고 다음 port로 넘어갈 준비
        }
        ...  // EADDRINUSE 외 다른 bind 실패 처리 생략
    }

    if (listen(f, opt.z)) {  // bind는 됐지만 listen 전환이 실패한 경우
        ...  // listen 실패 처리 생략
    }

    if (gcb.listen_sock_count > 0)  // listen socket이 하나라도 열렸다면
        break;  // port 선택 성공, outer loop 종료

    if (opt.p >= opt.last_port)  // 마지막 port까지 모두 실패했다면
        gfatal(NULL, "cannot create socket on port %d "
                      "(last port is %d)", opt.p, opt.last_port);  // 더 이상 시도할 port가 없으므로 fatal error

    opt.p++;  // 다음 port로 이동
}
```

그래서 `PORT_RANGE: [18000, 18010]`이면 18000이 이미 사용 중이어도 18001, 18002, ... 순서로 다음 port를 시도할 수 있다.

#### 4.4 gpload가 실제 bind된 port를 LOCATION에 반영하는 방식

`gpload`는 `gpfdist` stdout에서 실제 port를 읽는다.

이 부분을 한 번에 보면 다음처럼 이어진다.

```python
if (line.startswith('Serving HTTP on port ') or line.startswith('Serving HTTPS on port ')):  # gpfdist serving 시작 메시지 확인
    port = int(line[21:line.index(',')])  # stdout에서 실제 bind port 추출
    break  # port를 찾았으므로 대기 loop 종료

self.log(self.INFO, 'started %s' % ' '.join(popenList))  # gpfdist 시작 성공 로그 출력
self.log(self.LOG,'gpfdist is running on port %d'%port)  # 실제 실행 port를 debug log에 기록
if port in availablePorts:  # 현재 gpload 프로세스의 availablePorts에 해당 port가 있으면
    availablePorts.remove(port)  # 같은 gpload 실행 안에서 다시 쓰지 않도록 제거
self.ports.append(port)  # 종료 정리 등을 위해 사용 port 목록에 추가

...  # protocol 결정, LOCAL_HOSTNAME 순회 등 생략

self.locations.append('%s://%s:%d%s%s%s' %  # External Table LOCATION URI 추가
                      (protocol, l, port, sep, '%20'.join(file), fragment))  # 실제 bind port를 URI에 반영
```

이 구조 때문에 `PORT_RANGE`를 넓게 줘도 문제가 없다. `gpfdist`가 실제로 18007에 bind했다면, `gpload`가 그 값을 읽고 External Table LOCATION도 18007로 만든다.

#### 4.5 availablePorts가 해결하는 것과 해결하지 못하는 것

`gpload.py`에는 `availablePorts`가 있다.

소스상 `availablePorts`는 `start_gpfdists()` 내부 local 변수다.

```python
availablePorts = set(range(1,65535))  # 현재 gpload 프로세스 내부에서 관리하는 후보 port set
...  # SOURCE별 gpfdist option 생성 과정 생략
elif not (set(range(startPort,endPort+1)) & availablePorts):  # 요청 범위와 내부 후보 set이 하나도 겹치지 않으면
    self.log(self.ERROR, "no more ports available for gpfdist")  # 이 gpload 실행 안에서는 더 이상 줄 port가 없다고 판단
...  # gpfdist 실행과 stdout port 파싱 과정 생략
if port in availablePorts:  # 실제 bind된 port가 내부 후보 set에 남아 있으면
    availablePorts.remove(port)  # 이후 같은 gpload 실행 안에서 중복 사용하지 않도록 제거
```

하지만 이것은 OS 전체의 port 상태를 실시간으로 관리하는 global registry가 아니다. 같은 `gpload` 프로세스 안에서 여러 `SOURCE`를 처리할 때 이미 사용한 port를 기억하기 위한 내부 bookkeeping에 가깝다.

따라서 서로 다른 `gpload` 프로세스 두 개가 동시에 실행되면, 둘 다 자신만의 `availablePorts`를 갖는다. 한쪽의 `availablePorts`는 다른 프로세스가 이미 사용한 port를 알지 못한다.

그 경우 최종 판정은 결국 `gpfdist`의 `bind()`다.

---

### 5. 포트 충돌 문제

#### 5.1 병렬 gpload 실행 시 충돌이 발생하는 이유

두 개 이상의 `gpload`가 동시에 실행되고, 모두 같은 단일 port를 사용하려고 하면 각 `gpload`는 각자 `gpfdist`를 띄운다.

예를 들어 둘 다 다음 YAML을 사용한다고 하자.

```yaml
PORT_RANGE: [18000, 18000]
```

그러면 둘 다 내부적으로 다음을 실행하려고 한다.

```bash
gpfdist -p 18000 -P 18000 ...
```

한 프로세스가 먼저 `bind(18000)`에 성공하면, 다른 프로세스는 같은 port를 동시에 bind할 수 없다. 그래서 실패한다.

#### 5.2 단일 port 고정 시 실패하는 경우

실제로 collision test에서 이런 로그가 나온다.

```text
failed to start gpfdist: gpfdist command line: gpfdist -p 18000 -P 18000 ...
```

이것은 `gpload`가 실패한 것이지만, 더 정확히 말하면 `gpload`가 실행한 `gpfdist`가 port bind에 실패한 것이다.

#### 5.3 작업 시간이 짧으면 일부 job이 성공할 수 있는 이유

단일 port에 30개 작업을 동시에 던져도 1개만 성공한다고 단정할 수는 없다. 작업이 매우 빨리 끝나면 첫 번째 `gpfdist`가 18000을 사용하고 종료한 뒤, 뒤늦게 실행된 다른 `gpfdist`가 같은 18000을 다시 bind할 수 있다.

이것은 중복 점유가 아니라 재사용이다.

중요한 차이는 다음이다.

- 실패해야 하는 것: 같은 시간에 같은 port를 두 프로세스가 active하게 점유
- 허용 가능한 것: 앞 작업이 끝난 뒤 같은 port를 다음 작업이 재사용

그래서 검증할 때도 “같은 port가 로그에 두 번 등장했는가”만 보면 안 된다. 두 사용 구간이 겹쳤는지를 봐야 한다.

#### 5.4 포트 충돌의 최종 판정은 bind/listen이다

port 사용 가능 여부의 최종 판정자는 `flock`도 아니고 lease file도 아니고 `bind()`다.

`flock` 기반 allocator는 이 repo의 script들이 서로 양보하게 만드는 사전 조율 장치다. 하지만 외부 프로세스가 port를 직접 bind할 수도 있다. 따라서 allocator가 port를 골랐더라도 최종적으로는 `gpfdist`의 `bind()`/`listen()` 결과를 신뢰해야 한다.

allocator가 lease file과 실제 listener를 함께 확인하는 구현은 해결 방법 1에서 다룬다.

---

### 6. 해결 방법 1: flock 기반 port lease

#### 6.1 lock 없는 allocator가 실패하는 이유

lock이 없으면 여러 process가 동시에 같은 lease file을 읽을 수 있다.

예를 들어 다음 상황이 가능하다.

```text
process A: lease file 확인 -> 8000 비어 있음
process B: lease file 확인 -> 8000 비어 있음
process A: 8000 기록
process B: 8000 기록
```

두 process 모두 “내가 8000을 받았다”고 믿게 된다. 이게 race condition이다.

`scripts/allocator/reproduce_unsafe_duplicate.sh`는 이 상황을 일부러 재현하기 위한 스크립트다. timing에 따라 race가 안 터질 수도 있어서 여러 번 attempt를 돌린다.

#### 6.2 global lock의 역할

`lib/port_allocator.sh`의 핵심은 `with_global_lock()`이다.

핵심은 lock file 자체에 데이터를 저장하는 것이 아니다. `PORT_GLOBAL_LOCK`은 여러 process가 같은 coordination point를 바라보게 만드는 파일이다.

각 process는 자기 FD 하나를 이 lock file에 연결한다.

```bash
with_global_lock() {
  mkdir -p "$(dirname "$PORT_GLOBAL_LOCK")"
  touch "$PORT_GLOBAL_LOCK"

  exec {lock_fd}>"${PORT_GLOBAL_LOCK}"
  if ! flock -x "$lock_fd"; then
    exec {lock_fd}>&-
    return 1
  fi

  local rc
  if "$@"; then
    rc=0
  else
    rc="$?"
  fi

  flock -u "$lock_fd"
  exec {lock_fd}>&-

  return "$rc"
}
```

이후 `flock`은 그 FD가 가리키는 파일에 advisory exclusive lock을 건다. 다른 process가 같은 파일에 대해 exclusive lock을 잡으려고 하면 앞 process가 unlock할 때까지 기다린다.

#### 6.3 lease file의 역할

`PORT_LEASE_FILE`은 현재 사용 중이라고 약속한 port 목록이다.

기본 row 형식은 다음이다.

```text
port pid
```

lease row를 추가하는 코드는 단순하다. 중요한 것은 이 함수가 global lock 안에서만 호출된다는 점이다.

```bash
append_lease() {
  ...
  mkdir -p "$(dirname "$PORT_LEASE_FILE")" || return 1
  touch "$PORT_LEASE_FILE" || return 1

  printf '%s %s\n' "$1" "$2" >> "$PORT_LEASE_FILE"
}
```

여기서 pid를 함께 저장하는 이유는 process가 비정상 종료되었을 때 stale lease를 치우기 위해서다.

stale cleanup은 lease file의 PID가 아직 살아 있는지 확인해서 죽은 process의 row를 제거한다.

```bash
while read -r leased_port leased_pid; do
  [[ -n "${leased_port:-}" && -n "${leased_pid:-}" ]] || continue

  if kill -0 "$leased_pid" 2>/dev/null; then
    printf '%s %s\n' "$leased_port" "$leased_pid" >> "$tmp_file"
  else
    continue
  fi
done < "$PORT_LEASE_FILE"
```

`kill -0 <pid>`는 실제로 process를 죽이지 않는다. 그 PID가 살아 있는지, 현재 process가 접근 권한이 있는지만 확인하는 용도다.

#### 6.4 후보 port 선택과 실제 listener 확인

`_lease_port_locked()`는 global lock 안에서 candidate port를 순회한다. 이때 lease file만 보는 것이 아니라 실제 listen 상태도 같이 확인한다.

```bash
for port in $(candidate_ports); do
  if is_port_leased "$port"; then       # lease file에서 확인
    continue
  fi

  if is_port_listening "$port"; then    # 실제 점유 프로세스 확인
    continue
  fi

  append_lease "$port" "${PORT_LEASE_OWNER_PID:-$$}" || return 1
  printf '%s\n' "$port"
  return 0
done
```

`is_port_leased`는 같은 allocator를 사용하는 협력 프로세스끼리 중복 lease가 생기지 않도록 확인한다. 하지만 이 allocator를 사용하지 않는 외부 프로세스는 lease file을 무시하고 port를 직접 bind할 수 있다.

그래서 실제 listener 확인도 수행한다. Linux에서는 `ss`로 LISTEN 중인 TCP socket을 조회한다.

```bash
is_port_listening() {
  ...
  if command -v ss >/dev/null 2>&1; then
    ss -H -ltn "sport = :$port" | grep -q .
    return "$?"
  fi
  return 1
}
```

이 확인은 외부 프로세스가 이미 port를 쓰는 경우를 줄여준다. 다만 `ss` 확인과 실제 `gpfdist`의 `bind()` 사이에는 짧은 race window가 남아 있으므로, 최종 판정은 여전히 `bind()`/`listen()`이다.

#### 6.5 짧은 flock과 오래 유지되는 lease row

이 구현에서 `flock`은 gpload 실행 전체를 감싸지 않는다. lock은 lease file을 읽고 쓰는 짧은 순간에만 잡는다.

실제 흐름은 다음이다.

```text
global lock 획득
  -> stale lease 정리
  -> 후보 port 확인
  -> lease file에 "port pid" 기록
global lock 해제

실제 작업 실행

global lock 획득
  -> lease row 제거
global lock 해제
```

코드로 보면 public 함수는 짧고, lock boundary를 감싸는 역할을 한다.

```bash
lease_port() {
  with_global_lock _lease_port_locked
}

release_port() {
  ...
  local port="$1"
  local pid="${2:-${PORT_LEASE_OWNER_PID:-$$}}"

  with_global_lock remove_lease "$port" "$pid"
}
```

이 설계의 장점은 lock 대기 시간이 짧다는 것이다. 긴 ETL 작업이 30분 걸려도 global lock을 30분 잡고 있지 않는다. 대신 lease row가 “이 port는 사용 예약되어 있다”는 상태를 오래 유지한다.

#### 6.6 release_port와 trap cleanup

`scripts/lease/run_with_port_lease.sh`는 실제 command를 실행하기 전에 port를 lease하고, 종료 시 cleanup으로 release한다.

wrapper의 핵심 코드는 다음이다.

```bash
pid="$$"

if ! port="$(PORT_LEASE_OWNER_PID="$pid" lease_port)"; then
  printf 'no port available\n' >&2
  exit 1
fi

cleanup() {
  PORT_LEASE_OWNER_PID="$pid" release_port "$port"
}
trap cleanup EXIT

if PORT="$port" "$@"; then
  rc=0
else
  rc="$?"
fi

exit "$rc"
```

`trap cleanup EXIT`는 shell script가 종료될 때 cleanup 함수를 실행하라는 뜻이다. Go의 `defer`와 비슷하게 이해할 수 있다. 다만 완전히 같지는 않다. `kill -9`처럼 process가 강제로 죽으면 trap은 실행되지 못한다.

그래서 이 repo는 두 겹으로 방어한다.

- 정상 종료: `trap cleanup EXIT`로 `release_port`
- 비정상 종료: 다음 `lease_port` 시 `cleanup_stale_leases`

#### 6.7 active overlap 검증

`scripts/allocator/validate_active_no_overlap.sh`는 여러 worker를 동시에 실행해도 같은 port의 active 구간이 겹치지 않는지 확인한다.

검증 아이디어는 단순하다.

1. worker가 port를 받으면 `lease <port> <worker>` event를 기록한다.
2. 예시 작업으로 `nc -l -p "$port"`를 실행한다.
3. 작업이 끝나면 `release <port> <worker>` event를 기록한다.
4. event stream을 읽으면서 같은 port가 release 전에 다시 lease되면 실패로 본다.

검증 스크립트의 worker는 lease와 release 사이에 실제 listener를 잠깐 띄운다.

```bash
if ! port="$(PORT_LEASE_OWNER_PID="$owner_pid" lease_port)"; then
  printf '[worker %s] no port available\n' "$worker_id" >&2
  printf 'fail worker-%s no-port\n' "$worker_id" >> "$events_file"
  return 1
fi

printf 'lease %s worker-%s\n' "$port" "$worker_id" >> "$events_file"

nc -l -p "$port" > /dev/null 2>&1 &
job_pid="$!"

sleep 0.3

kill "$job_pid" 2>/dev/null || true
wait "$job_pid" 2>/dev/null || true

printf 'release %s worker-%s\n' "$port" "$worker_id" >> "$events_file"
PORT_LEASE_OWNER_PID="$owner_pid" release_port "$port"
```

여기서 중요한 점은 “port가 한 번만 나와야 한다”가 검증 기준이 아니라는 것이다. 실제 운영에서는 port 재사용이 정상이다. 핵심은 active 구간이 겹치지 않는 것이다.

#### 6.8 port 재사용 검증

`scripts/allocator/validate_reuse_no_overlap.sh`는 일부러 port 범위를 하나로 고정한다.

이 스크립트의 목적은 “같은 port가 여러 번 등장해도 된다”를 확인하는 것이다. 단, 이전 worker가 release한 뒤 다음 worker가 lease해야 한다.

그래서 다음은 성공이다.

```text
lease 8000 worker-1
release 8000 worker-1
lease 8000 worker-2
release 8000 worker-2
```

반대로 다음은 실패다.

```text
lease 8000 worker-1
lease 8000 worker-2
release 8000 worker-1
release 8000 worker-2
```

#### 6.9 gpload 실행 전 port lease로 충돌을 막는 방식

`scripts/lease/run_with_port_lease.sh`는 command 실행 전에 port를 하나 확보하고, 그 값을 환경 변수 `PORT`로 넘긴다.

```bash
PORT="$port" "$@"
```

이 repo의 `load_single_csv.sh`는 YAML 생성 시 이 `PORT`를 사용한다.

그래서 `run_with_port_lease.sh`로 감싸면 흐름은 다음과 같다.

```text
lease_port로 port 확보
  -> PORT=<leased_port> gpload 실행
  -> YAML에 PORT_RANGE: [PORT, PORT] 기록
  -> gpfdist는 그 port 하나만 bind 시도
  -> 작업 종료 시 release_port
```

port 범위를 하나로 고정하고 두 작업을 동시에 실행하면 한 작업은 port를 받고, 다른 작업은 `no port available`로 gpload 실행 전 실패한다. 이것은 의도한 동작이다. 충돌을 gpfdist bind 실패까지 끌고 가지 않고, ETL wrapper 단계에서 선제적으로 거절한 것이다.

---

### 7. 해결 방법 2: gpload PORT_RANGE 사용

#### 7.1 넓은 PORT_RANGE를 주고 gpfdist bind에 맡기는 방식

`gpload`는 이미 `PORT_RANGE`를 지원한다. 예를 들어 다음처럼 줄 수 있다.

```yaml
PORT_RANGE: [18000, 18100]
```

그러면 `gpfdist`는 18000부터 18100까지 bind를 시도한다. 이미 사용 중인 port가 있으면 다음 port로 넘어간다.

이 방식은 단순하고 합리적이다. port 충돌의 최종 판정자인 `bind()`에 맡기기 때문이다.

#### 7.2 PORT_RANGE가 단순하고 확실한 이유

`PORT_RANGE` 방식의 장점은 다음이다.

- 별도 lease file이 필요 없다.
- `flock`을 이해하지 않아도 된다.
- 외부 프로세스가 port를 사용 중이어도 `bind()`가 알아서 실패를 감지한다.
- 실제로 bind된 port는 `gpload`가 stdout에서 읽어 LOCATION에 반영한다.

즉 “아무 port나 괜찮고, 성공만 하면 된다”는 요구라면 `PORT_RANGE`가 더 단순하다.

#### 7.3 PORT_RANGE만으로 부족할 수 있는 운영 상황

다만 `PORT_RANGE`만으로는 다음 요구를 만족하기 어렵다.

- job별로 어떤 port를 받았는지 실행 전에 알고 싶다.
- ETL tool 수준에서 port 할당 실패를 명시적으로 기록하고 싶다.
- 동시에 실행할 job 수를 port pool 크기로 제한하고 싶다.
- port lease/release event를 별도 audit log로 남기고 싶다.
- 여러 종류의 local service port를 하나의 정책으로 관리하고 싶다.

이런 경우에는 `flock` 기반 lease가 의미를 가진다.

---

### 8. 두 방식 비교

#### 8.1 correctness 관점

포트 중복 방지의 최종 보장은 `bind()`가 가장 확실하다. OS는 같은 address/port 조합을 동시에 두 listener가 점유하지 못하게 한다.

따라서 단순히 “port가 겹쳐서 동시에 listen되는 일을 막고 싶다”면 `PORT_RANGE`와 `gpfdist`의 bind retry만으로도 충분하다.

반면 `flock` 기반 lease는 같은 allocator를 사용하는 협력 프로세스끼리의 사전 조율이다. 이 allocator를 사용하지 않는 외부 프로세스는 lease file을 무시하고 port를 bind할 수 있다. 그래서 `lib/port_allocator.sh`는 lease file 확인과 실제 listener 확인을 둘 다 수행한다. 그래도 `ss` 확인과 실제 `bind()` 사이의 짧은 race window는 남는다.

#### 8.2 운영 가시성 관점

`PORT_RANGE`는 간단하지만, job이 어느 port를 사용할지는 `gpfdist`가 뜬 뒤에야 알 수 있다. gpload log를 봐야 실제 port를 확인할 수 있다.

`flock` 기반 lease는 gpload 실행 전에 port를 결정하기 때문에 다음 정보를 더 명확히 남길 수 있다.

- 어떤 job이 어떤 port를 받았는지
- port를 못 받아서 실행하지 못한 job이 무엇인지
- release가 정상적으로 되었는지
- 같은 port 재사용이 언제 일어났는지

#### 8.3 retry와 fallback 처리 위치

port를 못 받은 job은 실패로 끝낼 수도 있고, ETL tool에서 retry할 수도 있다.

이 repo의 core allocator는 retry를 내장하지 않는다. 고려할 수 있는 retry 정책은 다음과 같다.

- 몇 번 재시도할지
- 얼마 간격으로 기다릴지
- 전체 batch timeout을 얼마로 둘지
- 실패를 warning으로 볼지 error로 볼지

이런 정책은 allocator보다 ETL orchestration layer에서 처리하는 것이 자연스럽다.

#### 8.4 단일 host와 여러 ETL host의 차이

현재 구현은 local file lock 기반이다. 즉 같은 host 안에서 같은 filesystem의 lock file을 보는 process들끼리 조율된다.

ETL host가 여러 대라면 host A의 `/tmp/etl-port-leases.lock`과 host B의 `/tmp/etl-port-leases.lock`은 서로 다른 파일로 취급된다. 이 경우 local `flock`만으로는 전체 cluster 수준의 조율이 되지 않는다.

여러 ETL host를 조율하려면 다음 중 하나가 필요하다.

- shared filesystem 위의 신뢰 가능한 lock
- DB table 기반 lease
- Redis 같은 central lock service
- scheduler가 job 동시성을 제한
- 아예 `PORT_RANGE`를 host별로 분리

#### 8.5 어떤 경우에 flock이 의미 있는가

`flock` 기반 lease는 다음 상황에서 의미가 크다.

- 모든 ETL job이 같은 wrapper를 통해 실행된다.
- port pool을 명시적으로 관리하고 싶다.
- port 부족을 gpload 실패가 아니라 사전 할당 실패로 다루고 싶다.
- job별 port 배정을 로그로 남기고 싶다.
- `gpload` 외에도 비슷한 local service port 사용 작업이 있다.

#### 8.6 어떤 경우에 PORT_RANGE만으로 충분한가

`PORT_RANGE`만으로 충분한 경우는 다음이다.

- `gpload`만 사용한다.
- 어떤 port가 선택되는지는 중요하지 않다.
- gpload log만으로 운영 추적이 충분하다.
- port pool이 넉넉하다.
- 실패 시 ETL scheduler가 retry해도 된다.

이 경우에는 별도 allocator를 붙이는 것이 오히려 복잡도를 늘릴 수 있다.

---

### 9. 최종 정리

#### 9.1 실제 ETL tool에 적용할 때의 판단 기준

첫 번째 질문은 “정말 사전 port lease가 필요한가?”이다.
단순히 gpload 작업이 port 충돌 없이 성공하면 되는 상황이라면 `PORT_RANGE`를 넓게 주는 것이 가장 단순하다. Greenplum/gpfdist가 이미 지원하는 방식이고, 최종 판정도 OS `bind()`가 한다.

두 번째 질문은 “port 할당을 ETL tool의 명시적 자원 관리로 보고 싶은가?”이다.
이 경우에는 `flock` 기반 lease가 도움이 된다. 예를 들어 port pool이 10개인데 worker 30개가 동시에 들어오면, 10개만 실행하고 20개는 `no port available`로 빠르게 실패시킬 수 있다. 이후 ETL scheduler가 retry 정책을 적용하면 된다.

세 번째 질문은 “ETL host가 하나인가 여러 개인가?”이다.
현재 구현은 단일 host 기준이다. 여러 host에서 같은 port 정책을 공유해야 한다면 local `flock`이 아니라 중앙화된 lease 저장소를 고려해야 한다.

#### 9.2 남은 개선 여지

운영 도구로 키우려면 다음을 검토할 수 있다.

- retry/backoff wrapper 추가
- lease/release event log를 별도 파일로 남기기
- job id, table name, csv path 같은 metadata를 lease row에 포함
- stale lease cleanup 결과를 log로 남기기
- port pool별 namespace 지원
- gpload log에서 실제 `started gpfdist -p ... -P ...` 라인을 수집해 allocator log와 비교
- 여러 ETL host를 위한 DB/Redis 기반 lease 구현

최종적으로는 두 방식을 경쟁 관계로 볼 필요가 없다.

- `PORT_RANGE`: gpload/gpfdist가 기본 제공하는 단순하고 확실한 충돌 회피
- `flock lease`: ETL wrapper가 port를 명시적으로 관리하고 관측하기 위한 사전 조율

운영 요구가 단순하면 `PORT_RANGE`로 충분하고, ETL tool에서 port를 하나의 제한된 자원으로 다루고 싶다면 `flock` 기반 lease가 의미 있다.
