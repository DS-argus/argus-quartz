---
tags:
  - observability
  - DevOps
  - distributed-system
created: 2026-06-22T12:00:00
updated: 2026-06-22T21:25:11
permalink: /Dev/observability/opentelemetry-vendor-neutral-observability-standard
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - OpenTelemetry(OTel)는 관측 데이터를 어떤 모양으로 만들고 어떤 약속으로 전송할지를 정한 CNCF 표준이자 도구 모음
> - 다루는 신호는 Metrics, Logs, Traces 세 가지이며, 속성 이름까지 통일한 Semantic Conventions가 핵심
> - 전송은 OTLP(protobuf 직렬화 + gRPC/HTTP) 프로토콜로 표준화, 단 디스크 저장 포맷은 표준이 정하지 않고 백엔드가 결정
> - 구성은 코드 계측용 API/SDK와 수집·가공·전달을 맡는 Collector로 나뉨
> - 가장 큰 가치는 벤더 중립성 — 코드를 OTel 방식으로 계측해두면 백엔드(Jaeger, Tempo, Prometheus 등)를 자유롭게 교체 가능

---

### 1. OpenTelemetry란

서비스를 운영하면 "지금 시스템이 어떤 상태인가"를 외부에서 들여다봐야 한다. 이렇게 시스템 내부 상태를 데이터로 파악하는 능력을 **관측성(Observability)**이라고 부른다. 관측에 쓰는 데이터는 **텔레메트리(Telemetry)** 데이터라고 한다.

문제는 이 데이터를 만드는 방식이 도구마다 제각각이었다는 점이다. 모니터링 업체를 Datadog에서 다른 곳으로 바꾸려면, 코드에 박아둔 계측 로직을 전부 새 업체 방식으로 다시 짜야 했다. 한번 도구를 고르면 거기 묶이는 **벤더 종속(vendor lock-in)** 문제가 생긴다.

OpenTelemetry(줄여서 **OTel**)는 이 문제를 풀기 위한 표준이다. CNCF(Cloud Native Computing Foundation) 프로젝트로, 두 개의 선행 프로젝트(OpenTracing, OpenCensus)가 합쳐져 만들어졌다.

> [!info]+ 한 줄 정의
> OpenTelemetry는 **관측 데이터를 어떤 모양으로 만들고, 어떤 약속으로 전송할지를 표준화한 것**이다. 저장과 시각화는 그 표준을 받아들이는 다른 도구들의 몫이다.

---

### 2. 세 가지 신호 (Signals)

OTel이 다루는 텔레메트리 데이터는 세 종류로 나뉜다. 이를 **신호(Signal)**라고 부른다.

| 신호 | 내용 | 예시 |
|---|---|---|
| **Metrics** | 시간에 따른 수치 지표 | CPU 사용률, 초당 요청 수, 응답 지연 |
| **Logs** | 이벤트 기록 메시지 | 에러 로그, 접근 로그 |
| **Traces** | 요청이 여러 서비스를 거치는 경로 추적 | A 서비스 → B 서비스 → DB 호출 흐름 |

특히 **Traces(분산 추적)**가 OTel의 색깔이 가장 강한 영역이다. 마이크로서비스 환경에서 하나의 요청이 여러 서비스를 넘나들 때 어디서 느려졌는지 짚으려면, 서비스를 가로지르는 표준이 필요하기 때문이다.

---

### 3. 데이터 모델과 Semantic Conventions

OTel이 표준으로 정한 것의 핵심은 "**데이터가 어떤 필드를 가져야 하는가**"이다.

#### 3-1. Span — 추적의 최소 단위

Trace는 여러 개의 **Span**으로 이루어진다. Span 하나는 "하나의 작업 구간"을 뜻하며, 대략 이런 구조를 갖는다.

