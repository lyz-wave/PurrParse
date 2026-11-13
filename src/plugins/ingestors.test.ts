import { describe, expect, it } from "vitest";
import { parsePaperTextIntoUnits } from "./academic-paper/pdf-ingestor";
import { aggregateThoughtClusters, cleanTranscriptLines } from "./cognitive-essay/transcript-ingestor";
import {
  ingestRepoSource,
  parseGitHubUrl,
  parsePastedRepoText,
  selectCoreRepoFiles,
  sliceCodeFileIntoUnits,
} from "./repo-deconstruct/git-ingestor";

describe("Mode 1 · Academic Paper Ingestor", () => {
  it("extracts section headings and LaTeX formulas accurately", () => {
    const sample = `Abstract

We propose a simple network architecture based solely on attention mechanisms.

1. Introduction

Self-attention relates different positions of a single sequence in order to compute a representation:
$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V
$$
This avoids recurrence completely.`;

    const units = parsePaperTextIntoUnits(sample);
    expect(units.length).toBeGreaterThanOrEqual(2);
    expect(units[0].sectionId).toBe("sec-abstract");
    expect(units[1].sectionId).toBe("sec-1");
    expect(units[1].metadata?.formulas?.length).toBe(1);
    expect(units[1].metadata?.formulas?.[0]).toContain("softmax");
  });

  it("splits single-newline PDF extracted text into multiple sections and paragraphs", () => {
    const singleNewlinePdfText = [
      "LORA: LOW-RANK ADAPTATION OF LARGE MODELS",
      "ABSTRACT",
      "Full fine-tuning of large language models is prohibitively expensive because it retrains every",
      "parameter across hundreds of billions of weights for every downstream task.",
      "We propose LoRA to freeze pretrained weights and inject trainable rank decomposition matrices.",
      "1 INTRODUCTION",
      "Many applications in natural language processing rely on adapting one large pretrained model",
      "to multiple downstream tasks while keeping serving latency low in production clusters.",
      "2 PROBLEM STATEMENT",
      "We hypothesize that updates during adaptation possess a low intrinsic rank even at 175B scale.",
    ].join("\n");

    const units = parsePaperTextIntoUnits(singleNewlinePdfText);
    expect(units.length).toBe(4);
    expect(Array.from(new Set(units.map((u) => u.sectionId)))).toEqual(["sec-abstract", "sec-1", "sec-2"]);
    expect(units[1].rawPrimaryText).toContain("Full fine-tuning");
  });

  it("ignores metric lines like '175 billion trainable parameters.1' and splits glued headings like '1 INTRODUCTIONPretrained'", () => {
    const noisyLoRaText = [
      "ABSTRACT",
      "Deploying GPT-3 with 175 billion trainable parameters is costly.",
      "175 billion trainable parameters.1",
      "1 INTRODUCTIONPretrained language models dominate NLP tasks across domains.",
      "2 METHODOLOGY",
      "We inject rank-decomposition matrices into each layer.",
    ].join("\n");

    const units = parsePaperTextIntoUnits(noisyLoRaText);
    const sectionIds = Array.from(new Set(units.map((u) => u.sectionId)));
    expect(sectionIds).not.toContain("sec-175");
    expect(sectionIds).toContain("sec-1");
    expect(sectionIds).toContain("sec-2");
    const sec1Text = units.find((u) => u.sectionId === "sec-1")?.rawPrimaryText ?? "";
    expect(sec1Text).toContain("Pretrained language models dominate NLP tasks");
  });

  it("strips author/email/footnote boilerplate, compacts formulas with colon lead-ins, keeps decimals intact, and decodes figure/table markers", () => {
    const figB64 = Buffer.from(
      JSON.stringify({
        caption: "Figure 1: The Transformer - model architecture.",
        imageUrls: ["https://arxiv.org/html/1706.03762v7/Figures/ModalNet-21.png"],
      }),
      "utf8"
    ).toString("base64");
    const tblB64 = Buffer.from(
      JSON.stringify({
        caption: "Table 1: Complexity comparison.",
        headers: ["Layer Type", "Complexity"],
        rows: [["Self-Attention", "O(n^2 d)"]],
      }),
      "utf8"
    ).toString("base64");

    const dirtyPaper = [
      "Content selection saved. Describe the issue below:",
      "arXiv is now an independent nonprofit! Learn more",
      "Illia Polosukhin 1 1 footnotemark: 1",
      "Email: lukaszkaiser@google.com",
      "† † thanks: Work performed while at Google Research.",
      "Abstract",
      `We trained the base Transformer for 3.5 days on eight GPUs across standard WMT 2014 English-to-German benchmarks and achieved strong BLEU results without recurrence or convolution. ${"Extra training detail for long sentence boundary check. ".repeat(14)}`,
      "3 Model Architecture",
      `[[PRISM_FIGURE:${figB64}]]`,
      "In this work, we compute scaled dot-product attention as follows:",
      "$$\\mathrm{Attention}(Q,K,V)=\\mathrm{softmax}(\\frac{QK^T}{\\sqrt{d_k}})V$$",
      "where Q and K are packed into matrices of dimension d_k.",
      `[[PRISM_TABLE:${tblB64}]]`,
      "As shown in the table above, self-attention connects all positions with O(1) sequential operations across layers while remaining highly parallelizable.",
    ].join("\n\n");

    const units = parsePaperTextIntoUnits(dirtyPaper);
    const joined = units.map((u) => u.rawPrimaryText).join("\n");
    expect(joined).not.toContain("lukaszkaiser");
    expect(joined).not.toContain("footnotemark");
    expect(joined).not.toContain("Content selection saved");
    expect(units.some((u) => u.rawPrimaryText.includes("3.5 days"))).toBe(true);

    const attnUnit = units.find((u) => u.rawPrimaryText.includes("scaled dot-product attention"));
    expect(attnUnit).toBeDefined();
    expect(attnUnit?.rawPrimaryText).toContain("where Q and K");
    expect(attnUnit?.metadata?.formulas?.length).toBeGreaterThanOrEqual(1);
    expect(attnUnit?.metadata?.figures?.[0]?.imageUrls?.[0]).toContain("ModalNet-21.png");

    const tblUnit = units.find((u) => u.metadata?.dataTable);
    expect(tblUnit?.metadata?.dataTable?.headers).toEqual(["Layer Type", "Complexity"]);
  });
});

