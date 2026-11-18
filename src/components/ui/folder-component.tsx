"use client";

/**
 * Based on Rare UI Folder Component (`swamimalode07/rare-ui/folder-component`).
 * Original work © Rare UI (https://rareui.com), adapted for PurrParse library preview & expansion.
 */

import React, { useId, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const themes = {
  black: {
    backFill: "#0f172a",
    backInsetShadow: "inset 0 0 6px 2px rgba(255,255,255,0.28)",
    flapFill: "#1e293b",
    flapFillOpacity: 0.45,
    flapStroke: "#94a3b8",
    flapInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.14 0",
    flapText: "#f8fafc",
    flapSubText: "rgba(226, 232, 240, 0.78)",
    cardFill: "#F8F7F4",
    cardStroke: "#E2DED5",
    cardLineFill: "#D6D1C7",
    cardText: "#1a2744",
    cardSubText: "#64748b",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0",
  },
  navy: {
    backFill: "#15213b",
    backInsetShadow: "inset 0 0 8px 2px rgba(252, 211, 77, 0.22)",
    flapFill: "#203258",
    flapFillOpacity: 0.62,
    flapStroke: "#93a8cf",
    flapInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.18 0",
    flapText: "#fef3c7",
    flapSubText: "rgba(226, 232, 240, 0.85)",
    cardFill: "#FCF9F2",
    cardStroke: "#DDD3C0",
    cardLineFill: "#DFD7C8",
    cardText: "#1a2744",
    cardSubText: "#6b6254",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0",
  },
  white: {
    backFill: "#ffffff",
    backInsetShadow: "inset 0 0 6px 2px rgba(178,178,178,0.25)",
    flapFill: "#f5f5f5",
    flapFillOpacity: 0.85,
    flapStroke: "#d4d4d4",
    flapInsetColor: "0 0 0 0 0.6 0 0 0 0 0.6 0 0 0 0 0.6 0 0 0 0.15 0",
    flapText: "#0f172a",
    flapSubText: "rgba(51, 65, 85, 0.78)",
    cardFill: "#1e293b",
    cardStroke: "#334155",
    cardLineFill: "#475569",
    cardText: "#f8fafc",
    cardSubText: "#cbd5e1",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0",
  },
  blue: {
    backFill: "#3B9AE8",
    backInsetShadow: "inset 0 0 6px 2px rgba(255,255,255,0.35)",
    flapFill: "#50B1FD",
    flapFillOpacity: 0.56,
    flapStroke: "#93D5FF",
    flapInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.16 0",
    flapText: "#ffffff",
    flapSubText: "rgba(255, 255, 255, 0.9)",
    cardFill: "#FCFBF8",
    cardStroke: "#E2DDD2",
    cardLineFill: "#DDD6C7",
    cardText: "#1a2744",
    cardSubText: "#64748b",
    cardInsetColor: "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0",
  },
} as const;

const sizeScales = {
  sm: 0.68,
  md: 1,
  lg: 1.35,
} as const;

export interface FolderDocumentPreview {
  id: string;
  title: string;
  modeName?: string;
  masteryPercent?: number;
}

type FolderComponentProps = Omit<React.ComponentProps<"div">, "color"> & {
  color?: keyof typeof themes;
  size?: "sm" | "md" | "lg";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  items?: FolderDocumentPreview[];
  folderLabel?: string;
  itemCount?: number;
  compactOpenLift?: boolean;
  onSelectItem?: (itemId: string) => void;
};

const BASE_WIDTH = 321;
const BASE_HEIGHT = 270;

const FLAP_PATH =
  "M0 25C0 11.1929 11.1929 0 25 0H136.084C143.044 0 149.689 2.90139 154.42 8.00608L178.08 33.5343C182.811 38.639 189.456 41.5404 196.416 41.5404H296C309.807 41.5404 321 52.7333 321 66.5404V216C321 229.807 309.807 241 296 241H25C11.1929 241 0 229.807 0 216V25Z";

type FolderTheme = (typeof themes)[keyof typeof themes];

function PreviewCard({
  uid,
  slotIndex,
  theme,
  item,
  onSelect,
}: {
  uid: string;
  slotIndex: number;
  theme: FolderTheme;
  item?: FolderDocumentPreview;
  onSelect?: () => void;
}) {
  if (!item) {
    return <WireframeCard id={`${uid}-${slotIndex}`} theme={theme} />;
  }

  return (
    <div
      data-slot="folder-card"
      onClick={(e) => {
        if (!onSelect) return;
        e.stopPropagation();
        onSelect();
      }}
      title={item.title}
      className={cn(
        "w-[163px] h-[213px] rounded-[20px] p-3.5 flex flex-col justify-between shadow-md border transition-shadow",
        onSelect ? "hover:shadow-lg cursor-pointer" : ""
      )}
      style={{
        backgroundColor: theme.cardFill,
        borderColor: theme.cardStroke,
        color: theme.cardText,
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-1">
          <span
            className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-[100px]"
            style={{
              backgroundColor: theme.cardLineFill,
              color: theme.cardText,
            }}
          >
            {item.modeName ?? "精读"}
          </span>
          {typeof item.masteryPercent === "number" && (
            <span
              className="font-mono text-[9px]"
              style={{ color: theme.cardSubText }}
            >
              {item.masteryPercent}%
            </span>
          )}
        </div>

        <p
          className="font-serif text-[12px] font-semibold leading-snug line-clamp-3"
          style={{ color: theme.cardText }}
        >
          {item.title}
        </p>

        <div className="space-y-1.5 pt-1 opacity-70">
          <div className="h-1.5 rounded-full w-4/5" style={{ backgroundColor: theme.cardLineFill }} />
          <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: theme.cardLineFill }} />
          <div className="h-1.5 rounded-full w-2/3" style={{ backgroundColor: theme.cardLineFill }} />
        </div>
      </div>

      <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: theme.cardLineFill }}>
        <div
          className="h-full bg-amber-500"
          style={{ width: `${Math.max(8, item.masteryPercent ?? 10)}%` }}
        />
      </div>
    </div>
  );
}

