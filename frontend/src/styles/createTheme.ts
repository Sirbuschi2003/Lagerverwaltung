import { ThemeOptions, alpha, createTheme as muiCreateTheme } from "@mui/material/styles";
import {
  ThemeMode,
  ThemePresetId,
  defaultThemePreset,
  designTokens,
  getThemePreset,
} from "./designTokens";

export const createAppTheme = (
  mode: ThemeMode = "light",
  presetId: ThemePresetId = defaultThemePreset.id,
) => {
  const preset = getThemePreset(presetId);
  const palette = preset.palettes[mode];

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: palette.primary.main,
        light: palette.primary.light,
        dark: palette.primary.dark,
        contrastText: palette.primary.contrast,
      },
      secondary: {
        main: palette.secondary.main,
        light: palette.secondary.light,
        dark: palette.secondary.dark,
        contrastText: palette.secondary.contrast,
      },
      background: {
        default: palette.surface.default,
        paper: palette.surface.paper,
      },
      text: {
        primary: palette.text.primary,
        secondary: palette.text.secondary,
        disabled: palette.text.disabled,
      },
      divider: palette.border.default,
      success: {
        main: palette.status.success,
      },
      warning: {
        main: palette.status.warning,
      },
      error: {
        main: palette.status.error,
      },
      info: {
        main: palette.status.info,
      },
    },
    typography: {
      fontFamily: preset.fonts.body,
      h1: { ...designTokens.typography.h1, fontFamily: preset.fonts.heading },
      h2: { ...designTokens.typography.h2, fontFamily: preset.fonts.heading },
      h3: { ...designTokens.typography.h3, fontFamily: preset.fonts.heading },
      h4: { ...designTokens.typography.h4, fontFamily: preset.fonts.heading },
      h5: { ...designTokens.typography.h5, fontFamily: preset.fonts.heading },
      h6: { ...designTokens.typography.h6, fontFamily: preset.fonts.heading },
      body1: designTokens.typography.body1,
      body2: designTokens.typography.body2,
      caption: designTokens.typography.caption,
      button: {
        ...designTokens.typography.button,
        textTransform: "none",
      },
    },
    shape: {
      borderRadius: Number.parseInt(designTokens.borderRadius.md, 10),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": {
            "--focus-color": palette.status.info,
            "--surface-scroll-track": alpha(palette.border.default, mode === "dark" ? 0.24 : 0.12),
            "--surface-scroll-thumb": alpha(palette.primary.main, mode === "dark" ? 0.45 : 0.38),
            "--surface-scroll-thumb-hover": alpha(palette.primary.main, mode === "dark" ? 0.62 : 0.55),
            "--transition-fast": designTokens.transitions.fast,
            "--transition-normal": designTokens.transitions.normal,
          },
          body: {
            backgroundImage:
              mode === "dark"
                ? `radial-gradient(circle at 12% 18%, ${alpha(palette.primary.main, 0.14)} 0%, transparent 42%),
                   radial-gradient(circle at 88% 2%, ${alpha(palette.secondary.main, 0.12)} 0%, transparent 36%)`
                : `radial-gradient(circle at 0% 0%, ${alpha(palette.primary.main, 0.1)} 0%, transparent 40%),
                   radial-gradient(circle at 100% 2%, ${alpha(palette.secondary.main, 0.08)} 0%, transparent 32%)`,
            backgroundAttachment: "fixed",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.md,
            fontWeight: 700,
            transition: designTokens.transitions.normal,
          },
          contained: {
            boxShadow: designTokens.shadows.sm,
            "&:hover": {
              boxShadow: designTokens.shadows.md,
              transform: "translateY(-1px)",
            },
          },
          outlined: {
            borderColor: alpha(palette.border.default, 0.95),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.lg,
            border: `1px solid ${alpha(palette.border.default, 0.8)}`,
            boxShadow: designTokens.shadows.sm,
            transition: `transform ${designTokens.transitions.fast}, box-shadow ${designTokens.transitions.fast}`,
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: designTokens.shadows.md,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${alpha(palette.border.default, 0.66)}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            backgroundColor: alpha(palette.surface.variant, 0.72),
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: designTokens.borderRadius.md,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 46,
          },
          indicator: {
            height: 3,
            borderRadius: 99,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
          },
        },
      },
    },
  };

  return muiCreateTheme(themeOptions);
};

export default createAppTheme;
