---
tags:
  - Rust
  - Cargo
created: 2026-10-02T13:25:38
updated: 2026-10-02T18:32:46
permalink: /Dev/rust/rust-project-structure
---

> [!abstract]+ TL;DR
> - module은 코드의 이름·공개 범위, crate는 컴파일 단위, package는 Cargo 설정·의존성 관리 단위의 구분
> - 파일 분리 후 주문·견적 두 binary가 같은 library의 가격 계산 API를 사용하는 확장 예제
> - 여러 package를 함께 개발할 때 빌드·테스트와 기본 lockfile·빌드 디렉터리를 공유하는 workspace의 역할

> *AI-assisted*

### 1. 함수 하나로 시작하는 package와 crate

가격을 계산하고 출력하는 CLI를 만든다고 하자. 처음에는 함수 하나와 `main()`이면 충분하다.

```bash
cargo new shop --vcs none
cd shop
```

`src/main.rs`의 내용을 다음으로 바꾼다.

```rust
fn total(unit_price: u32, quantity: u32) -> u32 {
    unit_price * quantity
}

fn main() {
    println!("{}", total(1000, 3)); // 3000
}
```

```bash
cargo run
```

프로젝트의 주요 파일은 다음과 같다. 이후 4절까지는 이 `shop` 디렉터리 안에서 코드를 수정하고 명령을 실행한다.

```text
shop/
├── Cargo.toml
└── src/
    └── main.rs
```

- **package**: `Cargo.toml`로 이름, 버전, 의존성과 빌드 대상을 관리하는 Cargo 단위. 이 package의 이름은 `shop`이다.
- **crate**: Rust 컴파일러가 하나의 단위로 처리하는 코드. 여기서는 실행 파일을 만드는 binary crate 하나가 있다.
- **crate root**: 컴파일러가 읽기 시작하는 파일. 기본 Cargo 구조에서는 `src/main.rs`가 binary crate의 root다.
- **module**: crate 안에서 관련 코드를 묶고 이름과 공개 범위를 나누는 단위. 현재 함수는 crate의 루트 module에 있다.

