---
tags:
  - RecSys
created: 2025-06-23T14:33:27
updated: 2025-06-24T01:28:30
---
> [!abstract]+ TL;DR
>-  source : https://www.ismll.uni-hildesheim.de/pub/pdfs/Rendle2010FM.pdf
> - MF 일반화

---
### 데이터 형태
- supervised learning을 위해서 $(\mathbf x, y)$의 형태로 만들어야 함
- "User 5가 Item 4를 보고 Rating 4를 준 데이터"의 경우 다음과 같이 표현 가능 (전체 User 10명, 전체 Item 5개 가정)  
	![[Factorization Machines - 2025-06-24 - 00-05-13.png|604x204]]

---
### 기존 모델들의 문제
- 기본적으로 추천시스템에서 활용하는 데이터는 많은 범주형 변수를 다루기 때문에 $\mathbf x$에 0 많은 sparse한 상태
- 크게 SVM 모델과 Factorization 모델들이 있는데 각각 한계가 있음
##### SVM models
1. Linear Kernel
	$$\large
	\begin{align}
	\hat y(\mathbf x) &= w_0 + \sum_{i=1}^n w_i x_i\\
     &= w_0 + w_u + w_i
	\end{align}
	$$
	- user ,item의 bias만 고려한 아주 기본적인 CF 모형으로 생각할 수 있음
	- 매우 간단해서 sparse해도 추정 잘되긴하는데 당연히 성능은 안좋음
2. Polynomial Kernel
	$$\large
	\begin{align}
	\hat y(\mathbf x) &= w_0 + \sqrt{2}\sum_{i=1}^n w_i x_i + \sum_{i=1}^n w_{i, i}^{(2)}x_i^2 + \sqrt{2} \sum_{i=1}^n \sum_{j=i+1}^n w_{i,j}^{(2)}x_ix_j \\ &=  \hat y(\mathbf x) = w_0 + \sqrt{2}(w_u+w_i) + w_{u, u}^{(2)} + w_{i, i}^{(2)} + \sqrt{2} w_{u, i}^{(2)}
	\end{align}
	$$
	- $\mathbf W^{(2)} \in \mathbb R^{n\times n}$ : symmetric matrix
	- _모든 상호작용 파라미터 $w_{i,j}$를 독립으로 취급_
		- $w_{u, i}$가 업데이트되려면 User u가 Item i를 평가한 훈련데이터가 있어야 함
		- 따라서 Sparse한 상황에서 non-linear 상호작용을 학습하기가 어려움
##### Factorization models
- Sparse한 User - Item Interaction 행렬이 input이라서 일반적인 실수 feature vector 사용할 수 없음
- User, Item 이외에 새로운 feature를 넣고 싶으면 번거로움

---
### Factorization Machine
- high sparsity 에서도 믿을만한 파라미터 추정이 가능하며 SVM처럼 일반적인 predictor로 사용가능한 모델
##### 장점
1. Sparse한 데이터에서 non-linear 관계 파라미터 추정 가능
	- polynomial kernel SVM 처럼 모든 nested variable interaction 모델링을 할 수 있는 것은 동일
	- 하지만 scalar 파라미터 $w_{u, i}$를 두는 것이 아닌 MF처럼 벡터의 내적으로 표현한 'factorized parameterization' 사용
2. Linear time에 계산가능하며 linear number of parameter 보유
3. 임의의 실수 feature vector 사용 가능 
	- feature vector 잘 조정하면 다양한 모델 표현 가능하며 실제로 여러 CF 모델을 일반화한 모델

##### 예시 데이터 형태 
- 7개의 데이터
	- #1 : User 'B'가 Movie 'SW'를 Time '5'에 시청 -> 별점 4
	- #2 : User 'B'가 Movie 'ST'를 Time '8'에 시청 -> 별점 5
	- #3 : User 'C'가 Movie 'TI'를 Time '9'에 시청 -> 별점 1
	- #4 : User 'C'가 Movie 'SW'를 Time '12'에 시청 -> 별점 5
	- #5 : User 'A'가 Movie 'TI'를 Time '13'에 시청 -> 별점 5
	- #6 : User 'A'가 Movie 'NH'를 Time '14'에 시청 -> 별점 3
	- #7 : User 'A'가 Movie 'SW'를 Time '16'에 시청 -> 별점 1

