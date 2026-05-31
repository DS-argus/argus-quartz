---
tags:
  - python
  - performance
created: 2026-05-23T00:00:00
updated: 2026-05-23T00:00:00
permalink: /dev/python/python-lazy-imports-pep-810
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Python 3.15(PEP 810)부터 `lazy` 키워드로 명시적 지연 import 가능
> - 용도 3가지: 시작 시간 최적화, 타입 어노테이션 전용 import, 순환 import 해결
> - 주의: lazy import는 import 시점에 유효성 검사를 하지 않아 런타임 에러 위험

> [!cite]+ Source
> - [python lazy imports (PEP 810) — anthonywritescode](https://youtube.com/watch?v=xnZ90CYYF-0)

---

### 1. lazy import란

Python 3.15에 도입되는 `lazy` 키워드를 import 앞에 붙이면, 해당 모듈을 즉시 로드하지 않고 실제로 접근할 때까지 지연시킨다.

```python
# 기존 (eager) — import 시점에 즉시 로드
from json import loads

# 새로운 (lazy) — 실제로 loads를 사용할 때 로드
lazy from json import loads
lazy import asyncio
```

모듈 import와 from import 모두 지원하지만, `from x import *` (star import)와 함수 내부 import에는 사용할 수 없다.

---

### 2. 왜 필요한가 — 3가지 용도

**1) 시작 시간 최적화**

CLI 도구에서 `--help`만 출력할 때도 무거운 모듈을 전부 로드하면 느려진다. lazy import로 실제 필요한 시점까지 지연하면 체감 시작 시간이 줄어든다.

`python -X importtime`이나 `import-time-waterfall` 같은 도구로 느린 import를 프로파일링한 뒤, 해당 모듈만 lazy로 전환하는 방식이 권장된다.

**2) 타입 어노테이션 전용 import**

타입 힌트에만 사용되는 모듈을 런타임에 로드할 필요가 없다. 기존에는 `TYPE_CHECKING` 가드를 썼지만, lazy import로 더 간결하게 해결 가능하다.

```python
# 기존 방식
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from heavy_module import SomeType

# lazy import 방식
lazy from heavy_module import SomeType
```

**3) 순환 import 해결**

모듈 A가 B를 import하고, B가 다시 A를 import하는 순환 의존 상황에서, 한쪽을 lazy로 바꾸면 순환이 깨진다.

---

### 3. 주의할 점

lazy import는 선언 시점에 모듈 존재 여부를 검증하지 않는다.

```python
lazy import some_nonexistent_module  # 에러 없이 통과
print(some_nonexistent_module)       # 이 시점에서야 ImportError 발생
```

오타나 누락된 의존성을 개발 단계에서 잡지 못하고 런타임(프로덕션)에서 터질 수 있다. 대응 방법은 다음과 같다.

- 테스트 커버리지 확보
- 타입 체커(mypy, pyright) 사용 — import 오류를 정적으로 감지
- 개발/프로덕션 환경의 의존성 일치 확인

---

### 4. 하위 호환성

Python 3.14 이하에서도 동작하도록 `__lazy_modules__` 변수를 설정하는 방법이 있다.

```python
__lazy_modules__ = True  # import 문 위에 배치
from json import loads   # 3.15에서는 lazy, 3.14 이하에서는 eager
```

import 정렬 도구가 이 변수를 코드로 인식해서 이후 import를 무시할 수 있다는 단점이 있다.

---

### 5. 참고 자료

- [PEP 810 — Lazy Imports](https://peps.python.org/pep-0810/)
- [PEP 690 — Lazy Imports (rejected, 전체 lazy 시도)](https://peps.python.org/pep-0690/)
- [import-time-waterfall](https://github.com/asottile/import-time-waterfall)
