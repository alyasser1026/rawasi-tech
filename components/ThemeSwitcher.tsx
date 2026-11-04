"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme, ThemeAccent } from "@/lib/ThemeContext";
import { Moon, Sun, Palette, Check } from "lucide-react";

export default function ThemeSwitcher() {
  const { mode, accent, toggleMode, setAccent } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const accents: { id: ThemeAccent; label: string; color: string; desc: string }[] = [
    { id: "amber", label: "عنبري (أوبسيديان)", color: "#f97316", desc: "دفء الفحم والعنبر الذهبي" },
    { id: "cyan", label: "تيتانيوم تقني", color: "#38bdf8", desc: "أزرق تيتانيوم تقني حديث" },
    { id: "emerald", label: "زمردي مالي", color: "#10b981", desc: "أخضر زمردي استثماري رصين" },
  ];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        position: "relative",
      }}
    >
      {/* Day / Night Toggle Button */}
      <button
        type="button"
        className="ent-icon-button"
        onClick={toggleMode}
        title={mode === "dark" ? "التبديل إلى الوضع النهاري اللؤلؤي" : "التبديل إلى الوضع الليلي الفحمي"}
        aria-label={mode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
      >
        {mode === "dark" ? (
          <Sun size={17} style={{ color: "#fbbf24" }} />
        ) : (
          <Moon size={17} style={{ color: "var(--text-secondary, #64748b)" }} />
        )}
      </button>

      {/* Accent Color Palette Selector Button */}
      <div style={{ position: "relative", display: "inline-flex" }}>
        <button
          type="button"
          className="ent-icon-button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          title="تغيير الهوية اللونية للواجهة"
          aria-label="الهوية اللونية"
          aria-expanded={dropdownOpen}
        >
          <Palette size={17} style={{ color: "var(--accent-main, #f97316)" }} />
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 0.5rem)",
              left: 0,
              minWidth: "14.5rem",
              borderRadius: "16px",
              padding: "0.625rem",
              zIndex: 10000,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              background: "var(--surface-card, #12151c)",
              boxShadow: "var(--shadow-elevation, 0 20px 45px rgba(0,0,0,0.8))",
              border: "none",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
              direction: "rtl",
            }}
          >
            <div
              style={{
                padding: "0.25rem 0.5rem 0.375rem",
                fontSize: "var(--fs-xs, 0.75rem)",
                fontWeight: 800,
                color: "var(--text-secondary, #94a3b8)",
                borderBottom: "1px solid var(--table-zebra-bg, rgba(255,255,255,0.06))",
              }}
            >
              الهوية اللونية (Accent)
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {accents.map((item) => {
                const isSelected = accent === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAccent(item.id);
                      setDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "12px",
                      fontSize: "var(--fs-xs, 0.75rem)",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      background: isSelected
                        ? "var(--accent-soft-bg, rgba(249,115,22,0.15))"
                        : "transparent",
                      color: isSelected
                        ? "var(--accent-main, #f97316)"
                        : "var(--text-primary, #f8fafc)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                      <span
                        style={{
                          width: "0.75rem",
                          height: "0.75rem",
                          borderRadius: "50%",
                          backgroundColor: item.color,
                          boxShadow: `0 0 8px ${item.color}80`,
                          flexShrink: 0,
                        }}
                      />
                      <span>{item.label}</span>
                    </div>
                    {isSelected && <Check size={14} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
