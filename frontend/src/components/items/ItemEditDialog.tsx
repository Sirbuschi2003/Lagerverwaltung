import React, { useEffect, useState, useMemo, useCallback, type ChangeEvent } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteIcon from "@mui/icons-material/Delete";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import {
  fetchItemById,
  updateItem,
  fetchSuppliers,
  fetchLocations,
  recordMovement,
  uploadItemImage,
  deleteItemImage,
  getItemImageUrl,
  fetchLastOrderForItem,
  fetchVehicleStock,
  type CreateItemRequest,
  type ItemDto,
  type LocationDto,
  type LastOrderForItemDto,
  type StockLevelDto,
} from "../../utils/api";
import useAuthStore from "../../store/useAuthStore";
import useBarcodeScanner from "../../hooks/useBarcodeScanner";

// ─── Hilfsfunktionen (identisch zu ItemsPage) ────────────────────────────────

const parseAlternateCodesFromText = (raw: string, primaryCode: string): string[] => {
  if (!raw.trim()) return [];
  const primary = primaryCode.toLowerCase();
  const parts = raw
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.toLowerCase() !== primary);
  return Array.from(new Set(parts));
};

const getLocationPathFromMap = (loc: any, locationById: Map<string, any>): string => {
  if (!loc) return "";
  const pathParts: string[] = [];
  const seen = new Set<string>();
  let current = loc;
  while (current?.id && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.code) pathParts.push(current.code);
    const parentId = current.parent?.id;
    if (!parentId) break;
    current = locationById.get(parentId) ?? current.parent;
  }
  return pathParts.reverse().join(" / ");
};

// ─── Inline QR-Scanner Dialog ────────────────────────────────────────────────

