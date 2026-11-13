import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, parseArxivIdentifier } from "./web-fetchers";

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
});
