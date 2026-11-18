"use client";

/**
 * Based on Rare UI ProximitySidebar (`swamimalode07/rare-ui/proximity-sidebar`).
 * Original work © Rare UI (https://rareui.com), adapted for PurrParse with intermediate virtual ruler ticks.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";

type Side = "left" | "right";
type SectionKind = "title" | "subtitle" | "section" | "body";
type SectionLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type ProximitySection = {
  id: string;
  label: string;
  kind?: SectionKind;
  level?: SectionLevel;
};

type DashPreset = {
  base: number;
  bump: number;
  thickness: number;
};

type TrackNode =
  | {
      type: "real";
      key: string;
      section: ProximitySection;
    }
  | {
      type: "virtual";
      key: string;
      prevSectionId: string;
      nextSectionId: string;
      ratio: number;
    };

type DashProps = {
  active: boolean;
  hovered: boolean;
  mouseY: MotionValue<number>;
  onHoverChange: (id: string | null) => void;
  onSelect: (id: string) => void;
  registerDash: (id: string, node: HTMLButtonElement | null) => void;
  section: ProximitySection;
  sectionKind: SectionKind;
  side: Side;
  rowPaddingClass: string;
};

type VirtualDashProps = {
  mouseY: MotionValue<number>;
  prevSectionId: string;
  nextSectionId: string;
  ratio: number;
  side: Side;
  rowPaddingClass: string;
  onSelectInterpolated: (prevId: string, nextId: string, ratio: number) => void;
};

export type ProximitySidebarProps = {
  activeOffset?: number;
  scrollOffsetPx?: number;
  className?: string;
  sections: ProximitySection[];
  side?: Side;
};

const RADIUS = 56;
const MAX_DASH_WIDTH = 74;
const SCROLL_IDLE_RESET_DELAY = 90;
const TARGET_MIN_TICKS = 44;
const MAX_VIRTUAL_TICKS_PER_GAP = 6;

const DASH_PRESETS: Record<SectionKind, DashPreset> = {
  title: { base: 30, bump: 44, thickness: 2.5 },
  subtitle: { base: 24, bump: 42, thickness: 2 },
  section: { base: 18, bump: 38, thickness: 1.5 },
  body: { base: 13, bump: 34, thickness: 1.5 },
};

const VIRTUAL_PRESET: DashPreset = {
  base: 5,
  bump: 19,
  thickness: 1.5,
};

const getSectionElement = (id: string) =>
  typeof document === "undefined" ? null : document.getElementById(id);

const getSectionKind = (section: ProximitySection): SectionKind => {
  if (section.kind) return section.kind;
  if (section.level === 1) return "title";
  if (section.level === 2) return "subtitle";
  if (section.level === 3) return "section";
  return "body";
};

const getElementSectionKind = (id: string): SectionKind | undefined => {
  const heading = getSectionElement(id)?.querySelector("h1, h2, h3, h4, h5, h6");
  const tagName = heading?.tagName.toLowerCase();

  if (tagName === "h1") return "title";
  if (tagName === "h2") return "subtitle";
  if (tagName === "h3") return "section";
  if (tagName) return "body";
};

const getScrollParent = (element: HTMLElement) => {
  let parent = element.parentElement;

  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(overflowY)) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return window;
};

function buildTrackNodes(sections: ProximitySection[]): TrackNode[] {
  if (sections.length === 0) return [];
  if (sections.length === 1) {
    return [{ type: "real", key: sections[0].id, section: sections[0] }];
  }

  const gapCount = sections.length - 1;
  const ticksPerGap =
    sections.length > 52
      ? 0
      : Math.max(
          1,
          Math.min(MAX_VIRTUAL_TICKS_PER_GAP, Math.ceil((TARGET_MIN_TICKS - sections.length) / gapCount))
        );

  const nodes: TrackNode[] = [];
  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    nodes.push({
      type: "real",
      key: current.id,
      section: current,
    });

    if (i < gapCount && ticksPerGap > 0) {
      const next = sections[i + 1];
      for (let v = 0; v < ticksPerGap; v++) {
        nodes.push({
          type: "virtual",
          key: `__virtual__${current.id}__${next.id}__${v}`,
          prevSectionId: current.id,
          nextSectionId: next.id,
          ratio: (v + 1) / (ticksPerGap + 1),
        });
      }
    }
  }
  return nodes;
}

function useProximityBarScale(
  ref: React.RefObject<HTMLElement | null>,
  mouseY: MotionValue<number>,
  restWidth: number,
  expandedWidth: number
) {
  const distance = useTransform(mouseY, (y) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return RADIUS;
    return y - (rect.top + rect.height / 2);
  });

  const targetScaleX = useTransform(
    distance,
    [-RADIUS, 0, RADIUS],
    [
      restWidth / MAX_DASH_WIDTH,
      expandedWidth / MAX_DASH_WIDTH,
      restWidth / MAX_DASH_WIDTH,
    ],
    { clamp: true }
  );

  return useSpring(targetScaleX, {
    stiffness: 320,
    damping: 34,
    mass: 0.7,
  });
}

const Dash = ({
  active,
  hovered,
  mouseY,
  onHoverChange,
  onSelect,
  registerDash,
  section,
  sectionKind,
  side,
  rowPaddingClass,
}: DashProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  const preset = DASH_PRESETS[sectionKind];
  const expandedWidth = Math.min(MAX_DASH_WIDTH, preset.base + preset.bump);
  const activeRestWidth = Math.min(MAX_DASH_WIDTH, preset.base + 12);
  const restWidth = active ? activeRestWidth : preset.base;

  useEffect(() => {
    registerDash(section.id, ref.current);
    return () => registerDash(section.id, null);
  }, [registerDash, section.id]);

  const scaleX = useProximityBarScale(ref, mouseY, restWidth, expandedWidth);

  return (
    <button
      ref={ref}
      type="button"
      data-testid={`proximity-dash-${section.id}`}
      aria-current={active ? "location" : undefined}
      aria-label={`跳转到 ${section.label}`}
      onMouseEnter={() => onHoverChange(section.id)}
      onFocus={() => onHoverChange(section.id)}
      onBlur={() => onHoverChange(null)}
      onClick={() => onSelect(section.id)}
      className={cn(
        "group relative flex w-[74px] cursor-pointer items-center border-0 bg-transparent px-0 outline-none pointer-events-auto",
        rowPaddingClass,
        side === "right" ? "justify-end" : "justify-start"
      )}
    >
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, x: side === "right" ? 6 : -6, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: side === "right" ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 z-40 max-w-[230px] truncate rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium shadow-md backdrop-blur-md",
              side === "right" ? "right-[82px]" : "left-[82px]"
            )}
            style={{
              background: "var(--prism-surface, #fcf9f2)",
              borderColor: "var(--prism-border, #ddd6c7)",
              color: "var(--prism-heading, #1a2744)",
            }}
          >
            {section.label}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.span
        className="block rounded-full transition-colors duration-150 ease-out"
        style={{
          height: active ? Math.max(2.5, preset.thickness) : preset.thickness,
          scaleX,
          transformOrigin: side === "left" ? "left center" : "right center",
          width: MAX_DASH_WIDTH,
          backgroundColor: active
            ? "#d97706"
            : sectionKind === "title" || sectionKind === "subtitle"
              ? "var(--prism-heading, #1a2744)"
              : "var(--prism-ink-muted, #64748b)",
          opacity: active ? 1 : hovered ? 0.9 : sectionKind === "body" ? 0.42 : 0.68,
        }}
      />
    </button>
  );
};

const VirtualDash = ({
  mouseY,
  prevSectionId,
  nextSectionId,
  ratio,
  side,
  rowPaddingClass,
  onSelectInterpolated,
}: VirtualDashProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const expandedWidth = Math.min(MAX_DASH_WIDTH, VIRTUAL_PRESET.base + VIRTUAL_PRESET.bump);
  const scaleX = useProximityBarScale(ref, mouseY, VIRTUAL_PRESET.base, expandedWidth);

  return (
    <div
      ref={ref}
      role="presentation"
      aria-hidden="true"
      data-slot="proximity-virtual-dash"
      onClick={() => onSelectInterpolated(prevSectionId, nextSectionId, ratio)}
      className={cn(
        "relative flex w-[74px] cursor-pointer items-center px-0 pointer-events-auto",
        rowPaddingClass,
        side === "right" ? "justify-end" : "justify-start"
      )}
    >
      <motion.span
        className="block rounded-full"
        style={{
          height: VIRTUAL_PRESET.thickness,
          scaleX,
          transformOrigin: side === "left" ? "left center" : "right center",
          width: MAX_DASH_WIDTH,
          backgroundColor: "var(--prism-ink-muted, #64748b)",
          opacity: 0.24,
        }}
      />
    </div>
  );
};

const ProximitySidebar = ({
  activeOffset = 0.32,
  scrollOffsetPx = 82,
  className = "",
  side = "right",
  sections,
}: ProximitySidebarProps) => {
  const mouseY = useMotionValue(Infinity);
  const shouldReduceMotion = useReducedMotion();
  const dashRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointerInside = useRef(false);
  const resetTimer = useRef<number | null>(null);
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [detectedKinds, setDetectedKinds] = useState<Record<string, SectionKind>>({});

  const sectionIds = useMemo(
    () => sections.map((section) => section.id).join("|"),
    [sections]
  );

  const trackNodes = useMemo(() => buildTrackNodes(sections), [sections]);

  const rowPaddingClass = useMemo(() => {
    if (trackNodes.length <= 24) return "py-[5.5px]";
    if (trackNodes.length <= 42) return "py-[4.5px]";
    return "py-[3.5px]";
  }, [trackNodes.length]);

  const registerDash = useCallback(
    (id: string, node: HTMLButtonElement | null) => {
      if (node) {
        dashRefs.current.set(id, node);
        return;
      }
      dashRefs.current.delete(id);
    },
    []
  );

  const clearPendingReset = useCallback(() => {
    if (!resetTimer.current) return;
    window.clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }, []);

  const setMouseToDash = useCallback(
    (id?: string) => {
      if (!id) {
        mouseY.set(Infinity);
        return;
      }
      const node = dashRefs.current.get(id);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      mouseY.set(rect.top + rect.height / 2);
    },
    [mouseY]
  );

  const pulseDash = useCallback(
    (id?: string) => {
      setMouseToDash(id);
      clearPendingReset();
      if (!id || pointerInside.current) return;
      resetTimer.current = window.setTimeout(() => {
        mouseY.set(Infinity);
        resetTimer.current = null;
      }, SCROLL_IDLE_RESET_DELAY);
    },
    [clearPendingReset, mouseY, setMouseToDash]
  );

  const selectSection = useCallback(
    (id: string) => {
      const element = getSectionElement(id);
      if (element) {
        const targetTop =
          element.getBoundingClientRect().top + window.scrollY - scrollOffsetPx;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: shouldReduceMotion ? "auto" : "smooth",
        });
      }
      setActiveId(id);
      pulseDash(id);
    },
    [pulseDash, scrollOffsetPx, shouldReduceMotion]
  );

  const selectInterpolated = useCallback(
    (prevId: string, nextId: string, ratio: number) => {
      const prevEl = getSectionElement(prevId);
      const nextEl = getSectionElement(nextId);
      if (prevEl && nextEl) {
        const prevTop = prevEl.getBoundingClientRect().top + window.scrollY - scrollOffsetPx;
        const nextTop = nextEl.getBoundingClientRect().top + window.scrollY - scrollOffsetPx;
        const targetTop = prevTop + (nextTop - prevTop) * ratio;
        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: shouldReduceMotion ? "auto" : "smooth",
        });
        return;
      }
      const targetId =
        prevEl && !nextEl ? prevId : !prevEl && nextEl ? nextId : ratio >= 0.5 ? nextId : prevId;
      selectSection(targetId);
    },
    [scrollOffsetPx, selectSection, shouldReduceMotion]
  );

  useEffect(() => () => clearPendingReset(), [clearPendingReset]);

  useEffect(() => {
    const kinds = sections.reduce<Record<string, SectionKind>>((nextKinds, section) => {
      nextKinds[section.id] =
        section.kind || section.level
          ? getSectionKind(section)
          : getElementSectionKind(section.id) ?? getSectionKind(section);
      return nextKinds;
    }, {});
    setDetectedKinds(kinds);
  }, [sectionIds, sections]);

  useEffect(() => {
    if (!sections.length || typeof window === "undefined") return;

    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;

      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const pct = Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)));
      setScrollPercent(pct);

      const anchorY = window.innerHeight * activeOffset;
      let nextActiveId = sections[0]?.id;
      let shortestDistance = Number.POSITIVE_INFINITY;

      for (const section of sections) {
        const element = getSectionElement(section.id);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const containsAnchor = rect.top <= anchorY && rect.bottom >= anchorY;
        const distance = containsAnchor
          ? 0
          : Math.min(Math.abs(rect.top - anchorY), Math.abs(rect.bottom - anchorY));

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nextActiveId = section.id;
        }
      }

      setActiveId(nextActiveId);

      if (!pointerInside.current) {
        pulseDash(nextActiveId);
      }
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    const scrollParents = new Set<EventTarget>([window]);
    for (const section of sections) {
      const element = getSectionElement(section.id);
      if (element) scrollParents.add(getScrollParent(element));
    }

    updateActiveSection();

    for (const parent of scrollParents) {
      parent.addEventListener("scroll", scheduleUpdate, { passive: true });
    }
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      for (const parent of scrollParents) {
        parent.removeEventListener("scroll", scheduleUpdate);
      }
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [activeOffset, pulseDash, sectionIds, sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      data-slot="proximity-sidebar"
      data-testid="proximity-sidebar"
      aria-label="文章侧边阅读进度与章节小地图"
      className={cn(
        "pointer-events-none flex flex-col gap-2 select-none",
        side === "left" ? "items-start" : "items-end",
        className
      )}
    >
      <div
        data-testid="proximity-sidebar-track"
        className={cn(
          "pointer-events-auto flex flex-col px-2 py-2",
          side === "right" ? "items-end" : "items-start"
        )}
        onPointerMove={(event) => {
          clearPendingReset();
          pointerInside.current = true;
          mouseY.set(event.clientY);
        }}
        onPointerLeave={() => {
          pointerInside.current = false;
          setHoveredId(null);
          mouseY.set(Infinity);
        }}
      >
        {trackNodes.map((node) =>
          node.type === "real" ? (
            <Dash
              key={node.key}
              active={node.section.id === activeId}
              hovered={node.section.id === hoveredId}
              mouseY={mouseY}
              onHoverChange={setHoveredId}
              onSelect={selectSection}
              registerDash={registerDash}
              section={node.section}
              sectionKind={detectedKinds[node.section.id] ?? getSectionKind(node.section)}
              side={side}
              rowPaddingClass={rowPaddingClass}
            />
          ) : (
            <VirtualDash
              key={node.key}
              mouseY={mouseY}
              prevSectionId={node.prevSectionId}
              nextSectionId={node.nextSectionId}
              ratio={node.ratio}
              side={side}
              rowPaddingClass={rowPaddingClass}
              onSelectInterpolated={selectInterpolated}
            />
          )
        )}

        <div
          data-testid="proximity-sidebar-percent"
          className="mt-2 font-mono text-[10px] font-semibold tracking-tight px-1.5 py-0.5 rounded-full border backdrop-blur-sm"
          style={{
            background: "var(--prism-surface, #fcf9f2)",
            borderColor: "var(--prism-border, #ddd6c7)",
            color: "var(--prism-ink-muted, #64748b)",
          }}
        >
          {scrollPercent}%
        </div>
      </div>
    </nav>
  );
};

export { ProximitySidebar };
export default ProximitySidebar;
