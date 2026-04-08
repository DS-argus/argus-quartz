---
tags:
  - java
  - build
  - maven
  - gradle
  - data_engineering
created: 2025-07-17T17:45:46
updated: 2026-04-08T22:07:46
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - JAR은 Java의 패키징 포맷이고, DE 도구(Flink, Spark, Kafka 등)가 JVM 기반이라 자주 마주친다
> - Fat JAR은 의존성을 몽땅 담은 단일 실행 파일, Thin JAR은 자기 코드만 담은 가벼운 파일
> - Shading은 Fat JAR을 만들 때 패키지 충돌을 피하기 위해 경로를 재배치하는 기술

---
### 1. JAR이 뭔데, 왜 DE에서 자꾸 나와?

##### JAR = Java Archive
JAR은 Java 코드를 컴파일한 `.class` 파일과 설정 파일들을 하나로 묶은 압축 파일이다. 본질적으로 zip 파일과 같다.

```bash
# JAR 내부 구조 확인 (실제로 zip이다)
unzip -l some-library.jar
jar tf some-library.jar
```

Python에서 `.whl`이 패키지 배포 단위인 것처럼, Java 생태계에서는 `.jar`이 라이브러리와 애플리케이션의 배포 단위다.

##### 왜 DE 도구들이 전부 Java(JVM) 기반인가?

대부분의 분산 데이터 처리 도구는 2000년대 후반~2010년대 초반에 탄생했다. 이 시기에 대규모 분산 시스템을 만들기 위한 현실적인 선택지가 Java/JVM이었다.

- **Hadoop(2006)** 이 시작점이다. Google의 MapReduce 논문을 Java로 구현한 것이 Hadoop이고, 이후 대부분의 빅데이터 도구가 Hadoop 생태계 위에 만들어졌다
- **JVM의 강점** — 크로스 플랫폼("Write Once, Run Anywhere"), 검증된 GC와 멀티스레딩, 풍부한 네트워크/직렬화 라이브러리가 분산 시스템 개발에 적합했다
- **생태계 연쇄 효과** — Hadoop이 Java니까 그 위에 만드는 Hive, HBase도 Java, 그 다음 세대인 Spark(Scala/JVM), Kafka(Java), Flink(Java)도 자연스럽게 JVM을 선택했다

| 도구 | 언어 | 시작 연도 | 비고 |
|------|------|----------|------|
| Hadoop | Java | 2006 | Google MapReduce의 오픈소스 구현 |
| Hive | Java | 2010 | Hadoop 위의 SQL 엔진 |
| Kafka | Java/Scala | 2011 | LinkedIn에서 개발 |
| Spark | Scala(JVM) | 2014 | Hadoop MapReduce의 대안 |
| Flink | Java | 2014 | 스트림 처리 중심 |
| Airflow | Python | 2014 | 워크플로 오케스트레이터 (JVM 아님) |

> [!tip]+ Python으로 쓰는데 왜 JAR을 알아야 할까?
> PySpark, PyFlink 같은 Python API는 내부적으로 JVM 프로세스를 띄워서 동작한다. Python은 드라이버 코드를 작성하는 인터페이스일 뿐, 실제 분산 처리는 JVM이 한다. 그래서 커넥터 설치, 의존성 충돌, 클래스패스 문제 등 JVM 쪽 이슈를 피할 수 없다.

##### DE에서 JAR을 직접 다루는 상황들

- **커넥터 설치** — Flink SQL에서 Kafka 소스를 쓰려면 `flink-sql-connector-kafka-*.jar`을 `lib/`에 넣어야 한다
- **Spark job 제출** — `spark-submit app.jar`로 애플리케이션 JAR을 클러스터에 전달한다
- **JDBC 드라이버** — Airflow나 Spark에서 DB에 연결할 때 드라이버 JAR을 클래스패스에 추가한다
- **의존성 충돌 해결** — 서로 다른 버전의 라이브러리가 충돌할 때 Fat/Thin JAR과 Shading 개념이 필요하다

---
### 2. 용어 정의

##### Fat JAR (Uber JAR)
- 모듈 자체 코드 + **모든 의존 라이브러리**를 하나의 JAR로 합친 파일
- "Fat"이라는 이름은 의존 코드까지 전부 포함해서 파일 덩치가 크다는 비유에서 왔다
- Uber는 독일어로 "~위의, 초월한"이라는 뜻으로, 일반 JAR을 넘어선다는 의미

