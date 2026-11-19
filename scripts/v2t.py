#!/usr/bin/env python3
"""v2t — 视频链接 -> 正文（转写 + 带时间戳的 Markdown）。

平台：抖音 / B站 / YouTube / 小红书 / TikTok / 任意 yt-dlp 站点
流程：resolve -> grab(audio) -> ffmpeg wav -> ASR -> 分段 Markdown

用法：
  v2t.py run  "<粘贴的链接>" -o /path/out.md --lang zh
  v2t.py grab "<链接>" -o /path/dir            # 只下载音频 + source.json + page.txt
  v2t.py asr  /path/dir                        # 只转写（可 --max-sec 60 做冒烟测试）
  v2t.py md   /path/dir -o /path/out.md        # 只重新拼 Markdown
"""

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36")
MOBILE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
             "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
DEFAULT_MLX = "mlx-community/whisper-large-v3-turbo"
TICK = chr(96)  # backtick


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def sh(cmd):
    log("$", " ".join(str(c) for c in cmd))
    return subprocess.run(cmd, check=True)


# ---------------------------------------------------------------- resolve
def resolve(url):
    """跟随短链跳转，返回 (final_url, platform, vid)。"""
    import requests
    if re.match(r"^\d+$", url.strip()):
        url = "https://www.douyin.com/video/" + url.strip()
    r = requests.get(url, headers={"User-Agent": MOBILE_UA}, allow_redirects=True, timeout=30)
    final = r.url

    m = (re.search(r"/(?:share/)?video/(\d{8,})", final)
         or re.search(r"douyin\.com/video/(\d{8,})", final))
    if m:
        return "https://www.douyin.com/video/" + m.group(1), "douyin", m.group(1)

    m = re.search(r"/video/(BV[0-9A-Za-z]+)", final) or re.search(r"(BV[0-9A-Za-z]{10,})", final)
    if m:
        return "https://www.bilibili.com/video/" + m.group(1), "bilibili", m.group(1)

    if "xiaohongshu" in final or "xhslink" in url:
        return final, "xiaohongshu", final
    if "youtube.com" in final or "youtu.be" in final:
        return final, "youtube", final
    return final, "generic", final


# ---------------------------------------------------------------- douyin
def douyin_page(vid, want_video, profile_dir):
    """用系统 Chrome（playwright channel=chrome）打开视频页，抓 CDN 流 URL + 元信息。"""
    import requests
    from playwright.sync_api import sync_playwright

    info = {"streams": {}, "cookies": "", "title": "", "page_text": ""}
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(profile_dir), channel="chrome", headless=True,
            args=["--disable-blink-features=AutomationControlled", "--mute-audio"],
            user_agent=UA)
        page = ctx.new_page()
        page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
        page.goto("https://www.douyin.com/video/" + vid, wait_until="domcontentloaded", timeout=60000)

        deadline = time.time() + 30
        while time.time() < deadline:
            urls = page.evaluate(
                "() => performance.getEntriesByType('resource').map(e => e.name)"
                ".filter(n => n.includes('douyinvod.com'))")
            urls = [u for u in urls if "media-video" in u or "media-audio" in u]
            if any("media-audio" in u for u in urls):
                for u in urls:
                    kind = "video" if "media-video" in u else "audio"
                    info["streams"].setdefault(kind, u)
                break
            time.sleep(1.0)

        info["title"] = page.title()
        # 章节要点是懒渲染的：多等几秒，等不到就放弃（不是每条视频都有章节）
        text, t0 = "", time.time()
        while time.time() - t0 < 6:
            try:
                text = page.evaluate("() => document.body.innerText")
            except Exception:
                text = ""
            if "章节" in text:
                break
            time.sleep(0.4)
        info["page_text"] = text
        info["cookies"] = "; ".join(c["name"] + "=" + c["value"] for c in ctx.cookies())
        ctx.close()

    if not want_video:
        info["streams"].pop("video", None)
    return info


def download_stream(url, dest, cookies):
    import requests
    headers = {"User-Agent": UA, "Referer": "https://www.douyin.com/", "Cookie": cookies}
    with requests.get(url, headers=headers, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 16):
                f.write(chunk)
    if dest.stat().st_size < 200_000:
        raise RuntimeError(f"下载流太小，可能已过期：{dest} ({dest.stat().st_size} bytes)")


