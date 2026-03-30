import { alpha, Theme } from "@mui/material/styles";

export const getAppLayoutStyles = (theme: Theme) => ({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background:
      theme.palette.mode === "dark"
        ? `radial-gradient(circle at 10% 20%, ${alpha(theme.palette.primary.main, 0.2)} 0%, transparent 40%),
           radial-gradient(circle at 90% 0%, ${alpha(theme.palette.secondary.main, 0.16)} 0%, transparent 38%),
           ${theme.palette.background.default}`
        : `radial-gradient(circle at 0% 0%, ${alpha(theme.palette.primary.light, 0.2)} 0%, transparent 42%),
           radial-gradient(circle at 100% 10%, ${alpha(theme.palette.secondary.light, 0.16)} 0%, transparent 40%),
           ${theme.palette.background.default}`,
  },
  main: {
    width: "100%",
    maxWidth: "100vw",
    px: { xs: 1.5, sm: 2.5, md: 3.5 },
    py: { xs: 1.5, sm: 2, md: 2.5 },
    flex: 1,
    overflow: "auto",
  },
  statusChip: {
    fontWeight: 600,
  },
  vehicleChip: {
    fontWeight: 600,
  },
});

export const getAppHeaderStyles = (theme: Theme, isMobile: boolean) => ({
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    backgroundColor: alpha(theme.palette.background.paper, 0.82),
    color: theme.palette.text.primary,
    backdropFilter: "blur(12px)",
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
  },
  title: {
    fontFamily: '"Sora", "Manrope", sans-serif',
    fontSize: isMobile ? "1rem" : "1.2rem",
    fontWeight: 700,
    letterSpacing: "0.01em",
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userAvatar: {
    width: 36,
    height: 36,
    bgcolor: theme.palette.primary.main,
    fontSize: "0.82rem",
    fontWeight: 700,
  },
  userMenuPaper: {
    mt: 1,
    minWidth: 220,
  },
  themeMenuPaper: {
    mt: 1,
    minWidth: 260,
  },
  activeThemeIcon: {
    color: theme.palette.primary.main,
    mr: 0.5,
  },
});

export const getNavigationDrawerStyles = (theme: Theme, width: number) => ({
  drawerPaper: {
    width,
    boxSizing: "border-box",
    borderRight: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
    background:
      theme.palette.mode === "dark"
        ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.96)} 0%, ${alpha(theme.palette.background.default, 0.96)} 100%)`
        : `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`,
    backdropFilter: "blur(10px)",
  },
  topBar: {
    p: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: 1,
    borderColor: "divider",
    backgroundColor: alpha(theme.palette.background.paper, 0.85),
  },
  roleBanner: {
    p: 2,
    color: "primary.contrastText",
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
  selectedItem: {
    "&.Mui-selected": {
      backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.28 : 0.16),
      color: theme.palette.primary.contrastText,
      "&:hover": {
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.36 : 0.26),
      },
      "& .MuiListItemIcon-root": {
        color: theme.palette.primary.contrastText,
      },
    },
  },
  logoutButton: {
    color: "error.main",
    "&:hover": {
      backgroundColor: alpha(theme.palette.error.main, 0.12),
    },
  },
});