describe("Mode 2 · Cognitive Essay & Transcript Ingestor", () => {
  it("strips SRT/VTT timecodes, stage cues, and filler words", () => {
    const rawSrt = `WEBVTT

1
00:00:01,000 --> 00:00:04,500
[Music] Um, people stay stuck because they optimize for comfort.

2
00:00:05,000 --> 00:00:09,200
Uh, cybernetics shows how identity regulates behavior.`;

    const lines = cleanTranscriptLines(rawSrt);
    const joined = lines.join(" ");
    expect(joined).not.toContain("-->");
    expect(joined).not.toContain("[Music]");
    expect(joined).not.toContain("WEBVTT");
    expect(joined).toContain("cybernetics shows how identity regulates behavior");
  });

  it("aggregates one-sentence Dan Koe style lines into cohesive Thought Clusters", () => {
    const lines = Array.from({ length: 18 }, (_, i) =>
      `Sentence ${i + 1}: Your identity quietly enforces an invisible thermostat over every habit you keep daily.`
    ).join("\n\n");

    const units = aggregateThoughtClusters(lines);
    expect(units.length).toBeGreaterThanOrEqual(1);
    expect(units.length).toBeLessThan(8);
    expect(units[0].primaryKind).toBe("prose");
  });

  it("splits Chinese articles with single newlines or no newlines into multiple units", () => {
    const singleNewlineZh = [
      "很多人以为自律靠的是每天强迫自己早起，但心理控制论指出人类行为其实受控于潜意识里的恒温器。",
      "每当你试图做出超越旧身份的高难度行动时，内在焦虑系统就会启动并把你拉回熟悉的安全区。",
      "这也是为什么绝大多数只做表面计划的人会在第三天彻底放弃，因为他们没有改写底层的目标设定。",
      "真正有效的一日重启必须先通过反愿景写作看清五年后如果不改变会陷入怎样的生活停滞。",
      "接着在白天用高频的自我觉察提问打断自动驾驶模式，把模糊的焦虑转译为清晰可执行的实验动作。",
      "最后在晚间完成最小可验证反馈闭环，让新的行为证据逐步覆盖掉旧的自我认知。",
    ].join("\n");

    const unitsSingle = aggregateThoughtClusters(singleNewlineZh);
    expect(unitsSingle.length).toBeGreaterThanOrEqual(2);

    const wallZh = Array.from(
      { length: 12 },
      (_, i) => `第${i + 1}条核心认知原则说明：当你把注意力从短期的情绪安慰转移到长期的系统反馈上时，行动的阻力会自然下降。`
    ).join("");
    const unitsWall = aggregateThoughtClusters(wallZh);
    expect(unitsWall.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves single-newline paragraphs in academic mode for pasted Chinese essays", () => {
    const zhPaper = [
      "引言",
      "当前大语言模型在长文本推理过程中面临显存带宽与二次方计算复杂度的双重挑战。",
      "为解决上述瓶颈，本文提出了一种面向稀疏注意力的动态分块重计算框架。",
      "实验结果表明，该方法在保持推理精度的前提下显著降低了端到端首字延迟。",
    ].join("\n");

    const units = parsePaperTextIntoUnits(zhPaper);
    expect(units.length).toBe(3);
  });
});

describe("Mode 3 · Repo 20/80 Filter & Code Slicer", () => {
  it("parses full GitHub URLs and owner/repo shorthand", () => {
    expect(parseGitHubUrl("https://github.com/vercel/ai/tree/main/packages/core")).toEqual({
      owner: "vercel",
      repo: "ai",
      branch: "main",
      subPath: "packages/core",
    });
    expect(parseGitHubUrl("redis/go-redis")).toEqual({
      owner: "redis",
      repo: "go-redis",
    });
  });

  it("excludes tests, lockfiles, and build artifacts while keeping core engine files", () => {
    const files = [
      { path: "node_modules/pkg/index.js", size: 5000 },
      { path: "pnpm-lock.yaml", size: 90000 },
      { path: "src/scheduler/engine_test.go", size: 3000 },
      { path: "internal/scheduler/engine.go", size: 4200 },
      { path: "internal/store/poll_due.lua", size: 1200 },
      { path: "README.md", size: 2000 },
    ];
    const selected = selectCoreRepoFiles(files, 5);
    const paths = selected.map((f) => f.path);
    expect(paths).toContain("internal/scheduler/engine.go");
    expect(paths).toContain("internal/store/poll_due.lua");
    expect(paths).not.toContain("pnpm-lock.yaml");
    expect(paths).not.toContain("node_modules/pkg/index.js");
    expect(paths).not.toContain("src/scheduler/engine_test.go");
  });

  it("parses pasted multi-file markers and slices into code SourceUnits", async () => {
    const pasted = `// FILE: internal/worker/pool.go
package worker

func Dispatch() {
  println("ok")
}

// FILE: internal/store/poll.lua
local x = redis.call("GET", KEYS[1])
return x`;

    const parsedFiles = parsePastedRepoText(pasted);
    expect(parsedFiles.map((f) => f.path)).toEqual([
      "internal/worker/pool.go",
      "internal/store/poll.lua",
    ]);

    const sliced = sliceCodeFileIntoUnits("internal/worker/pool.go", parsedFiles[0].content, 1);
    expect(sliced[0].primaryKind).toBe("code");
    expect(sliced[0].codeLanguage).toBe("go");

    const units = await ingestRepoSource({ kind: "text", content: pasted });
    expect(units.length).toBe(2);
  });
});