# ---------------------------------------------------------------- grab
def grab(url, work, want_video=False):
    work.mkdir(parents=True, exist_ok=True)
    final, platform, vid = resolve(url)
    log(f"platform={platform} id={vid}")
    src = {"input": url, "final_url": final, "platform": platform, "id": vid}

    audio = work / "audio.m4a"
    video = work / "video.mp4"

    if platform == "douyin":
        info = douyin_page(vid, want_video, Path.home() / ".cache/v2t/chrome-profile")
        if "audio" not in info["streams"]:
            raise RuntimeError("抖音：没抓到音轨 CDN。可能触发风控——改用浏览器兜底流程（见 SKILL.md「抖音兜底」）。")
        download_stream(info["streams"]["audio"], audio, info["cookies"])
        if want_video and "video" in info["streams"]:
            download_stream(info["streams"]["video"], video, info["cookies"])
        src["title"] = info.get("title", "")
        (work / "page.txt").write_text(info.get("page_text", ""), encoding="utf-8")
    else:
        cmd = ["yt-dlp", "-q", "--no-warnings", "-o", str(work / "media.%(ext)s"),
               "-f", "bestvideo+bestaudio/best" if want_video else "bestaudio/best"]
        try:
            sh(cmd + [final])
        except subprocess.CalledProcessError:
            sh(cmd + ["--cookies-from-browser", "chrome", final])
        cand = sorted(work.glob("media.*"))
        if not cand:
            raise RuntimeError("yt-dlp 没产出文件")
        got = cand[0]
        if want_video and got.suffix in (".mp4", ".mkv", ".webm"):
            video.write_bytes(got.read_bytes())
        audio.write_bytes(got.read_bytes())
        try:
            meta = json.loads(subprocess.run(
                ["yt-dlp", "-q", "--no-warnings", "-J", final],
                capture_output=True, text=True, check=True).stdout)
            for k in ("title", "uploader", "duration", "upload_date", "webpage_url"):
                src[k] = meta.get(k)
        except Exception:
            pass

    wav = work / "speech.wav"
    sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(audio),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)])
    src["wav"] = str(wav)
    (work / "source.json").write_text(json.dumps(src, ensure_ascii=False, indent=2), encoding="utf-8")
    log("ok -> " + str(work))
    return src


def _sanitize_json_value(val):
    if isinstance(val, float):
        return val if math.isfinite(val) else None
    if isinstance(val, dict):
        return {k: _sanitize_json_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_sanitize_json_value(v) for v in val]
    return val


def _sanitize_transcript_json(path: Path):
    if not path.exists():
        return
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        clean = _sanitize_json_value(raw)
        path.write_text(json.dumps(clean, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    except Exception as exc:
        log("warn: transcript.json sanitize skipped:", exc)


# ---------------------------------------------------------------- asr
def asr(work, model=None, lang="zh", max_sec=None, initial_prompt=None):
    wav = work / "speech.wav"
    if not wav.exists():
        raise RuntimeError(f"缺 {wav}，先跑 grab")
    if max_sec:
        cut = work / f"smoke{max_sec}.wav"
        sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
            "-t", str(max_sec), str(cut)])
        wav = cut

    if model is None:
        model = DEFAULT_MLX
    mlx_bin = shutil.which("mlx_whisper")
    if mlx_bin:
        cmd = [mlx_bin, str(wav), "--model", model,
               "--language", lang, "--task", "transcribe",
               "--output-dir", str(work), "--output-name", "transcript", "--output-format", "all"]
        if initial_prompt:
            cmd += ["--initial-prompt", initial_prompt]
        sh(cmd)
        out_json = work / "transcript.json"
        _sanitize_transcript_json(out_json)
        return out_json
    # 没有 mlx_whisper 才回退（首次会下 large-v3，约 3GB）
    log("未找到 mlx_whisper，回退 faster-whisper")
    if True:
        from faster_whisper import WhisperModel
        m = WhisperModel("large-v3", device="cpu", compute_type="int8")
        segs, inf = m.transcribe(str(wav), language=lang, vad_filter=True)
        data = _sanitize_json_value({
            "segments": [{"start": s.start, "end": s.end, "text": s.text} for s in segs],
            "language": inf.language, "engine": "faster-whisper/large-v3"
        })
        (work / "transcript.json").write_text(
            json.dumps(data, ensure_ascii=False, allow_nan=False), encoding="utf-8"
        )
        (work / "transcript.txt").write_text("".join(s["text"] for s in data["segments"]), encoding="utf-8")
        return work / "transcript.json"


# ---------------------------------------------------------------- markdown
def ts(sec):
    return f"{int(sec // 60):02d}:{int(sec % 60):02d}"


def paragraphs(segments, target=95):
    out, cur, start, n = [], [], None, 0
    for s in segments:
        t = s["text"].strip()
        if not t:
            continue
        if start is None:
            start = s["start"]
        cur.append(t)
        n += len(t)
        if n >= target:
            out.append((start, "".join(cur)))
            cur, start, n = [], None, 0
    if cur:
        out.append((start, "".join(cur)))
    return out


def chapters(page_text):
    """只取视频自带章节：从"章节要点"往后，时间递增、标题不超 40 字；遇到推荐位就停。"""
    lines = [l.strip() for l in page_text.splitlines()]
    start = next((i for i, l in enumerate(lines) if "章节" in l), None)
    if start is None:
        return []
    got, i, prev = [], start + 1, -1
    while i < len(lines) - 1 and len(got) < 12:
        m = re.fullmatch(r"(\d{2}):(\d{2})", lines[i])
        if not m:
            i += 1
            continue
        sec = int(m.group(1)) * 60 + int(m.group(2))
        title = lines[i + 1]
        ok = title and len(title) <= 40 and sec > prev
        if not ok:
            if got:
                break
            i += 1
            continue
        got.append((lines[i], title))
        prev = sec
        i += 2
    return got


