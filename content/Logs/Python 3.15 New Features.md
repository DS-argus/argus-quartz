---
tags:
  - python
created: 2026-06-28T11:00:00
updated: 2026-06-28T11:00:00
permalink: /Logs/python-3-15-new-features
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Python 3.15는 `lazy` 키워드 기반 지연 import(PEP 810)로 콜드 스타트 시간을 단축
> - 불변 딕셔너리 `frozendict`(PEP 814)와 고유값 `sentinel`(PEP 661)이 내장 타입으로 추가
> - 컴프리헨션·제너레이터 식 안에서 `*`/`**` 언패킹 허용(PEP 798)
> - JIT 성능 향상, 샘플링 프로파일러 추가, 3.14의 incremental GC는 철회
> - 작성 시점 3.15는 beta(3.15.0b3) 단계로, 2026년 6월 기능 동결 후 확정된 항목 기준

> [!cite]+ Source
> - [The best new features in Python 3.15 (InfoWorld)](https://www.infoworld.com/article/4166693/the-best-new-features-in-python-3-15.html)
> - [What's new in Python 3.15 (공식 문서)](https://docs.python.org/3.15/whatsnew/3.15.html)

---
### 문법 변화

- **Lazy imports**(PEP 810): `lazy` 소프트 키워드로 import를 실제 사용 시점까지 미룬다. top-level import가 많은 CLI·웹 프로세스의 콜드 스타트에서 수백 ms를 줄일 수 있다. 자세한 동작과 적용 방식은 [[Python Lazy Imports - PEP 810]]에 정리돼 있다.
- **컴프리헨션 내 언패킹**(PEP 798): `*`·`**` 언패킹을 컴프리헨션과 제너레이터 식 안에서 쓸 수 있다. 중첩 루프를 풀어 쓸 수 있어 표현이 간결해진다.

```python
# 기존
y = [a for sub in lists for a in sub]
# 3.15
y = [*sub for sub in lists]
```

---
### 새 내장 타입

- **frozendict**(PEP 814): 불변 딕셔너리. 생성 후 추가·삭제·변경이 불가능하고, 키와 값이 모두 해시 가능하면 자신도 해시 가능해 다른 딕셔너리의 키로 쓸 수 있다. 삽입 순서는 보존하지만 비교는 순서를 따지지 않는다.
- **sentinel**(PEP 661): 고유한 sentinel 값을 만드는 타입. `None`을 유효한 값으로 써야 해서 `object()`로 빈 표식을 만들던 관행을 대체한다. 복사해도 identity가 유지되고 타입 식에서 `|`로 쓸 수 있다. 모듈·이름으로 import 가능하면 pickle도 된다.

---
### 성능과 도구

- **JIT 개선**: 3.13에 도입된 JIT이 x86-64 Linux 기준 8~9%, AArch64 macOS 기준 12~13%의 성능 향상을 보인다.
- **샘플링 프로파일러**: `profiling.sampling` 모듈로 통계 샘플링 기반 프로파일링이 추가됐다. 모든 호출을 추적해 정확하지만 느린 `cProfile`(이제 `profiling.tracing`으로 개명)보다 오버헤드가 훨씬 작다.
- **Incremental GC 철회**: 3.14에 들어갔던 incremental GC가 메모리 사용량을 키운다는 보고로 철회됐다. 3.13 이전의 generational GC로 되돌아갔고, 개선 후 재도입이 예정돼 있다.

---
### 타입과 기타

- **TypedDict 확장**: 지정한 키만 허용하는 `closed` 인자와, 추가 키를 허용하되 타입을 지정하는 `extra_items` 인자가 추가됐다.
- **TypeForm**: 타입 자체를 값으로 다루는 자리에 타입 표현을 쓸 수 있게 한다. 타입 관련 변경은 [[Python typing]] 참고.
- **에러 메시지 개선**: `AttributeError` 제안 범위가 넓어졌고, 다른 언어의 흔한 메서드명도 참고해 제안한다(예: `list.push()` 호출 시 `.append()`를 제안).
