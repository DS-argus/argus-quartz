---
tags:
  - airflow
created: 2025-06-14T21:31:52
updated: 2025-06-14T23:32:27
---
### Variable, Connection을 .env로 관리

docker compose로 airflow를 돌리고 있는데 필요한 variable, connection을 매번 UI에 들어가서 넣기 귀찮아서 직접 넣을 수 있는 방법을 정리해본다  

공식 docs를 보면 [variable](https://airflow.apache.org/docs/apache-airflow/stable/howto/variable.html)과 [connection](https://airflow.apache.org/docs/apache-airflow/stable/howto/connection.html)을 직접 환경변수에 추가해서 사용할 수 있다고 언급하고 있다  
다만 이렇게 할 경우 `docker compose up`을 하면 바로 사용할 수 있지만, web UI에서 확인할 수는 없다

##### 1. Variable

variable의 경우 `AIRFLOW_VAR_{VAR_ID}`로 입력해주면 된다

```title=".env"
AIRFLOW_VAR_FIRST_VARIABLE='my_variable'
AIRFLOW_VAR_SECOND_VARIABLE='{"hello":"world"}'
```

그러면 DAG 코드에서 다음과 같이 사용할 수 있다

```python title="dag.py"
var1 = Variable.get("first_variable")
var2 = Variable.get("second_variable")


# jinja style
select = PostgresOperator(
	task_id="select_from_table",
	postgres_conn_id="postgres_default",
	sql="SELECT dag_id FROM {{var.value.target_table}} LIMIT 5;",
	do_xcom_push=True,
)
```

##### 2. Connection

connection의 경우도 convention은 `AIRFLOW_CONN_{CONN_ID}`로 variable과 유사하다

근데 이제 connection은 그 종류마다 입력해야하는 값이 다양하기 때문에 이 부분이 좀 헷갈리는데  
두 가지 스타일로 작성 가능하다

```text title=".env" {2,5}
# url style
AIRFLOW_CONN_MY_PROD_DATABASE='my-conn-type://login:password@host:port/schema?param1=val1&param2=val2'

# json style
AIRFLOW_CONN_MY_PROD_DATABASE='{"conn_type": "my-conn-type","login": "my-login","password": "my-password", "host": "my-host","port": 1234,"schema": "my-schema","extra": {"param1": "val1","param2": "val2"}}'
```

몇 가지 예시는 다음과 같다
```text title=".env" {2,3,6,9,12}
# aws 예시 : https://airflow.apache.org/docs/apache-airflow-providers-amazon/stable/connections/aws.html#with-a-aws-iam-key-pair
AIRFLOW_CONN_AWS_DEFAULT='aws://{access_key}:{secret_access_key}@'
AIRFLOW_CONN_AWS_DEFAULT=aws://AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI%2FK7MDENG%2FbPxRfiCYEXAMPLEKEY@

# postgres
AIRFLOW_CONN_POSTGRES_DEFAULT='postgresql://airflow:airflow@postgres:5432/airflow'

# spark
AIRFLOW_CONN_SPARK_DEFAULT='{"conn_type":"spark","host":"spark://spark-master","port":7077,"extra":{"master":"spark://spark-master:7077","deploy_mode":"client","spark_binary":"spark-submit"}}'

# telegram
AIRFLOW_CONN_TELEGRAM_BOT='telegram://:{API token}@{Chat ID}'
```

url 스타일로 잘 되는 것도 있고 안되는 것도 있어서 이것저것 해봐야할 듯 하다...

##### 3. `docker-compose.yaml`에 추가해주기

필요한 variable, connection을 `.env`에 추가했으면 `docker-compose.yaml`에 반영해주면 된다

```yaml title="docker-compose.yaml"

x-airflow-common:
	...
	# Connections
	AIRFLOW_CONN_AWS_DEFAULT: ${AIRFLOW_CONN_AWS_DEFAULT:-}
	AIRFLOW_CONN_SPARK_DEFAULT: ${AIRFLOW_CONN_SPARK_DEFAULT:-}
	AIRFLOW_CONN_POSTGRES_DEFAULT: ${AIRFLOW_CONN_POSTGRES_DEFAULT:-}
	
	# Variables
	AIRFLOW_VAR_TARGET_TABLE: ${AIRFLOW_VAR_TARGET_TABLE:-}
	...
```

이렇게 반영한 connection은 variable과 마찬가지로 `aws_default`, `spark_default`, `postgres_default` 등의 이름으로 dag 파일에서 사용하면 된다