```json
{
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "parent_span_id": "0000000000000000",
  "name": "GET /api/users",
  "start_time": "2026-06-22T10:00:00.000Z",
  "end_time":   "2026-06-22T10:00:00.120Z",
  "attributes": {
    "http.request.method": "GET",
    "http.response.status_code": 200
  }
}
```

`trace_id`가 같은 Span들을 모으면 하나의 요청 흐름이 되고, `parent_span_id`로 부모-자식 관계를 이어 호출 트리를 복원한다.

#### 3-2. Semantic Conventions — 속성 이름 표준

위 예시의 `http.request.method` 같은 **속성(attribute) 이름**까지 통일해둔 규약을 **Semantic Conventions(시맨틱 규약)**라고 한다.

> [!tip]+ 왜 이름 표준이 중요한가
> 누구는 `http.method`, 누구는 `httpMethod`, 누구는 `method`라고 적으면, 데이터를 받는 도구가 같은 의미인지 알 수 없다. "HTTP 메서드는 `http.request.method`라고 적자"처럼 이름을 못 박아두면, 어느 백엔드로 보내든 같은 의미로 해석된다. OTel이 단순한 라이브러리가 아니라 **표준**이라고 불리는 이유가 여기에 있다.

---

### 4. OTLP — 전송 프로토콜

데이터 모델로 만든 데이터를 네트워크로 실어 나르는 약속이 **OTLP(OpenTelemetry Protocol)**이다. "그 규격이 뭔데?"라는 질문에 가장 직접 답하는 부분이다.

