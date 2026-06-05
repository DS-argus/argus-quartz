---
tags:
  - python
  - database
created: 2026-06-04T00:00:00
updated: 2026-06-04T00:00:00
permalink: /Dev/python/python-alembic-database-migration-tool-for-sqlalchemy
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Alembic은 SQLAlchemy 전용 DB 마이그레이션 도구
> - 모델 변경 사항을 자동 감지해서 마이그레이션 스크립트 생성 가능
> - `upgrade`/`downgrade`로 스키마 버전 관리 및 롤백 지원
> - FastAPI + SQLAlchemy 조합에서 사실상 표준

> [!info]+ Alembic?
> - SQLAlchemy 프로젝트의 DB 스키마를 버전 관리하는 마이그레이션 도구
> - Django의 `makemigrations`/`migrate`와 같은 역할
> - SQLAlchemy 제작자(Mike Bayer)가 직접 개발
> - https://alembic.sqlalchemy.org/

---
### 1. 왜 필요한가

DB 스키마는 개발 과정에서 계속 바뀐다. 테이블 추가, 컬럼 변경, 인덱스 생성 등의 변경을 수동으로 SQL을 실행해서 관리하면 다음 문제가 생긴다.

- 팀원 간 스키마 불일치
- 어떤 변경이 언제 적용되었는지 추적 불가
- 롤백이 어려움
- 로컬/스테이징/프로덕션 환경 간 스키마 차이

Alembic은 이런 변경을 Python 스크립트로 관리하고, git처럼 버전을 추적한다.

---
### 2. 설치

```bash
pip install alembic
```

SQLAlchemy가 함께 설치된다. uv를 사용하는 경우:

```bash
uv add alembic
```

---
### 3. 프로젝트 초기화

프로젝트 루트에서 `alembic init` 명령으로 초기화한다.

```bash
alembic init alembic
```

아래와 같은 구조가 생성된다.

```
project/
├── alembic.ini            # 설정 파일 (DB 연결 정보 등)
├── alembic/
│   ├── env.py             # 마이그레이션 실행 환경 설정
│   ├── script.py.mako     # 마이그레이션 파일 템플릿
│   └── versions/          # 마이그레이션 파일 저장 디렉토리
└── models.py              # SQLAlchemy 모델 (직접 작성)
```

##### alembic.ini 설정

DB 연결 문자열을 설정한다.

```ini
# alembic.ini
sqlalchemy.url = postgresql://user:password@localhost/mydb
```

> [!tip]+ 환경변수 사용
> DB 비밀번호를 ini 파일에 직접 넣지 말고, `env.py`에서 환경변수로 주입하는 것을 권장한다.
> ```python
> # env.py
> import os
> config.set_main_option(
>     "sqlalchemy.url",
>     os.environ["DATABASE_URL"]
> )
> ```

---
### 4. 모델과 연동 (autogenerate 설정)

Alembic이 SQLAlchemy 모델 변경을 자동 감지하려면 `env.py`에서 모델의 `MetaData`를 연결해야 한다.

```python
# models.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id = mapped_column(Integer, primary_key=True)
    name = mapped_column(String(100), nullable=False)
    email = mapped_column(String(200), unique=True)
```

```python
# alembic/env.py
from models import Base

target_metadata = Base.metadata
```

이 설정이 끝나면 `--autogenerate` 옵션으로 모델과 DB의 차이를 자동 감지할 수 있다.

---
### 5. 마이그레이션 생성

##### 자동 생성 (autogenerate)

모델 코드와 실제 DB를 비교해서 차이점을 마이그레이션 스크립트로 만든다.

```bash
alembic revision --autogenerate -m "add users table"
```

##### 수동 생성

빈 마이그레이션 파일을 만들고 직접 내용을 작성한다.

```bash
alembic revision -m "add custom index"
```

##### 생성된 파일 예시

`versions/` 디렉토리에 아래와 같은 파일이 생성된다.

```python
"""add users table"""

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = None  # 첫 번째 마이그레이션이면 None

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(200), unique=True),
    )

def downgrade():
    op.drop_table('users')
```

- `upgrade()`: 스키마를 앞으로 적용하는 로직
- `downgrade()`: 롤백 로직
- `down_revision`: 이전 마이그레이션을 가리키는 포인터 (linked list 구조)

---
### 6. 마이그레이션 적용

```bash
# 최신 버전으로 적용
alembic upgrade head

# 특정 리비전으로 적용
alembic upgrade a1b2c3d4e5f6

# 한 단계만 적용
alembic upgrade +1
```

---
### 7. 롤백

```bash
# 한 단계 롤백
alembic downgrade -1

# 특정 리비전으로 롤백
alembic downgrade a1b2c3d4e5f6

# 모든 마이그레이션 롤백 (초기 상태로)
alembic downgrade base
```

---
### 8. 상태 확인

```bash
# 현재 적용된 리비전 확인
alembic current

# 전체 마이그레이션 히스토리
alembic history

# 상세 히스토리
alembic history --verbose
```

---
### 9. 자주 사용하는 op 함수

Alembic의 `op` 모듈이 제공하는 주요 스키마 변경 함수들이다.

```python
from alembic import op
import sqlalchemy as sa

# 테이블 생성/삭제
op.create_table('posts', sa.Column('id', sa.Integer, primary_key=True))
op.drop_table('posts')

# 컬럼 추가/삭제/변경
op.add_column('users', sa.Column('age', sa.Integer))
op.drop_column('users', 'age')
op.alter_column('users', 'name', type_=sa.String(200))

# 인덱스 생성/삭제
op.create_index('ix_users_email', 'users', ['email'])
op.drop_index('ix_users_email')

# 외래키 추가
op.create_foreign_key('fk_post_user', 'posts', 'users', ['user_id'], ['id'])

# 순수 SQL 실행
op.execute("UPDATE users SET active = true")
```

---
### 10. autogenerate가 감지하지 못하는 것

> [!note]+ 주의
> autogenerate는 만능이 아니다. 아래 항목은 직접 마이그레이션을 작성해야 한다.
> - 테이블/컬럼 이름 변경 (삭제 + 생성으로 인식)
> - 데이터 마이그레이션 (기존 데이터 변환)
> - DB 특화 기능 (파티션, 트리거, 스토어드 프로시저 등)
> - `CHECK` 제약 조건 변경

---
### 11. 실무 팁

##### 마이그레이션 파일은 반드시 커밋한다

`versions/` 디렉토리의 파일은 git에 포함해야 한다. 팀원들이 같은 마이그레이션을 순서대로 적용할 수 있어야 하기 때문이다.

##### 프로덕션 적용 전 확인

```bash
# SQL만 출력하고 실제 적용하지 않음
alembic upgrade head --sql
```

생성된 SQL을 리뷰한 뒤 적용하면 안전하다.

##### 브랜치 충돌 해결

여러 팀원이 동시에 마이그레이션을 만들면 `down_revision`이 충돌할 수 있다. 이 경우 `merge`로 해결한다.

```bash
alembic merge -m "merge migrations" revision1 revision2
```
