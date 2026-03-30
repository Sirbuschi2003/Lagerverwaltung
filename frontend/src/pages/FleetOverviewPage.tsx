import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import useVehiclesStore from "../store/useVehiclesStore";
import { useLiveData } from "../hooks/useLiveData";
import { fetchFleetStock } from "../utils/api";
import RefreshControl from "../components/RefreshControl";

const FleetOverviewPage = () => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { vehicles, loadVehicles } = useVehiclesStore();
  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // Live-Daten mit automatischer Aktualisierung
  const { data: fleetData, loading: isLoading, error, refresh } = useLiveData({
    fetcher: () => fetchFleetStock({
      vehicleId: selectedVehicleId ?? undefined,
      search: search.trim() || undefined
    }),
    enabled: true,
    immediate: true,
  });

  // Daten neu laden bei Fahrzeug- oder Suchänderung
  useEffect(() => { refresh(); }, [selectedVehicleId, search]);

  const data = fleetData || [];

  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle: any) => ({
      ...vehicle,
      label: `${vehicle.licensePlate} - ${vehicle.description}`
    })),
    [vehicles],
  );

  // Techniker-Optionen direkt aus dem API-Response ableiten
  const technicianOptions = useMemo(() => {
    const names = new Set<string>();
    data.forEach((v) => {
      if (v.vehicle.technicianName) names.add(v.vehicle.technicianName);
    });
    return Array.from(names).sort();
  }, [data]);

  // Daten gruppiert nach Techniker
  const groupedData = useMemo(() => {
    let vehicleData = data;
    if (selectedVehicleId) {
      vehicleData = vehicleData.filter((item) => item.vehicle.id === selectedVehicleId);
    }
    // Flatten zu Stock-Einträgen mit Techniker-Zuordnung
    const stockEntries = vehicleData.flatMap((vehicleStock) =>
      vehicleStock.stock.map((stockEntry) => ({
        ...stockEntry,
        vehicleId: vehicleStock.vehicle.id,
        vehicleLicensePlate: vehicleStock.vehicle.licensePlate,
        technicianName: vehicleStock.vehicle.technicianName ?? "Kein Techniker zugeordnet",
      }))
    );
    // Filter nach Techniker
    const filtered = selectedTechnician
      ? stockEntries.filter((item) => item.technicianName === selectedTechnician)
      : stockEntries;
    // Filter nach Suchbegriff (clientseitig, zusätzlich zur Backend-Suche)
    const searchTerm = search.trim().toLowerCase();
    const final = searchTerm
      ? filtered.filter((item) =>
          item.code.toLowerCase().includes(searchTerm) ||
          item.description.toLowerCase().includes(searchTerm) ||
          item.vehicleLicensePlate.toLowerCase().includes(searchTerm) ||
          item.technicianName.toLowerCase().includes(searchTerm)
        )
      : filtered;
    // Gruppieren nach Techniker
    return final.reduce((acc, item) => {
      const key = item.technicianName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, typeof final>);
  }, [data, selectedVehicleId, selectedTechnician, search]);

  const getStockStatus = (quantity: number, targetQuantity: number) => {
    if (quantity === 0 && targetQuantity > 0) return { label: "Fehlbestand", color: "error" as const };
    if (quantity < targetQuantity) return { label: "Unterbestand", color: "warning" as const };
    if (quantity > targetQuantity) return { label: "Überbestand", color: "info" as const };
    return { label: "OK", color: "success" as const };
  };

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Fahrzeugbestände
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <RefreshControl onManualRefresh={refresh} isLoading={isLoading} compact />
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Autocomplete
            options={technicianOptions}
            getOptionLabel={(o) => o}
            renderInput={(params) => <TextField {...params} label="Techniker auswählen" />}
            value={selectedTechnician}
            onChange={(_, newValue) => setSelectedTechnician(newValue)}
            sx={{ minWidth: 280 }}
          />
          <Autocomplete
            options={vehicleOptions}
            getOptionLabel={(option: any) => option.label}
            renderInput={(params) => <TextField {...params} label="Fahrzeug auswählen" />}
            value={vehicleOptions.find((v: any) => v.id === selectedVehicleId) || null}
            onChange={(_, newValue: any) => setSelectedVehicleId(newValue?.id || null)}
            sx={{ minWidth: 280 }}
          />
          <TextField
            label="Suche"
            placeholder="Artikelcode, Beschreibung, Kennzeichen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280 }}
          />
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Fehler beim Laden der Daten: {String(error)}
        </Alert>
      )}

      {Object.keys(groupedData).length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          {isLoading ? 'Lade Daten...' : 'Keine Daten gefunden'}
        </Paper>
      ) : (
        Object.entries(groupedData).map(([technicianName, items]) => (
          <Box key={technicianName} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 1, mt: 2 }}>
              {technicianName}
            </Typography>
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
              <TableContainer>
                <Table sx={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "42%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <TableHead>
                    <TableRow>
                      <TableCell>Fahrzeug</TableCell>
                      <TableCell>Artikelcode</TableCell>
                      <TableCell>Beschreibung</TableCell>
                      <TableCell align="right">Ist</TableCell>
                      <TableCell align="right">Soll</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => {
                      const status = getStockStatus(item.quantity, item.targetQuantity);
                      return (
                        <TableRow key={`${item.vehicleId}-${item.stockLevelId}-${index}`}>
                          <TableCell>{item.vehicleLicensePlate}</TableCell>
                          <TableCell>{item.code}</TableCell>
                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.description}
                          </TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{item.targetQuantity}</TableCell>
                          <TableCell>
                            <Chip label={status.label} color={status.color} size="small" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        ))
      )}

      {Object.values(groupedData).flat().length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {Object.values(groupedData).flat().length} Einträge gefunden
          </Typography>
          {isLoading && <Typography variant="body2" color="primary">Aktualisiere...</Typography>}
        </Box>
      )}
    </Container>
  );
};

export default FleetOverviewPage;
