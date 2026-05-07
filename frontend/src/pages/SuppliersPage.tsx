import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import useAuthStore from "../store/useAuthStore";
import {
  createSupplier,
  deleteSupplier,
  fetchLocations,
  fetchSuppliers,
  updateSupplier,
  type LocationDto,
  type SupplierDto,
} from "../utils/api";

type SupplierFormState = Omit<SupplierDto, "id" | "branchId">;

const initialFormState: SupplierFormState = {
  name: "",
  locationId: null,
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "",
  contactName: "",
  email: "",
  customerNumber: "",
  phone: "",
  notes: "",
};

const cleanValue = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
};

type NominatimAddress = {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
};

type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  name?: string;
  address?: NominatimAddress;
};

type AddressSuggestion = {
  id: number;
  label: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
};

const resolveCity = (address?: NominatimAddress) =>
  address?.city
  || address?.town
  || address?.village
  || address?.municipality
  || address?.county
  || address?.state
  || "";

const resolveStreet = (entry: NominatimSearchResult) => {
  const road = entry.address?.road?.trim();
  const houseNumber = entry.address?.house_number?.trim();
  const combinedRoad = [road, houseNumber].filter(Boolean).join(" ");
  if (combinedRoad) return combinedRoad;

  const name = entry.name?.trim();
  if (name) return name;

  const [fallback] = entry.display_name.split(",");
  return fallback?.trim() ?? "";
};

