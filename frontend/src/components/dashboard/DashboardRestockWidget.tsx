import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete } from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useLiveFleetStock } from "../../hooks/useLiveFleetStock";
import useAuthStore from "../../store/useAuthStore";
import useRestockStore from "../../store/useRestockStore";
import type { RestockRequestDto, RestockRequestStatus, StockLevelDto } from "../../utils/api";

const statusLabelMap: Record<RestockRequestStatus, string> = {
  PENDING: "Offen",
  APPROVED: "Bereitgestellt",
  FULFILLED: "Erledigt",
  CANCELLED: "Abgebrochen",
};

const statusColorMap: Record<
  RestockRequestStatus,
  "default" | "warning" | "info" | "success" | "secondary"
> = {
  PENDING: "warning",
  APPROVED: "info",
  FULFILLED: "success",
  CANCELLED: "secondary",
};

type Technician = {
  id: string;
  displayName: string;
  vehicleId: string | null;
};

type GroupTechnician = {
  id: string;
  displayName: string;
  vehicleId?: string | null;
};

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

const toApiError = (value: unknown): ApiError => {
  if (typeof value === "object" && value !== null) return value as ApiError;
  return {};
};

const DashboardRestockWidget: React.FC = () => {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const user = useAuthStore((state) => state.user);
  const canManageRequests = hasPermission("restock.manage");
  const canViewFleet = hasPermission("fleet.view");
  // Lagermitarbeiter: kein Fahrzeug, aber Lagerort zugewiesen → sieht + bearbeitet offene Anforderungen
  const isWarehouseStaff = !user?.vehicleId && (user?.locationIds?.length ?? 0) > 0;
  const canSeeFleetRequests = canManageRequests || isWarehouseStaff;

  const fleetRequests = useRestockStore((state) => state.fleetRequests);
  const updateStatus = useRestockStore((state) => state.updateStatus);
  const myRequests = useRestockStore((state) => state.myRequests);
  const loadFleet = useRestockStore((state) => state.loadFleet);

  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [quantityInputs, setQuantityInputs] = useState<Record<string, number>>({});
  const [stock, setStock] = useState<StockLevelDto[]>([]);
  const [isLoadingStock, setLoadingStock] = useState(false);
  const [stockRefreshKey, setStockRefreshKey] = useState(0);

  const refreshStock = () => setStockRefreshKey((k) => k + 1);

  const refreshInterval = user?.refreshInterval ?? 15000;

  const vehicleId = useMemo(() => {
    if (user?.vehicleId) {
      const cacheKey = `lv-offline-vehicleId-${user.id}`;
      localStorage.setItem(cacheKey, user.vehicleId);
      return user.vehicleId;
    }
    if (user?.id) {
      const cacheKey = `lv-offline-vehicleId-${user.id}`;
      return localStorage.getItem(cacheKey);
    }
    return null;
  }, [user?.vehicleId, user?.id]);

  // Techniker laden
  useEffect(() => {
    if (!canViewFleet && !canSeeFleetRequests) return;
    if (!navigator.onLine) return;

    const loadTechnicians = async () => {
      try {
        const api = await import("../../utils/api");
        const data = await api.fetchTechnicians();
        setTechnicians(data);
      } catch {
        setTechnicians([]);
      }
    };

    void loadTechnicians();
  }, [canViewFleet, canSeeFleetRequests]);

  // Fahrzeugbestand für Techniker laden
  useEffect(() => {
    if (!vehicleId) {
      setStock([]);
      setLoadingStock(false);
      return;
    }

    const cacheKey = `lv-dashboard-stock-${vehicleId}`;

    if (!navigator.onLine) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) setStock(JSON.parse(raw) as StockLevelDto[]);
      } catch {
        // ignore
      }
      setLoadingStock(false);
      return;
    }

    setLoadingStock(true);
    import("../../utils/api")
      .then((api) => api.fetchVehicleStock(vehicleId))
      .then((data) => {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        setStock(data);
        setLoadingStock(false);
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) setStock(JSON.parse(raw) as StockLevelDto[]);
        } catch {
          setStock([]);
        }
        setLoadingStock(false);
      });
  }, [vehicleId, stockRefreshKey]);

  // Initiales Laden
  useEffect(() => {
    if (canSeeFleetRequests) {
      void loadFleet("OPEN");
    } else if (vehicleId) {
      const loadForVehicle = useRestockStore.getState().loadForVehicle;
      void loadForVehicle(vehicleId);
    }
  }, [canSeeFleetRequests, vehicleId, loadFleet]);

  useLiveFleetStock({
    onUpdate: () => {
      if (canSeeFleetRequests) {
        void loadFleet("OPEN");
      } else if (vehicleId) {
        const loadForVehicle = useRestockStore.getState().loadForVehicle;
        void loadForVehicle(vehicleId);
      }
    },
    interval: refreshInterval,
  });

  const shortages = useMemo(
    () =>
      (stock || []).filter((entry) => {
        if (!entry.item) return false;
        const hasTargetShortage = entry.targetQuantity > 0 && entry.quantity < entry.targetQuantity;
        const hasMinStockShortage =
          entry.item.minimumStock != null &&
          entry.item.minimumStock > 0 &&
          entry.quantity < entry.item.minimumStock;
        if (!hasTargetShortage && !hasMinStockShortage) return false;
        // Prüfen ob eine aktive (nicht-FULFILLED) Anfrage existiert
        // (Backend liefert nur nicht-FULFILLED Requests zurück)
        const hasActiveRequest = (myRequests || []).some((r) => r.item.id === entry.item.id);
        if (hasActiveRequest) return true;
        // Kein aktiver Request: nur anzeigen wenn echte Ziel-Unterschreitung vorliegt
        // (minimumStock-Only-Unterschreitungen nach FULFILLED ausblenden)
        return hasTargetShortage;
      }),
    [stock, myRequests],
  );

  const handleQuantityChange = (requestId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setQuantityInputs((prev) => ({ ...prev, [requestId]: numValue }));
  };

  const handleProvideQuantity = async (request: RestockRequestDto) => {
    const quantityToProvide = quantityInputs[request.id];
    if (!quantityToProvide || quantityToProvide <= 0) return;

    const currentProvided = request.quantityProvided ?? 0;
    const newTotal = currentProvided + quantityToProvide;
    const status: RestockRequestStatus = newTotal > 0 ? "APPROVED" : "PENDING";

    const payload = {
      status,
      quantityProvided: newTotal,
      note: `Bereitgestellt: ${newTotal}/${request.quantityNeeded}${
        status === "APPROVED" && newTotal < (request.quantityNeeded ?? 0)
          ? " (Teilmenge)"
          : " (Komplett)"
      }`,
    };

    try {
      await updateStatus(request.id, payload);
      setQuantityInputs((prev) => ({ ...prev, [request.id]: 0 }));
      setTimeout(() => void loadFleet("OPEN"), 500);
    } catch (error: unknown) {
      const apiError = toApiError(error);
      const details = apiError.response?.data
        ? JSON.stringify(apiError.response.data)
        : (apiError.message ?? "Unbekannter Fehler");
      alert(`Fehler beim Bereitstellen: ${details}`);
    }
  };

  const getFleetStatusForRequest = (
    request: RestockRequestDto,
  ): { label: string; color: ChipProps["color"] } => {
    const provided = request.quantityProvided ?? 0;
    const needed = request.quantityNeeded ?? 0;
    if (provided >= needed && needed > 0)
      return { label: `Vollständig (${provided}/${needed})`, color: "success" };
    if (provided > 0 && provided < needed)
      return { label: `Teilweise (${provided}/${needed})`, color: "warning" };
    const fallbackLabel = statusLabelMap[request.status] ?? "Offen";
    const fallbackColor = statusColorMap[request.status] ?? "error";
    return { label: fallbackLabel, color: fallbackColor };
  };

  const renderGroupedRows = () => {
    const openRequests = (fleetRequests || []).filter((r) => r.status !== "FULFILLED");
    const grouped = openRequests.reduce(
      (acc, req) => {
        const tech = technicians.find((t) => t.vehicleId === req.vehicle.id) || null;
        const techId = tech?.id || req.vehicle.id || "unbekannt";
        if (!acc[techId]) acc[techId] = { tech, requests: [] };
        acc[techId].requests.push(req);
        return acc;
      },
      {} as Record<string, { tech: GroupTechnician | null; requests: RestockRequestDto[] }>,
    );

    let techIds: string[];
    if (technicians.length > 0) {
      const knownTechIds = technicians.map((t) => t.id).filter((id) => grouped[id]);
      const otherGroupIds = Object.keys(grouped).filter((id) => !knownTechIds.includes(id));
      techIds = [...knownTechIds, ...otherGroupIds];
    } else {
      techIds = Object.keys(grouped);
    }

    if (selectedTechnician) {
      techIds = techIds.filter((id) => id === selectedTechnician);
    }

    return techIds.flatMap((techId) => {
      const group = grouped[techId];
      if (!group) return [];

      let technikerName = group.tech?.displayName;
      if (!technikerName && group.requests.length > 0) {
        technikerName = group.requests[0].vehicle?.description ?? undefined;
      }
      if (!technikerName) technikerName = "Unbekannt";

      const header = (
        <TableRow key={"header-" + techId}>
          <TableCell colSpan={9} sx={{ background: "transparent", border: 0, px: 0, py: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "linear-gradient(90deg, #fff3e0 60%, #ffe0b2 100%)",
                borderRadius: "10px",
                boxShadow: "0 2px 12px 0 rgba(255,152,0,0.10)",
                my: 2,
                px: 2.5,
                py: 1.2,
                minHeight: 48,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 36,
                  borderRadius: "6px",
                  background: "linear-gradient(180deg, #ff9800 60%, #ffd180 100%)",
                  mr: 2,
                }}
              />
              <Box
                sx={{
                  fontWeight: 800,
                  fontSize: "1.08rem",
                  color: "#222",
                  letterSpacing: 0.2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <span style={{ fontSize: 20, marginRight: 6 }}>👤</span> {technikerName}
              </Box>
              <Box sx={{ flex: 1 }} />
              <Box
                sx={{
                  background: "#ff9800",
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: "12px",
                  px: 1.5,
                  fontSize: "0.95rem",
                  letterSpacing: 0.2,
                  boxShadow: "0 1px 4px 0 rgba(255,152,0,0.10)",
                }}
              >
                {group.requests.length} offen
              </Box>
            </Box>
          </TableCell>
        </TableRow>
      );

      const rows = group.requests.map((request, idx) => {
        let rowColor: string | undefined = undefined;
        const provided = request.quantityProvided ?? 0;
        const needed = request.quantityNeeded ?? 0;
        if (request.status === "APPROVED" && provided >= needed && needed > 0)
          rowColor = "rgba(76,175,80,0.08)";
        else if (provided > 0 && provided < needed) rowColor = "rgba(255,193,7,0.08)";
        else if (needed > 0)
          rowColor = idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)";

        return (
          <TableRow
            key={request.id}
            sx={{
              backgroundColor: rowColor,
              transition: "background 0.2s",
              "&:hover": { backgroundColor: "rgba(255,152,0,0.10)" },
              borderBottom: "1.5px solid #232323",
            }}
          >
            <TableCell>{request.vehicle?.licensePlate ?? "-"}</TableCell>
            <TableCell>{request.vehicle?.description ?? "-"}</TableCell>
            <TableCell>
              {request.item.code} - {request.item.description}
            </TableCell>
            <TableCell align="right">{request.quantityNeeded}</TableCell>
            <TableCell align="right">
              <Chip
                size="small"
                label={request.warehouseAvailable ?? 0}
                color={
                  (request.warehouseAvailable ?? 0) >= (request.quantityNeeded ?? 0)
                    ? "success"
                    : "warning"
                }
                variant="outlined"
              />
            </TableCell>
            <TableCell align="right">{request.quantityProvided ?? 0}</TableCell>
            <TableCell align="right">
              {role === "WAREHOUSE" ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {provided < needed && request.status !== "FULFILLED" ? (
                    <>
                      <TextField
                        type="number"
                        size="small"
                        value={quantityInputs[request.id] || ""}
                        onChange={(e) => handleQuantityChange(request.id, e.target.value)}
                        inputProps={{
                          min: 1,
                          max: needed - provided,
                          style: { width: "60px", fontSize: "0.8rem" },
                        }}
                        placeholder={String(needed - provided)}
                        sx={{ width: "80px" }}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={
                          !quantityInputs[request.id] ||
                          quantityInputs[request.id] <= 0 ||
                          quantityInputs[request.id] > needed - provided
                        }
                        onClick={() => void handleProvideQuantity(request)}
                        sx={{ fontSize: "0.7rem", px: 1, py: 0.5 }}
                      >
                        Bereitstellen ({quantityInputs[request.id] || 0})
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => {
                          void (async () => {
                            const payload = {
                              status: "APPROVED" as RestockRequestStatus,
                              quantityProvided: needed,
                              note: `Bereitgestellt: ${needed}/${needed} (Komplett)`,
                            };
                            try {
                              await updateStatus(request.id, payload);
                              setTimeout(() => void loadFleet("OPEN"), 500);
                            } catch (error: unknown) {
                              const apiError = toApiError(error);
                              const details = apiError.response?.data
                                ? JSON.stringify(apiError.response.data)
                                : (apiError.message ?? "Unbekannter Fehler");
                              alert(`Fehler beim kompletten Bereitstellen: ${details}`);
                            }
                          })();
                        }}
                        sx={{ fontSize: "0.7rem", px: 1, py: 0.5 }}
                      >
                        Alles ({needed - provided})
                      </Button>
                    </>
                  ) : (
                    <Typography variant="body2" color="success.main">
                      {provided}/{needed}
                    </Typography>
                  )}
                </Box>
              ) : (
                <input
                  type="number"
                  min={0}
                  max={needed}
                  value={provided}
                  style={{ width: 60 }}
                  disabled={request.status === "FULFILLED"}
                  onChange={(e) => {
                    void (async () => {
                      const value = Number(e.target.value);
                      if (!isNaN(value) && value >= 0 && value <= needed) {
                        let status: RestockRequestStatus = "PENDING";
                        if (value > 0 && value < needed) {
                          status = "PENDING";
                        } else if (value === needed) {
                          status = "APPROVED";
                        }
                        const payload = {
                          status,
                          quantityProvided: value,
                          note: `Bereitgestellt: ${value}/${needed}${
                            value > 0 && value < needed
                              ? " (Teilmenge)"
                              : value === needed
                                ? " (Komplett)"
                                : ""
                          }`,
                        };
                        try {
                          await updateStatus(request.id, payload);
                          setTimeout(() => void loadFleet("OPEN"), 500);
                        } catch {
                          // Fehlerbehandlung
                        }
                      }
                    })();
                  }}
                />
              )}
            </TableCell>
            <TableCell>
              <Chip
                label={getFleetStatusForRequest(request).label}
                color={getFleetStatusForRequest(request).color}
                size="small"
              />
            </TableCell>
            <TableCell align="right">
              {request.status !== "FULFILLED" && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() =>
                    void updateStatus(request.id, { status: "PENDING", quantityProvided: 0 })
                  }
                >
                  Rückgängig
                </Button>
              )}
              {provided > 0 && request.status !== "FULFILLED" && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={() =>
                    void updateStatus(request.id, {
                      status: "APPROVED",
                      quantityProvided: provided,
                    })
                  }
                >
                  Abschließen
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      });

      return [header, ...rows];
    });
  };

  if (!vehicleId && !canSeeFleetRequests) return null;

  return (
    <>
      {/* Techniker-Ansicht */}
      {vehicleId && !canManageRequests && (
        <Paper sx={{ p: 2, backgroundColor: "background.paper", minHeight: 180 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6">Teileübersicht</Typography>
            {isLoadingStock && <CircularProgress size={20} />}
          </Stack>
          {shortages.length === 0 && myRequests.length === 0 && !isLoadingStock ? (
            <Typography variant="body2" color="text.secondary">
              Aktuell fehlen keine Teile auf deinem Fahrzeug.
            </Typography>
          ) : (
            <TableContainer sx={{ maxWidth: "100vw", overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Artikel</TableCell>
                    <TableCell align="right">Soll/Ist</TableCell>
                    <TableCell align="right">
                      Benötigt/
                      <br />
                      Bereitgestellt
                    </TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Aktion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shortages.map((entry) => {
                    const req = myRequests.find(
                      (r) => r.item.id === entry.item.id && r.status !== "FULFILLED",
                    );
                    const provided = req?.quantityProvided ?? 0;
                    const needed = req?.quantityNeeded ?? entry.targetQuantity;
                    const status =
                      req?.status ||
                      (entry.quantity < entry.targetQuantity ? "PENDING" : "FULFILLED");
                    let rowColor: string | undefined = undefined;
                    if (status === "APPROVED" && provided >= needed && needed > 0)
                      rowColor = "rgba(76,175,80,0.08)";
                    else if (provided > 0 && provided < needed) rowColor = "rgba(255,193,7,0.08)";
                    else if (needed > 0 && provided === 0) rowColor = "rgba(229,57,53,0.08)";
                    return (
                      <TableRow
                        key={entry.id || entry.item.id}
                        sx={{ backgroundColor: rowColor }}
                      >
                        <TableCell
                          sx={{
                            maxWidth: 120,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={entry.item.code + " " + entry.item.description}
                        >
                          <b>{entry.item.code}</b>
                          <br />
                          <span style={{ fontSize: 12 }}>
                            {entry.item.description.length > 22
                              ? entry.item.description.slice(0, 22) + "…"
                              : entry.item.description}
                          </span>
                          {/* Mobile: Aktion unterhalb */}
                          <Box
                            sx={{
                              display: {
                                xs: status === "APPROVED" ? "block" : "none",
                                sm: "none",
                              },
                              mt: 1,
                            }}
                          >
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              fullWidth
                              disabled={provided <= 0}
                              onClick={() => {
                                if (!req) return;
                                void (async () => {
                                  try {
                                    await updateStatus(req.id, { status: "FULFILLED" });
                                    if (vehicleId) {
                                      const loadForVehicle =
                                        useRestockStore.getState().loadForVehicle;
                                      void loadForVehicle(vehicleId);
                                    }
                                    refreshStock();
                                  } catch {
                                    // Fehlerbehandlung
                                  }
                                })();
                              }}
                            >
                              Erhalten
                            </Button>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {entry.targetQuantity} / {entry.quantity}
                        </TableCell>
                        <TableCell align="right">
                          {needed} / {provided > 0 ? provided : "-"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusLabelMap[status as RestockRequestStatus]}
                            color={statusColorMap[status as RestockRequestStatus]}
                            size="small"
                          />
                        </TableCell>
                        {/* Desktop: Aktion rechts */}
                        <TableCell
                          align="center"
                          sx={{ display: { xs: "none", sm: "table-cell" } }}
                        >
                          {status === "APPROVED" && (
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              disabled={provided <= 0}
                              onClick={() => {
                                if (!req) return;
                                void (async () => {
                                  try {
                                    await updateStatus(req.id, { status: "FULFILLED" });
                                    if (vehicleId) {
                                      const loadForVehicle =
                                        useRestockStore.getState().loadForVehicle;
                                      void loadForVehicle(vehicleId);
                                    }
                                    refreshStock();
                                  } catch {
                                    // Fehlerbehandlung
                                  }
                                })();
                              }}
                            >
                              Erhalten
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Lager-Ansicht */}
      {canSeeFleetRequests && (
        <Paper sx={{ p: 3, backgroundColor: "background.paper" }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Offene Anforderungen (Lager)
            </Typography>
            <Autocomplete
              options={technicians}
              getOptionLabel={(t) => t.displayName || t.id}
              value={
                selectedTechnician
                  ? technicians.find((t) => t.id === selectedTechnician) || null
                  : null
              }
              onChange={(_, val) => setSelectedTechnician(val ? val.id : null)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Techniker filtern"
                  size="small"
                  sx={{ minWidth: 220 }}
                />
              )}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              clearOnEscape
              clearText="Alle"
            />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fahrzeug</TableCell>
                  <TableCell>Techniker</TableCell>
                  <TableCell>Artikel</TableCell>
                  <TableCell align="right">Fehlt</TableCell>
                  <TableCell align="right">Im Lager</TableCell>
                  <TableCell align="right">Bereitgestellt</TableCell>
                  <TableCell align="right">Menge setzen</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Aktion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{renderGroupedRows()}</TableBody>
            </Table>
          </TableContainer>
          {fleetRequests.length === 0 && (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                Keine offenen Anforderungen vorhanden
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </>
  );
};

export default DashboardRestockWidget;
