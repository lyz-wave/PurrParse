"use client";

/**
 * Based on Rare UI StreamingResponse (`swamimalode07/rare-ui/streaming-response`).
 * Original work © Rare UI (https://rareui.com), enhanced for PurrParse with CJK tokenization & KaTeX math.
 */

import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from "motion/react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { CodeBlock as RareCodeBlock } from "@/components/ui/code-block";
import { cn } from "@/lib/utils";
import { MathText } from "@/workbench-ui/math-text";

export type StreamingResponseStatus = "streaming" | "done" | "stopped";
export type StreamingResponseFeedback = "up" | "down" | null;

const SPEED = 14;
const MAX_CHUNK = 3;
const CATCH_UP = 16;
const SENTENCE_PAUSE_MS = 180;
const CLAUSE_PAUSE_MS = 70;
const SHARPEN_MS = 240;
const DEVELOP_MS = 460;
const GLIDE_MS = 160;
const STAGGER_MS = 14;
const MAX_STAGGER_MS = 56;
const COPIED_MS = 1600;

const POP: Transition = { type: "spring", duration: 0.4, bounce: 0.45 };
const SWAP: Transition = { type: "spring", duration: 0.35, bounce: 0.2 };
const INSTANT: Transition = { duration: 0 };

const rowVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 4, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: SWAP },
};

type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "math"; text: string }
  | { type: "link"; href?: string; children: Inline[] };

type Block =
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "h"; level: number; text: string }
  | { type: "ul"; start: number; items: string[] }
  | { type: "ol"; start: number; items: string[] }
  | { type: "code"; lang: string; text: string };

const FENCE = /^\s*```(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const SAFE_HREF = /^(https?:|mailto:|\/|#)/i;

const startsBlock = (line: string) =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  QUOTE.test(line) ||
  BULLET.test(line) ||
  ORDERED.test(line);

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(FENCE);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", lang: fence[1].trim(), text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }
    const list = BULLET.test(line)
      ? BULLET
      : ORDERED.test(line)
        ? ORDERED
        : QUOTE.test(line)
          ? QUOTE
          : null;
    if (list) {
      const items: string[] = [];
      const start = Number.parseInt(line.match(ORDERED)?.[1] ?? "1", 10);
      while (i < lines.length && list.test(lines[i])) {
        const match = lines[i].match(list)!;
        items.push(match[match.length - 1]);
        i += 1;
      }
      if (list === QUOTE) {
        blocks.push({ type: "quote", text: items.join("\n") });
      } else {
        blocks.push({ type: list === BULLET ? "ul" : "ol", start, items });
      }
      continue;
    }
    const body = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      body.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "p", text: body.join("\n") });
  }
  return blocks;
}

function closingParen(src: string, from: number) {
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    if (src[i] === "(") {
      depth += 1;
    } else if (src[i] === ")") {
      if (!depth) {
        return i;
      }
      depth -= 1;
    }
  }
  return -1;
}

// Inline Markdown + atomic closed math parser
function parseInline(src: string, final: boolean): Inline[] {
  const out: Inline[] = [];
  let text = "";
  let i = 0;
  const flush = () => {
    if (text) {
      out.push({ type: "text", text });
      text = "";
    }
  };
  const close = (marker: string, from: number) => {
    const end = src.indexOf(marker, from);
    return end < 0 && final ? -2 : end;
  };
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1] ?? "";
    if (c === "$") {
      if (next === "$") {
        const end = src.indexOf("$$", i + 2);
        if (end !== -1) {
          flush();
          out.push({ type: "math", text: src.slice(i, end + 2) });
          i = end + 2;
          continue;
        }
      } else if (next && !/\s/.test(next)) {
        const end = src.indexOf("$", i + 1);
        if (end !== -1 && !src.slice(i + 1, end).includes("\n")) {
          flush();
          out.push({ type: "math", text: src.slice(i, end + 1) });
          i = end + 1;
          continue;
        }
      }
    } else if (c === "`") {
      const end = close("`", i + 1);
      if (end !== -2) {
        flush();
        out.push({ type: "code", text: src.slice(i + 1, end < 0 ? undefined : end) });
        i = end < 0 ? src.length : end + 1;
        continue;
      }
    } else if (c === "*" && next === "*" && src[i + 2] && !/\s/.test(src[i + 2])) {
      const end = close("**", i + 2);
      if (end !== -2) {
        flush();
        out.push({
          type: "strong",
          children: parseInline(src.slice(i + 2, end < 0 ? undefined : end), final),
        });
        i = end < 0 ? src.length : end + 2;
        continue;
      }
    } else if (
      (c === "*" || (c === "_" && !/\w/.test(src[i - 1] ?? ""))) &&
      next &&
      !/\s/.test(next)
    ) {
      const end = close(c, i + 1);
      if (end !== -2) {
        flush();
        out.push({
          type: "em",
          children: parseInline(src.slice(i + 1, end < 0 ? undefined : end), final),
        });
        i = end < 0 ? src.length : end + 1;
        continue;
      }
    } else if (c === "[") {
      const bracket = src.indexOf("]", i + 1);
      const after = src[bracket + 1];
      const pending = bracket < 0 || after === undefined;
      if ((pending && !final) || after === "(") {
        const paren = after === "(" ? closingParen(src, bracket + 2) : -1;
        if (!(final && after === "(" && paren < 0)) {
          const href = paren >= 0 ? src.slice(bracket + 2, paren) : undefined;
          flush();
          out.push({
            type: "link",
            href: href && SAFE_HREF.test(href) ? href : undefined,
            children: parseInline(src.slice(i + 1, bracket < 0 ? undefined : bracket), final),
          });
          i = paren >= 0 ? paren + 1 : after === "(" || bracket < 0 ? src.length : bracket + 1;
          continue;
        }
      }
    }
    text += c;
    i += 1;
  }
  flush();
  return out;
}