const SuppliersPage = () => {
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const user = useAuthStore((state: any) => state.user);
  const isManager = user?.role === "MANAGER" || (user?.branchId === null || user?.branchId === undefined);
  const canCreate = hasPermission("suppliers.create");
  const canEdit = hasPermission("suppliers.edit");
  const canDelete = hasPermission("suppliers.delete");

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierDto | null>(null);
  const [form, setForm] = useState<SupplierFormState>(initialFormState);
  const [isSubmitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierDto | null>(null);
  const [addressSearch, setAddressSearch] = useState("");
  const [addressOptions, setAddressOptions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressAutocompleteError, setAddressAutocompleteError] = useState<string | null>(null);

  const loadSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, locs] = await Promise.all([
        fetchSuppliers(),
        fetchLocations({ includeVehicles: false }),
      ]);
      setSuppliers(data);
      setLocations(locs.filter((l: LocationDto) => l.type === "WAREHOUSE"));
    } catch (err) {
      console.error(err);
      setError("Lieferanten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const sortedSuppliers = useMemo(
    () =>
      [...suppliers].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "de", { sensitivity: "base" }),
      ),
    [suppliers],
  );

  const handleOpenCreate = () => {
    setForm(initialFormState);
    setAddressSearch("");
    setAddressOptions([]);
    setAddressAutocompleteError(null);
    setEditing(null);
    setError(null);
    setOpen(true);
  };

  const handleOpenEdit = (supplier: SupplierDto) => {
    setForm({
      name: supplier.name ?? "",
      locationId: supplier.locationId ?? null,
      addressLine1: supplier.addressLine1 ?? "",
      addressLine2: supplier.addressLine2 ?? "",
      postalCode: supplier.postalCode ?? "",
      city: supplier.city ?? "",
      country: supplier.country ?? "",
      contactName: supplier.contactName ?? "",
      email: supplier.email ?? "",
      customerNumber: supplier.customerNumber ?? "",
      phone: supplier.phone ?? "",
      notes: supplier.notes ?? "",
    });
    setAddressSearch(supplier.addressLine1 ?? "");
    setAddressOptions([]);
    setAddressAutocompleteError(null);
    setEditing(supplier);
    setError(null);
    setOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setOpen(false);
    setEditing(null);
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    if (name === "addressLine1") {
      setAddressSearch(value);
      setAddressAutocompleteError(null);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressInputChange = (
    _: React.SyntheticEvent,
    value: string,
  ) => {
    setAddressSearch(value);
    setAddressAutocompleteError(null);
    setForm((prev) => ({ ...prev, addressLine1: value }));
  };

  const handleAddressSelect = (
    _: React.SyntheticEvent,
    value: AddressSuggestion | string | null,
  ) => {
    if (!value || typeof value === "string") return;

    setAddressSearch(value.addressLine1 || value.label);
    setAddressOptions([]);
    setForm((prev) => ({
      ...prev,
      addressLine1: value.addressLine1 || prev.addressLine1,
      postalCode: value.postalCode || prev.postalCode,
      city: value.city || prev.city,
      country: value.country || prev.country,
    }));
  };

  useEffect(() => {
    if (!open) {
      setAddressOptions([]);
      setAddressLoading(false);
      setAddressAutocompleteError(null);
      return;
    }

    const query = addressSearch.trim();
    if (query.length < 3) {
      setAddressOptions([]);
      setAddressLoading(false);
      setAddressAutocompleteError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const loadAddressSuggestions = async () => {
        setAddressLoading(true);
        setAddressAutocompleteError(null);
        try {
          const url = new URL("https://nominatim.openstreetmap.org/search");
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("addressdetails", "1");
          url.searchParams.set("limit", "6");
          url.searchParams.set("accept-language", "de");
          url.searchParams.set("q", query);

          const response = await fetch(url.toString(), {
            method: "GET",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          if (!response.ok) {
            throw new Error(`Address search failed (${response.status})`);
          }

          const payload = (await response.json()) as unknown;
          const results = Array.isArray(payload)
            ? (payload as NominatimSearchResult[])
            : [];

          const mappedSuggestions: AddressSuggestion[] = results
            .map((entry) => {
              const addressLine1 = resolveStreet(entry);
              const city = resolveCity(entry.address);
              return {
                id: entry.place_id,
                label: entry.display_name,
                addressLine1,
                postalCode: entry.address?.postcode ?? "",
                city,
                country: entry.address?.country ?? "",
              };
            })
            .filter((entry) => Boolean(entry.addressLine1 || entry.label));

          setAddressOptions(mappedSuggestions);
        } catch (fetchError) {
          if ((fetchError as Error).name === "AbortError") return;
          console.error(fetchError);
          setAddressOptions([]);
          setAddressAutocompleteError("Adressvorschlaege konnten nicht geladen werden.");
        } finally {
          if (!controller.signal.aborted) {
            setAddressLoading(false);
          }
        }
      };

      void loadAddressSuggestions();
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, addressSearch]);

  const validate = () => {
    if (!form.name.trim()) return "Bitte Lieferantennamen eingeben.";
    return null;
  };

  const buildPayload = (): Omit<SupplierDto, "id" | "branchId"> => ({
    name: form.name.trim(),
    locationId: form.locationId ?? null,
    addressLine1: cleanValue(form.addressLine1),
    addressLine2: cleanValue(form.addressLine2),
    postalCode: cleanValue(form.postalCode),
    city: cleanValue(form.city),
    country: cleanValue(form.country),
    contactName: cleanValue(form.contactName),
    email: cleanValue(form.email),
    customerNumber: cleanValue(form.customerNumber),
    phone: cleanValue(form.phone),
    notes: cleanValue(form.notes),
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (editing) {
        await updateSupplier(editing.id, payload);
      } else {
        await createSupplier(payload);
      }
      await loadSuppliers();
      setOpen(false);
      setEditing(null);
    } catch (submitError) {
      console.error(submitError);
      setError("Lieferant konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSupplier(deleteTarget.id);
      await loadSuppliers();
    } catch (err) {
      console.error(err);
      setError("Lieferant konnte nicht gelöscht werden.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Lieferanten
      </Typography>
      <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="body2" color="text.secondary">
              Lieferanten und Kontaktinformationen pflegen.
            </Typography>
          </Grid>
          {canCreate && (
            <Grid item>
              <Button variant="contained" onClick={handleOpenCreate}>
                Lieferant anlegen
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ backgroundColor: "background.paper" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Lager</TableCell>
              <TableCell>Kontakt</TableCell>
              <TableCell>Telefon</TableCell>
              <TableCell>E-Mail</TableCell>
              <TableCell>Kundennr.</TableCell>
              <TableCell>Ort</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSuppliers.map((supplier) => (
              <TableRow key={supplier.id} hover>
                <TableCell>{supplier.name}</TableCell>
                <TableCell>
                  {supplier.locationId
                    ? <Chip label={locations.find(l => l.id === supplier.locationId)?.name ?? "–"} size="small" variant="outlined" />
                    : <Typography variant="caption" color="text.secondary">Kein Lager</Typography>
                  }
                </TableCell>
                <TableCell>{supplier.contactName || "-"}</TableCell>
                <TableCell>{supplier.phone || "-"}</TableCell>
                <TableCell>{supplier.email || "-"}</TableCell>
                <TableCell>{supplier.customerNumber || "-"}</TableCell>
                <TableCell>
                  {[supplier.postalCode, supplier.city].filter(Boolean).join(" ") || "-"}
                </TableCell>
                <TableCell align="right">
                  {canEdit && (
                    <Tooltip title="Bearbeiten">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEdit(supplier)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Löschen">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(supplier)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && sortedSuppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Keine Lieferanten vorhanden.
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Lade Lieferanten...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editing ? "Lieferant bearbeiten" : "Lieferant anlegen"}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  fullWidth
                  required
                />
              </Grid>
              {isManager && (
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Lager-Zuweisung</InputLabel>
                    <Select
                      value={form.locationId ?? ""}
                      label="Lager-Zuweisung"
                      onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value || null }))}
                    >
                      <MenuItem value="">Kein Lager (nicht zugewiesen)</MenuItem>
                      {locations.map((loc) => (
                        <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Kontaktperson"
                  name="contactName"
                  value={form.contactName}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Telefon"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="E-Mail"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Kundennummer"
                  name="customerNumber"
                  value={form.customerNumber}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Land"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={addressOptions}
                  filterOptions={(options) => options}
                  loading={addressLoading}
                  value={form.addressLine1}
                  onInputChange={handleAddressInputChange}
                  onChange={handleAddressSelect}
                  getOptionLabel={(option) =>
                    typeof option === "string"
                      ? option
                      : option.addressLine1 || option.label
                  }
                  isOptionEqualToValue={(option, value) =>
                    typeof value !== "string" && option.id === value.id
                  }
                  noOptionsText={
                    addressSearch.trim().length < 3
                      ? "Mindestens 3 Zeichen für Vorschläge"
                      : "Keine Adresse gefunden"
                  }
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box>
                        <Typography variant="body2">
                          {option.addressLine1 || option.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[
                            option.postalCode,
                            option.city,
                            option.country,
                          ]
                            .filter(Boolean)
                            .join(" ")
                            || option.label}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Adresse"
                      name="addressLine1"
                      fullWidth
                      error={Boolean(addressAutocompleteError)}
                      helperText={addressAutocompleteError || undefined}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {addressLoading ? (
                              <CircularProgress color="inherit" size={18} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Adresse (2)"
                  name="addressLine2"
                  value={form.addressLine2}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="PLZ"
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Ort"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notizen"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Grid>
              {error && (
                <Grid item xs={12}>
                  <Alert severity="error">{error}</Alert>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              Speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Lieferant löschen</DialogTitle>
        <DialogContent dividers>
          Soll der Lieferant wirklich entfernt werden? Artikel ohne Lieferant
          müssen danach neu zugeordnet werden.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SuppliersPage;

