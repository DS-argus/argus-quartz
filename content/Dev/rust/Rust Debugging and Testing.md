---
tags:
  - Rust
  - Cargo
  - test
created: 2026-10-04T12:51:46
updated: 2026-10-05T13:42:58
permalink: /Dev/rust/rust-debugging-and-testing
---

> [!abstract]+ TL;DR
> - `dbg!`로 값과 분기를 확인하고 실패한 입력을 작은 테스트로 재현하는 개발 흐름
> - `cargo test`의 target·이름 필터·출력 옵션을 사용한 반복 검증
> - 수정한 동작은 회귀 테스트로 남기고 필요에 따라 문서 테스트·자동 실행·debugger로 확장

> *AI-assisted*

### 1. 예제 프로젝트 준비

상품 가격과 수량으로 최종 주문 금액을 계산하는 CLI를 만든다. 계산 기능은 library에 두고 CLI에서 호출한다.

- **상품 합계**: 상품 가격에 수량을 곱한다.
- **배송비**: 상품 합계가 5,000원 미만이면 300원, 5,000원 이상이면 무료다.
- **최종 금액**: 상품 합계와 배송비를 더한다.

#### 프로젝트 생성

Rust와 Cargo가 설치된 환경에서 새 프로젝트를 만든다. 이후 명령은 `shop_debug` 디렉터리에서 실행한다.

```bash
cargo new shop_debug --lib --vcs none
cd shop_debug
```

초기 예제의 파일 구성은 다음과 같다. 생성된 `src/lib.rs`를 바꾸고 `src/main.rs`를 추가한다.

```text
shop_debug/
├── Cargo.toml
└── src/
    ├── lib.rs
    └── main.rs
```

- **`src/lib.rs`**: 상품 합계와 배송비를 계산하는 함수.
- **`src/main.rs`**: 계산 함수를 호출하고 주문 금액을 출력하는 실행 진입점.

#### 초기 코드

`src/lib.rs`를 다음 코드로 바꾼다. 배송비 조건에 경계값 오류가 들어 있다.

```rust
pub fn total(unit_price: u32, quantity: u32) -> u32 {
    let subtotal = unit_price * quantity;
    subtotal + shipping_fee(subtotal)
}

fn shipping_fee(subtotal: u32) -> u32 {
    if subtotal <= 5000 { 300 } else { 0 }
}
```

`src/main.rs`를 추가한다.

```rust
fn main() {
    println!("주문 금액: {}", shop_debug::total(1000, 5));
}
```

#### 실행 결과

1,000원짜리 상품 5개를 주문한다. 상품 합계가 5,000원이므로 기대하는 최종 주문 금액도 5,000원이다.

```bash
cargo run --quiet
```

```text
주문 금액: 5300
```

컴파일은 성공했지만 실제 금액은 기대한 금액보다 300원 많다. 이 입력을 사용해 계산 과정을 조사하고 수정한 결과를 테스트로 남긴다.

---

### 2. dbg로 계산 과정 확인

상품 합계와 배송비를 나눠 확인하도록 `src/lib.rs`의 `total()`을 바꾼다.

```rust
pub fn total(unit_price: u32, quantity: u32) -> u32 {
    let subtotal = dbg!(unit_price * quantity);
    let shipping = dbg!(shipping_fee(subtotal));
    subtotal + shipping
}
```

