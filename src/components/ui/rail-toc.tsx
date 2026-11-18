"use client";

/**
 * Based on Rare UI RailToc (`swamimalode07/rare-ui/rail-toc`).
 * Original work © Rare UI (https://rareui.com), adapted with PurrParse theme tokens, section role badges, and jsdom guards.
 */

import * as React from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { cn } from "@/lib/utils";

export type RailTocItem = {
  id: string;
  label: string;
  depth?: number;
  badge?: string;
};

const RAIL_X = 6;
const LABEL_GAP = 14;
const TRAVEL_SPRING = { stiffness: 150, damping: 26, mass: 0.6 };
const TURN_SPRING = { stiffness: 260, damping: 30 };
const TURN_SLACK = 2;

const PLANE = "M12 2 20.5 21 12 17.5 3.5 21z";
const PLANE_HOLE = 4.5;

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type Point = { x: number; y: number };
type Geometry = { nodes: Point[]; d: string; width: number; height: number };

function buildPath(nodes: Point[]) {
  if (nodes.length === 0) return "";
  const points: Point[] = [{ x: nodes[0].x, y: 0 }, nodes[0]];
  for (let i = 1; i < nodes.length; i++) {
    const from = nodes[i - 1];
    const to = nodes[i];
    if (from.x !== to.x) {
      const bend = (to.y - from.y) * 0.3;
      points.push({ x: from.x, y: from.y + bend }, { x: to.x, y: to.y - bend });
    }
    points.push(to);
  }
  return points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
}

function lengthAtY(path: SVGPathElement, total: number, y: number) {
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (path.getPointAtLength(mid).y < y) lo = mid;
    else hi = mid;
  }
  return hi;
}

export type RailTocProps = React.ComponentProps<"nav"> & {
  items: RailTocItem[];
  containerRef?: React.RefObject<HTMLElement | null>;
  offset?: number;
  indent?: number;
  title?: string;
  accentColor?: string;
  onItemSelect?: (item: RailTocItem, index: number) => void;
};

