import React, { useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { MovementDto } from "../../utils/api";
import { fetchMovementHistory } from "../../utils/api";
import useAuthStore from "../../store/useAuthStore";
import useOfflineQueue from "../../store/useOfflineQueue";

const DashboardRecentMovementsWidget: React.FC = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const [movements, setMovements] = useState<MovementDto[]>([]);
  const [loading, setLoading] = useState(false);
  const pendingMovements = useOfflineQueue((state) => state.movements);

  useEffect(() => {
    if (!userId) return;

    const cacheKey = `lv-dashboard-movements-${userId}`;

    if (!navigator.onLine) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) setMovements(JSON.parse(raw) as MovementDto[]);
      } catch {
        // ignore
      }
      return;
    }

    setLoading(true);
    void fetchMovementHistory({ userId, limit: 10 })
      .then((result) => {
        localStorage.setItem(cacheKey, JSON.stringify(result.movements));
        setMovements(result.movements);
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) setMovements(JSON.parse(raw) as MovementDto[]);
        } catch {
          setMovements([]);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const pendingForUser = pendingMovements.filter((m) => !userId || !m.userId || m.userId === userId);

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="h6">Letzte Buchungen</Typography>
        {loading && <CircularProgress size={18} />}
      </Box>
      {movements.length === 0 && pendingForUser.length === 0 && !loading ? (
        <Typography variant="body2" color="text.secondary">
          Noch keine Buchungen vorhanden.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Artikel</TableCell>
                <TableCell>Typ</TableCell>
                <TableCell align="right">Menge</TableCell>
                <TableCell>Datum</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingForUser.map((m) => (
                <TableRow key={`pending-${m.timestamp}`} sx={{ bgcolor: "action.hover" }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {m.code}
                    </Typography>
                    <Chip label="Ausstehend" size="small" color="warning" variant="outlined" sx={{ mt: 0.5, height: 16, fontSize: 10 }} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={m.type === "CHECKIN" ? "Eingang" : "Ausgang"}
                      color={m.type === "CHECKIN" ? "success" : "error"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">{m.quantity}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(m.timestamp).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {m.item.code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.item.description.length > 30
                        ? m.item.description.slice(0, 30) + "…"
                        : m.item.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={m.type === "CHECKIN" ? "Eingang" : "Ausgang"}
                      color={m.type === "CHECKIN" ? "success" : "error"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">{m.quantity}</TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(m.occurredAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default DashboardRecentMovementsWidget;
