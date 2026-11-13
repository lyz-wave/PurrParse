import type { WorkbenchDocument } from "@/core/contracts/document-ast";

export const ATTENTION_DEMO_DOCUMENT: WorkbenchDocument = {
  id: "demo-attention-is-all-you-need",
  modeId: "academic-paper",
  modeName: "学术论文精读",
  title: "Attention Is All You Need",
  subtitle:
    "Ashish Vaswani et al. (Google Brain & Google Research) | 现代大语言模型（GPT / Gemini / Claude）的底层架构蓝图",
  badges: ["NEURIPS 2017", "ARCHITECTURE / 架构奠基型论文", "BUILTIN DEMO"],
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
  isDemo: true,
  layoutRatio: [58, 42],
  dimensions: [
    {
      key: "dim1",
      colorSlot: "yellow",
      label: "核心论点/假说",
      extractionRule: "提取作者的核心主张、研究假说与范式级结论。",
    },
    {
      key: "dim2",
      colorSlot: "red",
      label: "关键概念 (悬停释义)",
      extractionRule: "提取核心学术术语与符号，并附带直觉白话定义。",
      enableTooltip: true,
    },
    {
      key: "dim3",
      colorSlot: "blue",
      label: "实证/数据",
      extractionRule: "提取实验结果、BLEU/F1指标、消融数据与参考文献支撑。",
    },
    {
      key: "dim4",
      colorSlot: "green",
      label: "让步/局限",
      extractionRule: "提取作者主动承认的代价、前置局限性或对前人方案的让步肯定。",
    },
    {
      key: "dim5",
      colorSlot: "purple",
      label: "方法论说明",
      extractionRule: "提取模型结构、数学定义、训练超参及实验设计。",
    },
  ],
  labels: {
    paretoButton: "[80/20 核心聚焦]",
    toggleSecondaryButton: "[显/隐中文]",
    toggleNotesButton: "[显/隐批注]",
    exportMdButton: "[导出 Markdown 笔记]",
    exportHtmlButton: "[编译离线单文件 .HTML]",
    userNoteButton: "[+ 添加本段随手笔记]",
    userNotePlaceholder: "在此记录你对本段的公式推导疑问或科研灵感（自动保存至本地）...",
    transitionPrefix: "[TRANSITION / 过渡铺垫]",
    mentalNavLabel: "00. 顶层导读与架构图",
    bottomNavLabel: "08. 论证复盘与自测",
  },
  topMentalModel: {
    title: "TOP MENTAL MODEL / 先见森林：30 秒认知脚手架与可交互数据流图",
    subtitle: "PRISM WORKBENCH V4.0 | ZERO-EMOJI ACADEMIC EDITION",
    cards: [
      {
        tag: "[PROBLEM & GAP / 真问题与前人死结]",
        body: "2017 年前的序列模型被 RNN（LSTM/GRU）垄断。RNN 的隐藏状态递归公式 $h_t = f(h_{t-1}, x_t)$ 将计算锁死在时间步上，导致两个致命瓶颈：(1) 样本内无法在 GPU 上并行计算；(2) 距离为 $n$ 的两个词之间信号传递需跨越 $O(n)$ 步，必然导致长距信息衰减。",
      },
      {
        tag: "[EUREKA INTUITION / 核心破局直觉]",
        body: "过去学界仅将 Attention 作为 RNN 的附属插件。作者提出彻底剔除循环与卷积，让序列内所有词元在同一时刻通过矩阵乘法直接两两对视（Self-Attention）。任意两词间的通信路径瞬间从 $O(n)$ 坍缩为 $O(1)$ 常数级直达，且训练过程可 100% 矩阵并行。",
      },
      {
        tag: "[FUNDAMENTAL TRADE-OFF / 核心交换代价]",
        body: "放弃循环结构带来两个代价：(1) 模型丧失天然词序感，必须注入正余弦位置编码（Positional Encoding）；(2) 全局两两比对使计算复杂度变为序列长度的平方 $O(n^2 \\cdot d)$，当 $n < d$（常规句子）时极快，但超长序列需限制局部注意力窗口。",
      },
    ],
    diagram: {
      title: "INTERACTIVE ARCHITECTURE DATAFLOW / Transformer 核心架构与缩放点积数据流图",
      hint: "[交互提示：点击图中任意模块节点，可直接平滑跳转至正文对应章节段落]",
      rankdir: "LR",
      nodes: [
        { id: "emb", label: "Embeddings + PE", subLabel: "sin/cos [n, 512] (§3.5)", targetUnitId: "sec3-5", colorSlot: "purple" },
        { id: "mha", label: "Multi-Head Attn", subLabel: "Bidirectional O(1) (§3.2.2)", targetUnitId: "sec3-2-2", colorSlot: "yellow" },
        { id: "sdp", label: "Scaled Dot-Product", subLabel: "QK^T / sqrt(d_k) (§3.2.1)", targetUnitId: "sec3-2-1", colorSlot: "red" },
        { id: "ffn", label: "Position-wise FFN", subLabel: "512 -> 2048 -> 512 (§3.3)", targetUnitId: "sec3-3", colorSlot: "blue" },
        { id: "dec", label: "Masked & Cross Attn", subLabel: "Causal Mask -inf (§3.1/§3.2.3)", targetUnitId: "sec3-2-3", colorSlot: "green" },
        { id: "comp", label: "Complexity O(1)", subLabel: "WMT14 SOTA (§4 / §6.1)", targetUnitId: "sec4-1", colorSlot: "navy" },
      ],
      edges: [
        { from: "emb", to: "mha", label: "[n, 512]" },
        { from: "mha", to: "sdp", label: "h=8 heads [n, 64]" },
        { from: "sdp", to: "ffn", label: "Concat [n, 512]" },
        { from: "ffn", to: "dec", label: "Enc Memory K,V" },
        { from: "dec", to: "comp", label: "28.4 / 41.8 BLEU" },
      ],
    },
    glossaryTitle: "GLOSSARY & SYMBOLS / 核心术语与数学符号锚点表（正文中遇到红色术语可悬停查看）",
    glossary: [
      {
        term: "Q, K, V (Query/Key/Value)",
        definition: "信息检索模型：$Q$ 是当前位置的查询寻址向量，$K$ 是候选位置的索引键向量，$QK^T$ 算出相关性分布后，加权汇聚 $V$（实际内容向量）。",
      },
      {
        term: "1 / sqrt(d_k)",
        definition: "方差归一化因子：若 $q, k$ 独立同分布且方差为 $1$，则点积方差膨胀为 $d_k$；除以 $\\sqrt{d_k}$ 将方差拉回 $1$，防止 Softmax 饱和梯度归零。",
      },
      {
        term: "Multi-Head (h = 8)",
        definition: "子空间并行解耦：将 $d_{model}=512$ 切分为 $8$ 个独立的 $64$ 维投影子空间，同时捕捉指代、句法、语义搭配等多元关联，且总计算量不变。",
      },
      {
        term: "Positional Encoding (PE)",
        definition: "多频正余弦位置时钟：利用三角恒等式 $\\sin(\\alpha+\\beta)$，使任意固定距离偏移 $PE_{pos+k}$ 都能表示为 $PE_{pos}$ 的线性旋转变换。",
      },
    ],
  },
  sections: [
    { id: "sec-abstract", navLabel: "Abstract", navRole: "[总纲]", title: "Abstract · 论文摘要", taskBadge: "确立靶子 -> 提出纯注意力架构 -> 亮出 SOTA 质量与并行算力比" },
    { id: "sec-intro", navLabel: "1. Intro", navRole: "[RNN串行瓶颈]", title: "1. Introduction · 引言", taskBadge: "解剖 RNN 的物理死结（h_t 依赖 h_{t-1} 导致无法样本内并行）" },
    { id: "sec-bg", navLabel: "2. Background", navRole: "[O(1)依赖路径]", title: "2. Background · 研究背景与相关工作", taskBadge: "对比 CNN 并行方案，确立 O(1) 路径长度优势与多头补偿机制" },
    { id: "sec-arch", navLabel: "3. Architecture", navRole: "[核心引擎]", title: "3. Model Architecture · 模型架构（§3.1 - §3.5）", taskBadge: "编解码堆栈 -> 缩放点积 -> 多头机制 -> 三类应用 -> FFN -> 权重共享 -> 位置编码" },
    { id: "sec-why", navLabel: "4. Why Self-Attention", navRole: "[复杂度对决]", title: "4. Why Self-Attention · 为什么选择自注意力", taskBadge: "从每层算力、串行步数、最大路径长度三维证明自注意力的理论优越性" },
    { id: "sec-exp", navLabel: "5-6. Results", navRole: "[SOTA与消融]", title: "5 & 6. Training & Results · 训练配置、主实验与消融验证", taskBadge: "Noam 预热学习率 -> Table 2 WMT14 刷榜 -> Table 3 消融实验验证" },
    { id: "sec-conc", navLabel: "7. Conclusion", navRole: "[多模态展望]", title: "7. Conclusion · 结论与多模态未来展望", taskBadge: "总结首个纯注意力转导模型，预言向图像、音频、视频多模态的扩张" },
  ],
  units: [
    {
      id: "abs-p1",
      unitCode: "Abs.P1",
      sectionId: "sec-abstract",
      sectionTitle: "Abstract · 论文摘要",
      weight: "core",
      tldr: "彻底抛弃循环与卷积，仅靠注意力机制实现翻译质量与训练并行度的双重跃迁",
      primaryKind: "prose",
      primaryText:
        "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks in an encoder-decoder configuration. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature. We show that the Transformer generalizes well to other tasks by applying it successfully to English constituency parsing both with large and limited training data.",
      highlights: [
        {
          text: "sequence transduction models",
          dim: "dim2",
          tooltip: "序列转导模型：将输入序列映射为输出序列的模型（如机器翻译、语音识别、文本摘要）。",
        },
        {
          text: "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
          dim: "dim1",
        },
        {
          text: "Transformer",
          dim: "dim2",
          tooltip: "Transformer：本文提出的首个完全基于自注意力机制、不含任何循环或卷积操作的序列转导模型。",
        },
        {
          text: "Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles by over 2 BLEU.",
          dim: "dim3",
        },
        {
          text: "On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature.",
          dim: "dim3",
        },
      ],
      secondaryBlockText:
        "主流的序列转导模型普遍采用基于复杂循环神经网络（RNN）或卷积神经网络（CNN）的编码器-解码器架构。表现最优的模型还会通过注意力机制连接编码器与解码器。我们提出了一种全新的简洁网络架构——Transformer，它完全基于注意力机制构建，彻底摒弃了循环结构与卷积操作。在两项机器翻译任务上的实验表明，该模型不仅翻译质量更优，而且具备更强的并行计算能力，训练所需时间大幅缩短。我们的模型在 WMT 2014 英译德任务上取得了 28.4 的 BLEU 分数，比此前包括多模型集成在内的最佳结果高出 2 个 BLEU 以上。在 WMT 2014 英译法任务上，我们的单模型仅在 8 块 GPU 上训练 3.5 天，便创下了 41.8 的单模型最高 BLEU 纪录，而训练成本仅为此前文献中顶尖模型的一小部分。此外，我们将 Transformer 成功应用于大规模及受限数据条件下的英语成分句法分析，证明了其出色的跨任务泛化能力。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[既有范式：复杂 RNN/CNN + 注意力辅助] -> [核心破局：只留注意力，全砍循环与卷积] -> [双重实证：BLEU 刷榜 + 训练成本暴降]。",
          echoTargetId: "sec6-1",
          echoLabel: "[跳转验证 -> §6.1 翻译主实验]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "全文总纲（Thesis Statement）。前两句承认现有最佳模型是“RNN/CNN + Attention”，第三句直接釜底抽薪（dispensing with... entirely）：既然 Attention 已经承担了核心对齐，为何还要保留拖慢并行速度的 RNN/CNN？",
        },
        {
          label: "03 / 硬核破译（数字背后的分量）",
          body: "在机器翻译评测中，BLEU 提升 0.5 即属显著突破，而 Transformer 单模型超越前人“多模型集成（Ensembles）”达 2.0 BLEU 以上，且训练算力从 $10^{20}$ FLOPs 降至 $10^{18}\\sim 10^{19}$ FLOPs 量级，彻底打破了“精度与训练速度不可兼得”的僵局。",
        },
        {
          label: "04 / 审稿人视角（论证技巧）",
          body: "对比修辞与防御闭环：用 complex 修饰传统 RNN/CNN，用 simple 修饰 Transformer；并在摘要末句补上“英语成分句法分析”，预先封堵审稿人关于“是否仅适用于机器翻译”的质疑。",
        },
      ],
    },
    {
      id: "sec1-p1",
      unitCode: "§1.P1",
      sectionId: "sec-intro",
      sectionTitle: "1. Introduction · 引言",
      weight: "transition",
      tldr: "确立 LSTM 与 GRU 在序列建模任务中的既有统治地位",
      primaryKind: "prose",
      primaryText:
        "Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation. Numerous efforts have since continued to push the boundaries of recurrent language models and encoder-decoder architectures.",
      highlights: [],
      secondaryBlockText:
        "循环神经网络，尤其是长短期记忆网络（LSTM）和门控循环神经网络（GRU），早已在语言建模和机器翻译等序列建模与转导任务中确立了统治地位。此后，学界投入了大量精力，持续拓展循环语言模型与编码器-解码器架构的性能边界。",
      notes: [],
      transitionSummary: "先确立学界共识基线（承认 RNN/LSTM 的历史地位），为下一段直接刺穿其串行计算瓶颈做铺垫。",
    },
    {
      id: "sec1-p2",
      unitCode: "§1.P2",
      sectionId: "sec-intro",
      sectionTitle: "1. Introduction · 引言",
      weight: "core",
      tldr: "指明 RNN 的根本物理缺陷：时间步递归锁死了样本内并行化",
      primaryKind: "prose",
      primaryText:
        "Recurrent models typically factor computation along the symbol positions of the input and output sequences. Aligning the positions to steps in computation time, they generate a sequence of hidden states $h_t$, as a function of the previous hidden state $h_{t-1}$ and the input for position $t$. This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths, as memory constraints limit batching across examples. Recent work has achieved significant improvements in computational efficiency through factorization tricks and conditional computation, while also improving model performance in case of the latter. The fundamental constraint of sequential computation, however, remains.",
      highlights: [
        {
          text: "Recurrent models typically factor computation along the symbol positions of the input and output sequences. Aligning the positions to steps in computation time, they generate a sequence of hidden states $h_t$, as a function of the previous hidden state $h_{t-1}$ and the input for position $t$.",
          dim: "dim5",
        },
        {
          text: "This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths, as memory constraints limit batching across examples.",
          dim: "dim1",
        },
        {
          text: "Recent work has achieved significant improvements in computational efficiency through factorization tricks and conditional computation, while also improving model performance in case of the latter. The fundamental constraint of sequential computation, however, remains.",
          dim: "dim4",
        },
      ],
      secondaryBlockText:
        "循环模型通常沿着输入和输出序列的符号位置来分解计算过程。它们将词元位置与计算时间步一一对齐，根据前一时刻的隐藏状态 $h_{t-1}$ 和当前位置 $t$ 的输入，依次生成隐藏状态序列 $h_t$。这种与生俱来的顺序计算特性，从根本上阻碍了训练样本内部的并行化；当序列长度增加时，由于显存限制了跨样本的批次大小（Batching），这一缺陷变得尤为致命。尽管近期的研究通过矩阵分解技巧和条件计算显著提升了计算效率（后者还同时提升了模型性能），但“顺序计算”这一根本桎梏依然未能打破。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[承接 §1.P1] -> [剖析递归式 $h_t = f(h_{t-1}, x_t)$] -> [导出核心痛点：时间步耦合 = 样本内无法并行] -> [让步反驳：局部改良无法破除串行本质]。",
          echoTargetId: "sec4-1",
          echoLabel: "[跳转呼应 -> §4 复杂度对比表]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "全文立论支点（Problem Formulation）。精准定义了整篇论文要消灭的核心敌人——O(n) sequential operations。",
        },
        {
          label: "03 / 硬核破译（硬件体系结构视角）",
          body: "现代 GPU 拥有数千个张量核心，最擅长同时执行互不依赖的大规模矩阵乘法；而 RNN 强迫计算按 $t=1, 2, \\dots, n$ 串行排队，导致 GPU 算力利用率极低。",
        },
        {
          label: "04 / 审稿人视角（让步与反击）",
          body: "可学写法：主动引用矩阵分解与条件计算（绿色让步），承认其改良贡献，随即用 The fundamental constraint... however, remains 完成定性收网。",
        },
      ],
    },
    {
      id: "sec1-p3",
      unitCode: "§1.P3-P4",
      sectionId: "sec-intro",
      sectionTitle: "1. Introduction · 引言",
      weight: "core",
      tldr: "从“注意力作为循环网络的插件”跃迁为“纯注意力架构 Transformer”",
      primaryKind: "prose",
      primaryText:
        "Attention mechanisms have become an integral part of compelling sequence modeling and transduction models in various tasks, allowing modeling of dependencies without regard to their distance in the input or output sequences. In all but a few cases, however, such attention mechanisms are used in conjunction with a recurrent network.\n\nIn this work we propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output. The Transformer allows for significantly more parallelization and can reach a new state of the art in translation quality after being trained for as little as twelve hours on eight P100 GPUs.",
      highlights: [
        {
          text: "In all but a few cases, however, such attention mechanisms are used in conjunction with a recurrent network.",
          dim: "dim4",
        },
        {
          text: "In this work we propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output.",
          dim: "dim1",
        },
        {
          text: "The Transformer allows for significantly more parallelization and can reach a new state of the art in translation quality after being trained for as little as twelve hours on eight P100 GPUs.",
          dim: "dim3",
        },
      ],
      secondaryBlockText:
        "注意力机制已成为各类序列建模与转导模型中不可或缺的组件，它能够直接对输入或输出序列中的依赖关系进行建模，而无需考虑它们之间的距离。然而，除了极少数特例外，这类注意力机制几乎总是与循环网络绑定使用。\n\n在本研究中，我们提出了 Transformer——一种彻底摒弃循环结构、完全依赖注意力机制来捕捉输入与输出之间全局依赖关系的模型架构。Transformer 支持更高程度的并行计算，仅需在 8 块 P100 GPU 上训练短短 12 小时，即可在翻译质量上达到全新的最高水平。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[指出现状悖论：Attention 本可无视距离，却被绑在慢速 RNN 上] -> [提出解决方案：砍掉循环结构，完全由 Attention 独立建模全局依赖]。",
          echoTargetId: "sec3-1",
          echoLabel: "[跳转呼应 -> §3.1 总体架构]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "核心主张亮剑（Core Proposal）。完成引言“立靶子 -> 亮王牌”的闭环。",
        },
        {
          label: "03 / 硬核破译（科学发现路径）",
          body: "Bahdanau (2014) 发明 Attention 时只是为了缓解 RNN 长句遗忘；Vaswani 等人的洞察在于：既然 Attention 自己就能跨任意距离抓关系，那 RNN 除了拖慢速度还在干嘛？",
        },
        {
          label: "04 / 审稿人视角",
          body: "12 小时 Base 模型即可刷榜，强力佐证了并行化带来的工程红利。",
        },
      ],
    },
    {
      id: "sec2-p1",
      unitCode: "§2.P1-P4",
      sectionId: "sec-bg",
      sectionTitle: "2. Background · 研究背景与相关工作",
      weight: "support",
      tldr: "相比卷积方案的 O(n) 与 O(log_k n) 路径，自注意力实现 O(1) 常数级直连",
      primaryKind: "prose",
      primaryText:
        "The goal of reducing sequential computation also forms the foundation of the Extended Neural GPU, ByteNet and ConvS2S, all of which use convolutional neural networks as basic building block, computing hidden representations in parallel for all input and output positions. In these models, the number of operations required to relate signals from two arbitrary input or output positions grows in the distance between positions, linearly for ConvS2S and logarithmically for ByteNet. This makes it more difficult to learn dependencies between distant positions.\n\nIn the Transformer this is reduced to a constant number of operations, O(1), albeit at the cost of reduced effective resolution due to averaging attention-weighted positions, an effect we counteract with Multi-Head Attention as described in section 3.2.\n\nSelf-attention, sometimes called intra-attention is an attention mechanism relating different positions of a single sequence in order to compute a representation of the sequence. To the best of our knowledge, however, the Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.",
      highlights: [
        {
          text: "In these models, the number of operations required to relate signals from two arbitrary input or output positions grows in the distance between positions, linearly for ConvS2S and logarithmically for ByteNet. This makes it more difficult to learn dependencies between distant positions.",
          dim: "dim4",
        },
        {
          text: "In the Transformer this is reduced to a constant number of operations, O(1)",
          dim: "dim1",
        },
        {
          text: "O(1)",
          dim: "dim2",
          tooltip: "常数级操作步数 O(1)：在自注意力层中，无论两个词相距多远，只需一次矩阵相乘即可直接交互信号，路径长度不随距离增长。",
        },
        {
          text: "albeit at the cost of reduced effective resolution due to averaging attention-weighted positions, an effect we counteract with Multi-Head Attention as described in section 3.2.",
          dim: "dim4",
        },
        {
          text: "Multi-Head Attention",
          dim: "dim2",
          tooltip: "多头注意力：将特征投影到多个独立子空间并行计算注意力，避免单一加权平均把不同维度的语义特征混合模糊。",
        },
        {
          text: "Self-attention",
          dim: "dim2",
          tooltip: "自注意力（内部注意力）：通过关联同一个序列内部不同位置之间的词元，来计算该序列自身上下文表征的机制。",
        },
        {
          text: "To the best of our knowledge, however, the Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "减少顺序计算的目标同样构成了 Extended Neural GPU、ByteNet 和 ConvS2S 的研究基础。这些模型均以卷积神经网络为基本构建块，并行计算所有输入和输出位置的隐藏表征。然而在这些模型中，关联任意两个输入或输出位置信号所需的操作次数，会随位置间距离的增加而增长（在 ConvS2S 中呈线性增长 $O(n)$，在 ByteNet 中呈对数增长 $O(\\log_k n)$）。这使得学习远距离位置间的依赖关系变得更加困难。\n\n而在 Transformer 中，这一操作次数被缩减为常数级 $O(1)$；尽管对注意力加权位置进行平均会导致有效分辨率有所降低，但我们通过第 3.2 节所述的多头注意力机制（Multi-Head Attention）成功抵消了这一副作用。\n\n自注意力（有时亦称内部注意力）是一种通过关联单个序列内部不同位置来计算该序列表征的注意力机制。据我们所知，Transformer 是首个完全依赖自注意力来计算输入与输出表征、而不使用任何序列对齐 RNN 或卷积的转导模型。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[评述同类竞品：CNN 虽能并行，但受限于局部感受野，远距通信需堆叠多层] -> [确立本文优势：$O(1)$ 步全局直连] -> [主动坦白代价与解药：加权平均模糊化 -> 多头注意力补偿]。",
          echoTargetId: "sec3-2-2",
          echoLabel: "[跳转呼应 -> §3.2.2 多头注意力]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "文献对比定位（Literature Gap Differentiation）。清晰区分自己与同时期并行竞品（ByteNet / ConvS2S）的本质差异。",
        },
        {
          label: "03 / 硬核破译（何谓“有效分辨率降低”？）",
          body: "单头注意力将整句所有词的 Value 向量按标量权重加权求和（$\\sum \\alpha_i v_i$），不同语法属性、指代关系的特征被压缩混叠进同一个向量中，导致细粒度特征模糊。引入 8 个注意力头后，不同子空间各司其职，分辨率得以恢复。",
        },
        {
          label: "04 / 审稿人视角",
          body: "自曝短板并当场给出补偿机制（Multi-Head），是极高水准的学术诚实与结构闭环写法。",
        },
      ],
    },
    {
      id: "sec3-1",
      unitCode: "§3.1",
      sectionId: "sec-arch",
      sectionTitle: "3. Model Architecture · 模型架构（§3.1 - §3.5）",
      weight: "support",
      tldr: "Encoder-Decoder N=6 对称堆栈、残差层归一化与解码器自回归掩码",
      primaryKind: "prose",
      primaryText:
        "Encoder: The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a simple, position-wise fully connected feed-forward network. We employ a residual connection around each of the two sub-layers, followed by layer normalization. That is, the output of each sub-layer is LayerNorm(x + Sublayer(x)). To facilitate these residual connections, all sub-layers in the model, as well as the embedding layers, produce outputs of dimension d_model = 512.\n\nDecoder: The decoder is also composed of a stack of N = 6 identical layers. In addition to the two sub-layers in each encoder layer, the decoder inserts a third sub-layer, which performs multi-head attention over the output of the encoder stack. We also modify the self-attention sub-layer in the decoder stack to prevent positions from attending to subsequent positions. This masking, combined with fact that the output embeddings are offset by one position, ensures that the predictions for position i can depend only on the known outputs at positions less than i.",
      figures: [
        {
          label: "Figure 1",
          caption: "Figure 1: The Transformer - model architecture.",
          imageUrls: ["https://arxiv.org/html/1706.03762v7/Figures/ModalNet-21.png"],
        },
      ],
      highlights: [
        {
          text: "residual connection",
          dim: "dim2",
          tooltip: "残差连接：将子层输入 x 直接加到子层输出 Sublayer(x) 上，构建梯度直通车，使深层网络易于优化。",
        },
        {
          text: "masking",
          dim: "dim2",
          tooltip: "因果掩码（Causal Masking）：在解码端计算自注意力时，将对角线右上方的未来位置权重置为负无穷，确保预测第 i 个词时无法偷看第 i 个词之后的答案。",
        },
        {
          text: "The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers.",
          dim: "dim5",
        },
        {
          text: "In addition to the two sub-layers in each encoder layer, the decoder inserts a third sub-layer, which performs multi-head attention over the output of the encoder stack.",
          dim: "dim5",
        },
      ],
      secondaryBlockText:
        "编码器（Encoder）：由 $N=6$ 个完全相同的层堆叠而成。每一层包含两个子层：第一子层是多头自注意力机制，第二子层是逐位置全连接前馈网络。我们在每个子层周围引入残差连接，随后进行层归一化（Post-LN），即每个子层的输出为 $\\text{LayerNorm}(x + \\text{Sublayer}(x))$。为了便于实现残差相加，模型中的所有子层以及嵌入层的输出维度均统一设定为 $d_{\\text{model}} = 512$。\n\n解码器（Decoder）：同样由 $N=6$ 个完全相同的层堆叠而成。除了包含编码器层中的两个子层外，解码器还在中间插入了第三个子层，用于对编码器堆栈的输出执行多头交叉注意力。此外，我们修改了解码器堆栈中的自注意力子层，以防止当前位置关注到后续未来的位置。这种掩码机制（Masking）与输出嵌入向后偏移一个位置的设计相结合，确保了对位置 $i$ 的预测仅依赖于位置小于 $i$ 的已知输出。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[定义宏观拓扑：6层 Encoder + 6层 Decoder] -> [统一内部接口维度 $d_{\\text{model}}=512$ 支撑残差相加] -> [引入下三角掩码实现训练并行与自回归属性兼容]。",
          echoTargetId: "sec3-2-3",
          echoLabel: "[跳转细化 -> §3.2.3 三类注意力]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "系统宏观蓝图搭建（Macro Architecture Specification）。规定残差接口规范与自回归因果约束。",
        },
        {
          label: "03 / 硬核破译（为什么训练时 Decoder 也能并行？）",
          body: "推理生成时必须逐词自回归，但在训练时，目标句（Ground Truth）全部已知。通过乘以一个右上角全为 $-\\infty$ 的下三角掩码矩阵（Causal Mask），位置 $1\\dots n$ 的预测可以在一次矩阵运算中同时完成，且严格不泄露未来词信息。",
        },
        {
          label: "04 / 审稿人视角（Post-LN vs Pre-LN 历史演进）",
          body: "原版采用 Post-LN（$\\text{LayerNorm}(x + \\text{Sublayer}(x))$），导致深层梯度在输出层附近不稳定（不得不强依赖 §5.3 的 Warmup）；后续 GPT-2/LLaMA 普遍改为 Pre-LN 以提升训练稳定性。",
        },
      ],
    },
    {
      id: "sec3-2-1",
      unitCode: "§3.2.1",
      sectionId: "sec-arch",
      sectionTitle: "3. Model Architecture · 模型架构（§3.1 - §3.5）",
      weight: "core",
      tldr: "Scaled Dot-Product Attention 核心公式与 1/sqrt(d_k) 缩放因子的方差推演",
      primaryKind: "prose",
      primaryText:
        "An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. We call our particular attention \"Scaled Dot-Product Attention\". The input consists of queries and keys of dimension d_k, and values of dimension d_v. We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function to obtain the weights on the values.\n\nThe two most commonly used attention functions are additive attention, and dot-product (multiplicative) attention. Dot-product attention is identical to our algorithm, except for the scaling factor of 1/sqrt(d_k). While for small values of d_k the two mechanisms perform similarly, dot product attention is much faster and more space-efficient in practice, since it can be implemented using highly optimized matrix multiplication code. While for large values of d_k, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients. To counteract this effect, we scale the dot products by 1/sqrt(d_k). (Footnote 4: assume that the components of q and k are independent random variables with mean 0 and variance 1; then q·k has mean 0 and variance d_k.)",
      formulas: [
        {
          latex: "\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V",
          flowLabel: "TENSOR SHAPE FLOW",
          flowText: "Q [n, d_k] × K^T [d_k, m] -> Scores [n, m] -> (÷ √d_k & Softmax) -> Weights [n, m] × V [m, d_v] -> Out [n, d_v]",
        },
      ],
      figures: [
        {
          label: "Figure 2",
          caption:
            "Figure 2: (left) Scaled Dot-Product Attention. (right) Multi-Head Attention consists of several attention layers running in parallel.",
          imageUrls: [
            "https://arxiv.org/html/1706.03762v7/Figures/ModalNet-19.png",
            "https://arxiv.org/html/1706.03762v7/Figures/ModalNet-20.png",
          ],
        },
      ],
      highlights: [
        {
          text: "Scaled Dot-Product Attention",
          dim: "dim2",
          tooltip: "缩放点积注意力：计算 Q 与 K 的矩阵点积并除以 sqrt(d_k) 稳定方差，经过 Softmax 归一化后对 V 加权求和。",
        },
        {
          text: "dot product attention is much faster and more space-efficient in practice, since it can be implemented using highly optimized matrix multiplication code.",
          dim: "dim3",
        },
        {
          text: "While for large values of d_k, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients. To counteract this effect, we scale the dot products by 1/sqrt(d_k).",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "注意力函数可以描述为将一个查询（Query）和一组键值对（Key-Value pairs）映射为输出的过程，其中查询、键、值和输出均为向量。我们将本文特定的注意力机制称为“缩放点积注意力（Scaled Dot-Product Attention）”。输入包含维度为 $d_k$ 的查询与键，以及维度为 $d_v$ 的值。我们计算查询与所有键的点积，将每个结果除以 $\\sqrt{d_k}$，然后应用 Softmax 函数以获得作用于值上的权重。\n\n最常用的两种注意力函数是加性注意力（Additive Attention）和点积（乘性）注意力。除了缩放因子 $\\frac{1}{\\sqrt{d_k}}$ 外，点积注意力与我们的算法完全一致。当 $d_k$ 较小时，两种机制表现相近，但点积注意力在实践中速度更快、显存效率更高，因为它可以直接调用高度优化的矩阵乘法算子（GEMM）。然而当 $d_k$ 较大时，点积的绝对值会变得很大，从而将 Softmax 函数推入梯度极小的饱和区。为了抵消这一现象，我们将点积乘以 $\\frac{1}{\\sqrt{d_k}}$ 进行缩放。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[定义 Q/K/V 映射] -> [提出矩阵化点积公式] -> [论证点积优于加性注意力的硬件加速优势] -> [证明 1/sqrt(d_k) 防梯度消失的统计学机制]。",
          echoTargetId: "sec6-2",
          echoLabel: "[跳转验证 -> §6.2 Table 3 消融实验]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "全模型算子核心（Core Mathematical Kernel）。奠定了现代大模型矩阵并行计算的数学基石。",
        },
        {
          label: "03 / 硬核破译（补全注脚 4 的完整方差推导）",
          body: "设 $q_i, k_i$ 相互独立且 $\\mathbb{E}[q_i]=\\mathbb{E}[k_i]=0, \\text{Var}=1$，则点积和的方差为 $\\text{Var}(\\sum_{i=1}^{d_k} q_i k_i) = \\sum_{i=1}^{d_k} \\mathbb{E}[q_i^2]\\mathbb{E}[k_i^2] = d_k$，标准差为 $\\sqrt{d_k}$。除以 $\\sqrt{d_k}$ 后方差重回 $1$，阻止 Softmax 退化为硬 One-hot 导致导数 $p(1-p)\\approx 0$。",
        },
        {
          label: "04 / 审稿人视角",
          body: "Footnote 4 用两行概率论把看似经验性的超参变成了必然数学推论，含金量极高。",
        },
      ],
    },
    {
      id: "sec3-2-2",
      unitCode: "§3.2.2",
      sectionId: "sec-arch",
      sectionTitle: "3. Model Architecture · 模型架构（§3.1 - §3.5）",
      weight: "core",
      tldr: "Multi-Head Attention：在不增加总计算复杂度的前提下并行捕获 8 个子空间特征",
      primaryKind: "prose",
      primaryText:
        "Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d_k, d_k and d_v dimensions, respectively. On each of these projected versions of queries, keys and values we then perform the attention function in parallel, yielding d_v-dimensional output values. These are concatenated and once again projected, resulting in the final values.\n\nMulti-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this. In this work we employ h = 8 parallel attention layers, or heads. For each of these we use d_k = d_v = d_model / h = 64. Due to the reduced dimension of each head, the total computational cost is similar to that of single-head attention with full dimensionality.",
      formulas: [
        {
          latex: "\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h)W^O \\quad \\text{where} \\quad \\text{head}_i = \\text{Attention}(QW_i^Q, KW_i^K, VW_i^V)",
          flowLabel: "TENSOR SHAPE FLOW",
          flowText: "X [n, 512] × W_i [512, 64] -> 8 × head_i [n, 64] -> Concat [n, 512] × W^O [512, 512] -> Out [n, 512]",
        },
      ],
      highlights: [
        {
          text: "Instead of performing a single attention function with d_model-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d_k, d_k and d_v dimensions, respectively.",
          dim: "dim1",
        },
        {
          text: "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.",
          dim: "dim1",
        },
        {
          text: "In this work we employ h = 8 parallel attention layers, or heads. For each of these we use d_k = d_v = d_model / h = 64. Due to the reduced dimension of each head, the total computational cost is similar to that of single-head attention with full dimensionality.",
          dim: "dim5",
        },
      ],
      secondaryBlockText:
        "与其直接对 $d_{\\text{model}}$ 维度的键、值和查询执行单一的注意力函数，我们发现更有益的做法是：使用不同的、可学习的线性投影矩阵，将查询、键和值分别向 $d_k$、$d_k$ 和 $d_v$ 维度投影 $h$ 次。随后，我们在这些投影后的版本上并行执行注意力函数，生成 $d_v$ 维的输出值；接着将它们拼接（Concat）起来并再次进行线性投影，得到最终输出。\n\n多头注意力使模型能够同时关注来自不同位置、不同表征子空间的信息。如果只使用单一注意力头，加权平均操作会抑制这种能力。在本研究中，我们采用 $h=8$ 个并行注意力头，每个头的维度设为 $d_k = d_v = d_{\\text{model}} / h = 64$。由于每个头的维度按比例缩小，其总计算开销与全维度的单头注意力基本相当。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[兑现 §2.P2 承诺] -> [形式化定义多头子空间投影与拼接] -> [证明算力等价性：$8 \\times (n^2 \\times 64) = n^2 \\times 512$]。",
          echoTargetId: "sec2-p1",
          echoLabel: "[跳回伏笔 -> §2.P2 分辨率补偿]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "核心解耦创新（Subspace Decoupling）。解释为何纯注意力模型能在不加计算量的前提下获得多通道语义捕获能力。",
        },
        {
          label: "03 / 硬核破译（多头机制相当于 CNN 中的什么？）",
          body: "多头注意力在概念上类似于 CNN 中的多通道卷积核（Multiple Filters）：每个头都有独立的 $W_i^Q, W_i^K$，一个头专门捕捉代词指代，另一个头专门捕捉主谓搭配，最后通过 $W^O$ 线性融合成完整语义。",
        },
        {
          label: "04 / 审稿人视角",
          body: "等算力拆分（$h \\times d_k = 512$）为 §6.2 Table 3 的严格控制变量消融实验提供了前提。",
        },
      ],
    },
    {
      id: "sec3-2-3",
      unitCode: "§3.2.3",
      sectionId: "sec-arch",
      sectionTitle: "3. Model Architecture · 模型架构（§3.1 - §3.5）",
      weight: "support",
      tldr: "注意力在 Transformer 中的三类具体应用场景（交叉注意力、编码自注意力、掩码解码自注意力）",
      primaryKind: "prose",
      primaryText:
        "The Transformer uses multi-head attention in three different ways: 1. In \"encoder-decoder attention\" layers, the queries come from the previous decoder layer, and the memory keys and values come from the output of the encoder. This allows every position in the decoder to attend over all positions in the input sequence. 2. The encoder contains self-attention layers. In a self-attention layer all of the keys, values and queries come from the same place, in this case, the output of the previous layer in the encoder. 3. Similarly, self-attention layers in the decoder allow each position in the decoder to attend to all positions in the decoder up to and including that position. We implement this inside of scaled dot-product attention by masking out (setting to -infinity) all values in the input of the softmax which correspond to illegal connections.",
      highlights: [
        {
          text: "encoder-decoder attention",
          dim: "dim5",
        },
        {
          text: "setting to -infinity",
          dim: "dim5",
        },
      ],
      secondaryBlockText:
        "Transformer 以三种不同方式使用多头注意力机制：(1) 编码器-解码器交叉注意力层：查询 $Q$ 来自解码器前一层，而作为记忆的键 $K$ 和值 $V$ 来自编码器最终输出，使解码器每个位置都能关注全部输入位置；(2) 编码器自注意力层：$Q, K, V$ 均来自编码器前一层的输出，实现全序列双向交互；(3) 解码器掩码自注意力层：在缩放点积 Softmax 之前将非法未来连接置为 $-\\infty$，从而保持严格的左向右自回归属性。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "将统一的 MultiHead 算子实例化为三种拓扑组件。正是这三者的解耦，催生了后世纯编码器的 BERT 与纯解码器的 GPT 系列。",
          echoTargetId: "sec3-1",
          echoLabel: "[跳回呼应 -> §3.1 宏架构]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "算子装配说明书（Component Instantiation）。桥接抽象公式与具体网络层连接方式。",
        },
        {
          label: "03 / 硬核破译（为何置为负无穷而非置零？）",
          body: "如果在 Softmax 之后置零，权重之和不再等于 $1$；而在 Softmax 之前将分数设为 $-\\infty$，经过指数运算 $e^{-\\infty} = 0$，既彻底屏蔽了未来词元，又自然保证了合法位置概率之和严格为 $1$。",
        },
        {
          label: "04 / 审稿人视角",
          body: "逻辑严密无二义性，工程复现度极高。",
        },
      ],
    },
    {
      id: "sec3-3",
      unitCode: "§3.3 & §3.4",
      sectionId: "sec-arch",
      sectionTitle: "3. Model Architecture · 模型架构（§3.1 - §3.5）",
      weight: "support",
      tldr: "逐位置前馈网络（FFN）与三处词嵌入矩阵权重共享（乘以 sqrt(d_model)）",
      primaryKind: "prose",
      primaryText:
        "Position-wise Feed-Forward Networks (§3.3): In addition to attention sub-layers, each of the layers in our encoder and decoder contains a fully connected feed-forward network, which is applied to each position separately and identically. The dimensionality of input and output is d_model = 512, and the inner-layer has dimensionality d_ff = 2048.\n\nEmbeddings and Softmax (§3.4): In our model, we share the same weight matrix between the two embedding layers and the pre-softmax linear transformation. In the embedding layers, we multiply those weights by sqrt(d_model).",
      formulas: [
        {
          latex: "\\text{FFN}(x) = \\max(0, xW_1 + b_1)W_2 + b_2",
          flowLabel: "TENSOR SHAPE FLOW",
          flowText: "x [n, 512] × W1 [512, 2048] -> ReLU -> [n, 2048] × W2 [2048, 512] -> Out [n, 512]",
        },
      ],
      highlights: [
        {
          text: "share the same weight matrix",
          dim: "dim2",
          tooltip: "权重绑定（Weight Tying）：源语言嵌入、目标语言嵌入与输出线性层共享同一矩阵，大幅削减词表参数量。",
        },
        {
          text: "we multiply those weights by sqrt(d_model).",
          dim: "dim5",
        },
      ],
      secondaryBlockText:
        "逐位置前馈网络（§3.3）：编码器和解码器的每一层还包含一个独立作用于每个词元位置的全连接前馈网络，由两层线性变换与中间的 ReLU 激活构成，隐藏层维度放大至 $d_{ff}=2048$。\n\n嵌入与 Softmax（§3.4）：我们在两个输入嵌入层与 Pre-Softmax 线性输出层之间共享同一个权重矩阵，并在嵌入层中将这些权重乘以 $\\sqrt{d_{\\text{model}}}$。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "Attention 负责跨词信息路由，FFN 负责单点非线性记忆加工；§3.4 词嵌入缩放直接为 §3.5 位置编码相加扫清数值量级障碍。",
          echoTargetId: "sec3-5",
          echoLabel: "[跳转衔接 -> §3.5 位置编码]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "补齐非线性变换能力与词表参数正则化细节。",
        },
        {
          label: "03 / 硬核破译（为何词嵌入必须乘以 sqrt(d_model)？）",
          body: "共享矩阵初始化时元素方差通常为 $1/d_{\\text{model}}$（单个向量模长约 $1$），而 §3.5 位置编码 $PE$ 每维值域在 $[-1, 1]$ 之间（模长约 $\\sqrt{d_{\\text{model}}/2}$）。若直接相加，词向量语义信号会被位置编码淹没；乘以 $\\sqrt{d_{\\text{model}}}$ 后二者方差对齐。",
        },
        {
          label: "04 / 审稿人视角",
          body: "这个 $\\sqrt{d_{\\text{model}}}$ 缩放细节是复现原论文精度的关键隐性开关。",
        },
      ],
    },
    {
      id: "sec3-5",
      unitCode: "§3.5",
      sectionId: "sec-arch",
      sectionTitle: "3. Model Architecture · 模型架构（§3.1 - §3.5）",
      weight: "core",
      tldr: "Positional Encoding：用多波长几何级数正余弦函数注入相对位置感知",
      primaryKind: "prose",
      primaryText:
        "Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence. To this end, we add \"positional encodings\" to the input embeddings at the bottoms of the encoder and decoder stacks. The wavelengths form a geometric progression from 2*pi to 10000 * 2*pi. We chose this function because we hypothesized it would allow the model to easily learn to attend by relative positions, since for any fixed offset k, PE_(pos+k) can be represented as a linear function of PE_pos. We also experimented with using learned positional embeddings instead, and found that the two versions produced nearly identical results (see Table 3 row (E)). We chose the sinusoidal version because it may allow the model to extrapolate to sequence lengths longer than the ones encountered during training.",
      formulas: [
        {
          latex: "PE_{(pos, 2i)} = \\sin\\left(\\frac{pos}{10000^{2i/d_{\\text{model}}}}\\right), \\qquad PE_{(pos, 2i+1)} = \\cos\\left(\\frac{pos}{10000^{2i/d_{\\text{model}}}}\\right)",
          flowLabel: "TENSOR SHAPE FLOW",
          flowText: "TokenEmb [n, 512] * sqrt(512) + PE [n, 512] -> InputState X0 [n, 512]",
        },
      ],
      highlights: [
        {
          text: "Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence.",
          dim: "dim1",
        },
        {
          text: "We chose this function because we hypothesized it would allow the model to easily learn to attend by relative positions, since for any fixed offset k, PE_(pos+k) can be represented as a linear function of PE_pos.",
          dim: "dim1",
        },
        {
          text: "We also experimented with using learned positional embeddings instead, and found that the two versions produced nearly identical results (see Table 3 row (E)).",
          dim: "dim3",
        },
        {
          text: "We chose the sinusoidal version because it may allow the model to extrapolate to sequence lengths longer than the ones encountered during training.",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "由于我们的模型不包含任何循环或卷积结构，为了让模型能够利用序列的顺序信息，我们必须注入关于词元在序列中相对或绝对位置的信息。为此，我们在编码器和解码器堆栈底部的输入嵌入中加上“位置编码”，其波长从 $2\\pi$ 到 $10000 \\cdot 2\\pi$ 呈几何级数分布。我们之所以选择这一函数，是因为我们假设它能让模型轻松学会按相对位置进行关注——对于任意固定的位置偏移量 $k$，$PE_{pos+k}$ 都可以表示为 $PE_{pos}$ 的线性函数。我们还实验了可学习的位置嵌入（见表 3 第 E 行），发现两个版本的效果几乎完全一致。我们最终选择正弦版本，是因为它有望让模型外推（Extrapolate）到比训练时所见序列更长的序列上。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[解决纯注意力的置换不变性盲区] -> [设计多频三角函数坐标] -> [论证相对位置线性变换性质与长度外推潜力]。",
          echoTargetId: "sec6-2",
          echoLabel: "[跳转验证 -> §6.2 Table 3(E)]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "补齐无循环结构带来的词序缺失短板，直接启发了后世大模型的 RoPE（旋转位置编码）。",
        },
        {
          label: "03 / 硬核破译（线性旋转矩阵证明）",
          body: "令频率 $\\omega_i = 10000^{-2i/d}$，由三角和差化积公式，$[\\sin(\\omega_i(pos+k)), \\cos(\\omega_i(pos+k))]^T$ 可由 $[\\sin(\\omega_i pos), \\cos(\\omega_i pos)]^T$ 左乘一个仅依赖于距离 $k$ 的 $2\\times 2$ 旋转矩阵得到。",
        },
        {
          label: "04 / 审稿人视角（历史局限提醒）",
          body: "作者关于“正弦编码能自然外推到更长序列”的假说后来被证实较为理想化，直接外推时性能仍会剧烈衰退，直到 RoPE + YaRN/NTK 缩放出现才真正解决。",
        },
      ],
    },
    {
      id: "sec4-1",
      unitCode: "§4.P1-P4",
      sectionId: "sec-why",
      sectionTitle: "4. Why Self-Attention · 为什么选择自注意力",
      weight: "core",
      tldr: "Table 1 四大层类型复杂度对决：何时 O(n^2 · d) 快于 O(n · d^2)？",
      primaryKind: "prose",
      primaryText:
        "In this section we compare various aspects of self-attention layers to the recurrent and convolutional layers commonly used for mapping one variable-length sequence of symbol representations (x_1, ..., x_n) to another sequence of equal length (z_1, ..., z_n). Motivating our use of self-attention we consider three desiderata: (1) Total computational complexity per layer; (2) The amount of computation that can be parallelized, measured by minimum sequential operations; (3) The path length between long-range dependencies in the network. The shorter these paths between any combination of positions in the input and output sequences, the easier it is to learn long-range dependencies.\n\nAs noted in Table 1, a self-attention layer connects all positions with a constant number of sequentially executed operations, whereas a recurrent layer requires O(n) sequential operations. In terms of computational complexity, self-attention layers are faster than recurrent layers when the sequence length n is smaller than the representation dimensionality d, which is most often the case with sentence representations used by state-of-the-art models in machine translations. To improve computational performance for tasks involving very long sequences, self-attention could be restricted to considering only a neighborhood of size r in the input sequence, increasing the maximum path length to O(n/r).",
      dataTable: {
        headers: ["Layer Type (Table 1)", "Complexity per Layer", "Sequential Operations", "Maximum Path Length"],
        rows: [
          ["Self-Attention", "O(n^2 · d)", "O(1)", "O(1)"],
          ["Recurrent (RNN)", "O(n · d^2)", "O(n)", "O(n)"],
          ["Convolutional (CNN)", "O(k · n · d^2)", "O(1)", "O(log_k(n))"],
          ["Self-Attention (restricted r)", "O(r · n · d)", "O(1)", "O(n / r)"],
        ],
      },
      highlights: [
        {
          text: "Motivating our use of self-attention we consider three desiderata:",
          dim: "dim5",
        },
        {
          text: "The path length between long-range dependencies in the network. The shorter these paths between any combination of positions in the input and output sequences, the easier it is to learn long-range dependencies.",
          dim: "dim1",
        },
        {
          text: "As noted in Table 1, a self-attention layer connects all positions with a constant number of sequentially executed operations, whereas a recurrent layer requires O(n) sequential operations. In terms of computational complexity, self-attention layers are faster than recurrent layers when the sequence length n is smaller than the representation dimensionality d, which is most often the case with sentence representations used by state-of-the-art models in machine translations.",
          dim: "dim3",
        },
        {
          text: "To improve computational performance for tasks involving very long sequences, self-attention could be restricted to considering only a neighborhood of size r in the input sequence, increasing the maximum path length to O(n/r).",
          dim: "dim4",
        },
      ],
      secondaryBlockText:
        "在本节中，我们从三项核心诉求出发对比自注意力层、循环层与卷积层：(1) 每层总计算复杂度；(2) 可并行化计算量（最小顺序操作步数）；(3) 长距离依赖在网络中穿越的最大路径长度。路径越短，学习长距离依赖就越容易。\n\n如表 1 所示，自注意力层仅需常数级 $O(1)$ 的顺序操作即可连接所有位置，而循环层需要 $O(n)$ 次顺序操作。当序列长度 $n$ 小于表征维度 $d$ 时（机器翻译句子的常态），自注意力层的计算速度反超循环层。对于超长序列任务，为提升效率可将自注意力限制在大小为 $r$ 的局部邻域内，此时最大路径长度增至 $O(n/r)$。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[确立三大理论评判标尺] -> [Table 1 定量对比] -> [界定算力胜出条件 n < d] -> [坦诚长序列软肋并给出局部窗口方案]。",
          echoTargetId: "sec1-p2",
          echoLabel: "[跳回呼应 -> §1.P2 串行死结]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "全文理论最高潮（Theoretical Justification）。从第一性原理证明 Transformer 为何必然优于 RNN/CNN。",
        },
        {
          label: "03 / 硬核破译（为何 O(n^2·d) 在翻译中更快？）",
          body: "2017 年机器翻译句子长度 $n \\approx 50$，而 $d=512$，此时 $n \\ll d$ 故 $n^2 d \\ll n d^2$。但当现代大模型上下文窗口扩至 $n=128,000$ 时，$n^2$ 便成为显存与算力巨兽——作者提出的邻域限制 $r$ 直接预言了 Sliding Window Attention。",
        },
        {
          label: "04 / 审稿人视角",
          body: "主动列出 restricted self-attention 边界限制，学术严谨性极强。",
        },
      ],
    },
    {
      id: "sec6-1",
      unitCode: "§5.3 & §6.1",
      sectionId: "sec-exp",
      sectionTitle: "5 & 6. Training & Results · 训练配置、主实验与消融验证",
      weight: "core",
      tldr: "Warmup 动态学习率策略与 Table 2 WMT 2014 翻译性能及算力成本全对比",
      primaryKind: "prose",
      primaryText:
        "Optimizer (§5.3): We used the Adam optimizer with beta_1 = 0.9, beta_2 = 0.98 and epsilon = 10^-9. We varied the learning rate over the course of training, increasing it linearly for the first warmup_steps = 4000 training steps, and decreasing it thereafter proportionally to the inverse square root of the step number. We employed Residual Dropout (P_drop = 0.1) and Label Smoothing (epsilon_ls = 0.1), which hurts perplexity, as the model learns to be more unsure, but improves accuracy and BLEU score.\n\nMachine Translation (§6.1): On the WMT 2014 English-to-German translation task, the big transformer model outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new state-of-the-art BLEU score of 28.4 in 3.5 days on 8 P100 GPUs.",
      formulas: [
        {
          latex: "lrate = d_{\\text{model}}^{-0.5} \\cdot \\min\\left(step\\_num^{-0.5}, \\; step\\_num \\cdot warmup\\_steps^{-1.5}\\right)",
          flowLabel: "SCHEDULE DYNAMICS",
          flowText: "Steps 1 -> 4000: Linear Warmup | Steps > 4000: Inverse Square Root Decay",
        },
      ],
      dataTable: {
        headers: ["Model (Table 2 Excerpt)", "EN-DE BLEU", "EN-FR BLEU", "Training Cost (FLOPs)"],
        rows: [
          ["ConvS2S Ensemble (Gehring et al., 2017)", "26.36", "41.29", "1.5 × 10^20 / 1.2 × 10^21"],
          ["Transformer (base model)", "27.3", "38.1", "3.3 × 10^18"],
          ["Transformer (big)", "28.4", "41.8", "2.3 × 10^19"],
        ],
      },
      highlights: [
        {
          text: "We used the Adam optimizer with beta_1 = 0.9, beta_2 = 0.98 and epsilon = 10^-9.",
          dim: "dim5",
        },
        {
          text: "We employed Residual Dropout (P_drop = 0.1) and Label Smoothing (epsilon_ls = 0.1), which hurts perplexity, as the model learns to be more unsure, but improves accuracy and BLEU score.",
          dim: "dim5",
        },
        {
          text: "On the WMT 2014 English-to-German translation task, the big transformer model outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new state-of-the-art BLEU score of 28.4 in 3.5 days on 8 P100 GPUs.",
          dim: "dim3",
        },
      ],
      secondaryBlockText:
        "优化器与训练正则化（§5.3）：我们使用 Adam 优化器，并在前 4000 步线性预热学习率，随后按步数的平方根倒数衰减。我们还采用残差 Dropout（0.1）与标签平滑（0.1）——后者虽略微损伤困惑度，却显著提升了翻译准确率和 BLEU 分数。\n\n机器翻译主结果（§6.1 Table 2）：在 WMT 2014 英译德任务上，Transformer (big) 以 28.4 BLEU 超越前人含集成在内的最优模型逾 2.0 BLEU；基础版（Base）模型更是仅用 ConvS2S 集成约 1/45 的算力就实现了全面超越。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[公开完整可复现训练配方] -> [Table 2 精度与算力成本双重碾压]。",
          echoTargetId: "abs-p1",
          echoLabel: "[跳回呼应 -> Abs.P1 核心战绩]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "核心实证主战场（Primary Empirical Evidence）。兑现摘要中的全部性能与训练效率承诺。",
        },
        {
          label: "03 / 硬核破译（为何必须加 4000 步 Warmup？）",
          body: "训练初期参数随机，Post-LN 残差结构下的注意力与层归一化梯度方差极大；前 4000 步从小到大线性升温，让 Adam 先积累稳定的二阶动量估计，防止初期梯度震荡发散。",
        },
        {
          label: "04 / 审稿人视角",
          body: "坦诚标注 Label Smoothing 会“伤害困惑度（hurts perplexity）”，展现出极佳的实验透明度。",
        },
      ],
    },
    {
      id: "sec6-2",
      unitCode: "§6.2 & §6.3",
      sectionId: "sec-exp",
      sectionTitle: "5 & 6. Training & Results · 训练配置、主实验与消融验证",
      weight: "core",
      tldr: "Table 3 消融实验（验证头数 h、键维度 d_k、位置编码）与句法分析泛化",
      primaryKind: "prose",
      primaryText:
        "Model Variations (§6.2 Table 3): In Table 3 rows (A), we vary the number of attention heads and the attention key and value dimensions, keeping the amount of computation constant (h * d_k = 512). While single-head attention (h=1, d_k=512) is 0.9 BLEU worse than the best setting (h=8, d_k=64, BLEU 25.8), quality also drops off with too many heads (h=32, d_k=16, BLEU 25.4). In rows (B), we observe that reducing the attention key size d_k hurts model quality. In row (E), replacing sinusoidal positional encoding with learned positional embeddings yields nearly identical results (25.7 vs 25.8 BLEU).\n\nEnglish Constituency Parsing (§6.3): To evaluate if the Transformer can generalize to other tasks we performed experiments on English constituency parsing (WSJ). Despite the lack of task-specific tuning our model achieves 92.7 F1, outperforming almost all previously reported models.",
      highlights: [
        {
          text: "While single-head attention (h=1, d_k=512) is 0.9 BLEU worse than the best setting (h=8, d_k=64, BLEU 25.8), quality also drops off with too many heads (h=32, d_k=16, BLEU 25.4).",
          dim: "dim3",
        },
        {
          text: "In rows (B), we observe that reducing the attention key size d_k hurts model quality.",
          dim: "dim3",
        },
        {
          text: "Despite the lack of task-specific tuning our model achieves 92.7 F1, outperforming almost all previously reported models.",
          dim: "dim3",
        },
      ],
      secondaryBlockText:
        "模型变体消融实验（§6.2 Table 3）：在保持总计算量恒定（$h \\times d_k = 512$）的前提下，单头注意力（$h=1$）比 $h=8$ 低 0.9 BLEU；但当头数过多（$h=32, d_k=16$）时，质量同样下滑。单独缩小键维度 $d_k$ 亦会损伤性能。在 (E) 行中，正弦位置编码与可学习位置嵌入效果几乎持平（25.8 vs 25.7 BLEU）。\n\n英语成分句法分析（§6.3）：在未做任务专属调优的情况下，模型在 WSJ 数据集上取得了 92.7 的 F1 分数，证实了出色的跨任务泛化能力。",
      notes: [
        {
          label: "01 / 逻辑演进与跨节锚点",
          body: "[等算力控制变量消融] -> [证实 h=8 为子空间多样性与单头容量的黄金平衡点] -> [跨任务验证架构普适性]。",
          echoTargetId: "sec3-2-2",
          echoLabel: "[跳回呼应 -> §3.2.2 多头假说]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "因果剥离检验（Controlled Ablation Study）。验证论文提出的核心结构组件缺一不可。",
        },
        {
          label: "03 / 硬核破译（为何 h=32 会性能暴跌？）",
          body: "总维度 512 固定后，32 个头导致每个头只分到 $d_k=16$ 维。在过于狭窄的 16 维空间里，向量点积难以具备足够的自由度去区分复杂词元匹配（低维拥挤效应）。",
        },
        {
          label: "04 / 审稿人视角（证据强度评级：强因果）",
          body: "严格固定总参数与 FLOPs 做消融，排除了参数量增减混杂因素，可信度极高。",
        },
      ],
    },
    {
      id: "sec7-1",
      unitCode: "§7.P1-P2",
      sectionId: "sec-conc",
      sectionTitle: "7. Conclusion · 结论与多模态未来展望",
      weight: "core",
      tldr: "总结纯注意力架构范式，并预言多模态大模型与局部受限注意力方向",
      primaryKind: "prose",
      primaryText:
        "In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-headed self-attention.\n\nWe are excited about the future of attention-based models and plan to apply them to other tasks. We plan to extend the Transformer to problems involving input and output modalities other than text and to investigate local, restricted attention mechanisms to efficiently handle large inputs and outputs such as images, audio and video. Making generation less sequential is another research goal of ours.",
      highlights: [
        {
          text: "In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-headed self-attention.",
          dim: "dim1",
        },
        {
          text: "We plan to extend the Transformer to problems involving input and output modalities other than text and to investigate local, restricted attention mechanisms to efficiently handle large inputs and outputs such as images, audio and video. Making generation less sequential is another research goal of ours.",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "在本研究中，我们提出了 Transformer——首个完全基于注意力机制的序列转导模型，用多头自注意力彻底取代了编码器-解码器架构中最常用的循环层。\n\n我们对基于注意力的模型未来充满期待，计划将其扩展至文本以外的输入与输出模态，并研究局部受限注意力机制，以高效处理图像、音频和视频等大规模数据。此外，降低生成过程的顺序性也是我们的另一项研究目标。",
      notes: [
        {
          label: "01 / 逻辑演进与历史回响",
          body: "结论第二段精准预言了随后七年 AI 领域的三大演进路线：跨模态（ViT / Whisper / Sora）、局部高效注意力（Sparse / FlashAttention）、非自回归加速（Speculative Decoding）。",
          echoTargetId: "abs-p1",
          echoLabel: "[首尾呼应 -> Abs.P1]",
        },
        {
          label: "02 / 段落功能与逻辑角色",
          body: "收束全文贡献并开启跨模态通用基础模型（Foundation Models）的研究议程。",
        },
        {
          label: "03 / 硬核破译",
          body: "将图像打成 Patch 序列、音频打成 Spectrogram 帧序列后，全都可以无痛塞进同一套 Transformer Encoder/Decoder，从而打破了视觉 CNN 与语言 RNN 各自为战的壁垒。",
        },
        {
          label: "04 / 审稿人视角",
          body: "点出了当时尚未解决的解码自回归顺序等待（Making generation less sequential），不回避架构残余局限。",
        },
      ],
    },
  ],
  bottomTitle: "SYNTHESIS & SOCRATIC CHECK / 全文论证结构总览与审稿人级自测",
  bottomBlocks: [
    {
      type: "flow-skeleton",
      steps: [
        { tag: "01 / PROBLEM", body: "RNN 隐藏状态 $h_t$ 依赖 $h_{t-1}$，时间步串行锁死导致 GPU 无法样本内并行，且远距信号历经 $O(n)$ 步严重衰减。" },
        { tag: "02 / THESIS", body: "彻底摒弃循环与卷积，仅靠自注意力构建 Transformer，将任意位置间的依赖路径缩减为常数级 $O(1)$。" },
        { tag: "03 / MECHANISM", body: "缩放点积注意力（$\\div \\sqrt{d_k}$ 稳方差）+ $h=8$ 多头并行子空间 + 正余弦位置编码注入相对时序。" },
        { tag: "04 / EVIDENCE", body: "WMT14 英德 28.4 / 英法 41.8 刷榜，训练算力降低一个数量级；等算力消融实验证实多头结构必要性。" },
        { tag: "05 / BOUNDARY", body: "自注意力复杂度为 $O(n^2 \\cdot d)$，当序列长度 $n \\gg d$ 时面临平方级显存瓶颈，需引入局部受限注意力窗口。" },
      ],
    },
    {
      type: "statement-banner",
      tag: "CORE CONTRIBUTION FORMULA / 作者核心主张一句话公式",
      body: "因为自注意力机制能以 $O(1)$ 的常数路径长度与 $O(1)$ 的最小串行步数关联序列中的任意位置，所以尽管放弃循环结构需要额外引入位置编码且面临 $O(n^2 \\cdot d)$ 的序列长度平方项开销，通过除以 $\\sqrt{d_k}$ 的缩放点积与多头子空间注意力（Multi-Head Attention），依然能在彻底剔除 RNN/CNN 的前提下，以少一个数量级的训练算力实现翻译质量与跨任务泛化的全面超越。",
    },
    {
      type: "comparison-pair",
      left: {
        tag: "[STRONGEST STRIKE / 全文论证最强处]",
        tone: "success",
        body: "第 4 节（Table 1 理论复杂度对决）与第 6.2 节（等算力多头消融实验）的双重闭环。作者不仅用工程刷榜证明模型有效，更从信息传递图的最短路径（$O(1)$ vs $O(n)$）给出了数学第一性原理，并通过锁死总维度 $h \\times d_k = 512$ 的消融实验，严格证明了多头机制并非靠堆砌参数取胜，而是子空间解耦的结构性胜利。",
      },
      right: {
        tag: "[ACHILLES' HEEL / 论证最脆弱处与历史局限]",
        tone: "danger",
        body: "对超长上下文 $O(n^2)$ 显存墙的低估，以及正弦位置编码外推假设的理想化。(1) 当序列长度 $n$ 扩展至数万词元时，$QK^T$ 的 $n \\times n$ 矩阵会引发显存爆炸；(2) 作者在 §3.5 假设正弦位置编码能自然外推到更长序列，但后续大模型实践证明直接外推会迅速崩溃，最终催生了 RoPE（旋转位置编码）与 ALiBi。",
      },
    },
    {
      type: "socratic-qa",
      title: "SOCRATIC SELF-TEST / 3 道审稿人级内化追问（点击展开深度解析）",
      items: [
        {
          question: "追问 01：如果去掉缩放点积注意力中的 1/sqrt(d_k)，同时将优化器学习率调小 10 倍，能否解决梯度消失？为什么？",
          answer:
            "不能。问题根源在于 Softmax 激活函数的输入方差过大导致的饱和区梯度消失，而非参数更新步长过大。当 $d_k=64$ 时，$q \\cdot k$ 的方差为 $64$，输入到 Softmax 的数值极差很大，使得输出分布退化为接近非 0 即 1 的硬 One-hot 分布，此时 Softmax 的雅可比矩阵局部导数 $p_i(1-p_i) \\approx 0$。导数本身已归零，调小学习率只会让参数更新量更加趋近于 0；必须在进入 Softmax 前除以 $\\sqrt{d_k}$ 将方差归一化回 1。",
        },
        {
          question: "追问 02：既然多头注意力（h=8）优于单头（h=1），为何在 Table 3(A) 中将头数增至 h=32 时，BLEU 反而明显下降？",
          answer:
            "因为实验严格固定了总维度 $d_{\\text{model}} = h \\times d_k = 512$。当 $h=32$ 时，每个注意力头分到的查询/键维度仅剩 $d_k = 16$。在过于狭窄的 16 维空间中，向量点积难以具备足够的自由度来区分复杂词元间的细微匹配关系（这与 Table 3(B) 单独缩小 $d_k$ 导致性能退化的结论完全吻合）。这揭示了“子空间多样性（$h$）”与“单头表征容量（$d_k$）”之间的权衡律。",
        },
        {
          question: "追问 03：如果把每一层中的逐位置前馈网络（FFN）全部移除，只堆叠 6 层多头自注意力，模型会发生什么本质退化？",
          answer:
            "模型表达能力将严重坍塌。除去 Softmax 计算标量权重外，自注意力对 Value 向量的操作本质上是线性加权求和与线性投影（$W^V W^O$），缺乏对单个词元特征内部的非线性特征变换。在 Transformer 中，Self-Attention 负责跨位置的信息路由与聚合（Information Routing），而包含 ReLU 非线性激活并放大至 $d_{ff}=2048$ 维的 FFN 则承担了非线性特征加工与键值知识记忆（Key-Value Memory）的核心职能。",
        },
      ],
    },
  ],
};
