export const VIDEO_CHAPTERS = [
  { id: 'hook-studio', start: 0.0, timeLabel: '00:00', name: '多源导入工作台' },
  { id: 'mental-dag', start: 6.5, timeLabel: '00:06', name: '顶部鸟瞰 DAG' },
  { id: 'dual-column', start: 14.0, timeLabel: '00:14', name: '双栏对照精读' },
  { id: 'qa-evidence', start: 21.5, timeLabel: '00:21', name: '划词追问证据链' },
  { id: 'themes-pure', start: 28.5, timeLabel: '00:28', name: '三态与 EN↔中文稿' },
  { id: 'library-hold', start: 38.0, timeLabel: '00:38', name: '四维智能文库' },
];

export const WORKBENCH_MODES = {
  academic: {
    id: 'academic',
    tabLabel: '学术论文精读',
    heroClass: 'hero-academic',
    domain: 'AI 与序列注意力架构',
    paradigm: '实证评测与实验型',
    status: '精读中 · 论文拆解',
    tags: ['学术论文精读', 'NEURIPS 2017', 'ZERO-EMOJI EDITION'],
    title: 'Attention Is All You Need',
    subtitle: 'Ashish Vaswani et al. (Google Brain & Google Research) · 现代大模型架构基石',
    scaffoldTitle: 'TOP MENTAL MODEL / 先见森林：30 秒认知脚手架与可交互数据流图',
    scaffolds: [
      {
        k: '01 [PROBLEM & GAP / 真问题]',
        v: '2017 年前的序列模型被 RNN/LSTM 垄断，递归公式导致信号必须一步步顺序传递，既无法并行又产生长距离衰减。',
      },
      {
        k: '02 [EUREKA INTUITION / 破局直觉]',
        v: '彻底剔除循环与卷积，让序列内任意两个词在同一时刻通过矩阵乘法直接建立 O(1) 常数级全局连接。',
      },
      {
        k: '03 [FUNDAMENTAL TRADE-OFF / 代价]',
        v: '舍弃循环后丢失天然词序感，必须显式注入 Positional Encoding，且全局注意力计算复杂度转为序列平方 O(n²·d)。',
      },
    ],
    dag: [
      { title: 'Embeddings + PE', sub: 'sin/cos (§3.5)', targetUnit: 'abs-p1' },
      { title: 'Multi-Head Attn', sub: '并行子空间 (§3.2.2)', targetUnit: 'abs-p1' },
      { title: 'Scaled Dot-Product', sub: 'QK^T / sqrt(d_k)', targetUnit: 'sec-32' },
      { title: 'Position-wise FFN', sub: '512 -> 2048 (§3.3)', targetUnit: 'sec-32' },
      { title: 'Complexity O(1)', sub: 'WMT14 SOTA (§6)', targetUnit: 'sec-61' },
    ],
    pureTitleZh: 'Attention Is All You Need — 全文通读中文精译稿',
    pureTitleEn: 'Attention Is All You Need — Pure Manuscript View',
    units: [
      {
        id: 'abs-p1',
        unitLabel: 'Abs.P1 · 论文摘要',
        coreBadge: 'CORE 20%',
        summary: '彻底抛弃循环与卷积，仅靠注意力机制实现翻译质量与并行度的双重跃迁',
        jumpLabel: '跳转验证 -> §3.2 注意力内核',
        jumpTarget: 'sec-32',
        defaultQaCount: 1,
        defaultQaHistory: [
          {
            scope: '全文跨节证据',
            snippet: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
            question: '为什么仅仅保留 Attention、彻底去掉 RNN 后就能既提效又涨点？',
            answerHtml:
              '<span class="wb-epistemic">[原文明示]</span> 在 Abs.P1 与 §1 中，传统 RNN 必须按时间步顺序计算隐藏状态 <code>h_t = f(h_{t-1}, x_t)</code>，任意两词通信路径为 O(n)。<br><span class="wb-epistemic">[分析推断]</span> 去掉循环意味着所有位置可在单次矩阵乘法中完全并行，把最长依赖路径缩为 O(1)，因此在相同训练时长内可吞吐更多平行语料。',
            evidenceTarget: 'sec-32',
            evidenceLabel: '-> 跳转定位 §3.2 Scaled Dot-Product',
          },
        ],
        segments: [
          { text: 'The dominant ', kind: null },
          {
            text: 'sequence transduction models',
            kind: 'core',
            qaPrompt: '为什么作者开篇先给传统 sequence transduction models 贴上 "complex" 标签？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 首句点明现有主流模型依赖复杂的循环或卷积编解码结构，后文第三句紧接给出 "simple network architecture" 的对比。<br><span class="wb-epistemic">[分析推断]</span> 这是典型的审稿防御话术：先确立既有范式在复杂度与工程成本上的高门槛，再把纯注意力重构塑造成结构极简的新基线。',
          },
          { text: ' are based on complex recurrent or convolutional neural networks. ', kind: null },
          {
            text: 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
            kind: 'concept',
            qaPrompt: '“solely on attention” 究竟省去了哪两类算子，带来了什么硬件红利？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 明确剔除了循环网络 (recurrence) 与卷积网络 (convolutions)。<br><span class="wb-epistemic">[分析推断]</span> 消除了时间步串行依赖后，GPU 张量核心不再被短序列同步等待卡死，从而让 8 块 GPU 训练 3.5 天即可突破过往集成模型上限。',
          },
          { text: ' ', kind: null },
          {
            text: 'Our model achieves 28.4 BLEU on WMT 2014 EN-DE and establishes 41.8 BLEU on EN-FR after training for 3.5 days on eight GPUs.',
            kind: 'evidence',
            qaPrompt: 'WMT14 英德 28.4 与英法 41.8 BLEU 的训练成本比前人低多少？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 论文在摘要与 §6.1（跳转 §6.1 主实验对照）指出仅耗费当时最佳文献模型训练算力的一小部分（8 卡 3.5 天）。<br><span class="wb-epistemic">[原文未说明]</span> 摘要未给出精确 FLOPs 倍数比率，需切至 §6.1 主实验表格核对完整对比数字。',
          },
        ],
        zh: '主流的序列转导模型普遍采用基于复杂循环神经网络（RNN）或卷积神经网络的编解码器架构。我们提出一种全注意力驱动的简洁架构 Transformer，彻底摒弃循环与卷积；在 WMT 2014 英德/英法翻译任务中分别取得 28.4 与 41.8 BLEU，且仅在 8 张 GPU 上训练 3.5 天。',
        dims: [
          { num: '01', name: '逻辑演进与锚点', tag: '原文明示', text: '既有 RNN+Attn 辅助 -> 釜底抽薪只留 Attn -> BLEU 刷新与训练成本暴降。' },
          { num: '02', name: '段落功能角色', tag: '分析推断', text: '全文总纲（Thesis Statement），先用复杂衬托简洁，封堵模型只适于单任务的质疑。' },
          { num: '03', name: '硬核数字破译', tag: '原文明示', text: '机器翻译评测中 0.5 BLEU 即显著进步，单模型超越前人多模型集成达 2+ BLEU。' },
          { num: '04', name: '审稿人视角', tag: '分析推断', text: '紧接补入「英语成分句法分析」泛化实验，预防“是否只在双语翻译有效”的审稿追问。' },
        ],
      },
      {
        id: 'sec-32',
        unitLabel: '§3.2 · 缩放点积注意力内核',
        coreBadge: 'MATH CORE',
        summary: '除以 sqrt(d_k) 并非随手归一化，而是为防止 Softmax 进入梯度几乎为零的饱和区',
        jumpLabel: '跳转验证 -> §6.1 实验对比',
        jumpTarget: 'sec-61',
        defaultQaCount: 0,
        defaultQaHistory: [],
        segments: [
          { text: 'We compute the matrix of outputs as Attention(Q, K, V) = ', kind: null },
          {
            text: 'softmax((Q K^T) / sqrt(d_k)) V.',
            kind: 'concept',
            qaPrompt: '为什么分母是 sqrt(d_k) 而不是 d_k？这背后利用了什么概率性质？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 论文在脚注中给出方差推导：假设 Q 与 K 各分量均值为 0、方差为 1，二者点积求和后均值仍为 0，但方差会线性膨胀为 d_k。<br><span class="wb-epistemic">[分析推断]</span> 除以标准差 sqrt(d_k) 刚好把方差重新拉回 1，避免点积落入极大值区间把 Softmax 梯度压成零。',
          },
          { text: ' For large values of d_k, dot products grow large in magnitude, ', kind: null },
          {
            text: 'pushing the softmax function into regions where it has extremely small gradients.',
            kind: 'method',
            qaPrompt: '这一梯度消失和早期全连接网络 Sigmoid 饱和有什么区别？',
            qaAnswer:
              '<span class="wb-epistemic">[分析推断]</span> 这里源于高维内积方差随维度 d_k 同步放大；当注意力权重趋近 one-hot 时，除选中位置外其余全部截断梯度回传。',
          },
        ],
        zh: '我们将注意力输出计算为 softmax(Q K^T / sqrt(d_k)) V。当维度 d_k 较大时，未经缩放的点积幅值剧增，会把 Softmax 推向梯度极小的饱和区，因此必须按维度平方根缩放方差。',
        dims: [
          { num: '01', name: '公式直觉锚定', tag: '原文明示', text: '方差膨胀倍数 = 维度 d_k -> 标准差缩放 = 1 / sqrt(d_k) 拉回单位方差。' },
          { num: '02', name: '工程对照意义', tag: '原文明示', text: '小维度下 Additive Attention 与点积相当，大维度下未缩放点积显著退化。' },
          { num: '03', name: '矩阵并行红利', tag: '分析推断', text: '整批 Query 打包成矩阵后，注意力直接化为一次高密度 BLAS 矩阵乘。' },
          { num: '04', name: '边界与代价', tag: '原文未说明', text: '此处公式默认允许任意位置互看，Causal Mask 在解码器端另加 -inf 屏蔽未来词。' },
        ],
      },
      {
        id: 'sec-61',
        unitLabel: '§6.1 · 翻译主实验与复杂度代价',
        coreBadge: 'BENCHMARK',
        summary: '单模型 41.8 BLEU 超越当年所有集成系统，且训练耗时不到竞品的 1/4',
        jumpLabel: '回到顶部 -> Abs.P1',
        jumpTarget: 'abs-p1',
        defaultQaCount: 0,
        defaultQaHistory: [],
        segments: [
          { text: 'On the WMT 2014 English-to-French task, our big model achieves ', kind: null },
          {
            text: 'a BLEU score of 41.8, outperforming all previously published single models at less than 1/4 the training cost.',
            kind: 'evidence',
            qaPrompt: '如何在硬件口径不一致下验证这里的“不到 1/4 训练成本”？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 作者统一按当时每卡单精度 FLOPs 估算各基线论文的训练总浮点运算量，得出 2.3×10^19 FLOPs 远低于 ConvS2S 与 ByteNet。',
          },
        ],
        zh: '在 WMT 2014 英法翻译任务上，Big Transformer 取得 41.8 BLEU，不仅超越此前所有单模型与集成方案，且估算总训练计算成本不足同类最优基线的四分之一。',
        dims: [
          { num: '01', name: '对照公平性', tag: '原文明示', text: '统一折算到总浮点运算量（FLOPs），排除不同论文 GPU 代差干扰。' },
          { num: '02', name: '模型规模档位', tag: '原文明示', text: '区分 Base（65M 参数，12 小时出结果）与 Big（213M 参数，3.5 天冲榜）。' },
          { num: '03', name: '瓶颈提示', tag: '分析推断', text: 'O(1) 最短路径以显存 O(n^2) 为代价，为后续长上下文稀疏注意力埋下伏笔。' },
          { num: '04', name: '可复现性', tag: '原文明示', text: '附录完整公开了 Adam beta 参数、Warmup 步数 4000 与 Label Smoothing 0.1。' },
        ],
      },
    ],
    bespokeFooter: {
      tag: 'BOTTOM ARSENAL / 学术论证攻防与审稿自测',
      title: 'SOCRATIC SELF-TEST · 审稿人级内化追问',
      kind: 'socratic',
      question: '如果去掉缩放点积注意力中的 1/sqrt(d_k)，同时把优化器学习率调小 10 倍，能否解决梯度消失？',
      answer: '不能。问题根源是高维内积方差膨胀导致 Softmax 进入饱和区，输出接近硬 One-hot 后局部导数 p(1-p) 已趋近于 0；调小学习率无法挽救已归零的梯度，必须在进入 Softmax 前按标准差 sqrt(d_k) 归一化方差。',
    },
  },

  cognitive: {
    id: 'cognitive',
    tabLabel: '认知 / 视频音轨',
    heroClass: 'hero-cognitive',
    domain: '认知科学与心智系统',
    paradigm: '去噪心智与行动协议',
    status: '精读中 · 3 单元已编译',
    tags: ['认知长文内化', 'DAN KOE', 'IDENTITY & CYBERNETICS'],
    title: 'How to Fix Your Entire Life in 1 Day',
    subtitle: 'Dan Koe (future/proof) · 剥离情绪渲染，提炼心理控制论、阿德勒目的论与心流熵减系统',
    scaffoldTitle: 'TOP MENTAL MAP / 30 秒去鸡汤化认知鸟瞰与操作系统对照',
    scaffolds: [
      {
        k: '01 [RAW FIRST-PRINCIPLE / 身份恒温器]',
        v: '心智是一个目标导向的控制论恒温器——若“自我身份设定值”未改，靠咬牙坚持的表层打卡都会被潜意识强行拉回原位。',
      },
      {
        k: '02 [OLD DEFAULT OS / 平庸默认卡点]',
        v: '把拖延归咎于懒惰、依赖单向正能量幻想，却看不见潜意识正在极其成功地执行“保护自尊、逃避失败评判”的隐秘目标。',
      },
      {
        k: '03 [UPGRADED OS / 破局与 RPG 闭环]',
        v: '先用「反愿景（5 年噩梦具象化）」驱动厌恶损失推力，再建立 1 年主线 + 1 月 Boss 战 + 每日 3 任务的 RPG 心流系统。',
      },
    ],
    dag: [
      { title: 'Identity Thermostat', sub: 'Set-Point Controls Habits (#01)', targetUnit: 'cog-01' },
      { title: 'Hidden Safety Goal', sub: 'Self-Sabotage = Ego Shield (#02)', targetUnit: 'cog-02' },
      { title: 'Anti-Vision Fuel', sub: '5-Yr Nightmare Repulsion (#03)', targetUnit: 'cog-03' },
      { title: 'Pattern Interrupts', sub: 'Break Daytime Autopilot', targetUnit: 'cog-03' },
      { title: 'Gamified RPG Loop', sub: '1Y Mission / 1M Boss', targetUnit: 'cog-03' },
    ],
    pureTitleZh: 'How to Fix Your Entire Life in 1 Day — 去噪中文精译稿',
    pureTitleEn: 'How to Fix Your Entire Life in 1 Day — Original Essay View',
    units: [
      {
        id: 'cog-01',
        unitLabel: 'UNIT #01 · 身份恒温器',
        coreBadge: 'CORE SET-POINT',
        summary: '你还没走到你想去的地方，因为你还不是那个“理应出现在那里的人”',
        jumpLabel: '跳转验证 -> UNIT #02 目的论',
        jumpTarget: 'cog-02',
        defaultQaCount: 1,
        defaultQaHistory: [
          {
            scope: '全文跨节证据',
            snippet: 'Here is the harsh truth: You aren\'t where you want to be because you aren\'t the person who would be there.',
            question: '作者说顶尖创作者与高产者「不靠意志力」，难道养成习惯初期不需要硬扛吗？',
            answerHtml:
              '<span class="wb-epistemic">[原文明示]</span> 原文描述的是「新身份稳态建立之后」的状态：一旦将专注写作/健身内化为自我认同，过懒散生活反而会感到生理性不适。<br><span class="wb-epistemic">[分析推断]</span> 在从旧身份向新身份迁移的前 14–30 天，前额叶仍然必须承受启动摩擦与排异反应（原文比作“Mind treats it like a foreign virus”），不能误读为“零阻力”。',
            evidenceTarget: 'cog-02',
            evidenceLabel: '-> 跳转 UNIT #02 自毁的目的论',
          },
        ],
        segments: [
          { text: '80 to 90% of people fail their New Year\'s resolutions before February even begins. ', kind: null },
          {
            text: 'Here is the harsh truth: You aren\'t where you want to be because you aren\'t the person who would be there.',
            kind: 'core',
            qaPrompt: '为什么仅靠表层行为打卡和日程软件，过几周就会触发“控制论反弹”？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 绝大多数人只改表面动作（surface-level actions）而从未动摇底层叙事（internal narrative）。<br><span class="wb-epistemic">[分析推断]</span> 源自 Maxwell Maltz《心理控制论》：自我意象就像设定在 22°C 的恒温器，只对行为吹热风却不改设定值，一松手就被负反馈系统拉回原基线。',
          },
          { text: ' Their daily habits are simply the natural byproduct of their ', kind: null },
          {
            text: 'identity.',
            kind: 'concept',
            qaPrompt: '这里的 "identity"（身份认同）如何从虚无口号转化为可审计指标？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 在后文 PART 1 诊断第 3 问给出冷酷旁观者测试（Revealed Preference）：不听嘴上标榜什么身份，只看过去两小时的实际时间分配在为什么优先级投票。',
          },
          { text: ' ', kind: null },
          {
            text: 'When you try to force a new habit onto an old identity, your mind treats that new habit like a foreign virus and attacks it until you snap right back to baseline.',
            kind: 'evidence',
            qaPrompt: '大脑排斥新习惯的神经防卫机制具体是怎么生效的？',
            qaAnswer:
              '<span class="wb-epistemic">[分析推断]</span> 大脑把既有习惯回路视作“确定且安全”的稳态。骤然切换高难度输出会引发未知失败焦虑，潜意识随即制造倦怠或分心冲动来让你退回舒适基线。',
          },
        ],
        zh: '80% 到 90% 的人在二月到来前就放弃了新年决心。残酷的真相是：你之所以还没走到想去的地方，是因为你还不是那个理应出现在那里的人。当你把新习惯强加于旧身份时，大脑会像免疫系统攻击病毒一样排斥它，直到把你拉回原先的基准线。',
        dims: [
          { num: '01', name: '叙事推进与机制', tag: '原文明示', text: '[刺破决心失败率] -> [抛出身份决定位置铁律] -> [恒温器排异反扑隐喻]。' },
          { num: '02', name: '去魅与适用边界', tag: '分析推断', text: '“不用意志力”仅适用于稳态成型后；前 14–30 天切换壳体期仍存在显著心理摩擦。' },
          { num: '03', name: '表达结构解剖', tag: '原文明示', text: '同构对仗暴击句直接把外部境遇归因于本体身份，封死“等我有空/有工具”的借口。' },
          { num: '04', name: '个人觉察映射', tag: '分析推断', text: '人们热衷买新工具列新清单，因为更换工具不需要推翻“过去那个舒适的自己”。' },
        ],
      },
      {
        id: 'cog-02',
        unitLabel: 'UNIT #02 · 自毁的目的论',
        coreBadge: 'TELEOLOGY',
        summary: '一切行为皆有目的：拖延不是缺乏动力，而是潜意识在成功保护自尊',
        jumpLabel: '跳转实操 -> UNIT #03 反愿景协议',
        jumpTarget: 'cog-03',
        defaultQaCount: 0,
        defaultQaHistory: [],
        segments: [
          { text: 'To change your life, you must first understand a fundamental law of human psychology: ', kind: null },
          {
            text: 'All behavior is goal-oriented. Even self-sabotage.',
            kind: 'core',
            qaPrompt: '为什么“拖延和自我毁灭”也算是一种高成功率的目标导向行为？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 引入阿德勒目的论：只要不去全力冲刺，就永远不需要面对「全力以赴后依然平庸」的终极判决；所以潜意识极度高效地执行了自尊防御任务。',
          },
          { text: ' You are actively succeeding at a hidden goal: protecting your ego from judgment, and avoiding the threat to your ', kind: null },
          {
            text: 'conceptual survival.',
            kind: 'concept',
            qaPrompt: '什么是 "conceptual survival"（概念性生存）？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 现代社会不再面临野兽捕食，大脑转而把“维持既有社交人设与朋友家人眼中的形象”当成生死存亡的领地。',
          },
        ],
        zh: '想改变人生必先懂一条心理铁律：一切行为都是目标导向的，哪怕是自我毁灭。拖延不是缺乏自律，而是你在极其成功地实现潜意识隐藏目标——保护自尊免受失败评判，维护现有“概念性生存”边界。',
        dims: [
          { num: '01', name: '阿德勒目的论支点', tag: '原文明示', text: '不再问“过去什么创伤导致我懒”，改为追问“我现在不行动想保住什么隐秘收益”。' },
          { num: '02', name: '自我设障机制', tag: '分析推断', text: '心理学 Self-Handicapping：不尽全力，输了就能用“没认真做”留住最后的体面。' },
          { num: '03', name: '边界审核', tag: '原文未说明', text: '并非所有拖延都属自我防御；睡眠严重剥夺与任务拆分过粗也会引发执行瘫痪。' },
          { num: '04', name: '已知地狱效应', tag: '分析推断', text: '旧身份即便庸碌但高度可预测（Known Hell），未知成功反而让人恐惧失控。' },
        ],
      },
      {
        id: 'cog-03',
        unitLabel: 'UNIT #03 · 反愿景核引擎与 1-Day 协议',
        coreBadge: 'PROTOCOL',
        summary: '如果你不彻底痛恨平庸的日常，你就会继续麻木容忍它：用 5 年噩梦驱动重启',
        jumpLabel: '回到顶部 -> UNIT #01',
        jumpTarget: 'cog-01',
        defaultQaCount: 0,
        defaultQaHistory: [],
        segments: [
          { text: 'In the morning, you do a psychological excavation. Set aside 15 to 30 minutes with pen and paper. ', kind: null },
          {
            text: 'You cannot change what you are numb to: if you don\'t hate it, you will tolerate it.',
            kind: 'core',
            qaPrompt: '为什么作者硬性要求早间心理挖掘阶段「禁止外包给 AI 代答」？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 因为心理防御必须由本人在空白纸面前直面书写阻力去刺穿；让 AI 代写漂亮复盘只会制造“我已深刻觉醒”的虚假多巴胺。',
          },
          { text: ' Now turn those pains into an ', kind: null },
          {
            text: 'anti-vision: a brutal awareness of the 5-year life you do not want to live.',
            kind: 'method',
            qaPrompt: '对比单纯写“正能量愿景”，Anti-Vision（反愿景）利用了哪条行为经济学规律？',
            qaAnswer:
              '<span class="wb-epistemic">[分析推断]</span> Kahneman 前景理论证明，人类规避损失的痛感强度约为等量收益快感的 2 至 2.5 倍。具体描绘五年后平庸窒息的周二早晨，能爆发出持续推力。',
          },
        ],
        zh: '早上抽出 15 到 30 分钟拿起纸笔进行深度心理挖掘——绝不要外包给 AI。你无法改变自己已麻木的一切：如果不痛恨平庸的日常，你就会一直忍受下去。把刺痛转化为残酷清晰的「反愿景」，再套上新年主线与每日三个杠杆任务的 RPG 外壳。',
        dims: [
          { num: '01', name: '全天三段节律', tag: '原文明示', text: '早间挖掘刺穿麻木 -> 日间断点打断自动驾驶 -> 晚间收敛为 5 层 RPG 游戏目标。' },
          { num: '02', name: 'Anti-Vision 动力学', tag: '分析推断', text: '把“五年毫无长进的麻木周二”具象化到感官细节，利用损失厌恶触发初始逃逸速度。' },
          { num: '03', name: 'RPG 降熵法则', tag: '原文明示', text: '愿景（通关图）+ 反愿景（失败罚）+ 1 年主线 + 1 月 Boss 战 + 日推 3 杠杆。' },
          { num: '04', name: '行动门槛拆解', tag: '原文明示', text: '“一集视频的 15–30 分钟”，瞬间击碎“没整块时间重构人生”的惯性推脱。' },
        ],
      },
    ],
    bespokeFooter: {
      tag: 'ACTIONABLE PROTOCOL WORKBENCH / 1-Day 认知重启书写与核查区',
      title: '反愿景挖掘与 24h 最小重启协议（实时持久化）',
      kind: 'journal',
      promptLabel: '[PROMPT 02] 如果未来 5 年维持现状，那个让我生理性厌恶的普通周二早晨是什么样？',
      placeholder: '试着写下一句反愿景警告（完整版自动存入本地 IndexedDB）...',
      checklist: [
        '[STAGE 01] 手写完成痛点挖掘与冷酷旁观者审计',
        '[STAGE 02] 设定 11:00 / 14:00 / 17:00 / 20:00 日间模式中断闹钟',
        '[STAGE 03] 睡前清理明早第 1 个日常杠杆任务的启动阻力',
      ],
    },
  },

  repo: {
    id: 'repo',
    tabLabel: 'GitHub 源码拆解',
    heroClass: 'hero-repo',
    domain: '交通冲突物理几何 & 风险量化引擎',
    paradigm: '工程架构与源码剖析',
    status: 'RCD_CEDI · 20/80 核心切片完成',
    tags: ['JiaxinTrans/RCD_CEDI', 'PYTHON + NUMBA JIT', 'RCD + CEDI 双阶段'],
    title: 'JiaxinTrans/RCD_CEDI（20/80 核心架构导读）',
    subtitle: '滤除 CSV/CLI 脚手架 -> 聚焦 RCD P2 遮挡可达性 (rcd.py)、Numba 分支定界搜救 (vehicle.py) 与双视角审计',
    scaffoldTitle: 'SYSTEM TOPOLOGY / RCD 可达筛选 -> CEDI 最优避险困难度求解导图',
    scaffolds: [
      {
        k: '01 [PROBLEM & GOAL / 核心使命]',
        v: '传统成对 SSM 默认所有冲突均等可达、风险对称；RCD_CEDI 在施工区作业面与多旁车遮挡下，量化主车各自真实的最低避险难度。',
      },
      {
        k: '02 [CONCURRENCY TRICK / 20/80 绝招]',
        v: 'Stage 1 用全局路径符号 S_C + 净空时间 ALT_C 过滤伪冲突；Stage 2 按自身代价下界升序搜索，触发 own_bound_stop 即安全早停。',
      },
      {
        k: '03 [ENGINEERING TRADE-OFF / 工程取舍]',
        v: '用解析尾界 linear_tail_bound 替代全时域闭环仿真，在保留 raw_rcd 几何回溯审计的前提下把二维搜索压入毫秒级延迟。',
      },
    ],
    dag: [
      { title: '1. 场景入口校验', sub: 'detect_vehicle_conflict', targetUnit: 'repo-01' },
      { title: '2. RCD P2 遮挡裁剪', sub: 'evaluate_c_obstruction', targetUnit: 'repo-01' },
      { title: '3. Numba 下界搜寻', sub: 'search + check_action', targetUnit: 'repo-02' },
      { title: '4. 双向审计输出', sub: 'evaluate_vehicle_pair', targetUnit: 'repo-02' },
    ],
    pureTitleZh: 'JiaxinTrans/RCD_CEDI — 20/80 核心架构导读（中文精华稿）',
    pureTitleEn: 'JiaxinTrans/RCD_CEDI — 20/80 Core Architecture Walkthrough',
    units: [
      {
        id: 'repo-01',
        unitLabel: 'Unit 1.1 · src/rcd_cedi/rcd.py',
        coreBadge: 'CORE 20%',
        summary: 'prepare_ab 缓存主对几何后，凭 I_C 投影与 ALT_C 净空时间判别旁车 C 是否阻挡 A-B 冲突',
        jumpLabel: '跳转下节 -> Numba 剪枝搜寻',
        jumpTarget: 'repo-02',
        defaultQaCount: 0,
        defaultQaHistory: [],
        codeSnippet: `def evaluate_c_obstruction(b, c, theta, pairs, t_ab) -> dict:
    products = tuple(
        dot(sub(cm, pair.V), theta) * dot(sub(cm, pair.E), theta)
        for pair in pairs for cm in corners
    )
    i_c = all(value < -EPS for value in products)
    sides = tuple(
        cross(sub(cm, pair.V), theta)
        for pair in pairs for cm in corners
    )
    s_c = not (all(v > EPS for v in sides) or all(v < -EPS for v in sides))
    if not (i_c and s_c):
        return dict(..., blocks=False, reachable=True)
    alt = distance / abs(w) if abs(w) > EPS else inf
    reachable = clears_before_contact(alt, t_ab)  # Eq. (16)
    return dict(..., ALT_C=alt, blocks=not reachable)`,
        segments: [
          { text: 'Stage 1 先由 prepare_ab(av, bv) 缓存碰撞角点对 (V, E) 与单位相对速度 theta_ab，', kind: null },
          {
            text: '再以 I_C 纵向夹角与全局路径符号 S_C 筛除不跨越阻挡走廊的旁车 C',
            kind: 'core',
            qaPrompt: '为什么 rcd.py 在 I_C 投影判据之外，还要叠加全局跨路径符号判据 S_C？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> I_C（Eq. 10）仅校验旁车 C 的四个角点是否夹在碰撞对 (V, E) 沿相对速度方向 theta 的纵向区间内；若 C 整体位于所有冲突路径同一侧，依然不会构成分隔遮挡。<br><span class="wb-epistemic">[分析推断]</span> S_C 通过 cross(cm - pair.V, theta) 是否出现跨侧变号来验证横向跨越通道，二者合取才能滤除横向错位误报。',
          },
          { text: '；对真正落入阻挡区的车辆，依据清出距离 D_C 与横向相对速率 w 执行 ', kind: null },
          {
            text: 'ALT_C < t_ab 严格早于碰撞检定（含 w≈0 显式零速补全）',
            kind: 'method',
            qaPrompt: '当旁车 C 与目标车 B 相对横向速度 w 接近 0（如平行同向行驶或相对静止）时如何避免除零？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> evaluate_c_obstruction 在 abs(w) <= EPS 时直接令 clearing distance = inf，并显式标记 zero_clearing_speed_case（relative_stationary / parallel_same_direction / parallel_opposite_direction），据此判为持续占用阻挡（blocks=True）。',
          },
        ],
        zh: 'RCD（Reachable Conflict Detection）充当高代价求解前的前置过滤器：同一场景内所有周边车辆共享一次 PreparedAB 几何准备结果；只有既处于 I_C & S_C 阻挡走廊内、又来不及在初始接触时刻 t_ab 前撤离（ALT_C >= t_ab，含 1e-9 容差防擦边误放行）时，才标记为 blocked。',
        dims: [
          { num: '01', name: '防静默入口门禁', tag: '原文明示', text: 'api.py 中 detect_vehicle_conflict 若检测到旁车初始已接触 A 或 B，返回 unresolved_initial_surrounding_contact，不静默误判。' },
          { num: '02', name: 'PreparedAB 共享缓存', tag: '原文明示', text: 'A-B 最早接触角点对与单位相对向量只求一次并冻结传递，周边每增加一辆车 C 只做常数次投影/叉积。' },
          { num: '03', name: 'Eq. 16 临界对齐', tag: '原文明示', text: 'clears_before_contact 使用 TIME_ATOL=1e-9 与 math.isclose，把「恰好同时刻清出」严格判作阻挡。' },
          { num: '04', name: '场景分工边界', tag: '原文明示', text: '文档明确区分：MLC 强制换道流仅做工作区 P1 检测，而车车冲突流先执行 RCD P1/P2 再对 reachable 车对算 CEDI。' },
        ],
      },
      {
        id: 'repo-02',
        unitLabel: 'Unit 2.1 · src/rcd_cedi/cedi/vehicle.py',
        coreBadge: 'NUMBA JIT',
        summary: 'search() 按主车自身控制下界升序遍历并在 own_bound_stop 处早停，solve() 结束再做原始 RCD 审计',
        jumpLabel: '回到 -> RCD P2 遮挡裁剪',
        jumpTarget: 'repo-01',
        defaultQaCount: 0,
        defaultQaHistory: [],
        codeSnippet: `@njit(cache=True, nogil=True)
def search(states, axes, radii, candidates, cfg, ...):
    best, best_ax, best_ay, best_idx = math.inf, math.nan, math.nan, -1
    for index in range(len(candidates)):
        lower, ax, ay = candidates[index]
        if lower >= best:
            counts[15] += 1  # own_bound_stop: 安全早停
            break
        code, cost, details, queries = check_action(...)
        if code == 0 and cost < best:
            best, best_ax, best_ay, best_idx = cost, ax, ay, index
    return best, best_ax, best_ay, best_idx, best_details, counts`,
        segments: [
          { text: 'evaluate_vehicle_pair(a, b, ...) 对 A、B 各自独立运行 solve_vehicle，', kind: null },
          {
            text: '将候选机动网格按主车自身代价下界 lower 升序扫描并触发 own_bound_stop',
            kind: 'core',
            qaPrompt: '为什么 search() 可以仅凭 lower >= best 就直接 break 终止剩余所有网格候选？',
            qaAnswer:
              '<span class="wb-epistemic">[原文明示]</span> 最终总代价为 math.sqrt(lower*lower + environment_squared)，其中周围前/后车响应平方项恒非负，因此任意候选的真实 CEDI 必 >= lower。候选数组已按 lower 从小到大排好序，只要当前 lower 追上已知可行解 best，后续网格绝无可能更优。',
          },
          { text: '；搜出最优 (ax, ay) 后，若 audit=True 还会关闭剪枝并调用 ', kind: null },
          {
            text: 'audit_tools.raw_rcd_audit 与 raw_rcd.swept_contact 交叉验算终态碰撞',
            kind: 'concept',
            qaPrompt: '为什么 Numba 内核已经跑完 check_action，外层 solve() 默认还要再验算一次 raw_rcd？',
            qaAnswer:
              '<span class="wb-epistemic">[分析推断]</span> check_action 为速度打包了数组视角、采样点触发与解析尾界估计；保留 audit=True 可用纯 Python 未打包的原始几何与 swept_contact 独立复核最优候选与首触时刻，作为论文实证可信度与零浮点偏差的防线。',
          },
        ],
        zh: 'Stage 2 的核心速度秘密落在两处工程配合：一方面用 prioritize_packed_scene 按初始 cv_window 碰撞顺序重排旁车检查顺序，让必撞候选尽快被 reject；另一方面用 nogil Numba 内核串联「下界早停 + 成本剪枝 (code=13) + 解析跟驰尾界 linear_tail_bound」，兼顾物理不对称建模与毫秒级求解。',
        dims: [
          { num: '01', name: '评估顺序启发式优化', tag: '原文明示', text: 'prioritize_packed_scene 依初始 cv_window 时间提前检查最近旁车，不删减任何车辆，只加速淘汰坏候选。' },
          { num: '02', name: '解析尾界闭式求解', tag: '原文明示', text: 'linear_tail_bound 对 r>=remaining 求上确界 -2(A+B*r)/(k*r^2)，把原本需要 ET 后逐帧积分的问题化为解析值。' },
          { num: '03', name: '非对称双视角建模', tag: '原文明示', text: 'evaluate_vehicle_pair(a, b) 互换 ego/opponent 算两次 CEDI，捕捉“一方让行代价高、另一方极易避险”的不对称性。' },
          { num: '04', name: '16 维漏斗可观测计数', tag: '原文明示', text: 'COUNTERS 实时统计 cost_pruned、SV_zone、rear_response_limit 等 16 类退回码，直观定位环境瓶颈。' },
        ],
      },
    ],
    bespokeFooter: {
      tag: 'OWNERSHIP BEFORE / AFTER · RCD_CEDI @njit 热循环细节优化示例',
      title: '避免 check_action 对早停与成本剪枝候选重复分配 (n, 12) details 数组',
      kind: 'diff',
      beforeCode: `# BEFORE (src/rcd_cedi/cedi/vehicle.py L146-152): 先分配数组，后做标量剪枝
details = np.full((n, 12), math.nan)
lower = math.hypot(ax/(cfg[5] if ax > 0. else cfg[6]), ay/cfg[7])
if lower >= upper_bound:
    return 13, math.inf, details, 0`,
      afterCode: `# AFTER: 先判标量剪枝与道路/施工区硬约束，复用 search() 预分配 scratch 缓冲
lower = math.hypot(ax/(cfg[5] if ax > 0. else cfg[6]), ay/cfg[7])
if lower >= upper_bound:
    return 13, math.inf, 0  # 零堆分配直接剪枝；仅 code==0 时写入 best_details`,
    },
  },
};

