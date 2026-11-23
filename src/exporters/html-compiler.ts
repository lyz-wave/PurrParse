import katex from "katex";
import type {
  BottomArsenalBlock,
  DimensionSpec,
  HighlightSpan,
  UserAnnotationsState,
  WorkbenchDocument,
  WorkbenchUnit,
} from "@/core/contracts/document-ast";
import {
  formatFlowTextForMath,
  normalizeLatexSyntax,
  normalizeUnicodeMathDiacritics,
} from "@/core/engine/flow-math";
import { computeDiagramLayout } from "@/workbench-ui/dagre-layout";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMath(text: string): string {
  const escaped = escapeHtml(text);
  // Render inline $...$ spans using KaTeX when possible
  return escaped.replace(/\$([^$\n]{1,600})\$/g, (_full, expr: string) => {
    try {
      const unescaped = expr
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
      const normalized = normalizeLatexSyntax(unescaped);
      const rendered = katex.renderToString(normalized, { throwOnError: false, displayMode: false });
      return `<span class="inline-math" data-tex="${escapeHtml(normalized)}">${rendered}</span>`;
    } catch {
      return `<code>${expr}</code>`;
    }
  });
}

function renderHighlightedText(text: string, highlights: HighlightSpan[], isCode: boolean): string {
  if (!highlights || highlights.length === 0) {
    return isCode ? escapeHtml(text) : renderInlineMath(text);
  }

  interface MatchSegment {
    start: number;
    end: number;
    span: HighlightSpan;
  }

  const segments: MatchSegment[] = [];
  for (const span of highlights) {
    if (!span.text) continue;
    let idx = text.indexOf(span.text);
    if (idx !== -1) {
      const overlaps = segments.some((s) => !(idx + span.text.length <= s.start || idx >= s.end));
      if (!overlaps) {
        segments.push({ start: idx, end: idx + span.text.length, span });
      }
    }
  }

  segments.sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = "";

  for (const seg of segments) {
    if (seg.start > cursor) {
      const plain = text.slice(cursor, seg.start);
      html += isCode ? escapeHtml(plain) : renderInlineMath(plain);
    }
    const piece = text.slice(seg.start, seg.end);
    const renderedPiece = isCode ? escapeHtml(piece) : renderInlineMath(piece);
    const tipAttr = seg.span.tooltip ? ` data-tip="${escapeHtml(seg.span.tooltip)}"` : "";
    html += `<span class="hl ${seg.span.dim}${seg.span.tooltip ? " has-tip" : ""}"${tipAttr}>${renderedPiece}</span>`;
    cursor = seg.end;
  }

  if (cursor < text.length) {
    const rest = text.slice(cursor);
    html += isCode ? escapeHtml(rest) : renderInlineMath(rest);
  }
  return html;
}

const NODE_FILL_MAP: Record<string, { fill: string; stroke: string; text: string }> = {
  yellow: { fill: "#fff8cf", stroke: "#d49b00", text: "#1c222d" },
  red: { fill: "#fdecee", stroke: "#d64550", text: "#7f1d1d" },
  blue: { fill: "#eaf3ff", stroke: "#2b6cb0", text: "#1e3a5f" },
  green: { fill: "#eaf7ee", stroke: "#2b7a4b", text: "#14532d" },
  purple: { fill: "#f4edfb", stroke: "#7b4ea3", text: "#4c1d95" },
  navy: { fill: "#1a2744", stroke: "#1a2744", text: "#ffffff" },
};

