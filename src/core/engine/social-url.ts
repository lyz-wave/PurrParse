export type SocialPlatform =
  | "bilibili"
  | "douyin"
  | "x"
  | "youtube"
  | "xiaohongshu"
  | "tiktok"
  | "web";

export interface ExtractedShareLink {
  url: string;
  sharePrefixText: string;
  platform: SocialPlatform;
}

export function detectSocialPlatform(rawUrl: string): SocialPlatform {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (/(?:^|\.)(?:bilibili\.com|b23\.tv|acg\.tv)$/i.test(host)) return "bilibili";
    if (/(?:^|\.)(?:douyin\.com|iesdouyin\.com)$/i.test(host)) return "douyin";
    if (/(?:^|\.)(?:x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com|fixupx\.com)$/i.test(host)) {
      return "x";
    }
    if (/(?:^|\.)(?:youtube\.com|youtu\.be)$/i.test(host)) return "youtube";
    if (/(?:^|\.)(?:xiaohongshu\.com|xhslink\.com)$/i.test(host)) return "xiaohongshu";
    if (/(?:^|\.)(?:tiktok\.com|vm\.tiktok\.com)$/i.test(host)) return "tiktok";
  } catch {
    // ignore invalid URL
  }
  return "web";
}

/**
 * Extracts a normalized URL from plain URLs or social share copy-text
 * (e.g. Douyin / Bilibili / Xiaohongshu mobile share strings) and identifies the platform.
 */
export function extractUrlFromShareText(raw: string): ExtractedShareLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Support bare Bilibili BV ID directly
  const bareBv = trimmed.match(/^(BV[0-9A-Za-z]{10})$/);
  if (bareBv) {
    return {
      url: `https://www.bilibili.com/video/${bareBv[1]}`,
      sharePrefixText: "",
      platform: "bilibili",
    };
  }

  const urlMatch = trimmed.match(/https?:\/\/[^\s"'<>\]）)】]+/i);
  if (!urlMatch) return null;

  const cleanedUrl = urlMatch[0].replace(/[.,;!?，。；！？]+$/, "");
  try {
    new URL(cleanedUrl);
  } catch {
    return null;
  }

  const prefixText = trimmed.replace(urlMatch[0], " ").replace(/\s+/g, " ").trim();
  return {
    url: cleanedUrl,
    sharePrefixText: prefixText,
    platform: detectSocialPlatform(cleanedUrl),
  };
}
