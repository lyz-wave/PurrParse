# PurrParse — 独立产品介绍页 (`landing/`)

零构建、纯静态原生 HTML / CSS / ES Module 产品官网，可直接脱离 Next.js 后端部署到任意静态托管平台。

## 目录结构

- `index.html`：官网主入口（含 45s 演示片与 6 章节时间轴、全真可点击应用贴纸窗口、能力架构说明）
- `styles.css`：继承软件原生的「稿纸 Paper / 夜空 Aurora / 纯白 Studio」三态光学 CSS 变量与 StickItUp 3D 贴纸翻折动效
- `app.js` & `data.js`：视频章节同步控制、三模式真实交互（学术论文 / 抖音音轨转写 / GitHub 源码）、DAG 节点跳转、划词 AI 追问弹窗、通读中英文互切与四维文库
- `media/prism-showcase.mp4` & `media/prism-poster.png`：1080p @ 30fps 带配乐与 UI 拟音宣传成片及封面海报
- `assets/stickers/*.svg`：源自 [stickitupx.com/stickers](https://stickitupx.com/stickers) 的 MIT 开源矢量贴纸资源
- `fonts/*.woff2`：自托管 Lora / IBM Plex Sans / IBM Plex Mono 字体文件

## 本地预览

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory landing
```

浏览器访问 `http://127.0.0.1:4173/`。

## 静态部署

直接将 `landing/` 作为 Root Directory 上传至 Cloudflare Pages、Vercel 或 GitHub Pages 即可上线（无须运行 Node 构建步骤）。
