import React from "react";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import SettingsIcon from "@mui/icons-material/Settings";
import PaletteIcon from "@mui/icons-material/Palette";
import CheckIcon from "@mui/icons-material/Check";
import { useNavigate } from "react-router-dom";

import useAuthStore from "../store/useAuthStore";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useThemeMode } from "../hooks/useThemeMode";
import { getAppHeaderStyles } from "../styles/componentStyles";
import { ThemePresetId } from "../styles/designTokens";

interface AppHeaderProps {
  onMenuToggle: () => void;
  menuOpen: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuToggle, menuOpen }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileSmall = useMediaQuery(theme.breakpoints.down("sm"));

  const { user, logout, hasPermission } = useAuthStore((state: any) => state);
  const { isOnline } = useNetworkStatus();
  const { mode, toggleTheme, preset, setPreset, availablePresets } = useThemeMode();
  const headerStyles = getAppHeaderStyles(theme, isMobile);

  const activePreset = React.useMemo(
    () => availablePresets.find((entry) => entry.id === preset),
    [availablePresets, preset],
  );

  const [userMenuAnchor, setUserMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [themeMenuAnchor, setThemeMenuAnchor] = React.useState<null | HTMLElement>(null);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleThemeMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setThemeMenuAnchor(event.currentTarget);
  };

  const handleThemeMenuClose = () => {
    setThemeMenuAnchor(null);
  };

  const handlePresetSelect = (nextPresetId: ThemePresetId) => {
    setPreset(nextPresetId);
    setThemeMenuAnchor(null);
  };

  const handleNavigateSettings = () => {
    handleUserMenuClose();
    if (hasPermission("settings.company")) {
      navigate("/settings");
    }
  };

  const handleLogout = () => {
    logout();
    handleUserMenuClose();
  };

  const userInitials = user?.displayName
    ? String(user.displayName)
        .split(" ")
        .map((name: string) => name[0])
        .join("")
        .toUpperCase()
    : String(user?.username?.charAt(0) || "U").toUpperCase();

  return (
    <AppBar position="sticky" elevation={0} sx={headerStyles.appBar}>
      <Toolbar sx={{ justifyContent: "space-between", minHeight: { xs: 58, sm: 66 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Tooltip title={menuOpen ? "Navigation schließen" : "Navigation öffnen"}>
            <IconButton edge="start" onClick={onMenuToggle} aria-label="menu">
              <MenuIcon />
            </IconButton>
          </Tooltip>

          {!isMobileSmall && (
            <Typography
              variant="h6"
              sx={{ ...headerStyles.title, cursor: "pointer", "&:hover": { opacity: 0.75 } }}
              onClick={() => navigate("/dashboard")}
            >
              Lagerverwaltung
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          {!isOnline && (
            <Chip
              icon={<WifiOffIcon />}
              label={isMobile ? "Offline" : "Offline-Modus"}
              color="warning"
              size="small"
              variant="outlined"
            />
          )}

          <Tooltip title={activePreset ? `Theme: ${activePreset.label}` : "Theme-Vorlage"}>
            <IconButton onClick={handleThemeMenuOpen} size="small" aria-label="theme preset">
              <PaletteIcon sx={{ color: theme.palette.primary.main }} />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={themeMenuAnchor}
            open={Boolean(themeMenuAnchor)}
            onClose={handleThemeMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{
              paper: {
                sx: headerStyles.themeMenuPaper,
              },
            }}
          >
            {availablePresets.map((entry) => (
              <MenuItem
                key={entry.id}
                selected={entry.id === preset}
                onClick={() => handlePresetSelect(entry.id)}
              >
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {entry.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entry.description}
                    </Typography>
                  </Box>
                  {entry.id === preset ? (
                    <CheckIcon fontSize="small" sx={headerStyles.activeThemeIcon} />
                  ) : null}
                </Box>
              </MenuItem>
            ))}
          </Menu>

          <Tooltip title={mode === "dark" ? "Hellmodus" : "Dunkelmodus"}>
            <IconButton onClick={toggleTheme} size="small" aria-label="theme toggle">
              {mode === "dark" ? (
                <Brightness7Icon sx={{ color: theme.palette.warning.light }} />
              ) : (
                <Brightness4Icon sx={{ color: theme.palette.secondary.main }} />
              )}
            </IconButton>
          </Tooltip>

          {user && (
            <>
              {!isMobile && (
                <Box sx={{ mr: 1, textAlign: "right" }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.1, fontWeight: 600 }}>
                    {user.displayName || user.username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.role}
                  </Typography>
                </Box>
              )}

              <Tooltip title="Benutzermenue">
                <IconButton onClick={handleUserMenuOpen} sx={{ p: 0.25 }} aria-label="user menu">
                  <Avatar sx={headerStyles.userAvatar}>{userInitials}</Avatar>
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                  paper: {
                    sx: headerStyles.userMenuPaper,
                  },
                }}
              >
                {isMobile && (
                  <>
                    <MenuItem disabled>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {user.displayName || user.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.role}
                        </Typography>
                      </Box>
                    </MenuItem>
                    <Divider />
                  </>
                )}

                <MenuItem onClick={handleNavigateSettings} disabled={!hasPermission("settings.company")}>
                  <SettingsIcon sx={{ mr: 1.5 }} fontSize="small" />
                  <Typography variant="body2">Einstellungen</Typography>
                </MenuItem>

                <Divider sx={{ my: 0.5 }} />

                <MenuItem onClick={handleLogout} sx={{ color: theme.palette.error.main }}>
                  <LogoutIcon sx={{ mr: 1.5 }} fontSize="small" />
                  <Typography variant="body2">Abmelden</Typography>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;

