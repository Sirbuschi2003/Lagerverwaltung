/**
 * ⚠️ DEPRECATED - Verwende stattdessen `createTheme.ts`
 * 
 * Diese Datei ist noch vorhanden für Rückwärts-Kompatibilität.
 * Neue Komponenten sollten die neue createTheme Factory verwenden.
 * 
 * Migration: Nutze useThemeMode Hook und createTheme aus createTheme.ts
 */

import createAppTheme from "./createTheme";

// Fallback für alten Code - nutzt Dark Mode per default
const theme = createAppTheme('dark');

export default theme;


