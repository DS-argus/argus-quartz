---
tags:
  - pyenv
  - virtualenv
  - conda
  - python
created: 2025-05-27T22:53:24
updated: 2026-01-31T23:52:01
---
> 이젠 [[Python uv - An extremely fast Python package and project manager|uv]] 사용합시다

---
### pyenv란?

[pyenv](https://github.com/pyenv/pyenv)는 다양한 **Python 버전**을 손쉽게 설치, 관리, 전환할 수 있게 해주는 대표적인 버전 관리 도구이다.  
여러 프로젝트에서 서로 다른 Python 버전이 필요할 때 **버전 충돌 없이** 관리할 수 있고 시스템에 기본 설치된 Python을 건드리지 않고, 사용자별로 독립적으로 운영이 가능하다.

##### 주요 특징
- 여러 Python 버전 설치 및 전환 (예: 2.7, 3.8, 3.12 등)
- 디렉토리별(local), 전역(global), 셸(session) 단위로 Python 버전 지정
- `.python-version` 파일로 프로젝트별 Python 버전 고정
- 다양한 파생 Python(CPython, Anaconda, PyPy 등)도 지원

---
### pyenv-virtualenv란?

[pyenv-virtualenv](https://github.com/pyenv/pyenv-virtualenv)는 pyenv의 플러그인으로, **Python 가상환경(virtual environment)** 기능을 추가 제공한다    
각 Python 버전별로 완전히 격리된 패키지 환경을 만들 수 있다


##### 주요 특징
- pyenv로 설치한 각 Python 버전에 대해 별도의 가상환경 생성 및 전환 가능
- 가상환경마다 독립적으로 패키지를 설치·사용, 프로젝트별 의존성 충돌 최소화
- 디렉토리별로 특정 가상환경 자동 활성화 가능 (자동 전환)


---
### pyenv vs conda: 언제 어떤 도구를 쓸까?

보통 가상환경을 관리하는 도구 중 하나로 conda를 많이 사용하기 때문에 차이점을 알아보자

##### conda란?
conda는 **Anaconda/Miniconda** 배포판에서 제공하는 환경 및 패키지 관리 도구이다.  

Python뿐 아니라 R, Julia 등 다양한 언어와 라이브러리, 패키지까지 **한 번에 통합 관리** 가능하고  
특히 과학, 데이터분석, 머신러닝 분야에서 대형 패키지 설치·호환성에 강점을 갖고 있다.  
또한 `conda`라는 명령어를 통해 `pip` 과 같은 패키지 관리자 역할도 할 수 있다

즉, 패키지 관리 + Python 버전 관리 + 가상환경 관리 + 추가 과학, 데이터분석 라이브러리까지 모두 제공해준다.

##### pyenv, conda 비교

| **구분** | **pyenv (+pyenv-virtualenv)** |        **conda**         |
| :----: | :---------------------------: | :----------------------: |
| 관리 대상  |       Python 버전 / 가상환경        | Python / R / 패키지 / 환경 통합 |
| 환경 격리  |     venv / virtualenv로 격리     |       환경 단위로 완전 격리       |
| 패키지 관리 |              pip              |    conda / pip 모두 지원     |
|   강점   |       가볍고 OS 시스템 영향 없음        |  패키지 호환성, 대형 과학 패키지 강점   |
|   단점   |      패키지 의존성 충돌 별도 관리 필요      |    무겁고 디스크 사용 많을 수 있음    |

##### 추천 기준
- 여러 버전의 Python을 **가볍게 관리**하고, 프로젝트별로 **독립적인 가상환경**을 구성하고 싶다 => **pyenv + pyenv-virtualenv** 
	- 개발, 웹, 자동화 등 일반적인 Python 프로젝트에는 이 조합이 가장 심플하고 빠르다.  

- 데이터 분석이나 머신러닝처럼 **복잡한 패키지 의존성**,  또는 **Python 외에도 R, Julia 등 다양한 언어와 라이브러리를 한 번에 관리**해야 한다 =>**conda**
	- 대형 과학 패키지, 다양한 OS 환경에서의 호환성, 설치 편의성이 중요한 상황에 conda를 추천한다.
---

### pyenv 명령어
- pyenv 설치 (macOS)
	```shell
	brew install pyenv
	```

- 셸에 pyenv 환경 적용 (.zshrc) : [참고](https://github.com/pyenv/pyenv?tab=readme-ov-file#b-set-up-your-shell-environment-for-pyenv)
	```shell
	echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
	echo '[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
	echo 'eval "$(pyenv init - zsh)"' >> ~/.zshrc
	```

- 설치 가능한 Python 목록 보기
	```shell
	 pyenv install --list
	```
    
- Python 버전 설치
	```shell
	 pyenv install 3.12.3
	```

- 설치된 Python 목록 보기
	```shell
	 pyenv versions
	```

- 기본(global) Python 버전 설정
	```shell
	 pyenv global 3.12.3
	```

- 디렉토리(local)별 Python 버전 설정
	```shell
	 pyenv local 3.10.13
	```

- 현재 셸(session)에서만 버전 설정
	```shell
	 pyenv shell 3.9.18
	```

- 현재 사용 중인 Python 버전 확인
	```shell
	 pyenv version
	```
    
- pyenv로 설치한 Python 경로 확인
	```shell
	 pyenv which python
	```


---
### pyenv-virtualenv 명령어
- pyenv-virtualenv 설치 (macOS)
	```shell
	brew install pyenv-virtualenv
	```
- shell에 pyenv-virtualenv 환경 적용 
	```shell
	eval "$(pyenv virtualenv-init -)"
	```

- 가상환경 생성
	```shell
	 pyenv virtualenv 3.11.8 myenv311
	```
    
- 가상환경 목록 보기
	```shell
	 pyenv virtualenvs
	```
    
- 가상환경 제거
	```shell
	 pyenv uninstall myenv311
	```

- 디렉토리에 가상환경 지정
	```shell
	 pyenv local myenv311
	```
