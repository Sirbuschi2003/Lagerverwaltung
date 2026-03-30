/**
 * Theme context with mode + preset selection.
 * Stores user preference in localStorage.
 */

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

import {
  ThemeMode,
  ThemePreset,
  ThemePresetId,
  defaultThemePreset,
  themePresets,
} from "../styles/designTokens";

interface ThemeContextType {
  mode: ThemeMode;
  preset: ThemePresetId;
  availablePresets: ReadonlyArray<ThemePreset>;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePresetId) => void;
}

const THEME_MODE_STORAGE_KEY = "theme-mode";
const THEME_PRESET_STORAGE_KEY = "theme-preset";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "light" || value === "dark";

const isThemePreset = (value: string | null): value is ThemePresetId =>
  value === "sunset" || value === "ocean" || value === "graphite" || value === "emerald";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (isThemeMode(savedMode)) {
      return savedMode;
    }

    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  const [preset, setPresetState] = useState<ThemePresetId>(() => {
    const savedPreset = localStorage.getItem(THEME_PRESET_STORAGE_KEY);
    return isThemePreset(savedPreset) ? savedPreset : defaultThemePreset.id;
  });

  useEffect(() => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    localStorage.setItem(THEME_PRESET_STORAGE_KEY, preset);

    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.setAttribute("data-theme-mode", mode);
    document.documentElement.setAttribute("data-theme-preset", preset);
  }, [mode, preset]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
      if (!savedMode) {
        setMode(event.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const setPreset = (newPreset: ThemePresetId) => {
    setPresetState(newPreset);
  };

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      mode,
      preset,
      availablePresets: themePresets,
      toggleTheme,
      setTheme,
      setPreset,
    }),
    [mode, preset],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode muss innerhalb von ThemeProvider verwendet werden");
  }
  return context;
};
