import React, { useEffect, useRef, useState } from "react";
import { Box, Chip, Stack, useTheme } from "@mui/material";
import { DirectionsCar, WifiOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import TabBar from "./TabBar";
import KeepAliveOutlet from "./KeepAliveOutlet";
import api from "../utils/api";

import useAuthStore from "../store/useAuthStore";
import { useUserSettingsStore } from "../store/useUserSettingsStore";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { isEffectivelyOffline } from "../store/useNetworkStore";
import { offlineStorage } from "../store/useOfflineStorage";
import { useThemeMode } from "../hooks/useThemeMode";
import NavigationDrawer from "./NavigationDrawer";
import AppHeader from "./AppHeader";
import { getAppLayoutStyles } from "../styles/componentStyles";

const AppLayout = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const { isOnline } = useNetworkStatus();
  const layoutStyles = getAppLayoutStyles(theme);
  const { settings, loaded: settingsLoaded, loadSettings } = useUserSettingsStore();
  const { syncFromExternal } = useThemeMode();
  const syncFromExternalRef = useRef(syncFromExternal);
  useEffect(() => { syncFromExternalRef.current = syncFromExternal; });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vehicleData, setVehicleData] = useState<{ licensePlate?: string | null } | null>(null);

  const toggleDrawer = () => setDrawerOpen((prev) => !prev);

  // Settings einmalig laden wenn noch nicht geladen
  useEffect(() => {
    if (!settingsLoaded) void loadSettings();
  }, [settingsLoaded, loadSettings]);

  // Theme aus DB-Settings anwenden sobald geladen
  useEffect(() => {
    if (!settingsLoaded) return;
    const { themeMode, themePreset } = settings;
    if (themeMode || themePreset) syncFromExternalRef.current(themeMode, themePreset);
  }, [settingsLoaded, settings]);

  const getVehicleId = () => {
    if (user?.vehicleId && user?.id) {
      const cacheKey = `lv-offline-vehicleId-${user.id}`;
      localStorage.setItem(cacheKey, user.vehicleId);
      return user.vehicleId;
    }
    if (user?.id) {
      const cacheKey = `lv-offline-vehicleId-${user.id}`;
      return localStorage.getItem(cacheKey);
    }
    return null;
  };

  useEffect(() => {
    const loadVehicle = async () => {
      const vehicleId = getVehicleId();
      if (!vehicleId) { setVehicleData(null); return; }
      // Diese Anfrage lief bisher IMMER live, auch offline (Techniker mit
      // Mobilfunk melden navigator.onLine=true, obwohl der private Server
      // unerreichbar ist) - das kostete bei jedem App-Start/Login den vollen
      // Netzwerk-Timeout, bevor ueberhaupt etwas anderes rendern konnte.
      if (isEffectivelyOffline()) {
        const cached = await offlineStorage.getVehicleData(vehicleId).catch(() => null);
        setVehicleData(cached ?? null);
        return;
      }
      try {
        const response = await api.get(`/vehicles/${vehicleId}`);
        setVehicleData(response.data ?? null);
        void offlineStorage.setVehicleData(vehicleId, response.data ?? null).catch(() => undefined);
      } catch {
        const cached = await offlineStorage.getVehicleData(vehicleId).catch(() => null);
        setVehicleData(cached ?? null);
      }
    };
    void loadVehicle();
  }, [user?.id, user?.vehicleId]);

  return (
    <Box sx={layoutStyles.root}>
      <AppHeader onMenuToggle={toggleDrawer} menuOpen={drawerOpen} />
      <NavigationDrawer open={drawerOpen} onClose={toggleDrawer} />

      <Box component="main" sx={layoutStyles.main}>
        <TabBar />

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
          {!isOnline && (
            <Chip
              icon={<WifiOff />}
              size="small"
              color="warning"
              variant="filled"
              label="Offline-Modus aktiv"
              sx={layoutStyles.statusChip}
            />
          )}
          {vehicleData?.licensePlate && (
            <Chip
              icon={<DirectionsCar />}
              size="small"
              clickable
              onClick={() => navigate("/my-vehicle")}
              color="primary"
              variant="outlined"
              label={`Fahrzeug ${vehicleData.licensePlate}`}
              sx={layoutStyles.vehicleChip}
            />
          )}
        </Stack>

        <KeepAliveOutlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
