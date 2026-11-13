import type { WorkbenchDocument } from "@/core/contracts/document-ast";

export const ASYNCFLOW_DEMO_DOCUMENT: WorkbenchDocument = {
  id: "demo-repo-asyncflow",
  modeId: "repo-deconstruct",
  modeName: "源码架构拆解",
  isDemo: true,
  title: "AsyncFlow — 高并发分布式延迟任务调度与幂等引擎源码拆解",
  subtitle: "Mode 03 Demo · Go + Redis Lua 原子时间轮 / 死信重试 / Worker 协程池深度架构解剖",
  badges: [
    "Demo 预设示例 · 后端架构源码",
    "Go 1.22 + Redis Lua",
    "4 大核心模块 + L1-L3 压力测试",
  ],
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
  layoutRatio: [58, 42],
  dimensions: [
    {
      key: "dim1",
      colorSlot: "yellow",
      label: "系统入口/路由",
      extractionRule: "HTTP/RPC 入口与主调度起点。",
    },
    {
      key: "dim2",
      colorSlot: "red",
      label: "核心状态与算法 (悬停释义)",
      extractionRule: "并发锁、原子脚本、状态机流转核心（附面试口述原理解析）。",
      enableTooltip: true,
    },
    {
      key: "dim3",
      colorSlot: "blue",
      label: "边界校验与容错",
      extractionRule: "幂等防御、指数退避重试、优雅停机与兜底策略。",
    },
    {
      key: "dim4",
      colorSlot: "green",
      label: "性能与并发权衡",
      extractionRule: "协程池限流、Lua RTT 合并与空间换时间权衡。",
    },
    {
      key: "dim5",
      colorSlot: "purple",
      label: "潜在盲区/追问点",
      extractionRule: "面试官高频追问漏洞、时钟偏移或内存放大风险。",
    },
  ],
  labels: {
    paretoButton: "[20/80 核心源码聚焦]",
    toggleSecondaryButton: "[显/隐逻辑白话]",
    toggleNotesButton: "[显/隐面试批注]",
    exportMdButton: "[导出面试手记 Markdown]",
    exportHtmlButton: "[编译离线单文件 .HTML]",
    userNoteButton: "[+ 添加本模块二次开发备忘]",
    userNotePlaceholder: "在此记录该模块在简历上的阐述切入点或准备改造的 Patch 思路...",
    transitionPrefix: "[GLUE CODE / 装配过渡层]",
    mentalNavLabel: "00. 20/80 架构图与调用链",
    bottomNavLabel: "08. 简历武装、压力测试与改造方案",
  },
  sections: [
    {
      id: "sec-mod-1",
      navLabel: "01. 幂等入队引擎",
      navRole: "核心入口",
      title: "01. internal/scheduler/enqueue.go · 幂等校验与延迟时间轮投递",
      taskBadge: "核心源码 · 防重入 + Redis ZSET + Hash 状态落盘",
    },
    {
      id: "sec-mod-2",
      navLabel: "02. Lua 原子捞取",
      navRole: "核心引擎",
      title: "02. internal/store/poll_due.lua · 零竞态到期任务批量摘取与租约续期",
      taskBadge: "核心源码 · 消除分布式锁开销",
    },
    {
      id: "sec-mod-3",
      navLabel: "03. Worker 协程池",
      navRole: "并发执行",
      title: "03. internal/worker/pool.go · 有界信号量并发控制与指数退避重试",
      taskBadge: "核心源码 · 过载保护 + 优雅退避",
    },
    {
      id: "sec-mod-4",
      navLabel: "04. 优雅停机与心跳",
      navRole: "容错兜底",
      title: "04. internal/worker/shutdown.go · In-Flight 任务等待与租约回收",
      taskBadge: "非核心外围但面试必问的高可用拼图",
    },
  ],
  topMentalModel: {
    title: "00. 20/80 架构导读与主调用链路图",
    subtitle: "用 20% 核心引擎源码覆盖 80% 面试拷问点：避免背目录，直接掌控状态流与并发边界",
    rawSummaryBanner: {
      tag: "一句话看透项目本质",
      body: "AsyncFlow 本质上是一个基于「Redis ZSET 延迟有序集合 + Lua 单线程原子摘取 + Go 有界 Worker 池」的轻量级分布式异步调度引擎：它用一条原子 Lua 脚本替代了繁重的 Redlock 分布式锁，实现了万级 QPS 下的精确一次投递（At-Least-Once + 业务幂等）和秒级故障恢复。",
    },
    cards: [
      {
        tag: "20% 必读核心引擎",
        body: "集中精力吃透 3 块逻辑：1) Enqueue 的双写去重与 ZSET 分片打分；2) PollDue 的 Redis Lua 原子状态迁移（Delayed -> Processing + Invisible Timeout）；3) Worker Pool 的 panic 捕获、指数退避与死信转移。",
      },
      {
        tag: "80% 可跳过外围文件",
        body: "CLI 参数解析 (cmd/cli)、Prometheus 指标暴露端点、OpenAPI YAML 定义及数据库 Migration 脚手架属于标准工程模板，面试时一笔带过即可，切忌浪费时间精读。",
      },
      {
        tag: "面试最爱追问的 3 条暗线",
        body: "1) 多 Worker 实例同时扫 ZSET 如何避免同一任务被重复执行？ 2) Worker 执行到一半进程 OOM 被杀掉，任务会永久卡在 Processing 吗？ 3) 百万级延迟任务堆积在单个 Redis ZSET 热 Key 上如何打散扩容？",
      },
    ],
    comparisonPair: {
      leftTitle: "普通面试者复述（只浮于功能表层）",
      leftTone: "danger",
      leftItems: [
        "我做了一个异步任务系统，用 Go 把任务存进 Redis ZSET，后台开定时器每秒轮询捞取并执行。",
        "被问到并发重复消费时回答：我在代码里加了 Redis SETNX 分布式锁（随即被追问锁过期、锁续期与死锁问题而卡壳）。",
      ],
      rightTitle: "架构师级拆解（直击底层权衡与原子性）",
      rightTone: "success",
      rightItems: [
        "我将 ZSET 到期扫描、任务弹出与租约超时重入队列合并进单段 Lua 脚本，利用 Redis 单线程事件循环消除跨节点锁争抢与 3 次 RTT 网络往返。",
        "同时为每个任务引入基于 visibility_timeout 的隐形租约队列，Worker 崩溃后无需人工干预，租约到期自动触发 Requeue。",
      ],
    },
    diagram: {
      title: "AsyncFlow 核心调度与状态流转调用链（点击节点定位对应源码）",
      hint: "蓝色实线为主链路调用，点击任意模块直接跳转右侧源码逐行拆解",
      rankdir: "LR",
      nodes: [
        {
          id: "n_api",
          label: "1. HTTP / gRPC 入口",
          subLabel: "Idempotency Check",
          targetUnitId: "mod-1-u-1",
          colorSlot: "yellow",
        },
        {
          id: "n_zset",
          label: "2. Redis Pipeline",
          subLabel: "Hash + ZSET 延迟桶",
          targetUnitId: "mod-1-u-1",
          colorSlot: "blue",
        },
        {
          id: "n_lua",
          label: "3. Lua 原子摘取",
          subLabel: "ZRANGE + ZADD 租约",
          targetUnitId: "mod-2-u-1",
          colorSlot: "red",
        },
        {
          id: "n_pool",
          label: "4. Worker 协程池",
          subLabel: "Semaphore + Backoff",
          targetUnitId: "mod-3-u-1",
          colorSlot: "green",
        },
        {
          id: "n_grace",
          label: "5. 优雅退场 & 回收",
          subLabel: "WaitGroup + Reclaim",
          targetUnitId: "mod-4-u-1",
          colorSlot: "purple",
        },
      ],
      edges: [
        { from: "n_api", to: "n_zset", label: "SETNX 防重入" },
        { from: "n_zset", to: "n_lua", label: "到期时间戳命中" },
        { from: "n_lua", to: "n_pool", label: "原子分发 Payload" },
        { from: "n_pool", to: "n_grace", label: "ACK / NACK 退避" },
      ],
    },
    glossaryTitle: "项目底层核心机制速查表（面试脱口秀弹药库）",
    glossary: [
      {
        term: "Visibility Timeout（隐形租约队列）",
        badge: "核心机制",
        definition: "任务被 Worker 领走时不直接删除，而是把它的 Score 加上 30s 租约重新写入 Processing ZSET；若 Worker 崩溃未按时 ACK，30s 后其他节点会自动重新捞取。",
      },
      {
        term: "Redis Lua 单线程原子化",
        badge: "并发保障",
        definition: "把「查到期列表 -> 删延迟队 -> 写进行中租约 -> 更新元数据状态」打包为单条 EVALSHA，Redis 执行期间隔离所有其他命令，彻底省去外部分布式锁。",
      },
      {
        term: "Idempotency Key + TTL 窗口",
        badge: "防重入",
        definition: "请求入队前用业务方提供的幂等键做原子占位，避免网关重试或上游抖动产生幽灵重复任务。",
      },
      {
        term: "Jittered Exponential Backoff",
        badge: "防雪崩",
        definition: "失败重试延迟按 2^attempt + 随机抖动计算，避免下游恢复瞬间被所有失败任务同时齐射打垮（Thundering Herd）。",
      },
    ],
  },
  units: [
    {
      id: "mod-1-u-1",
      unitCode: "enqueue.go · Unit 1.1",
      sectionId: "sec-mod-1",
      sectionTitle: "01. internal/scheduler/enqueue.go · 幂等校验与延迟时间轮投递",
      sectionTask: "核心源码 · 防重入 + Pipeline 原子入队",
      weight: "core",
      tldr: "通过 TxPipeline 把幂等键占位、任务实体 Hash 写入和 ZSET 时间轮投递合并为单次网络往返。",
      primaryKind: "code",
      codeLanguage: "go",
      filePath: "internal/scheduler/enqueue.go",
      primaryText: `func (s *Scheduler) Enqueue(ctx context.Context, task *TaskPayload, delay time.Duration) (string, error) {
	if task.IdempotencyKey != "" {
		ok, err := s.rdb.SetNX(ctx, "idem:"+task.IdempotencyKey, task.ID, 24*time.Hour).Result()
		if err != nil {
			return "", fmt.Errorf("idempotency guard failed: %w", err)
		}
		if !ok {
			return "", ErrDuplicateTask
		}
	}

	executeAt := time.Now().Add(delay).UnixMilli()
	shardBucket := s.resolveDelayBucket(task.ID)

	pipe := s.rdb.TxPipeline()
	pipe.HSet(ctx, "task:meta:"+task.ID, map[string]any{
		"payload":    task.RawBody,
		"max_retry":  task.MaxRetry,
		"attempt":    0,
		"state":      StateScheduled,
	})
	pipe.ZAdd(ctx, shardBucket, redis.Z{
		Score:  float64(executeAt),
		Member: task.ID,
	})
	if _, err := pipe.Exec(ctx); err != nil {
		return "", err
	}
	return task.ID, nil
}`,
      formulas: [
        {
          latex: "",
          flowLabel: "STATE & DATA FLOW",
          flowText: "TaskPayload -> SETNX(idem:{key}, 24h) -> shardBucket(CRC32 % N) -> TxPipeline(HSet meta + ZAdd score=executeAt)",
        },
      ],
      highlights: [
        {
          text: `s.rdb.SetNX(ctx, "idem:"+task.IdempotencyKey, task.ID, 24*time.Hour)`,
          dim: "dim3",
        },
        {
          text: "shardBucket := s.resolveDelayBucket(task.ID)",
          dim: "dim2",
          tooltip: "分片延迟桶：通过哈希将任务打散到 N 个独立的 ZSET Key，避免百万级延迟任务压垮单个 Redis Slot 的单线程与大 Key 问题。",
        },
        {
          text: "pipe := s.rdb.TxPipeline()",
          dim: "dim4",
        },
        {
          text: "executeAt := time.Now().Add(delay).UnixMilli()",
          dim: "dim5",
        },
      ],
      secondaryBlockText:
        "【逐层拆解】当调用方发起一次延迟任务投递时：1) 若携带 IdempotencyKey，先用 Redis SetNX 做 24 小时防重入闸门；2) 计算执行时间戳（毫秒级）并映射到分片 ZSET 桶，防止单 Key 过大阻塞 Redis；3) 使用 MULTI/EXEC 事务管道一次性打包写入任务元数据 Hash 与 ZSET 调度分值，确保不会出现「ZSET 里有了任务 ID 但找不到任务体」的半残状态。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "上游来自 API Gateway 的 POST /v1/tasks 请求；入队后数据静默躺在分片 ZSET 中，等待调度循环触发下一个核心模块的 Lua 脚本捞取。",
          echoTargetId: "mod-2-u-1",
          echoLabel: "[-> 前往查看如何零锁捞取该 ZSET]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "注意这里用的是 TxPipeline() 而非普通 Pipeline()：TxPipeline 会在底层自动包裹 MULTI ... EXEC，保证 HSet 与 ZAdd 在 Redis 服务端被顺序连续执行，不会夹杂其他客户端的中间状态。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "为什么把 Payload 存在独立的 Hash (task:meta:{id}) 而不是直接序列化成 JSON 塞进 ZSET Member？因为 ZSET Member 如果包含数 KB 的大文本会极大膨胀跳跃表内存，且每次移动队列都需要重复传输整个 Payload。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「如果 SetNX 成功了，但后面的 pipe.Exec() 网络断开超时，调用方重试时岂不是会误报 ErrDuplicateTask 导致任务永久丢失？」",
          calloutBox: "满分破局：这里暴露了跨两步写操作的极小竞态窗口！进阶改法是把 SetNX 与 HSet/ZAdd 一起合并进同一个 Lua 入队脚本；或者在捕获 Exec 错误时主动执行一次补偿 Del(idemKey)。",
        },
      ],
    },
    {
      id: "mod-2-u-1",
      unitCode: "poll_due.lua · Unit 2.1",
      sectionId: "sec-mod-2",
      sectionTitle: "02. internal/store/poll_due.lua · 零竞态到期任务批量摘取与租约续期",
      sectionTask: "核心源码 · 原子迁移与 Visibility Timeout",
      weight: "core",
      tldr: "利用 Redis Lua 脚本在单个事件循环帧内完成「查到期 -> 移出等待队 -> 写入租约保护期 -> 标记重试次数」四步原子迁移。",
      primaryKind: "code",
      codeLanguage: "lua",
      filePath: "internal/store/poll_due.lua",
      primaryText: `-- KEYS[1]: delay_zset_bucket, KEYS[2]: inflight_zset
-- ARGV[1]: now_ms, ARGV[2]: batch_limit, ARGV[3]: lease_timeout_ms
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local lease_deadline = now + tonumber(ARGV[3])

local due_ids = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", now, "LIMIT", 0, limit)
if #due_ids == 0 then
    return {}
end

for _, id in ipairs(due_ids) do
    redis.call("ZREM", KEYS[1], id)
    redis.call("ZADD", KEYS[2], lease_deadline, id)
    local meta_key = "task:meta:" .. id
    redis.call("HSET", meta_key, "state", "PROCESSING")
    redis.call("HINCRBY", meta_key, "attempt", 1)
end

return due_ids`,
      formulas: [
        {
          latex: "",
          flowLabel: "ATOMIC TRANSITION",
          flowText: "KEYS[1](delay_zset) --[ZRANGEBYSCORE <= now]--> ZREM + ZADD(KEYS[2], now + lease) + HSET(PROCESSING)",
        },
      ],
      highlights: [
        {
          text: `redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", now, "LIMIT", 0, limit)`,
          dim: "dim2",
          tooltip: "时间窗口限流捞取：使用 LIMIT 0 batch_limit 控制单次 Lua 执行耗时在微秒级，防止一次性捞取十万条任务阻塞整个 Redis 主线程。",
        },
        {
          text: `redis.call("ZADD", KEYS[2], lease_deadline, id)`,
          dim: "dim3",
        },
        {
          text: `local lease_deadline = now + tonumber(ARGV[3])`,
          dim: "dim4",
        },
        {
          text: `local meta_key = "task:meta:" .. id`,
          dim: "dim5",
        },
      ],
      secondaryBlockText:
        "【核心引擎灵魂】这是整个项目面试含金量最高的文件。多台分布式调度器同时高频轮询这同一个 Redis 实例，但绝不会产生重复派发：因为整段 Lua 脚本在 Redis 内核里是串行原子执行的。Worker A 扫走这批 ID 的同时，它们已被瞬间从 delay_zset 删除并打上 future lease_deadline 移入 inflight_zset。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "由 Scheduler 主 Ticker 循环通过 EVALSHA 调用，返回的 due_ids 会立刻送入 Worker Pool 协程池执行真实业务逻辑。",
          echoTargetId: "mod-1-u-1",
          echoLabel: "[<- 回看任务是如何打分进入 delay_zset 的]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "注意 `inflight_zset` 的 Score 存的是 `now + lease_timeout_ms`（未来超时时间）。这意味着我们不需要额外维护定时扫描僵尸线程：另一个巡检协程只需对 `inflight_zset` 运行几乎完全相同的 Lua 脚本（把到期未 ACK 的任务扔回 delay_zset），即可自动完成宕机自愈。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "为什么在 Redis 里用 ZSET + Lua 而不是直接用 Redis Stream (XREADGROUP)？因为原生的 Stream 消费组不支持自定义未来任意时间的延迟投递，ZSET 天然以 Score 承载任意毫秒时间戳。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「你在 Lua 脚本里拼接了动态 Key `task:meta:` .. id，如果在 Redis Cluster 集群模式下运行这段脚本会怎样？」",
          calloutBox: "高危陷阱提醒：Redis Cluster 要求单条 Lua 脚本中访问的所有 Key 必须位于同一个 Hash Slot！若直接拼装 `task:meta:` .. id 而不加 `{hashTag}` 且 KEYS 未全部显式传入，集群模式下会直接报错 CROSSSLOT Keys in request don't hash to the same slot！",
        },
      ],
    },
    {
      id: "mod-3-u-1",
      unitCode: "pool.go · Unit 3.1",
      sectionId: "sec-mod-3",
      sectionTitle: "03. internal/worker/pool.go · 有界信号量并发控制与指数退避重试",
      sectionTask: "并发治理 · 背压限流 + 抖动指数退避",
      weight: "core",
      tldr: "用带缓冲 Channel 充当轻量级并发信号量实施背压，防止突发到期洪峰把 Goroutine 和下游 DB 打爆。",
      primaryKind: "code",
      codeLanguage: "go",
      filePath: "internal/worker/pool.go",
      primaryText: `func (p *WorkerPool) Dispatch(ctx context.Context, taskID string) {
	select {
	case p.sem <- struct{}{}:
	case <-ctx.Done():
		return
	}

	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		defer func() { <-p.sem }()
		defer p.recoverPanic(taskID)

		execCtx, cancel := context.WithTimeout(ctx, p.taskTimeout)
		defer cancel()

		err := p.handler.Execute(execCtx, taskID)
		if err == nil {
			p.ackSuccess(ctx, taskID)
			return
		}
		p.scheduleRetryOrDLQ(ctx, taskID, err)
	}()
}`,
      highlights: [
        {
          text: "case p.sem <- struct{}{}:",
          dim: "dim2",
          tooltip: "有界信号量背压：p.sem 是容量为 maxWorkers 的无分配空结构体 Channel。一旦并发打满，Dispatch 在入槽处自然阻塞，防止上游无限拉取到期任务造成 OOM。",
        },
        {
          text: "defer p.recoverPanic(taskID)",
          dim: "dim3",
        },
        {
          text: "p.scheduleRetryOrDLQ(ctx, taskID, err)",
          dim: "dim4",
        },
        {
          text: "execCtx, cancel := context.WithTimeout(ctx, p.taskTimeout)",
          dim: "dim5",
        },
      ],
      secondaryBlockText:
        "【并发控制设计】每当调度器从 Lua 脚本拿到一批到期 ID，会逐一塞给 WorkerPool.Dispatch。最核心的防御是先抢占空结构体信号量再起 Goroutine（而不是先起 10 万个协程再排队等锁），将内存峰值严格锁定在 `maxWorkers * 单任务栈开销` 之内；失败后通过 `min(base * 2^attempt, maxDelay) + jitter` 计算下次退避时间，超出 `max_retry` 则打入死信队列 DLQ。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "承接 poll_due.lua 返回的任务 ID，并在收到 SIGTERM 信号时依赖内部的 p.wg 协同下一个模块完成优雅退场。",
          echoTargetId: "mod-4-u-1",
          echoLabel: "[-> 查看优雅停机如何等待这些 in-flight 协程]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "注意 `ackSuccess(ctx, taskID)` 传的是外层 `ctx` 而不是随时可能超时的 `execCtx`，避免业务逻辑刚跑完但临门一脚确认 ACK 时因为上下文过期导致白干并重复重试。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "为什么没有采用固定常驻 Worker 协程从共用 TaskChan 消费的模式，而是按信号量动态起轻量 Goroutine？在 Go 中 Goroutine 启动成本极低（~2KB），结合信号量同样限制最大并发度，但能规避空闲常驻 Worker 长期占用堆对象或 Channel 关闭竞态的复杂度。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「如果某条慢任务在 `handler.Execute` 里执行耗时超过了 `lease_timeout_ms`（比如 30s 租约，任务跑了 45s），此时发生脑裂重复执行怎么办？」",
          calloutBox: "深度加分回答：必须引入「看门狗续约协程 (Heartbeat Lease Renewal)」——只要当前 Worker 没死且 `execCtx` 未取消，每隔 `lease/3`（10s）自动把 `inflight_zset` 中该任务的 Score 向后延长一次租约时间。",
        },
      ],
    },
    {
      id: "mod-4-u-1",
      unitCode: "shutdown.go · Unit 4.1",
      sectionId: "sec-mod-4",
      sectionTitle: "04. internal/worker/shutdown.go · In-Flight 任务等待与租约回收",
      sectionTask: "外围装配与高可用边界（80/20 可选择略读，但停机流程常考）",
      weight: "transition",
      tldr: "监听 SIGINT/SIGTERM 后先停止拉取新任务，再限时等待在途 Goroutine 完成，避免半截账务中断。",
      primaryKind: "code",
      codeLanguage: "go",
      filePath: "internal/worker/shutdown.go",
      primaryText: `func (p *WorkerPool) Shutdown(graceTimeout time.Duration) error {
	p.stopPolling()

	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-time.After(graceTimeout):
		return fmt.Errorf("graceful shutdown timed out after %s; remaining tasks rely on lease reclaim", graceTimeout)
	}
}`,
      highlights: [
        {
          text: "p.stopPolling()",
          dim: "dim1",
        },
        {
          text: "p.wg.Wait()",
          dim: "dim2",
          tooltip: "优雅停机双保险：先切断上游拉取开关（停止接单），再用 WaitGroup 等待已在厨房里炒菜的协程收尾 ACK。",
        },
        {
          text: "case <-time.After(graceTimeout):",
          dim: "dim3",
        },
      ],
      secondaryBlockText:
        "【高可用收尾拼图】K8s 滚动发布 Pod 时会发送 SIGTERM 并在 30 秒后强杀 SIGKILL。这段代码确保发布过程中：立刻停止从 Redis 领新活 -> 限时等待正在运行的任务安全 ACK -> 万一真卡死超时退出，也不必慌张，因为前面 Unit 2.1 的租约机制会在期满后把剩余任务安全回收重放。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "与 WorkerPool.Dispatch 共享同一个 sync.WaitGroup 实例。",
          echoTargetId: "mod-3-u-1",
          echoLabel: "[<- 回看 Dispatch 中的 wg.Add 与信号量释放]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "将阻塞的 `p.wg.Wait()` 包在匿名协程里再和 `time.After` 做 `select` 多路复用，是 Go 实现「带超时上限的 WaitGroup 等待」的标准惯用法。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "放弃了强行 `cancel()` 所有正在执行的业务上下文（那样会导致外部第三方接口已经扣款成功但本地没来得及更新状态），选择等待完成 + 租约兜底。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「Kubernetes 发送 SIGTERM 时，为什么这里没有把未完成任务显式 NACK 回队列？」",
          calloutBox: "技巧提示：若离 `graceTimeout` 还有剩余时间其实可以主动做一次批量 NACK 加速重调；但即便进程被强杀来不及 NACK，可见性租约仍是最后一道不可摧毁的安全网。",
        },
      ],
      transitionSummary: "至此 4 个核心源码模块已串联成完整闭环：入队分片防重 -> Lua 原子摘取与租约 -> 有界并发池与退避 -> 优雅退场与租约自愈。下方直接进入面试武装模块。",
    },
  ],
  bottomTitle: "08. 简历武装、压力测试与二开改造方案",
  bottomSubtitle: "把看懂的开源代码转化为面试官无法反驳的工程话术与可落地 PR",
  bottomBlocks: [
    {
      type: "statement-banner",
      tag: "30-SECOND ELEVATOR PITCH · 面试开场白模板",
      body: "我在项目中重点负责高并发异步任务调度引擎的设计与压测优化。针对海量延迟任务在传统定时扫表下的数据库锁表与重复消费难题，基于 Redis 分片 ZSET 与单线程 Lua 原子脚本实现了无锁化到期任务批量摘取，结合 Visibility Timeout 隐形租约保障节点宕机后的秒级自愈，并通过 Go 有界信号量协程池与抖动指数退避隔离下游突发故障。",
    },
    {
      type: "socratic-qa",
      title: "L1 - L3 渐进式面试压力测试（点击展开参考防御话术）",
      items: [
        {
          question: "L1 · 基础流转：如果某时刻有 10 万条延迟任务在同一秒同时到期，你们的调度器怎么处理不会炸掉？",
          answer:
            "不会一次性全部拉进内存。两层防御：第一层在 Redis Lua 中通过 `LIMIT 0 batch_limit`（比如每次只摘 200 条）分批削峰，避免单个 Lua 脚本长时间阻塞 Redis 事件循环；第二层在 Go WorkerPool 入口使用有界信号量 `p.sem`，并发槽位满时 Dispatch 自动产生背压阻塞，把内存和下游连接池水位锁死在安全阈值内。",
        },
        {
          question: "L2 · 极端故障：一个任务正常逻辑要跑 45 秒，但租约只设了 30 秒，30 秒一到岂不是被别的 Worker 重复捞走造成双发？",
          answer:
            "这是一个经典的「长尾任务租约过早过期」盲区。工业级解决方案有两种并存手段：首先为长任务启用 Watchdog 看门狗协程，每隔租约的 1/3（10s）自动在 Lua 里刷新 `inflight_zset` 的 Score 续期；其次利用 Task 元数据里的唯一 Fencing Token（单调递增的 attempt 版本号），哪怕极端情况下真发生双发，下游更新数据库时校验 `attempt == expected_attempt` 也能拦截过期幽灵写请求。",
        },
        {
          question: "L3 · 架构对比：市面上已经有 Kafka / RabbitMQ，为什么还要用 Redis ZSET 自研这套调度系统？核心短板在哪？",
          answer:
            "Kafka 是流式日志架构，原生只擅长按 Offset 顺序吞吐，做「任意毫秒精度延迟投递（如 17 分钟后取消订单）」极度笨重；Redis ZSET 天然支持 O(log N) 任意时间点排序。它的核心短板在于受限于单机内存容量与 AOF 持久化弱一致性（主从异步复制切换可能丢最近几十毫秒刚入队的任务）——因此适合可接受秒级/亚秒级调度、对延迟精度敏感的中高吞吐场景，而不适合不能丢一笔钱的强一致清结算账务主链路。",
        },
      ],
    },
    {
      type: "star-bullets",
      title: "简历 STAR 法则高含金量话术（双版本可直接复制）",
      versions: [
        {
          versionLabel: "版本 A · 稳健后端落地版（重点突出可靠性与无锁设计）",
          summary: "适用于中大厂常规后端/Go开发岗位，聚焦高并发下的数据一致性与故障自愈。",
          bullets: [
            "主导重构异步延迟任务调度引擎，用 Redis 分片 ZSET + Lua 原子脚本替代传统分布式锁轮询，消除多实例竞态重复消费并降低 60% Redis RTT 开销。",
            "设计基于 Visibility Timeout 隐形租约队列的故障自愈与有界信号量协程池，配合抖动指数退避与死信队列（DLQ），确保节点 OOM 重启时任务零永久丢失。",
          ],
        },
        {
          versionLabel: "版本 B · 性能深挖攻坚版（突出可量化的改造与集群分片）",
          summary: "适用于核心架构/高并发中间件岗位，建议完成下方 Ownership 改造后再使用。",
          bullets: [
            "针对百万级延迟任务堆积造成的 Redis 热 Key 阻塞问题，引入 CRC32 一致性分片桶与 `{hash_tag}` 集群路由改造，使调度器可在 Redis Cluster 下线性水平扩展。",
            "引入批量 Pipeline + Watchdog 租约自动续期防脑裂机制，压测验证单节点调度吞吐提升 3.4 倍，P99 触发延迟控制在 120ms 以内。",
          ],
        },
      ],
    },
    {
      type: "ownership-blueprints",
      title: "2小时可落地的 Ownership 二次开发改造计划（把开源项目变成你的代表作）",
      plans: [
        {
          title: "改造蓝图 01：为 Lua 剧本加上 Redis Cluster `{hashTag}` 多键同槽支持",
          timeEstimate: "预计耗时：1.5 小时",
          targetFiles: "internal/scheduler/enqueue.go & internal/store/poll_due.lua",
          changeSteps:
            "1) 将分片桶名从 `delay:bucket:1` 改为 `{bucket:1}:delay`、`{bucket:1}:inflight`、`{bucket:1}:meta:taskId`；2) 在 Lua 中校验跨 Key 访问全落在同槽；3) 用 Docker Compose 起 3 主 3 从 Redis Cluster 跑通并发摘取单测。",
          benchmarkMetric: "验证跨节点集群部署无 CROSSSLOT 报错，8 分片水平扩容后写入 QPS 线性增长。",
          interviewPitch:
            "面试时主动讲：「开源原版只支持单机 Redis，我为了支撑我们业务的集群环境，亲自改造了 Hash Tag 路由和 Lua 同槽约束...」",
        },
        {
          title: "改造蓝图 02：实现长任务 Watchdog 看门狗租约自动续期",
          timeEstimate: "预计耗时：2 小时",
          targetFiles: "internal/worker/pool.go & internal/store/renew_lease.lua",
          changeSteps:
            "1) 在 `pool.go` 启动业务执行前另起一个子协程监听 `time.NewTicker(leaseTimeout / 3)`；2) 通过 Lua 校验任务仍在 `inflight_zset` 且 `attempt` 匹配后刷新过期时间；3) 构造一个 `time.Sleep(45s)` 的慢任务集成测试证明不会触发重复投递。",
          benchmarkMetric: "消除 30s+ 长尾任务 100% 重复调度误杀率。",
          interviewPitch:
            "面试官问长任务超时怎么防脑裂时，直接亮出自己手写的 Watchdog 续约和 Fencing Token 校验机制。",
        },
        {
          title: "改造蓝图 03：用单条 Lua 闭合 SetNX + HSet + ZAdd 解决入队半残窗口",
          timeEstimate: "预计耗时：1 小时",
          targetFiles: "internal/scheduler/enqueue.go & internal/store/enqueue_idem.lua",
          changeSteps:
            "1) 合并 Unit 1.1 中两步独立请求为单次 Lua 调用；2) 用 `k6` 或 `go test -bench` 对比合并前后的 RTT 延迟分布。",
          benchmarkMetric: "入队 P99 网络耗时减半（由 2 次 RTT 降至 1 次 RTT），彻底消除异常重试误报重复窗口。",
          interviewPitch:
            "展示你具备 Code Review 级隐患洞察力：不是照抄开源代码，而是看出了原库入队两步写的边界漏洞并亲手修补。",
        },
      ],
    },
    {
      type: "before-after-diff",
      title: "可交互式代码改造对比区与压测记录（自动持久保存至本地）",
      description:
        "下方已预置「入队两步写漏洞 -> 单 Lua 原子闭合」的改造模板。你可以直接修改代码片段并记录自己的 Benchmark 数据，导出 Markdown/HTML 时会自动打包。",
      defaultBeforeCode: `// BEFORE: 两步写存在网络断开后幂等键残留的竞态窗口（且耗费 2 次 RTT）
ok, err := s.rdb.SetNX(ctx, idemKey, task.ID, 24*time.Hour).Result()
if !ok { return "", ErrDuplicateTask }

pipe := s.rdb.TxPipeline()
pipe.HSet(ctx, metaKey, ...)
pipe.ZAdd(ctx, bucketKey, ...)
_, err = pipe.Exec(ctx)`,
      defaultAfterCode: `// AFTER: 单条 EVALSHA Lua 脚本闭合防重入 + 元数据写入 + 延迟投递（1 次 RTT 零半残态）
// KEYS: [idemKey, metaKey, bucketKey]
local inserted = redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2], "NX")
if not inserted then
    return 0 -- ErrDuplicateTask
end
redis.call("HSET", KEYS[2], "payload", ARGV[3], "state", "SCHEDULED", "attempt", 0)
redis.call("ZADD", KEYS[3], ARGV[4], ARGV[1])
return 1`,
      defaultBenchmarkNote:
        "环境：MacBook Pro M2 / 本地 Docker Redis 7.2，并发度 64：\n- BEFORE（2 RTT）：平均耗时 1.84 ms，P99 4.90 ms，并发模拟断网残留率 0.4%\n- AFTER（1 RTT Lua）：平均耗时 0.96 ms，P99 2.35 ms，异常中断半残率 0%",
    },
  ],
};
