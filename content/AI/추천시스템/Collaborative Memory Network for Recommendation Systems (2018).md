---
tags:
  - RecSys
created: 2025-07-03T14:17:07
updated: 2025-07-03T16:25:30
---
> [!abstract]+ TL;DR
> - source : https://arxiv.org/pdf/1804.10862
> - code : https://github.com/tebesu/CollaborativeMemoryNetwork/tree/master
> - 일반적으로 Collaborative Filtering는 크게 두 가지
> 	- Latent factor 모델 : MF같은 것으로 global 구조 잘 학습
> 	- Neighborhood 기반 모델 : Local 구조 잘 학습  
> 	- (SVD++같이 2개를 합친 hybrid도 있음)
> - Latent factor와 Neighborhood 기반 모델을 딥러닝으로 결합
> 	- Memory Network라는 구조를 도입해서 유사한 user에 대한 정보를 처리ㅁ
> - **Contributions**
> 	- External memory와 neural attention을 이용한 Collaborative Memory Network (CMN) 구조 제시. 
> 		- attention 메커니즘이 이웃 정보에 대한 nonlinear한 weight를 adaptive하게 학습
> 		- output module은 이웃에 대한 정보와 user, item 정보를 nonlinear하게 결합
> 	- CMN과 대표적인 2개의 CF 모델 (latent factor, neighborhood-based)과의 관련성 밝혀냄

---
### Memory Augmented Neural Networks
- 정의 : 일반적인 신경망에 외부 메모리 컴포넌트 추가해서 모델의 능력 향상시킨 구조
- 주요 구성 요소
	- 외부 메모리 : 행렬 형태로 지식 저장하는 역할
	- 컨트롤러 : 일반적으로 NN을 이용해 메모리에 대한 연산 수행
- Associative Addressing 메모리 접근 방식 : 주어진 쿼리와 메모리에 저장된 내용 간의 유사성을 계산해서 메모리 위치 찾는 방식
	- inner product + softmax 를 통해 계산
	- attention 메커니즘과 유사해서 중요하다고 생각되는 메모리 위치에 더 높은 가중치 부여

---
### Collaborative Memory Network (CMN)
##### 세 가지의 메모리 (Input) 
- User specific memory $\mathbf  M \in \mathbb R^{P\times d}$ : 각 사용자의 고유한 선호도 저장
	- 총 $P$명의 User가 있을 때, 각 User에 대한 임베딩 행렬
- Item specific memory $\mathbf E \in \mathbb R^{Q\times d}$ : 각 아이템의 고유한 속성 저장
	- 총 $Q$개의 Item이 있을 때, 각 Item 대한 임베딩 행렬
- collective neighborhood state $\mathbf  C \in \mathbb R^{P\times d}$ : 특정 아이템에 대해 피드백을 제공한 사용자들(이웃)의 집합적인 선호도 저장
	- row : **사용자 v가 과거에 소비한 아이템·컨텍스트를 요약**한 representation
	- attention 수행할 때, value로 가져와서 neighborhood 집합 정보 전달

##### Neighborhood Attention
> 그래서 여기서는 어떻게 이웃에 대한 정보를 활용하는거지?  

![[Collaborative Memory Network for Recommendation Systems (2018) - 2025-07-03 - 14-54-15.png|812x468]]
- 특정 User와 Item 조합 $\set{u, i}$에 대해서 먼저 item $i$와 상호작용한 user 리스트 $N(i)$  확인 (본인 포함)
- $|N(i)|$ 크기의 user preference vector $\mathbf q_{ui}$ 생성
	- 각 차원의 의미 : User $u$와 이웃인 $v$ 와의 관계, 상대적 중요도
- $\mathbf q_{ui}$의 각 차원에 softmax 씌워서 $\mathbf c_{v}$를 weighted sum해서 최종 neighborhood representation $\mathbf o_{ui}$ 생성

> CMN은 유저들 간의 유사점을 잡아내고 target item에 기반해서 각 이웃들의 기여도를 동적으로 할당
> - $\mathbf m_u, \mathbf e_i$ : '현재 $u, i$의 관점에서 어떤 이웃이 중요할까'를 찾는 Key
> - $\mathbf c_v$ : '각 이웃이 오랜 기간 축적해온 특성'을 담은 Value
> - $\mathbf o_{ui}$ : 과거 행동이 농축된 장기 패턴 반영