- 기본적으로 User, Item은 사용하고, 그 외의 Auxiliary Features는 자유롭게 사용 -> 이것이 FM의 장점
	![[Factorization Machine - 2025-06-23 - 20-55-23.png|724x331]]
	- User: one hot encoded 유저
	- Movies: 해당 유저가 평가한 one hot encoded 영화
	- Time: 데이터 들어온 시점
	- Other Movies rated: 그 유저가 본 모든 영화 표시
	- Last Movie rated: 직전에 평가한 영화
##### 2-way Factorization Model
$$\large
\begin{align}
\hat y(\mathbf x) &:= w_0 + \sum_{i=1}^n w_ix_i + \sum_{i=1}^n \sum_{j=i+1}^n \langle \mathbf v_i, \mathbf v_j\rangle x_i x_j\\
&= w_0 + \sum_{i=1}^n w_ix_i + \sum_{i=1}^n \sum_{j=i+1}^n (\sum_{f=1}^k v_{i,f}\cdot v_{j,f})x_i x_j\\
&= w_0 + \sum_{i=1}^n w_ix_i + \sum_{i=1}^n \sum_{j=i+1}^n \hat w_{i,j}x_i x_j
\end{align}
$$
- Notation
	- $n$ : data sample의 feature 개수. *총 interaction 데이터 개수가 아니고 위의 그림에서 column의 길이*
	- $x_i$ : ith feature
	- 추정해야할 파라미터는 $w_0\in \mathbb R, \mathbf w \in \mathbb R^n, \mathbf V \in\mathbb R^{n\times k}$ 
		- $w_0$ : global bias
		- $w_i$ : i 번째 변수의 strength
		- $\hat w_{i, j}:=\langle \mathbf v_i, \mathbf v_j\rangle$ : ith, jth 변수간의 interaction -> sparsity하에서 고차원 상호작용 파라미터 추정의 핵심
			- $\langle \cdot, \cdot \rangle$ : dot product
- 2-way FM (d=2)은 모든 single, pairwise interaction 잡아냄


##### Training 예시 : 전체 User 10명, Item 5개인 상황에서 User ID 5가 Item ID 4에 Rating 4를 부여
- User와 Item 만 활용하는 간단한 예시
- Training 과정
	1. Interaction 데이터를 위의 그림 형태로 수정
	2. 임의로 초기화된 파라미터들로 $\hat y$ 계산
	3. 실제 Rating과의 차이로 파라미터 업데이트  
	![[Factorization Machine - 2025-06-23 - 21-07-56.png|790x296]]
- 실제로 위의 예시처럼 User, Item 2가지 feature만 이용해서 FM을 하는 것은 Matrix Factorization과 동일
	- polynomial 항에서 $x_5 \cdot x_{14}$만 1이고 나머지는 모두 0
	![[Factorization Machine - 2025-06-23 - 21-13-10.png|793x348]]

##### 왜 Sparse한 경우 더 유리할까?
- FM에서는 factorization을 통해 $\mathbf v$를 공유함으로써 파라미터의 독립성을 제거 -> sparse함에도 interaction을 추정할 수 있는 것
###### 예시 : User-Item만 활용 : User 100명, Item 20개, 임베딩 차원 $k$ = 4
- 학습해야하는 파라미터 (2차식만)
	- FM : $120\times 4$ -> $O(k(U+I))$   
	- SVM : $100\times 20$  -> $O(U I)$   
	![[Factorization Machines - 2025-06-24 - 00-49-17.png|470x358]]
- 학습 과정 : (user 5, item 4) 관측 예시
	- FM -> $\mathbf v_5, \mathbf v_{13}$ 둘 다 갱신 -> (user 5, 다른 item), (다른 user, item 4) 예측에 반영
	- SVM -> $w_{5, 4}$만 갱신


