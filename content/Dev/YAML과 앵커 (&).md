---
tags:
  - yaml
created: 2025-05-28T23:59:29
updated: 2025-05-29T07:40:22
---
### YAML 파일이란?

YAML(YAML Ain't Markup Language, 이전에는 Yet Another Markup Language)은 사람이 읽기 쉽고, 다양한 환경에서 널리 쓰이는 구성(config) 파일 포맷이다.

##### 주요 특징
-  가독성이 뛰어나고, 들여쓰기로 구조를 표현함  
- 중괄호/대괄호 없이 간결함  
 - `.yaml`, `.yml` 확장자 사용  
-  서버 설정(Docker, Kubernetes 등)이나 데이터 직렬화에 자주 사용
 - 들여쓰기로 계층(부모-자식) 구조 표현


##### 노드 (Node) : YAML의 구성 요소
YAML 문서의 '구성요소 하나하나'를 모두 노드라고 한다.  
YAML 전체 문서는 루트 노드라고 하며 노드 타입에는 Map, Sequence, Scalar 3가지가 존재한다.

-  Map : 또다른 노드들로 구성
	```yaml
	key: value
	```

-  Sequence : 여러 개의 노드로 구성
	```yaml
	- item1
	- item2
	```
-  Scalar : 더 이상 쪼갤 수 없는 값으로 Map에서 value에 해당 (hello world)
	```yaml
	message: hello world
   #  ↑ key    ↑ value(=Scalar)
	```

##### 기본 문법 예시

```yaml
server:                       # Map 노드 (루트의 자식, 키: server)
  host: 127.0.0.1             #  └─ Map 노드 (키: host, 값: 127.0.0.1, Scalar 노드)
  port: 8080                  #  └─ Map 노드 (키: port, 값: 8080, Scalar 노드)

users:                        # Map 노드 (키: users, 값: Sequence 노드)
  - name: alice               #  ├─ Sequence 노드 (리스트 아이템, Map 노드)
    email: alice@example.com  #  │    └─ Map 노드 (키: email, 값: alice@example.com, Scalar)
  - name: bob                 #  ├─ Sequence 노드 (리스트 아이템, Map 노드)
    email: bob@example.com    #  │    └─ Map 노드 (키: email, 값: bob@example.com, Scalar)

features:                     # Map 노드 (키: features, 값: Map 노드)
  logging: true               #  ├─ Map 노드 (키: logging, 값: true, Scalar 노드)
  debug: false                #  └─ Map 노드 (키: debug, 값: false, Scalar 노드)
```


--- 

### YAML에서 `&` 앵커의 범위와 인덴테이션 기준

##### `&` (Anchor)와 `*` (Alias)의 기본 개념
- anchor (`&`) : 어떤 노드에 이름을 붙여 나중에 재사용 가능하게 함
- alias (`*`). 앞서 정의된 앵커를 참조함

##### 앵커의 적용 범위
- 앵커는 자신이 붙은 노드 전체를 기준으로 복사됨
- 즉, `&name`이 붙은 위치에서 *해당 노드의 전체 하위 구조* 가 복사됨
- 이때 *들여쓰기(indentation)* 는 매우 중요함. 같은 수준의 인덴트로 묶인 블록 전체가 앵커의 범위임

##### 예시

~~~yaml title="docker-compose.yaml" {1-3}
common-config: &common
  ENV1: "value1"
  ENV2: "value2"

my-service:
  environment:
    <<: *common
    ENV3: "value3"
~~~
- 여기서 &common은 ENV1, ENV2가 들어 있는 블록 전체를 앵커로 저장함
- <<: common을 통해 해당 값을 복사해서 my-service.environment에 삽입함
- ENV3는 복사된 값 뒤에 추가됨

##### 인덴테이션 기준 정리
- &name이 선언된 라인의 들여쓰기 기준으로 같은 수준의 노드 전체가 복사 대상
- 들여쓰기가 다르면 다른 레벨로 인식되어 복사되지 않음

##### 결론
- &의 범위는 자신과 동일한 인덴트 수준의 블록 전체
- 앵커를 설정할 때 반드시 *정확한 들여쓰기* 가 유지되어야 함
- YAML에서는 들여쓰기가 *의미를 결정하는 구조적 문법* 이므로, &, \*, <<를 사용할 땐 인덴트를 항상 주의해야 함