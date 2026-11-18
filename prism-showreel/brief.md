<role>
你是一位动态设计师兼创意程序员，用代码制作可以发布的视频，保留短片的动效表现力，围绕真实界面与功能变化讲清产品价值。
</role>

<inputs>
主题：Prism Workbench（学术精读 · 视频/认知内化 · 开源架构拆解多模态工作台）全功能与界面生动介绍
观众记住的一句话 / 一个画面：任何复杂 PDF 论文、抖音/B站音轨或 GitHub 源码库，在一屏之内完成「顶部架构鸟瞰 → 双栏结构化批注 → 划词 AI 追问证据链 → 纯净通读中英切换」。
素材：Playwright 实地 2× DPR 截取的真实界面（assets/ui-*.png，共 13 张真实交互截图），严禁虚构功能或数据；字体使用 self-hosted fonts/（lora-700.woff2、ibm-plex-sans-700.woff2、ibm-plex-mono-600.woff2）与系统 PingFang SC 兜底。
规格：45.0 秒（90 拍 @ 120 BPM，22.5 小节；支持按终版音画节拍微调 ±1 秒）· 横屏 16:9 · 1920×1080 · 30fps
制作过程预览：未提出特殊分阶段进度页要求；按默认流程走第 3 步风格帧确认与第 6 步工作区预览。
受众 / 平台：科研研究者、工程师、终身学习者 / 桌面端与 B站/YouTube/GitHub README 演示（16:9 黄金可读性）。
内容依据：deep-reading-workbench 实装功能：
1. 多源导入工作台（IngestionStudioModal）：arxiv/PDF 论文公式图像抽取、B站/抖音/小红书/YouTube 链接自动识别 + 本地 v2t/mlx-whisper 音轨 ASR 转写、GitHub 源码切片。
2. 顶部鸟瞰导航面板（TopMentalPanel）：第一性原理摘要、新旧 OS 对比、可点击跳转的 Dagre SVG 拓扑图、分段抽屉式预测试/词典/三遍路径。
3. 双栏对照精读（DualColumnRow）：五色语义高亮 + 认识论徽章（[原文明示] / [分析推断] / [原文未说明] / [原文不一致]）+ 右栏四维结构拆解 + 理解度自评（懂了/模糊/不懂）。
4. 划词右键 AI 追问与证据溯源（SelectionQaModal）：划词锚定虚线框、角标累计追问次数 `[已追问 N 次]`、跨节证据一键跳转。
5. 三态阅读质感与模式自适应视觉：稿纸（Paper #F1EADC）/ 夜空（Aurora #0B111E）/ 纯白（Studio #FFFFFF），不同内容形态自适应渐变头图（牛津藏青/暖琥珀/石墨青）。
6. 三档阅读深度（通读/精读/复习）：通读纯净模式居中 760px 无高亮长卷、支持英文原稿与中文稿实时切换 + 右下角悬浮毛玻璃 Dock + Esc 退出。
7. 四维智能整理文库（LibraryDrawer）：按主题领域、消化进度、研究范式、标签一键 AI/启发式归档与多格式导出（Markdown / Anki CSV / Standalone HTML）。
品牌：主色 #1A2744（牛津藏青），稿纸底 #F1EADC，夜空底 #0B111E，强调色 #E59838 / #2563EB
BGM：AI 自主合成（第 1 档 score.mjs / 第 2 档可按选定方向定音色）
音效：AI 自主合成（UI 微交互音效：click、tick、pop、whoosh、bell、impact）
口播：无口播（纯视觉界面实录 + 动效大字卡 + 音乐与音效节拍驱动）
</inputs>

<confirmations>
需求确认：已于 2026-11-17T18:04:29+08:00 经用户多选问答明确确认：
- A1（内容与时长）：45 秒（完整展示真实界面、三大模式、划词 AI 追问、三态主题与通读模式中英切换）
- A2（画幅与帧率）：横屏 16:9 · 1920×1080 · 30fps
- A3（BGM 来源）：AI 自主合成
- A4（SFX 音效来源）：AI 自主合成
- A5（口播方式）：无口播（纯视觉界面实录 + 动效大字卡 + 音乐与音效节拍驱动）
风格帧确认：待第 3 步三方向展示后由用户确认。
最终预览与导出确认：待第 6 步工作区预览后由用户确认。
</confirmations>

