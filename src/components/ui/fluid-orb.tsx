"use client";

/**
 * Based on Rare UI FluidOrb (`swamimalode07/rare-ui/fluid-orb`).
 * Original work © Rare UI (https://rareui.com), extended with aspect-aware rectangular banner mist
 * and Liquid Glass optical layers for PurrParse headers.
 */

import React, { useEffect, useRef, useState } from "react";

import type { WorkbenchThemeMode } from "@/store/workbench-store";
import { cn } from "@/lib/utils";

export type FluidOrbProps = React.ComponentProps<"div"> & {
  size?: number;
  variant?: "orb" | "banner";
  color?: string;
  secondaryColor?: string;
  opacity?: number;
};

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_secondary;
uniform float u_banner;
uniform float u_opacity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 res = max(u_resolution.xy, vec2(1.0));
  vec2 uv = gl_FragCoord.xy / res;
  float aspect = res.x / res.y;
  float t = u_time * 0.24;

  vec2 drift = vec2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1)
  );

  if (u_banner > 0.5) {
    vec2 p = vec2(uv.x * max(1.6, aspect * 0.48), uv.y * 1.25) + drift * 0.62;
    vec2 q = vec2(fbm(p + drift * 0.85), fbm(p + vec2(3.2, 1.5) - drift * 0.65));
    float f = fbm(p + 1.35 * q);
    float f2 = fbm(p * 1.4 - drift * 0.5 + 0.9 * q);

    vec3 mist = mix(u_secondary, u_color, smoothstep(0.24, 0.78, f));
    mist = mix(mist, vec3(1.0), 0.16 * smoothstep(0.55, 0.95, f2));

    float ribbon = smoothstep(0.22, 0.84, f);
    float edgeSoftness = mix(0.75, 1.0, sin(uv.y * 3.14159265));
    float alpha = clamp(mix(u_opacity * 0.16, u_opacity, ribbon) * edgeSoftness, 0.0, 0.9);
    gl_FragColor = vec4(mist * alpha, alpha);
    return;
  }

  vec2 p = vec2(uv.x * 1.8, uv.y * 1.0) + drift * 0.7;
  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(3.2, 1.5) - drift));
  float f = fbm(p + 1.2 * q);

  float g = clamp(1.0 - uv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, uv.y);
  float shade = clamp(g + (f - 0.5) * 0.8 * anchor, 0.0, 1.0);

  vec3 white = vec3(0.99, 1.0, 1.0);
  vec3 light = mix(white, u_color, 0.5);
  vec3 dark = u_color;

  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.58, 0.88, shade));

  float edge = smoothstep(0.5, 0.49, distance(uv, vec2(0.5)));
  gl_FragColor = vec4(col * edge, edge);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [0.1, 0.45, 0.95];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const FluidOrb = ({
  size = 240,
  variant = "orb",
  color = "#1A73F2",
  secondaryColor = "#8AB4F8",
  opacity = 0.42,
  className,
  style,
  ...props
}: FluidOrbProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cssFallback, setCssFallback] = useState(false);
  const appearanceRef = useRef({ color, secondaryColor, opacity });
  const drawFrameRef = useRef<(() => void) | null>(null);

  appearanceRef.current = { color, secondaryColor, opacity };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl", {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      setCssFallback(true);
      return;
    }

    const program = gl.createProgram();
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!program || !vert || !frag) {
      setCssFallback(true);
      return;
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      setCssFallback(true);
      return;
    }

    setCssFallback(false);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uColor = gl.getUniformLocation(program, "u_color");
    const uSecondary = gl.getUniformLocation(program, "u_secondary");
    const uBanner = gl.getUniformLocation(program, "u_banner");
    const uOpacity = gl.getUniformLocation(program, "u_opacity");

    gl.uniform1f(uBanner, variant === "banner" ? 1.0 : 0.0);

    const syncViewport = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      // Prefer CSS layout box (`clientWidth`/`clientHeight`) for banner mode so drawer scale-in transitions don't thrash FBO resolution.
      const layoutWidth = container.clientWidth || rect.width || 1200;
      const layoutHeight = container.clientHeight || rect.height || 48;
      const w =
        variant === "banner"
          ? Math.max(1, Math.round(layoutWidth * dpr))
          : Math.round(size * dpr);
      const h =
        variant === "banner"
          ? Math.max(1, Math.round(layoutHeight * dpr))
          : Math.round(size * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // Always push viewport + u_resolution unconditionally so recreated/relinked shaders never keep (0, 0).
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uResolution, w, h);
    };

    syncViewport();

    let ro: ResizeObserver | null = null;
    if (variant === "banner" && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(syncViewport);
      ro.observe(container);
    }
    window.addEventListener("resize", syncViewport);

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;

    const drawFrame = (now: number) => {
      const latest = appearanceRef.current;
      gl.useProgram(program);
      syncViewport();
      gl.uniform3f(uColor, ...hexToRgb(latest.color));
      gl.uniform3f(uSecondary, ...hexToRgb(latest.secondaryColor));
      gl.uniform1f(uOpacity, latest.opacity);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, reduce ? 0 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    drawFrameRef.current = () => drawFrame(performance.now());

    const loop = (now: number) => {
      drawFrame(now);
      if (!reduce) {
        raf = requestAnimationFrame(loop);
      }
    };
    loop(start);

    return () => {
      cancelAnimationFrame(raf);
      drawFrameRef.current = null;
      ro?.disconnect();
      window.removeEventListener("resize", syncViewport);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
    };
  }, [size, variant]);

  useEffect(() => {
    drawFrameRef.current?.();
  }, [color, secondaryColor, opacity]);

  return (
    <div
      ref={containerRef}
      data-slot="fluid-orb"
      data-variant={variant}
      data-fallback={cssFallback ? "css" : undefined}
      className={cn(
        "relative overflow-hidden",
        variant === "orb" ? "rounded-full" : "h-full w-full",
        className
      )}
      style={{
        ...(variant === "orb" ? { width: size, height: size } : undefined),
        ...style,
      }}
      {...props}
    >
      {variant === "banner" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(38% 150% at 14% 25%, ${color}33 0%, transparent 72%), radial-gradient(42% 160% at 78% 80%, ${secondaryColor}30 0%, transparent 72%), radial-gradient(35% 130% at 48% 10%, ${color}22 0%, transparent 70%)`,
          }}
        />
      )}
      <canvas ref={canvasRef} className="relative z-10 block h-full w-full" />
    </div>
  );
};

const GLASS_HEADER_PALETTES: Record<
  WorkbenchThemeMode,
  {
    bg: string;
    border: string;
    boxShadow: string;
    fogPrimary: string;
    fogSecondary: string;
    fogOpacity: number;
    rimGradient: string;
  }
> = {
  paper: {
    bg: "rgba(252, 249, 242, 0.62)",
    border: "rgba(198, 183, 156, 0.58)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.88), inset 0 -1px 0 rgba(140, 122, 107, 0.14), 0 8px 24px -8px rgba(96, 78, 50, 0.16)",
    fogPrimary: "#d97706",
    fogSecondary: "#4b79a1",
    fogOpacity: 0.34,
    rimGradient: "linear-gradient(90deg, transparent 4%, rgba(255,255,255,0.9) 50%, transparent 96%)",
  },
  studio: {
    bg: "rgba(255, 255, 255, 0.66)",
    border: "rgba(203, 213, 225, 0.72)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.96), inset 0 -1px 0 rgba(148, 163, 184, 0.18), 0 8px 24px -8px rgba(15, 23, 42, 0.08)",
    fogPrimary: "#2563eb",
    fogSecondary: "#38bdf8",
    fogOpacity: 0.34,
    rimGradient: "linear-gradient(90deg, transparent 4%, rgba(255,255,255,0.95) 50%, transparent 96%)",
  },
  aurora: {
    bg: "rgba(11, 17, 30, 0.56)",
    border: "rgba(96, 165, 250, 0.24)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0 rgba(96, 165, 250, 0.14), 0 10px 28px -6px rgba(2, 6, 23, 0.55)",
    fogPrimary: "#60a5fa",
    fogSecondary: "#a855f7",
    fogOpacity: 0.44,
    rimGradient:
      "linear-gradient(90deg, transparent 4%, rgba(191, 219, 254, 0.36) 50%, transparent 96%)",
  },
};

export function getTopbarGlassStyle(themeMode: WorkbenchThemeMode): React.CSSProperties {
  const palette = GLASS_HEADER_PALETTES[themeMode];
  return {
    backgroundColor: palette.bg,
    borderBottomColor: palette.border,
    boxShadow: palette.boxShadow,
    backdropFilter: "blur(24px) saturate(185%)",
    WebkitBackdropFilter: "blur(24px) saturate(185%)",
  };
}

export function TopbarGlassBackdrop({
  themeMode,
  primaryColor,
  secondaryColor,
}: {
  themeMode: WorkbenchThemeMode;
  primaryColor?: string;
  secondaryColor?: string;
}) {
  const palette = GLASS_HEADER_PALETTES[themeMode];
  return (
    <div
      aria-hidden="true"
      data-testid="topbar-glass-fog"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <FluidOrb
        variant="banner"
        color={primaryColor ?? palette.fogPrimary}
        secondaryColor={secondaryColor ?? palette.fogSecondary}
        opacity={palette.fogOpacity}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: palette.rimGradient }}
      />
    </div>
  );
}

/** Shared high-contrast ink, subtitle, badge, and ghost-button styles over frosted Liquid Glass headers. */
export function getPanelGlassTextClasses(themeMode: WorkbenchThemeMode = "paper") {
  const isDark = themeMode === "aurora";
  return {
    isDark,
    heading: isDark ? "text-white" : "text-[#1a2744]",
    subtitle: isDark
      ? "text-slate-300"
      : themeMode === "studio"
        ? "text-slate-600"
        : "text-[#5a5347]",
    ghostBtn: isDark
      ? "bg-white/12 hover:bg-white/20 text-slate-100 border border-white/12"
      : "bg-[#1a2744]/8 hover:bg-[#1a2744]/14 text-[#1a2744] border border-[#1a2744]/10",
    primaryBadge: isDark ? "bg-amber-300 text-[#0f172a]" : "bg-[#1a2744] text-amber-200",
    primaryActionBtn: isDark
      ? "bg-amber-300 hover:bg-amber-200 text-[#0f172a] font-semibold shadow-xs"
      : "bg-[#1a2744] hover:bg-[#24365c] text-amber-200 font-semibold shadow-xs",
    subtlePill: isDark
      ? "bg-white/12 text-amber-200 border border-white/12"
      : "bg-[#1a2744]/10 text-[#1a2744] border border-[#1a2744]/12",
  };
}

export interface PanelGlassHeaderProps {
  themeMode?: WorkbenchThemeMode;
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
  testId?: string;
  left: React.ReactNode;
  right?: React.ReactNode;
}

/** Unified frosted Liquid Glass + FluidOrb dynamic mist header for modals, drawers, and panels. */
export function PanelGlassHeader({
  themeMode = "paper",
  primaryColor,
  secondaryColor,
  className,
  testId,
  left,
  right,
}: PanelGlassHeaderProps) {
  const palette = GLASS_HEADER_PALETTES[themeMode];
  const isDark = themeMode === "aurora";
  return (
    <div
      data-testid={testId}
      style={{
        ...getTopbarGlassStyle(themeMode),
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: palette.border,
      }}
      className={cn(
        "relative overflow-hidden px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 transition-colors duration-200",
        isDark ? "text-slate-100" : "text-[#1a2744]",
        className
      )}
    >
      <TopbarGlassBackdrop
        themeMode={themeMode}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
      />
      <div className="relative z-10 min-w-0 flex-1">{left}</div>
      {right && <div className="relative z-10 flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

export default FluidOrb;