[`dbg!`](https://doc.rust-kr.org/ch05-02-example-structs.html#트레이트-파생으로-유용한-기능-추가하기)는 표현식과 평가한 값, 소스 위치를 출력하고 그 값을 반환한다. 위 코드에서는 합계를 계산하면서 출력하고 다음 계산에도 사용한다.

```bash
cargo run --quiet
```

다음은 stderr의 진단 출력이다. 파일에서 코드의 위치를 바꾸면 줄 번호도 달라진다.

```text
[src/lib.rs:2:20] unit_price * quantity = 5000
[src/lib.rs:3:20] shipping_fee(subtotal) = 300
```

- **상품 합계**: `unit_price * quantity`는 5,000으로 나와 곱셈 결과가 맞다.
- **배송비**: `shipping_fee(subtotal)`는 300으로 나와 조사할 함수가 좁혀졌다.
- **조건식**: `subtotal <= 5000`에는 5,000도 포함된다. 무료 배송 조건에 맞추려면 `< 5000`으로 바꿔야 한다.

조건 자체도 보고 싶다면 잠시 다음처럼 감싼다.

```rust
fn shipping_fee(subtotal: u32) -> u32 {
    if dbg!(subtotal <= 5000) { 300 } else { 0 }
}
```

> [!note]+ 출력 선택: println과 dbg
> - **`println!`**: 정한 형식으로 stdout에 출력. CLI의 결과 표시 등에 사용.
> - **`dbg!`**: 소스 위치·표현식·값을 stderr에 출력. 계산 결과나 분기를 임시로 확인할 때 사용.
> - **빌드 종류**: `dbg!`는 release 빌드에서도 실행. 조사한 뒤 임시 출력을 정리.

#### 구조체를 확인할 때의 Debug와 소유권

주문 정보를 묶어 확인하려면 `src/main.rs`를 다음 코드로 바꿔 실행한다.

```rust
#[derive(Debug)]
struct Order {
    unit_price: u32,
    quantity: u32,
}

fn main() {
    let order = Order { unit_price: 1000, quantity: 5 };

    dbg!(&order);
    println!("주문 금액: {}", shop_debug::total(order.unit_price, order.quantity));
}
```

- **Debug 파생**: `#[derive(Debug)]`는 구조체의 필드를 디버깅용 형식으로 출력할 `Debug` 구현을 생성한다.
- **빌려서 출력**: `dbg!(&order)`는 주문을 빌려서 출력한다. 출력한 뒤에도 `order`를 사용한다.
- **값으로 전달**: `dbg!(order)`에 이 구조체를 넘기면 `Copy`를 구현하지 않았으므로 소유권을 넘긴다. 반환값을 받지 않으면 이후 같은 변수로 주문을 사용하지 못한다.

일반 출력에서도 `Debug` 형식을 사용한다.

```rust
println!("{:?}", order);   // 한 줄 형식
println!("{:#?}", order);  // 여러 줄로 펼친 형식
```

---

### 3. 실패한 주문의 테스트 재현

CLI로 입력을 바꾸며 매번 눈으로 확인하는 대신 5,000원 주문의 기대 결과를 코드로 남긴다. `src/lib.rs`의 아래에 다음 module을 추가한다.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_shipping_at_threshold() {
        let actual = total(1000, 5);
        assert_eq!(actual, 5000, "5,000원 주문은 무료 배송이어야 한다");
    }
}
```

[테스트 함수](https://doc.rust-kr.org/ch11-01-writing-tests.html)는 입력을 준비하고 코드를 호출한 뒤 기대 결과를 검사한다. 여기서는 실제 주문 금액과 5,000을 비교한다.

| 구문 | 역할 |
| --- | --- |
| `#[cfg(test)]` | 테스트 모드로 컴파일할 때 이 module을 포함 |
| `mod tests` | 테스트 코드를 묶는 일반 module. `tests`는 관례적인 이름 |
| `use super::*;` | 부모 module의 항목을 현재 범위로 가져옴 |
| `#[test]` | 테스트 실행기가 실행할 함수 표시 |
| `assert_eq!` | 두 값이 같은지 검사하고 다르면 panic으로 실패 처리 |

```bash
cargo test --lib free_shipping_at_threshold
```

실패 출력에서 두 값을 비교한다.

```text
left: 5300
right: 5000
```

이때 함수 안에 둔 `dbg!`의 출력도 실패 보고에 포함된다. 기대 결과는 유지한 채 합계와 배송비를 확인하고 원인을 고친다.

`shipping_fee()`를 다음으로 바꾼 뒤 같은 명령을 다시 실행한다.

```rust
fn shipping_fee(subtotal: u32) -> u32 {
    if subtotal < 5000 { 300 } else { 0 }
}
```

테스트가 통과하면 배송비 기준 아래·위의 주문도 `mod tests` 안에 추가한다.

```rust
#[test]
fn shipping_below_threshold() {
    assert_eq!(total(1000, 3), 3300);
}

#[test]
fn free_shipping_above_threshold() {
    assert_eq!(total(1000, 6), 6000);
}
```

```bash
cargo test --lib
```

원인을 확인한 `dbg!`는 지우고 `total()`을 다시 단순한 계산으로 바꾼다. 세 테스트는 배송비 규칙이 이후 변경에서도 유지되는지 확인하는 **회귀 테스트**로 남긴다.

> [!tip]+ Assertion 선택: 검증할 조건에 맞춤
> - **`assert!`**: 조건이 `true`인지 검사. 오류 여부나 범위 검사 등에 사용.
> - **`assert_eq!`**: 두 값의 같음을 검사. 실패하면 비교한 값도 표시.
> - **`assert_ne!`**: 두 값이 다른지 검사.
> - **추가 메시지**: assertion 뒤에 실패 상황을 설명하는 형식 문자열 지정 가능.

