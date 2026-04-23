---
tags:
  - linux
  - process
created: 2026-03-31T00:00:00
updated: 2026-03-31T00:00:00
permalink: /Dev/linux/nice-and-renice
---

> [!warning]+ Alert
> 이 글은 Claude Code의 도움을 받아 작성되었습니다

### nice와 renice : 프로세스 우선순위 제어

##### 배경 : Linux 프로세스 스케줄링과 우선순위
- Linux 커널은 CPU 시간을 여러 프로세스에 분배하는데, 이때 각 프로세스의 **우선순위(priority)** 를 참고
- 우선순위가 높은 프로세스가 더 많은 CPU 시간을 할당받음
- 우선순위에 영향을 주는 값이 바로 **nice 값**

##### nice 값 (Niceness)
- 범위 : **-20 ~ 19**
	- -20 : 가장 높은 우선순위 (가장 "이기적인" 프로세스)
	- 19 : 가장 낮은 우선순위 (가장 "양보하는" 프로세스)
	- 0 : 기본값
- "nice"라는 이름의 의미 : 값이 클수록 다른 프로세스에게 **양보(nice)** 한다는 뜻
- nice 값과 실제 커널 우선순위(PRI)의 관계
	- `PRI = 20 + nice` (일반적으로)
	- PRI 값이 낮을수록 우선순위 높음

```bash title="현재 프로세스의 nice 값 확인"
# ps로 확인 (NI 컬럼) — Linux/macOS 공통
ps -el | head -5
#   F S   UID   PID  PPID  C PRI  NI ADDR SZ WCHAN  TTY          TIME CMD
#   4 S     0     1     0  0  80   0 -  ...  -      ?        00:00:03 systemd

# 특정 프로세스의 nice 값만 확인
ps -o pid,ni,comm -p <PID>

# Linux top — NI 컬럼이 기본으로 표시됨
top
# PID USER  PR  NI    VIRT    RES    SHR S  %CPU  %MEM   TIME+ COMMAND
#   1 root  20   0  ...                                   systemd
```

> [!info] macOS의 top은 NI 컬럼이 기본으로 표시되지 않음
> macOS에서는 `top`의 컬럼 구성이 Linux와 다르기 때문에, nice 값을 확인하려면 `ps -o pid,ni,comm` 명령을 사용하는 것이 확실함

---
### nice : 프로세스를 **시작할 때** 우선순위를 지정

##### 기본 사용법
```bash title="nice 명령어"
# 기본: nice 값 10으로 실행 (기본 증가분이 10)
nice long_running_script.sh

# nice 값을 지정하여 실행
nice -n 15 python heavy_batch_job.py
# → nice 값 15로 실행 (낮은 우선순위, 다른 프로세스에 양보)

nice -n -5 ./critical_service
# → nice 값 -5로 실행 (높은 우선순위)
# ⚠️ 음수 값은 root 권한 필요
```

##### 실무 활용 예시
```bash title="nice 실무 예시"
# 1. 백업 작업 : CPU를 많이 쓰지만 급하지 않으니 낮은 우선순위로
nice -n 19 tar -czf /backup/data.tar.gz /data/

# 2. 로그 압축 : 서비스에 영향 주지 않도록
nice -n 15 gzip /var/log/app-2026-03-30.log

# 3. 배치 작업 (ETL 등) : 운영 서비스보다 후순위로
nice -n 10 python etl_pipeline.py

# 4. 중요한 서비스 : 높은 우선순위로 실행 (root 필요)
sudo nice -n -10 ./realtime_processor
```

---
### renice : **이미 실행 중인** 프로세스의 우선순위를 변경

##### 기본 사용법
```bash title="renice 명령어"
# PID로 우선순위 변경
renice -n 10 -p 12345
# → PID 12345의 nice 값을 10으로 변경

# 특정 사용자의 모든 프로세스 우선순위 변경
renice -n 5 -u username

# 특정 그룹의 모든 프로세스 우선순위 변경
renice -n 5 -g groupname
```

##### 실무 활용 예시
```bash title="renice 실무 예시"
# 1. CPU를 과도하게 점유하는 프로세스 발견 시
top
# PID 8823이 CPU 95% 사용 중 → 우선순위를 낮춰서 다른 서비스에 양보시킴
renice -n 19 -p 8823

# 2. 반대로 중요한 프로세스가 느려질 때 우선순위를 높임 (root 필요)
sudo renice -n -10 -p 5567

# 3. 특정 사용자의 배치 작업 전체를 낮은 우선순위로
sudo renice -n 15 -u batch_user
```

---
### nice vs renice 비교

| 항목 | nice | renice |
| :--- | :--- | :--- |
| 적용 시점 | 프로세스 **시작 시** | **실행 중인** 프로세스 |
| 대상 지정 | 실행할 명령어 | PID, 사용자, 그룹 |
| 기본 동작 | nice 값 10 증가 | 지정한 값으로 변경 |
| 사용 예 | `nice -n 15 ./job.sh` | `renice -n 15 -p 1234` |

---
### 권한 제한

| 동작 | 일반 사용자 | root |
| :--- | :--- | :--- |
| nice 값 높이기 (0 → 19) | ✅ 가능 | ✅ 가능 |
| nice 값 낮추기 (0 → -20) | ❌ 불가 | ✅ 가능 |
| 한번 높인 nice 값 다시 낮추기 | ❌ 불가 | ✅ 가능 |
| 다른 사용자 프로세스 변경 | ❌ 불가 | ✅ 가능 |

- 일반 사용자는 **자기 프로세스의 nice 값을 높이는 것(우선순위 낮추기)만** 가능
- 한번 양보(nice 값 증가)하면 다시 되돌릴 수 없음 → root만 가능

```bash title="권한 제한 확인"
# 일반 사용자가 음수 nice 값 시도 시
nice -n -5 ./script.sh
# nice: cannot set niceness: Permission denied

# root로 실행하면 가능
sudo nice -n -5 ./script.sh
```

---
### 참고 : nice와 함께 알면 좋은 명령어

```bash title="관련 명령어"
# 1. ionice : 디스크 I/O 우선순위 제어 (nice는 CPU 우선순위)
ionice -c 3 -p 12345          # Idle 클래스로 변경 (다른 I/O 없을 때만 사용)
ionice -c 2 -n 7 dd if=/dev/sda of=/backup/disk.img  # Best-effort, 낮은 우선순위

# 2. nice + ionice 조합 : CPU와 I/O 모두 낮은 우선순위로
nice -n 19 ionice -c 3 tar -czf /backup/full.tar.gz /data/

# 3. cpulimit : CPU 사용률 자체를 제한 (nice와는 다른 접근)
cpulimit -l 30 -p 12345      # PID 12345의 CPU 사용률을 30%로 제한

# 4. cgroups : 프로세스 그룹 단위로 리소스(CPU, 메모리, I/O) 제한
# systemd를 사용하는 경우 서비스 단위로 설정 가능
# /etc/systemd/system/myservice.service 에서:
# [Service]
# CPUWeight=50
# Nice=10
```