// CJK + Latin word-boundary endpoints so Chinese flows in smooth 2-char increments while English stays whole-word
function wordEnds(text: string, final: boolean) {
  const ends: number[] = [];
  const tokenPattern =
    /\$\$[^$]+\$\$|\$[^$\n]+\$|[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]{1,2}|[A-Za-z0-9_.+-]+|\S/g;
  for (const match of text.matchAll(tokenPattern)) {
    const end = (match.index ?? 0) + match[0].length;
    if (end < text.length || final) {
      ends.push(end);
    }
  }
  return ends;
}

const fresh = { at: 0, n: 0 };

function Word({
  animate,
  ink,
  children,
}: {
  animate: boolean;
  ink?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !animate || typeof el.animate !== "function") {
      return;
    }
    const now = performance.now();
    if (now - fresh.at > 8) {
      fresh.at = now;
      fresh.n = 0;
    }
    const delay = Math.min(fresh.n * STAGGER_MS, MAX_STAGGER_MS);
    fresh.n += 1;
    el.animate([{ filter: "blur(5px)" }, { filter: "blur(0px)" }], {
      duration: SHARPEN_MS,
      delay,
      easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
      fill: "backwards",
    });
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: DEVELOP_MS,
      delay,
      easing: "cubic-bezier(0.25, 0.6, 0.35, 1)",
      fill: "backwards",
    });
    if (ink) {
      const settled = getComputedStyle(el).color;
      el.animate([{ color: ink }, { color: settled }], {
        duration: DEVELOP_MS,
        delay,
        easing: "ease-out",
        fill: "backwards",
      });
    }
  }, [animate, ink]);

  return <span ref={ref}>{children}</span>;
}

type Ctx = { i: number; from: number; ink?: string; caret: React.ReactNode };

