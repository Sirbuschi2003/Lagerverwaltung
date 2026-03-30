import React, { useEffect, useState } from "react";
import { Box, Chip, Stack, useTheme } from "@mui/material";
import { DirectionsCar, WifiOff } from "@mui/icons-material";
import { Outlet, useNavigate } from "react-router-dom";
import axios from "axios";

import useAuthStore from "../store/useAuthStore";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import NavigationDrawer from "./NavigationDrawer";
import AppHeader from "./AppHeader";
import { getAppLayoutStyles } from "../styles/componentStyles";

const AppLayout = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAuthStore((state: any) => state.user);
  const { isOnline } = useNetworkStatus();
  const layoutStyles = getAppLayoutStyles(theme);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vehicleData, setVehicleData] = useState<{ licensePlate?: string | null } | null>(null);

  const toggleDrawer = () => setDrawerOpen((prev) => !prev);

  const getVehicleId = () => {
    if (user?.vehicleId && user?.id) {
      const cacheKey = `kfz-offline-vehicleId-${user.id}`;
      localStorage.setItem(cacheKey, user.vehicleId);
      return user.vehicleId;
    }

    if (user?.id) {
      const cacheKey = `kfz-offline-vehicleId-${user.id}`;
      return localStorage.getItem(cacheKey);
    }

    return null;
  };

  useEffect(() => {
    const loadVehicle = async () => {
      const vehicleId = getVehicleId();
      if (!vehicleId) {
        setVehicleData(null);
        return;
      }

      try {
        const response = await axios.get(`/api/vehicles/${vehicleId}`);
        setVehicleData(response.data ?? null);
      } catch {
        setVehicleData(null);
      }
    };

    void loadVehicle();
  }, [user?.id, user?.vehicleId]);

  return (
    <Box
      sx={layoutStyles.root}
    >
      <AppHeader onMenuToggle={toggleDrawer} menuOpen={drawerOpen} />
      <NavigationDrawer open={drawerOpen} onClose={toggleDrawer} />

      <Box component="main" sx={layoutStyles.main}>
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

        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
