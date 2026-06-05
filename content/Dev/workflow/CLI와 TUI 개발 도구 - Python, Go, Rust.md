---
tags:
  - CLI
  - terminal
  - backend
  - workflow
created: 2026-05-21T00:00:00
updated: 2026-05-21T00:00:00
permalink: /Dev/workflow/cli-tui-dev-tools
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> - CLI 프레임워크: Click/Typer(Python), Cobra(Go), Clap(Rust)
> - TUI 프레임워크: Textual(Python), Bubbletea(Go), Ratatui(Rust)
> - 빠른 프로토타이핑은 Python, 배포 편의성은 Go, 극한 성능은 Rust
> - Go의 Charm 생태계(Bubbletea + Lipgloss + Bubbles)가 TUI 개발 경험에서 가장 균형 잡힘

> [!cite]+ Source
> - [Go vs. Rust for TUI Development: Bubbletea and Ratatui](https://blog.tng.sh/2026/03/go-vs-rust-for-tui-development-deep.html)
> - [Go vs Rust CLI Tools: Performance and DX Guide 2026](https://techbytes.app/posts/go-vs-rust-cli-tools-performance-dx-guide-2026/)

---

### 1. CLI와 TUI의 차이

**CLI**(Command Line Interface)는 명령어와 옵션을 텍스트로 입력하고 결과를 받는 인터페이스다. `git`, `docker`, `kubectl` 같은 도구가 대표적이다.

**TUI**(Terminal User Interface)는 터미널 안에서 GUI처럼 동작하는 인터페이스다. 마우스/키보드로 상호작용하고, 레이아웃, 색상, 위젯 등을 갖는다. `btop`, `lazygit`, `yazi` 같은 도구가 대표적이다.

이 글에서는 Python, Go, Rust 세 언어의 CLI/TUI 개발 도구를 비교한다.

---

### 2. CLI 프레임워크

#### 2-1. Python — Click / Typer

**[[Python Click - CLI 애플리케이션 프레임워크|Click]]** 은 데코레이터 기반 CLI 프레임워크다. **Typer**는 Click 위에 구축되어 type hint로 파라미터를 선언한다.

```python
# Typer — type hint 기반 선언
import typer

app = typer.Typer()

@app.command()
def serve(host: str = "0.0.0.0", port: int = 8000):
    typer.echo(f"Serving on {host}:{port}")

app()
```

- 장점: 빠른 개발, 풍부한 Python 생태계 연동
- 단점: 배포 시 Python 런타임 필요, 시작 시간 느림

#### 2-2. Go — Cobra

[Cobra](https://github.com/spf13/cobra)는 Go의 사실상 표준 CLI 프레임워크다. Docker, Kubernetes(kubectl), GitHub CLI(gh), Hugo 등이 Cobra로 만들어졌다.

```go
// Cobra 기본 구조
var rootCmd = &cobra.Command{
    Use:   "app",
    Short: "A brief description",
    Run: func(cmd *cobra.Command, args []string) {
        fmt.Println("Hello from Cobra!")
    },
}

var serveCmd = &cobra.Command{
    Use:   "serve",
    Short: "Start the server",
    Run: func(cmd *cobra.Command, args []string) {
        port, _ := cmd.Flags().GetInt("port")
        fmt.Printf("Serving on port %d\n", port)
    },
}

func init() {
    serveCmd.Flags().IntP("port", "p", 8080, "port number")
    rootCmd.AddCommand(serveCmd)
}
```

- 장점: 싱글 바이너리 배포, 빠른 시작 시간, 자동 완성 생성, 거대한 레퍼런스(kubectl, docker, gh)
- 단점: Go 언어 학습 필요, 보일러플레이트가 많은 편

#### 2-3. Rust — Clap

[Clap](https://github.com/clap-rs/clap)은 Rust의 대표 CLI 파서다. derive 매크로로 선언형 정의를 지원한다.

```rust
use clap::Parser;

#[derive(Parser)]
#[command(name = "app", about = "A brief description")]
struct Cli {
    /// Server port
    #[arg(short, long, default_value_t = 8080)]
    port: u16,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
}

fn main() {
    let cli = Cli::parse();
    println!("Port: {}, Verbose: {}", cli.port, cli.verbose);
}
```

- 장점: 컴파일 타임 검증, 최고 성능, 싱글 바이너리
- 단점: 컴파일 시간, Rust 학습 곡선

---

### 3. TUI 프레임워크

#### 3-1. Python — Textual (+ Rich)

[Rich](https://github.com/Textualize/rich)는 터미널 출력을 꾸미는 라이브러리다 (테이블, 마크다운, 프로그레스 바, 구문 강조 등). [Textual](https://github.com/Textualize/textual)은 Rich 위에 구축된 TUI 프레임워크로, CSS와 유사한 스타일링과 위젯 시스템을 제공한다.

```python
from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, Static

class MyApp(App):
    CSS = """
    Screen { align: center middle; }
    Static { width: auto; }
    """

    def compose(self) -> ComposeResult:
        yield Header()
        yield Static("Hello, TUI!")
        yield Footer()

MyApp().run()
```

- GitHub Star: 36,000+
- 장점: CSS 기반 레이아웃, 웹 브라우저에서도 실행 가능, Python 생태계 활용
- 단점: 성능 (CPU 22%, 입력 지연 18ms — 벤치마크 기준)

#### 3-2. Go — Bubbletea (Charm 생태계)

[Bubbletea](https://github.com/charmbracelet/bubbletea)는 Go의 TUI 프레임워크로, Elm 아키텍처(Model-Update-View)를 채택했다. [Charm](https://charm.sh/) 생태계의 핵심이다.

```go
// Bubbletea — Elm 아키텍처 (Model-Update-View)
type model struct {
    choices  []string
    cursor   int
    selected map[int]struct{}
}

func (m model) Init() tea.Cmd { return nil }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        switch msg.String() {
        case "up":
            m.cursor--
        case "down":
            m.cursor++
        case "enter":
            m.selected[m.cursor] = struct{}{}
        case "q":
            return m, tea.Quit
        }
    }
    return m, nil
}

func (m model) View() string {
    s := "What to buy?\n\n"
    for i, choice := range m.choices {
        cursor := " "
        if m.cursor == i { cursor = ">" }
        s += fmt.Sprintf("%s %s\n", cursor, choice)
    }
    return s
}
```

Charm 생태계의 구성은 다음과 같다.

| 라이브러리 | 역할 |
| --- | --- |
| **Bubbletea** | TUI 프레임워크 (Elm 아키텍처) |
| **Bubbles** | 재사용 가능한 TUI 컴포넌트 (텍스트 입력, 스피너, 테이블 등) |
| **Lipgloss** | 터미널 스타일링 (색상, 여백, 테두리 등) |
| **Huh** | 인터랙티브 폼/프롬프트 |
| **Wish** | SSH 기반 TUI 앱 서빙 |

- 장점: 일관된 생태계, Elm 아키텍처로 상태 관리 명확, Go의 빠른 컴파일
- 단점: Elm 아키텍처가 익숙하지 않으면 초반 학습 필요, 유연성이 Ratatui보다 낮음

#### 3-3. Rust — Ratatui (+ Crossterm)

[Ratatui](https://github.com/ratatui/ratatui)는 Rust의 TUI 프레임워크다. 터미널 제어는 [Crossterm](https://github.com/crossterm-rs/crossterm)이 담당하고, Ratatui는 위에서 레이아웃과 위젯을 제공한다.

```rust
use ratatui::{
    layout::{Constraint, Layout},
    widgets::{Block, Borders, Paragraph},
    Frame,
};

fn ui(frame: &mut Frame) {
    let chunks = Layout::default()
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(frame.area());

    let block = Block::default().title("Top").borders(Borders::ALL);
    frame.render_widget(Paragraph::new("Hello!").block(block), chunks[0]);

    let block = Block::default().title("Bottom").borders(Borders::ALL);
    frame.render_widget(Paragraph::new("World!").block(block), chunks[1]);
}
```

Bubbletea와 달리 Ratatui는 이벤트 루프를 직접 작성해야 한다. 자유도가 높지만 보일러플레이트도 많다.

- 장점: 최고 성능 (CPU 2%, 입력 지연 1.2ms), 세밀한 제어, 메모리 효율
- 단점: Rust 학습 곡선, 이벤트 루프 직접 구현 필요

---

### 4. 성능 비교

5,000개 데이터 포인트를 가진 Prometheus 모니터링 대시보드 벤치마크 결과 (60 FPS 렌더링 기준):

| 항목 | Ratatui (Rust) | Bubbletea (Go) | Textual (Python) |
| --- | --- | --- | --- |
| CPU 사용률 | **2%** | 6~8% | 22% |
| 입력 지연 | **1.2ms** | 4.5ms | 18ms |
| GC 영향 | 없음 | 간헐적 스파이크 | GIL + GC |
| 바이너리 크기 | 작음 | 중간 | N/A (런타임 필요) |

---

### 5. 언제 어떤 걸 쓸까

| 상황 | 추천 |
| --- | --- |
| 빠른 프로토타이핑, 내부 도구 | **Python** (Click/Typer + Textual) |
| 배포 편의성, 실무 CLI 도구 | **Go** (Cobra + Bubbletea) |
| 극한 성능, 시스템 수준 도구 | **Rust** (Clap + Ratatui) |
| 기존 Python 프로젝트에 CLI 추가 | **Typer** |
| kubectl/docker 수준의 프로덕션 CLI | **Cobra** (Go) |
| 터미널 앱의 반응 속도가 중요 | **Ratatui** (Rust) |

> [!tip]+ 참고할 실제 프로젝트
> - **Go + Cobra**: kubectl, docker, gh (GitHub CLI), hugo
> - **Go + Bubbletea**: lazygit, soft-serve, glow
> - **Rust + Clap**: ripgrep, bat, fd, starship
> - **Rust + Ratatui**: gitui, bottom, spotify-tui
> - **Python + Textual**: [[터미널 세팅|trogon]], posting
> - **Python + Click**: Flask CLI, pip, aws-cli v1

---

### 6. 참고 자료

- [Click 공식 문서](https://click.palletsprojects.com/)
- [Typer 공식 문서](https://typer.tiangolo.com/)
- [Cobra GitHub](https://github.com/spf13/cobra)
- [Bubbletea GitHub](https://github.com/charmbracelet/bubbletea)
- [Charm 생태계](https://charm.sh/)
- [Clap GitHub](https://github.com/clap-rs/clap)
- [Ratatui GitHub](https://github.com/ratatui/ratatui)
- [Textual GitHub](https://github.com/Textualize/textual)
- [Rich GitHub](https://github.com/Textualize/rich)