##### Linear Complexity
- Pairwise Interaction의 시간복잡도는 $O(kn^2)$으로 보이지만 실제로는 $O(kn)$에 계산 가능
	$$\large
	\begin{align}
	\sum_{i=1}^n \sum_{j=i+1}^n \langle\mathbf v_i, \mathbf v_j\rangle x_i x_j &= \frac{1}{2}\sum_{i=1}^n \sum_{j=1}^n \langle \mathbf v_i, \mathbf v_j\rangle x_i x_j - \frac{1}{2}\langle\mathbf v_i, \mathbf v_i \rangle x_ix_i\\
	&=\frac{1}{2} \Bigg(\sum_{i=1}^n\sum_{j=1}^n\sum_{f=1}^k v_{i,f} v_{j,f}x_ix_j - \sum_{i=1}^n\sum_{f=1}^k v_{i,f}v_{i,f}x_ix_i\Bigg)\\
	&=\frac{1}{2}\sum_{f=1}^k\Bigg(\bigg(\sum_{i=1}^n v_{i,f}x_i\bigg)\bigg(\sum_{j=1}^nv_{j,f}x_j\bigg) - \sum_{i=1}^n v_{i,f}^2x_i^2\Bigg)\\
	&=\frac{1}{2}\sum_{f=1}^k\Bigg(\bigg(\sum_{i=1}^n v_{i,f}x_i\bigg)^2- \sum_{i=1}^n v_{i,f}^2x_i^2\Bigg)\\
	\end{align}
	$$

##### Training : 위에서 $O(kn)$으로 변형한 식을 미분해서 SGD
$$\large
\begin{align}
\frac{\partial}{\partial \theta}\hat y(\mathbf x) = \begin{cases}
1, &\text{if $\theta$ is $w_0$}\\
x_i, &\text{if $\theta$ is $w_1$}\\
x_i\sum_{j=1}^n v_{j, f}x_j - v_{i,f}x_i^2, &\text{if $\theta$ is $v_{i,f}$}
\end{cases}
\end{align}
$$


--- 
### 코드
> [!info]+
> - 참고 : https://github.com/rixwew/pytorch-fm/blob/master/torchfm/model/fm.py#L7
> -  User, Item 이외의 Auxiliary를 추가할 수 있는데 아마 one-hot encoding되는 것만 가능한 듯

```python
import torch
from torchfm.layer import FactorizationMachine, FeaturesEmbedding, FeaturesLinear

class FactorizationMachineModel(torch.nn.Module):
    """
    A pytorch implementation of Factorization Machine.

    Reference:
        S Rendle, Factorization Machines, 2010.
    """

    def __init__(self, field_dims, embed_dim):
        super().__init__()
        self.embedding = FeaturesEmbedding(field_dims, embed_dim)
        self.linear = FeaturesLinear(field_dims)
        self.fm = FactorizationMachine(reduce_sum=True)

    def forward(self, x):
        """
        :param x: Long tensor of size ``(batch_size, num_fields)``
        """
        x = self.linear(x) + self.fm(self.embedding(x))
        return torch.sigmoid(x.squeeze(1))

class FeaturesEmbedding(torch.nn.Module):

    def __init__(self, field_dims, embed_dim):
        super().__init__()
        self.embedding = torch.nn.Embedding(sum(field_dims), embed_dim)
        self.offsets = np.array((0, *np.cumsum(field_dims)[:-1]), dtype=np.long)
        torch.nn.init.xavier_uniform_(self.embedding.weight.data)

    def forward(self, x):
        """
        :param x: Long tensor of size ``(batch_size, num_fields)``
        """
        x = x + x.new_tensor(self.offsets).unsqueeze(0)
        return self.embedding(x)
        
class FeaturesLinear(torch.nn.Module):

    def __init__(self, field_dims, output_dim=1):
        super().__init__()
        self.fc = torch.nn.Embedding(sum(field_dims), output_dim)
        self.bias = torch.nn.Parameter(torch.zeros((output_dim,)))
        self.offsets = np.array((0, *np.cumsum(field_dims)[:-1]), dtype=np.long)

    def forward(self, x):
        """
        :param x: Long tensor of size ``(batch_size, num_fields)``
        """
        x = x + x.new_tensor(self.offsets).unsqueeze(0)
        return torch.sum(self.fc(x), dim=1) + self.bias


class FactorizationMachine(torch.nn.Module):

    def __init__(self, reduce_sum=True):
        super().__init__()
        self.reduce_sum = reduce_sum

    def forward(self, x):
        """
        :param x: Float tensor of size ``(batch_size, num_fields, embed_dim)``
        """
        # O(kn^2) -> O(kn)
        square_of_sum = torch.sum(x, dim=1) ** 2
        sum_of_square = torch.sum(x ** 2, dim=1)
        ix = square_of_sum - sum_of_square
        if self.reduce_sum:
            ix = torch.sum(ix, dim=1, keepdim=True)
        return 0.5 * ix
```
