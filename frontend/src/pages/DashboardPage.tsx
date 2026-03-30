import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Grid } from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { useBackgroundSync } from "../hooks/useBackgroundSync";
import { useUserSettingsStore } from "../store/useUserSettingsStore";
import type { DashboardWidgetId } from "../store/useUserSettingsStore";
import DashboardKpiWidget from "../components/dashboard/DashboardKpiWidget";
import DashboardQuickActionsWidget from "../components/dashboard/DashboardQuickActionsWidget";
import DashboardRestockWidget from "../components/dashboard/DashboardRestockWidget";
import DashboardRecentMovementsWidget from "../components/dashboard/DashboardRecentMovementsWidget";
import DashboardSettingsDialog from "../components/dashboard/DashboardSettingsDialog";

const DashboardPage = () => {
  const { settings, loaded, loadSettings } = useUserSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!loaded) {
      void loadSettings();
    }
  }, [loaded, loadSettings]);

  useBackgroundSync();

  const orderedWidgets = settings.dashboard.widgetOrder.filter((w) =>
    settings.dashboard.visibleWidgets.includes(w),
  );

  const renderWidget = (widgetId: DashboardWidgetId) => {
    switch (widgetId) {
      case "kpi":
        return <DashboardKpiWidget />;
      case "quick-actions":
        return <DashboardQuickActionsWidget />;
      case "restock":
        return <DashboardRestockWidget />;
      case "recent-movements":
        return <DashboardRecentMovementsWidget />;
      default:
        return null;
    }
  };

  return (
    <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ width: "100%" }}>
      {!navigator.onLine && (
        <Grid item xs={12}>
          <Alert severity="warning">
            <b>Offline-Modus:</b> Die Daten sind möglicherweise nicht aktuell. Änderungen werden
            synchronisiert, sobald wieder eine Verbindung besteht.
          </Alert>
        </Grid>
      )}

      <Grid item xs={12}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            startIcon={<TuneIcon />}
            variant="outlined"
            size="small"
            onClick={() => setSettingsOpen(true)}
          >
            Dashboard anpassen
          </Button>
        </Box>
      </Grid>

      {orderedWidgets.map((widgetId) => {
        const widget = renderWidget(widgetId);
        if (!widget) return null;
        return (
          <Grid item xs={12} key={widgetId}>
            {widget}
          </Grid>
        );
      })}

      <DashboardSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Grid>
  );
};

export default DashboardPage;
