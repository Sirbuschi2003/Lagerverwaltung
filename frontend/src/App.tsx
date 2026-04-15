import React, { useEffect, useRef, useMemo } from "react";
import { Box, CssBaseline, ThemeProvider, Typography } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SetupPage from "./pages/SetupPage";
import DashboardPage from "./pages/DashboardPage";
import InventoryPage from "./pages/InventoryPage";
import ItemsPage from "./pages/ItemsPage";
import MyVehiclePage from "./pages/MyVehiclePage";
import ScannerPage from "./pages/ScannerPage";
import QuickBookingPage from "./pages/QuickBookingPage";
import SyncPage from "./pages/SyncPage";
import VehiclesPage from "./pages/VehiclesPage";
import FleetOverviewPage from "./pages/FleetOverviewPage";
import SettingsPage from "./pages/SettingsPage";
import BackupPage from "./pages/BackupPage";
import LogsPage from "./pages/LogsPage";
import LiveLogsPage from "./pages/LiveLogsPage";
import LogsManagementPage from "./pages/LogsManagementPage";
import WarehouseSettingsPage from "./pages/WarehouseSettingsPage";
import EmailSettingsPage from "./pages/EmailSettingsPage";
import MovementHistoryPage from "./pages/MovementHistoryPage";
import AccessControlPage from "./pages/AccessControlPage";
import BranchesPage from "./pages/BranchesPage";
import AdminMaintenancePage from "./pages/AdminMaintenancePage";
import LocationsPage from "./pages/LocationsPage";
import SuppliersPage from "./pages/SuppliersPage";
import OrdersPage from "./pages/OrdersPage";
import createAppTheme from "./styles/createTheme";
import useAuthStore from "./store/useAuthStore";
import useSystemConfigStore from "./store/useSystemConfigStore";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { OfflineStatusIndicator } from "./components/OfflineStatusIndicator";
import RestockNotifier from "./components/RestockNotifier";
import { PrivacyNoticeDialog } from "./components/PrivacyNoticeDialog";
import { ThemeProvider as AppThemeProvider, useThemeMode } from "./hooks/useThemeMode";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import useItemsStore from "./store/useItemsStore";
import useOfflineQueue from "./store/useOfflineQueue";
import { useGlobalLogging } from "./hooks/useGlobalLogging";
import { initializeNetworkStatus } from "./store/useNetworkStore";