function renderInline(nodes: Inline[], ctx: Ctx): React.ReactNode[] {
  return nodes.flatMap((node): React.ReactNode[] => {
    const key = ctx.i;
    if (node.type === "text") {
      return node.text
        .split(/(\s+|[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]{1,2})/)
        .map((token, t) => {
          if (!token) {
            return null;
          }
          if (/^\s+$/.test(token)) {
            return token.includes("\n") ? <br key={`b${key}-${t}`} /> : token;
          }
          ctx.i += 1;
          return (
            <Word key={`w${ctx.i}`} animate={ctx.i > ctx.from} ink={ctx.ink}>
              {token}
            </Word>
          );
        });
    }
    if (node.type === "math") {
      ctx.i += 1;
      return [
        <Word key={`m${ctx.i}`} animate={ctx.i > ctx.from} ink={ctx.ink}>
          <MathText text={node.text} />
        </Word>,
      ];
    }
    if (node.type === "code") {
      ctx.i += 1;
      return [
        <Word key={`w${ctx.i}`} animate={ctx.i > ctx.from} ink={ctx.ink}>
          <code className="rounded-md bg-slate-500/15 px-1.5 py-0.5 font-mono text-[0.88em] text-[var(--prism-heading)]">
            {node.text}
          </code>
        </Word>,
      ];
    }
    const children = renderInline(node.children, ctx);
    if (node.type === "strong") {
      return [
        <strong key={`s${key}`} className="font-semibold text-[var(--prism-heading)]">
          {children}
        </strong>,
      ];
    }
    if (node.type === "em") {
      return [<em key={`e${key}`}>{children}</em>];
    }
    return [
      node.href ? (
        <a
          key={`a${key}`}
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[1.5px] underline-offset-4"
          style={{
            textDecorationColor: `color-mix(in srgb, ${ctx.ink ?? "currentColor"} 40%, transparent)`,
          }}
        >
          {children}
        </a>
      ) : (
        <span key={`a${key}`} className="underline decoration-[1.5px] underline-offset-4 opacity-80">
          {children}
        </span>
      ),
    ];
  });
}

type CaretTrack = { x: number; y: number; glide?: Animation } | null;

function Caret({
  ink,
  reduced,
  trackRef,
}: {
  ink?: string;
  reduced: boolean;
  trackRef: React.RefObject<CaretTrack>;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") {
      return;
    }
    const last = trackRef.current;
    const offset =
      (last?.glide?.effect as KeyframeEffect | null | undefined)?.target === el
        ? Number.parseFloat(getComputedStyle(el).translate) || 0
        : 0;
    const rect = el.getBoundingClientRect();
    const x = rect.left - offset;
    if (last && last.x === x && last.y === rect.top) {
      return;
    }
    last?.glide?.cancel();
    const from = last ? last.x + offset - x : 0;
    const sameLine = last && Math.abs(last.y - rect.top) <= 2;
    trackRef.current = {
      x,
      y: rect.top,
      glide:
        sameLine && from < 0 && !reduced
          ? el.animate([{ translate: `${from}px 0` }, { translate: "0 0" }], {
              duration: GLIDE_MS,
              easing: "cubic-bezier(0.25, 0.8, 0.3, 1)",
            })
          : undefined,
    };
  });

  return (
    <span
      ref={ref}
      aria-hidden
      data-slot="streaming-response-caret"
      className="ml-1.5 inline-block size-[0.45em] rounded-full bg-[var(--prism-heading)] align-[0.06em] opacity-75 motion-safe:animate-pulse"
      style={ink ? { backgroundColor: ink } : undefined}
    />
  );
}

function IconButton({
  label,
  pressed,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        "relative flex size-7 cursor-pointer items-center justify-center rounded-full text-[var(--prism-ink-muted)] outline-none transition-colors hover:bg-[var(--prism-surface-muted)] hover:text-[var(--prism-heading)] focus-visible:ring-2 focus-visible:ring-[var(--prism-accent-line)]",
        className
      )}
      {...props}
    />
  );
}