def build_md(work, out_file):
    data = json.loads((work / "transcript.json").read_text(encoding="utf-8"))
    segs = data.get("segments", [])
    src = json.loads((work / "source.json").read_text(encoding="utf-8")) if (work / "source.json").exists() else {}
    page_text = (work / "page.txt").read_text(encoding="utf-8") if (work / "page.txt").exists() else ""
    title = (src.get("title") or work.name).replace(" - 抖音", "").strip()

    dur = max((s["end"] for s in segs), default=src.get("duration") or 0)
    lines = ["# " + title, "", "| 项 | 值 |", "|---|---|",
             "| 来源 | " + str(src.get("final_url", src.get("input", ""))) + " |"]
    if src.get("platform"):
        lines.append("| 平台 / ID | " + str(src["platform"]) + " / " + str(src.get("id", "")) + " |")
    if src.get("uploader"):
        lines.append("| 作者 | " + str(src["uploader"]) + " |")
    if dur:
        lines.append("| 时长 | " + ts(dur) + "（" + str(int(dur)) + " 秒） |")
    if src.get("upload_date"):
        lines.append("| 发布 | " + str(src["upload_date"]) + " |")
    lines += ["| 转写 | mlx-whisper / 本机 |", ""]

    ch = chapters(page_text)
    if ch:
        lines += ["## 章节（页面自带章节要点）", "", "| 时间 | 标题 |", "|---|---|"]
        lines += ["| " + t + " | " + n + " |" for t, n in ch]
        lines += [""]

    lines += ["## 正文（自动分段 · 无标点）", ""]
    for t, txt in paragraphs(segs):
        lines += ["**[" + ts(t) + "]** " + txt, ""]

    lines += ["---", "", "## 附录：逐句时间轴", ""]
    for s in segs:
        lines.append("- " + TICK + ts(s["start"]) + TICK + " " + s["text"].strip())
    lines.append("")

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text("\n".join(lines), encoding="utf-8")
    log("md -> " + str(out_file) + " (" + str(len(segs)) + " 段)")
    return out_file


# ---------------------------------------------------------------- frames
def frames(work, n=6, width=720):
    """按均匀时间抽 n 帧，供烧录字幕 OCR 校验。需要 grab --video。"""
    video = work / "video.mp4"
    if not video.exists():
        raise RuntimeError("缺 video.mp4：grab 时加 --video")
    out = work / "frames"
    out.mkdir(exist_ok=True)
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(video)], capture_output=True, text=True, check=True).stdout.strip())
    paths = []
    for i in range(n):
        t = min(dur * i / max(n - 1, 1), max(dur - 0.6, 0))
        dst = out / f"f_{int(t):02d}.jpg"
        sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(t),
            "-i", str(video), "-frames:v", "1", "-vf", f"scale={width}:-1", str(dst)])
        paths.append(dst)
    for x in paths:
        print(x)
    return paths


def main():
    ap = argparse.ArgumentParser(description="video -> text (转写 + Markdown)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("grab"); g.add_argument("url"); g.add_argument("-o", "--out", default=".")
    g.add_argument("--video", action="store_true")

    a = sub.add_parser("asr"); a.add_argument("workdir"); a.add_argument("--model")
    a.add_argument("--lang", default="zh"); a.add_argument("--max-sec", type=int)
    a.add_argument("--prompt")

    m = sub.add_parser("md"); m.add_argument("workdir"); m.add_argument("-o", "--out", default="transcript.md")

    r = sub.add_parser("run"); r.add_argument("url"); r.add_argument("-o", "--out", default="transcript.md")
    r.add_argument("--lang", default="zh"); r.add_argument("--model"); r.add_argument("--video", action="store_true")
    r.add_argument("--workdir")

    f = sub.add_parser("frames"); f.add_argument("workdir"); f.add_argument("--n", type=int, default=6)
    f.add_argument("--width", type=int, default=720)

    ns = ap.parse_args()
    if ns.cmd == "grab":
        grab(ns.url, Path(ns.out), ns.video)
    elif ns.cmd == "asr":
        asr(Path(ns.workdir), ns.model, ns.lang, ns.max_sec, ns.prompt)
    elif ns.cmd == "md":
        build_md(Path(ns.workdir), Path(ns.out))
    elif ns.cmd == "frames":
        frames(Path(ns.workdir), ns.n, ns.width)
    elif ns.cmd == "run":
        work = Path(ns.workdir) if ns.workdir else Path(ns.out).parent / (Path(ns.out).stem + ".work")
        grab(ns.url, work, ns.video)
        asr(work, ns.model, ns.lang)
        build_md(work, Path(ns.out))


if __name__ == "__main__":
    main()
