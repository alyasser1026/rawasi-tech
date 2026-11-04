"use client";

import React from "react";
import { useTheme } from "@/lib/ThemeContext";

interface CompanyLogoProps {
  symbolOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
}

export default function CompanyLogo({
  symbolOnly = false,
  className = "",
  style = {},
  width,
  height,
}: CompanyLogoProps) {
  const { mode, accent } = useTheme();
  const isDark = mode === "dark";

  // Palette tuned specifically for "Warm Amber Obsidian & Ceramic" in dark mode
  // and crisp corporate obsidian contrast in daylight mode.
  const palette = {
    amber: {
      portalStart: "#ea580c",
      portalEnd: "#f97316",
      textSub: isDark ? "#fb923c" : "#c2410c",
      divider: isDark ? "#f97316" : "#ea580c",
      // Dark mode replaces the charcoal with Warm Ceramic Pearl & Amber Sheen
      ceramicStart: isDark ? "#fffdfa" : "#2a2a32",
      ceramicEnd: isDark ? "#fef3c7" : "#121215",
      ceramicText: isDark ? "#fffdfa" : "#1e293b",
      wingFacet: isDark ? "#fde68a" : "#27272a",
      wingStroke: isDark ? "rgba(251, 191, 36, 0.55)" : "#3f3f46",
      pedestal1: isDark ? "#d97706" : "#1e1e24",
      pedestal2: isDark ? "#fef3c7" : "#2a2a34",
    },
    cyan: {
      portalStart: "#0284c7",
      portalEnd: "#38bdf8",
      textSub: isDark ? "#38bdf8" : "#0284c7",
      divider: isDark ? "#38bdf8" : "#0284c7",
      ceramicStart: isDark ? "#ffffff" : "#2a2a32",
      ceramicEnd: isDark ? "#e0f2fe" : "#121215",
      ceramicText: isDark ? "#f8fafc" : "#1e293b",
      wingFacet: isDark ? "#bae6fd" : "#27272a",
      wingStroke: isDark ? "rgba(56, 189, 248, 0.55)" : "#3f3f46",
      pedestal1: isDark ? "#0284c7" : "#1e1e24",
      pedestal2: isDark ? "#e0f2fe" : "#2a2a34",
    },
    emerald: {
      portalStart: "#059669",
      portalEnd: "#34d399",
      textSub: isDark ? "#34d399" : "#047857",
      divider: isDark ? "#34d399" : "#059669",
      ceramicStart: isDark ? "#ffffff" : "#2a2a32",
      ceramicEnd: isDark ? "#dcfce7" : "#121215",
      ceramicText: isDark ? "#f8fafc" : "#1e293b",
      wingFacet: isDark ? "#a7f3d0" : "#27272a",
      wingStroke: isDark ? "rgba(52, 211, 153, 0.55)" : "#3f3f46",
      pedestal1: isDark ? "#059669" : "#1e1e24",
      pedestal2: isDark ? "#dcfce7" : "#2a2a34",
    },
  }[accent] || {
    portalStart: "#ea580c",
    portalEnd: "#f97316",
    textSub: isDark ? "#fb923c" : "#c2410c",
    divider: isDark ? "#f97316" : "#ea580c",
    ceramicStart: isDark ? "#fffdfa" : "#2a2a32",
    ceramicEnd: isDark ? "#fef3c7" : "#121215",
    ceramicText: isDark ? "#fffdfa" : "#1e293b",
    wingFacet: isDark ? "#fde68a" : "#27272a",
    wingStroke: isDark ? "rgba(251, 191, 36, 0.55)" : "#3f3f46",
    pedestal1: isDark ? "#d97706" : "#1e1e24",
    pedestal2: isDark ? "#fef3c7" : "#2a2a34",
  };

  const p = palette;
  const gradId = `phi-grad-${accent}-${mode}`;
  const structGradId = `phi-struct-${accent}-${mode}`;

  if (symbolOnly) {
    return (
      <svg
        role="img"
        aria-label="شعار فاي تك"
        viewBox="0 0 200 200"
        width={width || "100%"}
        height={height || "100%"}
        className={className}
        style={{ display: "block", ...style }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`${gradId}-sym`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={p.portalStart} />
            <stop offset="100%" stopColor={p.portalEnd} />
          </linearGradient>
          <linearGradient id={`${structGradId}-sym`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={p.ceramicStart} />
            <stop offset="100%" stopColor={p.ceramicEnd} />
          </linearGradient>
        </defs>

        {/* Base Pedestals */}
        <rect x="36" y="162" width="128" height="10" rx="2" fill={p.pedestal1} opacity={isDark ? 0.85 : 1} />
        <rect x="52" y="156" width="96" height="6" rx="1" fill={p.pedestal2} />

        {/* Left Wing / Portal Pillar */}
        <polygon
          points="44,52 74,38 74,156 44,156"
          fill={`url(#${structGradId}-sym)`}
          stroke={p.wingStroke}
          strokeWidth="1.2"
        />
        <path
          d="M 74 65 C 50 65, 48 85, 48 100 C 48 115, 50 135, 74 135 L 74 116 C 66 116, 66 108, 66 100 C 66 92, 66 84, 74 84 Z"
          fill={p.wingFacet}
          opacity={isDark ? 0.92 : 1}
        />

        {/* Right Wing / Portal Pillar */}
        <polygon
          points="126,38 156,52 156,156 126,156"
          fill={`url(#${structGradId}-sym)`}
          stroke={p.wingStroke}
          strokeWidth="1.2"
        />
        <polygon points="126,38 140,24 156,52" fill={p.wingStroke} />
        <path
          d="M 126 65 C 150 65, 152 85, 152 100 C 152 115, 150 135, 126 135 L 126 116 C 134 116, 134 108, 134 100 C 134 92, 134 84, 126 84 Z"
          fill={p.wingFacet}
          opacity={isDark ? 0.92 : 1}
        />

        {/* Center Portal Obelisk */}
        <polygon points="92,20 100,8 108,20 108,172 100,180 92,172" fill={`url(#${gradId}-sym)`} />
        <line x1="100" y1="22" x2="100" y2="168" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.75" />
        <polygon points="92,94 108,94 104,106 96,106" fill="#ffffff" fillOpacity="0.45" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 510 160"
      role="img"
      aria-label="فاي تك — PHI TECH"
      width={width || "100%"}
      height={height || "100%"}
      className={className}
      style={{ display: "block", ...style }}
    >
      <defs>
        <linearGradient id={`${gradId}-full`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={p.portalStart} />
          <stop offset="100%" stopColor={p.portalEnd} />
        </linearGradient>
        <linearGradient id={`${structGradId}-full`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.ceramicStart} />
          <stop offset="100%" stopColor={p.ceramicEnd} />
        </linearGradient>
      </defs>

      {/* Symbol Container */}
      <svg x="340" y="0" width="160" height="160" viewBox="0 0 200 200">
        <rect x="36" y="162" width="128" height="10" rx="2" fill={p.pedestal1} opacity={isDark ? 0.85 : 1} />
        <rect x="52" y="156" width="96" height="6" rx="1" fill={p.pedestal2} />

        <polygon
          points="44,52 74,38 74,156 44,156"
          fill={`url(#${structGradId}-full)`}
          stroke={p.wingStroke}
          strokeWidth="1.2"
        />
        <path
          d="M 74 65 C 50 65, 48 85, 48 100 C 48 115, 50 135, 74 135 L 74 116 C 66 116, 66 108, 66 100 C 66 92, 66 84, 74 84 Z"
          fill={p.wingFacet}
          opacity={isDark ? 0.92 : 1}
        />

        <polygon
          points="126,38 156,52 156,156 126,156"
          fill={`url(#${structGradId}-full)`}
          stroke={p.wingStroke}
          strokeWidth="1.2"
        />
        <polygon points="126,38 140,24 156,52" fill={p.wingStroke} />
        <path
          d="M 126 65 C 150 65, 152 85, 152 100 C 152 115, 150 135, 126 135 L 126 116 C 134 116, 134 108, 134 100 C 134 92, 134 84, 126 84 Z"
          fill={p.wingFacet}
          opacity={isDark ? 0.92 : 1}
        />

        <polygon points="92,20 100,8 108,20 108,172 100,180 92,172" fill={`url(#${gradId}-full)`} />
        <line x1="100" y1="22" x2="100" y2="168" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.75" />
        <polygon points="92,94 108,94 104,106 96,106" fill="#ffffff" fillOpacity="0.45" />
      </svg>

      {/* Elegant Accent Vertical Divider Line */}
      <path d="M325 40v80" stroke={p.divider} strokeWidth="2.5" strokeLinecap="round" />

      {/* Arabic Main Typography "فاي تك" (Warm Ceramic Pearl / Obsidian Light in Dark Mode) */}
      <text
        x="165"
        y="84"
        textAnchor="middle"
        direction="rtl"
        lang="ar"
        fontFamily="Cairo, 'Cairo', Tahoma, Arial, sans-serif"
        fontSize="48"
        fontWeight="900"
        fill={p.ceramicText}
        style={{ transition: "fill 0.3s ease" }}
      >
        فاي تك
      </text>

      {/* English Secondary Typography "PHI TECH" */}
      <text
        x="165"
        y="116"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize="20"
        fontWeight="800"
        letterSpacing="4"
        fill={p.textSub}
        style={{ transition: "fill 0.3s ease" }}
      >
        PHI TECH
      </text>
    </svg>
  );
}
