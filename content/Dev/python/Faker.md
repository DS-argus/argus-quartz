---
tags:
  - faker
  - python
created: 2025-06-21T20:17:32
updated: 2025-06-26T00:13:02
---
### Faker란?
- Faker는 테스트나 데모용으로 현실감 있는 가짜 데이터를 자동 생성해 주는 파이썬 라이브러리
	- 이름·주소·전화번호 같은 개인 정보부터 날짜·금융·인터넷·위치·텍스트 등 100여 종 이상의 필드를 로케일별(예: ko_KR, en_US)로 손쉽게 만들 수 있음
	- 시드 고정·유니크 값·커스텀 provider 확장을 지원해 재현성과 다양성 있는 데이터 세트를 빠르게 생성할 수 있게 해 줌
- 사용 예시
	- pandas 데이터프레임 대량 생성에 사용
	- API 모킹 후단 테스트에 유용
	- 로케일 혼합으로 다국어 시나리오 검증

---
### 사용 방법
##### 객체 생성
- 로케일로 문화권별 데이터 생성 가능
	```python
	from faker import Faker
	fake = Faker('ko_KR')	# 한국어 로케일
	```

##### 사람 관련 데이터
- 이름
	```python
	fake.name()            # 홍길동
	fake.first_name()
	fake.last_name()
	```
- 신원
	```python
	fake.ssn()
	fake.profile()
	```
- 연락처
	```python
	fake.phone_number()
	fake.email()
	fake.address()
	```

##### 시계열 데이터
- 날짜와 시간
	```python
	fake.date()            # 2025-06-21
	fake.time()            # 14:23:01
	fake.date_time_this_year()
	```
- 타임스탬프 문자열 커스텀
	```python
	fake.date_time().isoformat()
	```

##### 금융 데이터
- 카드
	```python
	fake.credit_card_number()
	fake.credit_card_expire()
	fake.credit_card_provider()
	```
- 화폐
	```python
	fake.pricetag()        # ₩20,000
	fake.currency_name()
	```

##### 인터넷 서비스
- 웹 식별자
	```python
	fake.ipv4()
	fake.mac_address()
	fake.url()
	fake.uri_path()
	```
- 파일과 이미지
	```python
	fake.file_name()
	fake.image_url()
	```

##### 텍스트 생성
- 문장과 문단
	```python
	fake.sentence(nb_words=6)
	fake.paragraph(nb_sentences=3)
	```

##### 장소 정보
- 위도 경도
	```python
	fake.latitude()
	fake.longitude()
	```
- 도시 국가
	```python
	fake.city()
	fake.country()
	```

##### 고급 패턴
- 시드 고정으로 재현 가능성 확보
	```python
	Faker.seed(42)
	```
- 유니크 속성
	```python
	fake.unique.email()
	```
- provider 확장
	```python
	from faker.providers import BaseProvider
	import random

	class ColorProvider(BaseProvider):
		def hex_color(self):
			return '#%06x' % random.randint(0, 0xFFFFFF)

	fake.add_provider(ColorProvider)
	fake.hex_color()
	```