export const MODULE_SHOWCASES = [
  {
    id: 'academic-paper',
    title: '学术论文，逐段讲透',
    lead: '扔进 PDF 或 arXiv 链接，原图保留在原文旁；右边用大白话推公式、挑实验局限，读完做 3 道题防“假看懂”。',
    chips: ['arXiv / PDF 直连', '原图对照 + 人话推公式', '审稿挑刺与自测'],
    mascot: {
      sticker: './assets/stickers/pip-detective.svg',
      alt: '拿着放大镜破案论文的侦探小鸟贴纸',
      badge: '大学牲论文救星',
      line: '告别来回切翻译软件：30 秒看懂骨架，公式、原图与审稿弱点一屏理顺。',
    },
    defaultShot: 1,
    shots: [
      {
        tabLabel: '30 秒骨架导读',
        src: './media/shots/academic-top.png',
        alt: '学术论文精读顶部认知脚手架与 Transformer 可交互数据流图实机截图',
        caption: '先用 30 秒看懂破局直觉，点架构图节点直接跳到对应正文。',
      },
      {
        tabLabel: '原图 + 人话推公式',
        src: './media/shots/academic-body.png',
        alt: '学术论文精读双栏对照视图与 KaTeX 方差推导实机截图',
        caption: '左栏保留原汁原味 Figure 1 与双语对照，右栏顺手把公式方差推明白。',
      },
      {
        tabLabel: '挑刺复盘与自测',
        src: './media/shots/academic-bottom.png',
        alt: '学术论文精读底部核心主张公式与审稿人级自测实机截图',
        caption: '文末自动总结论证短板与显存坑，配 3 道闭卷追问验证真懂。',
      },
    ],
  },
  {
    id: 'cognitive-essay',
    title: '长视频干货，榨成清单',
    lead: '贴入 B 站、抖音或长文链接，没字幕也能转逐字稿；自动挤掉焦虑鸡汤，直接生成金句与今天能勾的行动清单。',
    chips: ['无字幕本地转逐字稿', '去鸡汤红绿对照', '今日行动书写台'],
    mascot: {
      sticker: './assets/stickers/pip-thinking.svg',
      alt: '脑袋闪现灵感灯泡的思考小鸟贴纸',
      badge: '信息焦绿榨汁机',
      line: '专治收藏夹吃灰与三分钟热度，把长视频干货变成今天就能打勾的事。',
    },
    defaultShot: 0,
    shots: [
      {
        tabLabel: '新旧思维对照',
        src: './media/shots/cognitive-top.png',
        alt: '认知模块顶部第一性原理横幅与新旧操作系统对照实机截图',
        caption: '一进门先把情绪鸡汤洗掉，红绿对照“旧习惯坑点 vs 新破局思路”。',
      },
      {
        tabLabel: '去魅提醒',
        src: './media/shots/cognitive-body.png',
        alt: '认知模块双栏去魅审查与创作者表达解剖实机截图',
        caption: '右边栏充当冷静旁白：点明适用边界与切换痛苦期，不盲从口号。',
      },
      {
        tabLabel: '金句与行动台',
        src: './media/shots/cognitive-bottom.png',
        alt: '认知模块底部核心金句与实时保存心理挖掘书写区实机截图',
        caption: '滑到底部直接提炼 5 句双语金句，并原地填写可保存的 24h 清单。',
      },
    ],
  },
  {
    id: 'repo-deconstruct',
    title: '万行源码，直抓架构与面试',
    lead: '自动滤掉 80% 单测与脚手架，按权重挑出核心代码逐行精讲；顺手备齐面试追问、简历 STAR 话术与二开蓝图。',
    chips: ['滤除 80% 边角噪音', '并发坑点追问', 'STAR 简历 + 二开模板'],
    mascot: {
      sticker: './assets/stickers/nori-laptop.svg',
      alt: '抱着笔记本狂写代码的程序猿猫咪贴纸',
      badge: '程序猿面试外挂',
      line: '不用死啃几万行代码泥潭，核心调度逻辑与高频面试考法一次备齐。',
    },
    defaultShot: 1,
    shots: [
      {
        tabLabel: '核心导航',
        src: './media/shots/repo-top.png',
        alt: '源码拆解模块 20/80 核心筛选与普通复述 vs 架构师级拆解实机截图',
        caption: '先替你标出哪 20% 核心目录必读，并对比“背书讲法 vs 架构师讲法”。',
      },
      {
        tabLabel: '高亮源码精讲',
        src: './media/shots/repo-code.png',
        alt: '源码拆解模块 Shiki Go 语法高亮与面试官连环追问右栏实机截图',
        caption: '左栏高亮并发临界代码行，右栏提前演练“断网丢锁”等连环追问。',
      },
      {
        tabLabel: '压测题 + STAR',
        src: './media/shots/repo-arsenal.png',
        alt: '源码拆解模块 L1-L3 面试压力测试与双版本 STAR 话术实机截图',
        caption: '覆盖 Redis vs Kafka 取舍等 L1–L3 压测题，附双版本简历 STAR 写法。',
      },
      {
        tabLabel: '二开蓝图与 Diff',
        src: './media/shots/repo-bottom.png',
        alt: '源码拆解模块 2 小时 Ownership 二开改造计划与可交互代码 Diff 对比实机截图',
        caption: '提供 3 个 2 小时可动手的优化蓝图与 Diff 区，改完就能写进项目经验。',
      },
    ],
  },
];