const AppContent = () => {
  const token = useAuthStore((state) => state.token);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const refreshAccessToken = useAuthStore((state) => state.refreshAccessToken);
  const { mode, preset } = useThemeMode();
  
  // Globales Logging aktivieren
  useGlobalLogging();

  // Initialisiere GLOBALEN Network-Status (nur EINMAL für gesamte App)
  useEffect(() => {
    initializeNetworkStatus();
  }, []);

  useEffect(() => {
    useSystemConfigStore.getState().loadCompany().catch((error) => {
    });
  }, []);

  // Automatische Artikelsynchronisation bei Online-Wechsel und App-Start
  const { isOnline } = useNetworkStatus();
  const initialSyncDone = useRef(false);
  
  // Offline-Queue beim App-Start laden (initialisiert auch Auto-Sync!)
  useEffect(() => {
    useOfflineQueue.getState().loadFromStorage();
  }, []);

  useEffect(() => {
    if (!token) {
      initialSyncDone.current = false;
      return;
    }
    // Beim ersten Rendern oder wenn online wird, lade Artikel
    if (isOnline && !initialSyncDone.current) {
      initialSyncDone.current = true;
      // JWT erst refreshen (damit locationIds aktuell sind), dann Artikel laden
      void (async () => {
        await refreshAccessToken();
        useItemsStore.getState().loadItems();
      })();
    } else if (isOnline) {
      useItemsStore.getState().loadItems();
    }
    // Wenn offline, beim naechsten Online erneut synchronisieren
    if (!isOnline) {
      initialSyncDone.current = false;
    }
  }, [isOnline, token]);

  // Erstelle Theme basierend auf aktuellem Mode
  const theme = useMemo(() => createAppTheme(mode, preset), [mode, preset]);

  const NoAccessPage = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Kein Zugriff
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Für diese Seite fehlen die Berechtigungen. Bitte die Rolle anpassen.
      </Typography>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Routes>
          {!token ? (
            <>
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <Route path="/" element={<AppLayout />}>
              <Route
                index
                element={hasPermission("dashboard.view") ? <DashboardPage /> : <NoAccessPage />}
              />
              <Route
                path="dashboard"
                element={hasPermission("dashboard.view") ? <DashboardPage /> : <NoAccessPage />}
              />
              <Route path="items" element={hasPermission("items.view") ? <ItemsPage /> : <Navigate to="/" replace />} />
              <Route path="locations" element={hasPermission("locations.view") ? <LocationsPage /> : <Navigate to="/" replace />} />
              <Route path="suppliers" element={hasPermission("suppliers.view") ? <SuppliersPage /> : <Navigate to="/" replace />} />
              <Route path="orders" element={hasPermission("orders.view") ? <OrdersPage /> : <Navigate to="/" replace />} />
              <Route path="scanner" element={hasPermission("scanner.use") ? <ScannerPage /> : <Navigate to="/" replace />} />
              <Route path="quick-booking" element={hasPermission("quick-booking.use") ? <QuickBookingPage /> : <Navigate to="/" replace />} />
              <Route path="vehicle" element={hasPermission("myvehicle.view") ? <MyVehiclePage /> : <Navigate to="/" replace />} />
              <Route path="my-vehicle" element={hasPermission("myvehicle.view") ? <MyVehiclePage /> : <Navigate to="/" replace />} />
              <Route
                path="inventory"
                element={
                  hasPermission(["inventory.view", "inventory.manage", "inventory.execute"])
                    ? <InventoryPage />
                    : <Navigate to="/" replace />
                }
              />
              <Route path="sync" element={hasPermission("sync.use") ? <SyncPage /> : <Navigate to="/" replace />} />
              <Route path="fleet" element={hasPermission("fleet.view") ? <FleetOverviewPage /> : <Navigate to="/" replace />} />
              {hasPermission("settings.company") && <Route path="settings" element={<SettingsPage />} />}
              {hasPermission("settings.email") && <Route path="settings/email" element={<EmailSettingsPage />} />}
              {hasPermission("settings.company") && <Route path="settings/maintenance" element={<AdminMaintenancePage />} />}
              {hasPermission("settings.company") && (
                <Route
                  path="settings/inventory-template"
                  element={<Navigate to="/settings/warehouse?tab=inventory-template" replace />}
                />
              )}
              {hasPermission("settings.company") && (
                <Route
                  path="settings/pdf-template"
                  element={<Navigate to="/settings/warehouse?tab=qr-template" replace />}
                />
              )}
              {hasPermission("settings.company") && (
                <Route path="settings/warehouse" element={<WarehouseSettingsPage />} />
              )}
              {hasPermission("backup.access") && <Route path="backup" element={<BackupPage />} />}
              {hasPermission("logs.view") && <Route path="logs" element={<LogsManagementPage />} />}
              {hasPermission("movements.view") && <Route path="movements" element={<MovementHistoryPage />} />}
              {hasPermission("logs.view") && <Route path="settings/logs" element={<LiveLogsPage />} />}
              {hasPermission("access.manage") && <Route path="access-control" element={<AccessControlPage />} />}
              {hasPermission("branches.manage") && <Route path="branches" element={<BranchesPage />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
        {token && <RestockNotifier />}
        <PrivacyNoticeDialog />
        <PWAInstallPrompt />
        <OfflineStatusIndicator />
      </ErrorBoundary>
    </ThemeProvider>
  );
};

const App = () => {
  return (
    <AppThemeProvider>
      <AppContent />
    </AppThemeProvider>
  );
};

export default App;
