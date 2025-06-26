---
tags:
  - RecSys
created: 2025-06-26T09:37:38
updated: 2025-06-26T09:44:47
---
> [!abstract]+ TL;DR
>- source : https://www.ijcai.org/proceedings/2017/0447.pdf
>- [[Neural Collaborative Filtering (2017)|NCF]]와 input 다름
>- **Contributions**
> 	 1. Explicit, Implicit feedback 모두 사용
> 	 2. Explicit, Implicit 모두 사용할 때 사용가능한 Loss 제안

---
### DMF
![[2017 Deep Matrix Factorization Models for Recommender Systems - 2025-06-26 - 09-36-35.png|917x833]][^1]

##### 문제 세팅
- Explicit Rating을 고려한 Interaction matrix 사용
	$$\large
	\begin{align*}
	Y_{ij} = \begin{cases} 0, &\text{if $R_{ij}= unk$},\\
	R_{ij} &\text{otherwise}
	\end{cases}
	\end{align*}
	$$
- one-hot encoding된 user, item 벡터를 input으로 사용하는 것이 아니라 interaction matrix 바로 사용

##### Loss
$$\large
\begin{align*}
L = - \sum_{(i, j) \in Y^+ \cup Y^-} \Big({\color{red}\frac{Y_{ij}}{max(R)}} \log \hat Y_{ij} + \big(1-{\color{red}\frac{Y_{ij}}{max(R)}}\log(1-\hat Y_{ij})\Big)
\end{align*}
$$

[^1]: https://github.com/RuidongZ/Deep_Matrix_Factorization_Models/blob/master/Model.py