export const LIBRARY_DOCS = [
  {
    id: 'academic',
    modeLabel: '学术论文精读',
    themeField: 'AI 与序列注意力架构',
    paradigm: '实证评测与实验型',
    progressLabel: '待精读 · 核心 3 节已加载',
    title: 'Attention Is All You Need',
    subtitle: 'Vaswani et al. · Transformer 开山奠基架构与并行化解析',
    tags: ['#大模型架构', '#QKV缩放', '#O(1)最短路径'],
  },
  {
    id: 'cognitive',
    modeLabel: '认知长文 / 视频内化',
    themeField: '认知科学与心智系统',
    paradigm: '去噪心智与行动协议',
    progressLabel: '内置精读 · 3 核心单元就绪',
    title: 'How to Fix Your Entire Life in 1 Day',
    subtitle: 'Dan Koe · 身份恒温器、阿德勒目的论与 Anti-Vision 重启协议',
    tags: ['#身份恒温器', '#Anti-Vision', '#目的论防卫'],
  },
  {
    id: 'repo',
    modeLabel: 'GitHub 源码拆解',
    themeField: '交通冲突与 Numba 求解内核',
    paradigm: '工程架构与源码剖析',
    progressLabel: '20/80 已切片 · 4 个关键节点',
    title: 'JiaxinTrans/RCD_CEDI 核心架构导读',
    subtitle: 'src/rcd_cedi/rcd.py & cedi/vehicle.py · RCD 遮挡筛选 + CEDI 下界搜寻',
    tags: ['#RCD_P2可达', '#Numba_JIT', '#lower下界早停'],
  },
];
