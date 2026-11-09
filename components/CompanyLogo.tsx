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

/**
 * الشعار الموحد لفاي تك — نفس ملفات SVG المستخدمة في الموقع وصفحة الدخول (public/brand).
 * النسخة الفاتحة (light) للخلفيات الداكنة، والملونة (color) للخلفيات الفاتحة.
 * لا يتغير لون الشعار مع لون التمييز (accent) حفاظًا على هوية موحدة.
 */
export default function CompanyLogo({
  symbolOnly = false,
  className = "",
  style = {},
  width,
  height,
}: CompanyLogoProps) {
  const { mode } = useTheme();
  const variant = mode === "dark" ? "light" : "color";
  const src = `/brand/phitech-${symbolOnly ? "mark" : "lockup"}-${variant}.svg`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="فاي تك PhiTech"
      className={className}
      width={typeof width === "number" ? width : undefined}
      height={typeof height === "number" ? height : undefined}
      style={{
        display: "block",
        width: typeof width === "string" ? width : width ? undefined : "100%",
        height: typeof height === "string" ? height : height ? undefined : "100%",
        objectFit: "contain",
        ...style,
      }}
      draggable={false}
    />
  );
}