function SwapIcon({
  on,
  off,
  onIcon,
}: {
  on: boolean;
  off: React.ReactNode;
  onIcon: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <span className="grid">
      <AnimatePresence initial={false}>
        <motion.span
          key={on ? "on" : "off"}
          className="col-start-1 row-start-1 grid place-items-center"
          initial={{ scale: 0.5, opacity: 0, filter: "blur(3px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          exit={{ scale: 0.5, opacity: 0, filter: "blur(3px)" }}
          transition={reduced ? INSTANT : SWAP}
        >
          {on ? onIcon : off}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export type StreamingResponseProps = Omit<React.ComponentProps<"div">, "children"> & {
  text: string;
  status?: StreamingResponseStatus;
  speed?: number;
  ink?: string;
  actions?: boolean;
  defaultFeedback?: StreamingResponseFeedback;
  onFeedback?: (feedback: StreamingResponseFeedback) => void;
  onRetry?: () => void;
  onCopy?: (text: string) => void;
};

function StreamingResponse({
  text,
  status = "done",
  speed = SPEED,
  ink,
  actions = true,
  defaultFeedback = null,
  onFeedback,
  onRetry,
  onCopy,
  className,
  ...props
}: StreamingResponseProps) {
  const reduced = !!useReducedMotion();
  const streaming = status === "streaming";

  const [initial] = useState(() => (status === "streaming" ? 0 : text.length));
  const [shown, setShown] = useState(initial);
  const [initialWords] = useState(() => {
    const ctx: Ctx = { i: 0, from: Infinity, ink, caret: null };
    parseBlocks(text.slice(0, initial)).forEach((block) => renderBlock(block, ctx, false));
    return ctx.i;
  });
  const count = useRef(wordEnds(text.slice(0, initial), true).length);
  const wait = useRef(0);
  const [run, setRun] = useState(0);
  const seen = useRef(text.slice(0, initial));

  useEffect(() => {
    if (status === "stopped") {
      return;
    }
    const ends = wordEnds(text, !streaming);
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      wait.current -= Math.min(now - last, 100);
      last = now;
      if (!text.startsWith(seen.current)) {
        count.current = 0;
        wait.current = 0;
        setRun((n) => n + 1);
      }
      if (reduced) {
        count.current = ends.length;
      }
      while (wait.current <= 0 && count.current < ends.length) {
        const backlog = ends.length - count.current;
        const chunk = 1 + Math.floor(Math.random() * MAX_CHUNK) + Math.floor(backlog / CATCH_UP);
        count.current = Math.min(ends.length, count.current + chunk);
        const tail = text[ends[count.current - 1] - 1] ?? "";
        const pause = /[.!?。！？]/.test(tail)
          ? SENTENCE_PAUSE_MS
          : /[,;:，；：]/.test(tail)
            ? CLAUSE_PAUSE_MS
            : 0;
        const gap = ((chunk * 1000) / Math.max(speed, 1)) * (0.5 + Math.random());
        wait.current += (gap + pause) / (1 + backlog / CATCH_UP);
      }
      const end =
        !streaming && count.current >= ends.length
          ? text.length
          : (ends[count.current - 1] ?? 0);
      seen.current = text.slice(0, end);
      setShown(end);
      if (count.current < ends.length) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, status, streaming, speed, reduced]);

  const visible = text.slice(0, shown);
  const settled = status === "stopped" || (!streaming && shown >= text.length);
  const caretTrack = useRef<CaretTrack>(null);
  const caret = !settled ? <Caret key="caret" ink={ink} reduced={reduced} trackRef={caretTrack} /> : null;

  const ctx: Ctx = { i: 0, from: reduced ? Infinity : run ? 0 : initialWords, ink, caret };
  const blocks = parseBlocks(visible);
  const content = blocks.map((block, n) => (
    <React.Fragment key={`b${run}-${n}`}>
      {renderBlock(block, ctx, n === blocks.length - 1 && !!caret, !streaming)}
    </React.Fragment>
  ));

  const [feedback, setFeedback] = useState<StreamingResponseFeedback>(defaultFeedback);
  const [copied, setCopied] = useState(false);
  const [spins, setSpins] = useState(0);
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const copy = () => {
    const value = status === "stopped" ? visible : text;
    navigator.clipboard?.writeText(value).catch(() => {});
    onCopy?.(value);
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  const vote = (value: "up" | "down") => {
    const next = feedback === value ? null : value;
    setFeedback(next);
    onFeedback?.(next);
  };

  return (
    <div
      data-slot="streaming-response"
      data-status={status}
      aria-busy={!settled}
      className={cn(
        "flex flex-col text-[13px] leading-relaxed text-[var(--prism-ink)]",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-2.5 break-words">
        {content.length ? content : caret && <p>{caret}</p>}
      </div>

      <AnimatePresence>
        {actions && settled && (
          <motion.div
            key="actions"
            data-slot="streaming-response-actions"
            variants={rowVariants}
            initial={reduced ? false : "hidden"}
            animate="show"
            exit="hidden"
            className="-ml-1.5 mt-2 flex items-center gap-0.5 text-[var(--prism-ink-muted)]"
          >
            <motion.span variants={itemVariants}>
              <IconButton label={copied ? "已复制回答" : "复制回答"} onClick={copy}>
                <SwapIcon
                  on={copied}
                  off={<Copy className="size-3.5" />}
                  onIcon={<Check className="size-3.5" />}
                />
              </IconButton>
            </motion.span>
            {onRetry && (
              <motion.span variants={itemVariants}>
                <IconButton
                  label="重新生成"
                  onClick={() => {
                    setSpins((n) => n + 1);
                    onRetry();
                  }}
                >
                  <motion.span
                    key={spins}
                    className="grid place-items-center"
                    initial={spins && !reduced ? { rotate: 0 } : false}
                    animate={{ rotate: -360 }}
                    transition={{ type: "spring", duration: 0.7, bounce: 0.2 }}
                  >
                    <RotateCcw className="size-3.5" />
                  </motion.span>
                </IconButton>
              </motion.span>
            )}
            {(["up", "down"] as const).map((value) => {
              const active = feedback === value;
              const Icon = value === "up" ? ThumbsUp : ThumbsDown;
              return (
                <motion.span key={value} variants={itemVariants}>
                  <IconButton
                    label={value === "up" ? "回答有帮助" : "回答待改进"}
                    pressed={active}
                    onClick={() => vote(value)}
                    className={active ? "text-[var(--prism-heading)]" : undefined}
                    style={active && ink ? { color: ink } : undefined}
                  >
                    <motion.span
                      key={String(active)}
                      className="grid place-items-center"
                      initial={
                        active && !reduced ? { scale: 0.6, rotate: value === "up" ? -14 : 14 } : false
                      }
                      animate={{ scale: 1, rotate: 0 }}
                      transition={POP}
                    >
                      <Icon
                        className="size-3.5"
                        fill={active ? "currentColor" : "none"}
                        fillOpacity={0.2}
                      />
                    </motion.span>
                  </IconButton>
                </motion.span>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function renderBlock(block: Block, ctx: Ctx, caret: boolean, final = true): React.ReactNode {
  const inline = (src: string, withCaret: boolean) => {
    const nodes = renderInline(parseInline(src, final), ctx);
    return withCaret ? [...nodes, ctx.caret] : nodes;
  };
  if (block.type === "code") {
    const lineCount = block.text.replace(/^\n+/, "").trimEnd().split("\n").length;
    return (
      <RareCodeBlock
        code={block.text}
        language={block.lang || "plain"}
        showLineNumbers={lineCount > 1}
        className="rounded-xl"
        renderLineContent={
          caret
            ? ({ line, lineNumber, getTokenProps }) => (
                <>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                  {lineNumber === lineCount && ctx.caret}
                </>
              )
            : undefined
        }
      />
    );
  }
  if (block.type === "h") {
    const Tag = (["h3", "h4", "h5"] as const)[block.level - 1];
    return (
      <Tag
        className={cn(
          "font-semibold tracking-tight text-[var(--prism-heading)]",
          block.level === 1 ? "text-[15px]" : block.level === 2 ? "text-[14px]" : "text-[13px]"
        )}
      >
        {inline(block.text, caret)}
      </Tag>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote className="border-l-2 border-[var(--prism-border-strong)] pl-3 text-[var(--prism-ink-muted)]">
        {inline(block.text, caret)}
      </blockquote>
    );
  }
  if (block.type === "ul" || block.type === "ol") {
    const List = block.type;
    return (
      <List
        start={block.type === "ol" && block.start !== 1 ? block.start : undefined}
        className={cn(
          "flex flex-col gap-1 pl-5 marker:text-[var(--prism-ink-muted)]",
          block.type === "ul" ? "list-disc" : "list-decimal marker:tabular-nums"
        )}
      >
        {block.items.map((item, n) => (
          <li key={n} className="pl-0.5">
            {inline(item, caret && n === block.items.length - 1)}
          </li>
        ))}
      </List>
    );
  }
  return <p>{inline(block.text, caret)}</p>;
}

export { StreamingResponse };
export default StreamingResponse;
