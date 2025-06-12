---
tags:
  - LLM
  - vLLM
  - AI
created: 2025-06-12T17:18:43
updated: 2025-06-12T10:17:19
---
> [!info]+ 참고 자료
> - 참고 논문 : [Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/pdf/2309.06180)
> - https://seokhyun2.tistory.com/99 
> - https://pangyoalto.com/pagedattetion-review/

---
### 1. 기존 LLM 추론 방식의 한계
대규모 언어 모델(LLM)은 사용자가 입력한 문장(프롬프트)을 받아 다음 단어나 문장을 예측하며 응답을 생성하는 방식으로 작동함  
이때 매번 예측할 때마다 이전 입력과 결과를 기반으로 생성한 중간 데이터를 **KV 캐시**라는 형태로 GPU 메모리에 연속적으로 보관하려 하기 때문에 막대한 메모리를 소모함  
> 이는 도서관에서 한 권의 책을 찾으려 전체 책장을 통째로 예약하는 것과 비슷해, 실제 사용하는 공간보다 낭비되는 공간이 훨씬 많아져 **메모리 단편화**가 심각해짐  

또한, 요청이 여러 개 있을 때 이를 하나의 묶음(배치)으로 처리하는데, 이 배치는 고정적이라 **가장 긴 요청**이 끝나야 다른 요청이 들어갈 수 있어 응답이 느려지고 처리량도 감소함  

- 동일한 프롬프트를 갖는 요청이 여러 개일 경우 KV 캐시가 중복되어 메모리 낭비 증가  
- GPU 메모리의 60-80%가 사실상 유휴 상태로 남아, 자원이 제대로 활용되지 않음  
- 짧은 요청마저 긴 요청과 함께 처리되면서 불필요한 대기 시간 발생  
- 빔 서치 및 병렬 샘플링 과정에서도 중복 KV 캐시가 생성되어 메모리 소모 증가  

---

### 2. vLLM의 목표와 등장 배경
UC 버클리의 Sky Computing Lab은 기존의 LLM 추론 방식에서 메모리 관리가 가장 큰 병목이라는 점을 발견함  
이에 운영체제에서 사용되는 가상 메모리 개념을 어텐션 메커니즘에 적용한 **PagedAttention**이라는 아이디어를 제안함  

vLLM은 이 PagedAttention 기술을 활용해 GPU 메모리의 낭비를 거의 제거하고, 연속적으로 배치를 처리하여 GPU 자원을 최대한 활용하는 것을 목표로 등장함  
모델 구조나 가중치 수정 없이 기존 Hugging Face 추론 대비 최대 24배 높은 처리량을 보여, 빠르게 LLM 서비스의 표준으로 자리 잡고 있음  

