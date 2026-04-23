---
tags:
  - python
  - logging
created: 2025-06-26T13:25:07
updated: 2026-04-05T00:00:00
permalink: /Dev/python/python-logging
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> 1. 왜 print가 아니라 logging인가
> 2. 로그 레벨과 실무 기준
> 3. logging 모듈의 구성 요소
> 4. 실전 코드 스니펫
> 5. 흔한 실수와 베스트 프랙티스
> 6. 운영 환경에서의 로깅

> [!info]+ Reference
> - Python Logging HOWTO [Python Docs](https://docs.python.org/3/howto/logging.html)
> - RotatingFileHandler [Python Library](https://docs.python.org/3/library/logging.handlers.html#rotatingfilehandler)
> - colorlog [GitHub](https://github.com/borntyping/python-colorlog)

---
### 왜 print가 아니라 logging인가
###### print의 한계
- `print()`는 가장 쉬운 디버깅 도구이지만 실무에서는 금방 한계에 부딪힘

| 항목 | `print()` | `logging` |
| :--- | :--- | :--- |
| 출력 대상 | stdout만 | 콘솔, 파일, 네트워크, DB 등 자유롭게 |
| 심각도 구분 | ❌ 전부 동일 | ✅ DEBUG ~ CRITICAL 5단계 |
| 운영 중 끄기 | 코드를 직접 지워야 함 | 레벨만 올리면 됨 (코드 수정 불필요) |
| 시간/위치 정보 | 직접 넣어야 함 | 자동 포함 (시간, 파일명, 줄 번호) |
| 파일 저장 | 리다이렉션 필요 | FileHandler로 바로 가능 |
| 멀티모듈 | 어디서 찍었는지 추적 어려움 | 로거 이름으로 모듈별 구분 |

```python title="print vs logging 비교"
# print — 운영 중 끄려면 코드를 수정해야 함
print(f"[{datetime.now()}] user_id=42 login success")  # 직접 포맷팅

# logging — 레벨만 바꾸면 출력 제어 가능
logger.info("user_id=%d login success", 42)  # 포맷팅 + 시간 + 위치 자동
```

> [!tip] 언제 print를 써도 되는가
> - 일회성 스크립트, Jupyter 노트북에서의 빠른 확인
> - 그 외 **파일로 관리하는 모든 코드**에서는 logging 사용 권장

---
### 로그 레벨 (Log Level)
###### 5단계 심각도

| 레벨 | 숫자 | 의미 | 실무 기준 |
| :--- | :---: | :--- | :--- |
| **DEBUG** | 10 | 개발 중 상세 추적 정보 | 변수 값, 분기 진입, SQL 쿼리 등 — 운영에서는 꺼둠 |
| **INFO** | 20 | 정상적인 동작 확인 | 서비스 시작/종료, 작업 완료, 요청 처리 등 |
| **WARNING** | 30 | 당장 문제는 아니지만 주의 필요 | 디스크 80% 도달, deprecated API 호출, 재시도 발생 |
| **ERROR** | 40 | 기능이 실패했지만 서비스는 계속 | API 호출 실패, 파일 열기 실패, 타임아웃 |
| **CRITICAL** | 50 | 서비스 자체가 중단될 수 있는 심각한 오류 | DB 연결 불가, 메모리 부족, 설정 파일 누락 |

- 로거와 핸들러 각각 레벨을 설정할 수 있고, **둘 다 통과한 메시지만 출력**됨
- 레벨은 숫자 비교 : 설정 레벨 이상인 메시지만 통과

```python title="레벨별 사용 예시"
import logging
logger = logging.getLogger(__name__)

# DEBUG — 개발 중에만 확인할 상세 정보
logger.debug("query=%s params=%s", sql, params)

# INFO — 정상 동작의 이정표
logger.info("서비스 시작 port=%d", 8080)
logger.info("배치 작업 완료 rows=%d elapsed=%.2fs", count, elapsed)

# WARNING — 아직 괜찮지만 곧 문제가 될 수 있는 상황
logger.warning("디스크 사용량 %d%% — 90%% 초과 시 알림 발생", usage)
logger.warning("API 응답 지연 %.1fs — 타임아웃 기준 5s", response_time)

# ERROR — 특정 기능이 실패
logger.error("파일 열기 실패: %s", filepath, exc_info=True)
logger.error("외부 API 호출 실패 status=%d", response.status_code)

# CRITICAL — 서비스 자체가 위험
logger.critical("DB 연결 불가 — 서비스를 종료합니다")
```

> [!info] `exc_info=True`
> - 에러 로그에 **스택 트레이스(Traceback)** 를 자동으로 포함시킴
> - `logger.exception("메시지")`는 `logger.error("메시지", exc_info=True)`의 축약형

###### 환경별 레벨 설정 가이드

| 환경 | 권장 레벨 | 이유 |
| :--- | :--- | :--- |
| 로컬 개발 | DEBUG | 최대한 많은 정보로 디버깅 |
| 개발 서버 (dev/staging) | DEBUG 또는 INFO | 테스트 중 상세 추적 필요 |
| 운영 서버 (production) | INFO 또는 WARNING | 불필요한 로그로 디스크/성능 낭비 방지 |

---
### logging 모듈의 구성 요소
###### 전체 흐름

| 구성 요소 | 역할 | 비유 |
| :--- | :--- | :--- |
| **Logger** | 메시지를 생성하고 전달 | "기자" — 기사를 작성 |
| **Handler** | 메시지를 어디로 보낼지 결정 | "배달부" — 신문사/방송국/웹에 전달 |
| **Formatter** | 메시지의 출력 형식을 결정 | "편집자" — 기사의 레이아웃 결정 |
| **Filter** | 조건에 따라 메시지를 걸러냄 | "편집장" — 게재 여부 판단 |

```text title="로그 메시지 흐름"
logger.info("메시지")
    │
    ▼
[Logger] 레벨 확인 (INFO >= 설정 레벨?)
    │ Yes
    ▼
[Filter] 필터 통과?
    │ Yes
    ▼
[Handler] 레벨 확인 + 출력 대상 결정
    │
    ▼
[Formatter] 형식 적용 → 최종 출력
```

###### Logger — 메시지를 생성하는 객체
```python title="Logger 기본 사용"
import logging

# 로거 생성 — 보통 모듈 이름(__name__)을 사용
logger = logging.getLogger(__name__)
# __name__ = "my_app.utils.db" 같은 형태
# → 로그에 어느 모듈에서 발생했는지 자동 기록

# 로거는 계층적 — 점(.)으로 구분된 네임스페이스
# "my_app" ← "my_app.utils" ← "my_app.utils.db"
# 자식 로거의 메시지는 부모로 전파 (propagate=True가 기본)
```

###### Handler — 로그를 어디로 보내는가

| Handler | 출력 대상 | 용도 |
| :--- | :--- | :--- |
| `StreamHandler` | 콘솔 (stdout/stderr) | 개발 중 실시간 확인 |
| `FileHandler` | 파일 | 기본적인 파일 로깅 |
| `RotatingFileHandler` | 파일 (크기 기준 회전) | 로그 파일이 무한히 커지는 것 방지 |
| `TimedRotatingFileHandler` | 파일 (시간 기준 회전) | 날짜별 로그 파일 관리 |
| `QueueHandler` | 큐 | 멀티프로세스 안전한 로깅 |
| `SysLogHandler` | 시스템 로그 | Linux syslog 연동 |
| `SMTPHandler` | 이메일 | CRITICAL 에러 시 알림 메일 |

```python title="하나의 로거에 여러 Handler 부착"
import logging

logger = logging.getLogger("my_app")
logger.setLevel(logging.DEBUG)       # 로거 자체는 DEBUG부터 수용

# 콘솔 — INFO 이상만 출력
console = logging.StreamHandler()
console.setLevel(logging.INFO)

# 파일 — DEBUG 이상 전부 기록 (상세 로그)
file = logging.FileHandler("debug.log", encoding="utf-8")
file.setLevel(logging.DEBUG)

# 같은 메시지가 콘솔에는 INFO부터, 파일에는 DEBUG부터 기록됨
logger.addHandler(console)
logger.addHandler(file)
```

###### Formatter — 출력 형식 정의
```python title="Formatter 주요 필드"
# 자주 쓰는 포맷 필드
fmt = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
# 출력 예시:
# 2026-04-05 14:30:22 [INFO] my_app.api:45 - 요청 처리 완료
```

| 필드 | 설명 | 예시 |
| :--- | :--- | :--- |
| `%(asctime)s` | 시간 | `2026-04-05 14:30:22` |
| `%(levelname)s` | 레벨 이름 | `INFO`, `ERROR` |
| `%(name)s` | 로거 이름 | `my_app.utils` |
| `%(module)s` | 모듈명 | `utils` |
| `%(funcName)s` | 함수명 | `process_request` |
| `%(lineno)d` | 줄 번호 | `45` |
| `%(message)s` | 로그 메시지 | `요청 처리 완료` |
| `%(process)d` | 프로세스 ID | `12345` |
| `%(thread)d` | 스레드 ID | `140234` |

###### Filter — 조건부 필터링
```python title="Filter 예시"
class OnlyErrorFilter(logging.Filter):
    """ERROR 레벨만 통과시키는 필터"""
    def filter(self, record):
        return record.levelno == logging.ERROR

# 에러 전용 파일 핸들러
error_handler = logging.FileHandler("error.log")
error_handler.addFilter(OnlyErrorFilter())
logger.addHandler(error_handler)
```

###### Propagation — 부모 로거로의 전파
```python title="전파 동작과 중복 출력 방지"
# 로거 계층:  root ← my_app ← my_app.api

# root 로거에 콘솔 핸들러가 있고
logging.basicConfig(level=logging.INFO)

# my_app.api 로거에도 콘솔 핸들러를 부착하면
api_logger = logging.getLogger("my_app.api")
api_logger.addHandler(logging.StreamHandler())

# → 메시지가 2번 출력됨! (자기 핸들러 + root로 전파)

# 해결 방법 1: 전파 끄기
api_logger.propagate = False

# 해결 방법 2: 자식 로거에는 핸들러를 붙이지 않고 root만 설정
```

---
### 실전 코드 스니펫

##### 1. 가장 간단한 설정 — `basicConfig`
```python title="소규모 스크립트에 적합"
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)
logger.info("작업 시작")
logger.warning("디스크 사용량 85%%")
# 2026-04-05 14:30:22 [INFO] 작업 시작
# 2026-04-05 14:30:22 [WARNING] 디스크 사용량 85%
```

> [!warning] basicConfig 주의사항
> - **한 번만 호출** 가능 — 두 번째 호출부터는 무시됨
> - 이미 핸들러가 설정된 상태에서 호출하면 효과 없음
> - 라이브러리 코드에서는 호출하지 말 것 (앱 진입점에서만)

##### 2. 크기 기준 회전 로그 — `RotatingFileHandler`
```python title="파일이 무한히 커지는 것 방지"
import logging
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler(
    filename="app.log",
    maxBytes=5 * 1024 * 1024,   # 5MB 초과 시 롤오버
    backupCount=3,               # app.log.1 ~ app.log.3 보존
    encoding="utf-8"
)

logging.basicConfig(
    level=logging.INFO,
    handlers=[handler, logging.StreamHandler()],
    format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)

logger = logging.getLogger(__name__)
logger.info("서비스 시작")
```

```text title="파일 회전 동작"
app.log        ← 현재 로그 (5MB 초과 시)
app.log.1      ← 직전 로그
app.log.2      ← 그 전 로그
app.log.3      ← 가장 오래된 로그 (이후 삭제)
```

##### 3. 시간 기준 회전 로그 — `TimedRotatingFileHandler`
```python title="날짜별 로그 파일 관리"
import logging
from logging.handlers import TimedRotatingFileHandler

handler = TimedRotatingFileHandler(
    filename="access.log",
    when="midnight",    # 매일 자정에 회전
    interval=1,         # 1일 주기
    backupCount=14,     # 2주치 보관
    encoding="utf-8"
)
handler.suffix = "%Y-%m-%d"   # access.log.2026-04-05 형태

logging.basicConfig(
    level=logging.INFO,
    handlers=[handler],
    format="%(asctime)s %(levelname)s %(message)s"
)
```

| `when` 값 | 회전 주기 |
| :--- | :--- |
| `S` | 매초 |
| `M` | 매분 |
| `H` | 매시간 |
| `D` | 매일 |
| `midnight` | 매일 자정 |
| `W0` ~ `W6` | 매주 월~일 |

##### 4. JSON 구조화 로그
```python title="로그 분석 시스템(ELK 등)과 연동할 때 필수"
import logging, json, datetime, sys

class JsonFormatter(logging.Formatter):
    """로그 레코드를 JSON 문자열로 직렬화"""
    def format(self, record):
        return json.dumps({
            "ts": datetime.datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "lvl": record.levelname,
            "msg": record.getMessage(),
            "logger": record.name,
            "lineno": record.lineno
        }, ensure_ascii=False)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())

logger = logging.getLogger("json")
logger.setLevel(logging.INFO)
logger.addHandler(handler)

logger.info("user_login user_id=42")
# {"ts": "2026-04-05T05:30:22Z", "lvl": "INFO", "msg": "user_login user_id=42", ...}
```

> [!tip] 왜 JSON 로그를 쓰는가
> - 운영 환경에서는 로그를 사람이 직접 읽기보다 **ELK(Elasticsearch + Logstash + Kibana), Datadog, CloudWatch** 같은 도구로 수집·검색
> - 이런 도구들은 JSON 형태의 구조화된 로그를 파싱하기 훨씬 쉬움
> - 평문 로그: `grep`으로 찾아야 함 / JSON 로그: 필드 기반 쿼리 가능

##### 5. `dictConfig` — 대규모 프로젝트 설정
```python title="설정을 코드와 분리할 때 사용"
import logging.config

LOG_CFG = {
    "version": 1,
    "disable_existing_loggers": False,   # 기존 로거 유지
    "formatters": {
        "std": {
            "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d — %(message)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "std",
            "level": "INFO"
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "service.log",
            "maxBytes": 10 * 1024 * 1024,   # 10MB
            "backupCount": 5,
            "formatter": "std",
            "encoding": "utf-8"
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["console", "file"]
    },
    "loggers": {
        "sqlalchemy.engine": {
            "level": "WARNING"    # 너무 상세한 SQL 로그 억제
        }
    }
}

logging.config.dictConfig(LOG_CFG)
```

> [!info] basicConfig vs dictConfig
> - `basicConfig` : 소규모 스크립트, 빠른 설정
> - `dictConfig` : 프로젝트 규모가 커지면 이쪽으로 전환
> - 실무에서는 YAML/JSON 파일에 설정을 분리하고 `dictConfig`로 로드하는 패턴이 일반적

##### 6. `LoggerAdapter` — 요청별 컨텍스트 자동 주입
```python title="API 서버에서 요청 ID를 모든 로그에 자동 포함"
import logging, uuid

logger = logging.getLogger("api")
logger.setLevel(logging.INFO)

class RequestAdapter(logging.LoggerAdapter):
    """요청 ID를 자동 주입하는 어댑터"""
    def process(self, msg, kwargs):
        return f"[req={self.extra['req_id']}] {msg}", kwargs

# 요청이 들어올 때마다 어댑터 생성
req_id = uuid.uuid4().hex[:8]
req_logger = RequestAdapter(logger, {"req_id": req_id})

req_logger.info("요청 시작")
req_logger.info("DB 조회 완료 rows=15")
req_logger.error("응답 생성 실패", exc_info=True)
# [req=a3f2c1b8] 요청 시작
# [req=a3f2c1b8] DB 조회 완료 rows=15
# [req=a3f2c1b8] 응답 생성 실패 (+ Traceback)
```

##### 7. 멀티프로세스 안전 로깅 — `QueueHandler`
```python title="여러 프로세스가 동시에 로그를 쓸 때"
from multiprocessing import Process, Queue
import logging, logging.handlers, os

def worker(q, n):
    """자식 프로세스 — 큐 핸들러만 부착"""
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(logging.handlers.QueueHandler(q))
    root.info("child-%d pid=%d 작업 시작", n, os.getpid())

if __name__ == "__main__":
    q = Queue(-1)

    # 메인 프로세스에서 큐 리스너가 실제 파일 쓰기 담당
    listener = logging.handlers.QueueListener(
        q,
        logging.FileHandler("mp.log", encoding="utf-8"),
        logging.StreamHandler()
    )
    listener.start()

    ps = [Process(target=worker, args=(q, i)) for i in range(4)]
    for p in ps: p.start()
    for p in ps: p.join()

    listener.stop()
```

> [!warning] 멀티프로세스에서 FileHandler를 직접 쓰면 안 되는 이유
> - 여러 프로세스가 같은 파일에 동시에 쓰면 로그가 **뒤섞이거나 손상**될 수 있음
> - `QueueHandler` + `QueueListener` 패턴으로 **한 프로세스만 파일에 쓰게** 해야 안전

##### 8. 컬러 콘솔 — `colorlog`
```python title="터미널에서 레벨별 색상 구분"
import logging, colorlog   # uv add colorlog

formatter = colorlog.ColoredFormatter(
    "%(log_color)s%(levelname)-8s%(reset)s %(blue)s%(message)s",
    log_colors={
        "DEBUG": "cyan",
        "INFO": "green",
        "WARNING": "yellow",
        "ERROR": "red",
        "CRITICAL": "bold_red"
    }
)

handler = colorlog.StreamHandler()
handler.setFormatter(formatter)

logger = colorlog.getLogger("color")
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

logger.debug("상세 추적 정보")
logger.info("서비스 시작")
logger.warning("디스크 거의 가득 참")
logger.error("파일 열기 실패")
logger.critical("시스템 다운")
```

---
### 흔한 실수와 베스트 프랙티스

##### 실수 1: 문자열 포맷팅을 직접 하는 것
```python title="❌ 나쁜 예"
# f-string으로 직접 포맷팅 — 로그 레벨과 무관하게 항상 문자열 생성 비용 발생
logger.debug(f"query result: {expensive_query()}")

# ✅ 좋은 예 — 로거의 지연 포맷팅 사용
# DEBUG 레벨이 꺼져있으면 포맷팅 자체를 하지 않음 (성능 이점)
logger.debug("query result: %s", expensive_query())
```

##### 실수 2: 라이브러리에서 basicConfig 호출
```python title="라이브러리 코드에서의 올바른 패턴"
# ❌ 라이브러리가 전역 로깅 설정을 건드림
logging.basicConfig(level=logging.DEBUG)

# ✅ 라이브러리는 로거만 생성하고, 설정은 앱에게 맡김
logger = logging.getLogger(__name__)
# 핸들러도 붙이지 않음 — 앱이 알아서 설정
```

##### 실수 3: 모든 곳에서 root 로거 사용
```python title="로거 이름을 지정해야 하는 이유"
# ❌ root 로거 — 어디서 발생했는지 구분 불가
logging.info("요청 처리 완료")
# 2026-04-05 [INFO] root: 요청 처리 완료

# ✅ 모듈별 로거 — 출처가 명확
logger = logging.getLogger(__name__)
logger.info("요청 처리 완료")
# 2026-04-05 [INFO] my_app.api.views: 요청 처리 완료
```

##### 베스트 프랙티스 요약

| 규칙 | 설명 |
| :--- | :--- |
| 로거 이름은 `__name__` 사용 | 모듈별 구분 + 계층적 관리 |
| 포맷팅은 `%s` 방식 | 지연 평가로 성능 이점 |
| `exc_info=True` 활용 | 에러 로그에 Traceback 자동 포함 |
| 라이브러리는 핸들러 붙이지 않음 | 설정은 앱 진입점에서만 |
| 운영에서는 INFO 이상 | DEBUG 로그는 디스크/성능 부담 |
| 구조화 로그(JSON) 고려 | 로그 수집 시스템과 연동 용이 |

---
### 운영 환경에서의 로깅

##### 로그 수집 아키텍처
```text title="일반적인 운영 로그 흐름"
앱 서버 (Python)
    │ logging → JSON 파일
    ▼
로그 수집기 (Filebeat, Fluentd 등)
    │ 파일을 실시간 감시하여 전송
    ▼
로그 저장소 (Elasticsearch, CloudWatch, Datadog 등)
    │
    ▼
시각화/검색 (Kibana, Grafana 등)
    → 대시보드, 알림, 검색
```

##### 운영 로깅 체크리스트

| 항목 | 확인 사항 |
| :--- | :--- |
| 로그 회전 | RotatingFileHandler 또는 logrotate 설정 — 디스크 가득 참 방지 |
| 인코딩 | `encoding="utf-8"` — 한글 깨짐 방지 |
| 민감 정보 | 비밀번호, 토큰, 개인정보가 로그에 포함되지 않는지 확인 |
| 로그 레벨 | 운영은 INFO 이상 — DEBUG는 필요할 때만 임시로 |
| 구조화 | JSON 포맷 — 로그 수집 시스템과의 연동 용이 |
| 타임존 | UTC 사용 권장 — 서버가 여러 리전에 있을 때 혼란 방지 |