function renderDiagramSvg(doc: WorkbenchDocument): string {
  const layout = computeDiagramLayout(doc.topMentalModel.diagram);
  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${layout.width} ${layout.height}" width="100%" style="max-width:${layout.width}px;height:auto;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">`
  );
  parts.push(
    `<defs><marker id="prism-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#2b6cb0"/></marker></defs>`
  );

  for (const edge of layout.edges) {
    parts.push(
      `<path d="${edge.pathD}" fill="none" stroke="#2b6cb0" stroke-width="1.8" marker-end="url(#prism-arrow)" />`
    );
    if (edge.label) {
      parts.push(
        `<text x="${edge.labelX.toFixed(1)}" y="${edge.labelY.toFixed(1)}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono, monospace" fill="#525b6c">${escapeHtml(edge.label)}</text>`
      );
    }
  }

  for (const node of layout.nodes) {
    const palette = NODE_FILL_MAP[node.colorSlot ?? "blue"] ?? NODE_FILL_MAP.blue;
    const clickAttr = node.targetUnitId
      ? ` class="svg-node-link" onclick="jumpToUnit('${escapeHtml(node.targetUnitId)}')"`
      : "";
    parts.push(`<g${clickAttr}>`);
    parts.push(
      `<rect x="${node.x.toFixed(1)}" y="${node.y.toFixed(1)}" width="${node.width}" height="${node.height}" rx="8" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1.8" />`
    );
    parts.push(
      `<text x="${(node.x + node.width / 2).toFixed(1)}" y="${(node.y + (node.subLabel ? 26 : 31)).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600" fill="${palette.text}">${escapeHtml(node.label)}</text>`
    );
    if (node.subLabel) {
      parts.push(
        `<text x="${(node.x + node.width / 2).toFixed(1)}" y="${(node.y + 45).toFixed(1)}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono, monospace" fill="#525b6c">${escapeHtml(node.subLabel)}</text>`
      );
    }
    parts.push(`</g>`);
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function renderBottomBlockHtml(
  docId: string,
  block: BottomArsenalBlock,
  annotations?: UserAnnotationsState
): string {
  switch (block.type) {
    case "flow-skeleton":
      return `<div class="bottom-card">${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}<div class="flow-grid">${block.steps
        .map(
          (s) =>
            `<div class="flow-step"><div class="step-tag">${escapeHtml(s.tag)}</div><div class="step-body">${renderInlineMath(s.body)}</div></div>`
        )
        .join("")}</div></div>`;

    case "statement-banner":
      return `<div class="banner-box"><span class="banner-tag">${escapeHtml(block.tag)}</span><div>${renderInlineMath(block.body)}</div></div>`;

    case "comparison-pair":
      return `<div class="compare-grid"><div class="cmp-card ${block.left.tone}"><h4>${escapeHtml(block.left.tag)}</h4><p>${renderInlineMath(block.left.body)}</p></div><div class="cmp-card ${block.right.tone}"><h4>${escapeHtml(block.right.tag)}</h4><p>${renderInlineMath(block.right.body)}</p></div></div>`;

    case "socratic-qa":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3>${block.items
        .map(
          (qa) =>
            `<details class="qa-item"><summary>${qa.cognitiveLevel ? `[${escapeHtml(qa.cognitiveLevel)}] ` : ""}${renderInlineMath(qa.question)}</summary><div class="qa-ans">${renderInlineMath(qa.answer)}</div></details>`
        )
        .join("")}</div>`;

    case "claim-evidence-table":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th>编号</th><th>主张</th><th>证据锚点</th><th>局限</th><th>未覆盖</th></tr></thead><tbody>${block.rows
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.claimId)}</td><td>${renderInlineMath(r.claim)}</td><td>${renderInlineMath(r.evidenceAnchor)}</td><td>${renderInlineMath(r.limitation)}</td><td>${renderInlineMath(r.unverifiedGap)}</td></tr>`
        )
        .join("")}</tbody></table></div>`;

    case "prior-work-table":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th>前作</th><th>声称差异</th><th>原文锚点</th><th>信息缺口</th></tr></thead><tbody>${block.rows
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.priorWork)}</td><td>${renderInlineMath(r.claimedDifference)}</td><td>${escapeHtml(r.anchor)}</td><td>${escapeHtml(r.infoGap)}</td></tr>`
        )
        .join("")}</tbody></table></div>`;

    case "first-principles-list":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3>${block.items
        .map(
          (it, idx) =>
            `<div class="journal-item"><strong>前提 ${idx + 1}: ${renderInlineMath(it.premise)}</strong><div class="j-hint">若不成立: ${renderInlineMath(it.ifViolated)} | 依据: ${renderInlineMath(it.basis)}</div></div>`
        )
        .join("")}</div>`;

    case "feynman-challenge":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3><p>${escapeHtml(block.prompt)}</p><details class="qa-item"><summary>[查看参考大白话讲解与外行三连问]</summary><div class="qa-ans"><p>${renderInlineMath(block.referenceExplanation)}</p><ul>${block.laypersonQuestions
        .map((q) => `<li>${renderInlineMath(q)}</li>`)
        .join("")}</ul></div></details></div>`;

    case "purpose-tailored":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)} (${escapeHtml(block.purposeLabel)})</h3><ul>${block.items
        .map((it) => `<li><b>[${escapeHtml(it.tag)}]</b> ${renderInlineMath(it.body)}</li>`)
        .join("")}</ul></div>`;

    case "review-schedule":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3><ul>${block.tasks
        .map((t, i) => `<li><b>Stage ${i + 1}:</b> ${renderInlineMath(t)}</li>`)
        .join("")}</ul></div>`;

    case "aphorism-list":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3>${block.items
        .map(
          (ap) =>
            `<div class="aphorism-row"><div class="ap-en">${escapeHtml(ap.en)}</div><div class="ap-zh">${escapeHtml(ap.zh)}</div></div>`
        )
        .join("")}</div>`;

    case "journal-prompts":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3>${block.items
        .map((j) => {
          const val = annotations?.journalAnswers?.[j.id] ?? "";
          return `<div class="journal-item"><label>${escapeHtml(j.label)}</label><div class="j-hint">${escapeHtml(j.hint)}</div><textarea data-journal-id="${escapeHtml(j.id)}" placeholder="${escapeHtml(j.placeholder)}">${escapeHtml(val)}</textarea></div>`;
        })
        .join("")}</div>`;

    case "checklist":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3>${block.items
        .map((c) => {
          const checked = annotations?.checklistStates?.[c.id] ? "checked" : "";
          return `<label class="chk-item"><input type="checkbox" data-check-id="${escapeHtml(c.id)}" ${checked}/> <span class="chk-tag">${escapeHtml(c.tag)}</span> <span>${renderInlineMath(c.text)}</span></label>`;
        })
        .join("")}</div>`;

    case "star-bullets":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3>${block.versions
        .map(
          (v) =>
            `<div class="star-ver"><h4>${escapeHtml(v.versionLabel)}</h4><p class="star-sum">${escapeHtml(v.summary)}</p><ul>${v.bullets
              .map((b) => `<li>${renderInlineMath(b)}</li>`)
              .join("")}</ul></div>`
        )
        .join("")}</div>`;

    case "ownership-blueprints":
      return `<div class="bottom-card"><h3>${escapeHtml(block.title)}</h3><div class="bp-grid">${block.plans
        .map(
          (p) =>
            `<div class="bp-card"><div class="bp-head"><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.timeEstimate)}</span></div><div class="bp-meta"><b>目标文件:</b> ${escapeHtml(p.targetFiles)}</div><div class="bp-meta"><b>实施步骤:</b> ${escapeHtml(p.changeSteps)}</div><div class="bp-meta"><b>验证指标:</b> ${escapeHtml(p.benchmarkMetric)}</div><div class="bp-pitch"><b>面试切入:</b> ${escapeHtml(p.interviewPitch)}</div></div>`
        )
        .join("")}</div></div>`;

    case "before-after-diff": {
      const before = annotations?.beforeAfterDiff?.beforeCode ?? block.defaultBeforeCode;
      const after = annotations?.beforeAfterDiff?.afterCode ?? block.defaultAfterCode;
      const bench = annotations?.beforeAfterDiff?.benchmarkNote ?? block.defaultBenchmarkNote;
      return `<div class="bottom-card" data-doc-id="${escapeHtml(docId)}"><h3>${escapeHtml(block.title)}</h3><p>${escapeHtml(block.description)}</p><div class="diff-grid"><div><div class="diff-lbl before">BEFORE</div><textarea data-diff="before">${escapeHtml(before)}</textarea></div><div><div class="diff-lbl after">AFTER</div><textarea data-diff="after">${escapeHtml(after)}</textarea></div></div><div class="diff-lbl bench">BENCHMARK & NOTES</div><textarea data-diff="bench">${escapeHtml(bench)}</textarea></div>`;
    }
  }
}

function renderUnitHtml(
  unit: WorkbenchUnit,
  annotations?: UserAnnotationsState,
  transitionPrefix = "[TRANSITION]"
): string {
  const userNote = annotations?.unitNotes?.[unit.id] ?? "";
  const isCode = unit.primaryKind === "code";

  const primaryBlock = isCode
    ? `<pre class="code-box"><code>${renderHighlightedText(unit.primaryText, unit.highlights, true)}</code></pre>`
    : `<div class="prose-box">${renderHighlightedText(unit.primaryText, unit.highlights, false)}</div>`;

  const formulaHtml = (unit.formulas ?? [])
    .map((f) => {
      const normalizedBlock = f.latex ? normalizeUnicodeMathDiacritics(f.latex) : "";
      const katexHtml = normalizedBlock
        ? katex.renderToString(normalizedBlock, { throwOnError: false, displayMode: true })
        : "";
      const texAttr = normalizedBlock ? ` data-tex="${escapeHtml(normalizedBlock)}"` : "";
      const flowHtml = f.flowText
        ? `<div class="flow-chip"><b>${escapeHtml(f.flowLabel ?? "FLOW")}:</b> ${renderInlineMath(formatFlowTextForMath(f.flowText))}</div>`
        : "";
      return `<div class="formula-box"${texAttr}>${katexHtml}${flowHtml}</div>`;
    })
    .join("");

  const figuresHtml = (unit.figures ?? [])
    .map((fig) => {
      const imgsHtml = (fig.imageUrls ?? [])
        .map(
          (url) =>
            `<img src="${escapeHtml(url)}" alt="${escapeHtml(fig.caption)}" style="max-height:380px;max-width:100%;display:block;margin:6px auto;border:1px solid #e5dfd2;border-radius:6px;background:#fff;padding:4px;" />`
        )
        .join("");
      const capHtml = fig.caption
        ? `<figcaption style="font-size:12px;color:#525b6c;text-align:center;margin-top:6px;">${renderInlineMath(fig.caption)}</figcaption>`
        : "";
      return `<figure style="margin:12px 0;padding:10px;background:#fcfaf6;border:1px solid #ddd6c7;border-radius:8px;">${imgsHtml}${capHtml}</figure>`;
    })
    .join("");

  const notesHtml = unit.notes
    .map((n) => {
      const echoHtml = n.echoTargetId
        ? `<button type="button" class="echo-btn" onclick="jumpToUnit('${escapeHtml(n.echoTargetId)}', '${escapeHtml(unit.id)}')">${escapeHtml(n.echoLabel ?? "[-> 跳转关联模块]")}</button>`
        : "";
      const calloutHtml = n.calloutBox ? `<div class="callout-box">${renderInlineMath(n.calloutBox)}</div>` : "";
      return `<div class="note-item"><div class="note-hdr">${escapeHtml(n.label)} ${echoHtml}</div><div class="note-body">${renderInlineMath(n.body)}</div>${calloutHtml}</div>`;
    })
    .join("");

  const qaThreads = annotations?.unitQaThreads?.[unit.id] ?? [];
  const qaCount = qaThreads.reduce((sum, t) => sum + 1 + (t.followUps?.length ?? 0), 0);
  const qaBadgeHtml =
    qaCount > 0 ? `<div class="qa-corner-badge">[已追问 ${qaCount} 次]</div>` : "";
  const qaDrawerHtml =
    qaCount > 0
      ? `<div class="qa-unit-drawer">
  <div class="qa-drawer-hdr">[本段 AI 追问与原文证据链]（累计追问 ${qaCount} 次）</div>
  ${qaThreads
    .map((thread) => {
      const turnCount = 1 + (thread.followUps?.length ?? 0);
      const evHtml = thread.evidences
        .map(
          (ev) =>
            `<div class="qa-ev"><b>[证据 · ${escapeHtml(ev.unitCode)}]</b> ${escapeHtml(ev.rationale)} — <i>${renderInlineMath(ev.quote)}</i></div>`
        )
        .join("");
      const followHtml = (thread.followUps ?? [])
        .map(
          (turn, idx) =>
            `<div class="qa-follow"><div><b>Q${idx + 2}:</b> ${escapeHtml(turn.question)}</div><div class="qa-ans-box">${renderInlineMath(turn.answer)}</div></div>`
        )
        .join("");
      return `<div class="qa-thread-card"><div class="qa-thread-meta"><span>[${thread.scope === "document" ? "全文跨节证据" : "本段上下文精讲"}]</span> <span>[追问 ${turnCount} 次]</span> <span>片段: “${escapeHtml(thread.selectedText)}”</span></div><div><b>Q1:</b> ${escapeHtml(thread.question)}</div><div class="qa-ans-box">${renderInlineMath(thread.answer)}</div>${evHtml}${followHtml}</div>`;
    })
    .join("")}