const QrScannerDialog = ({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}) => {
  const { videoRef, isSupported, error } = useBarcodeScanner({
    onDetected: (value) => {
      onDetected(value);
      onClose();
    },
  });
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>QR-Code scannen</DialogTitle>
      <DialogContent dividers>
        {!isSupported && !error && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Kamera-Zugriff wird von diesem Gerät oder Browser nicht erlaubt.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box>
          <video ref={videoRef} style={{ width: "100%", borderRadius: 12 }} muted playsInline />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Typen ────────────────────────────────────────────────────────────────────

type ItemFormState = CreateItemRequest & { alternateCodesText: string; currentQuantity?: number };

const emptyForm = (): ItemFormState => ({
  code: "",
  description: "",
  descriptionSecondary: "",
  manufacturer: "",
  productGroup: "",
  qrCodeValue: "",
  targetStock: 0,
  storageLocationId: "",
  supplierId: "",
  price: undefined,
  packSize: undefined,
  orderQuantity: undefined,
  alternateCodes: [],
  alternateCodesText: "",
  currentQuantity: undefined,
  minimumStock: undefined,
  reorderPoint: undefined,
});

const itemToForm = (item: ItemDto): ItemFormState => ({
  code: item.code,
  description: item.description,
  descriptionSecondary: item.descriptionSecondary ?? "",
  manufacturer: item.manufacturer,
  productGroup: item.productGroup,
  qrCodeValue: item.qrCodeValue ?? "",
  targetStock: item.targetStock,
  minimumStock: item.minimumStock ?? undefined,
  reorderPoint: item.reorderPoint ?? undefined,
  storageLocationId: item.storageLocation?.id ?? "",
  supplierId: item.supplier?.id ?? "",
  currentQuantity: item.storageLocation ? (item.currentQuantity ?? 0) : undefined,
  price: item.price !== undefined && item.price !== null ? Number(item.price) : undefined,
  packSize: item.packSize ?? undefined,
  orderQuantity: item.orderQuantity ?? undefined,
  alternateCodes: item.alternateCodes ?? [],
  alternateCodesText: item.alternateCodes?.join(", ") ?? "",
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface ItemEditDialogProps {
  itemId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Komponente ───────────────────────────────────────────────────────────────

const ItemEditDialog: React.FC<ItemEditDialogProps> = ({ itemId, open, onClose, onSaved }) => {
  const user = useAuthStore((state: any) => state.user);
  const isTechnician = user?.role === "TECHNICIAN";

  const [form, setForm] = useState<ItemFormState>(emptyForm());
  const [originalItem, setOriginalItem] = useState<ItemDto | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [altCodeScanOpen, setAltCodeScanOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageKey, setImageKey] = useState(0); // bump to force img reload
  const [lastOrder, setLastOrder] = useState<LastOrderForItemDto | null | undefined>(undefined);
  const [vehicleQuantity, setVehicleQuantity] = useState<number | null>(null);

  // Daten laden wenn Dialog öffnet
  useEffect(() => {
    if (!open || !itemId) return;
    setError(null);
    setLoadingItem(true);
    setLastOrder(undefined);

    const vehicleStockPromise =
      isTechnician && user?.vehicleId
        ? fetchVehicleStock(user.vehicleId).catch(() => [] as StockLevelDto[])
        : Promise.resolve([] as StockLevelDto[]);

    Promise.all([
      fetchItemById(itemId),
      fetchSuppliers(),
      fetchLocations({ includeVehicles: false }),
      fetchLastOrderForItem(itemId).catch(() => null),
      vehicleStockPromise,
    ])
      .then(([item, supplierList, locationList, lastOrderData, vehicleStock]) => {
        setOriginalItem(item);
        setForm(itemToForm(item));
        setSuppliers(supplierList);
        setLocations(locationList);
        setLastOrder(lastOrderData);
        const entry = (vehicleStock as StockLevelDto[]).find((s) => s.item?.id === itemId);
        setVehicleQuantity(isTechnician ? (entry?.quantity ?? 0) : null);
      })
      .catch(() => setError("Artikel konnte nicht geladen werden."))
      .finally(() => setLoadingItem(false));
  }, [open, itemId]);

  // Zurücksetzen beim Schließen
  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setOriginalItem(null);
      setError(null);
      setLastOrder(undefined);
      setVehicleQuantity(null);
    }
  }, [open]);

  // ─── Location-Hilfsfunktionen ──────────────────────────────────────────────

  const locationById = useMemo(() => {
    const map = new Map<string, any>();
    locations.forEach((loc) => map.set(loc.id, loc));
    return map;
  }, [locations]);

  const getLocationPath = useCallback(
    (loc: any) => getLocationPathFromMap(loc, locationById),
    [locationById],
  );

  const getLocationLabel = useCallback(
    (loc: any) => {
      if (!loc) return "";
      const path = getLocationPath(loc) || loc.code || "";
      const namePart = loc.name ? ` (${loc.name})` : "";
      return `${path}${namePart}`;
    },
    [getLocationPath],
  );

  const getLocationGroup = useCallback(
    (loc: any) => {
      const [topLevel] = getLocationPath(loc).split(" / ");
      return topLevel || "Sonstige";
    },
    [getLocationPath],
  );

  const getLocationSearchText = useCallback(
    (loc: any) =>
      [loc.code, loc.name, getLocationPath(loc), loc.parent?.code, loc.parent?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    [getLocationPath],
  );

  // ─── Options ──────────────────────────────────────────────────────────────

  const supplierOptions = useMemo(
    () => [...suppliers].sort((a, b) => (a.name || "").localeCompare(b.name || "", "de", { sensitivity: "base" })),
    [suppliers],
  );

  const locationOptions = useMemo(() => {
    const candidates = locations.filter((loc: any) => loc.type !== "VEHICLE");
    return [...candidates].sort((a: any, b: any) =>
      getLocationPathFromMap(a, locationById).localeCompare(
        getLocationPathFromMap(b, locationById),
        "de",
        { sensitivity: "base" },
      ),
    );
  }, [locations, locationById]);

  // ─── Formular-Handler ─────────────────────────────────────────────────────

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === "targetStock") {
        const parsed = Number(value);
        return { ...prev, targetStock: Number.isNaN(parsed) ? 0 : parsed };
      }
      if (name === "currentQuantity") {
        const parsed = Number.parseInt(value, 10);
        return { ...prev, currentQuantity: Number.isNaN(parsed) ? undefined : parsed } as ItemFormState;
      }
      if (name === "price") {
        const parsed = Number(value);
        return { ...prev, price: Number.isNaN(parsed) ? undefined : parsed };
      }
      if (["packSize", "orderQuantity", "minimumStock", "reorderPoint"].includes(name)) {
        const parsed = Number.parseInt(value, 10);
        return { ...prev, [name]: Number.isNaN(parsed) || value === "" ? undefined : parsed } as ItemFormState;
      }
      if (name === "alternateCodesText") return { ...prev, alternateCodesText: value };
      return { ...prev, [name]: value } as ItemFormState;
    });
  };

  // ─── Validierung ──────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!form.code.trim()) return "Bitte Artikelnummer eingeben.";
    if (!form.description.trim()) return "Bitte Bezeichnung eingeben.";
    if (!form.manufacturer.trim()) return "Bitte Hersteller angeben.";
    if (!form.productGroup.trim()) return "Bitte Warengruppe angeben.";
    if (form.targetStock !== undefined && form.targetStock < 0)
      return "Sollbestand darf nicht negativ sein.";
    if (form.currentQuantity !== undefined && form.currentQuantity < 0)
      return "Ist-Bestand darf nicht negativ sein.";
    if (form.currentQuantity !== undefined && !form.storageLocationId?.trim())
      return "Für den Ist-Bestand muss ein Lagerort angegeben werden.";
    return null;
  };

  // ─── Payload bauen ────────────────────────────────────────────────────────

  const createPayload = (): CreateItemRequest => {
    const safeTargetStock =
      typeof form.targetStock === "number" && Number.isFinite(form.targetStock) ? form.targetStock : 0;
    const alternateCodes = parseAlternateCodesFromText(form.alternateCodesText, form.code);
    const secondary = form.descriptionSecondary?.trim();
    return {
      code: form.code.trim(),
      description: form.description.trim(),
      descriptionSecondary: secondary || undefined,
      manufacturer: form.manufacturer.trim(),
      productGroup: form.productGroup.trim(),
      qrCodeValue: form.qrCodeValue?.trim() || undefined,
      targetStock: safeTargetStock > 0 ? Math.floor(safeTargetStock) : 0,
      minimumStock: form.minimumStock != null && form.minimumStock >= 0 ? Math.floor(form.minimumStock) : null,
      reorderPoint: form.reorderPoint != null && form.reorderPoint >= 0 ? Math.floor(form.reorderPoint) : null,
      storageLocationId: form.storageLocationId?.trim() || undefined,
      supplierId: form.supplierId?.trim() || undefined,
      price: form.price !== undefined ? form.price : undefined,
      packSize: form.packSize ?? undefined,
      orderQuantity: form.orderQuantity !== undefined && form.orderQuantity > 0 ? form.orderQuantity : undefined,
      alternateCodes,
    };
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !originalItem) return;
    setSubmitting(true);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSubmitting(false);
      return;
    }
    const desiredQuantity = form.currentQuantity;
    const locationId = form.storageLocationId?.trim() || originalItem.storageLocation?.id;
    const currentQuantity = originalItem.storageLocation ? (originalItem.currentQuantity ?? 0) : 0;
    try {
      const payload = createPayload();
      const savedItem = await updateItem(itemId, payload);
      if (desiredQuantity !== undefined && locationId) {
        const delta = desiredQuantity - currentQuantity;
        if (delta !== 0) {
          await recordMovement({
            itemId: savedItem.id,
            locationId,
            userId: user?.id ?? undefined,
            type: delta > 0 ? "CHECKIN" : "CHECKOUT",
            quantity: Math.abs(delta),
            occurredAt: new Date().toISOString(),
            note: "Ist-Bestand angepasst",
            source: "items-adjustment",
          });
        }
      }
      onClose();
      onSaved?.();
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onClose={() => !isSubmitting && onClose()} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {loadingItem ? "Lade Artikel..." : `Artikel bearbeiten${originalItem ? ` – ${originalItem.code}` : ""}`}
          </DialogTitle>
          <DialogContent dividers>
            {loadingItem ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {/* Artikelbild */}
                <Grid item xs={12}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {originalItem?.imagePath ? (
                      <Box
                        component="img"
                        src={`${getItemImageUrl(originalItem.id)}?v=${imageKey}`}
                        alt="Artikelbild"
                        sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                      />
                    ) : (
                      <Box sx={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "action.hover", borderRadius: 1, border: "1px dashed", borderColor: "divider" }}>
                        <AddPhotoAlternateIcon color="disabled" />
                      </Box>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {/* Galerie-Upload */}
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        startIcon={imageUploading ? <CircularProgress size={14} /> : <AddPhotoAlternateIcon />}
                        disabled={imageUploading || !itemId}
                      >
                        {originalItem?.imagePath ? "Galerie (ersetzen)" : "Aus Galerie"}
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !itemId) return;
                            setImageUploading(true);
                            try {
                              const updated = await uploadItemImage(itemId, file);
                              setOriginalItem(updated);
                              setImageKey((k) => k + 1);
                            } catch {
                              setError("Bild konnte nicht hochgeladen werden.");
                            } finally {
                              setImageUploading(false);
                              e.target.value = "";
                            }
                          }}
                        />
                      </Button>
                      {/* Kamera-Upload (öffnet direkt die Kamera auf Mobilgeräten) */}
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        startIcon={imageUploading ? <CircularProgress size={14} /> : <AddPhotoAlternateIcon />}
                        disabled={imageUploading || !itemId}
                      >
                        {originalItem?.imagePath ? "Kamera (ersetzen)" : "Foto aufnehmen"}
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          capture="environment"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !itemId) return;
                            setImageUploading(true);
                            try {
                              const updated = await uploadItemImage(itemId, file);
                              setOriginalItem(updated);
                              setImageKey((k) => k + 1);
                            } catch {
                              setError("Bild konnte nicht hochgeladen werden.");
                            } finally {
                              setImageUploading(false);
                              e.target.value = "";
                            }
                          }}
                        />
                      </Button>
                      {originalItem?.imagePath && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          disabled={imageUploading}
                          onClick={async () => {
                            if (!itemId) return;
                            setImageUploading(true);
                            try {
                              const updated = await deleteItemImage(itemId);
                              setOriginalItem(updated);
                              setImageKey((k) => k + 1);
                            } catch {
                              setError("Bild konnte nicht gelöscht werden.");
                            } finally {
                              setImageUploading(false);
                            }
                          }}
                        >
                          Bild entfernen
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Artikelnummer"
                    name="code"
                    value={form.code}
                    onChange={handleInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Hersteller"
                    name="manufacturer"
                    value={form.manufacturer}
                    onChange={handleInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Bezeichnung"
                    name="description"
                    value={form.description}
                    onChange={handleInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Bezeichnung (2) / Zusatz"
                    name="descriptionSecondary"
                    value={form.descriptionSecondary ?? ""}
                    onChange={handleInputChange}
                    fullWidth
                    helperText="Optional"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Warengruppe"
                    name="productGroup"
                    value={form.productGroup}
                    onChange={handleInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={supplierOptions}
                    value={supplierOptions.find((s: any) => s.id === form.supplierId) ?? null}
                    onChange={(_: any, value: any) =>
                      setForm((prev) => ({ ...prev, supplierId: value?.id ?? "" }))
                    }
                    getOptionLabel={(option: any) => option?.name || ""}
                    renderInput={(params: any) => <TextField {...params} label="Lieferant" />}
                  />
                </Grid>
                {!isTechnician && (
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      options={locationOptions}
                      value={locationOptions.find((l: any) => l.id === form.storageLocationId) ?? null}
                      onChange={(_: any, value: any) =>
                        setForm((prev) => ({ ...prev, storageLocationId: value?.id ?? "" }))
                      }
                      groupBy={(option: any) => getLocationGroup(option)}
                      filterOptions={(options, state) => {
                        const query = state.inputValue.trim().toLowerCase();
                        if (!query) return options;
                        return options.filter((o: any) => getLocationSearchText(o).includes(query));
                      }}
                      isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
                      autoHighlight
                      getOptionLabel={(option: any) => getLocationLabel(option)}
                      renderOption={(props, option: any) => (
                        <li {...props}>
                          <Box sx={{ py: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {getLocationPath(option) || option.code}
                            </Typography>
                            {option.name && (
                              <Typography variant="caption" color="text.secondary">
                                {option.name}
                              </Typography>
                            )}
                          </Box>
                        </li>
                      )}
                      renderInput={(params: any) => (
                        <TextField
                          {...params}
                          label="Lagerort"
                          helperText="Suche nach Code, Name oder Pfad"
                        />
                      )}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                      label="QR-Code"
                      name="qrCodeValue"
                      value={form.qrCodeValue ?? ""}
                      onChange={handleInputChange}
                      fullWidth
                    />
                    <Button variant="outlined" type="button" onClick={() => setScanOpen(true)} sx={{ whiteSpace: "nowrap" }}>
                      QR scannen
                    </Button>
                  </Box>
                </Grid>
                {!isTechnician && (
                  <>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Preis (EUR)"
                        name="price"
                        type="number"
                        value={form.price ?? ""}
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Verpackungseinheit"
                        name="packSize"
                        type="number"
                        value={form.packSize ?? ""}
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        label="Bestellmenge"
                        name="orderQuantity"
                        type="number"
                        value={form.orderQuantity ?? ""}
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ min: 0 }}
                        helperText="0 = automatisch (Soll − Aktuell)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Sollbestand"
                        name="targetStock"
                        type="number"
                        value={form.targetStock ?? 0}
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ min: 0 }}
                        helperText="Zielbestand nach Auffüllung"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Meldebestand"
                        name="reorderPoint"
                        type="number"
                        value={form.reorderPoint ?? ""}
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ min: 0 }}
                        helperText="Bestellung auslösen wenn Bestand ≤ diesem Wert"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Mindestbestand"
                        name="minimumStock"
                        type="number"
                        value={form.minimumStock ?? ""}
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ min: 0 }}
                        helperText="Absolute Untergrenze / Sicherheitspuffer"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Ist-Bestand"
                        name="currentQuantity"
                        type="number"
                        value={form.currentQuantity ?? ""}
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  </>
                )}
                {isTechnician && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Im Fahrzeug"
                      value={vehicleQuantity !== null ? vehicleQuantity : "–"}
                      fullWidth
                      InputProps={{ readOnly: true }}
                      helperText="Ihr aktueller Fahrzeugbestand"
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                    <TextField
                      label="Weitere Codes"
                      name="alternateCodesText"
                      value={form.alternateCodesText}
                      onChange={handleInputChange}
                      fullWidth
                      multiline
                      minRows={2}
                      helperText="Optional: getrennt durch Komma oder Leerzeichen"
                    />
                    <Tooltip title="Code scannen und hinzufügen">
                      <IconButton
                        color="primary"
                        onClick={() => setAltCodeScanOpen(true)}
                        sx={{ mt: 1, border: "1px solid", borderColor: "primary.main", borderRadius: 1 }}
                      >
                        <QrCodeScannerIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>

                {error && (
                  <Grid item xs={12}>
                    <Alert severity="error">{error}</Alert>
                  </Grid>
                )}
              </Grid>
            )}
            <Divider sx={{ mt: 2 }} />
            <Box sx={{ mt: 2, display: "flex", alignItems: "flex-start", gap: 1 }}>
              <ShoppingCartIcon fontSize="small" color="action" sx={{ mt: 0.3 }} />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Letzte Bestellung
                </Typography>
                {lastOrder === undefined && (
                  <Typography variant="body2" color="text.secondary">Wird geladen…</Typography>
                )}
                {lastOrder === null && (
                  <Typography variant="body2" color="text.secondary">Noch nie bestellt</Typography>
                )}
                {lastOrder && (
                  <Typography variant="body2">
                    {lastOrder.orderedAt
                      ? new Date(lastOrder.orderedAt).toLocaleDateString("de-DE")
                      : "Datum unbekannt"}
                    {lastOrder.orderNumber && (
                      <> · <strong>{lastOrder.orderNumber}</strong></>
                    )}
                    {lastOrder.quantity != null && (
                      <> · {lastOrder.quantity}{lastOrder.packSize && lastOrder.packSize > 1 ? ` (VE ${lastOrder.packSize})` : ""} Stk.</>
                    )}
                    {lastOrder.supplierName && (
                      <> · {lastOrder.supplierName}</>
                    )}
                  </Typography>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting || loadingItem}>
              {isSubmitting ? "Speichern..." : "Speichern"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {scanOpen && (
        <QrScannerDialog
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={(code) => setForm((f) => ({ ...f, qrCodeValue: code }))}
        />
      )}

      {altCodeScanOpen && (
        <QrScannerDialog
          open={altCodeScanOpen}
          onClose={() => setAltCodeScanOpen(false)}
          onDetected={(code) => {
            const trimmed = code.trim();
            if (trimmed && trimmed.toLowerCase() !== form.code.toLowerCase()) {
              const current = form.alternateCodesText.trim();
              setForm((f) => ({
                ...f,
                alternateCodesText: current ? `${current}, ${trimmed}` : trimmed,
              }));
            }
          }}
        />
      )}
    </>
  );
};

export default ItemEditDialog;
