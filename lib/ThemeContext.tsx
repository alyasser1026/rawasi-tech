"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

export type ThemeMode = "dark" | "light";
export type ThemeAccent = "amber" | "cyan" | "emerald";

interface ThemeContextType {
  mode: ThemeMode;
  accent: ThemeAccent;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY_MODE = "phi_theme_mode";
const STORAGE_KEY_ACCENT = "phi_theme_accent";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<ThemeAccent>("amber");
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      const savedMode = (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) || "dark";
      const savedAccent = (localStorage.getItem(STORAGE_KEY_ACCENT) as ThemeAccent) || "amber";
      setModeState(savedMode);
      setAccentState(savedAccent);
      document.documentElement.setAttribute("data-mode", savedMode);
      document.documentElement.setAttribute("data-accent", savedAccent);
    } catch {
      // ignore in environments without localStorage
    }
    setMounted(true);
  }, []);

  const setMode = (newMode: ThemeMode) => {
    startTransition(() => {
      setModeState(newMode);
    });
    try {
      localStorage.setItem(STORAGE_KEY_MODE, newMode);
      document.documentElement.setAttribute("data-mode", newMode);
    } catch {
      // ignore
    }
  };

  const setAccent = (newAccent: ThemeAccent) => {
    startTransition(() => {
      setAccentState(newAccent);
    });
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, newAccent);
      document.documentElement.setAttribute("data-accent", newAccent);
    } catch {
      // ignore
    }
  };

  const toggleMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Return safe fallback if used outside provider
    return {
      mode: "dark" as ThemeMode,
      accent: "amber" as ThemeAccent,
      setMode: () => {},
      setAccent: () => {},
      toggleMode: () => {},
    };
  }
  return ctx;
}
