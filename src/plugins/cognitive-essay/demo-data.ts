import type { WorkbenchDocument } from "@/core/contracts/document-ast";

export const DANKOE_DEMO_DOCUMENT: WorkbenchDocument = {
  id: "demo-how-to-fix-your-entire-life-in-1-day",
  modeId: "cognitive-essay",
  modeName: "认知长文/视频内化",
  title: "How to Fix Your Entire Life in 1 Day",
  subtitle:
    "Dan Koe (future/proof) | 剥离情绪渲染，提炼心理控制论、阿德勒目的论与心流熵减系统",
  badges: ["DAN KOE", "IDENTITY & CYBERNETICS PROTOCOL", "BUILTIN DEMO"],
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
  isDemo: true,
  layoutRatio: [56, 44],
  dimensions: [
    {
      key: "dim1",
      colorSlot: "yellow",
      label: "颠覆性洞察/金句",
      extractionRule: "打破常识的核心论断与高穿透力金句。",
    },
    {
      key: "dim2",
      colorSlot: "red",
      label: "心智模型 (悬停释义)",
      extractionRule: "作者提出的思维模型或概念造词，附带第一性原理定义。",
      enableTooltip: true,
    },
    {
      key: "dim3",
      colorSlot: "blue",
      label: "痛点诊断/底层机制",
      extractionRule: "心理学、神经科学或系统论视角下的行为成因解释。",
    },
    {
      key: "dim4",
      colorSlot: "green",
      label: "反直觉纠偏",
      extractionRule: "戳破常规误区或自我安慰幻觉的纠偏论述。",
    },
    {
      key: "dim5",
      colorSlot: "purple",
      label: "可执行协议 (Protocol)",
      extractionRule: "具体纸笔追问、时间节点动作或可落地习惯系统。",
    },
  ],
  labels: {
    paretoButton: "[80/20 认知核聚焦]",
    toggleSecondaryButton: "[显/隐中文]",
    toggleNotesButton: "[显/隐拆解]",
    exportMdButton: "[导出 Markdown 笔记]",
    exportHtmlButton: "[编译离线单文件 .HTML]",
    userNoteButton: "[+ 添加本段随手笔记]",
    userNotePlaceholder: "在此记录你对本段的思考映射或个人觉察（自动保存至本地）...",
    transitionPrefix: "[BRIDGE / 叙事过渡]",
    mentalNavLabel: "00. 认知鸟瞰与几何模型",
    bottomNavLabel: "06. 交互式 1-Day 重启工作台",
  },
  topMentalModel: {
    title: "TOP MENTAL MAP / 30 秒去鸡汤化认知鸟瞰与极简几何心智模型",
    subtitle: "PRISM WORKBENCH V4.0 | ZERO-EMOJI COGNITIVE EDITION",
    rawSummaryBanner: {
      tag: "[RAW FIRST-PRINCIPLE / 一句话第一性原理]",
      body: "人类的心智是一个目标导向的控制论恒温器（Cybernetic Thermostat）——只要你底层的“自我身份设定值（Identity Set-Point）”和“隐秘安全目的”没有改变，任何靠咬牙坚持的表层行为打卡（早起、戒手机、新年计划）都会被潜意识判定为“系统误差”并强行拉回原位。",
    },
    cards: [],
    comparisonPair: {
      leftTitle: "[OLD DEFAULT OS / 平庸默认操作系统]",
      leftTone: "danger",
      leftItems: [
        "末端行为死磕：试图在不改变“我是谁”的前提下，靠意志力逼自己做痛苦的事，两周内必然触发稳态反弹。",
        "单向正能量幻想：只写空洞的“三年财务自由”，对当下温水煮青蛙的日常钝痛毫无生理性危机感。",
        "将拖延归咎于懒惰：看不见拖延背后其实是潜意识在极其成功地执行“保护自尊、逃避失败评判”的隐秘目标。",
        "全天自动驾驶模式：从早醒刷信息流到深夜内耗，注意力被外部算法劫持，大脑处于高精神熵混乱态。",
      ],
      rightTitle: "[UPGRADED OS / 高维重启操作系统]",
      rightTone: "success",
      rightItems: [
        "身份先行（Identity First）：先重塑“我是一个怎样的人”，让高产习惯变成顺应身份的本能，让偷懒反而显得别扭。",
        "反愿景驱动（Anti-Vision Fuel）：将未来 5 至 10 年毫无长进的噩梦具象化，利用损失厌恶提供强大的初始推力。",
        "冷酷旁观者审计：捂住耳朵不听嘴上抱怨什么，只看过去两小时的实际行动在为哪个隐秘优先级投票。",
        "人生游戏化架构（RPG Loop）：通关愿景 + 失败惩罚（反愿景）+ 1年主线 + 1月Boss战 + 每日3个高杠杆任务。",
      ],
    },
    diagram: {
      title: "GEOMETRIC MENTAL MODELS / 核心认知转化与游戏化反馈环（点击节点跳转）",
      hint: "[交互提示：点击图中任意节点，可直接平滑跳转至对应思想单元]",
      rankdir: "LR",
      nodes: [
        { id: "id-set", label: "Identity Thermostat", subLabel: "Set-Point Controls Habits (#01)", targetUnitId: "unit-01", colorSlot: "yellow" },
        { id: "teleo", label: "Hidden Safety Goal", subLabel: "Self-Sabotage = Ego Shield (#02)", targetUnitId: "unit-02", colorSlot: "blue" },
        { id: "anti", label: "Anti-Vision Fuel", subLabel: "5-Yr Nightmare Repulsion (#03-#04)", targetUnitId: "unit-04", colorSlot: "red" },
        { id: "int", label: "Pattern Interrupts", subLabel: "Break Daytime Autopilot (#05)", targetUnitId: "unit-05", colorSlot: "purple" },
        { id: "rpg", label: "Gamified RPG Loop", subLabel: "1Y Mission / 1M Boss / 3 Quests (#07)", targetUnitId: "unit-07", colorSlot: "green" },
      ],
      edges: [
        { from: "id-set", to: "teleo", label: "explains resistance" },
        { from: "teleo", to: "anti", label: "excavate pain" },
        { from: "anti", to: "int", label: "daytime guard" },
        { from: "int", to: "rpg", label: "evening synthesis" },
      ],
    },
    glossaryTitle: "CORE MENTAL MODELS & LINEAGE / 核心心智模型词典与思想溯源",
    glossary: [
      {
        term: "Anti-Vision (反愿景)",
        badge: "Kahneman 前景理论 & 荣格阴影",
        definition: "对“未来 5 至 10 年维持现状将活成什么噩梦模样”的切肤具象化。人类规避损失的动机强度是追求同等收益的 2 至 2.5 倍。",
      },
      {
        term: "Teleological Behavior (目的论行为)",
        badge: "Alfred Adler 个体心理学",
        definition: "一切行为（包括拖延与自我毁灭）都是目标导向的。你不去行动，是因为潜意识更想达成“维持确定性、免受失败审判”的安全目标。",
      },
      {
        term: "Conceptual Survival (概念性生存)",
        badge: "自我心理学 & 神经防卫",
        definition: "现代人不愁肉体生存，大脑便将“维护既有自我概念（Ego）”视为生死存亡。任何颠覆旧身份的改变都会触发杏仁核威胁报警。",
      },
      {
        term: "Psychic Entropy (精神熵)",
        badge: "Csikszentmihalyi 心流理论",
        definition: "当缺乏清晰目标层级时，注意力被碎片化多巴胺与焦虑撕裂的内耗状态；反之，游戏化任务规则能带来精神负熵（心流）。",
      },
    ],
  },
  sections: [
    { id: "sec-arc1", navLabel: "Arc 1: 痛点刺穿", navRole: "[身份恒温器]", title: "Arc 1 · 痛点刺穿：为什么 90% 的新年决心与表层自律注定破产？", taskBadge: "刺破“靠意志力强改行为”的幻觉，确立身份（Identity）第一性原理" },
    { id: "sec-arc2", navLabel: "Arc 2: 底层机制", navRole: "[自毁的目的论]", title: "Arc 2 · 底层机制：为什么你嘴上说想改变，身体却在精准地自我设障？", taskBadge: "引入阿德勒目的论与概念性生存，拆穿拖延背后的隐秘安全收益" },
    { id: "sec-arc3", navLabel: "Arc 3: 早间挖掘", navRole: "[痛点与反愿景]", title: "Arc 3 · Part 1 早间协议：心理深层挖掘与反愿景（Anti-Vision）核引擎", taskBadge: "用 15-30 分钟纸笔审判刺穿麻木感，将隐痛转化为生理性推力" },
    { id: "sec-arc4", navLabel: "Arc 4: 日间中断", navRole: "[模式中断与杠杆]", title: "Arc 4 · Part 2 日间协议：打断自动驾驶与高能动性杠杆", taskBadge: "设置元认知断点清理多巴胺噪音，善用 AI 扩张能力边界" },
    { id: "sec-arc5", navLabel: "Arc 5: 晚间整合", navRole: "[RPG游戏化架构]", title: "Arc 5 · Part 3 晚间协议：整合核心指令与人生 RPG 游戏化系统", taskBadge: "将全天挖掘收敛为五级游戏规则，消除模糊性并锁定明日行动" },
  ],
  units: [
    {
      id: "unit-01",
      unitCode: "UNIT #01",
      sectionId: "sec-arc1",
      sectionTitle: "Arc 1 · 痛点刺穿：为什么 90% 的新年决心与表层自律注定破产？",
      weight: "core",
      tldr: "你还没走到你想去的地方，因为你还不是那个“理应出现在那里的人”",
      primaryKind: "prose",
      primaryText:
        "80 to 90% of people fail their New Year's resolutions before February even begins. Why? Because most people try to change their surface-level actions without ever changing the person who is performing them. They adopt goals to impress others in status games rather than shifting their internal narrative.\n\nHere is the harsh truth: You aren't where you want to be because you aren't the person who would be there.\n\nThink about a bodybuilder, a successful CEO, or a prolific creator. Do you think they wake up every single morning fighting a brutal war of willpower just to eat clean or sit down to do deep work? No. To them, living a lazy, distracted lifestyle actually feels uncomfortable. Their daily habits are simply the natural byproduct of their identity. When you try to force a new habit onto an old identity, your mind treats that new habit like a foreign virus and attacks it until you snap right back to baseline.",
      highlights: [
        {
          text: "80 to 90% of people fail their New Year's resolutions before February even begins. Why? Because most people try to change their surface-level actions without ever changing the person who is performing them.",
          dim: "dim4",
        },
        {
          text: "Here is the harsh truth: You aren't where you want to be because you aren't the person who would be there.",
          dim: "dim1",
        },
        {
          text: "Think about a bodybuilder, a successful CEO, or a prolific creator. Do you think they wake up every single morning fighting a brutal war of willpower just to eat clean or sit down to do deep work? No. To them, living a lazy, distracted lifestyle actually feels uncomfortable.",
          dim: "dim3",
        },
        {
          text: "identity",
          dim: "dim2",
          tooltip: "身份认同（Identity）：你潜意识里认定的“我是怎样的人”，是控制一切日常习惯与注意力分配的底层恒温器。",
        },
        {
          text: "When you try to force a new habit onto an old identity, your mind treats that new habit like a foreign virus and attacks it until you snap right back to baseline.",
          dim: "dim4",
        },
      ],
      secondaryBlockText:
        "80% 到 90% 的人在二月份还没到来之前，就已经放弃了他们的新年决心。为什么？因为绝大多数人只试图改变表层的行为动作，却从未改变那个执行动作的“人”。他们立下目标往往只是为了在世俗地位游戏中迎合他人，而非重塑内在的自我叙事。\n\n残酷的真相是：你之所以还没走到你想去的地方，是因为你还不是那个“理应出现在那里的人”。\n\n想想那些顶尖的健美运动员、成功的 CEO 或高产的创作者。你以为他们每天早上醒来，都要靠惨烈的意志力搏斗才能吃下健康餐或坐下来深度工作吗？根本不是。对他们而言，过那种懒散、分心的生活反而会浑身难受。他们的日常习惯只不过是其“身份认同”自然流淌出的副产品。当你试图把一个新习惯强行嫁接到旧身份上时，你的大脑会把新习惯当成外来入侵的病毒，拼命排斥它，直到你彻底反弹回原来的基准线。",
      notes: [
        {
          label: "01 / 叙事推进与底层机制（Why It Works）",
          body: "[刺破现象：新年计划高失败率] -> [抛出核心律：身份决定位置] -> [反常识例证：高手不靠意志力硬撑]。底层机制源自 Maxwell Maltz 的《心理控制论》：自我意象如同设定在 22°C 的恒温器，靠意志力硬改行为如同对温度计吹热风，一松手就被系统拉回原位。",
          echoTargetId: "unit-04",
          echoLabel: "[跳转呼应 -> UNIT #04 新身份甲壳]",
        },
        {
          label: "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
          body: "防误读边界：作者说“高手不需要意志力”描述的是身份稳态建立之后的状态。在从旧身份向新身份迁移的最初 14 至 30 天，前额叶依然需要承受显著的启动摩擦，不能因初期吃力就怀疑自己。",
        },
        {
          label: "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
          body: "同构对仗暴击术：You aren't where you want to be because you aren't the person who would be there. 用最基础的词汇把“外在境遇”直接归因于“内在本体”，瞬间封死读者向外找借口的退路。",
        },
        {
          label: "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
          body: "人们热衷于列计划、买工具，因为改变工具不需要否定过去的自己；而承认“我目前的身份配不上目标”会直接刺痛自我防卫机制。",
          calloutBox: "[SELF-REFLECTION]：你最近一直在逼自己做、却反复半途而废的那件事，在你潜意识里是不是还被贴着“我只是为了应付差事”的旧身份标签？",
        },
      ],
    },
    {
      id: "unit-02",
      unitCode: "UNIT #02",
      sectionId: "sec-arc2",
      sectionTitle: "Arc 2 · 底层机制：为什么你嘴上说想改变，身体却在精准地自我设障？",
      weight: "core",
      tldr: "一切行为皆有目的：拖延不是缺乏动力，而是极其成功地保护了自尊与安全感",
      primaryKind: "prose",
      primaryText:
        "To change your life, you must first understand a fundamental law of human psychology: All behavior is goal-oriented. Even self-sabotage.\n\nWhen you procrastinate on starting that project, publishing your work, or applying for that role, you aren't lacking \"discipline.\" You are actively succeeding at a hidden, unconscious goal: the goal of protecting your ego from judgment, uncertainty, and the bruising pain of giving your absolute best and still falling short.\n\nThere are three core reasons you stay stuck: First, you aren't the person who would be there. Second, you don't actually want to go there—because your real priority is comfort and predictability. Third, you are afraid to be there: stepping into a new life threatens your conceptual survival, requiring you to let go of the old version of yourself that your friends, family, and ego are attached to.",
      highlights: [
        {
          text: "To change your life, you must first understand a fundamental law of human psychology: All behavior is goal-oriented. Even self-sabotage.",
          dim: "dim1",
        },
        {
          text: "All behavior is goal-oriented",
          dim: "dim2",
          tooltip: "目的论（Teleology）：阿德勒心理学公理——人类一切行为都服务于当下的某个隐秘目标（哪怕是逃避与自毁）。",
        },
        {
          text: "You are actively succeeding at a hidden, unconscious goal: the goal of protecting your ego from judgment, uncertainty, and the bruising pain of giving your absolute best and still falling short.",
          dim: "dim3",
        },
        {
          text: "conceptual survival",
          dim: "dim2",
          tooltip: "概念性生存：大脑将既有社交人设与习惯回路等同于生命本身，打破旧人设会引发类似肉体死亡的焦虑。",
        },
      ],
      secondaryBlockText:
        "要想改变人生，你必须先理解人类心理学的一条基本铁律：一切行为都是目标导向的——哪怕是自我毁灭与自我设障。\n\n当你迟迟拖延着不去启动那个项目、不去公开发表作品、不去争取那个机会时，你根本不是“缺乏自律”。事实上，你正在极其成功地达成另一个隐秘的潜意识目标：保护你的自尊免受他人评判、避开不确定性，以及逃避“万一我拼尽全力却依然失败，那就证明我真的无能”的剧痛。\n\n你原地踏步只有三个核心原因：第一，你还不是那个位置上的人；第二，你心底其实并不想去那里——因为你真正的最高优先级是贪图安稳与可预测性；第三，你害怕到达那里：迈入新人生会威胁你的“概念性生存”，它要求你亲手告别那个被你现有的朋友、家人和自尊所熟悉的旧自我。",
      notes: [
        {
          label: "01 / 叙事推进与底层机制（Why It Works）",
          body: "[抛出阿德勒目的论公理] -> [剖析拖延的真实收益：自我设障保护 Ego] -> [总结卡死人生的三重枷锁]。心理学中的自我设障（Self-Handicapping）表明：只要不全力以赴，失败了就能用“我没认真”保全面子。",
          echoTargetId: "unit-03",
          echoLabel: "[跳转呼应 -> UNIT #03 旁观者测试]",
        },
        {
          label: "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
          body: "客观边界审视：并非所有拖延都源于深层心理防卫。任务颗粒度过大模糊或长期睡眠不足导致前额叶能量枯竭时，同样会表现为拖延，需先排除生理与拆解问题。",
        },
        {
          label: "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
          body: "定义翻转术（Reframing）：把读者自我归因的“我没动力”翻转定义为“你其实非常成功——成功执行了保护平庸安全区的目标”，制造强烈认知震荡。",
        },
        {
          label: "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
          body: "旧身份虽然痛苦，但它是“可预测的痛苦（Known Hell）”；新身份虽然诱人，却是不可控的未知领域。",
          calloutBox: "[SELF-REFLECTION]：如果你突然开始全力以赴并公开输出，你最怕听到身边哪一个人的议论或冷嘲热讽？",
        },
      ],
    },
    {
      id: "unit-03",
      unitCode: "UNIT #03",
      sectionId: "sec-arc3",
      sectionTitle: "Arc 3 · Part 1 早间协议：心理深层挖掘与反愿景（Anti-Vision）核引擎",
      weight: "core",
      tldr: "如果你不彻底痛恨它，你就会一直容忍它：早间心理挖掘完整诊断 4 问",
      primaryKind: "prose",
      primaryText:
        "In the morning, you do a psychological excavation to uncover your own hidden motives. During the day, you prompt yourself with interrupts to keep you out of autopilot and contemplate your life. At night, you synthesize the insights into a direction you will start to move in tomorrow.\n\nFirst we must create a new frame, or lens of perception, for your mind to operate from. Set aside 15 to 30 minutes—the length of one YouTube video—to think about and answer these questions with pen and paper. Do not attempt to outsource this contemplation to AI. You cannot change what you are numb to: if you don't hate it, you will tolerate it.",
      calloutList: {
        title: "[PART 1A / MORNING DIAGNOSTIC EXCAVATION PROMPTS]",
        items: [
          "1. What is the dull and persistent dissatisfaction you've learned to live with? (Not dramatic suffering, but the mediocre boredom you tolerate daily.)",
          "2. What do you complain about repeatedly but never actually change? (Write down your top 3 complaints from the past year.)",
          "3. Behavior Observer Test: For each complaint, what would someone who watched your behavior—not your words—conclude that you actually want?",
          "4. The Unspoken Truth: What truth about your current life would be unbearable to admit to someone you deeply respect?",
        ],
      },
      highlights: [
        {
          text: "In the morning, you do a psychological excavation to uncover your own hidden motives. During the day, you prompt yourself with interrupts to keep you out of autopilot and contemplate your life. At night, you synthesize the insights into a direction you will start to move in tomorrow.",
          dim: "dim5",
        },
        {
          text: "You cannot change what you are numb to: if you don't hate it, you will tolerate it.",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "在早上，你进行一次深层心理挖掘，揪出自己隐秘的潜意识动机；在白天，你用定时中断指令唤醒自己，跳出自动驾驶模式审视生活；到了夜晚，你将全天的洞察整合为明天醒来即可迈步的明确方向。\n\n首先，我们必须为大脑构建一个全新的感知框架。留出 15 到 30 分钟——不过是看一个视频的时间——拿起纸和笔认真思考并回答这 4 道诊断题。绝不要把这场思考外包给 AI。你永远无法改变你已经麻木的事物：如果你不痛恨它，你就会一直容忍它。",
      notes: [
        {
          label: "01 / 叙事推进与底层机制（Why It Works）",
          body: "[总览全天三段式架构] -> [点破温水煮青蛙机制：钝感适应] -> [用 4 道手术题剥离自我欺骗]。第 3 问直接应用了经济学与行为科学中的揭示性偏好（Revealed Preference）：语言是廉价公关，时间流向才是真实投票。",
          echoTargetId: "bottom-workbench",
          echoLabel: "[跳转实操 -> 底部书写工作台]",
        },
        {
          label: "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
          body: "不要把“不要用 AI”理解成排斥工具；此处禁用 AI 是因为心理防御机制本身必须由本人面对空白纸页的阻力来刺穿，AI 代写只会制造“已经深刻反思过”的虚假满足。",
        },
        {
          label: "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
          body: "消除行动门槛 + 警句定锚：用 the length of one YouTube video 瞬间击碎“没时间”的借口；再用 If you don't hate it, you will tolerate it 解释为何 60 分的平庸生活最消耗人。",
        },
        {
          label: "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
          body: "大脑在面对第 3、4 问时会本能地想略过（“心里想想就行了，不用写”），因为白纸黑字会让自我欺骗无处遁形。",
          calloutBox: "[IMMEDIATE ACTION]：直接滚动到本页面底部工作台 Prompt 01，用 3 分钟把过去一年抱怨最多却没改的一件事敲进输入框。",
        },
      ],
    },
    {
      id: "unit-04",
      unitCode: "UNIT #04",
      sectionId: "sec-arc3",
      sectionTitle: "Arc 3 · Part 1 早间协议：心理深层挖掘与反愿景（Anti-Vision）核引擎",
      weight: "core",
      tldr: "构建「反愿景（Anti-Vision）」与新身份外壳：先看清 5 年后的噩梦，再定义 3 年后的理想",
      primaryKind: "prose",
      primaryText:
        "Those diagnostic questions are meant to make you aware of the pain in your current life. Now, we need to turn those into what I call an \"anti-vision,\" which is a brutal awareness of the life you do not want to live. This is like creating a new shell, leaving your old one, and slowly growing into it over time. It won't feel like it fits at first. That's a good thing.",
      calloutList: {
        title: "[PART 1B / ANTI-VISION, VISION & IDENTITY PROMPTS]",
        items: [
          "1. The 5-to-10 Year Nightmare (Anti-Vision): If nothing changes for 5 to 10 years, what does an average Tuesday look like? Where do you wake up? What is the ultimate cost of always choosing the safe path?",
          "2. Identity Shedding: What old label (\"I'm just a procrastinator\") must you let go of to escape that nightmare?",
          "3. The 3-Year Minimum Viable Vision: Map out the exact life you genuinely want 3 years from now without filtering through what seems realistic to your current circle.",
          "4. The Identity Shift Declaration: Finish the sentence: \"I am the type of person who...\"",
        ],
      },
      highlights: [
        {
          text: "anti-vision",
          dim: "dim2",
          tooltip: "反愿景（Anti-Vision）：对你最恐惧的平庸结局建立起切肤、具象的危机感，利用损失厌恶提供冲出舒适区的初始推力。",
        },
        {
          text: "This is like creating a new shell, leaving your old one, and slowly growing into it over time. It won't feel like it fits at first. That's a good thing.",
          dim: "dim4",
        },
      ],
      secondaryBlockText:
        "前面那些诊断题旨在让你看清当前生活中的隐痛。现在，我们要把这些痛感转化为“反愿景（Anti-Vision）”——即对你绝不愿去过的那种人生建立起残酷、切肤的清醒认知。这就像为自己造一层全新的甲壳，脱掉旧壳，然后慢慢长进新壳里。起初穿在身上一定会觉得别扭、不合身。但这恰恰是好事。",
      notes: [
        {
          label: "01 / 叙事推进与底层机制（Why It Works）",
          body: "[将隐痛结晶为反愿景] -> [5-10年噩梦推演] -> [反转构建 3 年愿景与新身份句式]。卡尼曼前景理论证明人类损失厌恶系数约为 2.5：逃离地狱的推力远胜奔向天堂的拉力。",
          echoTargetId: "unit-01",
          echoLabel: "[跳回呼应 -> UNIT #01 身份恒温器]",
        },
        {
          label: "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
          body: "防焦虑过载：反愿景只是冷启动点火器，用于克服静摩擦；一旦进入日常运转，不能长期靠自我厌恶驱动，必须过渡到对任务的掌控感与心流乐趣。",
        },
        {
          label: "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
          body: "自然生物隐喻（Creating a new shell）：用甲壳蜕皮重新定义“改掉旧习惯时的不适应感”，把负面挫败感转化为成长的合法信号。",
        },
        {
          label: "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
          body: "大部分人只敢空想美好愿景，不敢具体写下“5年后依然碌碌无为的一个周二早上”，因为后者直接剥夺了拖延的心理舒适感。",
          calloutBox: "[SELF-REFLECTION]：如果未来 5 年你的一切日常习惯保持原样，5 年后的普通周二清晨你醒来时最先感到的懊悔是什么？",
        },
      ],
    },
    {
      id: "unit-05",
      unitCode: "UNIT #05",
      sectionId: "sec-arc4",
      sectionTitle: "Arc 4 · Part 2 日间协议：打断自动驾驶与高能动性杠杆",
      weight: "core",
      tldr: "日间定时“模式中断”协议：当场抓获潜意识逃避与精神熵增",
      primaryKind: "prose",
      primaryText:
        "Excavating your psychology in the morning is useless if you immediately fall back into unconscious autopilot by midday. Throughout the day, your environment will bombard you with cheap dopamine cues designed to trigger your old identity and spike psychic entropy.",
      calloutList: {
        title: "[PART 2 / DAYTIME PATTERN-INTERRUPT PROTOCOL]",
        items: [
          "1. Set 3 to 4 Timed Interrupts: Set alarms (e.g., 11:00 AM, 2:00 PM, 5:00 PM, 8:00 PM) with these prompts as the label.",
          "2. Interrupt Prompt A: \"What am I actively avoiding right now by doing what I'm doing?\"",
          "3. Interrupt Prompt B: \"If someone filmed the last two hours of my life, what would they conclude I actually want?\"",
          "4. Input Audit: Which media feeds, notifications, and default routines are draining your attention?",
        ],
      },
      highlights: [
        {
          text: "autopilot",
          dim: "dim2",
          tooltip: "自动驾驶模式（Autopilot）：基底核接管的默认习惯回路，无需前额叶参与，自动把你拉回刷手机、忙琐事的旧轨道。",
        },
        {
          text: "psychic entropy",
          dim: "dim2",
          tooltip: "精神熵（Psychic Entropy）：注意力被外界碎片信息与无序焦虑撕裂后的大脑内耗混乱态。",
        },
      ],
      secondaryBlockText:
        "如果你早上做完了心理挖掘，到了中午却立刻跌回无意识的“自动驾驶模式”，那早上的顿悟就毫无价值。在白天，你周围的环境会用廉价的多巴胺线索对你狂轰滥炸，精准触发你的旧身份，让你的大脑陷入“精神熵增”。通过 4 个定时闹钟标签强制发起元认知中断，当场抓获伪勤奋式逃避。",
      notes: [
        {
          label: "01 / 叙事推进与底层机制（Why It Works）",
          body: "[指出知行断裂点：早间顿悟敌不过日间触发器] -> [设计外部硬件中断：定时追问]。当人沉迷低认知琐事时背外侧前额叶离线，定时标签能强制激活元认知觉察。",
          echoTargetId: "bottom-workbench",
          echoLabel: "[跳转核查 -> 底部闹钟设置]",
        },
        {
          label: "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
          body: "不要在深度心流编码或写作的 90 分钟块中途频繁设闹钟打断自己；闹钟应精准卡在午饭前后、下午倦怠期与下班切换节点。",
        },
        {
          label: "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
          body: "摄像机视角具象化（If someone filmed the last two hours...）：强迫大脑脱离第一人称主观辩解，进入第三人称客观审计。",
        },
        {
          label: "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
          body: "人们最擅长用“整理文件夹、查邮件、看教程”等低阻力忙碌来掩盖对真正核心产出的逃避。",
          calloutBox: "[IMMEDIATE ACTION]：立刻在手机上设一个 15:00 的闹钟，标题直接写：“你过去两小时的行动在为哪个未来投票？”",
        },
      ],
    },
    {
      id: "unit-06",
      unitCode: "UNIT #06",
      sectionId: "sec-arc4",
      sectionTitle: "Arc 4 · Part 2 日间协议：打断自动驾驶与高能动性杠杆",
      weight: "support",
      tldr: "高能动性（High Agency）与现代工具杠杆：用 AI 扩张能力边界，而非替你偷懒",
      primaryKind: "prose",
      primaryText:
        "We live in an era of unprecedented leverage, yet most people use modern tools and AI merely to be lazy—to generate shallow slop, avoid thinking, and outsource their agency. True high agency means using AI and digital systems not to shrink your effort, but to expand your surface area of ambition—to build, learn, and execute projects that were previously impossible for a single individual.",
      highlights: [
        {
          text: "most people use modern tools and AI merely to be lazy—to generate shallow slop, avoid thinking, and outsource their agency.",
          dim: "dim4",
        },
        {
          text: "high agency",
          dim: "dim2",
          tooltip: "高能动性（High Agency）：不将当前资源或短板视为固定限制，主动调用工具与学习杠杆重写结果的能力。",
        },
        {
          text: "True high agency means using AI and digital systems not to shrink your effort, but to expand your surface area of ambition—to build, learn, and execute projects that were previously impossible for a single individual.",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "我们身处一个杠杆率空前的时代，但绝大多数人使用现代工具和 AI 仅仅是为了偷懒——用来生产廉价敷衍的垃圾内容、逃避深度思考，并将自己的主体性彻底外包。真正的“高能动性”，意味着利用 AI 与数字化系统不是为了缩减努力，而是为了扩张你的雄心半径——去独立构建和交付过去单兵根本不可能完成的项目。",
      notes: [
        {
          label: "01 / 叙事推进与底层机制（Why It Works）",
          body: "[批判低维工具观] -> [确立高维杠杆观]。呼应前文“不用 AI 代写思考”，划清“核心意图自己定、工程杠杆交给工具”的边界。",
        },
        {
          label: "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
          body: "警惕“一人公司全能幻觉”：AI 确实能极大缩短 MVP 构建时间，但产品市场验证与深度领域壁垒依然需要长期的真实用户反馈与刻意练习。",
        },
        {
          label: "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
          body: "用“缩减努力（shrink effort）”对比“扩张雄心表面积（expand surface area of ambition）”，给出清晰的二元价值标尺。",
        },
        {
          label: "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
          body: "把 AI 当作“代写答案机”会削弱自身心智；把 AI 当作“陪练架构师与拆解引擎”才会复利增值。",
        },
      ],
    },
    {
      id: "unit-07",
      unitCode: "UNIT #07",
      sectionId: "sec-arc5",
      sectionTitle: "Arc 5 · Part 3 晚间协议：整合核心指令与人生 RPG 游戏化系统",
      weight: "core",
      tldr: "晚间整合与人生游戏化五维映射：通关条件、失败惩罚、主线、Boss 战与每日任务",
      primaryKind: "prose",
      primaryText:
        "At night, spend 30 to 45 minutes synthesizing your breakthroughs into a concrete direction you will start to move in tomorrow. To keep your momentum alive long after this 1-day reset, you must structure your personal growth like a video game. Why are video games so effortlessly engaging while real life feels overwhelming? Because games have clear win/loss conditions, nested quests, and immediate feedback loops that eliminate mental fog.\n\nYou don't fix your entire life in one day by magically finishing a decade of work in 24 hours. You fix your life in one day by shattering your unconscious programming, realigning your identity, and waking up tomorrow playing a game you consciously chose to play.",
      calloutList: {
        title: "[PART 3 / EVENING SYNTHESIS & GAMIFIED LIFE ARCHITECTURE]",
        items: [
          "1. Root Blockage: Write down the single core internal belief holding you back the most.",
          "2. Anti-Vision = Cost of Losing / Game Over (1-sentence visceral warning).",
          "3. Vision = Victory Condition (1-sentence clear destination).",
          "4. 1-Year Goal = Main Mission (The primary north-star breakthrough for this year).",
          "5. 1-Month Milestone = Boss Fight (Concrete project or skill deliverable in 30 days).",
          "6. 2 to 3 Daily Levers = Daily Quests (High-leverage physical actions for tomorrow morning).",
        ],
      },
      highlights: [
        {
          text: "Because games have clear win/loss conditions, nested quests, and immediate feedback loops that eliminate mental fog.",
          dim: "dim3",
        },
        {
          text: "You don't fix your entire life in one day by magically finishing a decade of work in 24 hours. You fix your life in one day by shattering your unconscious programming, realigning your identity, and waking up tomorrow playing a game you consciously chose to play.",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "到了夜晚，留出 30 到 45 分钟将全天的突破整合为明天醒来即可迈步的具体方向。为了让这股势能在一天重启之后长久鲜活，你必须把个人成长构建成一款电子游戏——用通关愿景、失败惩罚（反愿景）、年度主线、月度 Boss 战与每日 3 个微杠杆彻底消灭大脑的迷雾感。\n\n所谓“在一天之内重启人生”，并不是在 24 小时内凭空变出十年的成果；而是指在这一天之内彻底击碎潜意识里的自动驾驶程序，重装身份认同，让你在明天清晨醒来时，正式进入一场由你自己清醒选定的游戏。",
      notes: [
        {
          label: "01 / 叙事推进与底层机制（Why It Works）",
          body: "[晚间收敛为一句话指令] -> [剖析游戏心流的心理学机制：目标分级消除模糊性] -> [构建五级任务漏斗]。将宏大愿景降维到 1 个月 Boss 战与每日 3 杠杆后，挑战难度与当前能力精准匹配，大脑直接进入心流通道。",
          echoTargetId: "unit-01",
          echoLabel: "[首尾闭环 -> UNIT #01 身份重启]",
        },
        {
          label: "02 / 去魅滤镜与适用边界（Anti-Hype Reality Check）",
          body: "终极清醒剂：标题“Fix Your Entire Life in 1 Day”是传播钩子；作者在末段诚实闭环——1 天改变的是航向与心智操作系统，复利结果仍取决于随后 365 天对 Daily Quests 的执行。",
        },
        {
          label: "03 / 顶级创作者表达解剖（Rhetoric & Structure）",
          body: "跨界系统隐喻（Life as a Video Game）：把抽象的 OKR 目标拆解映射为游戏玩家瞬间秒懂的 Victory / Game Over / Boss Fight / Daily Quests。",
        },
        {
          label: "04 / 知行阻抗诊断与个人映射（Execution Trigger）",
          body: "如果明天清晨的任务超过 3 个，大脑在起床那一刻就会因为选择过载而重新陷入拖延。",
          calloutBox: "[SELF-REFLECTION]：你未来 30 天必须打赢的唯一那个“Boss 战”具体交付物是什么？",
        },
      ],
    },
  ],
  bottomTitle: "ACTIONABLE PROTOCOL WORKBENCH / 交互式 1-Day 个人认知重启与行动工作台",
  bottomSubtitle: "以下所有书写框与核查项均自动保存至本地浏览器数据库（IndexedDB），填写完毕后可直接导出 Markdown 或单文件 HTML。",
  bottomBlocks: [
    {
      type: "flow-skeleton",
      steps: [
        { tag: "01 / TELEOLOGY", body: "承认拖延不是懒，而是潜意识在用“不作为”保护旧自尊免受失败评判。" },
        { tag: "02 / EXCAVATION", body: "用冷酷旁观者测试拆穿嘴上抱怨，直面已经习以为常的日常钝痛。" },
        { tag: "03 / ANTI-VISION", body: "具象化 5 年不变的噩梦周二，用损失厌恶击穿舒适区惯性。" },
        { tag: "04 / INTERRUPTS", body: "日间 4 个定时闹钟灵魂追问，当场抓获刷屏与伪勤奋逃避回路。" },
        { tag: "05 / RPG SYSTEM", body: "锁定新身份 + 1年主线 + 1月Boss战 + 明日3个最小杠杆任务。" },
      ],
    },
    {
      type: "aphorism-list",
      title: "SELECTED APHORISMS / 全文最值得刻进脑子的 5 句原文核心金句",
      items: [
        {
          en: "01. \"You aren't where you want to be because you aren't the person who would be there.\"",
          zh: "你之所以还没走到你想去的地方，是因为你还不是那个“理应出现在那里的人”。",
        },
        {
          en: "02. \"All behavior is goal-oriented—even self-sabotage. Procrastination is a defense mechanism protecting your ego.\"",
          zh: "一切行为都是目标导向的，哪怕是自我毁灭。拖延其实是保护你自尊的防御机制。",
        },
        {
          en: "03. \"You cannot change what you are numb to. If you don't hate it, you will tolerate it.\"",
          zh: "你永远无法改变你已经麻木的事物。如果你不彻底痛恨它，你就会一直容忍它。",
        },
        {
          en: "04. \"What would someone who only watched your behavior—ignoring your words—conclude that you actually want?\"",
          zh: "如果一个观察者捂住耳朵不听你嘴上说什么，只看你的日常行为，他会断定你真正想要什么？",
        },
        {
          en: "05. \"This new identity is like creating a new shell. It won't feel like it fits at first. That's a good thing.\"",
          zh: "这个新身份就像给自己造一层新甲壳。起初穿在身上一定觉得不合身，但这恰恰是好事。",
        },
      ],
    },
    {
      type: "journal-prompts",
      title: "INTERACTIVE JOURNALING PROMPTS / 1-Day 心理挖掘与游戏蓝图书写区（实时保存）",
      items: [
        {
          id: "j-pain",
          label: "[PROMPT 01] 痛点挖掘与冷酷旁观者测试 (Morning Excavation)",
          hint: "我过去一年抱怨最多却没改的 3 件事是什么？如果只看我过去一周的实际行动，旁观者会断定我真正想要什么？",
          placeholder: "在此输入你的真实剖析...",
        },
        {
          id: "j-antivision",
          label: "[PROMPT 02] 我的反愿景噩梦 (My Anti-Vision / Cost of Losing)",
          hint: "如果未来 5 年继续维持现状，5 年后那个让我生理性厌恶的普通周二是什么样？将其浓缩为一句话警告。",
          placeholder: "在此输入你的反愿景...",
        },
        {
          id: "j-identity",
          label: "[PROMPT 03] 新身份宣言与 3 年通关愿景 (Identity & Vision)",
          hint: "补全句子：“我是一个…………的人”，并写下 3 年后理想生活的一句话定义。",
          placeholder: "我是一个...",
        },
        {
          id: "j-quests",
          label: "[PROMPT 04] 人生游戏四级任务拆解 (1Y Main / 1M Boss / 3 Daily Levers)",
          hint: "今年的主线任务是什么？未来 30 天的 Boss 战交付物是什么？明天一早雷打不动的 3 个日常杠杆动作是什么？",
          placeholder: "[1年主线]：\n[1月Boss战]：\n[明日3个日常杠杆]：",
        },
      ],
    },
    {
      type: "checklist",
      title: "MVP EXECUTION CHECKLIST / 今日 24 小时最小可行性重启核查表",
      items: [
        { id: "chk-1", tag: "[STAGE 01 / 早间挖掘]", text: "完成上方 4 个书写框的真实填写，不掩饰、不美化现状。" },
        { id: "chk-2", tag: "[STAGE 02 / 日间中断]", text: "在手机上设定 11:00、14:00、17:00、20:00 四个闹钟，标签命名为：“你此刻正在用忙碌逃避什么？”" },
        { id: "chk-3", tag: "[STAGE 03 / 环境降熵]", text: "睡前清理明早第 1 个日常任务（Daily Quest）的启动阻力（提前打开工作文档，将手机移出卧室充电）。" },
        { id: "chk-4", tag: "[STAGE 04 / 笔记归档]", text: "点击顶部导出按钮，将今天写下的反愿景、个人随手记与游戏蓝图导出为 Markdown 存入笔记库。" },
      ],
    },
  ],
};
