export type ThemeMode = "light" | "dark";
export type ThemePresetId = "sunset" | "ocean" | "graphite" | "emerald" | "atlantic" | "dusk" | "amber";

export interface ThemePalette {
  primary: {
    main: string;
    light: string;
    dark: string;
    contrast: string;
  };
  secondary: {
    main: string;
    light: string;
    dark: string;
    contrast: string;
  };
  surface: {
    default: string;
    paper: string;
    variant: string;
    hover: string;
    selected: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
  };
  border: {
    default: string;
    light: string;
    dark: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  semantic: {
    inventory: string;
    order: string;
    vehicle: string;
    location: string;
    user: string;
  };
}

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  fonts: {
    heading: string;
    body: string;
  };
  palettes: {
    light: ThemePalette;
    dark: ThemePalette;
  };
}

export const designTokens = {
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
  },
  borderRadius: {
    none: "0",
    sm: "6px",
    md: "10px",
    lg: "16px",
    xl: "20px",
    full: "9999px",
  },
  transitions: {
    fast: "150ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    normal: "260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    slow: "420ms cubic-bezier(0.2, 0.8, 0.2, 1)",
  },
  shadows: {
    sm: "0 2px 8px rgba(15, 22, 33, 0.08)",
    md: "0 8px 24px rgba(15, 22, 33, 0.12)",
    lg: "0 14px 36px rgba(15, 22, 33, 0.16)",
    xl: "0 24px 48px rgba(15, 22, 33, 0.2)",
    elevation: "0 8px 30px rgba(15, 22, 33, 0.2)",
  },
  typography: {
    h1: { fontSize: "34px", fontWeight: 700, lineHeight: "1.2" },
    h2: { fontSize: "30px", fontWeight: 700, lineHeight: "1.2" },
    h3: { fontSize: "25px", fontWeight: 700, lineHeight: "1.25" },
    h4: { fontSize: "21px", fontWeight: 700, lineHeight: "1.3" },
    h5: { fontSize: "18px", fontWeight: 700, lineHeight: "1.35" },
    h6: { fontSize: "16px", fontWeight: 700, lineHeight: "1.4" },
    body1: { fontSize: "15px", fontWeight: 500, lineHeight: "1.55" },
    body2: { fontSize: "14px", fontWeight: 500, lineHeight: "1.5" },
    caption: { fontSize: "12px", fontWeight: 500, lineHeight: "1.4" },
    button: { fontSize: "14px", fontWeight: 700, lineHeight: "1.25" },
  },
  zIndex: {
    hide: -1,
    auto: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    backdrop: 1040,
    offcanvas: 1050,
    modal: 1060,
    popover: 1070,
    tooltip: 1080,
    notification: 9000,
  },
  breakpoints: {
    xs: "0px",
    sm: "480px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    xxl: "1440px",
  },
} as const;