</div>`
      : "";

  return `<article class="dual-row weight-${unit.weight}${qaCount > 0 ? " unit-qa-dashed" : ""}" id="${escapeHtml(unit.id)}" data-weight="${unit.weight}" data-qa-count="${qaCount}">
  ${qaBadgeHtml}
  <div class="col-left">
    <div class="unit-meta">
      <span class="unit-code">${escapeHtml(unit.unitCode)}</span>
      <span class="weight-badge ${unit.weight}">${unit.weight === "core" ? "CORE 20%" : unit.weight.toUpperCase()}</span>
      <span class="tldr-chip">${renderInlineMath(unit.tldr)}</span>
    </div>
    ${primaryBlock}
    ${formulaHtml}
    ${figuresHtml}
    ${
      unit.secondaryBlockText
        ? `<div class="secondary-block">${renderInlineMath(unit.secondaryBlockText)}</div>`
        : ""
    }
    ${
      unit.transitionSummary
        ? `<div class="transition-chip"><b>${escapeHtml(transitionPrefix)}</b> ${renderInlineMath(unit.transitionSummary)}</div>`
        : ""
    }
  </div>
  <div class="col-right">
    ${notesHtml}
    <div class="user-note-wrap">
      <label>个人批注 / 随手笔记</label>
      <textarea data-unit-note="${escapeHtml(unit.id)}" placeholder="在此记录批注（保存在浏览器 localStorage）...">${escapeHtml(userNote)}</textarea>
    </div>
  </div>
  ${qaDrawerHtml}