[Rust Book 7장](https://doc.rust-kr.org/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html)은 코드가 늘어날 때 이 구조를 어떻게 나누는지 설명한다.\
[Package와 crate](https://doc.rust-kr.org/ch07-01-packages-and-crates.html)는 각각 Cargo의 관리 단위와 컴파일 단위이므로 같은 프로젝트를 설명해도 가리키는 범위가 다르다.

> [!note]+ Cargo의 기본 규칙: root 파일과 crate 종류
> - **Binary crate**: `src/main.rs`에서 시작해 실행 프로그램을 만든다.
> - **Library crate**: `src/lib.rs`에서 시작해 다른 crate가 사용하는 기능을 제공한다.
> - **Package 구성**: library crate는 최대 하나, binary crate는 여러 개를 포함. 추가 binary는 보통 `src/bin/이름.rs`에 둔다.
> - **파일 수**: crate 하나에 여러 module과 `.rs` 파일이 포함. 파일 개수와 crate 개수는 별개다.

> [!note]+ Python 비교: 프로젝트 관리와 코드의 사용 역할
> - **Package 관리**: Rust의 `Cargo.toml`은 Python의 `pyproject.toml`에 대응하며 이름·버전·의존성을 관리한다.
> - **Import 단위**: Python에서 `import shop`으로 사용하는 package의 이름 공간은 Rust의 module 과 유사.
> - **사용 역할**: Python의 CLI 진입점은 Rust의 binary 역할에, import해서 쓰는 라이브러리는 Rust의 library 역할에  가깝다.

---

### 2. 배송비 계산을 추가하면서 module로 묶는다

계산에 배송비 규칙을 추가한다. 상품 합계가 5,000 미만이면 배송비 300을 붙이고 그 이상이면 배송비를 받지 않는다.

CLI는 최종 금액만 필요하므로 배송비 계산 함수는 내부에 둔다. [`mod`](https://doc.rust-kr.org/ch07-02-defining-modules-to-control-scope-and-privacy.html)로 가격 계산을 묶어 `src/main.rs`를 다음과 같이 바꾼다.

```rust
mod pricing {
    pub fn total(unit_price: u32, quantity: u32) -> u32 {
        let subtotal = unit_price * quantity;
        subtotal + shipping_fee(subtotal)
    }

    fn shipping_fee(subtotal: u32) -> u32 {
        if subtotal < 5000 { 300 } else { 0 }
    }
}

fn main() {
    println!("{}", pricing::total(1000, 3)); // 3300
}
```

- **이름 구분**: `pricing::total`은 가격 계산 module 안의 함수다. 다른 module에도 `total`이라는 이름을 쓸 수 있다.
- **공개 기능**: `pub fn total`은 module 밖의 `main()`에서 호출한다.
- **내부 구현**: `shipping_fee`는 공개하지 않았다. `main()`에서 직접 호출하려 하면 컴파일 오류가 난다.

배송비 계산 방법을 바꿔도 호출자는 최종 금액을 구하는 `total()`만 사용한다.

> [!note]+ 공개 범위: pub는 어느 경계까지 허용하는가
> - **기본 범위**: 공개하지 않은 항목은 정의한 module과 그 하위 module에서 사용한다.
> - **`pub`**: 항목을 공개. 외부에서 접근하려면 그 항목까지의 경로도 접근 가능해야 한다.
> - **Crate 내부 공개**: `pub(crate)`는 같은 crate 안에서 사용하도록 범위를 제한한다.
> - **검사 대상**: [경로와 공개 범위](https://doc.rust-kr.org/ch07-03-paths-for-referring-to-an-item-in-the-module-tree.html)는 컴파일러가 검사. 호출할 수 없는 내부 기능에 의존하는 코드는 컴파일되지 않는다.

> [!note]+ Python 비교: 함수 모음과 공개 범위
> - **함수 모음**: Rust의 `pricing` module은 Python의 `pricing.py`처럼 가격 관련 함수를 모은다. Python에서 `pricing.total`로 소속을 나타내듯 Rust에서는 `pricing::total`로 나타낸다.
> - **파일 배치**: Rust는 같은 파일의 `mod pricing { ... }` 또는 별도 `pricing.rs`에 module을 정의한다. Python의 일반적인 `.py` module은 파일 자체로 정의한다.
> - **내부용 관례**: Python의 `_shipping_fee`는 내부용이라는 관례이며 직접 import하는 것도 가능하다. Rust의 비공개 함수는 부모 module에서 호출하면 컴파일 오류다.
> - **`__all__`**: Python은 주로 `from module import *`에 포함할 이름을 정할 때 사용한다. Rust의 `pub`처럼 직접 접근을 제한하는 기능은 아니다.

---

### 3. 파일을 나눠도 crate는 하나다

가격 계산이 길어지면 `main.rs`에서 별도 파일로 옮긴다. 같은 module의 코드를 다른 파일에 보관하는 변화다.

```text
shop/
├── Cargo.toml
└── src/
    ├── main.rs
    └── pricing.rs
```

`src/main.rs`를 다음으로 바꾼다.

```rust
mod pricing;

use crate::pricing::total;

fn main() {
    println!("{}", total(1000, 3)); // 3300
}
```

`src/pricing.rs`에는 이전 `mod pricing { ... }` 안의 내용을 넣는다.

```rust
pub fn total(unit_price: u32, quantity: u32) -> u32 {
    let subtotal = unit_price * quantity;
    subtotal + shipping_fee(subtotal)
}

fn shipping_fee(subtotal: u32) -> u32 {
    if subtotal < 5000 { 300 } else { 0 }
}
```

| 표기                           | 역할                                       |
| ---------------------------- | ---------------------------------------- |
| `mod pricing;`               | 현재 module의 하위 module을 선언하고 별도 파일의 본문을 연결 |
| `crate::pricing::total`      | 현재 crate의 root부터 함수를 가리키는 경로             |
| `use crate::pricing::total;` | 현재 범위에서 함수를 `total`이라는 짧은 이름으로 사용        |

[`use`](https://doc.rust-kr.org/ch07-04-bringing-paths-into-scope-with-the-use-keyword.html)는 기존 항목의 이름을 현재 범위에 가져온다.

> [!note]+ Python 비교: import의 역할을 mod와 use로 나눠 읽기
> - **이름 가져오기**: `from pricing import total`의 사용 방식은 `use crate::pricing::total;`과 비슷하다. 두 언어 모두 `as calculate_total`을 붙여 현재 범위의 별칭을 지정할 수 있다.
> - **Module 연결**: Rust에서는 별도 파일의 module을 `mod pricing;`로 선언한다. Python의 import는 검색 가능한 module을 찾고 필요하면 로딩·초기화도 한다.
> - **처리 시점**: Rust `mod`·`use`는 컴파일할 구조와 이름 해석을 정한다. Python의 module 최상위 코드는 초기화할 때 실행된다.

- **파일 분리 결과**: 소스 파일은 두 개지만 binary crate는 여전히 하나다.
- **컴파일 시작점**: `main.rs`에서 시작해 선언된 `pricing` module도 함께 컴파일한다.
- **공개 범위 유지**: 파일을 옮겨도 `total`은 공개하고 `shipping_fee`는 내부에 두는 관계가 유지된다.

> [!note]+ Module 파일: 선언 위치에 따라 본문을 찾음
> - **현재 예제**: root의 `mod pricing;`은 `src/pricing.rs` 또는 `src/pricing/mod.rs`에서 본문을 찾는다. 두 파일을 동시에 두면 안 된다.
> - **하위 module**: `src/pricing.rs`에 `mod tax;`를 추가하면 기본 위치는 `src/pricing/tax.rs` 또는 `src/pricing/tax/mod.rs`다.
> - **명시적 연결**: 일반 module 파일은 디렉터리에 놓는 것만으로 module tree에 추가되지 않는다. 선언으로 연결한다.
> - **분리 원칙**: [파일로 module 분리하기](https://doc.rust-kr.org/ch07-05-separating-modules-into-different-files.html)는 코드 위치를 바꾸며 별도 crate를 만드는 작업과 구분된다.

> [!tip]+ 경로 표기: 현재 위치와 부모 위치
> - **`crate::`**: 현재 crate의 root에서 시작한다.
> - **`self::`**: 현재 module에서 시작한다.
> - **`super::`**: 부모 module에서 시작한다.
> - **외부 crate**: 의존하는 library crate의 이름으로 시작한다. 다음 절의 `shop::total`이 그 예다.

> [!tip]+ 선택 기준: 프로그램 내부의 코드 정리
> - **단일 프로그램**: 해당 프로그램에서만 쓰는 기능은 `main.rs`와 module로 구성하면 충분하다.
> - **Library 분리**: 다른 binary·package의 재사용이나 독립된 공개 API 경계가 필요할 때 선택한다. 다음 예제에서는 두 실행 프로그램의 계산 기능을 공유한다.

---

### 4. 주문과 견적 프로그램이 계산 library를 공유한다

주문 CLI에 더해 견적 프로그램도 별도로 실행할 필요가 생겼다. 주문 CLI는 상품 3개의 금액을 출력하고 견적 프로그램은 상품 5개의 예상 금액을 출력한다. 가격과 배송비 규칙은 두 프로그램에 동일하게 적용한다.

공통 계산 기능을 library crate로 옮기고 두 binary crate가 그 API를 사용하도록 구성한다. 같은 package 안에 `src/lib.rs`와 `src/bin/quote.rs`를 추가한다.

```text
shop/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── pricing.rs
    ├── main.rs
    └── bin/
        └── quote.rs
```

`src/pricing.rs`는 3절의 코드를 유지한다. 새 `src/lib.rs`에는 다음을 넣는다.

```rust
mod pricing;

pub use pricing::total;
```

주문 CLI인 `src/main.rs`는 다음으로 바꾼다.

```rust
use shop::total;

fn main() {
    println!("주문 금액: {}", total(1000, 3)); // 주문 금액: 3300
}
```

견적 프로그램을 둘 디렉터리를 만든다.

```bash
mkdir -p src/bin
```

새 `src/bin/quote.rs`에는 다음을 넣는다.

```rust
use shop::total;

fn main() {
    println!("견적 금액: {}", total(1000, 5)); // 견적 금액: 5000
}
```

| Binary 이름 | Crate root | 역할 | 사용하는 공통 함수 |
| --- | --- | --- | --- |
| shop | `src/main.rs` | 주문 금액 출력 | `shop::total` |
| quote | `src/bin/quote.rs` | 견적 금액 출력 | `shop::total` |

- **Library crate 하나**: `lib.rs`에서 `pricing` module을 연결하고 `total`을 공개한다.
- **Binary crate 두 개**: 각 root에 `main()`이 있다. 주문·견적 프로그램은 같은 library API를 사용하며 별도 실행 파일로 빌드된다.
- **Package 하나**: `Cargo.toml`로 세 crate를 함께 관리한다. Cargo가 같은 package의 library를 binary에서 사용할 수 있게 연결하므로 새 dependency 항목은 필요하지 않다.

```bash
cargo build --bins
cargo run --bin shop
cargo run --bin quote
```

주문 프로그램은 `주문 금액: 3300`, 견적 프로그램은 `견적 금액: 5000`을 출력한다. Binary가 두 개이므로 실행할 대상을 `--bin`으로 선택한다.

두 프로그램의 계산은 `pricing.rs`의 구현 하나를 사용한다. 배송비 규칙을 수정하면 두 프로그램을 다시 빌드했을 때 같은 변경이 적용된다. 실행 진입점과 출력 처리는 각 binary에 두고 공통 규칙은 library에서 관리한다.

> [!note]+ Python 비교: 공통 라이브러리와 두 CLI 진입점
> - **공통 기능**: `pricing.py`의 계산 함수를 `cli.py`와 `quote.py`가 함께 import하는 구조와 비슷하다.
> - **공개 경로 모음**: `shop/__init__.py`에서 `from .pricing import total`로 `shop.total`을 제공하는 방식은 `pub use pricing::total`과 비슷하다. Python의 `__init__.py`는 실행되는 module이고 Rust의 re-export는 컴파일 중 이름의 공개 경로를 정한다.
> - **명령 등록**: 설치 가능한 Python 프로젝트는 `pyproject.toml`의 `[project.scripts]`에 `shop = "shop.cli:main"`, `quote = "shop.quote:main"`을 등록해 명령 두 개를 제공한다.
> - **실행 방식**: Rust는 binary 두 개를 컴파일한다. Python의 위 설정은 설치 시 지정한 함수를 호출하는 CLI 명령을 제공한다.

> [!note]+ 공개 API: module 전체 대신 필요한 함수 공개
> - **`mod pricing`**: library의 내부 module 구조는 공개하지 않는다.
> - **`pub use pricing::total`**: 외부에는 root 경로의 `total`을 공개한다. 이런 공개를 re-export라고 한다.
> - **대안**: `pub mod pricing`으로 module을 공개하면 외부에서 `shop::pricing::total` 경로를 사용한다.
> - **유지보수**: re-export로 공개 경로를 유지하면 내부 module 배치를 바꿀 때 호출 코드를 덜 수정한다.

> [!warning]+ crate의 경계: 같은 package에도 root는 각각 있음
> - **Binary 내부**: `main.rs`와 `quote.rs`는 각각 다른 binary crate의 root다. `crate::`는 그 코드를 컴파일하는 crate의 root를 가리킨다.
> - **Library 접근**: 두 binary는 `shop::total`로 library 함수를 참조한다. `use shop::total;`로 root 범위에 가져온 함수를 `crate::total` 경로로도 참조한다.
> - **공개 범위**: library의 `pub(crate)` 항목은 같은 package의 binary에도 공개되지 않는다. 서로 다른 crate이기 때문이다.

---

### 5. 여러 package를 함께 개발할 때 workspace로 묶는다

주문·견적 CLI는 `app` package에 함께 두고 가격 계산은 의존성·버전 설정을 별도로 관리하는 `pricing` package로 나눈다. 두 package를 같은 저장소에서 함께 빌드하고 테스트하려면 [Cargo workspace](https://doc.rust-kr.org/ch14-03-cargo-workspaces.html)를 사용한다. Workspace는 Rust Book 14.3절에서 다룬다.

앞의 `shop`은 남겨 두고 그 옆에 새 구조를 만든다. 현재 `shop` 디렉터리에서 다음을 실행한다.

```bash
cd ..
mkdir shop-workspace
cd shop-workspace
cargo new app --vcs none
cargo new pricing --lib --vcs none
cp ../shop/src/pricing.rs pricing/src/calculation.rs
mkdir -p app/src/bin
```

최종 파일 구조는 다음과 같다. 이후 명령은 `shop-workspace` root에서 실행한다.

```text
shop-workspace/
├── Cargo.toml
├── app/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       └── bin/
│           └── quote.rs
└── pricing/
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        └── calculation.rs
```

#### 5.1 Workspace root는 member를 지정한다

`shop-workspace/Cargo.toml`을 새로 작성한다.

```toml
[workspace]
members = ["app", "pricing"]
resolver = "3"
```

- **Member**: `app`, `pricing` 두 package를 함께 관리한다.
- **Virtual workspace**: 이 root에는 `[package]`가 없다. root 자체는 package나 crate가 아니며 member의 구성을 관리한다.
- **Resolver**: 예제는 Rust 2024 edition을 사용하며 virtual workspace에는 의존성 resolver를 명시한다.

#### 5.2 Pricing package는 계산 library를 제공한다

`pricing/Cargo.toml`을 다음으로 바꾼다.

```toml
[package]
name = "pricing"
version = "0.1.0"
edition = "2024"
```

`pricing/src/lib.rs`를 다음으로 바꾼다.

```rust
mod calculation;

pub use calculation::total;
```

`calculation.rs`는 앞 명령으로 복사한 가격·배송비 계산 코드다. Library 내부 module 이름은 `calculation`, library crate 이름은 `pricing`이다.

#### 5.3 App package는 pricing을 dependency로 선언한다

`app/Cargo.toml`을 다음으로 바꾼다.

```toml
[package]
name = "app"
version = "0.1.0"
edition = "2024"

[dependencies]
pricing = { path = "../pricing" }
```

`app/src/main.rs`를 다음으로 바꾼다.

```rust
use pricing::total;

fn main() {
    println!("주문 금액: {}", total(1000, 3)); // 주문 금액: 3300
}
```

`app/src/bin/quote.rs`에는 견적 프로그램을 넣는다. 공통 함수의 경로는 이제 `pricing::total`이다.

```rust
use pricing::total;

fn main() {
    println!("견적 금액: {}", total(1000, 5)); // 견적 금액: 5000
}
```

- **Member 관계**: workspace에서 두 package를 함께 관리한다.
- **Dependency 관계**: `app`이 `pricing` library를 사용하는 관계는 `app/Cargo.toml`에 별도로 선언한다.
- **경로 기준**: `path = "../pricing"`은 선언한 `app/Cargo.toml`의 디렉터리를 기준으로 해석한다.

```bash
cargo run -p app --bin app
cargo run -p app --bin quote
cargo check --workspace
```

- **프로그램 실행**: `-p app`은 package를 선택하고 `--bin app`, `--bin quote`는 그 안의 실행 프로그램을 선택한다. 주문·견적 출력은 4절과 같다.
- **전체 검사**: workspace의 member를 한 번에 검사한다.

```text
workspace: shop-workspace
├── package: app
│   ├── binary crate: src/main.rs
│   └── binary crate: src/bin/quote.rs
└── package: pricing
    └── library crate: src/lib.rs
        └── module: calculation

binary crate app   ── dependency ──> library crate pricing
binary crate quote ── dependency ──> library crate pricing
```

- **포함 관계**: tree는 workspace의 package 구성, package의 crate, crate 내부 module을 보여준다.
- **사용 관계**: 아래 화살표는 두 binary가 library에 의존하는 방향이다. Workspace에 포함되는 것과 library를 사용하는 것은 별도 관계다.

> [!note]+ Workspace 설정: 공유되는 것과 별도인 것
> - **기본 공유**: [Cargo workspace 설정](https://doc.rust-kr.org/ch14-03-cargo-workspaces.html)에 따라 root의 `Cargo.lock`과 `target` 디렉터리를 함께 사용한다.
> - **별도 관리**: 각 package는 자신의 `Cargo.toml`과 dependency 목록을 유지한다.
> - **선택적 공유**: 버전·edition 등은 `workspace.package`, 공통 dependency는 `workspace.dependencies`로 정의하고 member에서 명시적으로 상속한다. 이 예제에서는 각 package에 직접 적었다.

> [!note]+ Python 비교: workspace는 uv의 여러 프로젝트 관리에 대응
> - **프로젝트 분리**: uv workspace의 member도 각각 `pyproject.toml`을 유지하며 애플리케이션과 계산 라이브러리를 따로 관리한다.
> - **공유 설정**: uv는 `[tool.uv.workspace]`로 member를 지정하고 하나의 `uv.lock`을 공유한다. Rust 예제의 `[workspace]`와 `Cargo.lock`에 대응하는 역할이다.
> - **도구의 기능**: uv workspace는 Python 언어 자체의 기능이 아니라 프로젝트 관리 도구의 기능이다. Cargo처럼 member 관계와 실제 dependency 관계를 따로 선언한다.

---

### 6. 계산 테스트를 library에 두고 함께 실행한다

가격 규칙의 테스트를 CLI와 분리하면 출력 처리 없이 계산 결과를 확인한다. `pricing/src/lib.rs` 끝에 다음을 추가한다.

```rust
#[cfg(test)]
mod tests {
    use super::total;

    #[test]
    fn shipping_threshold() {
        assert_eq!(total(1000, 3), 3300);
        assert_eq!(total(1000, 5), 5000);
    }
}
```

- **`mod tests`**: 테스트 코드도 library 안의 module이다.
- **`super::total`**: 부모 module인 library root가 공개한 계산 함수를 사용한다.
- **확인할 규칙**: 5,000 미만에는 배송비를 붙이고 경계 금액부터는 배송비를 받지 않는다.

```bash
cargo test -p pricing
cargo test --workspace
```

첫 명령은 계산 package를 선택하고 둘째 명령은 member 전체의 테스트를 실행한다. Library의 계산 코드를 수정하면 이 테스트와 `app`의 사용 코드를 같은 workspace에서 확인한다.

> [!note]+ Python 비교: 계산 함수 테스트와 실행 프로그램 분리
> - **테스트 위치**: `test_pricing.py`에서 공통 `total` 함수를 import하고 계산 결과를 검사하는 방식과 비슷하다.
> - **구조 선택**: Python은 import 가능한 함수만 있어도 테스트한다. Rust도 binary 내부 module에 unit test를 둘 수 있으며 이 예제에서는 여러 binary가 사용하는 library API를 검사한다.

---

### 7. 구조는 필요한 경계부터 나눈다

예제의 계산 코드는 2절부터 같은 규칙을 유지했다. 이후 확장은 구현 위치, 공개 API, 컴파일 단위, Cargo 관리 단위를 바꾸는 과정이었다.

| 단계 | Package 수 | 주된 crate 수 | 추가한 경계 | 필요한 이유 |
| --- | --- | --- | --- | --- |
| 함수 하나 | 1 | Binary 1 | 함수 | 간단한 계산·출력 |
| Inline module | 1 | Binary 1 | Module의 공개 범위 | 내부 배송비 계산 숨김 |
| Module 파일 분리 | 1 | Binary 1 | 파일 | 계산 코드와 CLI를 따로 읽고 수정 |
| Library 추출 | 1 | Library 1 + Binary 2 | Crate | 주문·견적 프로그램이 공통 계산 API 사용 |
| Workspace 구성 | 2 | Library 1 + Binary 2 | Package, workspace | 개별 설정과 전체 빌드·테스트 병행 |

> [!note]+ 표의 crate 수: 구현의 주된 경계 기준
> - **집계 범위**: 애플리케이션의 기본 library·binary를 셌다.
> - **테스트 대상**: Cargo가 테스트 실행 등에 만드는 추가 target은 표에서 제외했다.
