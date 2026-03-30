import React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import * as MuiIcons from "@mui/icons-material";
import { useUserSettingsStore } from "../../store/useUserSettingsStore";

const getIcon = (iconName: string): React.ReactElement => {
  const IconComponent = (MuiIcons as Record<string, React.ElementType>)[iconName];
  if (IconComponent) return <IconComponent />;
  return <MuiIcons.Star />;
};

const DashboardQuickActionsWidget: React.FC = () => {
  const navigate = useNavigate();
  const quickActions = useUserSettingsStore((state) => state.settings.quickActions);

  if (quickActions.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Keine Schnellzugriff-Buttons konfiguriert. Über „Dashboard anpassen" lassen sich welche hinzufügen.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        Schnellzugriff
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {quickActions.map((action) => (
          <Button
            key={action.id}
            variant="contained"
            color={action.color as "primary" | "secondary" | "success" | "warning" | "info" | "error"}
            startIcon={getIcon(action.icon)}
            onClick={() => navigate(action.route)}
            sx={{ borderRadius: 2, textTransform: "none", minWidth: 150 }}
          >
            {action.label}
          </Button>
        ))}
      </Box>
    </Paper>
  );
};

export default DashboardQuickActionsWidget;
