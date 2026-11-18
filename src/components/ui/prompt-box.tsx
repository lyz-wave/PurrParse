"use client";

/**
 * Based on Rare UI PromptBox (`swamimalode07/rare-ui/promptbox`).
 * Original work © Rare UI (https://rareui.com), adapted for PurrParse active-reading Q&A.
 */

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
  type Transition,
  type Variants,
} from "motion/react";
import React, { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type PromptEffort = {
  id: string;
  label: string;
  color?: string;
};

export type PromptBoxStatus = "idle" | "streaming";

type RGB = [number, number, number];

const DEFAULT_EFFORTS: PromptEffort[] = [
  { id: "quick", label: "快速精讲" },
  { id: "think", label: "深度剖析", color: "#F5A524" },
  { id: "deep", label: "跨节推演", color: "#F2552C" },
];

const NEUTRAL: RGB = [134, 133, 147];
const HOLD_DELAY = 180;
const LEVEL_MS = 650;
const LINE = 24;
const MAX_HEIGHT = 160;
const PLACEHOLDER_MS = 3400;
const MAX_WORDS = 80;

const SWAP: Transition = { type: "spring", duration: 0.45, bounce: 0.15 };
const GROW: Transition = { type: "spring", duration: 0.4, bounce: 0.1 };
const SETTLE: Transition = { type: "spring", duration: 0.7, bounce: 0 };
const INSTANT: Transition = { duration: 0 };
const LIFT = [0.32, 0.72, 0, 1] as const;
const RISE = 32;

const swapVariants: Variants = {
  enter: { y: 6, opacity: 0, filter: "blur(4px)" },
  center: { y: 0, opacity: 1, filter: "blur(0px)" },
  exit: { y: -6, opacity: 0, filter: "blur(4px)" },
};

const iconVariants: Variants = {
  enter: { scale: 0.4, opacity: 0, filter: "blur(4px)" },
  center: { scale: 1, opacity: 1, filter: "blur(0px)" },
  exit: { scale: 0.4, opacity: 0, filter: "blur(4px)" },
};

const toRgb = (color: string | undefined): RGB => {
  const hex = color?.trim().replace(/^#/, "") ?? "";
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return NEUTRAL;
  }
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgba = ([r, g, b]: RGB, alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

export type PromptBoxProps = Omit<
  React.ComponentProps<"div">,
  "onSubmit" | "children" | "defaultValue"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (prompt: string, effort: PromptEffort) => void;
  status?: PromptBoxStatus;
  onStop?: () => void;
  efforts?: PromptEffort[];
  placeholder?: string | string[];
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  inputProps?: Omit<
    React.ComponentProps<"textarea">,
    "ref" | "value" | "defaultValue" | "onChange" | "disabled" | "rows"
  >;
};

type Ghost = { id: number; text: string; scroll: number; width: number; height: number };

const SLOP = 8;

function PromptBox({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onSubmit,
  status = "idle",
  onStop,
  efforts: effortsProp = DEFAULT_EFFORTS,
  placeholder = "输入你对这段内容的疑问...",
  hint = "长按切换推理深度",
  actions,
  disabled = false,
  inputRef,
  inputProps,
  className,
  ...props
}: PromptBoxProps) {
  const reduced = !!useReducedMotion();
  const efforts = effortsProp.length ? effortsProp : DEFAULT_EFFORTS;
  const top = efforts.length - 1;
  const stops = efforts.map((effort) => toRgb(effort.color));
  const placeholders = Array.isArray(placeholder) ? placeholder : [placeholder];

  const [inner, setInner] = useState(defaultValue);
  const value = valueProp ?? inner;
  const streaming = status === "streaming";
  const canSend = !disabled && !streaming && value.trim().length > 0;

  const fieldRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const press = useRef<"key" | "pointer" | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const charge = useRef<AnimationPlaybackControls | null>(null);
  const levelRef = useRef(0);
  const ghostCount = useRef(0);
  const stopPress = useRef(false);
  const pointered = useRef(false);
  const unlisten = useRef<(() => void) | null>(null);

  const [charging, setCharging] = useState(false);
  const [level, setLevel] = useState(0);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [sent, setSent] = useState<RGB>(NEUTRAL);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [fieldWidth, setFieldWidth] = useState(0);

  const progress = useMotionValue(0);
  const tint = useMotionValue(rgba(stops[0], 1));
  const squeeze = useSpring(useTransform(progress, [0, top || 1], [1, 0.92]), {
    stiffness: 300,
    damping: 30,
  });
  const surface = useTransform(progress, (p) => {
    const t = top ? Math.min(Math.max(p / top, 0), 1) : 0;
    return `${(1 - t) * 100}%`;
  });
  const liquid = useTransform(progress, (p) => (p > 0.01 ? 1 : 0));

  const setValue = (next: string) => {
    if (valueProp === undefined) {
      setInner(next);
    }
    onValueChange?.(next);
  };

  useMotionValueEvent(progress, "change", (p) => {
    const next = Math.max(0, Math.min(Math.floor(p + 0.001), top));
    if (next === levelRef.current) {
      return;
    }
    if (next > levelRef.current && press.current && !reduced) {
      if (iconRef.current) {
        try {
          animate(iconRef.current, { scale: [1, 1.12, 1] }, { duration: 0.45, ease: "easeInOut" });
        } catch {
          // Ignore WAAPI absence in headless environments
        }
      }
      navigator.vibrate?.(8);
    }
    if (next > levelRef.current) {
      animate(tint, rgba(stops[next], 1), reduced ? INSTANT : { duration: 0.35, ease: "easeOut" });
    }
    levelRef.current = next;
    setLevel(next);
  });

  useLayoutEffect(() => {
    const el = textareaRef.current;
    const field = fieldRef.current;
    if (!el || !field || ghost) {
      return;
    }
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, LINE), MAX_HEIGHT);
    el.style.height = `${next}px`;
    try {
      animate(field, { height: next }, reduced ? INSTANT : GROW);
    } catch {
      field.style.height = `${next}px`;
    }
  }, [value, ghost, fieldWidth, reduced]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => setFieldWidth(field.offsetWidth));
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  const rotating = placeholders.length > 1 && !value;
  useEffect(() => {
    if (!rotating) {
      return;
    }
    const id = window.setInterval(() => setPlaceholderIndex((i) => i + 1), PLACEHOLDER_MS);
    return () => window.clearInterval(id);
  }, [rotating]);

  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current);
      charge.current?.stop();
      unlisten.current?.();
    },
    []
  );

  useLayoutEffect(() => {
    const layer = ghostRef.current;
    if (!ghost || !layer) {
      return;
    }
    let cancelled = false;
    const view = layer.getBoundingClientRect();
    const words = Array.from(layer.querySelectorAll<HTMLElement>("[data-word]")).filter((word) => {
      const box = word.getBoundingClientRect();
      const seen = box.bottom > view.top + RISE && box.top < view.bottom;
      if (!seen) {
        word.style.visibility = "hidden";
      }
      return seen;
    });
    const step = Math.min(0.03, 0.3 / Math.max(words.length, 1));
    let flights: AnimationPlaybackControls[] = [];
    try {
      flights = words.length
        ? words.map((word, i) =>
            animate(
              word,
              { y: -RISE, opacity: 0, filter: "blur(4px)" },
              { duration: 0.4, delay: i * step, ease: LIFT }
            )
          )
        : [
            animate(
              layer.firstElementChild ?? layer,
              { y: -8, opacity: 0, filter: "blur(4px)" },
              { duration: 0.35, ease: LIFT }
            ),
          ];
    } catch {
      setGhost(null);
      return;
    }

    Promise.all(flights).then(() => {
      if (cancelled) {
        return;
      }
      setGhost(null);
      if (iconRef.current) {
        try {
          animate(iconRef.current, { scale: [1, 1.25, 1] }, { duration: 0.35, ease: "easeOut" });
        } catch {
          // Ignore in headless tests
        }
      }
    });
    return () => {
      cancelled = true;
      flights.forEach((flight) => flight.stop());
    };
  }, [ghost]);

  const submit = (effort: PromptEffort) => {
    const prompt = value.trim();
    if (!prompt || disabled || streaming) {
      return;
    }
    if (!reduced && typeof Element !== "undefined" && typeof Element.prototype.animate === "function") {
      ghostCount.current += 1;
      const el = textareaRef.current;
      setGhost({
        id: ghostCount.current,
        text: value,
        scroll: el?.scrollTop ?? 0,
        width: el?.clientWidth ?? 0,
        height: fieldRef.current?.offsetHeight ?? LINE,
      });
    }
    setSent(toRgb(effort.color));
    setValue("");
    onSubmit?.(prompt, effort);
  };

  const begin = (source: "key" | "pointer") => {
    if (!canSend || press.current) {
      return;
    }
    press.current = source;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    unlisten.current = () => window.removeEventListener("keydown", onKey);
    progress.jump(0);
    levelRef.current = 0;
    setLevel(0);
    tint.set(rgba(stops[0], 1));
    if (!top) {
      return;
    }
    holdTimer.current = window.setTimeout(() => {
      setCharging(true);
      charge.current = animate(progress, top, {
        duration: (top * LEVEL_MS) / 1000,
        ease: "linear",
      });
    }, HOLD_DELAY);
  };

  const settle = () => {
    press.current = null;
    unlisten.current?.();
    unlisten.current = null;
    window.clearTimeout(holdTimer.current);
    charge.current?.stop();
    setCharging(false);
    animate(progress, 0, reduced ? INSTANT : SETTLE);
  };

  const release = () => {
    if (!press.current) {
      return;
    }
    const effort = efforts[Math.min(levelRef.current, top)];
    settle();
    submit(effort);
  };

  const cancel = () => {
    if (press.current) {
      settle();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    inputProps?.onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (!event.repeat) {
      begin("key");
    }
  };

  useImperativeHandle(inputRef, () => textareaRef.current as HTMLTextAreaElement, []);

  // CJK-aware tokenization so Chinese words fly smoothly too
  const tokens = ghost?.text.split(/(\s+|[\u4e00-\u9fff]{1,2})/) ?? [];
  const flyWords = tokens.filter((token) => token.trim()).length <= MAX_WORDS;
  const effort = efforts[Math.min(level, top)];
  const ready = canSend || streaming;

  return (
    <div
      data-slot="prompt-box"
      data-status={status}
      data-charging={charging || undefined}
      data-disabled={disabled || undefined}
      className={cn(
        "relative flex w-full max-w-full flex-col rounded-[22px] border border-[var(--prism-border)] bg-[var(--prism-surface)] text-[var(--prism-ink)] shadow-xs transition-shadow focus-within:ring-2 focus-within:ring-[var(--prism-accent-line)]/35",
        disabled && "opacity-60",
        className
      )}
      {...props}
    >
      <div className="relative px-3.5 pt-3">
        <motion.div ref={fieldRef} className="relative overflow-hidden" style={{ height: LINE }}>
          <AnimatePresence initial={false}>
            {!value && (
              <motion.span
                key="placeholder"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: INSTANT }}
                transition={reduced ? INSTANT : { duration: 0.2, delay: ghost ? 0.25 : 0 }}
                className="pointer-events-none absolute inset-x-0 top-0 grid text-xs sm:text-[13.5px] leading-6 text-[var(--prism-ink-muted)]"
              >
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={placeholderIndex % placeholders.length}
                    variants={swapVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={reduced ? INSTANT : SWAP}
                    className="truncate"
                  >
                    {placeholders[placeholderIndex % placeholders.length]}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
            )}
          </AnimatePresence>
          <textarea
            aria-label={placeholders[0]}
            {...inputProps}
            ref={textareaRef}
            data-slot="prompt-box-input"
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={(event) => {
              inputProps?.onKeyUp?.(event);
              if (event.key === "Enter") {
                release();
              }
            }}
            onBlur={(event) => {
              inputProps?.onBlur?.(event);
              if (press.current === "key") {
                cancel();
              }
            }}
            style={{ ...inputProps?.style, height: LINE }}
            className={cn(
              "relative block w-full resize-none break-words bg-transparent text-xs sm:text-[13.5px] leading-6 text-[var(--prism-ink)] outline-none [scrollbar-width:thin] disabled:cursor-not-allowed",
              inputProps?.className
            )}
          />
        </motion.div>

        {ghost && (
          <div
            key={ghost.id}
            ref={ghostRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-3.5 z-10 overflow-hidden"
            style={{
              top: 12 - (flyWords ? RISE : 0),
              height: ghost.height + (flyWords ? RISE : 0),
              paddingTop: flyWords ? RISE : 0,
            }}
          >
            <div
              className="whitespace-pre-wrap break-words text-xs sm:text-[13.5px] leading-6 text-[var(--prism-heading)]"
              style={{ marginTop: -ghost.scroll, width: ghost.width || undefined }}
            >
              {flyWords
                ? tokens.map((token, i) =>
                    token.trim() ? (
                      <span key={i} data-word className="inline-block">
                        {token}
                      </span>
                    ) : (
                      token
                    )
                  )
                : ghost.text}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 pt-2 pb-2.5">
        <div data-slot="prompt-box-actions" className="flex min-w-0 flex-1 items-center gap-1.5">
          {actions}
        </div>

        <span aria-live="polite" className="sr-only">
          {charging ? effort.label : ""}
        </span>
        <span aria-hidden className="relative grid text-[11px] font-medium whitespace-nowrap">
          <AnimatePresence initial={false} mode="popLayout" anchorX="right">
            {charging ? (
              <motion.span
                key="effort"
                variants={swapVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduced ? INSTANT : SWAP}
                data-slot="prompt-box-effort"
                className="flex items-center gap-1.5 text-[var(--prism-heading)]"
              >
                <span
                  aria-hidden
                  className="flex h-3 items-end gap-[2px] transition-colors duration-300"
                  style={{ color: effort.color ?? rgba(NEUTRAL, 1) }}
                >
                  {efforts.map((item, i) => (
                    <motion.span
                      key={item.id}
                      className="w-[3px] origin-bottom rounded-full bg-current"
                      style={{ height: 5 + (7 * i) / Math.max(top, 1) }}
                      initial={false}
                      animate={i <= level ? { opacity: 1, scaleY: 1 } : { opacity: 0.22, scaleY: 0.7 }}
                      transition={reduced ? INSTANT : SWAP}
                    />
                  ))}
                </span>
                <span className="grid">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={effort.id}
                      variants={swapVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={reduced ? INSTANT : SWAP}
                    >
                      {effort.label}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </motion.span>
            ) : (
              hint &&
              canSend &&
              top > 0 && (
                <motion.span
                  key="hint"
                  variants={swapVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={reduced ? INSTANT : SWAP}
                  className="text-[var(--prism-ink-muted)]"
                >
                  {hint}
                </motion.span>
              )
            )}
          </AnimatePresence>
        </span>

        <div className="relative flex size-9 shrink-0 items-center justify-center">
          <AnimatePresence>
            {streaming && (
              <motion.span
                key="spinner"
                aria-hidden
                className="pointer-events-none absolute -inset-[3px] rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, ${rgba(sent, 0)} 0%, ${rgba(sent, 0)} 35%, ${rgba(sent, 1)} 100%)`,
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))",
                  WebkitMask:
                    "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))",
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, rotate: 360 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{
                  opacity: { duration: 0.3 },
                  scale: SWAP,
                  rotate: { duration: 1.1, ease: "linear", repeat: Infinity },
                }}
              />
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            data-slot="prompt-box-button"
            data-testid={streaming ? "prompt-box-stop-btn" : "prompt-box-send-btn"}
            disabled={!ready}
            aria-label={streaming ? "停止生成" : "发送提问（长按增强深度）"}
            style={{ scale: squeeze }}
            onMouseDown={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              pointered.current = true;
              stopPress.current = streaming;
              if (streaming) {
                return;
              }
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Ignore synthetic events without active pointerId
              }
              begin("pointer");
            }}
            onPointerUp={(event) => {
              if (press.current !== "pointer") {
                return;
              }
              const box = event.currentTarget.getBoundingClientRect();
              const inside =
                event.clientX >= box.left - SLOP &&
                event.clientX <= box.right + SLOP &&
                event.clientY >= box.top - SLOP &&
                event.clientY <= box.bottom + SLOP;
              if (inside) {
                release();
              } else {
                cancel();
              }
            }}
            onPointerCancel={cancel}
            onKeyDown={() => {
              pointered.current = false;
            }}
            onClick={() => {
              const fromPointer = pointered.current;
              pointered.current = false;
              if (!fromPointer) {
                if (streaming) {
                  onStop?.();
                } else {
                  submit(efforts[0]);
                }
              } else if (stopPress.current && streaming) {
                stopPress.current = false;
                onStop?.();
              }
            }}
            className={cn(
              "prism-on-dark relative flex size-9 touch-none items-center justify-center overflow-hidden rounded-full transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--prism-accent-line)]/50",
              ready
                ? "cursor-pointer bg-[#1a2744] text-white hover:bg-[#24365c] border border-white/15"
                : "cursor-default bg-[var(--prism-surface-muted)] text-[var(--prism-ink-muted)]"
            )}
          >
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ y: surface, opacity: liquid, backgroundColor: tint, color: tint }}
            >
              <motion.svg
                viewBox="0 0 72 6"
                className="absolute -top-[5px] left-0 h-1.5 w-[72px]"
                animate={charging && !reduced ? { x: [0, -36] } : { x: 0 }}
                transition={
                  charging && !reduced
                    ? { duration: 1.6, ease: "linear", repeat: Infinity }
                    : INSTANT
                }
              >
                <path
                  d="M0 3 Q4.5 0.5 9 3 T18 3 T27 3 T36 3 T45 3 T54 3 T63 3 T72 3 V6 H0 Z"
                  fill="currentColor"
                />
              </motion.svg>
            </motion.span>
            <motion.span
              ref={iconRef}
              className={cn(
                "relative grid size-[17px] place-items-center transition-colors duration-200",
                charging && level > 0 && "text-white"
              )}
            >
              <AnimatePresence initial={false}>
                <motion.svg
                  key={streaming ? "stop" : "send"}
                  viewBox="0 0 24 24"
                  width={17}
                  height={17}
                  className="col-start-1 row-start-1 block"
                  variants={iconVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={reduced ? INSTANT : SWAP}
                >
                  {streaming ? (
                    <motion.rect
                      x={7}
                      y={7}
                      width={10}
                      height={10}
                      rx={2.5}
                      fill="currentColor"
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                      animate={reduced ? undefined : { scale: [1, 0.8, 1] }}
                      transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
                    />
                  ) : (
                    <path
                      d="M12 19V5M5.5 11.5L12 5l6.5 6.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </motion.svg>
              </AnimatePresence>
            </motion.span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export { PromptBox };
export default PromptBox;
