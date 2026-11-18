"use client";

/**
 * Based on Rare UI ThemeSelector (`swamimalode07/rare-ui/theme-selector`).
 * Original work © Rare UI (https://rareui.com), adapted for PurrParse theme palettes & contrast safety.
 */

import {
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

export type ThemePalette = {
  sidebar: string;
  panel: string;
  border: string;
  strong: string;
  muted: string;
  tile: string;
  accent?: string;
};

export type ThemeOption = {
  value: string;
  label: string;
  subtitle?: string;
  colors: ThemePalette;
};

export const DEFAULT_THEMES: ThemeOption[] = [
  {
    value: "paper",
    label: "稿纸朱批 Paper",
    subtitle: "暖白书页质感",
    colors: {
      sidebar: "#efe6d4",
      panel: "#fcf9f2",
      border: "rgba(140, 122, 107, 0.24)",
      strong: "#1a2744",
      muted: "#ddd2be",
      tile: "#f3ecde",
      accent: "#d97706",
    },
  },
  {
    value: "aurora",
    label: "极光夜空 Aurora",
    subtitle: "深空护眼夜读",
    colors: {
      sidebar: "#0b111e",
      panel: "#121b2d",
      border: "rgba(96, 165, 250, 0.24)",
      strong: "#e2e8f0",
      muted: "#1e2c47",
      tile: "#162238",
      accent: "#60a5fa",
    },
  },
  {
    value: "studio",
    label: "极简纯白 Studio",
    subtitle: "高对比纯净画布",
    colors: {
      sidebar: "#f1f5f9",
      panel: "#ffffff",
      border: "rgba(15, 23, 42, 0.12)",
      strong: "#0f172a",
      muted: "#cbd5e1",
      tile: "#f8fafc",
      accent: "#3b82f6",
    },
  },
];

const bar = "block h-[2.2cqw] rounded-full";

function Preview({ colors }: { colors: ThemePalette }) {
  const vars = {
    "--ts-sidebar": colors.sidebar,
    "--ts-panel": colors.panel,
    "--ts-border": colors.border,
    "--ts-strong": colors.strong,
    "--ts-muted": colors.muted,
    "--ts-tile": colors.tile,
    "--ts-accent": colors.accent ?? colors.strong,
  } as CSSProperties;

  return (
    <span
      aria-hidden
      data-slot="theme-selector-preview"
      style={vars}
      className="absolute -bottom-[10cqw] -right-[10cqw] left-[12cqw] top-[12cqw] flex rounded-tl-[5cqw] bg-(--ts-sidebar) shadow-[0_0_0_1px_var(--ts-border),0_1px_3px_rgba(0,0,0,0.08)]"
    >
      <span className="flex w-[25cqw] shrink-0 flex-col px-[3cqw] pb-[14cqw] pt-[4cqw]">
        <span className="flex gap-[1.3cqw] px-[1.2cqw]">
          <span className="size-[2cqw] rounded-full bg-(--ts-accent)" />
          <span className="size-[2cqw] rounded-full bg-(--ts-muted)" />
          <span className="size-[2cqw] rounded-full bg-(--ts-muted)" />
        </span>
        <span className="mt-[4cqw] flex flex-col gap-[1cqw]">
          <span className="flex h-[4.6cqw] items-center rounded-[1.6cqw] bg-(--ts-muted) px-[1.2cqw]">
            <span className={cn(bar, "w-[10cqw] bg-(--ts-strong)")} />
          </span>
          <span className="flex h-[4.6cqw] items-center px-[1.2cqw]">
            <span className={cn(bar, "w-[13cqw] bg-(--ts-muted)")} />
          </span>
          <span className="flex h-[4.6cqw] items-center px-[1.2cqw]">
            <span className={cn(bar, "w-[8cqw] bg-(--ts-muted)")} />
          </span>
        </span>
        <span className="mt-auto flex items-center gap-[1.6cqw] px-[1.2cqw]">
          <span className="size-[4.4cqw] shrink-0 rounded-full bg-(--ts-accent)" />
          <span className={cn(bar, "w-[7cqw] bg-(--ts-muted)")} />
        </span>
      </span>
      <span className="mt-[3cqw] flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-[4cqw] bg-(--ts-panel) pl-[5cqw] pt-[5cqw] shadow-[0_0_0_1px_var(--ts-border)]">
        <span className="flex flex-col gap-[2cqw]">
          <span className={cn(bar, "w-[14cqw] bg-(--ts-strong)")} />
          <span className={cn(bar, "w-[22cqw] bg-(--ts-muted)")} />
        </span>
        <span className="mt-[5cqw] flex gap-[2.5cqw]">
          {[0, 1, 2].map((tile) => (
            <span
              key={tile}
              className="h-[12cqw] w-[19cqw] shrink-0 rounded-[2.4cqw] bg-(--ts-tile) shadow-[0_0_0_1px_var(--ts-border)]"
            />
          ))}
        </span>
        <span className="mt-[2.5cqw] h-[20cqw] w-[70cqw] shrink-0 rounded-[2.4cqw] bg-(--ts-tile) shadow-[0_0_0_1px_var(--ts-border)]" />
      </span>
    </span>
  );
}

const STEPS = new Map([
  ["ArrowRight", 1],
  ["ArrowDown", 1],
  ["ArrowLeft", -1],
  ["ArrowUp", -1],
]);

const ring =
  "pointer-events-none absolute -inset-[3.5px] rounded-[15.5px] sm:rounded-[19.5px] transition-opacity duration-150 motion-reduce:transition-none";

export type ThemeSelectorProps = Omit<
  ComponentProps<"div">,
  "defaultValue" | "onChange"
> & {
  themes?: ThemeOption[];
  value?: string | null;
  defaultValue?: string;
  onChange?: (value: string) => void;
  labels?: boolean;
  disabled?: boolean;
  itemClassName?: string;
};

export function ThemeSelector({
  themes = DEFAULT_THEMES,
  value,
  defaultValue,
  onChange,
  labels = true,
  disabled,
  className,
  itemClassName,
  ...props
}: ThemeSelectorProps) {
  const [uncontrolled, setUncontrolled] = useState(
    defaultValue ?? themes[0]?.value
  );
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = value === undefined ? uncontrolled : value;
  const selectedIndex = themes.findIndex((theme) => theme.value === selected);

  const select = (next: string) => {
    if (next === selected) return;
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = STEPS.get(event.key);
    let target: number;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = themes.length - 1;
    else if (step) target = (index + step + themes.length) % themes.length;
    else return;
    event.preventDefault();
    items.current[target]?.focus();
    select(themes[target].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="主题质感选择"
      aria-disabled={disabled || undefined}
      data-slot="theme-selector"
      {...props}
      className={cn(
        "grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 min-w-0",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {themes.map((theme, index) => {
        const active = theme.value === selected;

        return (
          <div
            key={theme.value}
            data-slot="theme-selector-option"
            className="flex min-w-0 flex-col items-center gap-2"
          >
            <button
              ref={(el) => {
                items.current[index] = el;
              }}
              type="button"
              role="radio"
              data-testid={`theme-selector-item-${theme.value}`}
              aria-checked={active}
              aria-label={theme.label}
              tabIndex={(selectedIndex === -1 ? index === 0 : active) ? 0 : -1}
              disabled={disabled}
              data-slot="theme-selector-item"
              data-state={active ? "checked" : "unchecked"}
              onClick={() => select(theme.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "group relative aspect-[4/3] w-full max-w-[200px] cursor-pointer outline-none",
                itemClassName
              )}
            >
              <span className="@container absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl bg-[#ebe4d5] transition-colors duration-150 group-hover:bg-[#e3dac7] motion-reduce:transition-none">
                <Preview colors={theme.colors} />
              </span>
              <span
                className={cn(
                  ring,
                  "border border-[#1a2744]/15 opacity-0",
                  !active && "group-hover:opacity-100"
                )}
              />
              <span
                data-slot="theme-selector-ring"
                className={cn(
                  ring,
                  "border-2 border-[#1a2744]",
                  active ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="pointer-events-none absolute -inset-[7px] rounded-[19px] border-[1.5px] sm:rounded-[23px] border-amber-500/0 transition-colors group-focus-visible:border-amber-500/75" />
            </button>
            {labels && (
              <div className="text-center leading-tight">
                <div
                  data-slot="theme-selector-label"
                  className={cn(
                    "font-mono text-xs transition-colors duration-150 motion-reduce:transition-none",
                    active ? "font-semibold text-[#1a2744]" : "font-medium text-slate-600"
                  )}
                >
                  {theme.label}
                </div>
                {theme.subtitle && (
                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                    {theme.subtitle}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ThemeSelector;
