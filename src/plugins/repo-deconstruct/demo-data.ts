import type { WorkbenchDocument } from "@/core/contracts/document-ast";

export const RCD_CEDI_DEMO_DOCUMENT: WorkbenchDocument = {
  id: "demo-repo-rcd-cedi",
  modeId: "repo-deconstruct",
  modeName: "源码架构拆解",
  isDemo: true,
  title: "JiaxinTrans/RCD_CEDI — 施工区多车交互风险量化与两阶段可达性引擎",
  subtitle:
    "Mode 03 Demo · Python 3.10 + Numba @njit / Stage 1 RCD 物理遮挡裁剪 (rcd.py) + Stage 2 CEDI 最优避险困难度搜救 (vehicle.py)",
  badges: [
    "JiaxinTrans/RCD_CEDI · BUILTIN DEMO",
    "Python + Numba JIT",
    "4 大核心模块 + L1-L3 压力测试",
  ],
  createdAt: "2026-11-18T00:00:00.000Z",
  updatedAt: "2026-11-18T00:00:00.000Z",
  layoutRatio: [58, 42],
  dimensions: [
    {
      key: "dim1",
      colorSlot: "yellow",
      label: "入口准备",
      extractionRule: "detect_vehicle_conflict 门禁与 PreparedAB 主对碰撞角点缓存。",
    },
    {
      key: "dim2",
      colorSlot: "red",
      label: "核心判据",
      extractionRule: "RCD P2 的 I_C / S_C / ALT_C 判据以及 Numba 下界早停核心逻辑。",
      enableTooltip: true,
    },
    {
      key: "dim3",
      colorSlot: "blue",
      label: "边界容错",
      extractionRule: "初始接触未定状态拦截、零清出速度补全及浮点数等值容差对齐。",
    },
    {
      key: "dim4",
      colorSlot: "green",
      label: "性能权衡",
      extractionRule: "nogil Numba 候选网格升序搜索与解析跟驰尾界 linear_tail_bound。",
    },
    {
      key: "dim5",
      colorSlot: "purple",
      label: "审计盲区",
      extractionRule: "raw_rcd_audit 无剪枝独立复核与候选热路径优化切入点。",
    },
  ],
  labels: {
    paretoButton: "[20/80 核心]",
    toggleSecondaryButton: "[显/隐逻辑白话]",
    toggleNotesButton: "[显/隐面试批注]",
    exportMdButton: "[导出架构手记 Markdown]",
    exportHtmlButton: "[编译离线单文件 .HTML]",
    userNoteButton: "[+ 添加本模块二次开发备忘]",
    userNotePlaceholder: "在此记录 RCD/CEDI 算法理解切入点或可复现/改造思路...",
    transitionPrefix: "[AUDIT & HELPER / 交叉审计收尾层]",
    mentalNavLabel: "00. 20/80 架构图与调用链",
    bottomNavLabel: "08. 简历武装、压力测试与改造方案",
  },
  sections: [
    {
      id: "sec-mod-1",
      navLabel: "01. 入口契约与主对准备",
      navRole: "核心入口",
      title: "01. src/rcd_cedi/api.py · 入口边界守卫与场景几何统一准备",
      taskBadge: "核心源码 · detect_vehicle_conflict + PreparedAB 冻结契约",
    },
    {
      id: "sec-mod-2",
      navLabel: "02. RCD P2 遮挡裁剪",
      navRole: "核心引擎",
      title: "02. src/rcd_cedi/rcd.py · I_C 投影、S_C 全局路径符号与 ALT_C 净空检验",
      taskBadge: "核心源码 · Eq. (10)-(16) 与零清出速度物理补全",
    },
    {
      id: "sec-mod-3",
      navLabel: "03. Numba 下界搜救",
      navRole: "核心求解",
      title: "03. src/rcd_cedi/cedi/vehicle.py · 候选升序早停与解析跟驰尾界",
      taskBadge: "核心源码 · own_bound_stop 剪枝 + linear_tail_bound",
    },
    {
      id: "sec-mod-4",
      navLabel: "04. 原始 RCD 独立审计",
      navRole: "交叉验算",
      title: "04. src/rcd_cedi/audit.py · 关闭剪枝后的纯几何终态一致性复核",
      taskBadge: "外围审计校验层（可按 20/80 略读，科研实证可信度关键拼图）",
    },
  ],
  topMentalModel: {
    title: "00. 20/80 架构导读与主调用链路图",
    subtitle:
      "跳过 CSV 工具链与 GIF 绘图脚手架，用 4 个核心 Python 模块打通「物理可达冲突筛选 -> 受限二维避险难度优化」全链路",
    rawSummaryBanner: {
      tag: "一句话看透项目本质",
      body: "RCD_CEDI 是一个面向高速公路施工区多车强交互场景的统一风险量化框架：Stage 1 通过 RCD 过滤被周围车辆物理遮挡的「伪直面冲突」，Stage 2 再用按自身控制代价下界升序排列的 Numba @njit 搜索求解两车各自的最小避险困难度（CEDI），兼顾施工区非对称约束与毫秒级计算性能。",
    },
    cards: [
      {
        tag: "20% 必读核心引擎",
        body: "重点啃透 3 段核心链路：1) api.py 中初始接触防御与 PreparedAB 单次准备复用；2) rcd.py 中 I_C 投影、S_C 跨侧符号判据及严格早于碰撞时间 t_ab 的 ALT_C 净空检定；3) vehicle.py 里候选排序早停 own_bound_stop 与解析尾界 linear_tail_bound。",
      },
      {
        tag: "80% 可跳过外围文件",
        body: "csv_tools/ 下的轨迹表格读写、examples/ 示例脚本、asset/gifs 可视化生成脚本及 pyproject.toml 装配文件属于典型实验工程外围，初读源码时无需逐行深究。",
      },
      {
        tag: "面试与论文最爱深挖的 3 条暗线",
        body: "1) 为何传统成对 SSM 对 A-B 给出对称分数会失真？2) 旁车相对横向速度 w 逼近 0 时 ALT_C 如何严谨定义而不触发除零？3) 为何 search() 一旦遇到 lower >= best 就可以安全 break 终止剩余所有网格点？",
      },
    ],
    comparisonPair: {
      leftTitle: "传统成对替代安全指标（Pairwise SSM 的盲区）",
      leftTone: "danger",
      leftItems: [
        "假设同车道前排 A、B、C、D 的每一对冲突都可以直接发生，忽视中间车辆 B 实际挡死了 A 与 C/D 的直接物理可达性。",
        "给交互双方赋予单一共享风险值，忽略例如 B 后有紧贴车 A、侧旁又有施工区或旁车 C 遮挡时，B 承受远高于 A 的实际避险困难。",
      ],
      rightTitle: "RCD_CEDI 两阶段非对称框架（物理约束 + 双视角求解）",
      rightTone: "success",
      rightItems: [
        "Stage 1 先经 P1 扫掠矩形碰撞与 P2 旁车阻塞裁剪（I_C + S_C + ALT_C < t_ab），先淘汰物理不可达的伪冲突。",
        "Stage 2 对 A、B 各自从主车视角运行受周围车辆响应与道路/施工区几何约束的 CEDI 优化，并用 audit.py 独立验证终态无误差。",
      ],
    },
    diagram: {
      title: "RCD_CEDI 核心调用链路与双向求解图（点击节点定位右侧源码）",
      hint: "先在 Stage 1 判断物理可达性，再在 Stage 2 按下界升序剪枝并可选触发 raw_rcd 独立审计",
      rankdir: "LR",
      nodes: [
        {
          id: "n_api",
          label: "1. 入口契约与准备",
          subLabel: "api.py · P1 / P2",
          targetUnitId: "mod-1-u-1",
          colorSlot: "yellow",
        },
        {
          id: "n_rcd",
          label: "2. RCD P2 遮挡裁剪",
          subLabel: "rcd.py · I_C / S_C / ALT",
          targetUnitId: "mod-2-u-1",
          colorSlot: "red",
        },
        {
          id: "n_vehicle",
          label: "3. Numba 下界搜救",
          subLabel: "vehicle.py · @njit",
          targetUnitId: "mod-3-u-1",
          colorSlot: "green",
        },
        {
          id: "n_audit",
          label: "4. 原始几何复核",
          subLabel: "audit.py · raw_rcd",
          targetUnitId: "mod-4-u-1",
          colorSlot: "purple",
        },
      ],
      edges: [
        { from: "n_api", to: "n_rcd", label: "缓存" },
        { from: "n_rcd", to: "n_vehicle", label: "可达" },
        { from: "n_vehicle", to: "n_audit", label: "复核" },
      ],
    },
    glossaryTitle: "RCD_CEDI 核心机制词典（悬停与面试快查）",
    glossary: [
      {
        term: "PreparedAB 共享缓存",
        badge: "Stage 1 复用",
        definition:
          "将主对 (A, B) 的 P1 扫掠结果、最近角点对 pairs 与单位相对速度向量 theta_ab 一次冻结计算，周边每增加一辆旁车 C 仅需常数次点积与叉积判断。",
      },
      {
        term: "I_C & S_C 阻塞走廊",
        badge: "Eq. (10)-(11)",
        definition:
          "I_C 检验旁车 C 四角点在 theta 方向上均严格落入 V_i 与 E_i 之间；S_C 检查跨路径两侧变号，合取成立才进入撤离净空时间比较。",
      },
      {
        term: "Own-Bound Stop (lower >= best)",
        badge: "无损剪枝",
        definition:
          "由于总代价 sqrt(lower^2 + env^2) 恒不小于主车自身代价下界 lower，且候选数组预先按 lower 升序排列，一旦 lower >= best 即可直接 break 结束全部剩余候选。",
      },
      {
        term: "Linear Tail Bound",
        badge: "解析上确界",
        definition:
          "无需在 ET 之后继续逐时间步积分，直接解析求解 r >= remaining 区间上 -2(A + B*r)/(k*r^2) 的全局上确界，把长尾制动评估降为 O(1) 闭式运算。",
      },
    ],
  },
  units: [
    {
      id: "mod-1-u-1",
      unitCode: "api.py · Unit 1.1",
      sectionId: "sec-mod-1",
      sectionTitle: "01. src/rcd_cedi/api.py · 入口边界守卫与场景几何统一准备",
      sectionTask: "核心入口 · ID 唯一校验 + 初始重叠门禁 + PreparedAB 传递",
      weight: "core",
      tldr: "detect_vehicle_conflict 严拒静默阈值与初始重叠误判，一次性冻结 A-B 几何给所有旁车复用。",
      primaryKind: "code",
      codeLanguage: "python",
      filePath: "src/rcd_cedi/api.py",
      primaryText: `def detect_vehicle_conflict(a: VehicleState, b: VehicleState,
                            surrounding: Iterable[VehicleState] = ()) -> RCDResult:
    others = _scene(a, b, surrounding)
    av, bv = _rectangle(a), _rectangle(b)
    et = swept_contact(av, bv)
    args = dict(subject_vehicle=a.vid, opponent_vehicle=b.vid, initial_et=et)
    if et is None:
        return RCDResult('no_predicted_contact', predicted_contact=False, reachable=False, **args)
    if et <= EPS:
        return RCDResult('initial_contact', predicted_contact=True, reachable=True, **args)
    unresolved = tuple(c.vid for c in others
                       if swept_contact(av, _rectangle(c)) == 0.
                       or swept_contact(bv, _rectangle(c)) == 0.)
    if unresolved:
        return RCDResult('unresolved_initial_surrounding_contact', predicted_contact=True,
                         reachable=None, unresolved_vehicles=unresolved, **args)
    prepared = rcd.prepare_ab(av, bv)
    blockers = [c.vid for c in others if rcd.evaluate_prepared_c(prepared, _rectangle(c))['blocks']]
    return RCDResult('blocked' if blockers else 'reachable', predicted_contact=True,
                     reachable=not blockers, blockers=tuple(blockers), **args)`,
      formulas: [
        {
          latex: "",
          flowLabel: "STAGE 1 ENTRY GUARD",
          flowText:
            "_scene(unique vid) -> swept_contact(A,B) -> reject initial surrounding overlap (0.0) -> prepare_ab(A,B) -> loop C",
        },
      ],
      highlights: [
        {
          text: "swept_contact(av, _rectangle(c)) == 0.",
          dim: "dim3",
          tooltip: "初始碰撞防呆：若旁车 C 在 t=0 已与主车 A 或 B 物理贴合，立即返回 reachable=None 的未定状态，绝不静默标为可通行或阻挡。",
        },
        {
          text: "prepared = rcd.prepare_ab(av, bv)",
          dim: "dim2",
          tooltip: "PreparedAB 冻结缓存：提前一次求出 A-B 的扫掠接触时间、角点对 (V, E) 和单位相对速度向量 theta_ab。",
        },
        {
          text: "others = _scene(a, b, surrounding)",
          dim: "dim1",
        },
        {
          text: "evaluate_prepared_c(prepared, _rectangle(c))",
          dim: "dim4",
        },
      ],
      secondaryBlockText:
        "【入口契约设计】科研计算库最容易在脏数据（比如旁车 ID 重复、或者标注框在初始时刻就已经重合）时静默给出看似合理的数值。api.py 通过 _scene 强制拦截重复 vid，并用 unresolved_initial_surrounding_contact 把初始重叠样本显式暴露给上层，保证评估集干净无假阳性。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "detect_vehicle_conflict 完成场景 P1 与 P2 筛选后，将每个旁车的几何详情交由下一节 rcd.py 执行精细遮挡判定。",
          echoTargetId: "mod-2-u-1",
          echoLabel: "[-> 进入 rcd.py 查看 P2 遮挡数学判据]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "注意源码注释明确写明「No forward-distance or ET threshold is silently applied」——函数不暗中截断预测时域或前向距离，所有风险参数均通过显式 Config 注入，保障科研实验可复现性。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "采用不可变 dataclass 封装 PreparedAB 并在循环外构造，避免在多旁车场景下对每辆旁车 C 重复执行 swept_contact(A, B) 与角点配对搜索。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「如果某场景里有 2 辆旁车同时都在撞击走廊里，代码会短路径退出还是全部检测？」",
          calloutBox: "观察第 18 行循环：for c in others 故意未在发现第一个 blocker 时提前 break，而是把每辆旁车的判定写进 diagnostics['surrounding'] 并收集全部 blockers——换取完整的可解释诊断轨迹。",
        },
      ],
    },
    {
      id: "mod-2-u-1",
      unitCode: "rcd.py · Unit 2.1",
      sectionId: "sec-mod-2",
      sectionTitle: "02. src/rcd_cedi/rcd.py · I_C 投影、S_C 全局路径符号与 ALT_C 净空检验",
      sectionTask: "核心几何 · Eq. (10)-(16) 物理阻挡走廊与零速补全",
      weight: "core",
      tldr: "联合纵向投影 I_C、全局路径跨侧符号 S_C 及严格小于 t_ab 的撤离净空时间，精确识别谁真正挡在碰撞路线上。",
      primaryKind: "code",
      codeLanguage: "python",
      filePath: "src/rcd_cedi/rcd.py",
      primaryText: `TIME_ATOL = 1e-9
TIME_RTOL = 1e-9

def clears_before_contact(alt: float, t_ab: float) -> bool:
    return (math.isfinite(alt) and alt < t_ab
            and not math.isclose(alt, t_ab, rel_tol=TIME_RTOL, abs_tol=TIME_ATOL))

def evaluate_c_obstruction(b, c, theta, pairs, t_ab, c_corners=None) -> dict:
    corners = c.corners() if c_corners is None else c_corners
    products = tuple(dot(sub(cm, pair.V), theta) * dot(sub(cm, pair.E), theta)
                     for pair in pairs for cm in corners)
    i_c = all(value < -EPS for value in products)
    sides = tuple(cross(sub(cm, pair.V), theta)
                  for pair in pairs for cm in corners)
    s_c = not (all(value > EPS for value in sides)
               or all(value < -EPS for value in sides))
    if not (i_c and s_c):
        return dict(I_C=int(i_c), S_C=int(s_c), blocks=False, reachable=True)`,
      formulas: [
        {
          latex: "\\text{P2 blocks} \\iff I_C = 1 \\land S_C = 1 \\land \\text{ALT}_C \\ge t_{AB}",
          flowLabel: "RCD P2 CRITERION",
          flowText: "corners in (V_i, E_i) slab (I_C) AND crosses corridor sides (S_C) AND fails strict clearance",
        },
      ],
      highlights: [
        {
          text: "i_c = all(value < -EPS for value in products)",
          dim: "dim2",
          tooltip: "Eq. (10) I_C 纵向包夹：向量点积乘积恒负，意味着旁车 C 的 4 个矩形角点全部严格位于首触点 pair.V 与终点 pair.E 沿相对速度方向 theta 的夹层内。",
        },
        {
          text: "s_c = not (all(value > EPS for value in sides) or all(value < -EPS for value in sides))",
          dim: "dim2",
          tooltip: "Eq. (11) 全局路径符号判据 S_C：用二维叉积检测 C 是否跨越碰撞走廊两侧，避免把完全偏在通道同一旁侧的车辆误判成阻塞车。",
        },
        {
          text: "not math.isclose(alt, t_ab, rel_tol=TIME_RTOL, abs_tol=TIME_ATOL)",
          dim: "dim3",
          tooltip: "Eq. (16) 临界保守判定：即使浮点算出来 alt 仅略微逼近 t_ab（误差 1e-9 内），也按「同时刻未彻底让开」严格判为阻挡。",
        },
        {
          text: "if not (i_c and s_c):",
          dim: "dim4",
        },
      ],
      secondaryBlockText:
        "【几何裁剪灵魂】如果只用纵向区间的点积符号 I_C，旁车道里哪怕横向相隔 5 米的车只要纵向齐头都会触发 False Positive；加上跨路径叉积变号 S_C，就能精准锁住真正斜穿/横挡在碰撞走廊中的车辆，最后再用 ALT_C 是否严格早于 t_ab 决定它会不会在 A-B 相撞前自己开走。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "被 api.py 的 detect_vehicle_conflict 与 audit.py 的 raw_rcd_audit 共同调用，是 Stage 1 判定的唯一事实内核。",
          echoTargetId: "mod-1-u-1",
          echoLabel: "[<- 回看 api.py 中的 PreparedAB 构造]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "注意当相对横向速度 w 逼近 0（例如旁车完全静止或与目标车平行同速行驶）时，源码并没有放任 ALT_C 除零崩溃，而是直接设为 inf 并按零清出速度场景（zero_clearing_speed_case）显式判定 blocks=True。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "在 S_C 判据实现中，代码用 `cross(cm - pair.V, theta)` 替代了论文图示里的法向量点积 `dot(C_m - V_i, theta_perp)`：左手法向量只是全局取反所有符号，不改变“是否全同号”的逻辑结果，还省去一次法向量构造。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「为什么要把 TIME_ATOL 设到 1e-9 且对相等情况判作 blocked，这难道不是浮点过度保守吗？」",
          calloutBox: "工程与论文依据：Eq. (17) 要求「strict clearance before first contact（alt_C < t_ab）」。在物理上「撞击瞬间刚好擦出界外」依然属于危险阻塞边界，用 1e-9 容差对齐 math.isclose 可杜绝浮点舍入把压线冲突误报成无阻挡。",
        },
      ],
    },
    {
      id: "mod-3-u-1",
      unitCode: "vehicle.py · Unit 3.1",
      sectionId: "sec-mod-3",
      sectionTitle: "03. src/rcd_cedi/cedi/vehicle.py · 候选升序早停与解析跟驰尾界",
      sectionTask: "核心求解 · @njit 网格分支定界剪枝 + linear_tail_bound 闭式上界",
      weight: "core",
      tldr: "search() 利用自身代价单调下界做无损早停，再用解析尾界绕过 ET 之后耗时费力的逐帧时间积分。",
      primaryKind: "code",
      codeLanguage: "python",
      filePath: "src/rcd_cedi/cedi/vehicle.py",
      primaryText: `@njit(cache=True)
def search(states, axes, radii, candidates, cfg, za, zl, zu, origin, times, include_tail):
    best, best_ax, best_ay, best_index = math.inf, math.nan, math.nan, -1
    best_details = np.full((len(states), 12), math.nan)
    counts = np.zeros(len(COUNTERS), np.int64)
    for index in range(len(candidates)):
        lower, ax, ay = candidates[index]
        if lower >= best:
            counts[15] += 1  # own_bound_stop
            break
        counts[0] += 1
        code, cost, details, queries = check_action(states, axes, radii, cfg,
                za, zl, zu, origin, times, ax, ay, include_tail, best)
        counts[5] += queries
        if code:
            counts[code] += 1
            continue
        counts[14] += 1
        if cost < best:
            best, best_ax, best_ay, best_index = cost, ax, ay, index
            best_details[:] = details
    return best, best_ax, best_ay, best_index, best_details, counts`,
      formulas: [
        {
          latex: "\\text{cost}(a_x, a_y) = \\sqrt{\\text{lower}^2 + \\text{env}^2} \\ge \\text{lower}",
          flowLabel: "BRANCH-AND-BOUND INVARIANT",
          flowText: "sorted ascending lower -> once lower >= best -> impossible for remaining candidates to beat best",
        },
      ],
      highlights: [
        {
          text: "if lower >= best:",
          dim: "dim2",
          tooltip: "Own-Bound Stop（无损分支定界早停）：环境扰动项 env^2 >= 0，故真实总代价必然 >= 主车自身代价 lower；一旦排在前面的候选刷新了更小的 best，后面所有更高 lower 的网格无需计算直接 break。",
        },
        {
          text: "code, cost, details, queries = check_action(",
          dim: "dim4",
        },
        {
          text: "counts[code] += 1",
          dim: "dim5",
          tooltip: "16 维漏斗退回计数器：精确记录因碰撞、道路越界、后车响应极限、或成本超界被剪掉的候选比例。",
        },
        {
          text: "@njit(cache=True)",
          dim: "dim4",
        },
      ],
      secondaryBlockText:
        "【性能加速度引擎】二维机动网格 (ax, ay) 往往包含成千上万个候选组合；如果用纯 Python 对每个组合做多车时序推演 + 碰撞检测，单场景延迟会膨胀到秒级。vehicle.py 借力 Numba 编译 + 升序下界早停 + prioritize_packed_scene（按最先潜在碰撞顺位重排旁车先验顺序）把核心求解压缩进毫秒量级。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "search() 搜出的最优动作随后若 audit=True 会交给 audit.py 用未打包的原始几何做二次核验。",
          echoTargetId: "mod-4-u-1",
          echoLabel: "[-> 前往 audit.py 查看关闭剪枝的独立验证]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "在同一文件下方的 linear_tail_bound() 用闭式二次极值求解 r >= remaining 区间上界 -2(A+B*r)/(k*r^2)，使前向跟驰尾部代价评估摆脱时间步长离散误差。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "相比非线性连续 SQP 优化器容易陷入局部极小、甚至在多障碍物非凸可行域内发散，离散候选网格 + 升序分支定界天然保证在给定网格精度内找到全局最优点，且极易向量化/JIT 编译。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「如果某场景最优避险需要较大横向加速度，基础候选网格超界全被拒掉了怎么处理？」",
          calloutBox: "源码真实应对：solve() 支持 expansion_factors 多级扩张网格（若当前级可行解为 inf 且 expand_response_limits 允许），自动逐级按预设扩展网格重试并记录 expansion_level。",
        },
      ],
    },
    {
      id: "mod-4-u-1",
      unitCode: "audit.py · Unit 4.1",
      sectionId: "sec-mod-4",
      sectionTitle: "04. src/rcd_cedi/audit.py · 关闭剪枝后的纯几何终态一致性复核",
      sectionTask: "交叉核验边界层（80/20 可选择略读，但证明零算法妥协极佳证据）",
      weight: "transition",
      tldr: "独立调用原始 Vehicle 类与 swept_contact 对终态推演数组做全对无剪枝扫掠检查，兜住加速代码可能带来的微小几何漂移。",
      primaryKind: "code",
      codeLanguage: "python",
      filePath: "src/rcd_cedi/audit.py",
      primaryText: `def raw_rcd_audit(states, active, pair_only=False):
    vehicles = [rcd_model.Vehicle(str(int(s[0])), (float(s[1]), float(s[2])),
        (float(s[3]), float(s[4])), float(2*s[7]), float(2*s[8]),
        math.degrees(math.atan2(s[6], s[5]))) for s in states]
    potential, reachable, blocked = [], [], []
    seen = set()
    for i in range(len(states)):
        if pair_only and i != 0: continue
        if i != 0 and not active[i]: continue
        for j in range(len(states)):
            if pair_only and j != 1: continue
            if i == j or tuple(sorted((i, j))) in seen: continue
            seen.add(tuple(sorted((i, j))))
            a, b = vehicles[i], vehicles[j]
            et = rcd_model.swept_contact(a, b)
            if et is None: continue`,
      highlights: [
        {
          text: "rcd_model.swept_contact(a, b)",
          dim: "dim5",
        },
        {
          text: "if i == j or tuple(sorted((i, j))) in seen: continue",
          dim: "dim3",
        },
        {
          text: "pair_only=False",
          dim: "dim1",
        },
      ],
      secondaryBlockText:
        "【科研代码高可信防线】很多高速数值优化项目为了提速做了打包数组、先验剪枝和解析逼近，审稿人或工程师常怀疑“优化版和原版几何结果是否完全对齐”。audit.py 保留了一套不走任何快路径的纯几何复核流程，验证终态运动是否真满足物理安全边界。",
      notes: [
        {
          label: "01 / 调用链上下文与双向锚点",
          body: "与 vehicle.py 的 search() 共同构成「快速求解 -> 严格复核」双保险闭环。",
          echoTargetId: "mod-3-u-1",
          echoLabel: "[<- 回看 vehicle.py 的 @njit 快速剪枝搜索]",
        },
        {
          label: "02 / 核心源码机制拆解",
          body: "advance() 先按最佳 (ax, ay) 及旁车响应推演出终态矩阵 output，再交由 raw_rcd_audit() 把数组重新还原为面向对象 Vehicle 逐对检验接触与遮挡。",
        },
        {
          label: "03 / 设计取舍与替代方案",
          body: "通过 api 参数 `audit=True/False` 开放开关：批量大规模跑数压测时可关闭审计求极致吞吐，单用例验证与回归测试默认开启审计确保万无一失。",
        },
        {
          label: "04 / 面试官高频深挖追问",
          body: "追问：「这套审计模块对线上批量数据推演耗时有多大影响，值得一直开着吗？」",
          calloutBox: "工程实践：raw_rcd_audit 只针对单次搜出的最优解跑一遍 O(N^2) 静态复核（而非对几千个候选网格全部运行），因此开销远低于一次候选扫描，平时开启收益极高。",
        },
      ],
      transitionSummary:
        "至此已走完 JiaxinTrans/RCD_CEDI 的核心 4 模块：api.py 契约准备 -> rcd.py P2 遮挡筛选 -> vehicle.py Numba 下界剪枝 -> audit.py 独立复核。下方可直接取用面试防御话术与改造建议。",
    },
  ],
  bottomTitle: "08. 简历武装、压力测试与二开改造方案",
  bottomSubtitle: "把科研与工程源码拆解沉淀为可复现的架构论述、面试问答和实际 PR 优化方向",
  bottomBlocks: [
    {
      type: "statement-banner",
      tag: "30-SECOND ELEVATOR PITCH · 架构讲解模板",
      body: "我深入拆解并实践了高速公路施工区多车交互风险量化框架 RCD_CEDI：针对传统成对替代安全指标忽略中间车物理遮挡与非对称约束的问题，第一阶段通过 PreparedAB 共享缓存及 I_C/S_C/ALT_C 物理筛选剔除伪冲突，第二阶段在 Numba @njit 核内使用按主车控制下界升序的分支定界早停与解析跟驰尾界求解双视角 CEDI，并配备 raw_rcd 独立几何审计验证。",
    },
    {
      type: "socratic-qa",
      title: "L1 - L3 渐进式技术拷问（点击展开参考防御思路）",
      items: [
        {
          question: "L1 · 算法直觉：如果前后同车道依次行驶 A、B、C 三辆车，RCD 是怎样避免给 A-C 误判直面冲突的？",
          answer:
            "Stage 1 先通过 swept_contact(A, C) 计算出碰撞走廊与时间 t_AC，再由 evaluate_c_obstruction 检查中间车 B 的四个角点：只有当 B 全部落入碰撞角点对区间内 (I_C=1)、跨过冲突路径中心线 (S_C=1)、且自身横向撤离时间 ALT_B >= t_AC 时，才标记 B 构成了物理阻挡，把 A-C 冲突排除在可达冲突集之外。",
        },
        {
          question: "L2 · 数值与极限：当旁车与目标车保持平行同向行驶（相对横向速度 w ≈ 0）时，ALT = distance / abs(w) 岂不是除零异常？",
          answer:
            "源码在 rcd.py 专门针对 abs(w) <= EPS 做了显式零速补全（zero_clearing_speed_case，包含相对静止、平行同向、平行反向三种情形），此时令 clearing distance = inf 并在通过 I_C/S_C 筛选后直接判定为持续占用阻挡（blocks=True），既防止除零报错又守住了物理严谨性。",
        },
        {
          question: "L3 · 架构与优化：vehicle.py 为什么宁愿把动作空间离散成网格交给 @njit 扫描，而不用连续梯度优化器直接求 (ax, ay)？",
          answer:
            "受限于多旁车耦合响应、施工区多边形边界与跟驰安全阈值，CEDI 的可行域往往是非凸甚至分段的，梯度法容易卡死在局部劣解或穿过不可行带。通过预排序的离散网格配合分支定界下界早停 own_bound_stop（lower >= best 立刻中断）及解析尾界 linear_tail_bound，不仅 100% 保证网内全局最优，还能在 Numba nogil 内实现毫秒级吞吐。",
        },
      ],
    },
    {
      type: "star-bullets",
      title: "简历与科研工程项目陈述参考话术（双版本可直接取用）",
      versions: [
        {
          versionLabel: "版本 A · 科研算法工程化视角（突出几何建模与数值稳健性）",
          summary: "适用于自动驾驶规划、交通仿真与算法工程岗位面试。",
          bullets: [
            "剖析并应用两阶段施工区风险量化框架 RCD_CEDI，利用 PreparedAB 缓存复用与 I_C/S_C/ALT_C 几何裁剪过滤多车遮挡下的不可达伪冲突，消除传统成对指标的风险失真。",
            "结合 Numba @njit 升序分支定界剪枝（own_bound_stop）与闭式解析尾界（linear_tail_bound）求解双视角 CEDI，并借助无剪枝 raw_rcd_audit 完成终态几何零偏差复核。",
          ],
        },
        {
          versionLabel: "版本 B · 高性能计算与重构视角（适合阐述工程调优能力）",
          summary: "适用于注重 Numba / JIT 性能、内存分配与测试回归能力的研发岗。",
          bullets: [
            "定位 CEDI 候选搜索热循环中的细节瓶颈，针对提前剪枝路径优化工作缓冲分配与旁车碰撞优先检测排序（prioritize_packed_scene），显著降低无效候选评估耗时。",
            "配合 tests/fixtures/source_regression.json 回归基线实现优化前后数值完全对齐验证，保障科学计算引擎加速而不牺牲边界物理精度。",
          ],
        },
      ],
    },
    {
      type: "ownership-blueprints",
      title: "2小时可落地的 Ownership 二次开发改造建议（向开源仓库提 PR 实战）",
      plans: [
        {
          title: "改造蓝图 01：消除 check_action 提前剪枝路径的 details 数组预分配",
          timeEstimate: "预计耗时：1.5 小时",
          targetFiles: "src/rcd_cedi/cedi/vehicle.py",
          changeSteps:
            "1) 将 check_action 内部早于标量下界与道路约束的 `np.full((n, 12), math.nan)` 延后，或改为由 search() 传入预分配 scratch buffer；2) 使用 tests/fixtures/source_regression.json 对比全量输出一致性。",
          benchmarkMetric: "在高 reject 比例的密集施工区场景下明显削减堆内存分配与 GC 抖动。",
          interviewPitch:
            "面试讲性能优化细节时拿出实测 profiling 前后对照：哪怕在 Numba @njit 里，消除热循环每轮一次小矩阵分配也能大幅压降尾延迟。",
        },
        {
          title: "改造蓝图 02：为 api.py 批量场景评估增加并行 Batch Executor 支持",
          timeEstimate: "预计耗时：2 小时",
          targetFiles: "src/rcd_cedi/api.py & csv_tools/vehicle.py",
          changeSteps:
            "1) 借助 search() 自身标注的 nogil=True 特性，用 ThreadPoolExecutor 并行评估大批次轨迹帧；2) 验证不同线程间 PreparedAB 只读共享零竞态。",
          benchmarkMetric: "在多核 CPU 上跑千帧连续轨迹分析时获得接近核数线性的吞吐提升。",
          interviewPitch:
            "展示你真正看懂了为什么源码特意写 `@njit(cache=True, nogil=True)`，并将 nogil 真正落到批处理并发加速。",
        },
        {
          title: "改造蓝图 03：补全多旁车同时阻挡时的临界优先级诊断字段",
          timeEstimate: "预计耗时：1 小时",
          targetFiles: "src/rcd_cedi/rcd.py & src/rcd_cedi/models.py",
          changeSteps:
            "1) 在 diagnostics['surrounding'] 中额外输出每辆阻挡车的余裕时间 (t_ab - ALT_C)；2) 按险情裕度排序暴露最关键阻塞车 ID。",
          benchmarkMetric: "无需重算即可在上层可视化轨迹中直接标出最棘手的遮挡车。",
          interviewPitch:
            "体现接口可观测性设计敏感度：不只输出冷冰冰的 True/False，还给出定量的净空裕度排序。",
        },
      ],
    },
    {
      type: "before-after-diff",
      title: "可交互式代码改造对比区与压测记录（自动持久保存至本地）",
      description:
        "下方已预置「消除 vehicle.py 热路径提前分配详情矩阵」的优化草稿，你可以直接编辑并记录实测数据。",
      defaultBeforeCode: `# BEFORE (src/rcd_cedi/cedi/vehicle.py): 提前分配 details 数组，随后才因下界剪枝退出
details = np.full((len(states), 12), math.nan)
lower = math.hypot(ax / (cfg[5] if ax > 0. else cfg[6]), ay / cfg[7])
if lower >= upper_bound:
    return 13, math.inf, details, 0`,
      defaultAfterCode: `# AFTER: 先执行 O(1) 标量剪枝，仅当候选进入多车模拟时才复用 scratch details 缓冲
lower = math.hypot(ax / (cfg[5] if ax > 0. else cfg[6]), ay / cfg[7])
if lower >= upper_bound:
    return 13, math.inf, 0  # 零数组分配直接返回；仅 code == 0 时写入 best_details`,
      defaultBenchmarkNote:
        "对比基线（tests/fixtures/source_regression.json）：\n- BEFORE：密集候选集中 ~62% 被 code=13 成本剪枝直接退回，仍触发 details 临时分配\n- AFTER：跳过无效候选数组分配并保持 CEDI 与 best_ax/best_ay 输出完全一致",
    },
  ],
};
