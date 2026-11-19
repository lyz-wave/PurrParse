import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeHtmlEntities,
  detectSocialPlatform,
  extractUrlFromShareText,
  fetchCleanWebPage,
  parseArxivIdentifier,
  registerVideoTranscriber,
} from "./web-fetchers";
import {
  formatV2tResultToSections,
  parseLenientJson,
  parseSrtOrVttSegments,
  runVideoToTextBridge,
} from "./v2t-bridge";

describe("Web Fetchers & arXiv ID Parsing", () => {
  it("parses bare arXiv IDs, versioned IDs, and arXiv URLs accurately", () => {
    expect(parseArxivIdentifier("1706.03762")).toBe("1706.03762");
    expect(parseArxivIdentifier("arXiv:2106.09685v2")).toBe("2106.09685v2");
    expect(parseArxivIdentifier("https://arxiv.org/abs/1706.03762")).toBe("1706.03762");
    expect(parseArxivIdentifier("https://arxiv.org/pdf/2106.09685.pdf")).toBe("2106.09685");
    expect(parseArxivIdentifier("https://github.com/ai/nanoid")).toBeNull();
    expect(parseArxivIdentifier("Attention Is All You Need")).toBeNull();
  });

  it("decodes common HTML entities cleanly", () => {
    expect(decodeHtmlEntities("A &amp; B &lt;tag&gt; &quot;quoted&quot; &#39;ok&#39;")).toBe(
      `A & B <tag> "quoted" 'ok'`
    );
  });

  it("extracts Bilibili, Douyin share copy-text, and X/Twitter links cleanly", () => {
    const dy = extractUrlFromShareText(
      "6.84 复制打开抖音，看看【如何一天重构生活】完整讲解 https://v.douyin.com/iYabcd12/ o@q.rx"
    );
    expect(dy?.platform).toBe("douyin");
    expect(dy?.url).toBe("https://v.douyin.com/iYabcd12/");
    expect(dy?.sharePrefixText).toContain("如何一天重构生活");

    const bili = extractUrlFromShareText("https://www.bilibili.com/video/BV1GJ411x7h7/?p=1");
    expect(bili?.platform).toBe("bilibili");
    expect(bili?.url).toContain("BV1GJ411x7h7");

    const bareBv = extractUrlFromShareText("BV1xx411c7mD");
    expect(bareBv?.platform).toBe("bilibili");
    expect(bareBv?.url).toBe("https://www.bilibili.com/video/BV1xx411c7mD");

    const xPost = extractUrlFromShareText("https://x.com/karpathy/status/1850000000000");
    expect(xPost?.platform).toBe("x");
    expect(detectSocialPlatform("https://twitter.com/user/status/123")).toBe("x");
    expect(detectSocialPlatform("https://b23.tv/abc123")).toBe("bilibili");
    expect(detectSocialPlatform("https://paulgraham.com/makersschedule.html")).toBe("web");
  });

  afterEach(() => {
    registerVideoTranscriber(null);
    vi.unstubAllGlobals();
  });

  it("extracts Douyin VideoObject JSON-LD metadata, filters chatter comments, and enriches full-text companion transcripts", async () => {
    const shareString =
      "8.20 复制打开抖音，看看【Vicky\u2764\uFE0FEileen的作品】谷爱凌做客Jay Shetty播客完整版 https://v.douyin.com/t-_pDJCeWfI/ :2pm";

    const botJsonLd = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: "谷爱凌做客Jay Shetty播客完整版\n全篇一个小时，可以收藏慢慢品 - 抖音",
      description: "谷爱凌做客Jay Shetty播客完整版，探讨心理边界与自我成长。",
      duration: "PT0H59M25S",
      thumbnailUrl: ["https://cdn.example.com/eileen-cover.jpg"],
      creator: { name: "Vicky\u2764\uFE0FEileen" },
      comment: [
        {
          text: "@豆包 帮我总结一下",
          creator: { name: "路人甲" },
          interactionStatistic: { userInteractionCount: 1 },
        },
        {
          text: "请问爱凌姐姐的访谈都在哪里可以找到 我不想再看抖音小片段了",
          creator: { name: "观众乙" },
          interactionStatistic: { userInteractionCount: 12 },
        },
        {
          text: "居然把一个小时的采访的中英文都整理出来了，你太棒了，辛苦了！谢谢",
          creator: { name: "观众丙" },
          interactionStatistic: { userInteractionCount: 9 },
        },
        {
          text: "她以课题分离为核心的心力系统：1. 先区分可控与不可控；2. 用长期自我反馈代替外部噪声评价；3. 在高压赛场保持专注切换。",
          creator: { name: "舟舟在自律" },
          interactionStatistic: { userInteractionCount: 186 },
        },
      ],
    };

    const relevantArticleHtml = `
      <p>在 Jay Shetty 的深度长谈播客中，谷爱凌首次系统拆解了自己面对网暴、伤病与奥运高压时的底层心智模型。她坦言自己习惯像工程师一样把大脑拆分成事实层、情绪层与行动层。</p>
      <p>谈及赛场失利后的心态重建，谷爱凌强调“用证据而不是用肯定来建立自信”，即每天通过训练录像、心率记录与可量化复盘积累客观依据，而不是靠空洞的自我催眠。</p>
      <p>此外，她还分享了在斯坦福求学与滑雪备战之间进行高强度注意力和精力切换的日常节律：在单一时段内只服务于一个高杠杆目标，把外部评论视作与己无关的背景噪声。</p>
    `;

    const unrelatedArticleHtml = `
      <p>某热门影视剧昨晚大结局引发观众广泛讨论，主演在采访中表示未来将继续挑战悬疑题材角色与舞台剧演出。</p>
      <p>不少剧迷留言称剧情反转紧凑，期待原班人马明年开启第二季拍摄工作。</p>
    `;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const uaHeader =
        (init?.headers as Record<string, string> | undefined)?.["User-Agent"] ?? "";

      if (url.startsWith("https://v.douyin.com/")) {
        return {
          ok: true,
          url: "https://www.iesdouyin.com/share/video/7688216226523796197/",
          text: async () => "",
        } as unknown as Response;
      }

      if (url.includes("iesdouyin.com/share/video/") && uaHeader.includes("Googlebot")) {
        return {
          ok: true,
          url,
          text: async () =>
            `<html><head><script type="application/ld+json">${JSON.stringify(
              botJsonLd
            )}</script></head><body></body></html>`,
        } as unknown as Response;
      }

      if (url.startsWith("https://so.toutiao.com/search")) {
        return {
          ok: true,
          url,
          text: async () =>
            `<html><script>window.__INITIAL__={"items":[{"item_id":"7687499127390798376"},{"item_id":"7690093289340518975"}]};</script></html>`,
        } as unknown as Response;
      }

      if (url === "https://m.toutiao.com/i7687499127390798376/info/") {
        return {
          ok: true,
          url,
          json: async () => ({
            success: true,
            data: {
              title: "谷爱凌做客Jay Shetty播客万字实录：像工程师一样拆解大脑与自信机制",
              source: "深度人物访谈集",
              content: relevantArticleHtml,
            },
          }),
        } as unknown as Response;
      }

      if (url === "https://m.toutiao.com/i7690093289340518975/info/") {
        return {
          ok: true,
          url,
          json: async () => ({
            success: true,
            data: {
              title: "某热门影视剧昨夜收官 主演谈后续规划",
              source: "娱乐快报",
              content: unrelatedArticleHtml,
            },
          }),
        } as unknown as Response;
      }

      // iPhone mobile UA returns empty _ROUTER_DATA loader without videoInfoRes
      return {
        ok: true,
        url,
        text: async () =>
          `<html><script>window._ROUTER_DATA = {"loaderData":{"video_(id)/page":{}}}</script></html>`,
      } as unknown as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    const page = await fetchCleanWebPage(shareString);
    expect(page.finalUrl).toContain("7688216226523796197");
    expect(page.title).toContain("谷爱凌做客Jay Shetty播客完整版");
    expect(page.text).toContain("59分25秒");
    expect(page.text).toContain("@Vicky\u2764\uFE0FEileen");
    expect(page.text).toContain("[[PRISM_FIGURE:");
    expect(page.text).toContain("视频正片核心内容深度还原（1）：谷爱凌做客Jay Shetty播客万字实录");
    expect(page.text).toContain("用证据而不是用肯定来建立自信");
    expect(page.text).not.toContain("某热门影视剧昨夜收官");
    expect(page.text).toContain("186赞 @舟舟在自律");
    expect(page.text).toContain("（1）先区分可控与不可控");
    expect(page.text).not.toContain("@豆包");
    expect(page.text).not.toContain("请问爱凌姐姐的访谈都在哪里可以找到");
    expect(page.text).not.toContain("辛苦了！谢谢");
    expect(page.text).not.toContain("分享口令中的作品标题与标签");
  });

  it("uses registered video-to-text transcriber and formats ASR segments & chapters cleanly", async () => {
    expect(detectSocialPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(detectSocialPlatform("https://xhslink.com/a/abc123")).toBe("xiaohongshu");

    const sections = formatV2tResultToSections(
      {
        source: { title: "测试视频", platform: "douyin", id: "123" },
        pageText: "章节要点\n00:00\n底层逻辑\n04:10\n实战步骤",
        segments: [
          { start: 0, end: 5, text: "快速掌握一门语言不是天赋而是一项技能" },
          { start: 5, end: 12, text: "你掌握共通的底层逻辑后思路都会非常清晰" },
        ],
      },
      2
    );

    expect(sections[0]).toContain("# 2. 视频自带章节要点");
    expect(sections[0]).toContain("[00:00] 底层逻辑");
    expect(sections[1]).toContain("# 3. 视频语音转写正文（本地 ASR 逐段实录）");
    expect(sections[1]).toContain("[00:00] 快速掌握一门语言不是天赋而是一项技能");

    registerVideoTranscriber(async () => ({
      title: "东云老师语言学习指南",
      sections,
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.startsWith("https://v.douyin.com/")) {
          return {
            ok: true,
            url: "https://www.iesdouyin.com/share/video/7708195303711133082/",
            text: async () => "",
          } as unknown as Response;
        }
        return {
          ok: true,
          url,
          text: async () => "<html><body></body></html>",
        } as unknown as Response;
      })
    );

    const page = await fetchCleanWebPage("https://v.douyin.com/d-RkwR6xPKM/");
    expect(page.title).toBe("东云老师语言学习指南");
    expect(page.text).toContain("快速掌握一门语言不是天赋而是一项技能");
    expect(page.text).not.toContain("未公开字幕");
  });

  it("recovers v2t transcript.json containing Python NaN/Infinity tokens and supports SRT fallback", async () => {
    const parsed = parseLenientJson<{ segments: Array<{ avg_logprob: number | null; text: string }> }>(
      `{"segments":[{"id":1,"avg_logprob":NaN,"compression_ratio":Infinity,"text":"NaN inside quotes stays NaN"},{"id":2,"avg_logprob":-Infinity,"text":"Infinity check"}]}`
    );
    expect(parsed.segments[0].avg_logprob).toBeNull();
    expect(parsed.segments[0].text).toBe("NaN inside quotes stays NaN");
    expect(parsed.segments[1].avg_logprob).toBeNull();

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "purrparse-v2t-test-"));
    const prevCacheDir = process.env.PURRPARSE_CACHE_DIR;
    try {
      process.env.PURRPARSE_CACHE_DIR = tmpRoot;
      const cacheKey = "douyin-nan-test";
      const workDir = path.join(tmpRoot, cacheKey);
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(
        path.join(workDir, "source.json"),
        JSON.stringify({ title: "Eileen Gu Interview", platform: "douyin", id: "1" })
      );
      fs.writeFileSync(
        path.join(workDir, "transcript.json"),
        `{"segments":[{"id":0,"start":0,"end":4,"avg_logprob":NaN,"text":"Aileen Gu, welcome to On Purpose"},{"id":1,"start":4,"end":8,"avg_logprob":-0.2,"text":"Thank you for having me, Jay"}]}`
      );

      const bridgeRes = await runVideoToTextBridge("https://www.douyin.com/video/1", cacheKey, "zh");
      expect(bridgeRes).not.toBeNull();
      expect(bridgeRes?.segments.length).toBe(2);
      const englishSections = formatV2tResultToSections(bridgeRes!, 2);
      expect(englishSections[0]).toContain("[00:00] Aileen Gu, welcome to On Purpose Thank you for having me, Jay.");
      expect(englishSections[0]).not.toContain("，Thank");

      // Also verify SRT fallback when transcript.json is malformed
      const srtKey = "douyin-srt-fallback";
      const srtDir = path.join(tmpRoot, srtKey);
      fs.mkdirSync(srtDir, { recursive: true });
      fs.writeFileSync(path.join(srtDir, "transcript.json"), "{not-valid-json");
      fs.writeFileSync(
        path.join(srtDir, "transcript.srt"),
        "1\n00:00:01,000 --> 00:00:05,200\nFirst spoken line\n\n2\n00:00:05,200 --> 00:00:09,000\nSecond spoken line\n"
      );
      const srtSegments = parseSrtOrVttSegments(
        fs.readFileSync(path.join(srtDir, "transcript.srt"), "utf8")
      );
      expect(srtSegments).toHaveLength(2);
      const srtRes = await runVideoToTextBridge("https://www.douyin.com/video/2", srtKey, "zh");
      expect(srtRes?.segments.map((s) => s.text)).toEqual([
        "First spoken line",
        "Second spoken line",
      ]);
    } finally {
      if (prevCacheDir === undefined) {
        delete process.env.PURRPARSE_CACHE_DIR;
      } else {
        process.env.PURRPARSE_CACHE_DIR = prevCacheDir;
      }
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