- **직렬화**: [[Python serialization#Protobuf (Protocol Buffers)|Protocol Buffers]](protobuf) — 바이너리로 압축된 형식
- **전송 방식**: [[REST vs gRPC vs GraphQL - API 통신 방식 비교#3. gRPC (Google Remote Procedure Call)|gRPC]] 또는 HTTP/protobuf, HTTP/JSON
- **기본 포트**: `4317`(gRPC), `4318`(HTTP)

> [!info]+ 왜 protobuf와 gRPC인가 — 관측 데이터의 특징
> 텔레메트리는 본래 서비스 트래픽에 **부가로 얹히는 데이터**라 양이 많고 쉴 새 없이 흐른다. 이 전송이 무거우면 정작 본 서비스 성능을 갉아먹는다. 그래서 가볍고 빠른 조합을 고른다.
> - **protobuf**: 바이너리로 압축해 대량 데이터의 전송 크기와 직렬화 비용을 줄인다. OTel 데이터 모델이 이미 스키마로 고정돼 있어 스키마 기반 포맷과 잘 맞는다.
> - **gRPC**: HTTP/2 기반이라 커넥션 하나를 재사용하며 끊임없이 흐르는 스트림을 효율적으로 실어 나른다.

#### 4-1. 전송 통로와 인코딩

OTLP의 전송 방식은 두 축의 조합으로 정해진다. **전송 통로**(gRPC냐 일반 HTTP냐)와 **인코딩**(본문을 protobuf 바이너리로 담느냐 JSON 텍스트로 담느냐)이다. 이 조합에서 세 가지 방식이 나온다.

| 방식 | 전송 통로 | 본문 인코딩 | 포트 | 주 용도 |
|---|---|---|---|---|
| **OTLP/gRPC** | HTTP/2 (gRPC) | protobuf | `4317` | 운영 기본. 가장 빠르고 효율적 |
| **OTLP/HTTP + protobuf** | 일반 HTTP POST | protobuf | `4318` | 프록시·방화벽 환경에서도 무난, 작은 크기 유지 |
| **OTLP/HTTP + JSON** | 일반 HTTP POST | JSON | `4318` | 디버깅·테스트용, 사람이 읽기 쉬움 |

`HTTP/protobuf`와 `HTTP/JSON`은 둘 다 평범한 HTTP POST로 보내되, 본문에 담는 게 protobuf 바이너리냐 JSON 텍스트냐만 다르다. gRPC는 성능이 가장 좋지만 HTTP/2를 받쳐줘야 하고 일부 환경에서 까다로워서, 일반 HTTP로 보내는 두 방식이 호환성 대안으로 함께 제공된다.

```bash
# OTLP/HTTP 엔드포인트로 trace 전송 (Collector 기본 수신 포트)
# 실제로는 SDK가 알아서 보내지만, 구조를 보면 이런 형태다
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d @trace-payload.json
```

위 예시가 바로 **OTLP/HTTP + JSON** 방식이다. 포트 `4318`은 HTTP 수신구를 뜻하고(gRPC라면 `4317`), `Content-Type: application/json`이 JSON 인코딩을 가리킨다. 같은 포트로 protobuf를 보낸다면 `Content-Type: application/x-protobuf`를 쓴다.

---

### 5. 저장 포맷은 OTel이 정하지 않는다

헷갈리기 쉬운 지점이다. OTel은 **만드는 형태(데이터 모델)와 보내는 형태(OTLP)**까지만 책임진다. 디스크에 어떻게 저장할지는 받는 쪽, 즉 백엔드가 자기 방식대로 한다.

```
[앱]  →  OTLP로 전송  →  [백엔드가 자기 방식대로 저장]
                          - Prometheus → 자체 TSDB(시계열 DB)
                          - Tempo      → 객체 스토리지(S3 등)에 trace 저장
                          - Jaeger     → Cassandra / Elasticsearch
```

**들어오는 입구(OTLP)와 데이터 의미(모델)는 통일**되어 있지만, **저장 포맷은 백엔드마다 제각각**이다. 이 구조 덕분에 코드는 그대로 두고 저장소만 바꿀 수 있다.

| 구분 | OTel이 정함? | 내용 |
|---|:---:|---|
| 데이터 모델 | O | Metrics/Logs/Traces의 필드 구조 |
| Semantic Conventions | O | 속성 이름 표준 (`http.request.method` 등) |
| 전송 프로토콜(OTLP) | O | protobuf 직렬화 + gRPC/HTTP |
| 저장(디스크) 포맷 | **X** | 백엔드(Prometheus, Tempo, Jaeger…)가 결정 |

---

### 6. 구성 요소

OTel은 크게 두 덩어리로 나뉜다. **코드에 박는 부분(API/SDK)**과 **데이터를 모아 나르는 부분(Collector)**이다.

#### 6-1. API와 SDK — 계측(Instrumentation)

애플리케이션 코드에서 텔레메트리 데이터를 생성하는 작업을 **계측(Instrumentation)**이라고 한다.

- **API**: 데이터를 만드는 인터페이스(추상). 코드는 이 API에만 의존한다
- **SDK**: API의 실제 구현체. 샘플링, 배치 처리, 내보내기(export) 등을 담당
- **자동 계측(Auto-instrumentation)**: 인기 프레임워크(Flask, Express 등)는 코드 수정 거의 없이 자동으로 계측 가능

```python
# Python 예시 — 수동 계측
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("process_order") as span:
    span.set_attribute("order.id", 1234)
    # 실제 비즈니스 로직...
```

#### 6-2. Collector — 수집·가공·전달

**OpenTelemetry Collector**는 텔레메트리 데이터를 받아서 가공한 뒤 백엔드로 전달하는 중계기다. 세 단계 파이프라인으로 동작한다.

| 단계 | 역할 | 예시 |
|---|---|---|
| **Receiver** | 데이터 수신 | OTLP, Prometheus, Jaeger 형식 등 |
| **Processor** | 가공·필터링·배치 | 샘플링, 속성 추가/삭제, 배치 묶음 |
| **Exporter** | 백엔드로 전송 | Tempo, Prometheus, Loki, Datadog 등 |

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  debug:
    verbosity: detailed

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug]
```

---

### 7. 전체 아키텍처

지금까지 내용을 하나의 흐름으로 묶으면 이렇게 된다.

```
[애플리케이션]
   │  OpenTelemetry API/SDK로 계측 (Metrics/Logs/Traces 생성)
   │  OTLP로 전송
   ▼
[OTel Collector / Grafana Alloy]   ← 수집·가공·전달하는 중계기
   │  Exporter가 각 백엔드 형식으로 변환
   ▼
[저장·시각화 백엔드]
   Prometheus(metrics) · Loki(logs) · Tempo(traces) · Grafana(대시보드)
```

> [!note]+ Collector는 꼭 필요한가
> 앱이 백엔드로 OTLP를 직접 보낼 수도 있다. 하지만 Collector를 가운데 두면 ① 앱은 전송 대상이 바뀌어도 영향받지 않고 ② 샘플링·필터링을 중앙에서 관리하며 ③ 여러 형식을 한곳에서 변환할 수 있다. 규모가 커질수록 Collector를 두는 쪽이 유리하다.

---

### 8. Collector 진영의 도구들

OTel Collector 외에도 같은 "수집·전달 계층"에 들어가는 도구가 여럿이다. 이들은 대부분 OTLP를 지원하므로 OTel 생태계와 맞물려 돌아간다.

| 도구 | 진영 / 특징 |
|---|---|
| **OpenTelemetry Collector** | OTel 공식 레퍼런스 수집기 |
| **Grafana Alloy** | Grafana 진영. OTel Collector 기반, Prometheus/Loki/Tempo 통합이 강점 |
| **Fluentd / Fluent Bit** | 로그 수집에 강한 CNCF 프로젝트 |
| **Vector** | 고성능 텔레메트리 파이프라인 |
| **Telegraf** | InfluxDB 진영의 메트릭 수집기 |

> [!tip]+ Beats / Elastic Agent와의 관계
> [[ELK Stack - Elasticsearch Logstash Kibana|Elastic Stack]]의 Beats나 Elastic Agent도 같은 "수집·전달 계층"에 속한다. 다만 Beats는 Elastic 생태계에 특화돼 있고, OTel Collector·Alloy는 OTLP 기반이라 백엔드 중립적이라는 차이가 있다. Alloy의 1:1 대응은 통합 수집기인 Elastic Agent 쪽에 가깝다.

---

### 9. 기존 모니터링과 무엇이 다른가

Prometheus, Jaeger, ELK 같은 도구는 OTel 이전부터 있었다. OTel은 이들을 대체하는 게 아니라, **이들 앞단의 표준을 통일**하는 역할이다.

- **이전**: 도구마다 계측 방식이 달라 코드가 특정 도구에 묶임
- **이후**: OTel 방식으로 한 번 계측 → 저장·시각화 백엔드는 자유롭게 교체

> [!info]+ 핵심 가치 정리
> OpenTelemetry의 본질은 "새로운 모니터링 도구"가 아니라 **계측과 전송의 공통 표준**이다. 데이터를 만드는 방법(SDK), 데이터의 모양(데이터 모델), 보내는 방법(OTLP)을 통일해서, 백엔드를 갈아끼울 수 있는 자유를 준다.

---

### 10. 정리

- OpenTelemetry는 관측 데이터의 **모양(데이터 모델)**과 **전송 약속(OTLP)**을 정한 CNCF 표준이다
- 다루는 신호는 **Metrics · Logs · Traces** 세 가지
- 속성 이름까지 통일한 **Semantic Conventions**가 표준의 핵심
- **저장 포맷은 표준이 정하지 않는다** — 백엔드(Prometheus, Tempo, Jaeger 등)가 결정
- 구성은 계측용 **API/SDK**와 수집·전달용 **Collector**로 나뉘며, Alloy 등 여러 수집기가 같은 계층에서 OTLP로 맞물린다
- 가장 큰 이점은 **벤더 중립성** — 계측은 그대로 두고 백엔드만 교체 가능