const WireframeCard = ({ id, theme }: { id: string; theme: FolderTheme }) => {
  const filterId = `filter0_i_card_${id}`;
  return (
    <div data-slot="folder-card">
      <svg
        width="164"
        height="214"
        viewBox="0 0 164 214"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g filter={`url(#${filterId})`}>
          <rect
            width="163.078"
            height="213.262"
            rx="20"
            fill={theme.cardFill}
          />
        </g>
        <rect
          x="0.5"
          y="0.5"
          width="162.078"
          height="212.262"
          rx="19.5"
          stroke={theme.cardStroke}
        />
        <rect
          x="14.1193"
          y="31.2091"
          width="134.84"
          height="11.8892"
          rx="5.94459"
          fill={theme.cardLineFill}
        />
        <rect
          width="64.5183"
          height="5.88276"
          rx="2.94138"
          transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 60.9939)"
          fill={theme.cardLineFill}
        />
        <rect
          width="64.5183"
          height="5.88276"
          rx="2.94138"
          transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 60.9617)"
          fill={theme.cardLineFill}
        />
        <rect
          width="64.5183"
          height="5.88276"
          rx="2.94138"
          transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 75.1122)"
          fill={theme.cardLineFill}
        />
        <rect
          width="64.5183"
          height="5.88276"
          rx="2.94138"
          transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 75.0801)"
          fill={theme.cardLineFill}
        />
        <rect
          width="64.5183"
          height="5.88276"
          rx="2.94138"
          transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 89.2306)"
          fill={theme.cardLineFill}
        />
        <rect
          width="64.5183"
          height="5.88276"
          rx="2.94138"
          transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 89.1985)"
          fill={theme.cardLineFill}
        />
        <defs>
          <filter
            id={filterId}
            x="0"
            y="0"
            width="166.078"
            height="218.262"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feMorphology
              radius="2"
              operator="erode"
              in="SourceAlpha"
              result={`effect1_innerShadow_${id}`}
            />
            <feOffset dx="3" dy="5" />
            <feGaussianBlur stdDeviation="3.05" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values={theme.cardInsetColor} />
            <feBlend
              mode="normal"
              in2="shape"
              result={`effect1_innerShadow_${id}`}
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
};