- 메모리를 작은 단위(페이지)로 나누어 필요할 때만 할당하는 방식  
- 요청이 들어오는 즉시 처리할 수 있도록 동적 배칭을 지원하여 GPU 활용도를 극대화  
- [vLLM 블로그](https://blog.vllm.ai)에 따르면, NVIDIA A100 GPU 하나로 LLaMA-13B 모델의 추론 속도를 24배 증가시킴  

---

### 3. PagedAttention 핵심 개념
PagedAttention은 KV 캐시를 연속된 메모리가 아닌 작은 **고정 크기 블록** 단위로 나누어 비연속적으로 저장하고, 각 블록을 페이지 테이블로 관리하는 방식을 사용함  
이는 책장을 작은 서랍으로 나눠 필요한 책만 정확히 꺼내 사용하는 방식과 유사하며, 이로 인해 KV 캐시의 메모리 낭비가 4% 미만으로 크게 줄어듦  

동일한 프롬프트를 공유하는 여러 요청이 있다면 같은 블록을 공유하여, 메모리 소모량을 절반 이상 절약하는 **Copy-on-Write** 기법을 적용함  

- 각 시퀀스는 실제 필요한 만큼의 블록만 할당받아 메모리 효율 극대화  
- 병렬 샘플링이나 빔 서치 시에도 메모리 사용을 55% 줄이고 처리량은 2배 이상 증가  

---

### 4. 아키텍처 및 작동 방식
vLLM의 핵심 요소 중 하나인 **연속 배칭 스케줄러**는 실행 중인 배치에서 빈 슬롯이 발생하면 실시간으로 새로운 요청을 추가해 GPU 유휴 시간을 없애고 효율성을 높임  

PagedAttention을 기반으로 메모리 블록을 효율적으로 재활용해 단편화를 방지하며, FlashAttention·CUDA Graph·FlashInfer 등의 최신 기술을 결합해 성능을 극대화함  

개발자는 `pip install vllm` 한 줄로 쉽게 vLLM을 설치하고 바로 활용할 수 있으며, OpenAI와 호환되는 REST API를 기본 제공해 기존 서비스와 빠르게 통합 가능함  

- 빈 슬롯을 즉시 채우는 연속 배칭으로 지연 최소화  
- FlashAttention 적용으로 어텐션 연산 속도를 획기적으로 높임  
- CLI로 간단히 OpenAI 호환 서버를 시작 가능:  `python -m vllm.entrypoints.openai.api_server`

---

### 5. 주요 성능 비교
- Hugging Face Transformers와 비교해 처리량은 최소 10배 이상 높고, 지연도 현저히 낮음  
- Hugging Face TGI 대비 처리량은 2-3배 뛰어남  
- DeepSpeed-FastGen은 극단적인 케이스에서만 우세하며 일반적으로 vLLM이 동급 이상의 성능 제공  
- NVIDIA의 FasterTransformer는 단일 요청 처리 속도는 빠르나 다중 요청 처리 시 vLLM이 2-4배 우세  

---

### 6. 채택 사례와 생태계
실제로 LMSYS의 Vicuna 챗봇과 [Chatbot Arena](https://arena.lmsys.org)는 Hugging Face에서 vLLM으로 전환해 동일 하드웨어로 5배 이상 많은 요청을 처리하면서 지연도 대폭 감소시킴  

아마존 Rufus, 링크드인의 AI 추천 기능, 레드햇의 AI 서버 등 다양한 기업의 프로덕션 서비스에서 vLLM을 사용하고 있음  
LangChain, FastChat, LlamaIndex 등 인기 프레임워크와도 통합되어 개발자 접근성이 더욱 높아짐  

- 기업 서비스 및 연구 환경 모두에서 폭넓은 사용  
- GPU 사용 효율 증가로 운영 비용이 최대 50% 절감된 사례 보고  
- 활발한 오픈소스 커뮤니티를 통해 신속한 지원과 발전 이루어짐  

---

### 7. 오픈소스 지원 범위
vLLM은 Apache 2.0 라이선스 아래 공개되어 기업과 개인이 자유롭게 사용할 수 있음  
LLaMA, Mistral, Falcon, StarCoder 등 인기 있는 모델들을 별도의 수정 없이 즉시 실행할 수 있으며, GPU뿐만 아니라 AMD ROCm, TPU, AWS Inferentia2 등 다양한 하드웨어도 지원함  

- Hugging Face 모델을 URL로 쉽게 불러올 수 있음  
- GPTQ·AWQ와 같은 양자화 기법을 지원해 자원 효율성 더욱 높임  
- 최신 디코딩 기법인 Speculative Decoding 및 Chunked Prefill도 제공됨  

---

### 8. 최신 연구 동향
ACM SOSP 2023 논문에서는 PagedAttention으로 메모리 낭비를 거의 제거하고 처리량을 2-4배 높일 수 있음을 입증함  
경쟁자인 DeepSpeed, Hugging Face, NVIDIA 역시 유사한 메모리 최적화 방식을 도입하며 vLLM과 성능 경쟁 중이며, Ray 프로젝트는 vLLM을 통해 처리량이 기존 대비 23배 증가했다고 보고함  

vLLM 또한 FlashAttention 2, Speculative Decoding, 멀티모달 입력 지원 등을 추가하며 빠르게 발전하고 있음  

---

### 9. 향후 로드맵과 과제
현재는 GPT-4급 초거대 모델을 효율적으로 실행하기 위한 새로운 메모리 구조를 연구 중이며, 긴 입력 맥락 처리 성능 개선을 목표로 함  
작업 특화 기능(MoE 모델, 코드 생성 지원, 에이전트 통합 등) 확대와 분산 클러스터 추론 효율 개선을 계획 중임  
추론뿐 아니라 학습 과정까지 지원하는 종합 엔진으로 발전하는 것이 최종 목표로 설정됨  