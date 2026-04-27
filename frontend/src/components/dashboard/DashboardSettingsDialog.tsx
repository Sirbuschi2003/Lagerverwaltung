import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type { DashboardWidgetId, QuickAction, QuickActions } from "../../store/useUserSettingsStore";
import { useUserSettingsStore } from "../../store/useUserSettingsStore";
import useAuthStore from "../../store/useAuthStore";

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  kpi: "KPI Übersicht (Artikel, Sollbestand, Inventuren)",
  "quick-actions": "Schnellzugriff-Buttons (Dashboard-Widget)",
  restock: "Nachbestellung / Teileübersicht",
  "recent-movements": "Letzte Buchungen",
};

const ALL_ROUTES: { label: string; value: string; permissions: string[] }[] = [
  { label: "Dashboard",            value: "/dashboard",           permissions: ["dashboard.view"] },
  { label: "Schnellbuchung",       value: "/quick-booking",       permissions: ["quick-booking.use"] },
  { label: "Scanner",              value: "/scanner",             permissions: ["scanner.use"] },
  { label: "Artikel",              value: "/items",               permissions: ["items.view"] },
  { label: "Lagerorte",            value: "/locations",           permissions: ["locations.view"] },
  { label: "Lieferanten",          value: "/suppliers",           permissions: ["suppliers.view"] },
  { label: "Bestellungen",         value: "/orders",              permissions: ["orders.view"] },
  { label: "Bewegungen",           value: "/movements",           permissions: ["movements.view"] },
  { label: "Fahrzeugbestände",     value: "/fleet",               permissions: ["fleet.view"] },
  { label: "Inventur",             value: "/inventory",           permissions: ["inventory.view", "inventory.manage", "inventory.execute"] },
  { label: "Mein Fahrzeug",        value: "/my-vehicle",          permissions: ["myvehicle.view"] },
  { label: "Synchronisierung",     value: "/sync",                permissions: ["sync.use"] },
  { label: "Benutzer & Rechte",    value: "/access-control",      permissions: ["access.manage"] },
  { label: "Firmendaten",          value: "/settings",            permissions: ["settings.company"] },
  { label: "E-Mail Einstellungen", value: "/settings/email",      permissions: ["settings.email"] },
  { label: "Lagereinstellungen",   value: "/settings/warehouse",  permissions: ["settings.company"] },
  { label: "Datensicherung",       value: "/backup",              permissions: ["backup.access"] },
  { label: "Systemprotokolle",     value: "/logs",                permissions: ["logs.view"] },
];

const AVAILABLE_COLORS = ["primary", "secondary", "success", "warning", "info", "error"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

// Wiederverwendbare Aktionsliste für Desktop oder Mobile
const QuickActionList: React.FC<{
  actions: QuickAction[];
  onChange: (actions: QuickAction[]) => void;
  availableRoutes: typeof ALL_ROUTES;
}> = ({ actions, onChange, availableRoutes }) => {
  const addAction = () => {
    onChange([...actions, { id: `action-${Date.now()}`, label: "Neuer Button", icon: "QrCodeScanner", route: "/quick-booking", color: "primary" }]);
  };

  const removeAction = (id: string) => onChange(actions.filter((a) => a.id !== id));

  const updateAction = (id: string, field: keyof QuickAction, value: string) =>
    onChange(actions.map((a) => (a.id === id ? { ...a, [field]: value } : a)));

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={addAction}>Hinzufügen</Button>
      </Box>
      <Stack spacing={2}>
        {actions.map((action) => (
          <Box key={action.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <TextField
                  size="small" label="Bezeichnung" value={action.label} fullWidth sx={{ mb: 1 }}
                  onChange={(e) => updateAction(action.id, "label", e.target.value)}
                />
                <Stack direction="row" spacing={1}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Zielseite</InputLabel>
                    <Select value={action.route} label="Zielseite" onChange={(e) => updateAction(action.id, "route", e.target.value)}>
                      {availableRoutes.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Farbe</InputLabel>
                    <Select value={action.color} label="Farbe" onChange={(e) => updateAction(action.id, "color", e.target.value)}>
                      {AVAILABLE_COLORS.map((c) => <MenuItem key={c} value={c}><Chip label={c} color={c} size="small" /></MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
              <IconButton size="small" color="error" onClick={() => removeAction(action.id)} sx={{ mt: 0.5 }}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          </Box>
        ))}
        {actions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 1 }}>
            Keine Schnellzugriff-Buttons. Über „Hinzufügen" lassen sich welche anlegen.
          </Typography>
        )}
      </Stack>
    </>
  );
};

const DashboardSettingsDialog: React.FC<Props> = ({ open, onClose }) => {
  const { settings, saveSettings, saving } = useUserSettingsStore();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const availableRoutes = ALL_ROUTES.filter((r) => hasPermission(r.permissions));

  const [visibleWidgets, setVisibleWidgets] = useState<DashboardWidgetId[]>(settings.dashboard.visibleWidgets);
  const [quickActions, setQuickActions] = useState<QuickActions>(settings.quickActions);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setVisibleWidgets(settings.dashboard.visibleWidgets);
      setQuickActions(settings.quickActions);
      setActiveTab(0);
      setError(null);
    }
  }, [open, settings]);

  const toggleWidget = (widgetId: DashboardWidgetId) => {
    setVisibleWidgets((prev) =>
      prev.includes(widgetId) ? prev.filter((w) => w !== widgetId) : [...prev, widgetId],
    );
  };

  const handleSave = async () => {
    setError(null);
    try {
      await saveSettings({ ...settings, dashboard: { visibleWidgets, widgetOrder: settings.dashboard.widgetOrder }, quickActions });
      onClose();
    } catch {
      setError("Fehler beim Speichern der Einstellungen.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dashboard & Header anpassen</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Widget-Sichtbarkeit */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Widgets anzeigen</Typography>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          {(Object.keys(WIDGET_LABELS) as DashboardWidgetId[]).map((widgetId) => (
            <FormControlLabel
              key={widgetId}
              control={<Checkbox checked={visibleWidgets.includes(widgetId)} onChange={() => toggleWidget(widgetId)} />}
              label={WIDGET_LABELS[widgetId]}
            />
          ))}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Schnellzugriff-Buttons: PC / Mobil */}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Schnellzugriff im Header</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
          Buttons erscheinen oben im Header – getrennt konfigurierbar für PC und Mobilgerät.
        </Typography>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="PC / Desktop" />
          <Tab label="Mobil / Tablet" />
        </Tabs>

        {activeTab === 0 && (
          <QuickActionList
            actions={quickActions.desktop}
            onChange={(desktop) => setQuickActions({ ...quickActions, desktop })}
            availableRoutes={availableRoutes}
          />
        )}
        {activeTab === 1 && (
          <QuickActionList
            actions={quickActions.mobile}
            onChange={(mobile) => setQuickActions({ ...quickActions, mobile })}
            availableRoutes={availableRoutes}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Abbrechen</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DashboardSettingsDialog;
