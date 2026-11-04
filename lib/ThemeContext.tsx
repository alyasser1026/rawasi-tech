"use client";

import React, { createContext, useContext, useEffect, useState, useTransition, useRef } from "react";
import { supabase } from "./supabase";

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
  const [, startTransition] = useTransition();
  const currentUserIdRef = useRef<string | null>(null);

  // 1. Initial local load for instant rendering
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
  }, []);

  // 2. Synchronize with logged-in user preferences
  useEffect(() => {
    const syncUserTheme = (user: any) => {
      if (!user) {
        currentUserIdRef.current = null;
        return;
      }

      const userId = user.id;
      currentUserIdRef.current = userId;

      // 1. Try user-specific localStorage first
      const userModeKey = `${STORAGE_KEY_MODE}_${userId}`;
      const userAccentKey = `${STORAGE_KEY_ACCENT}_${userId}`;

      let userMode = (localStorage.getItem(userModeKey) as ThemeMode) || null;
      let userAccent = (localStorage.getItem(userAccentKey) as ThemeAccent) || null;

      // 2. If not found in localStorage, check user_metadata from Supabase account
      if (!userMode && user.user_metadata?.theme_mode) {
        userMode = user.user_metadata.theme_mode as ThemeMode;
      }
      if (!userAccent && user.user_metadata?.theme_accent) {
        userAccent = user.user_metadata.theme_accent as ThemeAccent;
      }

      // 3. If preferences exist for this user, apply them
      if (userMode && (userMode === "dark" || userMode === "light")) {
        setModeState(userMode);
        document.documentElement.setAttribute("data-mode", userMode);
        localStorage.setItem(STORAGE_KEY_MODE, userMode);
        localStorage.setItem(userModeKey, userMode);
      }
      if (userAccent && (userAccent === "amber" || userAccent === "cyan" || userAccent === "emerald")) {
        setAccentState(userAccent);
        document.documentElement.setAttribute("data-accent", userAccent);
        localStorage.setItem(STORAGE_KEY_ACCENT, userAccent);
        localStorage.setItem(userAccentKey, userAccent);
      }
    };

    // Check current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        syncUserTheme(session.user);
      }
    });

    // Listen for sign-in / sign-out events
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        syncUserTheme(session.user);
      } else if (event === "SIGNED_OUT") {
        currentUserIdRef.current = null;
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const setMode = (newMode: ThemeMode) => {
    startTransition(() => {
      setModeState(newMode);
    });
    try {
      document.documentElement.setAttribute("data-mode", newMode);
      localStorage.setItem(STORAGE_KEY_MODE, newMode);

      const userId = currentUserIdRef.current;
      if (userId) {
        localStorage.setItem(`${STORAGE_KEY_MODE}_${userId}`, newMode);
        supabase.auth.updateUser({
          data: { theme_mode: newMode },
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const setAccent = (newAccent: ThemeAccent) => {
    startTransition(() => {
      setAccentState(newAccent);
    });
    try {
      document.documentElement.setAttribute("data-accent", newAccent);
      localStorage.setItem(STORAGE_KEY_ACCENT, newAccent);

      const userId = currentUserIdRef.current;
      if (userId) {
        localStorage.setItem(`${STORAGE_KEY_ACCENT}_${userId}`, newAccent);
        supabase.auth.updateUser({
          data: { theme_accent: newAccent },
        }).catch(() => {});
      }
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