</article>`;
}

export function compileDocumentToStandaloneHtml(
  doc: WorkbenchDocument,
  annotations?: UserAnnotationsState
): string {
  const [leftRatio, rightRatio] = doc.layoutRatio;
  const legendHtml = doc.dimensions
    .map(
      (d: DimensionSpec) =>
        `<button type="button" class="dim-pill ${d.colorSlot}" data-dim="${d.key}" onclick="toggleDimFilter('${d.key}')">${escapeHtml(d.label)}</button>`
    )
    .join("");

  let currentSec = "";
  const unitsHtmlParts: string[] = [];
  for (const unit of doc.units) {
    if (unit.sectionId !== currentSec) {
      currentSec = unit.sectionId;
      unitsHtmlParts.push(
        `<section class="section-banner" id="${escapeHtml(unit.sectionId)}"><h2>${escapeHtml(unit.sectionTitle)}</h2>${unit.sectionTask ? `<span class="sec-task">${escapeHtml(unit.sectionTask)}</span>` : ""}</section>`
      );
    }
    unitsHtmlParts.push(renderUnitHtml(unit, annotations, doc.labels.transitionPrefix));
  }

  const navLinks = [
    `<a href="#mental-model">${escapeHtml(doc.labels.mentalNavLabel)}</a>`,
    ...doc.sections.map((s) => `<a href="#${escapeHtml(s.id)}">${escapeHtml(s.navLabel)}</a>`),
    `<a href="#bottom-arsenal">${escapeHtml(doc.labels.bottomNavLabel)}</a>`,
  ].join("");

  const cardsHtml = doc.topMentalModel.cards
    .map((c) => `<div class="m-card"><div class="m-tag">${escapeHtml(c.tag)}</div><div>${renderInlineMath(c.body)}</div></div>`)
    .join("");

  const glossaryHtml = doc.topMentalModel.glossary
    .map(
      (g) =>
        `<div class="gl-row"><span class="gl-term">${escapeHtml(g.term)}</span>${g.badge ? `<span class="gl-badge">${escapeHtml(g.badge)}</span>` : ""}<span class="gl-def">${renderInlineMath(g.definition)}</span></div>`
    )
    .join("");

  const bottomHtml = doc.bottomBlocks.map((b) => renderBottomBlockHtml(doc.id, b, annotations)).join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(doc.title)} - Prism Workbench</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,500;0,600;1,400&display=swap" />
<style>
:root {
  --bg-page: #faf8f5;
  --bg-card: #ffffff;
  --bg-secondary: #f0ece2;
  --navy: #1a2744;
  --ink: #1c222d;
  --muted: #525b6c;
  --border: #ddd6c7;
  --left-fr: ${leftRatio}fr;
  --right-fr: ${rightRatio}fr;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg-page); color: var(--ink); font-family: "IBM Plex Sans", -apple-system, sans-serif; line-height: 1.65; }
.header { background: var(--navy); color: #fff; padding: 18px 28px; position: sticky; top: 0; z-index: 40; box-shadow: 0 4px 14px rgba(17,24,39,0.16); }
.header h1 { margin: 0; font-family: "Lora", serif; font-size: 21px; font-weight: 600; }
.header .sub { font-size: 13px; color: #c7d2ea; margin-top: 4px; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
.dim-pill, .ctrl-btn { border: 1px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.08); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: "IBM Plex Mono", monospace; }
.dim-pill.active, .ctrl-btn.active { background: #fff; color: var(--navy); font-weight: 600; }
.dim-pill.yellow { border-left: 4px solid #f4c430; }
.dim-pill.red { border-left: 4px solid #e05260; }
.dim-pill.blue { border-left: 4px solid #3b82f6; }
.dim-pill.green { border-left: 4px solid #22c55e; }
.dim-pill.purple { border-left: 4px solid #a855f7; }
.subnav { background: #f3efe6; border-bottom: 1px solid var(--border); padding: 8px 28px; display: flex; gap: 14px; overflow-x: auto; font-size: 12px; }
.subnav a { color: var(--navy); text-decoration: none; white-space: nowrap; font-weight: 500; }
.subnav a:hover { text-decoration: underline; }
.container { max-width: 1440px; margin: 0 auto; padding: 24px 28px 64px; }
.panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 22px; margin-bottom: 22px; }
.m-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin: 16px 0; }
.m-card { background: #fcfaf6; border: 1px solid var(--border); border-radius: 8px; padding: 14px; font-size: 14px; }
.m-tag { font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; color: var(--navy); margin-bottom: 6px; text-transform: uppercase; }
.svg-wrap { border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: #fff; overflow-x: auto; margin: 16px 0; }
.svg-node-link { cursor: pointer; }
.svg-node-link:hover rect { stroke-width: 2.8; }
.gl-row { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--border); font-size: 13px; align-items: baseline; }
.gl-term { font-weight: 600; color: var(--navy); min-width: 180px; }
.gl-badge { font-family: "IBM Plex Mono", monospace; font-size: 11px; background: #e8eef9; color: var(--navy); padding: 1px 6px; border-radius: 4px; }
.section-banner { margin: 28px 0 12px; padding: 10px 16px; border-left: 4px solid var(--navy); background: #efeae0; border-radius: 0 8px 8px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.section-banner h2 { margin: 0; font-size: 17px; color: var(--navy); font-family: "Lora", serif; }
.sec-task { font-size: 12px; color: var(--muted); font-family: "IBM Plex Mono", monospace; }
.dual-row { position: relative; display: grid; grid-template-columns: var(--left-fr) var(--right-fr); gap: 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 16px; transition: opacity .2s; }
.dual-row.unit-qa-dashed { border: 2px dashed rgba(26, 39, 68, 0.8); background: #fffdf8; }
.qa-corner-badge { position: absolute; top: -11px; right: 16px; background: #1a2744; color: #fde68a; border: 1px solid var(--border); border-radius: 999px; padding: 2px 10px; font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; }
.qa-unit-drawer { grid-column: 1 / -1; border-top: 1px dashed rgba(26, 39, 68, 0.4); padding-top: 12px; margin-top: 4px; display: flex; flex-direction: column; gap: 10px; }
.qa-drawer-hdr { font-family: "IBM Plex Mono", monospace; font-size: 12px; font-weight: 700; color: var(--navy); }
.qa-thread-card { border: 1px dashed rgba(26, 39, 68, 0.55); border-radius: 8px; padding: 12px; background: #fff; font-size: 13px; display: flex; flex-direction: column; gap: 6px; }
.qa-thread-meta { font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--muted); }
.qa-ans-box { background: #faf7f0; border: 1px solid #ede6d8; border-radius: 6px; padding: 8px 10px; line-height: 1.6; }
.qa-ev { font-size: 12px; color: #475569; border-left: 2px solid var(--navy); padding-left: 8px; }
.qa-follow { border-top: 1px dashed #d8d0bf; padding-top: 6px; margin-top: 4px; }
body.pareto-on .dual-row:not(.weight-core) { display: none; }
body.hide-secondary .secondary-block { display: none; }
body.hide-notes .col-right { display: none; }
body.hide-notes .dual-row { grid-template-columns: 1fr; }
.unit-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
.unit-code { font-family: "IBM Plex Mono", monospace; font-size: 12px; font-weight: 600; color: var(--navy); }
.weight-badge { font-family: "IBM Plex Mono", monospace; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #eee; color: #333; }
.weight-badge.core { background: #1a2744; color: #fff; }
.tldr-chip { font-size: 13px; color: var(--muted); }
.prose-box { font-family: "Lora", Georgia, serif; font-size: 16px; line-height: 1.75; white-space: pre-wrap; }
.code-box { background: #181e29; color: #e6edf3; padding: 14px; border-radius: 8px; overflow-x: auto; font-family: "IBM Plex Mono", monospace; font-size: 12.5px; line-height: 1.55; margin: 0; }
.secondary-block { margin-top: 12px; padding: 12px 14px; background: var(--bg-secondary); border-left: 3px solid #8c7a6b; border-radius: 0 6px 6px 0; font-size: 14px; }
.formula-box { margin-top: 10px; padding: 10px 14px; background: #f8fafc; border: 1px solid #dce5f2; border-radius: 8px; overflow-x: auto; }
.flow-chip { font-family: "IBM Plex Mono", monospace; font-size: 12px; color: var(--navy); margin-top: 4px; }
.transition-chip { margin-top: 10px; font-size: 12.5px; color: #475569; padding: 6px 10px; background: #f8fafc; border-radius: 6px; }
.col-right { border-left: 1px solid var(--border); padding-left: 16px; display: flex; flex-direction: column; gap: 10px; }
.note-item { font-size: 13.5px; padding-bottom: 8px; border-bottom: 1px dashed #ebe5d8; }
.note-hdr { font-family: "IBM Plex Mono", monospace; font-size: 11.5px; font-weight: 600; color: var(--navy); margin-bottom: 4px; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.echo-btn { border: 1px solid #93c5fd; background: #eff6ff; color: #1d4ed8; font-size: 11px; padding: 1px 6px; border-radius: 4px; cursor: pointer; font-family: "IBM Plex Mono", monospace; }
.callout-box { margin-top: 6px; padding: 8px 10px; background: #fff7ed; border-left: 3px solid #d97706; font-size: 12.5px; }
.user-note-wrap textarea, .journal-item textarea, [data-diff] { width: 100%; min-height: 68px; border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-family: inherit; font-size: 13px; background: #fcfbf8; }
.hl { border-radius: 3px; padding: 0 2px; transition: opacity .15s; }
.hl.dim1 { background: rgba(250, 204, 21, 0.34); }
.hl.dim2 { background: rgba(244, 63, 94, 0.22); border-bottom: 1.5px dashed #e11d48; }
.hl.dim3 { background: rgba(59, 130, 246, 0.22); }
.hl.dim4 { background: rgba(34, 197, 94, 0.22); }
.hl.dim5 { background: rgba(168, 85, 247, 0.22); }
body[data-filter-dim] .hl:not(.match-filter) { background: transparent !important; border-bottom: none !important; opacity: 0.55; }
.bottom-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 14px; }
.banner-box { background: #1a2744; color: #fff; padding: 16px 20px; border-radius: 10px; margin-bottom: 14px; }
.banner-tag { font-family: "IBM Plex Mono", monospace; font-size: 11px; color: #93c5fd; display: block; margin-bottom: 4px; }
.qa-item { border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
.qa-item summary { cursor: pointer; font-weight: 600; font-size: 14px; }
.qa-ans { margin-top: 8px; font-size: 13.5px; color: var(--muted); }
.diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; }
.diff-lbl { font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.chk-item { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; font-size: 13.5px; }
.bp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.bp-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: #fcfaf6; font-size: 13px; }
.bp-head { display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--navy); }
#tooltip { position: fixed; display: none; max-width: 320px; background: #111827; color: #fff; padding: 8px 11px; border-radius: 6px; font-size: 12px; z-index: 99; pointer-events: none; box-shadow: 0 8px 20px rgba(0,0,0,0.28); }
#back-jump { position: fixed; right: 24px; bottom: 24px; display: none; background: var(--navy); color: #fff; border: none; padding: 10px 14px; border-radius: 999px; cursor: pointer; font-family: "IBM Plex Mono", monospace; font-size: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.24); z-index: 80; }
@media (max-width: 960px) { .dual-row, .diff-grid { grid-template-columns: 1fr; } .col-right { border-left: none; border-top: 1px solid var(--border); padding-left: 0; padding-top: 12px; } }
</style>
</head>
<body>
<header class="header">
  <h1>${escapeHtml(doc.title)}</h1>
  <div class="sub">${escapeHtml(doc.subtitle)}</div>
  <div class="controls">
    ${legendHtml}
    <button type="button" class="ctrl-btn" onclick="document.body.classList.toggle('pareto-on'); this.classList.toggle('active')">${escapeHtml(doc.labels.paretoButton)}</button>
    <button type="button" class="ctrl-btn" onclick="document.body.classList.toggle('hide-secondary'); this.classList.toggle('active')">${escapeHtml(doc.labels.toggleSecondaryButton)}</button>
    <button type="button" class="ctrl-btn" onclick="document.body.classList.toggle('hide-notes'); this.classList.toggle('active')">${escapeHtml(doc.labels.toggleNotesButton)}</button>
  </div>
</header>
<nav class="subnav">${navLinks}</nav>
<main class="container">
  <section class="panel" id="mental-model">
    <h2>${escapeHtml(doc.topMentalModel.title)}</h2>
    <p>${escapeHtml(doc.topMentalModel.subtitle)}</p>
    ${doc.topMentalModel.rawSummaryBanner ? `<div class="banner-box"><span class="banner-tag">${escapeHtml(doc.topMentalModel.rawSummaryBanner.tag)}</span><div>${renderInlineMath(doc.topMentalModel.rawSummaryBanner.body)}</div></div>` : ""}
    <div class="m-grid">${cardsHtml}</div>
    <div class="svg-wrap">
      <h3>${escapeHtml(doc.topMentalModel.diagram.title)}</h3>
      <p style="font-size:12.5px;color:#525b6c">${escapeHtml(doc.topMentalModel.diagram.hint)}</p>
      ${renderDiagramSvg(doc)}
    </div>
    <h3>${escapeHtml(doc.topMentalModel.glossaryTitle)}</h3>
    <div>${glossaryHtml}</div>
  </section>

  ${unitsHtmlParts.join("\n")}

  <section id="bottom-arsenal">
    <div class="section-banner"><h2>${escapeHtml(doc.bottomTitle)}</h2>${doc.bottomSubtitle ? `<span class="sec-task">${escapeHtml(doc.bottomSubtitle)}</span>` : ""}</div>
    ${bottomHtml}
  </section>
</main>
<div id="tooltip"></div>
<button type="button" id="back-jump" onclick="returnToOrigin()">[<- 返回原阅读位置]</button>
<script>
const STORAGE_KEY = "prism_standalone_" + ${JSON.stringify(doc.id)};
let lastOriginId = null;

function jumpToUnit(targetId, fromId) {
  if (fromId) {
    lastOriginId = fromId;
    document.getElementById("back-jump").style.display = "block";
  }
  const el = document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.outline = "2px solid #2563eb";
    setTimeout(() => { el.style.outline = ""; }, 1800);
  }
}

function returnToOrigin() {
  if (!lastOriginId) return;
  const el = document.getElementById(lastOriginId);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("back-jump").style.display = "none";
  lastOriginId = null;
}

function toggleDimFilter(dimKey) {
  const current = document.body.getAttribute("data-filter-dim");
  document.querySelectorAll(".dim-pill").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".hl").forEach(s => s.classList.remove("match-filter"));
  if (current === dimKey) {
    document.body.removeAttribute("data-filter-dim");
    return;
  }
  document.body.setAttribute("data-filter-dim", dimKey);
  const pill = document.querySelector('.dim-pill[data-dim="' + dimKey + '"]');
  if (pill) pill.classList.add("active");
  document.querySelectorAll('.hl.' + dimKey).forEach(s => s.classList.add("match-filter"));
}

const tipEl = document.getElementById("tooltip");
document.addEventListener("mousemove", (e) => {
  const target = e.target.closest("[data-tip]");
  if (!target) { tipEl.style.display = "none"; return; }
  tipEl.textContent = target.getAttribute("data-tip");
  tipEl.style.display = "block";
  const x = Math.min(window.innerWidth - 340, e.clientX + 14);
  const y = Math.min(window.innerHeight - 110, e.clientY + 14);
  tipEl.style.left = Math.max(10, x) + "px";
  tipEl.style.top = Math.max(10, y) + "px";
});

(function initPersistence() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    document.querySelectorAll("[data-unit-note]").forEach(el => {
      const id = el.getAttribute("data-unit-note");
      if (saved.unitNotes && saved.unitNotes[id] !== undefined) el.value = saved.unitNotes[id];
      el.addEventListener("input", () => {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        state.unitNotes = state.unitNotes || {};
        state.unitNotes[id] = el.value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      });
    });
    document.querySelectorAll("[data-journal-id]").forEach(el => {
      const id = el.getAttribute("data-journal-id");
      if (saved.journalAnswers && saved.journalAnswers[id] !== undefined) el.value = saved.journalAnswers[id];
      el.addEventListener("input", () => {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        state.journalAnswers = state.journalAnswers || {};
        state.journalAnswers[id] = el.value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      });
    });
    document.querySelectorAll("[data-check-id]").forEach(el => {
      const id = el.getAttribute("data-check-id");
      if (saved.checklistStates && saved.checklistStates[id] !== undefined) el.checked = saved.checklistStates[id];
      el.addEventListener("change", () => {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        state.checklistStates = state.checklistStates || {};
        state.checklistStates[id] = el.checked;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      });
    });
  } catch {}
})();
</script>
</body>
</html>`;
}