export const themePresets: ReadonlyArray<ThemePreset> = [
  {
    id: "sunset",
    label: "Abendrot",
    description: "Warme Akzente mit klaren Kontrasten für den Arbeitsalltag.",
    fonts: {
      heading: '"Sora", "Manrope", sans-serif',
      body: '"Manrope", "Segoe UI", sans-serif',
    },
    palettes: {
      light: {
        primary: { main: "#D95E1A", light: "#F09159", dark: "#9F4010", contrast: "#FFFFFF" },
        secondary: { main: "#0F7FA6", light: "#43A8CA", dark: "#0B5772", contrast: "#FFFFFF" },
        surface: { default: "#F4F7FB", paper: "#FFFFFF", variant: "#EFF3F9", hover: "#E8EEF7", selected: "#E7F6ED" },
        text: { primary: "#152032", secondary: "#4E5D78", tertiary: "#76829A", disabled: "#A8B1C3", inverse: "#FFFFFF" },
        border: { default: "#D7E0ED", light: "#E7EDF7", dark: "#B8C4D8" },
        status: { success: "#2E8B57", warning: "#D1821D", error: "#C63E2D", info: "#2D77C6" },
        semantic: { inventory: "#2D77C6", order: "#D95E1A", vehicle: "#1F8E85", location: "#A06A20", user: "#0F7FA6" },
      },
      dark: {
        primary: { main: "#FF9A52", light: "#FFB67E", dark: "#D67635", contrast: "#1A1A1A" },
        secondary: { main: "#59B4D4", light: "#85CCE4", dark: "#2A8AAA", contrast: "#0E131A" },
        surface: { default: "#0E141B", paper: "#16202C", variant: "#1E2A38", hover: "#27374A", selected: "#1D4E3D" },
        text: { primary: "#F3F7FD", secondary: "#B8C5D8", tertiary: "#8FA0B6", disabled: "#6A7890", inverse: "#0E141B" },
        border: { default: "#324355", light: "#41566E", dark: "#273444" },
        status: { success: "#4CB47A", warning: "#E3A240", error: "#E15A49", info: "#66A9E6" },
        semantic: { inventory: "#66A9E6", order: "#FF9A52", vehicle: "#4CBFAF", location: "#C9A15C", user: "#59B4D4" },
      },
    },
  },
  {
    id: "ocean",
    label: "Ozeanstahl",
    description: "Ruhiges Blau-Gruen-Schema für lange Arbeitssitzungen.",
    fonts: {
      heading: '"Outfit", "Manrope", sans-serif',
      body: '"Manrope", "Segoe UI", sans-serif',
    },
    palettes: {
      light: {
        primary: { main: "#0E7899", light: "#47A6C2", dark: "#07586F", contrast: "#FFFFFF" },
        secondary: { main: "#1D9D80", light: "#4CB99F", dark: "#147462", contrast: "#FFFFFF" },
        surface: { default: "#F3F8FA", paper: "#FFFFFF", variant: "#ECF3F7", hover: "#E3EDF3", selected: "#E1F4EE" },
        text: { primary: "#102432", secondary: "#486072", tertiary: "#6D8192", disabled: "#A0ADBA", inverse: "#FFFFFF" },
        border: { default: "#CEDCE7", light: "#E3ECF3", dark: "#AFC0CF" },
        status: { success: "#2A9C63", warning: "#CB8A1D", error: "#C74C3A", info: "#1C79CC" },
        semantic: { inventory: "#1C79CC", order: "#0E7899", vehicle: "#1D9D80", location: "#8F6B1B", user: "#0E7899" },
      },
      dark: {
        primary: { main: "#4EB2CE", light: "#7BC7DD", dark: "#2D8EA8", contrast: "#071017" },
        secondary: { main: "#63C7AD", light: "#85D6C1", dark: "#3EA88D", contrast: "#071017" },
        surface: { default: "#0B151B", paper: "#12212B", variant: "#1A2D3A", hover: "#234054", selected: "#1C4C42" },
        text: { primary: "#EAF4FB", secondary: "#B3C5D3", tertiary: "#8CA3B5", disabled: "#677E91", inverse: "#0B151B" },
        border: { default: "#2D4353", light: "#3A566B", dark: "#203443" },
        status: { success: "#48BB7C", warning: "#DEA449", error: "#E16959", info: "#66B1F0" },
        semantic: { inventory: "#66B1F0", order: "#4EB2CE", vehicle: "#63C7AD", location: "#B89854", user: "#4EB2CE" },
      },
    },
  },
  {
    id: "graphite",
    label: "Graphit Pro",
    description: "Neutraler Industrie-Look mit roten Funktionsakzenten.",
    fonts: {
      heading: '"Lexend", "Manrope", sans-serif',
      body: '"Manrope", "Segoe UI", sans-serif',
    },
    palettes: {
      light: {
        primary: { main: "#505A68", light: "#798290", dark: "#383F4A", contrast: "#FFFFFF" },
        secondary: { main: "#C9483A", light: "#DB7167", dark: "#98352A", contrast: "#FFFFFF" },
        surface: { default: "#F5F6F8", paper: "#FFFFFF", variant: "#EEF0F3", hover: "#E4E8ED", selected: "#FCEDEA" },
        text: { primary: "#1C242D", secondary: "#566170", tertiary: "#798493", disabled: "#A6AFBA", inverse: "#FFFFFF" },
        border: { default: "#D7DDE5", light: "#E7EBF0", dark: "#B9C2CD" },
        status: { success: "#2F8E5B", warning: "#C67E1E", error: "#C9483A", info: "#446FB9" },
        semantic: { inventory: "#446FB9", order: "#C9483A", vehicle: "#5A7A8D", location: "#9C6A26", user: "#505A68" },
      },
      dark: {
        primary: { main: "#8D98A8", light: "#A7AFBC", dark: "#6A7482", contrast: "#11161C" },
        secondary: { main: "#E36C60", light: "#ED9088", dark: "#B64C43", contrast: "#180B09" },
        surface: { default: "#11161C", paper: "#1A222C", variant: "#232F3B", hover: "#2F3E4D", selected: "#4E2B27" },
        text: { primary: "#EEF2F7", secondary: "#C0CAD6", tertiary: "#95A4B5", disabled: "#6E7E90", inverse: "#11161C" },
        border: { default: "#394859", light: "#4A5D72", dark: "#2B3846" },
        status: { success: "#51BA84", warning: "#E2A748", error: "#E7786D", info: "#78A4EA" },
        semantic: { inventory: "#78A4EA", order: "#E36C60", vehicle: "#7BA0B6", location: "#C8A061", user: "#8D98A8" },
      },
    },
  },
  {
    id: "emerald",
    label: "Smaragd Raster",
    description: "Frische Gruenpalette mit Fokus auf gute Lager-Lesbarkeit.",
    fonts: {
      heading: '"Sora", "Manrope", sans-serif',
      body: '"Manrope", "Segoe UI", sans-serif',
    },
    palettes: {
      light: {
        primary: { main: "#1E8E5A", light: "#52B37F", dark: "#156843", contrast: "#FFFFFF" },
        secondary: { main: "#2A6EA8", light: "#5891C2", dark: "#1D4E79", contrast: "#FFFFFF" },
        surface: { default: "#F3F9F5", paper: "#FFFFFF", variant: "#EAF4EE", hover: "#E0EEE6", selected: "#DDF4E6" },
        text: { primary: "#152520", secondary: "#44645A", tertiary: "#68867B", disabled: "#9CB1AA", inverse: "#FFFFFF" },
        border: { default: "#CFE0D8", light: "#E2ECE7", dark: "#AFC5BB" },
        status: { success: "#1E8E5A", warning: "#C0841F", error: "#BE4A3A", info: "#2A6EA8" },
        semantic: { inventory: "#2A6EA8", order: "#1E8E5A", vehicle: "#2D9182", location: "#8A6A22", user: "#1E8E5A" },
      },
      dark: {
        primary: { main: "#4AC58A", light: "#70D7A3", dark: "#30A06C", contrast: "#0A140F" },
        secondary: { main: "#6EAEE0", light: "#94C3EA", dark: "#4D8FC6", contrast: "#0A1017" },
        surface: { default: "#0D1712", paper: "#15221B", variant: "#1D2E24", hover: "#264032", selected: "#1B4833" },
        text: { primary: "#ECF8F0", secondary: "#B4D0C1", tertiary: "#8BAE9D", disabled: "#668775", inverse: "#0D1712" },
        border: { default: "#30503E", light: "#3F684F", dark: "#243C30" },
        status: { success: "#5AD69A", warning: "#DFAB4D", error: "#E47467", info: "#78BDF0" },
        semantic: { inventory: "#78BDF0", order: "#4AC58A", vehicle: "#61C8B7", location: "#C2A364", user: "#4AC58A" },
      },
    },
  },
  {
    id: "atlantic",
    label: "Atlantik",
    description: "Kräftiges Tiefblau mit Cyan-Akzenten – klar und präzise.",
    fonts: {
      heading: '"Plus Jakarta Sans", "Manrope", sans-serif',
      body: '"Inter", "Segoe UI", sans-serif',
    },
    palettes: {
      light: {
        primary: { main: "#1455A4", light: "#4A84CC", dark: "#0D3C78", contrast: "#FFFFFF" },
        secondary: { main: "#0097A7", light: "#35BDC9", dark: "#006E79", contrast: "#FFFFFF" },
        surface: { default: "#F0F5FB", paper: "#FFFFFF", variant: "#E6EEF8", hover: "#D9E7F5", selected: "#D8F1F5" },
        text: { primary: "#0D1E35", secondary: "#3D5470", tertiary: "#637A96", disabled: "#9AACC2", inverse: "#FFFFFF" },
        border: { default: "#C8D9ED", light: "#DEE9F5", dark: "#A7C0DB" },
        status: { success: "#1E7E50", warning: "#C47F18", error: "#C4382A", info: "#1455A4" },
        semantic: { inventory: "#1455A4", order: "#0097A7", vehicle: "#1A7A99", location: "#A06420", user: "#1455A4" },
      },
      dark: {
        primary: { main: "#5BA3E8", light: "#84BEF0", dark: "#3380C8", contrast: "#05111F" },
        secondary: { main: "#4ECFDF", light: "#7ADDE8", dark: "#28ABBE", contrast: "#021419" },
        surface: { default: "#071524", paper: "#0E2033", variant: "#162D47", hover: "#1E3D5E", selected: "#0F3B4A" },
        text: { primary: "#E8F3FD", secondary: "#A8C5E0", tertiary: "#7AA2C0", disabled: "#527A98", inverse: "#071524" },
        border: { default: "#1E3D5E", light: "#2B5278", dark: "#132A42" },
        status: { success: "#42BB80", warning: "#DFAB4A", error: "#E86558", info: "#5BA3E8" },
        semantic: { inventory: "#5BA3E8", order: "#4ECFDF", vehicle: "#45BDD0", location: "#C8A050", user: "#5BA3E8" },
      },
    },
  },
  {
    id: "dusk",
    label: "Dämmerung",
    description: "Tiefes Violett mit warmem Amber-Akzent – edel und kontrastreich.",
    fonts: {
      heading: '"DM Sans", "Manrope", sans-serif',
      body: '"Inter", "Segoe UI", sans-serif',
    },
    palettes: {
      light: {
        primary: { main: "#6B30A0", light: "#9A60C8", dark: "#4A1F72", contrast: "#FFFFFF" },
        secondary: { main: "#C8780C", light: "#E0A84A", dark: "#975A08", contrast: "#FFFFFF" },
        surface: { default: "#F8F4FC", paper: "#FFFFFF", variant: "#F0EAF9", hover: "#E5DBEF", selected: "#FAECD6" },
        text: { primary: "#1C0F2E", secondary: "#52406A", tertiary: "#7A6490", disabled: "#AA98C0", inverse: "#FFFFFF" },
        border: { default: "#DDD0EE", light: "#EDE5F7", dark: "#BFB0D6" },
        status: { success: "#2A8E52", warning: "#C8780C", error: "#C03838", info: "#3060B0" },
        semantic: { inventory: "#3060B0", order: "#6B30A0", vehicle: "#267A7A", location: "#C8780C", user: "#6B30A0" },
      },
      dark: {
        primary: { main: "#B478E8", light: "#CDA0F0", dark: "#8C50C0", contrast: "#120820" },
        secondary: { main: "#F0B04A", light: "#F5C878", dark: "#C88828", contrast: "#1A0E00" },
        surface: { default: "#100818", paper: "#1A1028", variant: "#251838", hover: "#32234A", selected: "#3D2210" },
        text: { primary: "#F4EEFF", secondary: "#C8B4E4", tertiary: "#A08AC0", disabled: "#78649A", inverse: "#100818" },
        border: { default: "#3A2858", light: "#4E3870", dark: "#281B40" },
        status: { success: "#52C88A", warning: "#F0B04A", error: "#E87070", info: "#78A8F0" },
        semantic: { inventory: "#78A8F0", order: "#B478E8", vehicle: "#58C8C0", location: "#F0B04A", user: "#B478E8" },
      },
    },
  },
  {
    id: "amber",
    label: "Bernstein",
    description: "Warmes Gold und Schiefer – industriell und einladend zugleich.",
    fonts: {
      heading: '"Lexend", "Manrope", sans-serif',
      body: '"Inter", "Segoe UI", sans-serif',
    },
    palettes: {
      light: {
        primary: { main: "#B86E0A", light: "#D99840", dark: "#885008", contrast: "#FFFFFF" },
        secondary: { main: "#3A5E82", light: "#6888A8", dark: "#26405C", contrast: "#FFFFFF" },
        surface: { default: "#FBF7F0", paper: "#FFFFFF", variant: "#F5EEE3", hover: "#EDE3D2", selected: "#EAF0F8" },
        text: { primary: "#221508", secondary: "#5A4230", tertiary: "#806050", disabled: "#B09A84", inverse: "#FFFFFF" },
        border: { default: "#E0D0BC", light: "#EEDAD0", dark: "#C8B49A" },
        status: { success: "#2A8850", warning: "#B86E0A", error: "#BE3A2A", info: "#3A5E82" },
        semantic: { inventory: "#3A5E82", order: "#B86E0A", vehicle: "#4A7A6A", location: "#B86E0A", user: "#3A5E82" },
      },
      dark: {
        primary: { main: "#E8A840", light: "#F0C070", dark: "#C08020", contrast: "#150C00" },
        secondary: { main: "#7AAAD0", light: "#9DC0E0", dark: "#5088B0", contrast: "#040D14" },
        surface: { default: "#181008", paper: "#251808", variant: "#342210", hover: "#443018", selected: "#0E1E2C" },
        text: { primary: "#FAF0E0", secondary: "#D8C0A0", tertiary: "#B09878", disabled: "#887060", inverse: "#181008" },
        border: { default: "#503820", light: "#684C28", dark: "#3C2810" },
        status: { success: "#50C080", warning: "#E8A840", error: "#E87060", info: "#7AAAD0" },
        semantic: { inventory: "#7AAAD0", order: "#E8A840", vehicle: "#60B8A0", location: "#E8A840", user: "#7AAAD0" },
      },
    },
  },
];

export const defaultThemePreset: ThemePreset = themePresets[0];

export const getThemePreset = (presetId?: string): ThemePreset =>
  themePresets.find((preset) => preset.id === presetId) ?? defaultThemePreset;

export const lightPalette = defaultThemePreset.palettes.light;
export const darkPalette = defaultThemePreset.palettes.dark;

