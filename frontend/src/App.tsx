import React, { useEffect, useRef, useMemo } from "react";
import { Box, CircularProgress, CssBaseline, ThemeProvider, Typography } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SetupPage from "./pages/SetupPage";
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
  const authInitializing = useAuthStore((state) => state.authInitializing);
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
        {authInitializing ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
            <CircularProgress />
          </Box>
        ) : (
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
              {/* Index + Dashboard */}
              <Route index element={hasPermission("dashboard.view") ? <></> : <NoAccessPage />} />
              <Route path="dashboard" element={hasPermission("dashboard.view") ? <></> : <NoAccessPage />} />

              {/* Hauptseiten – KeepAliveOutlet übernimmt das Rendern */}
              <Route path="items"         element={hasPermission("items.view")         ? <></> : <Navigate to="/" replace />} />
              <Route path="locations"     element={hasPermission("locations.view")     ? <></> : <Navigate to="/" replace />} />
              <Route path="suppliers"     element={hasPermission("suppliers.view")     ? <></> : <Navigate to="/" replace />} />
              <Route path="orders"        element={hasPermission("orders.view")        ? <></> : <Navigate to="/" replace />} />
              <Route path="scanner"       element={hasPermission("scanner.use")        ? <></> : <Navigate to="/" replace />} />
              <Route path="quick-booking" element={hasPermission("quick-booking.use")  ? <></> : <Navigate to="/" replace />} />
              <Route path="vehicle"       element={hasPermission("myvehicle.view")     ? <></> : <Navigate to="/" replace />} />
              <Route path="my-vehicle"    element={hasPermission("myvehicle.view")     ? <></> : <Navigate to="/" replace />} />
              <Route
                path="inventory"
                element={hasPermission(["inventory.view", "inventory.manage", "inventory.execute"]) ? <></> : <Navigate to="/" replace />}
              />
              <Route path="sync"  element={hasPermission("sync.use")   ? <></> : <Navigate to="/" replace />} />
              <Route path="fleet" element={hasPermission("fleet.view") ? <></> : <Navigate to="/" replace />} />

              {/* Einstellungen */}
              {hasPermission("settings.company") && <Route path="settings"             element={<></>} />}
              {hasPermission("settings.email")   && <Route path="settings/email"       element={<></>} />}
              {hasPermission("settings.company") && <Route path="settings/maintenance" element={<></>} />}
              {hasPermission("settings.company") && <Route path="settings/warehouse"   element={<></>} />}
              {hasPermission("settings.company") && (
                <Route path="settings/inventory-template" element={<Navigate to="/settings/warehouse?tab=inventory-template" replace />} />
              )}
              {hasPermission("settings.company") && (
                <Route path="settings/pdf-template" element={<Navigate to="/settings/warehouse?tab=qr-template" replace />} />
              )}
              {hasPermission("backup.access")    && <Route path="backup"          element={<></>} />}
              {hasPermission("logs.view")        && <Route path="logs"            element={<></>} />}
              {hasPermission("movements.view")   && <Route path="movements"       element={<></>} />}
              {hasPermission("logs.view")        && <Route path="settings/logs"   element={<></>} />}
              {hasPermission("access.manage")    && <Route path="access-control"  element={<></>} />}
              {hasPermission("branches.manage")  && <Route path="branches"        element={<></>} />}
              <Route path="help" element={<></>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
        )}
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
