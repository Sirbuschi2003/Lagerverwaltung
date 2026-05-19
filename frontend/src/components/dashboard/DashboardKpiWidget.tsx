import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";
import InventoryIcon from "@mui/icons-material/Inventory";
import AssignmentIcon from "@mui/icons-material/Assignment";
import useDashboardData from "../../store/useDashboardData";

const DashboardKpiWidget: React.FC = () => {
  const { summary, loadSummary } = useDashboardData();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!navigator.onLine) return;
    setLoading(true);
    void loadSummary().finally(() => setLoading(false));
  }, [loadSummary]);

  const tiles = [
    {
      label: "Artikel gesamt",
      value: summary.totalItems,
      icon: <InventoryIcon />,
      color: "primary.main",
    },
    {
      label: "Offene Inventuren",
      value: summary.openInventorySessions,
      icon: <AssignmentIcon />,
      color: summary.openInventorySessions > 0 ? "info.main" : "success.main",
    },
  ];

  return (
    <Grid container spacing={2}>
      {tiles.map((tile) => (
        <Grid item xs={12} sm={6} key={tile.label}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ color: tile.color }}>{tile.icon}</Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {loading ? <Skeleton width={40} /> : tile.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tile.label}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default DashboardKpiWidget;
