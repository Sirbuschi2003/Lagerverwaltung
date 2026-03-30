import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import axios from "axios";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import useBarcodeScanner from "../hooks/useBarcodeScanner";
import useOfflineQueue from "../store/useOfflineQueue";
import useScanSound from "../hooks/useScanSound";
import useAuthStore from "../store/useAuthStore";
import { recordMovement, updateRestockStatus } from "../utils/api";
import useItemsStore from "../store/useItemsStore";
import useRestockStore from "../store/useRestockStore";
import type { ItemDto } from "../utils/api";
import { findItemByCode } from "../utils/itemLookup";

type MovementType = "CHECKIN" | "CHECKOUT";

type AutocompleteOption = {
  item: ItemDto;
  label: string;
};

const parseAlternateCodes = (raw: string, primaryCode: string): string[] => {
  if (!raw.trim()) {
    return [];
  }
  const primary = primaryCode.toLowerCase();
  const parts = raw
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.toLowerCase() !== primary);
  return Array.from(new Set(parts));
};

const ScannerPage = () => {
  const { items, loadItems, addItem: addItemToStore } = useItemsStore();
  const { enqueueMovement, syncNow, isSyncing } = useOfflineQueue();
  const { playSuccess, playError } = useScanSound();
  const user = useAuthStore((state: any) => state.user);

  const [scannerActive, setScannerActive] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<AutocompleteOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    code: "",
    description: "",
    manufacturer: "",
    productGroup: "",
    targetStock: "",
    alternateCodes: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingItem, setCreatingItem] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      void loadItems();
    }
  }, [items.length, loadItems]);

  const options = useMemo<AutocompleteOption[]>(
    () =>
      (items || []).map((item: any) => ({
  item,
  label: `${item.code} - ${item.description}`,
      })),
    [items],
  );

  // Hole bereitgestellte Menge aus RestockRequest
  const myRequests = useRestockStore((state: { myRequests: any[] }) => state.myRequests);
  const openDialogForItem = useCallback(
    (item: ItemDto, code: string) => {
      setSelectedOption({ item, label: `${item.code} - ${item.description}` });
      // Prüfe, ob für das Fahrzeug und Item eine bereitgestellte Menge existiert
  const restock = myRequests.find((r: any) => r.item.id === item.id && r.quantityProvided && r.quantityProvided > 0);
      setQuantity(restock ? restock.quantityProvided : 1);
      setLastCode(code);
      setDialogOpen(true);
      setScannerActive(false);
      setErrorMessage(null);
    },
    [myRequests],
  );

  const handleDetected = useCallback(
    (code: string) => {
      setLastCode(code);
      const item = findItemByCode(items, code);
      if (item) {
        openDialogForItem(item, code);
        playSuccess();
      } else {
        setErrorMessage(`Artikel mit Code "${code}" nicht gefunden.`);
        setCreateDraft({
          code,
          description: "",
          manufacturer: "",
          productGroup: "",
          targetStock: "",
          alternateCodes: "",
        });
        setCreateError(null);
        setCreateDialogOpen(true);
        setScannerActive(false);
        playError();
      }
    },
    [items, openDialogForItem, playError, playSuccess],
  );

  const { 
    videoRef, 
    isSupported, 
    error: scannerError
  } = useBarcodeScanner({
    onDetected: handleDetected,
    enabled: scannerActive,
  });

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedOption(null);
    setQuantity(1);
    setScannerActive(true);
    setErrorMessage(null);
  }, []);

  const adjustQuantity = (delta: number) => {
    setQuantity((prev: any) => Math.max(1, prev + delta));
  };

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setQuantity(Number.isNaN(value) || value <= 0 ? 1 : value);
  };

  const handleMovement = async (type: MovementType) => {
    if (!selectedOption) {
      setErrorMessage("Bitte zuerst einen Artikel auswählen oder scannen.");
      playError();
      return;
    }

    if (!user?.vehicleId) {
      setErrorMessage("Deinem Benutzer ist kein Fahrzeug zugeordnet.");
      playError();
      return;
    }

    try {
      const readyRequest = myRequests.find(
        (request: any) =>
          request.item.id === selectedOption.item.id
          && request.status === "APPROVED"
          && (request.quantityProvided ?? 0) > 0,
      );

      if (type === "CHECKIN" && readyRequest) {
        await updateRestockStatus(readyRequest.id, {
          status: "FULFILLED" as any,
          note: `${Math.min(quantity, readyRequest.quantityProvided ?? quantity)} Stück über Scanner übernommen`,
        });
      } else {
        const recordPayload = {
          itemId: selectedOption.item.id,
          vehicleId: user.vehicleId,
          userId: user?.id ?? undefined,
          type,
          quantity,
          occurredAt: new Date().toISOString(),
          source: "scanner",
        };
        await recordMovement(recordPayload);
      }

      playSuccess();
      setInfoMessage(
  `${type === "CHECKOUT" ? "Ausgebucht" : "Eingebucht"}: ${selectedOption.item.code} - ${selectedOption.item.description}`,
      );
      closeDialog();
      return;
    } catch (err) {
      if (axios.isAxiosError(err) && (err as any).response) {
        // Server hat geantwortet (4xx/5xx) → Fehlermeldung anzeigen
        const message = Array.isArray((err as any).response.data?.message)
          ? (err as any).response.data.message.join(", ")
          : (err as any).response.data?.message ?? "Buchung konnte nicht gespeichert werden.";
        setErrorMessage(message);
        playError();
        return;
      }
      // Kein Netzwerk → Bewegung offline speichern
      console.warn("Online-Buchung fehlgeschlagen – speichere offline", err);
    }

    // Offline-Fallback: Bewegung in die Queue einreihen
    try {
      await enqueueMovement({
        itemId: selectedOption.item.id,
        code: selectedOption.item.code,
        type,
        quantity,
        timestamp: new Date().toISOString(),
        source: "scanner",
        vehicleId: user.vehicleId,
        userId: user?.id ?? undefined,
      });
      playSuccess();
      setInfoMessage(
        `${type === "CHECKOUT" ? "Ausgebucht" : "Eingebucht"} (offline gespeichert): ${selectedOption.item.code} - ${selectedOption.item.description}`,
      );
      closeDialog();
    } catch (queueErr) {
      setErrorMessage("Buchung konnte weder übertragen noch offline gespeichert werden.");
      playError();
    }
  };

  const handleManualSelection = (_: unknown, option: AutocompleteOption | null) => {
    if (option) {
      openDialogForItem(option.item, option.item.code);
    } else {
      setSelectedOption(null);
    }
  };

  const handleCreateFieldChange = (field: keyof typeof createDraft) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setCreateDraft((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleCreateCancel = () => {
    setCreateDialogOpen(false);
    setCreateError(null);
    setScannerActive(true);
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const code = createDraft.code.trim();
    const description = createDraft.description.trim();
    const manufacturer = createDraft.manufacturer.trim();
    const productGroup = createDraft.productGroup.trim();

    if (!code || !description || !manufacturer || !productGroup) {
      setCreateError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    const targetStockValue = Number(createDraft.targetStock);
    const alternateCodes = parseAlternateCodes(createDraft.alternateCodes, code);

    const payload = {
      code,
      description,
      manufacturer,
      productGroup,
      qrCodeValue: code,
      targetStock: Number.isFinite(targetStockValue) && targetStockValue > 0 ? targetStockValue : undefined,
      alternateCodes,
    };

    try {
      setCreatingItem(true);
      const created = await addItemToStore(payload);
      setCreateDialogOpen(false);
      setCreateError(null);
      setErrorMessage(null);
  setInfoMessage(`Artikel ${created.code} wurde angelegt.`);
      playSuccess();
      openDialogForItem(created, created.code);
    } catch (err) {
      if (axios.isAxiosError(err) && (err as any).response) {
        const message = Array.isArray((err as any).response.data?.message)
          ? (err as any).response.data.message.join(", ")
          : (err as any).response.data?.message ?? "Artikel konnte nicht angelegt werden.";
        setCreateError(message);
      } else {
        setCreateError("Artikel konnte nicht angelegt werden.");
      }
    } finally {
      setCreatingItem(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Teile scannen
      </Typography>

      {(scannerError || errorMessage) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {scannerError ?? errorMessage}
        </Alert>
      )}

      {infoMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfoMessage(null)}>
          {infoMessage}
        </Alert>
      )}

      {!isSupported && !scannerError && (
        <Alert severity="info" sx={{ mb: 2 }}>
          BarcodeDetector wird auf diesem Gerät nicht unterstützt. Du kannst den Code manuell auswählen.
        </Alert>
      )}

      <Paper sx={{ 
        p: { xs: 1, sm: 2 }, 
        mb: 2, 
        backgroundColor: "background.paper",
        width: "100%",
        overflow: "hidden",
        position: "relative"
      }}>
        <video 
          ref={videoRef} 
          style={{ 
            width: "100%", 
            height: "auto",
            maxHeight: "60vh",
            borderRadius: 8,
            objectFit: "cover"
          }} 
          muted 
          playsInline 
        />
        
        {/* Kamera-Wechsel nicht mehr verfügbar in vereinfachter Implementation */}
        
        {/* Kamera-Info nicht mehr verfügbar in vereinfachter Implementation */}
      </Paper>

      <Stack 
        direction={{ xs: "column", sm: "row" }} 
        spacing={2} 
        sx={{ 
          mb: 2,
          width: "100%"
        }}
      >
        <Button
          variant={scannerActive ? "contained" : "outlined"}
          onClick={() => setScannerActive((prev) => !prev)}
          sx={{ 
            minHeight: 44,
            flex: { xs: 1, sm: 'auto' },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          {scannerActive ? "Scanner stoppen" : "Scanner starten"}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setScannerActive(false);
            setDialogOpen(true);
            setErrorMessage(null);
          }}
          disabled={options.length === 0}
          sx={{ 
            minHeight: 44,
            flex: { xs: 1, sm: 'auto' },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Artikel manuell auswählen
        </Button>
      </Stack>

      {lastCode && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          Zuletzt gescannt: {lastCode}
        </Typography>
      )}

      <Button variant="contained" color="primary" onClick={() => void syncNow()} disabled={isSyncing}>
        Bewegungen synchronisieren
      </Button>

      <Dialog 
        open={createDialogOpen} 
        onClose={handleCreateCancel} 
        fullWidth 
        maxWidth="sm"
        sx={{
          '& .MuiDialog-paper': {
            margin: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: 'auto' },
            maxHeight: { xs: '95vh', sm: '90vh' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 600 }
          }
        }}
      >
        <DialogTitle>Neuen Artikel anlegen</DialogTitle>
        <Box component="form" onSubmit={handleCreateSubmit} noValidate>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="Artikelcode"
                value={createDraft.code}
                onChange={handleCreateFieldChange("code")}
                required
                autoFocus
              />
              <TextField
                label="Beschreibung"
                value={createDraft.description}
                onChange={handleCreateFieldChange("description")}
                required
              />
              <TextField
                label="Hersteller"
                value={createDraft.manufacturer}
                onChange={handleCreateFieldChange("manufacturer")}
                required
              />
              <TextField
                label="Warengruppe"
                value={createDraft.productGroup}
                onChange={handleCreateFieldChange("productGroup")}
                required
              />
              <TextField
                label="Soll-Bestand"
                type="number"
                inputProps={{ min: 0, inputMode: "numeric", pattern: "[0-9]*" }}
                value={createDraft.targetStock}
                onChange={handleCreateFieldChange("targetStock")}
              />
              <TextField
                label="Weitere Codes"
                helperText="Optional: getrennt durch Komma oder Leerzeichen"
                multiline
                minRows={2}
                value={createDraft.alternateCodes}
                onChange={handleCreateFieldChange("alternateCodes")}
              />
              {createError && (
                <Alert severity="error" onClose={() => setCreateError(null)}>
                  {createError}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCreateCancel} disabled={isCreatingItem}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={isCreatingItem}>
              {isCreatingItem ? "Speichere..." : "Anlegen"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog 
        open={dialogOpen} 
        onClose={closeDialog} 
        fullWidth 
        maxWidth="sm"
        sx={{
          '& .MuiDialog-paper': {
            margin: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: 'auto' },
            maxHeight: { xs: '95vh', sm: '90vh' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 600 }
          }
        }}
      >
        <DialogTitle>Bewegung erfassen</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Autocomplete
              options={options}
              value={selectedOption}
              onChange={handleManualSelection}
              renderInput={(params) => (
                <TextField {...params} label="Artikel" placeholder="Code oder Beschreibung" fullWidth />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Stack spacing={0.25}>
                    <Typography variant="body2">{option.item.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.item.code} - {option.item.manufacturer || "-"}
                    </Typography>
                  </Stack>
                </li>
              )}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, value) => option.item.id === value.item.id}
              noOptionsText="Keine Artikel gefunden"
            />

            {selectedOption && (
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: "action.hover" }}>
                <Typography variant="subtitle2">{selectedOption.item.description}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Code: {selectedOption.item.code}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Hersteller: {selectedOption.item.manufacturer || "-"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Warengruppe: {selectedOption.item.productGroup || "-"}
                </Typography>
              </Box>
            )}

            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
              <IconButton
                size="large"
                color="primary"
                onClick={() => adjustQuantity(-1)}
                disabled={quantity <= 1}
                aria-label="Menge verringern"
              >
                <RemoveIcon />
              </IconButton>
              <TextField
                label="Menge"
                type="number"
                inputProps={{ min: 1, inputMode: "numeric", pattern: "[0-9]*" }}
                value={quantity}
                onChange={handleQuantityChange}
                sx={{ width: 120 }}
              />
              <IconButton
                size="large"
                color="primary"
                onClick={() => adjustQuantity(1)}
                aria-label="Menge erhöhen"
              >
                <AddIcon />
              </IconButton>
            </Stack>

            {selectedOption && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  size="large"
                  onClick={() => void handleMovement("CHECKIN")}
                >
                  Buchung von Lager erhalten
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  size="large"
                  onClick={() => void handleMovement("CHECKOUT")}
                >
                  Ausbuchen zum Kunden
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Schließen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScannerPage;