<direction>
Reel Read:
  format: B 产品宣传短片（结合多态真实截图窗口交互）
  benchmark: Linear Release Film & Readwise Reader Showcase（学：2× 高清真屏空间推进、实体光标精准操作真实按钮、章节级变奏呼吸；不学：盲目紫蓝霓虹发光、无来源随机数据、每张截图静态平移像 PPT）。
  structure:
    候选1：多源输入 → 顶部鸟瞰与双栏精读 → 划词 AI 追问证据链 → 三态主题与通读纯净切换 → 四维文库归档（使用旅程串联，**入选**：因果连贯，观众自然看懂为什么先导入、再拆解、再追问、后通读沉淀）。
    候选2：前后对比二分屏（普通阅读器 vs Prism）。
    候选3：UI 组件微交互串烧（缺少整体能力叙事）。
  style: 已由用户确认为 **方向 A · 暖纸玻璃手稿（`minimal-ui`）**：暖米色稿纸画布 `#F1EADC` + 牛津藏青 `#1A2744` + 暖琥珀 `#D9821E`（夜间切题时全画布按 OKLab 同步转「夜空 Aurora `#0B111E`」与「纯白 Studio `#F8FAFC`」），真实 2× DPR 视窗配合精确定位物理弹簧光标（`uiPt` 锁死按钮坐标）与高清内部推进。
  signals: 1) 右上角三态主题随真实点击全画布 OKLab 变色（稿纸→夜空→纯白）；2) `uiPt()` 自动映射缩放/平移下的原生按钮、DAG 节点、划词追问虚线框、`[已追问 1 次]` 角标与 `[一键智能整理]`；3) 通读 760px 居中模式下左右擦拭瞬间完成 `英文/原稿 ↔ 中文稿` 切换。
  hook: 第 0 拍：三种碎片化信息流（PDF / 抖音视频口令 / GitHub 代码仓库）汇聚成三棱镜几何射线，瞬间展开真实的 Prism 界面。
  signature: 第 16–20 小节：实体光标划选正文弹出「AI 划词追问与证据溯源」弹窗，卡片同步落定虚线框与 `[已追问 N 次]` 徽章，随后镜头推向「稿纸 → 夜空 → 纯白」与「通读 · 英文原稿 → 中文稿」一镜变形切换。
  sound:
    benchmark: Nils Frahm / Rival Consoles 精密电子极简科技感（干净的木质马林巴/拨弦 + crisp UI 拟音，无廉价 EDM 轰炸）
    role: 节奏与界面动作一问一答（UI 点击、弹窗、主题切换均有专属质感音效，BGM 用四度叠加与 Lydian 色彩稳步推升）
    groove: 120 BPM · 4/4 拍（直拍与轻十六分 hi-hat 律动）
    harmony: D Lydian → C# minor 7（科技惊奇 + 学者沉静感，避开默认 A 小调）
    palette: mallet(marimba/kalimba) + keys + bass + 细腻 click/tick/pop/whoosh/bell
    arc: 累加 → 高潮抽空转通读 → 温暖定格（15s 前建构工作台，30s 处达到多模态与 AI 追问密度顶峰，36s 后音乐略退突出通读宁静与文库归档落版）
  forbidden: 禁止紫蓝渐变背景配居中大字；禁止用 CSS 手画假界面冒充产品；禁止逐页交叉淡入幻灯片；禁止无休止快速乱晃（落定阅读段写进 HOLDS）；禁止出现任何 Emoji 字符。
</direction>

<structure>
节拍网格（初步规划，选定方向后进入正式 timeline 细化）：120 BPM（1 拍 = 0.50 秒，1 小节 = 2.00 秒），共 22.5 小节（90 拍 = 45.00 秒）。
1. Hook & 三大引擎亮相（0.0s – 6.0s · Beat 0–12）：三类输入源汇聚 -> 导入中心 (`ui-studio-modal.png`) & 论文/视频/源码三界面快速切换。
2. 先见森林 · 顶部认知鸟瞰（6.0s – 13.0s · Beat 12–26）：`ui-hero-paper.png` + `ui-cognitive-paper.png`，展示第一性原理横幅、新旧 OS 对比与交互式 SVG 拓扑图高亮。
3. 双栏精读 · 拆解内核（13.0s – 21.0s · Beat 26–42）：`ui-dual-paper.png` + `ui-repo-aurora.png`，镜头聚焦左栏五色高亮 + `[原文明示]`/`[分析推断]` 认识论徽章，右栏四维逐层亮起。
4. 划词右键 AI 追问与跨节证据链（21.0s – 28.0s · Beat 42–56）：光标在 `Abs.P1` 划词触发 `ui-qa-modal.png` 弹窗，落定 `ui-qa-dashed.png` 卡片虚线框与 `[已追问 1 次]` 角标。
5. 三态主题切换 + 通读纯净与中英双稿（28.0s – 38.0s · Beat 56–76）：稿纸 (`ui-hero-paper.png`) → 夜空 (`ui-theme-aurora.png` / `ui-dual-aurora.png`) → 纯白 (`ui-theme-studio.png`)，随后收拢为 `760px` 居中 `通读` 纯净长卷，光标点击切换 `英文/原稿` (`ui-pure-en.png`) ↔ `中文稿` (`ui-pure-zh.png`)。
6. 四维智能文库与定格落版（38.0s – 45.0s · Beat 76–90）：`ui-library-drawer.png` `[一键智能整理]` 四维分类汇总，最后镜头拉远定格至 Prism Workbench 品牌落版：`穿透表象，重建你的认知结构`（停留 ≥ 2.5s，写进 HOLDS）。
</structure>

<build>
1. 页面契约：window.DUR = 45; window.render(t); window.READY = true; 所有字号和定位由 W, H 与 U 推导。
2. 绝对确定性：严禁 Math.random / Date.now / rAF / CSS transition；全部图片在 READY 前预加载并 decode()。
3. 导出前先通过 editor.mjs 打开预览工作区供用户审片，确认后再导出 1920x1080 @ 30fps MP4 并通过 inspect.mjs qa 与审片检查。
</build>