##### Output Module
> 그래서 최종적으로 예측을 어떻게 하는거지?

![[Collaborative Memory Network for Recommendation Systems (2018) - 2025-07-03 - 15-00-02.png|461x544]]

- 왼쪽 부분에서는 neighborhood attention 진행해서 최종적으로 $\mathbf o_{ui}$ 나옴
- 오른쪽 부분에서는 내적 + MLP
- 최종적으로 concat하고 MLP, ReLU 태워서 예측
- 장점
	- 특정 user에 대한 feedback이 sparse할 때, 이웃도 활용하기 때문에 유리
	- neural attention 메커니즘이 알아서 특정 item에 대한 각 user의 기여도를 조정
	- local neighborhood와 global latent factor 간의 nonlinear 상호작용 학습

> Neighborhood attention으로 얻은 이웃 기반 정보 + User, Item의 임베딩을 이용한 Latent factor 기반 정보 nonlinear하게 결합


##### Loss : BPR optimization criterion 사용[^1]
$$\large
\begin{align*}
\mathcal L = - \sum_{(u, i^+, i^-)} \log \sigma(\hat r_{ui^+} - \hat r_{ui^-}) + \lambda||\Theta||^2
\end{align*}
$$
- 사용자가 실제로 상호작용한 아이템은 보지 않은 아이템보다 선호된다”라는 **pairwise 순위** 가정을 최대로 만족하도록 파라미터 Θ를 학습
- $\sigma(x) = 1/(1+\exp(-x))$ 이고 기본값으로 L2 regularization
- 특징
	- **AUC(Area Under ROC Curve)** 와 밀접: 위 목적식은 기대 AUC를 직접 최대화하는 log likelihood
	- **Smooth & Differentiable**: sigmoid 기반이라 hinge·ranking loss 대비 부드럽고 미분 가능
	- **Implicit feedback 친화적**: explicit feedback이 없어도 학습 가능
	- **Pairwise Sampling 필요**: 학습 미니배치마다 $(u,i^+,i^-)$ 삼중쌍을 무작위로 샘플링하여 SGD 업데이트

##### Multiple Hops
>  좀 더 memory network 성능 개선을 위해 여러 번 반복

![[Collaborative Memory Network for Recommendation Systems (2018) - 2025-07-03 - 15-51-35.png|857x456]]
- 첫번째 attention의 결과인 $\mathbf o_{ui}^1$ 과 $\mathbf z_{ui}^0$을 MLP로 결합해서 다음 hop의 input 생성
$$\large
\begin{align*}
&{\color{purple}\mathbf z_{ui}^h} = \phi(\mathbf W^h\mathbf z_{ui}^{h-1} + \mathbf o_{ui}^h+\mathbf b^h)\\
\\
&\mathbf q_{uiv}^{h+1} = ({\color{purple}\mathbf z_{ui}^h})^{\top} \mathbf m_v \quad \forall v \in N(i)
\end{align*}
$$

##### 다른 모델과의 관계
1. Latent Factor Model
	- rating 행렬을 저 차원 행렬의 곱으로 표현해서 숨겨진 관계 발견
	- CMN에서 이웃 정보 처리하는 부분과 MLP,  activation function 단순화 하면 [[Neural Collaborative Filtering (2017)|GMF]]와 동일
2. Neighborhood-based Similarity Model
	- 목적 : user-user similarity 행렬 $\mathbf S \in \mathbb R^{P\times P}$ 추정
	- memory module이 similarity 행렬 역할 수행

3. Hybrid Model
	- SVD ++ 는 1, 2를 합친 방식으로 동작
		$$\large
		\begin{align*}
		\hat r_{ui} = \mathbf v^\top \phi(\mathbf u_u \odot \mathbf e_i \quad + \quad \sum_{v\in N(i)} p_{uiv}\mathbf c_v)
		\end{align*}
		$$
	- MLP랑 activation function만 잘 처리하면 동일


[^1]: https://velog.io/@zxxzx1515/논문-리뷰-BPR-Bayesian-Personalized-Ranking-from-Implicit-Feedback
