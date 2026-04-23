---
tags:
  - neovim
  - terminal
  - lsp
created: 2026-04-22T00:00:00
updated: 2026-04-22T00:00:00
permalink: /Logs/neovim-0-12-release-notes
---
> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

> [!abstract]+ TL;DR
> Neovim 0.12(2026-03-29)는 네이티브 플러그인 매니저 `vim.pack`, 빌트인 자동완성, LSP 대폭 개선, UI2 실험 기능 등을 포함한 대형 릴리즈다. 서드파티 플러그인 매니저 없이도 기본 설정이 가능해졌다.

> [!cite]+ Source
> - [Neovim 0.12 Is Game Changing + How To VimPack - Seth Phaeno](https://youtu.be/h1sCwi0pNyM)
> - [What's New in Neovim 0.12 - .dotfiles](https://dotfiles.substack.com/p/whats-new-in-neovim-012)
> - [A Guide to vim.pack - Evgeni Chasnovski](https://echasnovski.com/blog/2026-03-13-a-guide-to-vim-pack)
> - [Neovim 0.12 Release Notes](https://neovim.io/doc/user/news-0.12/)

---

### 1. vim.pack - native plugin manager

0.12의 가장 큰 변화다. lazy.nvim이나 packer.nvim 같은 서드파티 플러그인 매니저 없이, Neovim 자체에서 플러그인을 설치/업데이트/삭제할 수 있다. 실험(experimental) 상태이며 Git 저장소만 지원한다.

#### 기본 사용법

```lua
vim.pack.add({
  'https://github.com/nvim-mini/mini.nvim',
  { src = 'https://github.com/neovim/nvim-lspconfig', version = 'v2.0.0' },
  { src = 'https://github.com/user/repo', name = 'custom-name', version = vim.version.range('2.x') },
})
```

- 처음 설치 시 확인 다이얼로그가 뜬다 (`y`/`n`/`a`)
- 플러그인은 `~/.local/share/nvim/site/pack/core/opt/`에 병렬로 설치된다

#### Version pinning

```lua
version = vim.version.range('*')    -- 최신 semver 태그
version = vim.version.range('2.x')  -- >=2.0.0 <3.0.0
version = 'main'                     -- 브랜치
version = 'stable'                   -- 태그
```

#### Update와 delete

```lua
vim.pack.update()                              -- 전체 업데이트
vim.pack.update({ 'mini.nvim' })              -- 특정 플러그인만
vim.pack.update(nil, { target = 'lockfile' }) -- lockfile 상태로 복원
vim.pack.del({ 'mini.nvim' })                 -- 삭제
```

업데이트 시 변경 내역을 보여주는 확인 버퍼가 열리고, LSP 기반 네비게이션(`]]`/`[[`)과 hover로 changelog를 확인할 수 있다.

#### Lockfile

`~/.config/nvim/nvim-pack-lock.json`에 설치된 플러그인 상태가 기록된다. 새 머신에서 이 파일만 있으면 동일 환경을 재현할 수 있으니 버전 관리에 포함하는 것을 권장한다.

#### Lazy loading 패턴

```lua
-- 시작 후 지연 로드
vim.schedule(function() vim.pack.add({...}) end)

-- 특정 이벤트에서 로드
vim.api.nvim_create_autocmd('InsertEnter', { once = true, callback = function()
  vim.pack.add({ 'https://github.com/plugin/repo' })
  require('plugin').setup()
end })
```

#### Events

`PackChangedPre`, `PackChanged` 이벤트로 설치/업데이트/삭제 시점에 후처리가 가능하다. `vim.pack.add()` 호출 전에 autocommand를 등록해야 한다.

---

### 2. Built-in LSP improvements

LSP 클라이언트가 대폭 강화되었다. nvim-lspconfig 없이도 기본 LSP 설정이 가능해졌다.

#### Native LSP config 패턴

```lua
vim.lsp.config['lua_ls'] = {
  cmd = { 'lua-language-server' },
  filetypes = { 'lua' },
  root_markers = { { '.luarc.json', '.luarc.jsonc' }, '.git' },
}
vim.lsp.enable('lua_ls')
```

#### Default keybindings

| 키 | 기능 |
|---|---|
| `gra` | Code actions |
| `gri` | Implementations |
| `grn` | Rename |
| `grr` | References |
| `grt` | Type definition |
| `grx` | Run codelens |
| `gO` | Document symbols |
| `Ctrl-S` (insert) | Signature help |
| `gx` | Document link |

#### 새로 지원하는 LSP capability

- `textDocument/selectionRange` - 점진적 선택 확장
- `textDocument/inlineCompletion` - 인라인 자동완성
- `textDocument/linkedEditingRange` - 연결 편집 (HTML 태그 등)
- `textDocument/documentLink` - 문서 내 링크 탐색
- `textDocument/onTypeFormatting` - 타이핑 시 자동 포맷
- `textDocument/semanticTokens/range` - 뷰포트 영역만 요청 (성능 개선)
- `textDocument/codeLens` - 가상 줄(virtual line)로 표시
- `textDocument/documentColor` - 색상 미리보기
- `workspace/diagnostic` - 워크스페이스 진단

#### 기타 LSP 변경

- `:lsp` 명령 추가 (LspInfo/LspRestart/LspLog 대체)
- `vim.lsp.status()` - 진행 상태 텍스트 반환
- `vim.lsp.is_enabled()`, `vim.lsp.get_configs()`
- `:checkhealth vim.lsp` - 버퍼 attachment 확인

---

### 3. Native auto-completion

빌트인 LSP 자동완성이 추가되었다. 외부 자동완성 플러그인(nvim-cmp 등) 없이도 동작한다.

```lua
vim.o.autocomplete = true
```

이것만으로 Insert 모드에서 LSP 기반 자동완성이 활성화된다.

#### 관련 옵션

```lua
vim.o.pumborder = 'rounded'     -- 팝업 메뉴 테두리
vim.o.pummaxwidth = 40          -- 팝업 최대 너비
vim.o.completeopt = 'menu,menuone,noselect,nearest'  -- nearest: 커서 근접 기준 정렬
```

`'complete'` 옵션에 새 플래그가 추가되었다.

- `F{func}` - 지정한 완성 함수 사용
- `o` - omnifunc 사용
- 소스별 매치 제한: `vim.o.complete = ".^5,t^3,w"` (`.`에서 최대 5개 등)

`'smartcase'`가 완성 필터링에도 적용된다.

---

### 4. UI2 (experimental)

메시지와 커맨드라인 UI를 재설계한 실험 기능이다.

```lua
require('vim._core.ui2').enable()
```

- "Press ENTER" 중단이 줄어든다
- 커맨드라인 입력 중 하이라이팅 적용
- 메시지 대상(cmd/msg/pager/dialog)별 높이와 타임아웃 커스터마이징 가능

---

### 5. New commands

| 명령 | 설명 |
|---|---|
| `:restart` | Neovim 재시작 (UI 재연결) |
| `:connect {addr}` | 외부 UI 동적 연결 |
| `:iput` | 들여쓰기 보정된 put |
| `:retab -indentonly` | 선행 공백만 retab |
| `:uniq` | 버퍼 중복 줄 제거 |
| `:wall ++p` | 없는 부모 디렉토리 자동 생성 후 저장 |
| `:help!` | DWIM 방식 도움말 |

---

### 6. Built-in plugins

별도 설치 없이 `:packadd`로 사용할 수 있는 빌트인 플러그인이 추가되었다.

```vim
:packadd nvim.undotree   " → :Undotree (시각적 undo 트리)
:packadd nvim.difftool   " → :DiffTool (디렉토리/파일 비교)
:packadd nvim.tohtml     " → :TOhtml (HTML 내보내기, 이전 버전에서 자동 로드 → opt-in으로 변경)
```

---

### 7. New Lua APIs

- `vim.net.request(url)` - HTTP 요청
- `vim.fs.ext(path)` - 파일 확장자 추출
- `vim.list.unique(list)` - 리스트 중복 제거
- `vim.list.bisect(list, value)` - 이진 탐색
- `vim.json.encode()` - `indent`, `sort_keys` 옵션 추가
- `vim.json.decode()` - `skip_comments` 옵션 추가
- `vim.pos`, `vim.range` (experimental) - Position/Range 추상화
- `Iter:take()`, `Iter:skip()` - predicate 지원
- `Iter:peek()` - 모든 타입에서 동작
- `Iter:unique()`

---

### 8. Treesitter changes

- 비주얼 모드 노드 선택: `an` (상위), `in` (하위), `]n` (다음 형제), `[n` (이전 형제)
- Markdown 하이라이팅 기본 활성화
- `:EditQuery` 탭 완성, 주입 언어 지원

> [!info]+ nvim-treesitter 아카이브와의 관계
> 0.12가 Tree-sitter 관련 기능을 내장하면서 nvim-treesitter 플러그인의 역할이 줄었다. 메인테이너가 0.12 필수로 리라이트를 진행하다 커뮤니티 갈등으로 아카이브된 사건이 있다. 자세한 내용은 [[nvim-treesitter 아카이브 사건]] 참조.

---

### 9. Terminal improvements

- 동기화 출력(synchronized output) 지원
- `'scrollback'` 최대값 1,000,000으로 증가
- 프로세스 종료 시 exit 정보를 virtual text + statusline에 표시
- 일시 중지된 PTY에 `[Process suspended]` 표시, 키 입력으로 재개

---

### 10. Default statusline

기본 상태줄에 진단 카운트, LSP 진행 상태, busy 상태 표시가 추가되었다. `vim.diagnostic.status()`, `vim.lsp.status()`, `vim.ui.progress_status()` 헬퍼로 커스터마이징 가능하다.

---

### 11. Performance

- LuaJIT 2.1 통합 - Lua 플러그인 15-20% 속도 향상, M2에서 시작 시간 30% 감소
- `vim.glob.to_lpeg()` ~50% 속도 개선
- LSP semantic tokens - 뷰포트 영역만 요청하여 대용량 파일 성능 개선

---

### 12. Breaking changes

주의가 필요한 호환성 변경 사항을 정리한다.

- `vim.diff` → `vim.text.diff`로 이동
- `vim.treesitter.get_parser()` - 실패 시 에러 대신 `nil` 반환
- 진단 sign 등록 방식 변경 - `:sign-define` 대신 `vim.diagnostic.config()` 사용
- `tohtml` 플러그인 opt-in으로 변경
- LSP JSON `null` → `vim.NIL` 반환 (기존 `nil` 아님)
- `vim.lsp.semantic_tokens` - `start()`/`stop()` → `enable()`으로 변경
- Python 3.7/3.8 지원 중단
