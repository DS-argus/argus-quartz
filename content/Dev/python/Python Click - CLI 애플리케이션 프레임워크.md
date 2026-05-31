---
tags:
  - python
  - CLI
created: 2026-05-21T00:00:00
updated: 2026-05-21T00:00:00
permalink: /Dev/python/python-click
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - Click은 Python CLI 애플리케이션을 빠르게 만들 수 있는 데코레이터 기반 프레임워크 (Pallets 프로젝트)
> - `@click.command`, `@click.option`, `@click.argument` 데코레이터로 선언형 CLI 구성
> - `@click.group`으로 서브커맨드를 구성하고, Context 객체로 상태를 전달
> - Typer는 Click 위에 구축된 모던 대안으로, type hint 기반 선언이 특징

> [!cite]+ Source
> - [Click 공식 문서](https://click.palletsprojects.com/)
> - [Click GitHub](https://github.com/pallets/click)
> - [Real Python — Click Guide](https://realpython.com/python-click/)

---

### 1. Click이 뭔가

Click(Command Line Interface Creation Kit)은 Python CLI 도구를 만드는 프레임워크다. Flask를 만든 Pallets 프로젝트에서 개발하고 있다.

Python 표준 라이브러리의 `argparse`도 CLI를 만들 수 있지만, Click은 데코레이터 기반으로 더 적은 코드와 직관적인 구조를 제공한다.

```bash
pip install click
```

```python
import click

@click.command()
@click.option('--name', '-n', required=True, help='이름')
@click.option('--count', '-c', default=1, help='반복 횟수')
def hello(name, count):
    """인사를 출력하는 CLI"""
    for _ in range(count):
        click.echo(f"Hello {name}!")

if __name__ == '__main__':
    hello()
```

```bash
$ python hello.py --name World --count 3
Hello World!
Hello World!
Hello World!

$ python hello.py --help
Usage: hello.py [OPTIONS]

  인사를 출력하는 CLI

Options:
  -n, --name TEXT  이름  [required]
  -c, --count INTEGER  반복 횟수
  --help           Show this message and exit.
```

도움말이 자동 생성되고, 타입 검증도 자동으로 처리된다.

---

### 2. 핵심 개념

#### 2-1. Command와 Parameter

Click의 기본 단위는 **Command**다. 함수에 `@click.command()` 데코레이터를 붙이면 CLI 명령이 된다.

파라미터는 두 종류로 나뉜다.

| 종류 | 선언 | 특징 |
| --- | --- | --- |
| **Option** | `@click.option('--name')` | `--name value` 형태. 순서 무관, 기본값 가능 |
| **Argument** | `@click.argument('filename')` | 위치 기반. `--` 접두사 없음, 순서 중요 |

```python
@click.command()
@click.argument('src', type=click.Path(exists=True))
@click.argument('dst', type=click.Path())
@click.option('--overwrite', is_flag=True, help='기존 파일 덮어쓰기')
def copy(src, dst, overwrite):
    """SRC 파일을 DST로 복사"""
    click.echo(f"Copying {src} -> {dst} (overwrite={overwrite})")
```

```bash
$ python cli.py source.txt dest.txt --overwrite
```

#### 2-2. 타입 시스템

Click은 파라미터에 다양한 타입을 지정할 수 있다.

```python
# 기본 타입
@click.option('--count', type=int)
@click.option('--rate', type=float)

# 선택지 제한
@click.option('--env', type=click.Choice(['dev', 'staging', 'prod']))

# 범위 제한
@click.option('--port', type=click.IntRange(1024, 65535))

# 파일 자동 open
@click.option('--output', type=click.File('w'))

# 경로 검증
@click.option('--config', type=click.Path(exists=True, dir_okay=False))
```

#### 2-3. Group (서브커맨드)

`@click.group()`으로 여러 커맨드를 하나의 CLI에 묶을 수 있다. `git`이나 `docker` 같은 서브커맨드 구조를 만드는 방법이다.

```python
@click.group()
@click.option('--verbose', '-v', is_flag=True)
@click.pass_context
def cli(ctx, verbose):
    """파일 관리 CLI"""
    ctx.ensure_object(dict)
    ctx.obj['VERBOSE'] = verbose

@cli.command()
@click.argument('filename')
@click.pass_context
def create(ctx, filename):
    """새 파일 생성"""
    if ctx.obj['VERBOSE']:
        click.echo(f"Creating {filename}...")
    open(filename, 'w').close()
    click.echo(f"Created: {filename}")

@cli.command()
@click.argument('filename')
def delete(filename):
    """파일 삭제"""
    import os
    os.remove(filename)
    click.echo(f"Deleted: {filename}")
```

```bash
$ python cli.py --verbose create test.txt
Creating test.txt...
Created: test.txt

$ python cli.py delete test.txt
Deleted: test.txt
```

#### 2-4. Context (상태 전달)

`@click.pass_context`를 사용하면 그룹에서 설정한 값을 하위 커맨드로 전달할 수 있다. `ctx.obj`에 딕셔너리를 넣어서 공유 데이터를 관리하는 패턴이 일반적이다.

---

### 3. 유틸리티 함수

Click은 CLI 개발에 유용한 함수를 여러 개 제공한다.

| 함수 | 용도 |
| --- | --- |
| `click.echo(msg)` | `print` 대체. 파이프, 유니코드, 색상 안전 |
| `click.style(text, fg='green', bold=True)` | ANSI 색상/스타일 적용 |
| `click.prompt('값 입력', type=int)` | 사용자 입력 프롬프트 |
| `click.confirm('계속?')` | yes/no 확인 |
| `click.progressbar(iterable)` | 진행률 표시 |
| `click.edit(text)` | 외부 에디터 호출 |
| `click.launch(url)` | 브라우저/앱 열기 |

```python
# 색상 출력
click.echo(click.style("SUCCESS", fg="green", bold=True))
click.echo(click.style("ERROR", fg="red"))

# 진행률 표시
with click.progressbar(range(1000)) as bar:
    for item in bar:
        process(item)
```

---

### 4. 테스트

Click은 `CliRunner`를 내장하고 있어서 CLI를 코드에서 테스트할 수 있다.

```python
from click.testing import CliRunner

def test_hello():
    runner = CliRunner()
    result = runner.invoke(hello, ['--name', 'World'])
    assert result.exit_code == 0
    assert 'Hello World!' in result.output

# stdin 시뮬레이션
result = runner.invoke(prompt_cmd, input='yes\n')

# 격리된 파일시스템에서 테스트
with runner.isolated_filesystem():
    with open('test.txt', 'w') as f:
        f.write('test data')
    result = runner.invoke(cat_cmd, ['test.txt'])
    assert result.exit_code == 0
```

---

### 5. Click vs Typer

[Typer](https://typer.tiangolo.com/)는 Click 위에 구축된 모던 CLI 프레임워크다. FastAPI를 만든 Sebastian Ramirez가 개발했다. Flask와 FastAPI의 관계처럼, Click과 Typer도 같은 구도다.

| 항목 | Click | Typer |
| --- | --- | --- |
| 기반 | 독립 라이브러리 | Click 위에 구축 |
| 파라미터 선언 | `@click.option()` 데코레이터 | 함수 파라미터 **type hint** |
| 에디터 자동완성 | 제한적 | 우수 (표준 함수 시그니처) |
| Shell 자동완성 | 별도 설정 | 내장 |
| 설계 시기 | Python 2.x 시대 | 모던 Python (3.6+ type hint) |

같은 CLI를 두 방식으로 비교하면 다음과 같다.

```python
# Click 방식
@click.command()
@click.option('--name', required=True, help='Who to greet')
@click.option('--count', default=1, help='Number of greetings')
def hello(name, count):
    for _ in range(count):
        click.echo(f"Hello {name}!")
```

```python
# Typer 방식
import typer

def hello(name: str, count: int = 1):
    for _ in range(count):
        typer.echo(f"Hello {name}!")

typer.run(hello)
```

Typer가 더 간결하지만, 복잡한 그룹 구조나 커스텀 타입, 파이프라인 체이닝이 필요하면 결국 Click의 하위 레이어를 직접 다뤄야 한다. 복잡한 프로덕션 CLI라면 처음부터 Click을 쓰는 것이 낫고, 간단~중간 복잡도라면 Typer가 개발 속도에서 유리하다.

---

### 6. Click vs argparse

| 항목 | argparse | Click |
| --- | --- | --- |
| 제공 | Python 표준 라이브러리 | 서드파티 (`pip install click`) |
| 선언 방식 | `parser.add_argument()` 메서드 체인 | `@click.option()` 데코레이터 |
| 서브커맨드 | `add_subparsers()` (번거로움) | `@click.group()` (직관적) |
| 도움말 | 자동 생성 | 자동 생성 + 더 보기 좋음 |
| 테스트 | 직접 구현 | `CliRunner` 내장 |
| 외부 의존성 | 없음 | `pip install` 필요 |

외부 의존성을 추가할 수 없는 환경이면 argparse, 그 외에는 Click이나 Typer가 개발 경험에서 유리하다.

---

### 7. 참고 자료

- [Click 공식 문서](https://click.palletsprojects.com/)
- [Click GitHub](https://github.com/pallets/click)
- [Typer 공식 문서](https://typer.tiangolo.com/)
- [Real Python — Build CLI Apps with Click](https://realpython.com/python-click/)