const RailToc = ({
  className,
  items,
  containerRef,
  offset = 96,
  indent = 14,
  title = "章节导航",
  accentColor = "#d97706",
  onItemSelect,
  ...props
}: RailTocProps) => {
  const reduceMotion = useReducedMotion();
  const maskId = `rail-toc-${React.useId().replace(/[^\w-]/g, "")}`;

  const listRef = React.useRef<HTMLUListElement>(null);
  const rowRefs = React.useRef<(HTMLLIElement | null)[]>([]);
  const pathRef = React.useRef<SVGPathElement>(null);
  const holeRefs = React.useRef<(SVGCircleElement | null)[]>([]);

  const [geometry, setGeometry] = React.useState<Geometry>();
  const [reached, setReached] = React.useState(1);

  const lengths = React.useRef<number[]>([]);
  const total = React.useRef(0);
  const placed = React.useRef(false);
  const pinned = React.useRef<number | null>(null);
  const userScrolled = React.useRef(false);
  const facing = React.useRef<1 | -1>(1);
  const turnFrom = React.useRef(0);

  const target = useMotionValue(0);
  const travel = useSpring(target, TRAVEL_SPRING);
  const distance = reduceMotion ? target : travel;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const heading = useMotionValue(180);
  const turn = useSpring(heading, TURN_SPRING);
  const filled = useMotionValue(0);

  const pose = React.useCallback(
    (l: number) => {
      const path = pathRef.current;
      const length = total.current;
      if (
        !path ||
        !length ||
        typeof path.getPointAtLength !== "function"
      ) {
        return;
      }
      const at = path.getPointAtLength(l);
      const behind = path.getPointAtLength(Math.max(0, l - 1));
      const ahead = path.getPointAtLength(Math.min(length, l + 1));
      x.set(at.x);
      holeRefs.current.forEach((hole) => {
        hole?.setAttribute("cx", `${at.x}`);
        hole?.setAttribute("cy", `${at.y}`);
      });
      y.set(at.y);
      const angle =
        (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI +
        90 +
        (facing.current < 0 ? 180 : 0);
      const prev = heading.get();
      heading.set(angle + 360 * Math.round((prev - angle) / 360));
      filled.set(l / length);
      setReached(lengths.current.filter((n) => n <= l + 0.5).length);
    },
    [x, y, heading, filled]
  );

  useMotionValueEvent(distance, "change", pose);

  const aim = React.useCallback(
    (next: number) => {
      const from = turnFrom.current;
      if ((next - from) * facing.current > 0) turnFrom.current = next;
      else if (Math.abs(next - from) > TURN_SLACK) {
        facing.current = facing.current > 0 ? -1 : 1;
        turnFrom.current = next;
      }
      target.set(next);
    },
    [target]
  );

  const sync = React.useCallback(() => {
    const nodes = lengths.current;
    if (!nodes.length) return;

    if (pinned.current !== null) {
      aim(nodes[pinned.current] ?? nodes[0]);
      return;
    }

    const scroller = containerRef?.current;
    const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
    const viewHeight = scroller ? scroller.clientHeight : window.innerHeight;
    const scrollHeight = scroller
      ? scroller.scrollHeight
      : document.documentElement.scrollHeight;
    const originTop = scroller ? scroller.getBoundingClientRect().top : 0;

    const remaining = Math.max(0, scrollHeight - viewHeight - scrollTop);
    const line = Math.min(offset, scrollTop);
    const anchor = line + Math.max(0, viewHeight - line - remaining);

    const tops = items.map((item) => {
      if (item.id === "__top__") {
        return -scrollTop;
      }
      const el = document.getElementById(item.id);
      return el ? el.getBoundingClientRect().top - originTop : Infinity;
    });

    const index = tops.findLastIndex((top) => top <= anchor);
    let next: number;
    if (index === -1) next = nodes[0];
    else if (index === nodes.length - 1) next = nodes[index];
    else {
      const span = tops[index + 1] - tops[index];
      const progress = Number.isFinite(span) && span > 0 ? (anchor - tops[index]) / span : 0;
      next =
        nodes[index] +
        Math.min(1, Math.max(0, progress)) * (nodes[index + 1] - nodes[index]);
    }

    aim(next);
    if (!placed.current) {
      placed.current = true;
      travel.jump(next);
      pose(next);
      turn.jump(heading.get());
    }
  }, [containerRef, items, offset, aim, travel, turn, heading, pose]);

  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !items.length) return;

    const measure = () => {
      const nodes = items.map((item, i) => {
        const row = rowRefs.current[i];
        return {
          x: RAIL_X + (item.depth ?? 0) * indent,
          y: row ? row.offsetTop + row.offsetHeight / 2 : i * 32 + 16,
        };
      });
      setGeometry({
        nodes,
        d: buildPath(nodes),
        width: Math.max(...nodes.map((n) => n.x)) + RAIL_X + 6,
        height: Math.max(list.offsetHeight, nodes.length * 24),
      });
    };

    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(list);
    }
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => ro?.disconnect();
  }, [items, indent]);

  useIsoLayoutEffect(() => {
    const path = pathRef.current;
    if (
      !path ||
      !geometry ||
      typeof path.getTotalLength !== "function" ||
      typeof path.getPointAtLength !== "function"
    ) {
      return;
    }
    total.current = path.getTotalLength();
    lengths.current = geometry.nodes.map((n) =>
      lengthAtY(path, total.current, n.y)
    );
    sync();
    pose(distance.get());
  }, [geometry, sync, pose, distance]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const scroller = containerRef?.current ?? window;
    const onIntent = () => {
      userScrolled.current = true;
    };
    const onScroll = () => {
      if (pinned.current !== null && userScrolled.current) pinned.current = null;
      sync();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", onIntent, { passive: true });
    scroller.addEventListener("touchstart", onIntent, { passive: true });
    scroller.addEventListener("pointerdown", onIntent);
    window.addEventListener("keydown", onIntent);
    window.addEventListener("resize", sync);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("wheel", onIntent);
      scroller.removeEventListener("touchstart", onIntent);
      scroller.removeEventListener("pointerdown", onIntent);
      window.removeEventListener("keydown", onIntent);
      window.removeEventListener("resize", sync);
    };
  }, [containerRef, sync]);

  const select = (index: number) => {
    const item = items[index];
    if (!item) return;
    pinned.current = index;
    userScrolled.current = false;
    sync();

    const scroller = containerRef?.current;
    const behavior = reduceMotion ? "auto" : "smooth";

    if (item.id === "__top__") {
      (scroller ?? window).scrollTo({ top: 0, behavior });
    } else {
      const el = document.getElementById(item.id);
      if (el) {
        const top = scroller
          ? el.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top +
            scroller.scrollTop
          : el.getBoundingClientRect().top + window.scrollY;
        (scroller ?? window).scrollTo({ top: Math.max(0, top - offset), behavior });
      }
    }
    setReached(index + 1);
    onItemSelect?.(item, index);
  };

  const active = Math.max(0, reached - 1);

  return (
    <nav
      data-slot="rail-toc"
      aria-label={title}
      className={cn("w-full text-xs sm:text-[13px]", className)}
      style={{ ["--rail" as string]: accentColor, color: "var(--prism-ink)" }}
      {...props}
    >
      <p
        data-slot="rail-toc-title"
        className="mb-2.5 flex items-center gap-2 px-1 font-mono text-[11px] font-semibold tracking-wider uppercase"
        style={{ color: "var(--prism-ink-muted)" }}
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M2 4h12M2 8h8M2 12h10" />
        </svg>
        <span>{title}</span>
      </p>

      <ul ref={listRef} data-slot="rail-toc-list" className="relative">
        {geometry && geometry.nodes.length > 0 && (
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={geometry.width}
            height={geometry.height}
            aria-hidden
          >
            <linearGradient
              id={`${maskId}-fade`}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={0}
              x2={0}
              y2={Math.max(4, geometry.nodes[0].y - 4)}
            >
              <stop offset="0" stopColor="black" />
              <stop offset="1" stopColor="white" />
            </linearGradient>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={-8}
              y={-8}
              width={geometry.width + 16}
              height={geometry.height + 16}
            >
              <rect
                x={-8}
                y={-8}
                width={geometry.width + 16}
                height={geometry.height + 16}
                fill={`url(#${maskId}-fade)`}
              />
              {geometry.nodes.map((node, i) => (
                <circle key={i} cx={node.x} cy={node.y} r={4} fill="black" />
              ))}
              <circle
                ref={(el) => {
                  holeRefs.current[0] = el;
                }}
                r={PLANE_HOLE}
                fill="black"
              />
            </mask>
            <mask
              id={`${maskId}-nodes`}
              maskUnits="userSpaceOnUse"
              x={-8}
              y={-8}
              width={geometry.width + 16}
              height={geometry.height + 16}
            >
              <rect
                x={-8}
                y={-8}
                width={geometry.width + 16}
                height={geometry.height + 16}
                fill="white"
              />
              <circle
                ref={(el) => {
                  holeRefs.current[1] = el;
                }}
                r={PLANE_HOLE}
                fill="black"
              />
            </mask>
            <g mask={`url(#${maskId})`}>
              <path
                ref={pathRef}
                d={geometry.d}
                fill="none"
                strokeWidth="1.4"
                strokeDasharray="2 5"
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke="currentColor"
                strokeOpacity={0.22}
              />
              <motion.path
                d={geometry.d}
                fill="none"
                strokeWidth="1.5"
                stroke="var(--rail)"
                strokeLinejoin="round"
                style={{ pathLength: filled }}
              />
            </g>
            <g mask={`url(#${maskId}-nodes)`}>
              {geometry.nodes.map((node, i) => {
                const covered = i < reached;
                return (
                  <circle
                    key={items[i]?.id ?? i}
                    cx={node.x}
                    cy={node.y}
                    r={covered ? 3 : 3.25}
                    strokeWidth="1.35"
                    className="transition-[fill,stroke] duration-200"
                    style={
                      covered
                        ? { fill: "var(--rail)", stroke: "var(--rail)" }
                        : {
                            fill: "transparent",
                            stroke: "var(--prism-border-strong, rgba(148,163,184,0.45))",
                          }
                    }
                  />
                );
              })}
            </g>
          </svg>
        )}

        {geometry && (
          <motion.div
            data-slot="rail-toc-plane"
            className="pointer-events-none absolute left-0 top-0 -ml-2 -mt-2 h-4 w-4 [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.28))]"
            style={{
              x,
              y,
              rotate: reduceMotion ? heading : turn,
              color: "var(--prism-heading)",
            }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 overflow-visible">
              <path
                d={PLANE}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}

        {items.map((item, i) => {
          const isActive = i === active;
          return (
            <li
              key={item.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
            >
              <button
                type="button"
                data-testid={`rail-toc-item-${item.id}`}
                onClick={() => select(i)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg py-1.5 pr-2 text-left leading-5 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50",
                  isActive ? "font-semibold" : "hover:bg-amber-500/8"
                )}
                style={{
                  paddingLeft: RAIL_X + (item.depth ?? 0) * indent + LABEL_GAP,
                  color: isActive ? "var(--prism-heading)" : "var(--prism-ink-muted)",
                }}
              >
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded-full border shrink-0"
                    style={{
                      background: "var(--prism-surface-subtle)",
                      borderColor: "var(--prism-border)",
                      color: "var(--prism-ink-muted)",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export { RailToc };
export default RailToc;