##### Thin JAR (Slim JAR)
- 모듈 자체 코드만 담고, 의존 라이브러리는 런타임에 별도 제공된다고 가정하는 JAR
- `MANIFEST.MF`의 `Class-Path` 항목이나 외부 lib 디렉토리를 통해 의존성을 참조한다

##### Shading (Relocating)
- Fat JAR을 만들면서 내부 라이브러리의 **패키지 경로를 재배치(relocate)** 하는 기술
- 예: `com.google.guava` → `my.shaded.com.google.guava`
- 같은 라이브러리의 서로 다른 버전이 클래스패스에 공존할 때 생기는 충돌을 방지한다

---
### 3. Fat JAR vs Thin JAR 비교

| 구분     | Fat JAR                           | Thin JAR                         |
| ------ | --------------------------------- | -------------------------------- |
| 포함 내용  | 모듈 코드 + 모든 의존 JAR                 | 모듈 코드만                           |
| 파일 크기  | 큼 (수십~수백 MB)                      | 작음 (수 KB~수 MB)                   |
| 배포 편의성 | 파일 하나만 전달하면 끝                     | 의존 라이브러리를 함께 배포해야 함              |
| 의존성 관리 | JAR 내부에 고정됨                       | 외부에서 버전을 직접 제어 가능                |
| 충돌 위험  | 여러 Fat JAR이 같은 라이브러리를 중복 포함할 수 있음 | 하나의 라이브러리를 공유하므로 중복 없음           |
| 실패 모드  | 버전 충돌 시 `NoSuchMethodError`       | 의존 누락 시 `ClassNotFoundException` |

> [!tip]+ 언제 뭘 쓸까?
> - **Fat JAR** → CLI 도구, Lambda 배포, Flink/Spark job 제출처럼 단일 파일 실행이 필요할 때
> - **Thin JAR** → 라이브러리 배포, 의존 버전을 소비자가 직접 결정해야 할 때

---
### 4. Shading이 필요한 이유

JVM은 같은 FQCN(Fully Qualified Class Name)을 가진 클래스가 클래스패스에 두 개 이상 있으면 **먼저 발견된 것만 로드**한다. 이것이 JAR Hell의 핵심이다.

##### 전형적인 충돌 시나리오
```
내 프로젝트 → guava 31
    └── 라이브러리 A → guava 27 (Fat JAR에 포함)
```
라이브러리 A의 Fat JAR에 guava 27이 들어 있는데, 내 프로젝트는 guava 31을 쓴다. 클래스패스에 guava가 두 벌 올라가면서 `NoSuchMethodError`가 터진다.

##### Shading으로 해결
라이브러리 A를 빌드할 때 guava를 shading 처리하면 내부적으로 `com.google.common` → `a.shaded.com.google.common`으로 바뀐다. 두 guava가 서로 다른 패키지 경로를 갖게 되므로 충돌이 사라진다.

---
### 5. 빌드 도구별 Fat JAR 만들기

##### Maven — maven-shade-plugin

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-shade-plugin</artifactId>
  <version>3.6.0</version>
  <executions>
    <execution>
      <phase>package</phase>
      <goals><goal>shade</goal></goals>
      <configuration>
        <relocations>
          <relocation>
            <pattern>com.google.common</pattern>
            <shadedPattern>my.shaded.com.google.common</shadedPattern>
          </relocation>
        </relocations>
      </configuration>
    </execution>
  </executions>
</plugin>
```

```bash
mvn package
# target/my-app-1.0-SNAPSHOT.jar  ← shading 적용된 Fat JAR
```

##### Maven — maven-assembly-plugin
shading 없이 단순히 의존성을 합치기만 할 때 사용한다.

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-assembly-plugin</artifactId>
  <version>3.7.1</version>
  <configuration>
    <descriptorRefs>
      <descriptorRef>jar-with-dependencies</descriptorRef>
    </descriptorRefs>
    <archive>
      <manifest>
        <mainClass>com.example.Main</mainClass>
      </manifest>
    </archive>
  </configuration>
</plugin>
```

##### Gradle — Shadow Plugin

```groovy
plugins {
    id 'com.github.johnrengelman.shadow' version '8.1.1'
}

shadowJar {
    relocate 'com.google.common', 'my.shaded.com.google.common'
}
```

```bash
./gradlew shadowJar
# build/libs/my-app-1.0-all.jar
```

> [!note]+ shade vs shadow
> Maven에서는 **shade**, Gradle에서는 **shadow**라는 이름을 쓰지만 하는 일은 동일하다. 의존성을 Fat JAR로 합치면서 선택적으로 패키지 경로를 relocate 한다.

