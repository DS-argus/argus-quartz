---
tags:
  - python
  - database
created: 2026-06-05T00:00:00
updated: 2026-06-05T00:00:00
permalink: /Dev/python/python-sqlalchemy-orm
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - SQLAlchemy는 Python의 사실상 표준 ORM
> - Core(SQL 표현식)와 ORM(객체 매핑) 두 레이어로 구성
> - 2.0 스타일에서 select() 기반 쿼리가 기본
> - Alembic으로 마이그레이션 관리

> [!info]+ SQLAlchemy?
> - Python에서 가장 널리 쓰이는 데이터베이스 툴킷 겸 ORM
> - 2006년 첫 릴리스, 현재 2.x 버전
> - PostgreSQL, MySQL, SQLite 등 주요 RDBMS 지원
> - https://www.sqlalchemy.org/


---
### 1. ORM이란

ORM(Object-Relational Mapping)은 **데이터베이스 테이블을 Python 클래스로 매핑**하는 기법이다. SQL을 직접 쓰지 않고 Python 코드로 데이터베이스를 다룰 수 있다.

```python
# SQL로 직접 작성
cursor.execute("SELECT * FROM users WHERE age > 20")

# ORM으로 작성
session.query(User).filter(User.age > 20).all()
```

> [!tip]+ ORM의 장단점
> - 장점: 데이터베이스 종류에 독립적, 코드 가독성 향상, SQL 인젝션 방지
> - 단점: 복잡한 쿼리에서 성능 오버헤드 가능, SQL 자체를 모르면 디버깅 어려움


---
### 2. Python ORM 선택지

| ORM | 특징 |
|---|---|
| **SQLAlchemy** | 독립형 표준. Flask, FastAPI 등 프레임워크 가리지 않고 사용 |
| **Django ORM** | Django 프레임워크 내장. Django 밖에서는 사용하기 불편함 |
| **SQLModel** | FastAPI 제작자(Sebastian Ramirez)가 만든 라이브러리. 내부적으로 SQLAlchemy + Pydantic 래퍼 |
| **Peewee** | 경량 ORM. 소규모 프로젝트에 적합 |
| **Tortoise ORM** | async 네이티브 ORM. asyncio 기반 프로젝트에서 사용 |

Django를 쓰면 Django ORM, 그 외에는 **SQLAlchemy가 기본 선택**이다. SQLModel도 결국 SQLAlchemy를 기반으로 동작하므로, SQLAlchemy를 이해하면 SQLModel도 자연스럽게 쓸 수 있다.


---
### 3. 설치

```bash
# SQLAlchemy만 설치
pip install sqlalchemy

# uv 사용 시
uv add sqlalchemy

# 데이터베이스 드라이버도 함께 설치 (PostgreSQL 예시)
pip install sqlalchemy psycopg2-binary

# 비동기 드라이버 (asyncio 사용 시)
pip install sqlalchemy asyncpg
```


---
### 4. 두 개의 레이어

SQLAlchemy는 **Core**와 **ORM** 두 계층으로 나뉜다.

```
┌─────────────────────┐
│       ORM           │  ← 클래스로 테이블 매핑, 세션 관리
├─────────────────────┤
│       Core          │  ← SQL 표현식, 엔진, 커넥션 풀
├─────────────────────┤
│      DBAPI          │  ← psycopg2, sqlite3 등 드라이버
└─────────────────────┘
```

- **Core**: SQL을 Python 표현식으로 작성하는 레이어. `select()`, `insert()` 같은 함수를 사용한다.
- **ORM**: Core 위에서 Python 클래스와 테이블을 매핑하는 레이어. 대부분 이 ORM 레이어를 사용한다.

두 레이어를 섞어 쓸 수 있다는 점이 SQLAlchemy의 강점이다. ORM이 불편한 복잡한 쿼리는 Core로 직접 작성할 수 있다.


---
### 5. 기본 사용법 (2.0 스타일)

SQLAlchemy 2.0부터 `select()` 기반 쿼리가 표준이다. 이전 1.x의 `session.query()` 방식도 동작하지만 새 프로젝트에서는 2.0 스타일을 권장한다.

##### 엔진 생성

```python
from sqlalchemy import create_engine

# SQLite
engine = create_engine("sqlite:///app.db")

# PostgreSQL
engine = create_engine("postgresql://user:password@localhost:5432/mydb")
```

##### 모델 정의

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    age: Mapped[int | None]  # nullable 컬럼
```

> [!note]+ 2.0의 타입 힌트 스타일
> `Mapped[int]`처럼 Python 타입 힌트로 컬럼 타입을 선언한다. 1.x의 `Column(Integer)` 방식보다 IDE 지원이 좋고 코드가 간결하다.

##### 테이블 생성

```python
Base.metadata.create_all(engine)
```

##### CRUD 기본

```python
from sqlalchemy.orm import Session
from sqlalchemy import select

# Create
with Session(engine) as session:
    user = User(name="홍길동", email="hong@example.com", age=30)
    session.add(user)
    session.commit()

# Read
with Session(engine) as session:
    stmt = select(User).where(User.age > 20)
    users = session.scalars(stmt).all()

# Update
with Session(engine) as session:
    stmt = select(User).where(User.name == "홍길동")
    user = session.scalars(stmt).first()
    user.age = 31
    session.commit()

# Delete
with Session(engine) as session:
    stmt = select(User).where(User.name == "홍길동")
    user = session.scalars(stmt).first()
    session.delete(user)
    session.commit()
```


---
### 6. 관계(Relationship) 설정

```python
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    author: Mapped["User"] = relationship(back_populates="posts")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))

    posts: Mapped[list["Post"]] = relationship(back_populates="author")
```

```python
# 사용 예시
with Session(engine) as session:
    user = session.scalars(select(User).where(User.name == "홍길동")).first()
    for post in user.posts:
        print(post.title)
```


---
### 7. Alembic으로 마이그레이션

Alembic은 SQLAlchemy의 공식 마이그레이션 도구다. 모델이 변경되면 Alembic이 DDL(ALTER TABLE 등)을 자동 생성한다.

```bash
# 설치
pip install alembic

# 초기화
alembic init alembic

# 마이그레이션 파일 자동 생성
alembic revision --autogenerate -m "add users table"

# 마이그레이션 적용
alembic upgrade head

# 롤백
alembic downgrade -1
```

> [!tip]+ autogenerate 주의사항
> - `--autogenerate`는 모델과 실제 DB 스키마를 비교해서 차이를 감지한다
> - 컬럼 이름 변경은 자동 감지가 안 됨 (삭제 + 생성으로 인식)
> - 생성된 마이그레이션 파일은 반드시 검토 후 적용할 것


---
### 8. 자주 쓰는 쿼리 패턴

```python
from sqlalchemy import select, func, or_, desc

# 여러 조건 (AND)
stmt = select(User).where(User.age > 20, User.name.like("%홍%"))

# OR 조건
stmt = select(User).where(or_(User.age > 30, User.name == "홍길동"))

# 정렬
stmt = select(User).order_by(desc(User.age))

# 페이지네이션
stmt = select(User).offset(10).limit(20)

# 집계
stmt = select(func.count()).select_from(User)
count = session.scalar(stmt)

# JOIN
stmt = select(User, Post).join(Post, User.id == Post.user_id)
```