const FolderComponent = ({
  color = "black",
  size = "md",
  open,
  onOpenChange,
  items,
  folderLabel,
  itemCount,
  compactOpenLift = false,
  onSelectItem,
  className,
  onClick,
  ...props
}: FolderComponentProps) => {
  const reactId = useId();
  const uid = reactId.replace(/:/g, "");
  const flapFilterId = `filter0_i_flap_${uid}`;
  const theme = themes[color] ?? themes.black;
  const scale = sizeScales[size];
  const [isHovered, setIsHovered] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleToggle = (e: React.MouseEvent<HTMLDivElement>) => {
    const next = !isOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    onClick?.(e);
  };

  const card1 = items?.[2];
  const card2 = items?.[1];
  const card3 = items?.[0];

  const lift1 = compactOpenLift ? -64 : -160;
  const lift2 = compactOpenLift ? -76 : -180;
  const lift3 = compactOpenLift ? -68 : -170;

  return (
    <div
      data-slot="folder"
      className={cn(
        "relative flex flex-col items-center justify-center",
        className
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={folderLabel ?? "展开文库文件夹"}
        className="relative cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-3xl"
        style={{
          width: BASE_WIDTH * scale,
          height: BASE_HEIGHT * scale,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isControlled) {
            setInternalOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const next = !isOpen;
            if (!isControlled) setInternalOpen(next);
            onOpenChange?.(next);
          }
        }}
        {...props}
        onClick={handleToggle}
      >
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
            perspective: 800 * scale,
          }}
        >
          {/* Back cover */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              style={{
                width: BASE_WIDTH,
                height: BASE_HEIGHT,
                borderRadius: 25,
                backgroundColor: theme.backFill,
                boxShadow: theme.backInsetShadow,
              }}
            />
          </div>

          {/* 3 Fanned cards inside folder */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <motion.div
              className="absolute"
              animate={{
                y: isOpen ? lift1 : isHovered ? -34 : -10,
                x: isOpen ? 68 : isHovered ? 48 : 38,
                rotate: isOpen ? 16 : isHovered ? 14 : 10,
              }}
              transition={{
                type: "spring",
                stiffness: 150,
                damping: 15,
                delay: isOpen ? 0.08 : isHovered ? 0.1 : 0,
              }}
            >
              <PreviewCard
                uid={uid}
                slotIndex={1}
                theme={theme}
                item={card1}
                onSelect={card1 && isOpen && onSelectItem ? () => onSelectItem(card1.id) : undefined}
              />
            </motion.div>

            <motion.div
              className="absolute"
              animate={{
                y: isOpen ? lift2 : isHovered ? -42 : -20,
                x: isOpen ? 0 : 2,
                rotate: isOpen ? -2 : isHovered ? -1 : 2,
              }}
              transition={{
                type: "spring",
                stiffness: 150,
                damping: 15,
                delay: isOpen ? 0.04 : isHovered ? 0.05 : 0,
              }}
            >
              <PreviewCard
                uid={uid}
                slotIndex={2}
                theme={theme}
                item={card2}
                onSelect={card2 && isOpen && onSelectItem ? () => onSelectItem(card2.id) : undefined}
              />
            </motion.div>

            <motion.div
              className="absolute"
              animate={{
                y: isOpen ? lift3 : isHovered ? -46 : -22,
                x: isOpen ? -64 : isHovered ? -46 : -38,
                rotate: isOpen ? -13 : isHovered ? -9 : -5,
              }}
              transition={{
                type: "spring",
                stiffness: 150,
                damping: 15,
              }}
            >
              <PreviewCard
                uid={uid}
                slotIndex={3}
                theme={theme}
                item={card3}
                onSelect={card3 && isOpen && onSelectItem ? () => onSelectItem(card3.id) : undefined}
              />
            </motion.div>
          </div>

          {/* Translucent Frosted 3D Front Flap */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-4"
            style={{
              transformOrigin: "bottom center",
              transformStyle: "preserve-3d",
              width: 321,
              height: 241,
            }}
            animate={{ rotateX: isOpen ? -55 : isHovered ? -42 : -15 }}
            transition={{ type: "spring", stiffness: 140, damping: 16 }}
          >
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                clipPath: `path('${FLAP_PATH}')`,
                WebkitClipPath: `path('${FLAP_PATH}')`,
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                willChange: "transform",
              }}
            />
            <svg
              className="absolute inset-0"
              width="321"
              height="241"
              viewBox="0 0 321 241"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g filter={`url(#${flapFilterId})`}>
                <path
                  d={FLAP_PATH}
                  fill={theme.flapFill}
                  fillOpacity={theme.flapFillOpacity}
                />
                <path
                  d="M25 0.5H136.084C142.905 0.5 149.417 3.3431 154.054 8.3457L177.713 33.874C182.539 39.0808 189.317 42.04 196.416 42.04H296C309.531 42.04 320.5 53.0092 320.5 66.54V216C320.5 229.531 309.531 240.5 296 240.5H25C11.469 240.5 0.5 229.531 0.5 216V25C0.5 11.469 11.469 0.5 25 0.5Z"
                  stroke={theme.flapStroke}
                />
              </g>
              <defs>
                <filter
                  id={flapFilterId}
                  x="-25.4"
                  y="-25.4"
                  width="371.8"
                  height="291.8"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feBlend
                    mode="normal"
                    in="SourceGraphic"
                    in2="BackgroundImageFix"
                    result="shape"
                  />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset />
                  <feGaussianBlur stdDeviation="2.65" />
                  <feComposite
                    in2="hardAlpha"
                    operator="arithmetic"
                    k2="-1"
                    k3="1"
                  />
                  <feColorMatrix type="matrix" values={theme.flapInsetColor} />
                  <feBlend
                    mode="normal"
                    in2="shape"
                    result={`effect1_innerShadow_${uid}`}
                  />
                </filter>
              </defs>
            </svg>

          </motion.div>
        </div>
      </div>

      {(folderLabel || itemCount !== undefined) && (
        <div className="mt-2.5 flex items-center justify-center gap-2 select-none">
          {folderLabel && (
            <span
              className="font-mono text-[11px] font-medium tracking-tight"
              style={{ color: "var(--prism-ink-muted)" }}
            >
              {folderLabel}
            </span>
          )}
          {itemCount !== undefined && (
            <span
              className="font-mono text-[10.5px] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                background: "var(--prism-surface-subtle)",
                borderColor: "var(--prism-border)",
                color: "var(--prism-heading)",
              }}
            >
              {itemCount} 篇
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default FolderComponent;

export { FolderComponent as Folder };
export type { FolderComponentProps };