---
### 6. Spring Boot의 Fat JAR

Spring Boot는 Java의 웹 애플리케이션 프레임워크다. Python의 Django/FastAPI, Node.js의 Express 같은 포지션으로, Java 백엔드 개발에서 사실상 표준이다.

Spring Boot는 자체적인 Fat JAR 구조를 사용한다. 일반적인 Uber JAR과는 다른 방식이다.

##### 구조 차이
```
# 일반 Uber JAR — 모든 .class를 풀어서 합침
my-app.jar
├── com/example/Main.class
├── com/google/common/...
└── org/apache/...

# Spring Boot Fat JAR — 의존 JAR을 그대로 내장
my-app.jar
├── BOOT-INF/
│   ├── classes/        ← 내 코드
│   └── lib/            ← 의존 JAR 파일들 (원본 그대로)
├── META-INF/
└── org/springframework/boot/loader/  ← 커스텀 클래스로더
```

- Spring Boot는 의존 JAR을 풀지 않고 **원본 JAR 그대로** 내장한다
- `spring-boot-loader`라는 커스텀 클래스로더가 `BOOT-INF/lib/` 안의 JAR을 읽는다
- 이 방식 덕분에 shading 없이도 클래스 충돌 문제가 줄어든다

```bash
# Spring Boot Fat JAR 실행
java -jar my-app.jar

# 내부 구조 확인
jar tf my-app.jar | head -20
```

---
### 7. 실무에서 주의할 점

##### 서비스 파일 병합 (SPI)
Java의 `ServiceLoader`는 `META-INF/services/` 아래 파일을 읽어 구현체를 찾는다. Fat JAR로 합칠 때 여러 라이브러리가 같은 서비스 파일을 가지고 있으면 **하나만 남고 나머지가 사라진다**.

```xml
<!-- maven-shade-plugin: 서비스 파일 병합 설정 -->
<transformers>
  <transformer implementation=
    "org.apache.maven.plugins.shade.resource.ServicesResourceTransformer"/>
</transformers>
```

```groovy
// Gradle Shadow: 서비스 파일 병합
shadowJar {
    mergeServiceFiles()
}
```

##### 서명된 JAR 처리
일부 라이브러리(BouncyCastle 등)는 JAR에 서명이 되어 있다. Fat JAR로 합치면 서명이 깨지면서 `SecurityException`이 발생한다.

```xml
<!-- 서명 파일 제외 -->
<filters>
  <filter>
    <artifact>*:*</artifact>
    <excludes>
      <exclude>META-INF/*.SF</exclude>
      <exclude>META-INF/*.DSA</exclude>
      <exclude>META-INF/*.RSA</exclude>
    </excludes>
  </filter>
</filters>
```

##### Fat JAR 중복 배포 금지
같은 라이브러리를 포함하는 Fat JAR과 Thin JAR을 동시에 클래스패스에 올리면 클래스가 두 벌 로드되면서 예측 불가능한 오류가 발생한다.

---
### 8. Flink 환경 실무 팁

Flink SQL Connector는 설치 편의를 위해 Fat JAR 형태로 배포된다.

- `$FLINK_HOME/lib`에는 Fat JAR만 두고, Thin JAR은 제거한다
- DataStream API에서 Kafka client 버전을 세밀하게 제어하려면 Thin JAR + 명시적 의존 선언을 사용한다
- Fat JAR 내부에 특정 라이브러리가 포함됐는지 확인하는 방법:

```bash
jar tf flink-sql-connector-kafka-3.2.0-1.18.jar | grep org/apache/kafka | head
```

- Fat JAR과 Thin JAR을 동시에 `lib/`에 넣으면 중복 클래스 로딩으로 `NoSuchMethodError`, `ClassNotFoundException` 위험이 있다

---
### 9. 한눈에 정리

| 개념              | 핵심                                         |
| --------------- | ------------------------------------------ |
| Fat JAR         | 의존성 포함, 단일 파일 배포, 크기 큼                     |
| Thin JAR        | 자기 코드만, 가벼움, 외부 의존성 필요                     |
| Shading         | Fat JAR 내부 패키지 경로 재배치로 충돌 방지               |
| Spring Boot JAR | 의존 JAR을 풀지 않고 원본 그대로 내장, 커스텀 로더 사용         |
| SPI 병합          | Fat JAR 빌드 시 `META-INF/services/` 파일 병합 필수 |
