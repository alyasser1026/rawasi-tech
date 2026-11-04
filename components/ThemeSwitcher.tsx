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
    <div className="flex items-center gap-1.5" ref={containerRef}>
      {/* Day / Night Toggle Button */}
      <button
        type="button"
        className="ent-icon-button"
        onClick={toggleMode}
        title={mode === "dark" ? "التبديل إلى الوضع النهاري اللؤلؤي" : "التبديل إلى الوضع الليلي الفحمي"}
        aria-label={mode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
      >
        {mode === "dark" ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-700" />}
      </button>

      {/* Accent Color Palette Selector */}
      <div className="relative">
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
            className="absolute left-0 mt-2 w-56 rounded-2xl p-2 z-50 shadow-2xl backdrop-blur-xl"
            style={{
              background: "var(--surface-card, #12151c)",
              boxShadow: "var(--shadow-elevation, 0 20px 45px rgba(0,0,0,0.8))",
              border: "none",
            }}
          >
            <div className="px-2.5 py-1.5 text-xs font-bold" style={{ color: "var(--text-secondary, #94a3b8)" }}>
              الهوية اللونية (Accent)
            </div>
            <div className="space-y-1">
              {accents.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setAccent(item.id);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: accent === item.id ? "var(--accent-soft-bg, rgba(249,115,22,0.15))" : "transparent",
                    color: accent === item.id ? "var(--accent-main, #f97316)" : "var(--text-primary, #f8fafc)",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}80`,
                      }}
                    />
                    <span>{item.label}</span>
                  </div>
                  {accent === item.id && <Check size={14} className="shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
