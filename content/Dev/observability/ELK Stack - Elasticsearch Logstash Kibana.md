---
tags:
  - DevOps
  - logging
  - backend
created: 2026-06-22T12:00:00
updated: 2026-06-22T12:00:00
permalink: /Dev/observability/elk-stack-elasticsearch-logstash-kibana
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - ELK Stack은 Elasticsearch + Logstash + Kibana로 구성된 로그 수집·검색·시각화 오픈소스 스택
> - Beats 추가 후 Elastic Stack으로 명칭 확장, Filebeat가 경량 로그 수집 담당
> - Elasticsearch는 역인덱스 기반 분산 검색 엔진, Logstash는 파이프라인 기반 데이터 변환, Kibana는 웹 대시보드
> - 로그 전문 검색과 영구 보관이 중요한 중대규모 운영 환경에 적합 (소규모에는 다소 과한 편)

---

### 1. ELK Stack이란

서비스를 운영하면 서버, 애플리케이션, 네트워크 장비 등에서 로그가 쏟아진다. 서버가 한두 대일 때는 `tail -f`로 충분하지만, 노드가 수십 대로 늘어나면 로그를 한곳에 모아 검색하고 시각화하는 시스템이 필요하다.

ELK Stack은 이 문제를 해결하는 오픈소스 조합이다.

| 구성 요소 | 역할 |
|---|---|
| **E**lasticsearch | 로그 저장·검색·분석 엔진 |
| **L**ogstash | 다양한 소스에서 데이터를 수집·변환·전송하는 파이프라인 |
| **K**ibana | Elasticsearch 데이터를 시각화하는 웹 대시보드 |

현재는 **Beats**(경량 데이터 수집기)가 추가되면서 공식 명칭이 **Elastic Stack**으로 바뀌었다.

---

### 2. 데이터 흐름

```
앱/서버 → Beats(수집) → Logstash(변환·필터링) → Elasticsearch(인덱싱·저장) → Kibana(시각화)
```

소규모 환경에서는 Logstash 없이 Beats → Elasticsearch로 직접 보내는 구성도 가능하다.

---

### 3. 각 구성 요소 상세

#### 3-1. Elasticsearch

Apache Lucene 기반의 분산 검색·분석 엔진이다.

- **역인덱스(Inverted Index)** 구조로 전문 검색(Full-text Search)이 빠름
- 데이터를 **JSON 문서** 단위로 저장
- 클러스터 구성으로 수평 확장 가능 (노드 추가만으로 용량·성능 확장)
- REST API로 모든 작업 수행

```bash
# 인덱스에 문서 추가
curl -X POST "localhost:9200/logs/_doc" -H 'Content-Type: application/json' -d '{
  "timestamp": "2026-06-09T12:00:00",
  "level": "ERROR",
  "message": "Connection refused to database",
  "service": "api-server"
}'

# 검색
curl -X GET "localhost:9200/logs/_search?q=level:ERROR"
```

> [!info]+ 핵심 개념
> - **Index**: RDB의 테이블에 대응. 같은 구조의 문서 모음
> - **Document**: RDB의 행(row)에 대응. 하나의 JSON 객체
> - **Shard**: 인덱스를 분할한 단위. 여러 노드에 분산 저장
> - **Replica**: 샤드의 복제본. 가용성과 읽기 성능 향상

#### 3-2. Logstash

데이터를 **수집(Input) → 변환(Filter) → 전송(Output)** 하는 파이프라인 도구다. JVM 위에서 동작한다.

```ruby
# logstash.conf 예시
input {
  beats {
    port => 5044
  }
}

filter {
  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:msg}" }
  }
  date {
    match => [ "timestamp", "ISO8601" ]
  }
}

output {
  elasticsearch {
    hosts => ["http://localhost:9200"]
    index => "app-logs-%{+YYYY.MM.dd}"
  }
}
```

- **Input**: Beats, 파일, Kafka, Redis, syslog 등 다양한 소스 지원
- **Filter**: grok(정규식 파싱), mutate(필드 변환), geoip(IP → 위치 변환) 등
- **Output**: Elasticsearch, S3, Kafka 등으로 전송

> [!tip]+ Logstash vs Beats
> Logstash는 복잡한 변환·필터링이 필요할 때 사용한다. 단순 수집만 필요하면 Beats가 더 가볍고 효율적이다. 둘을 조합해서 Beats로 수집 → Logstash로 변환 → Elasticsearch로 전송하는 패턴이 일반적이다.

#### 3-3. Kibana

Elasticsearch에 저장된 데이터를 시각화하는 웹 인터페이스다.