> [!note]+ pytest 비교: 검증 코드와 테스트 탐색
> - **검증 코드**: [[Python pytest - A practical guide to testing and plugins#2. assert 검증|pytest]]의 `assert total(1000, 5) == 5000`과 Rust의 `assert_eq!(total(1000, 5), 5000)`은 기대값을 검증하는 역할이 같음.
> - **테스트 탐색**: pytest는 기본적으로 [[Python pytest - A practical guide to testing and plugins#3. 테스트 탐색 규칙|파일·함수 이름 규칙]]으로 수집. Rust는 `#[test]`로 함수를 표시하므로 함수 이름의 `test_` 접두사는 필수가 아님.
> - **실패 보고**: pytest는 `assert`의 비교값을 풀어 표시. Rust의 `assert_eq!`도 실패 시 두 값을 표시.

---

### 4. 가격 입력 오류와 수량 계약 검증

CLI에서 받은 가격 문자열을 숫자로 바꾸는 기능을 추가한다. 정상 입력뿐 아니라 숫자가 아닌 입력도 확인한다.

`src/lib.rs`의 일반 함수 부분을 다음으로 바꾼다. 아래의 기존 `mod tests`는 유지한다.

```rust
use std::num::ParseIntError;

pub fn parse_price(input: &str) -> Result<u32, ParseIntError> {
    input.trim().parse()
}

pub fn total(unit_price: u32, quantity: u32) -> u32 {
    assert!(quantity > 0, "quantity must be positive");

    let subtotal = unit_price * quantity;
    subtotal + shipping_fee(subtotal)
}

fn shipping_fee(subtotal: u32) -> u32 {
    if subtotal < 5000 { 300 } else { 0 }
}
```

- **가격 입력**: 숫자 변환에 실패하면 `Err`를 반환한다. 호출자는 입력 오류를 처리한다.
- **수량 계약**: 이 계산 API는 주문 항목의 수량이 양수라고 정했다. 호출자가 계약을 어기면 assertion으로 panic한다.

CLI도 입력 문자열을 사용하도록 `src/main.rs`를 바꾼다. 첫 번째 인수가 없으면 가격을 `1000`으로 정하고 파싱 오류는 `?`로 반환한다.

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let input = std::env::args().nth(1).unwrap_or_else(|| "1000".to_string());
    let price = shop_debug::parse_price(&input)?;

    println!("주문 금액: {}", shop_debug::total(price, 5));
    Ok(())
}
```

```bash
cargo run --quiet -- ' 1000 '
cargo run --quiet -- free
```

첫 명령은 주문 금액 5,000을 출력하고 두 번째 명령은 가격 변환 오류로 종료한다. 이 입력을 각각 테스트에 옮긴다.

#### 정상 결과와 Err 확인

다음 테스트를 기존 `mod tests` 안에 추가한다.

```rust
#[test]
fn parse_price_trims_spaces() {
    assert_eq!(parse_price(" 1000 ").unwrap(), 1000);
}

#[test]
fn parse_price_rejects_text() {
    assert!(parse_price("free").is_err());
}
```

정상 입력 테스트의 `unwrap()`은 실패하면 테스트를 panic으로 끝낸다. 오류 입력 테스트에서는 `Err`가 나오는 동작을 기대하므로 `is_err()`로 검사한다.

여러 함수가 `Result`를 반환한다면 테스트 함수도 `Result`를 반환하고 `?`를 사용한다.

```rust
#[test]
fn parsed_price_calculates_total() -> Result<(), Box<dyn std::error::Error>> {
    let price = parse_price("1000")?;
    assert_eq!(total(price, 5), 5000);
    Ok(())
}
```

- **성공 반환**: `Ok(())`를 반환하는 경로다. 앞의 assertion도 통과해야 한다.
- **`Err` 반환**: `?`가 오류를 반환하면 테스트가 실패한다.
- **`Box<dyn std::error::Error>`**: 여러 종류의 오류를 반환할 때 쓰는 형태다. 이 예제처럼 파싱 오류만 있으면 반환 타입을 `Result<(), ParseIntError>`로 좁혀도 된다.

#### 예상한 panic 확인

수량 계약도 테스트로 남긴다.

```rust
#[test]
#[should_panic(expected = "quantity must be positive")]
fn zero_quantity_panics() {
    total(1000, 0);
}
```

`#[should_panic]`은 함수가 panic해야 통과한다. `expected`를 지정하면 panic 메시지에 이 문자열이 포함되어야 하므로 다른 원인의 panic으로 통과하는 범위를 줄인다.

```bash
cargo test --lib
```

이 단계에서는 배송비 테스트 세 개와 파싱·수량 테스트 네 개를 합쳐 일곱 개가 통과한다.

> [!note]+ 테스트 반환값: Result와 should_panic
> - **`Result` 테스트**: `Ok(())`를 반환하면 통과하고 `Err`를 반환하면 실패.
> - **`#[should_panic]` 테스트**: 반환 타입이 `()`인 함수에 적용. `Result` 반환 테스트와 따로 작성.
> - **명세**: 반환값과 panic 판정의 세부 규칙은 [테스트 attribute](https://doc.rust-lang.org/reference/attributes/testing.html) 참고.

> [!note]+ pytest 비교: 예상 예외와 panic 검증
> - **예상 실패**: pytest는 [[Python pytest - A practical guide to testing and plugins#7. pytest.raises와 예외 검증|pytest.raises()]]로 지정한 예외 발생을 검증. Rust는 `#[should_panic]`으로 테스트 함수의 panic을 검증.
> - **메시지 조건**: `pytest.raises(..., match=...)`는 정규식으로 비교. `#[should_panic(expected = "...")]`는 문자열 포함 여부로 비교.
> - **오류 반환**: Rust의 `Result::Err`는 반환값이므로 assertion으로 확인. 이 예제의 `parse_price_rejects_text()`는 `is_err()`로 검사.

---

### 5. 테스트 선택 실행과 출력 확인

개발 중에는 수정 중인 함수의 테스트를 먼저 실행한다. [테스트 실행 옵션](https://doc.rust-kr.org/ch11-02-running-tests.html)으로 이름과 실행 범위를 좁힌다.

#### Target과 이름 필터

```bash
# package의 기본 테스트 대상 실행
cargo test

# library의 unit test에서 이름에 parse_price가 포함된 테스트 실행
cargo test --lib parse_price

# library의 unit test 하나를 전체 이름으로 지정
cargo test --lib tests::free_shipping_at_threshold -- --exact

# 테스트 이름과 목록 확인
cargo test --lib -- --list
```

- **부분 이름**: 기본 이름 필터는 부분 문자열을 비교한다. `parse_price`는 두 파싱 테스트에 해당한다.
- **전체 이름**: `--exact`에서는 module 경로까지 비교한다. 여기서는 `tests::free_shipping_at_threshold`가 전체 이름이다.
- **Target**: `--lib`는 library의 unit test를 선택한다. binary의 unit test는 별도 대상이다.

| 인수 위치 | 처리하는 대상 | 예 |
| --- | --- | --- |
| `--` 앞의 Cargo 옵션 | 빌드할 package·target 등을 선택 | `--lib`, `--release` |
| `--` 앞의 이름 필터 | Cargo가 테스트 실행기로 전달 | `parse_price` |
| `--` 뒤의 옵션 | 테스트 실행기가 실행 방법을 조절 | `--exact`, `--nocapture` |

#### 통과한 테스트의 출력 확인

테스트 안에서 값이 궁금하면 잠시 다음처럼 바꾼다.

```rust
#[test]
fn free_shipping_at_threshold() {
    let actual = dbg!(total(1000, 5));
    assert_eq!(actual, 5000);
}
```

```bash
# 출력 캡처를 끄고 실행 중 출력 확인
cargo test --lib free_shipping_at_threshold -- --nocapture

# 캡처는 유지하고 통과한 테스트의 출력도 실행 후 표시
cargo test --lib free_shipping_at_threshold -- --show-output
```

- **기본 실행**: 성공한 테스트의 출력은 숨기고 실패한 테스트는 캡처한 출력도 보고한다.
- **`--nocapture`**: 출력을 바로 내보낸다. 여러 테스트가 병렬로 실행되면 출력이 섞일 수 있다.
- **`--show-output`**: 캡처한 성공 출력도 결과에 포함한다. 테스트별 출력을 모아서 읽을 때 사용한다.

#### 오래 걸리는 테스트와 공유 상태

외부 서비스나 많은 데이터를 사용하는 테스트는 `#[ignore = "이유"]`로 기본 실행에서 제외할 수 있다. Ignore된 테스트도 컴파일은 한다.

```bash
# ignore 표시가 붙은 테스트만 실행
cargo test -- --ignored

# ignore된 테스트도 포함해 실행
cargo test -- --include-ignored

# 이름에 slow가 포함된 테스트 제외
cargo test -- --skip slow

# 테스트 함수를 한 번에 하나씩 실행
cargo test -- --test-threads=1
```

> [!warning]+ 공유 상태: 테스트의 실행 순서에 의존하지 않기
> - **기본 실행**: 같은 테스트 실행 파일의 함수는 기본적으로 병렬 실행.
> - **충돌 사례**: 같은 파일을 덮어쓰거나 환경 변수·전역 상태를 공유하면 서로 영향을 줄 수 있음.
> - **조사 방법**: 순차 실행으로 증상 변화를 확인한 뒤 테스트별 데이터나 자원을 분리.
> - **순서**: 순차 실행 옵션도 특정 테스트가 먼저 실행된다는 의존 관계를 보장하는 수단은 아님.

> [!note]+ pytest 비교: 테스트 선택과 출력 캡처
> - **이름 선택**: pytest의 [[Python pytest - A practical guide to testing and plugins#4. 테스트 실행 옵션|-k]]와 Rust의 이름 필터는 관심 있는 테스트만 골라 실행. `-k`는 `and`·`or`·`not`을 조합하며 Rust의 기본 이름 필터는 부분 문자열을 비교.
> - **출력 관찰**: pytest의 [[Python pytest - A practical guide to testing and plugins#4. 테스트 실행 옵션|-s]]와 Rust의 `--nocapture`는 캡처를 꺼 실행 중 출력을 확인하는 옵션.
> - **전체 이름**: pytest는 파일 경로와 `::함수명`으로 [[Python pytest - A practical guide to testing and plugins#4. 테스트 실행 옵션|실행할 테스트를 지정]]. Rust 예제는 `tests::free_shipping_at_threshold` 같은 전체 이름과 `--exact`를 사용.

---

### 6. 공개 API와 문서 예제 검증

지금까지 작성한 코드는 **unit test**다. 가격 계산 함수를 library 밖에서 사용하는 모습과 문서에 적은 사용법도 검사한다.

| 종류 | 기본 위치 | 검증할 내용 |
| --- | --- | --- |
| Unit test | 소스 내부의 `#[cfg(test)] mod tests` | 작은 함수와 내부 구현 |
| Integration test | `tests/*.rs` | 외부 crate 관점의 공개 API |
| Doc test | `///` 문서 주석 안의 Rust 예제 | API 문서의 사용 코드 |

#### 같은 module의 내부 구현 검사

private 함수가 복잡해졌다면 `mod tests`에 다음 테스트도 추가한다.

```rust
#[test]
fn shipping_fee_at_threshold() {
    assert_eq!(shipping_fee(5000), 0);
}
```

자식인 `tests` module에서는 부모 module의 private 항목을 사용한다. `use super::*;`는 이 이름을 가져오는 구문이다.

#### Integration test에서 공개 API 호출

`tests` 디렉터리를 만든다.

```bash
mkdir -p tests
```

`tests/api.rs`에 다음을 넣는다.

```rust
use shop_debug::{parse_price, total};

#[test]
fn entered_price_produces_order_total() {
    let price = parse_price(" 1000 ").unwrap();
    assert_eq!(total(price, 5), 5000);
}

#[test]
fn small_order_includes_shipping() {
    assert_eq!(total(1000, 3), 3300);
}
```

[Integration test](https://doc.rust-kr.org/ch11-03-test-organization.html#통합-테스트)는 별도 crate로 컴파일해 library를 사용한다. 외부에서 호출할 공개 API인 `parse_price`와 `total`을 가져온다.

```bash
cargo test --test api
```

#### Doc test로 사용법 확인

`src/lib.rs`의 `total()` 바로 위에 다음 문서 주석을 붙인다.

````rust
/// 상품 금액과 배송비를 합산한다. 수량은 양수여야 한다.
///
/// # Examples
///
/// ```
/// assert_eq!(shop_debug::total(1000, 3), 3300);
/// assert_eq!(shop_debug::total(1000, 5), 5000);
/// ```
````

[문서 테스트](https://doc.rust-kr.org/ch14-02-publishing-to-crates-io.html#테스트로서의-문서화-주석)는 문서의 Rust 예제를 컴파일하고 실행한다. API를 바꿨을 때 문서의 사용법도 함께 확인한다.

```bash
# library의 문서 테스트만 실행
cargo test --doc

# 기본 대상의 unit·integration·doc test 실행
cargo test
```

> [!note]+ pytest 비교: 테스트 배치와 문서 예제
> - **파일 배치**: pytest에서는 [[Python pytest - A practical guide to testing and plugins#3. 테스트 탐색 규칙|테스트 파일]]을 `tests/test_pricing.py`처럼 배치하고 함수를 import해 테스트. Rust의 소스 내부 unit test는 private 항목에 접근하며 root의 `tests/`는 별도 crate로 컴파일해 공개 API를 사용.
> - **검증 범위**: pytest는 작은 함수나 여러 기능의 연동을 같은 수집·실행 방식으로 검사. Rust는 unit·integration test의 crate 경계를 구분.
> - **문서 예제**: pytest의 `--doctest-modules`는 module의 docstring 예제를 수집. Rust doc test는 library 문서의 Rust 예제를 컴파일하고 실행.

---

### 7. 저장 시 테스트 자동 실행

새 함수를 작성하다 동작이 궁금해지면 같은 파일의 `mod tests`에 입력을 하나 넣는다. 필요한 값에 `dbg!`를 붙이고 이 테스트만 반복해서 실행한다.

```bash
cargo test --lib parsed_price_calculates_total -- --nocapture
```

반복하는 명령은 저장할 때 자동 실행하도록 설정한다. [Bacon](https://dystroy.org/bacon/)을 별도 터미널에 켜두면 코드 변경을 감지해 검사·테스트를 다시 실행하고 결과를 표시한다.

```bash
cargo install --locked bacon
bacon test
```

- **화면 구성**: 한쪽에는 에디터, 다른 쪽에는 Bacon을 둔다.
- **실패 집중**: Bacon에서 테스트 실패 후 `f`를 누르면 실패한 테스트에 집중한다. `Esc`로 전체 테스트로 돌아간다.
- **작업 선택**: 기본 테스트 job 외에 특정 target·함수만 실행할 job을 지정한다.

작은 테스트만 반복하려면 프로젝트 root의 `bacon.toml`에 다음 [job과 키 설정](https://dystroy.org/bacon/config/)을 추가한다. 파일이 없으면 새로 만든다.

```toml
[jobs.price]
command = ["cargo", "test", "--lib", "parsed_price_calculates_total", "--", "--nocapture"]
need_stdout = true

[keybindings]
ctrl-r = "toggle-raw-output"
```

```bash
bacon price
```

이제 가격 파싱이나 계산 함수를 수정하고 저장하면 같은 테스트가 다시 실행된다. `Ctrl+R`로 원본 출력을 표시하면 통과한 테스트의 `dbg!` 출력도 확인한다. 실행 시간은 프로젝트 규모·변경 범위·빌드 캐시에 따라 달라진다.

> [!note]+ 기존 도구: cargo-watch의 자동 실행
> - **역할**: 파일 변경을 감지해 지정한 Cargo 명령을 다시 실행.
> - **유지보수**: [cargo-watch 저장소](https://github.com/watchexec/cargo-watch)는 archive 상태이며 작성자는 Bacon이나 Watchexec를 권장.
> - **기존 환경**: 이미 설치해 사용하는 경우 다음 명령으로 같은 테스트를 반복 실행.

```bash
cargo watch -x 'test --lib parsed_price_calculates_total -- --nocapture'
```

#### 회귀 테스트와 임시 출력 정리

1. 궁금한 동작을 작은 테스트로 호출한다.
2. `dbg!` 출력으로 입력·중간 값·분기를 확인한다.
3. 기대한 동작을 assertion으로 작성한다.
4. 구현을 고치고 테스트가 통과하는지 확인한다.
5. `dbg!`를 지우고 재현 테스트를 남긴다.

남은 임시 출력은 [Clippy의 dbg_macro 검사](https://rust-lang.github.io/rust-clippy/master/index.html#dbg_macro)로 찾는다.

```bash
cargo clippy --all-targets -- -W clippy::dbg_macro
```

`--all-targets`로 테스트 대상도 검사한다. `src/lib.rs` 맨 위에 다음 속성을 두면 이 crate에서 항상 경고하도록 설정한다.

```rust
#![warn(clippy::dbg_macro)]
```

> [!note]+ pytest 비교: 저장 시 테스트 재실행
> - **자동 실행**: pytest 환경의 [[Python pytest - A practical guide to testing and plugins#pytest-watcher와 자동 재실행|pytest-watcher]]처럼 Bacon·cargo-watch도 파일 변경을 감지해 테스트 명령을 재실행.
> - **재현 사례**: 양쪽 모두 조사할 입력을 작은 테스트로 고정하고 수정 후 같은 기대값을 다시 검증.
> - **컴파일 단계**: Rust는 변경한 코드를 컴파일한 뒤 테스트 실행 파일을 실행.

---

### 8. panic 호출 경로와 실행 상태 확인

여러 함수를 거친 뒤 panic했다면 [backtrace](https://doc.rust-kr.org/ch09-01-unrecoverable-errors-with-panic.html#panic-백트레이스-이용하기)를 켜 호출 경로를 확인한다. 수량이 0인 주문은 `total()`의 assertion에서 panic하므로 앞의 테스트로 출력 방식을 확인한다.

```bash
RUST_BACKTRACE=1 cargo test --lib zero_quantity_panics -- --nocapture
```

- **panic 메시지**: `quantity must be positive`와 assertion 위치를 확인한다.
- **호출 경로**: 표준 라이브러리의 panic 처리 부분을 지나 `shop_debug::total`과 `tests::zero_quantity_panics` 같은 직접 작성한 함수를 찾는다.
- **테스트 결과**: 이 테스트는 `#[should_panic]`으로 예상한 panic을 검증하므로 통과한다. panic 메시지 출력과 테스트 실패는 구분해서 읽는다.

실제 조사에서는 문제를 일으킨 실행 명령이나 테스트에 같은 환경 변수를 붙인다. Backtrace는 호출 경로를 보여주며 각 함수의 모든 변수 값을 저장하는 기능은 아니다.

#### Debugger의 breakpoint와 상태 확인

반복문이나 여러 함수의 상태를 함께 봐야 한다면 breakpoint에서 실행을 멈춘다. macOS에서 LLDB를 사용할 수 있는 환경에서는 먼저 실행 파일을 빌드한다.

```bash
cargo build
rust-lldb target/debug/shop_debug
```

`rust-lldb`는 Rust 도구체인에서 제공하는 LLDB 실행 wrapper다. LLDB가 설치된 환경에서 [LLDB 명령](https://lldb.llvm.org/use/tutorial.html)으로 함수에 breakpoint를 설정하고 실행한다.

```text
breakpoint set --name shop_debug::total
run
frame variable
next
thread backtrace
continue
quit
```

| 명령 | 확인하는 내용 |
| --- | --- |
| `breakpoint set --name ...` | 이 함수에서 멈추도록 위치 지정 |
| `run` | 프로그램 실행 |
| `frame variable` | 현재 stack frame의 변수 확인 |
| `next` | 함수 호출 안으로 들어가지 않고 다음 소스 줄로 이동 |
| `step` | 호출한 함수 안으로 진입하며 한 줄씩 실행 |
| `thread backtrace` | 현재 thread의 호출 스택 확인 |
| `continue` | 다음 breakpoint나 종료까지 계속 실행 |

`total()`에서 멈췄다면 인수로 받은 `unit_price`와 `quantity`를 확인한다. 계산 줄을 지난 뒤에는 `subtotal`도 확인하고 값이 예상과 달라지는 위치를 찾는다.

> [!note]+ 빌드 설정: release에서도 같은 동작인지 확인
> - **최적화**: 최적화한 실행 파일에서는 소스 줄과 실행 순서가 달라지거나 일부 변수가 보이지 않을 수 있음.
> - **Debug 정보**: 변수·소스 위치 조사에 필요한 정보는 [Cargo profile](https://doc.rust-lang.org/cargo/reference/profiles.html)에서 설정.
> - **정수 overflow**: `overflow-checks`를 켜면 overflow에서 panic. 기본 dev·test와 release의 설정이 달라 실행 결과를 비교할 때 확인.
> - **빌드에 독립적인 계약**: 예제의 `assert!(quantity > 0, ...)`는 release에서도 실행. `debug_assert!`는 기본 release 설정에서 검사하지 않음.

release 테스트도 확인한다.

```bash
cargo test --release
```

> [!note]+ pytest 비교: 실패 경로와 실행 상태 조사
> - **실패 경로**: pytest는 실패 보고에 traceback을 표시. Rust의 panic은 `RUST_BACKTRACE=1`로 호출 스택 확인.
> - **중단 조사**: pytest의 `--pdb`는 실패 시 pdb에 진입. Rust 예제는 별도 debugger인 LLDB로 실행 파일을 조사.
> - **실행 대상**: pytest는 Python 코드를 실행하며 LLDB는 컴파일한 Rust 실행 파일을 사용. 소스를 수정하면 다시 빌드.

---

### 9. 테스트 대상과 파일 구성

개발 중에는 수정한 함수의 테스트를 먼저 실행하고 변경을 마무리할 때 전체 테스트를 실행한다. 이름 필터는 실행할 함수를 줄이고 target 선택은 빌드할 범위도 줄이는 역할을 한다.

#### 계산 로직과 CLI를 분리하는 이유

현재 `src/lib.rs`의 계산·파싱 기능은 unit test로 호출하거나 integration test에서 import한다. `src/main.rs`는 library를 호출해 출력하는 역할을 맡는다.

- **Library의 unit test**: 가격 계산·파싱 규칙을 작은 입력으로 확인한다.
- **Library의 integration test**: 사용자가 호출하는 공개 API 경계를 검사한다.
- **CLI의 integration test**: 필요하면 실행 파일을 별도 프로세스로 실행해 출력·종료 상태를 검사한다.

> [!note]+ Binary crate: main.rs에도 unit test 작성 가능
> - **같은 crate의 테스트**: `main.rs`나 그 하위 module에도 `#[cfg(test)] mod tests`를 배치.
> - **Library 분리의 이점**: 공개 Rust API를 다른 crate에서 import하고 여러 binary에서 공유하기 쉬워짐.
> - **CLI 실행**: binary를 library처럼 import하는 대신 실행 파일을 호출하는 integration test도 가능.

#### Integration test target 통합

기본 Cargo 구조에서는 `tests/api.rs`, `tests/parsing.rs`가 각각 별도 실행 파일이 된다. 파일이 많아져 빌드·링크 비용이 커졌다면 하나의 target 아래에 module로 묶는 구성을 검토한다.

예를 들어 `api.rs`와 `parsing.rs`가 생긴 프로젝트를 다음처럼 나눈다. 이 글의 작은 예제에서는 기존 `tests/api.rs`를 유지해도 충분하다.

```text
tests/
└── it/
    ├── main.rs
    ├── api.rs
    └── parsing.rs
```

`tests/it/main.rs`는 다음 module을 연결한다.

```rust
mod api;
mod parsing;
```

별도 crate의 수를 줄이고 각 module의 테스트는 같은 실행 파일에서 실행한다. 함수는 여전히 이름이나 module 경로로 골라 실행한다.

#### 공유 helper의 위치

여러 integration test가 같은 fixture나 준비 코드를 쓴다면 [공유 module](https://doc.rust-lang.org/cargo/reference/cargo-targets.html#integration-tests)을 둔다.

```text
tests/
├── api.rs
├── parsing.rs
└── common/
    └── mod.rs
```

- **연결**: 각 테스트 파일에서 `mod common;`을 선언해 helper 사용.
- **위치**: `tests/common.rs`로 두면 기본 target 탐색에서 별도 integration test로 잡힘. `tests/common/mod.rs`는 helper module로 연결.
- **속도 판단**: 파일을 묶는 효과는 빌드·링크 시간에 따라 다름. 작은 테스트 모음부터 복잡하게 재구성할 필요는 적음.

---

### 10. 검증 대상별 도구 선택

앞의 예제는 표준 테스트 실행기만 사용한다. Async 실행 환경이나 큰 출력, 다양한 입력을 검사할 필요가 생기면 목적에 맞는 도구를 추가한다.

| 도구 | 사용할 상황 | 검증 방식 |
| --- | --- | --- |
| [`#[tokio::test]`](https://docs.rs/tokio/latest/tokio/attr.test.html) | Tokio 기반 async 코드 | 테스트용 runtime을 구성해 async 함수 실행 |
| [`cargo-nextest`](https://nexte.st/docs/running/) | 테스트 실행·선택·결과 보고 관리 | unit·integration test 실행 방식을 확장 |
| [`insta`](https://insta.rs/docs/snapshot-types/) | 파서·포매터 등의 큰 출력 | 저장한 snapshot과 현재 출력을 비교 |
| [`proptest`](https://proptest-rs.github.io/proptest/intro.html) | 여러 입력에서 규칙이 유지되는지 확인 | 입력을 생성해 검증하고 실패한 입력을 단순화 |

예를 들어 배송비 규칙을 여러 금액으로 확인하려면 proptest로 합계를 생성하고 규칙을 검사한다. 주문 명세서를 문자열로 출력하는 기능이라면 insta로 출력 전체의 변경을 비교한다.

> [!note]+ Nextest 범위: 문서 테스트는 별도 실행
> - **실행 대상**: Nextest는 unit·integration test를 실행. 문서 테스트는 현재 별도 Cargo 명령으로 실행.
> - **속도**: 병렬 실행 등의 효과는 테스트 구성과 실행 시간에 따라 달라짐.

```bash
# Nextest를 설치해 사용하는 환경
cargo nextest run
cargo test --doc
```
