---
tags:
  - java
  - maven
  - gradle
  - build
created: 2026-06-05T10:00:00
updated: 2026-06-05T10:00:00
permalink: /Dev/java/maven-vs-gradle
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Maven은 XML 기반의 선언적 빌드 도구로 컨벤션 중심, Gradle은 Kotlin/Groovy DSL 기반으로 유연성 중심
> - Gradle이 증분 빌드, 빌드 캐시, 데몬 덕분에 대부분의 시나리오에서 2배 이상 빠름
> - 소규모 프로젝트는 Maven의 단순함이 장점, 대규모/멀티모듈 프로젝트는 Gradle이 유리

> [!cite]+ Source
> - [Gradle and Maven Comparison (gradle.org)](https://gradle.org/maven-and-gradle/)
> - [Maven vs Gradle in 2026: The Ultimate Build Tool Showdown](https://toolshelf.tech/blog/maven-vs-gradle-2026-build-tool-showdown/)

---

### 1. 빌드 도구가 뭔가

Java(또는 JVM 언어) 프로젝트는 소스 코드를 컴파일하고, 외부 라이브러리를 다운로드하고, 테스트를 돌리고, 최종 패키지(JAR, WAR 등)를 만드는 과정이 필요하다. 이 전체 과정을 자동화해 주는 것이 빌드 도구다.

Python에서 `pip install` + `pytest` + 패키징을 하나의 도구가 해준다고 생각하면 된다.

---

### 2. Maven

Apache Maven은 2004년에 등장한 빌드 도구다. **"Convention over Configuration"** 철학을 따른다.

##### 핵심 특징

- **XML 설정** (`pom.xml`): 프로젝트가 무엇인지 선언하면 Maven이 알아서 빌드한다
- **고정된 라이프사이클**: `clean` → `validate` → `compile` → `test` → `package` → `install` → `deploy`
- **중앙 저장소**: Maven Central에서 의존성을 자동 다운로드

```xml
<project>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
      <version>3.2.0</version>
    </dependency>
  </dependencies>
</project>
```

```bash
mvn clean package    # 빌드
mvn test             # 테스트
mvn dependency:tree  # 의존성 트리 확인
```

---

### 3. Gradle

Gradle은 2012년에 등장했다. Maven의 컨벤션은 가져가되 유연성을 대폭 강화한 도구다. Android 공식 빌드 도구이기도 하다.

##### 핵심 특징

- **Kotlin DSL 또는 Groovy DSL**: XML 대신 프로그래밍 언어로 빌드 로직 작성
- **증분 빌드**: 변경된 부분만 다시 빌드
- **빌드 캐시 + 데몬**: 이전 빌드 결과를 재사용하고, 백그라운드 프로세스로 JVM 워밍업 유지

```kotlin
// build.gradle.kts (Kotlin DSL)
plugins {
    java
    id("org.springframework.boot") version "3.2.0"
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
}
```

```bash
gradle build         # 빌드
gradle test          # 테스트
gradle dependencies  # 의존성 트리 확인
```

---

### 4. 핵심 비교

| 항목 | Maven | Gradle |
|------|-------|--------|
| 설정 언어 | XML (`pom.xml`) | Kotlin/Groovy DSL (`build.gradle.kts`) |
| 철학 | 컨벤션 중심, 엄격한 구조 | 유연성 중심, 커스터마이징 자유 |
| 빌드 속도 | 매번 전체 빌드 | 증분 빌드 + 캐시로 2~100배 빠름 |
| 의존성 충돌 해결 | 가장 가까운 정의 우선 (트리 깊이 기반) | 가장 높은 버전 우선 (전체 그래프 기반) |
| 학습 곡선 | 낮음 (정해진 틀을 따르면 됨) | 높음 (자유도가 큰 만큼 알아야 할 것이 많음) |
| 멀티모듈 | 지원하지만 설정이 반복적 | 깔끔한 멀티모듈 지원 |
| 생태계 | Spring, 전통 Java 엔터프라이즈 | Android, 대규모 멀티모듈 프로젝트 |

##### 벤치마크 (Apache Commons Lang 3 기준)

| 시나리오 | Gradle | Maven |
|----------|--------|-------|
| Clean 빌드 + 테스트 | 14.79s | 26.19s |
| 캐시 활성화 Clean 빌드 | 0.69s | 25.85s |
| 단일 파일 변경 컴파일 | 0.55s | 4.08s |

---

### 5. 의존성 해결 방식의 차이

빌드 도구 선택에서 의존성 충돌 해결 전략이 실무에서 꽤 중요하다.

**Maven** — "nearest definition wins". 의존성 트리에서 루트에 가까운 쪽이 이긴다. 트리 구조에 따라 결과가 달라질 수 있어서 예측하기 어렵다.

**Gradle** — 전체 의존성 그래프를 분석한 뒤 가장 높은 버전을 선택한다. 커스텀 해결 규칙도 지정할 수 있다. `implementation`과 `api` 스코프를 분리해서 라이브러리 의존성이 소비자에게 누출되는 것을 방지한다.

> [!tip]+ 실무 선택 기준
> - 소규모 프로젝트, Spring 기반 엔터프라이즈 → Maven으로 충분
> - Android, 대규모 멀티모듈, 빌드 속도가 중요한 환경 → Gradle 권장
> - 이미 팀에서 쓰고 있는 도구가 있다면 그걸 따르는 것이 가장 현실적

---

### 관련 노트

- [[Fat JAR vs Thin JAR & Shading]] — Maven shade/Gradle shadow 플러그인으로 Fat JAR을 만드는 실무 예시