- **Discover**: 로그 원본 검색·탐색
- **Dashboard**: 차트·테이블·지도 등을 조합한 대시보드 구성
- **Lens**: 드래그 앤 드롭으로 시각화 생성
- **Alerting**: 조건 기반 알림 설정 (Slack, 이메일 등)
- **KQL(Kibana Query Language)**: 직관적인 쿼리 문법

```
# KQL 예시
level: "ERROR" and service: "api-server" and message: "timeout"
```

#### 3-4. Beats

Go로 작성된 경량 데이터 수집기 시리즈다. 용도별로 종류가 나뉜다.

| Beat | 수집 대상 |
|---|---|
| **Filebeat** | 로그 파일 |
| **Metricbeat** | 시스템·서비스 메트릭 (CPU, 메모리 등) |
| **Packetbeat** | 네트워크 패킷 |
| **Heartbeat** | 서비스 가용성 (uptime 모니터링) |
| **Auditbeat** | 시스템 감사 데이터 |

가장 많이 쓰이는 것은 **Filebeat**이다. Logstash보다 리소스 소비가 훨씬 적어 각 서버에 에이전트로 설치하기 적합하다.

---

### 4. Docker Compose로 시작하기

로컬에서 ELK Stack을 빠르게 띄우는 최소 구성이다.

```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.17.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.17.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  es-data:
```

```bash
docker compose up -d

# Elasticsearch 동작 확인
curl localhost:9200

# Kibana 접속
# http://localhost:5601
```

> [!note]+ 리소스 참고
> Elasticsearch는 JVM 기반이라 메모리를 많이 사용한다. 최소 2GB 이상의 힙 메모리를 권장하며, 프로덕션 환경에서는 노드당 8~16GB가 일반적이다.

---

### 5. 실무에서 자주 쓰는 구성 패턴

#### 패턴 1: 기본 (소규모)
```
Filebeat → Elasticsearch → Kibana
```
로그 변환이 필요 없을 때. Filebeat이 직접 Elasticsearch로 전송한다.

#### 패턴 2: 표준 (중규모)
```
Filebeat → Logstash → Elasticsearch → Kibana
```
로그 파싱·필터링이 필요할 때. 가장 일반적인 구성이다.

#### 패턴 3: 버퍼 포함 (대규모)
```
Filebeat → Kafka → Logstash → Elasticsearch → Kibana
```
로그 유실 방지와 백프레셔 처리가 필요할 때. Kafka가 버퍼 역할을 한다.

---

### 6. ELK vs 대안 비교

| 항목 | ELK Stack | Grafana Loki | Datadog |
|---|---|---|---|
| 타입 | 오픈소스 (self-hosted) | 오픈소스 (self-hosted) | SaaS |
| 전문 검색 | 역인덱스 기반, 매우 빠름 | 라벨 기반, 제한적 | 전문 검색 지원 |
| 리소스 사용 | 높음 (JVM 기반) | 낮음 (로그 본문 인덱싱 안 함) | 관리 불필요 |
| 운영 난이도 | 높음 (클러스터 관리 필요) | 중간 | 낮음 |
| 비용 | 인프라 비용만 | 인프라 비용만 | 사용량 기반 과금 |
| 적합한 환경 | 로그 전문 검색이 중요한 중대규모 | 라벨 기반 필터링이면 충분한 환경 | 운영 부담을 줄이고 싶을 때 |

> [!tip]+ 선택 기준
> - 로그 본문을 자유롭게 검색해야 한다면 → ELK
> - Prometheus/Grafana를 이미 사용 중이고 로그를 가볍게 붙이고 싶다면 → Loki
> - Docker 컨테이너 로그를 저장·검색 없이 실시간으로 확인만 하면 → [[Dozzle - 경량 Docker 로그 뷰어|Dozzle]]
>
> 단, Dozzle은 로그를 저장·인덱싱하지 않는 Docker 전용 실시간 뷰어라, ELK·Loki와 같은 급의 로그 플랫폼 대안은 아니다.

---

### 7. 운영 시 주의사항

- **인덱스 수명 관리(ILM)**: 오래된 인덱스를 자동으로 축소·삭제하는 정책을 설정해야 디스크 폭증을 방지할 수 있다
- **샤드 수 설계**: 샤드가 너무 많으면 클러스터 오버헤드가 증가한다. 샤드당 10~50GB가 적정 범위
- **보안 설정**: 8.x부터 기본적으로 TLS와 인증이 활성화된다. 테스트 환경에서는 `xpack.security.enabled=false`로 끌 수 있지만, 프로덕션에서는 반드시 활성화
- **힙 메모리**: 전체 메모리의 50% 이하로 설정하고, 32GB를 넘지 않도록 한다 (JVM compressed oops 한계)
- **매핑 폭발 방지**: 동적 매핑으로 필드가 무한히 늘어나지 않도록 `index.mapping.total_fields.limit` 설정
