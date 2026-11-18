# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

PurrParse serves three equal primary user groups across both the core interactive workbench (`src/`) and its showcase landing surface (`landing/`):

- **Academic Readers & Students**: University students and researchers digesting dense arXiv papers, PDFs, and LaTeX formulas who need sentence-level structural mapping, bilingual comparison, and formula intuition without losing source fidelity.
- **Video & Long-Form Learners**: Knowledge workers distilling long Bilibili/Douyin videos (including uncaptioned recordings) and cognitive essays into verified arguments and concrete action checklists.
- **Software Engineers & Interviewees**: Developers rapidly analyzing unfamiliar open-source GitHub repositories along `20/80` critical execution paths, concurrency boundaries, and architectural trade-offs.

## Product Purpose

Transform thick, high-friction materials—academic papers, audio/video transcripts or essays, and multi-file source repositories—into scannable, verifiable multi-column cognitive structures, inline Q&A chains, and portable study artifacts in one unified workbench.

## Positioning

A schema-driven, anti-hallucination three-mode reading and deconstruction workbench (`academic-paper`, `cognitive-essay`, `repo-deconstruct`) that decouples an invariant structural reader skeleton from domain-specific ingestion/analysis plugins. Unlike flat chat summaries that blur source truth with model guesses, PurrParse enforces `20/80` signal prioritization, mandatory epistemic attribution markers (`[原文明示 / 分析推断 / 原文未说明]`), selection-pinned Q&A anchored directly to excerpts, local transcription for uncaptioned video, and zero-dependency offline export (Markdown, Anki CSV, and standalone interactive `.html`).

## Operating Context

- **Dual Web Surfaces in Repository**:
  - `src/` — Next.js 15 / React 19 / TypeScript workbench application (`npm run dev` / `next dev --turbopack`) using browser-local persistence (`zustand`, `idb-keyval`), multi-provider LLM chunk orchestration (`ai`, `@ai-sdk/*`), local V2T audio-to-text bridging, KaTeX math rendering, Shiki code highlighting, and Dagre graph layouts.
  - `landing/` & `prism-showreel/` — Static showcase website and 45-second 1080p 30fps feature showreel introducing and demonstrating all core reading modes live in the browser.
- **Core Workflows**: Multi-source ingestion (arXiv PDF, Bilibili/Douyin share links or local audio tracks, GitHub repo URL/directory trees), 5-dimension highlight filtering, `20/80` core vs full view, bilingual Zen reading toggle, in-situ selection Q&A with persistent inquiry counts, 4-dimension personal library organization, and offline multi-format export.

## Capabilities and Constraints

- **Technical Boundaries**: Root app built on Next.js 15 App Router (`src/app/`); marketing site (`landing/`) intentionally ships as vanilla static HTML/CSS/JS with self-hosted media/fonts and no bundler step; repository architecture follows Deep Modules / Clean Seams / Zod AST contracts (`src/core/contracts/`).
- **Epistemic Integrity Constraint**: Analytical summaries and Q&A responses must preserve explicit provenance labels (`[原文明示 / 分析推断 / 原文未说明]`). Never fabricate metrics, benchmarks, citations, user quotes, or unverified product claims.
- **Brand Transition State (Open Decision)**: External brand identity in `landing/` and `prism-showreel/` has transitioned from `Prism Workbench` to **PurrParse**, whereas root package metadata (`package.json`), `src/app/layout.tsx`, and `ARCHITECTURE_AND_ROADMAP.md` currently still carry `prism-workbench` / `Prism Workbench`. Aligning internal code identifiers to `PurrParse` remains an open future decision.
- **Undecided Commercial & Governance Facts**: Product-wide distribution license, commercial pricing tiers, and optional cloud synchronization policy are not established in the repository and remain undecided; third-party vinyl stickers in `landing/` carry MIT attribution to `stickitupx.com/stickers`.

## Brand Commitments

- **Product Name**: **PurrParse**
- **Flagship Mark & Interactive Assets**:
  - Black-cat logo sticker (`landing/assets/stickers/black-cat.svg`) used across navbar branding, favicon, 45s showreel opening/closing lockups, and the interactive footer wordmark wall.
  - Interactive cat & character SVG sticker set (`landing/assets/stickers/*.svg`) paired with feline sound feedback (`landing/media/sfx/meow.mp3`).
- **Partner / Linked Showcase Example**: Interactive repository walkthrough mode in `landing/` showcases `JiaxinTrans/RCD_CEDI` (`20/80` core architecture guide).

## Evidence on Hand

- `ARCHITECTURE_AND_ROADMAP.md`: System architecture specification documenting the four seams (`Source Ingestion`, `Mode Plugin`, `Structured LLM Engine`, `Renderer & Exporter`).
- `landing/media/prism-showcase.mp4` & `landing/media/shots/*.png`: Rendered 45s 1080p showcase video and verified UI captures across Paper / Aurora / Pure / Modal states.
- `landing/assets/stickers/*.svg`, `landing/media/sfx/meow.mp3`, `landing/media/wechat-qr.png`: Verified SVG brand/sticker assets, sound effect asset, and contact QR image.
- **Verified Absences (Do Not Fabricate)**: No verified external customer testimonials, production usage analytics, SLA metrics, or pricing tables exist in the repository.

## Product Principles

1. **Structure Before Summary**: Turn sprawling papers, uncaptioned videos, and codebases into navigable mental models, call graphs, and `20/80` filtered units before offering narrative takeaways.
2. **Source-Anchored Epistemic Honesty**: Explicitly separate documented text/code facts from model inference and missing context, pinning every question back to its originating passage.
3. **One Invariant Shell, Pluggable Domains**: Share core navigation, filtering, Q&A anchoring, and offline export seams across distinct learning domains via typed plugins.
4. **Local-First & Portable Knowledge**: Support local voice-to-text transcription and standalone HTML / Markdown / Anki export so comprehension artifacts belong durably to the user.
5. **Approachable Rigor**: Combine heavyweight academic and engineering precision with lightweight, memorable brand personality without compromising analytical clarity.
