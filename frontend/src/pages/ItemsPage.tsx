import React, { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type FormEvent } from "react";
import Papa from "papaparse";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Backdrop,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Pagination,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import useItemsStore from "../store/useItemsStore";
import useAuthStore from "../store/useAuthStore";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import type {
  CreateItemRequest,
  UpdateItemRequest,
  ItemListResponse,
  ItemsBulkPreviewResponse,
} from "../utils/api";
import {
  fetchItems,
  downloadItemsQrCatalog,
  downloadItemsMasterDataCsv,
  fetchSuppliers,
  fetchLocations,
  createSupplier,
  createLocation,
  recordMovement,
  previewItemsBulk,
  updateItemsBulk,
  getItemImageUrl,
  uploadItemImage,
  deleteItemImage,
} from "../utils/api";
import useBarcodeScanner from "../hooks/useBarcodeScanner";

type ItemFormState = CreateItemRequest & { alternateCodesText: string; currentQuantity?: number };
type CsvImportItem = CreateItemRequest & {
  supplierName?: string;
  storageLocationCode?: string;
  storageLocationName?: string;
};

type PreparedImportPayload = {
  preparedItems: CreateItemRequest[];
  preValidationErrors: string[];
};

type HyrekaImportRow = {
  rowNumber: number;
  code: string;
  description: string;
  descriptionSecondary?: string;
  productGroupRaw: string;
  manufacturerHint?: string;
  supplierName?: string;
  supplierNumber?: string;
  locationRaw?: string;
  targetStock: number;
  minimumStock?: number;
  reorderPoint?: number;
  currentQuantity?: number;
  price?: number;
  packSize?: number;
  orderQuantity?: number;
  qrCodeValue?: string;
  alternateCodes: string[];
};

type ParsedStructuredLocation = {
  type: "SHELF" | "BIN";
  groupNumber: string;
  slotNumber: string;
  canonicalName: string;
  key: string;
};

const DEFAULT_PARENT_STORAGE_KEY = "locations.defaultParentId";
const HYREKA_IMPORT_SOURCE = "hyreka-onetime-import";

const initialFormState: ItemFormState = {
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
};

const parseAlternateCodesFromText = (raw: string, primaryCode: string): string[] => {
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

const normalizeHeaderKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, "_");
const normalizeLookupKey = (value: string): string => value.trim().toLowerCase();

const parseOptionalIntFromCsv = (value: string): number | undefined => {
  const raw = value.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.floor(parsed));
};

const parseOptionalPositiveIntFromCsv = (value: string): number | undefined => {
  const parsed = parseOptionalIntFromCsv(value);
  if (parsed === undefined) {
    return undefined;
  }
  return parsed > 0 ? parsed : undefined;
};

const parseOptionalNumberFromCsv = (value: string): number | undefined => {
  const raw = value.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
};

const PLACEHOLDER_VALUES = new Set([
  "",
  "-",
  "--",
  "0",
  "0.0",
  "0,0",
  "false",
  "true",
  "null",
  "none",
  "undefined",
  "n/a",
  "na",
]);

const isPlaceholderValue = (value: unknown): boolean => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_VALUES.has(normalized);
};

const normalizeHyrekaLocationRaw = (value: unknown): string | undefined => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  if (isPlaceholderValue(raw)) return undefined;
  return raw.replace(/\s+/g, " ");
};

const sanitizeAlternateCodeCandidate = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (isPlaceholderValue(raw)) return null;
  if (/^[A-Za-z]$/.test(raw)) return null;
  if (raw.length > 120) return null;
  return raw;
};

const parseHyrekaAlternateCodes = (primaryCode: string, values: unknown[]): string[] => {
  const merged = values
    .map(sanitizeAlternateCodeCandidate)
    .filter((value): value is string => Boolean(value))
    .join(" ");
  if (!merged) return [];
  return parseAlternateCodesFromText(merged, primaryCode).filter(
    (value) =>
      !isPlaceholderValue(value) &&
      !/^[A-Za-z]$/.test(value) &&
      value.length <= 120,
  );
};

const decodeCsvTextWithFallback = async (
  file: File,
): Promise<{ text: string; encoding: "utf-8" | "windows-1252" | "iso-8859-1" }> => {
  const bytes = new Uint8Array(await file.arrayBuffer());

  const stripBom = (text: string) => text.replace(/^\uFEFF/, "");

  try {
    const utf8Text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text: stripBom(utf8Text), encoding: "utf-8" };
  } catch {
    // fallback below
  }

  try {
    const win1252Text = new TextDecoder("windows-1252").decode(bytes);
    return { text: stripBom(win1252Text), encoding: "windows-1252" };
  } catch {
    // fallback below
  }

  const latin1Text = new TextDecoder("iso-8859-1").decode(bytes);
  return { text: stripBom(latin1Text), encoding: "iso-8859-1" };
};

const parseCsvText = async (
  text: string,
  config: Papa.ParseConfig<unknown>,
): Promise<unknown[]> =>
  new Promise<unknown[]>((resolve, reject) => {
    Papa.parse(text, {
      ...config,
      worker: false,
      complete: (result) => resolve((result.data as unknown[]) ?? []),
      error: (err: unknown) => reject(err),
    });
  });

const extractApiErrorMessage = (error: unknown): string => {
  const fallback = error instanceof Error ? error.message : String(error);
  if (!error || typeof error !== "object") return fallback;
  const anyError = error as any;
  const data = anyError?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) {
    const cleaned = message.map((entry) => String(entry).trim()).filter(Boolean);
    if (cleaned.length > 0) {
      return cleaned.join(" | ");
    }
  }
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return fallback;
};

const cleanHyrekaText = (value: unknown): string => String(value ?? "").trim();

const normalizeLocationLookup = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/");

const parseStructuredLocationFromText = (value: string): ParsedStructuredLocation | null => {
  const raw = cleanHyrekaText(value);
  if (!raw) return null;

  const normalized = raw.replace(/\s+/g, " ");
  const shelfMatch = normalized.match(/regal\s*[:\-]?\s*(\d+)\s*\/\s*(?:fach\s*)?[:\-]?\s*(\d+)/i);
  if (shelfMatch) {
    const groupNumber = shelfMatch[1];
    const slotNumber = shelfMatch[2];
    return {
      type: "SHELF",
      groupNumber,
      slotNumber,
      canonicalName: `Regal ${groupNumber} / Fach ${slotNumber}`,
      key: `SHELF:${groupNumber}:${slotNumber}`,
    };
  }

  const binMatch = normalized.match(/schrank\s*[:\-]?\s*(\d+)\s*\/\s*(?:schublade\s*)?[:\-]?\s*(\d+)/i);
  if (binMatch) {
    const groupNumber = binMatch[1];
    const slotNumber = binMatch[2];
    return {
      type: "BIN",
      groupNumber,
      slotNumber,
      canonicalName: `Schrank ${groupNumber} / Schublade ${slotNumber}`,
      key: `BIN:${groupNumber}:${slotNumber}`,
    };
  }

  return null;
};

const getStructuredLocationKey = (location: any): string | null => {
  const byName = parseStructuredLocationFromText(location?.name ?? "");
  if (byName) return byName.key;
  const byCode = parseStructuredLocationFromText(location?.code ?? "");
  return byCode?.key ?? null;
};

const resolveKnownProductGroup = (
  rawGroup: string,
  existingGroup: string | undefined,
  knownGroups: string[],
): { value: string; fallbackUsed: boolean } => {
  const persisted = cleanHyrekaText(existingGroup);
  if (persisted) {
    return { value: persisted, fallbackUsed: false };
  }

  const available = knownGroups.map((value) => cleanHyrekaText(value)).filter(Boolean);
  if (available.length === 0) {
    const fallback = cleanHyrekaText(rawGroup) || "Ersatzteil";
    return { value: fallback, fallbackUsed: false };
  }

  const groupRaw = cleanHyrekaText(rawGroup);
  const normalizedRaw = normalizeLookupKey(groupRaw);
  const exact = available.find((group) => normalizeLookupKey(group) === normalizedRaw);
  if (exact) {
    return { value: exact, fallbackUsed: false };
  }

  const withoutPrefix = groupRaw.split(" ").slice(1).join(" ").trim();
  if (withoutPrefix) {
    const normalizedWithoutPrefix = normalizeLookupKey(withoutPrefix);
    const prefixedMatch = available.find(
      (group) => normalizeLookupKey(group) === normalizedWithoutPrefix,
    );
    if (prefixedMatch) {
      return { value: prefixedMatch, fallbackUsed: false };
    }
  }

  const suffixMatch = available
    .filter((group) => normalizedRaw.endsWith(normalizeLookupKey(group)))
    .sort((a, b) => b.length - a.length)[0];
  if (suffixMatch) {
    return { value: suffixMatch, fallbackUsed: false };
  }

  const containsMatch = available
    .filter((group) => normalizedRaw.includes(normalizeLookupKey(group)))
    .sort((a, b) => b.length - a.length)[0];
  if (containsMatch) {
    return { value: containsMatch, fallbackUsed: false };
  }

  const defaultGroup =
    available.find((group) => normalizeLookupKey(group) === "ersatzteil") ?? available[0];
  return { value: defaultGroup, fallbackUsed: true };
};

const resolveManufacturer = (
  existingManufacturer: string | undefined,
  manufacturerHint: string | undefined,
  supplierName: string | undefined,
  productGroupRaw: string,
): string => {
  const persisted = cleanHyrekaText(existingManufacturer);
  if (persisted) return persisted;

  const hint = cleanHyrekaText(manufacturerHint);
  if (hint) return hint;

  const supplier = cleanHyrekaText(supplierName);
  if (supplier) {
    const firstToken = supplier.split(/\s+/)[0]?.trim();
    if (firstToken) return firstToken;
    return supplier;
  }

  const group = cleanHyrekaText(productGroupRaw);
  if (group) {
    const firstToken = group.split(/\s+/)[0]?.trim();
    if (firstToken) return firstToken;
  }

  return "Unbekannt";
};

const parseHyrekaHeaderKey = (value: string): string =>
  normalizeHeaderKey(value).replace(/[^a-z0-9_]/g, "");

const getLocationPathFromMap = (loc: any, locationById: Map<string, any>): string => {
  if (!loc) return "";

  const pathParts: string[] = [];
  const seen = new Set<string>();
  let current = loc;

  while (current?.id && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.code) {
      pathParts.push(current.code);
    }
    const parentId = current.parent?.id;
    if (!parentId) break;
    current = locationById.get(parentId) ?? current.parent;
  }

  return pathParts.reverse().join(" / ");
};


interface QrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const QrScannerDialog = ({ open, onClose, onDetected }: QrScannerDialogProps) => {
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
            Bitte verwende HTTPS und ein Gerät mit Kamera.
          </Alert>
        )}
              {/* Eingabefeld für weitere Codes entfernt, da form und handleInputChange hier nicht verfügbar sind */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ position: "relative" }}>
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: 12 }}
            muted
            playsInline
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};

const ItemsPage = () => {
  const user = useAuthStore((state: any) => state.user);
  const [refreshInterval, setRefreshInterval] = useState<number>(user?.refreshInterval ?? 15000);
  const [intervalSaved, setIntervalSaved] = useState<boolean>(false);
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [searchScanOpen, setSearchScanOpen] = useState(false);
  const [altCodeScanOpen, setAltCodeScanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<CsvImportItem[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importing, setImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string>("");
  const [importTotal, setImportTotal] = useState<number>(0);
  const [importDryRunResult, setImportDryRunResult] = useState<ItemsBulkPreviewResponse | null>(null);
  const [importDryRunLoading, setImportDryRunLoading] = useState<boolean>(false);
  const importDataRef = useRef<CsvImportItem[]>([]);
  const [hyrekaImportOpen, setHyrekaImportOpen] = useState(false);
  const [hyrekaImportRows, setHyrekaImportRows] = useState<HyrekaImportRow[]>([]);
  const [hyrekaImportError, setHyrekaImportError] = useState<string | null>(null);
  const [hyrekaImportStatus, setHyrekaImportStatus] = useState("");
  const [hyrekaImportRunning, setHyrekaImportRunning] = useState(false);
  const [hyrekaImportProgress, setHyrekaImportProgress] = useState(0);
  const [hyrekaDefaultParentId, setHyrekaDefaultParentId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(DEFAULT_PARENT_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const persistHyrekaDefaultParent = useCallback((nextParentId: string) => {
    setHyrekaDefaultParentId(nextParentId);
    if (typeof window === "undefined") return;
    try {
      if (nextParentId) {
        localStorage.setItem(DEFAULT_PARENT_STORAGE_KEY, nextParentId);
      } else {
        localStorage.removeItem(DEFAULT_PARENT_STORAGE_KEY);
      }
    } catch (storageError) {
      console.warn(
        "[ItemsPage] Standard-Parent fuer Hyreka-Import konnte nicht gespeichert werden",
        storageError,
      );
    }
  }, []);
  // Search und Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [selectedProductGroup, setSelectedProductGroup] = useState<string | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [viewTotal, setViewTotal] = useState<number>(0);
  const [viewLoading, setViewLoading] = useState<boolean>(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  // Paginierung
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  // CSV-Import mit PapaParse (läuft im Worker-Thread, blockiert die UI nicht)
  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    setImportError(null);
    setImportDryRunResult(null);
    if (!file) return;

    try {
      setImportStatus("Datei wird gelesen...");
      const { text: csvText, encoding } = await decodeCsvTextWithFallback(file);
      setImportStatus(`Datei wird gelesen (${encoding})...`);
      const parsedRows = await parseCsvText(csvText, { skipEmptyLines: true });
      setImportStatus(`Gelesen: ${parsedRows.length} Zeilen (${encoding})`);

      const items: CsvImportItem[] = [];
      if (parsedRows.length === 0) {
        setImportError("Keine gültigen Artikel in der CSV-Datei gefunden. Bitte prüfen Sie das Format.");
      } else {
        const headerRow = ((parsedRows[0] as unknown[]) ?? []).map((value) => String(value ?? "").trim());
        const headerMap = new Map<string, number>();
        headerRow.forEach((value, index) => {
          const key = normalizeHeaderKey(value);
          if (key && !headerMap.has(key)) {
            headerMap.set(key, index);
          }
        });

        const readByHeader = (cols: unknown[], aliases: string[]): string => {
          for (const alias of aliases) {
            const idx = headerMap.get(alias);
            if (idx !== undefined) {
              return String(cols[idx] ?? "").trim();
            }
          }
          return "";
        };

        const isMasterDataFormat =
          headerMap.has("code") &&
          headerMap.has("description") &&
          (headerMap.has("manufacturer") || headerMap.has("hersteller")) &&
          (headerMap.has("product_group") || headerMap.has("productgroup") || headerMap.has("warengruppe"));
        const isHyrekaFormat = headerRow.join(";").includes("Warengruppe") && headerRow.join(";").includes("Artikel-Nr.");

        parsedRows.slice(1).forEach((rawRow, index: number) => {
          if (!Array.isArray(rawRow) || rawRow.length < 2) {
            return;
          }

          const cols = rawRow;
          try {
            if (isMasterDataFormat) {
              const code = readByHeader(cols, ["code", "artikel_nr", "artikelnummer"]);
              const description = readByHeader(cols, ["description", "bezeichnung", "beschreibung"]);
              const descriptionSecondary = readByHeader(cols, ["description_secondary", "bezeichnung_2", "beschreibung_2"]);
              const manufacturer = readByHeader(cols, ["manufacturer", "hersteller"]);
              const productGroup = readByHeader(cols, ["product_group", "productgroup", "warengruppe"]);
              if (!code || !description || !manufacturer || !productGroup) {
                return;
              }

              const alternateRaw = readByHeader(cols, ["alternate_codes", "weitere_codes", "weiterecodes"]);
              const alternateCodes = parseAlternateCodesFromText(alternateRaw, code);
              const qrCode = readByHeader(cols, ["qr_code", "qrcode", "qr_code_value", "qrcodevalue"]);
              const targetStock = parseOptionalIntFromCsv(readByHeader(cols, ["target_stock", "sollbestand"]));
              const reorderPoint = parseOptionalIntFromCsv(readByHeader(cols, ["reorder_point", "meldebestand"]));
              const minimumStock = parseOptionalIntFromCsv(readByHeader(cols, ["minimum_stock", "mindestbestand"]));
              const currentQuantity = parseOptionalIntFromCsv(readByHeader(cols, ["current_quantity", "ist_bestand", "istbestand"]));
              const price = parseOptionalNumberFromCsv(readByHeader(cols, ["price_eur", "price", "preis_eur", "preis"]));
              const packSize = parseOptionalPositiveIntFromCsv(
                readByHeader(cols, ["pack_size", "verpackungseinheit"]),
              );
              const orderQuantity = parseOptionalPositiveIntFromCsv(
                readByHeader(cols, ["order_quantity", "bestellmenge"]),
              );
              const supplierId = readByHeader(cols, ["supplier_id", "lieferant_id"]);
              const supplierName = readByHeader(cols, ["supplier_name", "lieferant"]);
              const storageLocationId = readByHeader(cols, ["storage_location_id", "lagerort_id"]);
              const storageLocationCode = readByHeader(cols, ["storage_location_code", "lagerort_code"]);
              const storageLocationName = readByHeader(cols, ["storage_location_name", "lagerort_name"]);

              const item: CsvImportItem = {
                code: code.trim(),
                description: description.trim(),
                descriptionSecondary: descriptionSecondary ? descriptionSecondary.trim() : undefined,
                manufacturer: manufacturer.trim(),
                productGroup: productGroup.trim(),
                qrCodeValue: qrCode || code.trim(),
                targetStock: targetStock ?? 0,
                alternateCodes,
              };
              if (price !== undefined) item.price = price;
              if (packSize !== undefined) item.packSize = packSize;
              if (orderQuantity !== undefined) item.orderQuantity = orderQuantity;
              if (reorderPoint !== undefined) item.reorderPoint = reorderPoint;
              if (minimumStock !== undefined) item.minimumStock = minimumStock;
              if (currentQuantity !== undefined) item.currentQuantity = currentQuantity;
              if (supplierId) item.supplierId = supplierId;
              if (supplierName) item.supplierName = supplierName;
              if (storageLocationId) item.storageLocationId = storageLocationId;
              if (storageLocationCode) item.storageLocationCode = storageLocationCode;
              if (storageLocationName) item.storageLocationName = storageLocationName;
              items.push(item);
              return;
            }

            let code: string | undefined;
            let description: string | undefined;
            let descriptionSecondary = "";
            let manufacturer: string | undefined;
            let productGroup: string | undefined;

            if (isHyrekaFormat && cols.length >= 17) {
              productGroup = String(cols[0] ?? "");
              code = String(cols[1] ?? "");
              const bezeichnung1 = String(cols[2] ?? "");
              description = bezeichnung1.trim();
              const weitereBezeichnungen = [cols[3], cols[4], cols[5]]
                .filter((value) => value && String(value).trim())
                .join(" ")
                .trim();
              descriptionSecondary = weitereBezeichnungen;

              const groupParts = String(productGroup).split(" ");
              if (groupParts.length >= 2) {
                manufacturer = groupParts[0];
                productGroup = groupParts.slice(1).join(" ");
              } else {
                manufacturer = String(cols[11] ?? "") || "Unbekannt";
                productGroup = productGroup || "Ersatzteil";
              }
            } else if (cols.length === 4) {
              code = String(cols[0] ?? "");
              description = String(cols[1] ?? "");
              const herstellerWaren = String(cols[3] ?? cols[2] ?? "");
              const match = herstellerWaren.match(/(.+?)\s+(Ersatzteil|Toner|Kit|Wartung|Verbrauchsmaterial)$/i);
              if (match) {
                manufacturer = match[1];
                productGroup = match[2];
              } else {
                manufacturer = herstellerWaren;
                productGroup = "Ersatzteil";
              }
            } else if (cols.length >= 5) {
              code = String(cols[0] ?? "");
              description = String(cols[1] ?? "").trim();
              descriptionSecondary = String(cols[2] ?? "").trim();
              manufacturer = String(cols[3] ?? "");
              productGroup = String(cols[4] ?? "");
            } else {
              code = String(cols[0] ?? "");
              description = String(cols[1] ?? "");
              manufacturer = String(cols[2] ?? "") || "Unbekannt";
              productGroup = "Ersatzteil";
            }

            if (code && description) {
              items.push({
                code: code.trim(),
                description: description.replace(/\s+/g, " ").trim(),
                descriptionSecondary: descriptionSecondary || undefined,
                manufacturer: String(manufacturer || "Unbekannt").trim(),
                productGroup: String(productGroup || "Ersatzteil").trim(),
                qrCodeValue: code.trim(),
                targetStock: 0,
                alternateCodes: [],
              });
            }
          } catch (error) {
            console.warn(`Fehler beim Parsen von Zeile ${index + 2}:`, error);
          }
        });

        if (items.length === 0) {
          setImportError("Keine gültigen Artikel in der CSV-Datei gefunden. Bitte prüfen Sie das Format.");
        }
      }

      importDataRef.current = items;
      setImportTotal(items.length);
      setImportPreview(items.slice(0, 200));
      setImportStatus(`Import bereit: ${items.length} Artikel`);
    } catch (parseError) {
      console.error("Fehler beim Parsen der CSV:", parseError);
      setImportError("Fehler beim Verarbeiten der CSV-Datei. Bitte prüfen Sie das Format.");
      setImportPreview([]);
      setImportDryRunResult(null);
      importDataRef.current = [];
      setImportTotal(0);
      setImportStatus("");
    }
  };

  const handleOpenHyrekaImport = () => {
    if (typeof window !== "undefined") {
      try {
        setHyrekaDefaultParentId(localStorage.getItem(DEFAULT_PARENT_STORAGE_KEY) ?? "");
      } catch {
        // ignore storage read errors
      }
    }
    setHyrekaImportError(null);
    setHyrekaImportStatus("");
    setHyrekaImportRows([]);
    setHyrekaImportProgress(0);
    setHyrekaImportOpen(true);
  };

  const handleCloseHyrekaImport = () => {
    if (hyrekaImportRunning) return;
    setHyrekaImportOpen(false);
    setHyrekaImportRows([]);
    setHyrekaImportError(null);
    setHyrekaImportStatus("");
    setHyrekaImportProgress(0);
  };

  const handleHyrekaImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setHyrekaImportError(null);
    setHyrekaImportStatus("");
    setHyrekaImportRows([]);

    if (!file) {
      return;
    }

    try {
      setHyrekaImportStatus("Hyreka-Datei wird gelesen...");
      const { text: csvText, encoding } = await decodeCsvTextWithFallback(file);
      setHyrekaImportStatus(`Hyreka-Datei wird gelesen (${encoding})...`);
      const parsedRows = await parseCsvText(csvText, {
        skipEmptyLines: true,
        delimiter: ";",
      });
      setHyrekaImportStatus(`Gelesen: ${parsedRows.length} Zeilen (${encoding})`);

      if (parsedRows.length <= 1) {
        setHyrekaImportError("Die Datei enthält keine verwertbaren Datenzeilen.");
        return;
      }

      const headerRow = ((parsedRows[0] as unknown[]) ?? []).map((value) =>
        parseHyrekaHeaderKey(String(value ?? "")),
      );
      const headerMap = new Map<string, number>();
      headerRow.forEach((value, index) => {
        if (value && !headerMap.has(value)) {
          headerMap.set(value, index);
        }
      });

      const readByHeader = (cols: unknown[], aliases: string[]): string => {
        for (const alias of aliases) {
          const index = headerMap.get(alias);
          if (index !== undefined) {
            return cleanHyrekaText(cols[index]);
          }
        }
        return "";
      };

      const rows: HyrekaImportRow[] = [];
      const parseErrors: string[] = [];
      const seenCodes = new Set<string>();

      parsedRows.slice(1).forEach((rawRow, index) => {
        if (!Array.isArray(rawRow)) return;

        const rowNumber = index + 2;
        const cols = rawRow;
        const code = readByHeader(cols, ["artikelnr", "article_code", "artikelnummer"]);
        // "Bezeichnung (1)" → nach Normalisierung: "bezeichnung_1"
        const description = readByHeader(cols, ["artikelbez", "bezeichnung", "bezeichnung_1", "description"]);
        if (!code || !description) {
          return;
        }

        const normalizedCode = normalizeLookupKey(code);
        if (seenCodes.has(normalizedCode)) {
          parseErrors.push(`Zeile ${rowNumber}: Duplikat für Artikel ${code}`);
          return;
        }
        seenCodes.add(normalizedCode);

        // "Bezeichnung (2)" → "bezeichnung_2"
        const descriptionSecondary = readByHeader(cols, ["artikelbe2", "beschreibung2", "bezeichnung_2", "description_secondary"]);
        const productGroupRaw = readByHeader(cols, ["warengrupp", "warengruppe", "product_group"]);
        const supplierName = readByHeader(cols, ["kundnum", "lieferant", "supplier_name"]);
        // "Bestell-Nr." → "bestellnr"
        const supplierNumber = readByHeader(cols, ["lifernum", "bestellnr", "supplier_number", "supplier_no"]);
        const locationRaw = normalizeHyrekaLocationRaw(
          readByHeader(cols, ["lagerort", "storage_location"]),
        );
        const barcode = readByHeader(cols, ["barcode"]);
        const ean = readByHeader(cols, ["ean"]);
        const ersatzNr = readByHeader(cols, ["ersatznr"]);
        const uArtNum = readByHeader(cols, ["uartnum"]);
        const pendant = readByHeader(cols, ["pendant"]);
        const manufacturerHintFromGroup = cleanHyrekaText(productGroupRaw).split(/\s+/)[0];

        // "Bestand" → "bestand"; "Verfügbar" → nach Normalisierung "verfgbar" (ü wird entfernt)
        const currentQuantity = parseOptionalIntFromCsv(
          readByHeader(cols, ["lagerbesta", "lagerbestand", "bestand", "verfuegb", "verfgbar"]),
        );
        // "Meldebestand" → "meldebestand" (entspricht MINDESTBES im alten Format)
        const minimumStock = parseOptionalIntFromCsv(readByHeader(cols, ["mindestbes", "meldebestand"]));
        const reorderPoint = parseOptionalIntFromCsv(readByHeader(cols, ["alarmbes"]));
        const dauerSoll = parseOptionalIntFromCsv(readByHeader(cols, ["dauersoll"]));
        // Sollbestand: dauersoll bevorzugt, Fallback auf alarmbes oder mindestbes
        let targetStock = dauerSoll;
        if (targetStock === undefined || targetStock === 0) {
          targetStock = reorderPoint ?? minimumStock;
        }
        if (targetStock === undefined) {
          targetStock = 0;
        }

        const price =
          parseOptionalNumberFromCsv(readByHeader(cols, ["eknetto"])) ??
          parseOptionalNumberFromCsv(readByHeader(cols, ["bruttpreis"])) ??
          parseOptionalNumberFromCsv(readByHeader(cols, ["mek"]));

        const packSize = parseOptionalPositiveIntFromCsv(
          readByHeader(cols, ["verpackeh", "pack_size", "verpackungseinheit"]),
        );
        // "bestmenge" = Bestellmenge je Bestellung (altes Format); "bestellt" absichtlich NICHT: das ist "Menge beim Lieferanten bestellt"
        const orderQuantity = parseOptionalPositiveIntFromCsv(
          readByHeader(cols, ["bestmenge", "order_quantity"]),
        );

        const alternateCodes = parseHyrekaAlternateCodes(code, [
          barcode,
          ean,
          ersatzNr,
          uArtNum,
          pendant,
        ]);

        rows.push({
          rowNumber,
          code,
          description,
          descriptionSecondary: descriptionSecondary || undefined,
          productGroupRaw,
          manufacturerHint: manufacturerHintFromGroup || undefined,
          supplierName: supplierName || undefined,
          supplierNumber: supplierNumber || undefined,
          locationRaw: locationRaw || undefined,
          targetStock,
          minimumStock,
          reorderPoint,
          currentQuantity,
          price,
          packSize,
          orderQuantity,
          qrCodeValue: barcode || ean || code,
          alternateCodes,
        });
      });

      setHyrekaImportRows(rows);
      if (rows.length === 0) {
        setHyrekaImportError("Keine gültigen Hyreka-Zeilen gefunden.");
        return;
      }
      if (parseErrors.length > 0) {
        setHyrekaImportError(
          `Einige Zeilen wurden übersprungen (${parseErrors.length}). Erste Hinweise: ${parseErrors
            .slice(0, 5)
            .join(" | ")}`,
        );
      }
      setHyrekaImportStatus(`Hyreka-Datei bereit: ${rows.length} Artikel`);
    } catch (error) {
      console.error("[ItemsPage] Hyreka-Importdatei konnte nicht gelesen werden", error);
      setHyrekaImportError("Die Hyreka-Datei konnte nicht verarbeitet werden.");
      setHyrekaImportRows([]);
    }
  };

  const handleHyrekaImportConfirm = async () => {
    if (!isOnline) {
      setHyrekaImportError("Hyreka-Einmalimport funktioniert nur online.");
      return;
    }
    if (hyrekaImportRows.length === 0) {
      setHyrekaImportError("Bitte zuerst eine Hyreka-CSV auswählen.");
      return;
    }

    setHyrekaImportError(null);
    setHyrekaImportRunning(true);
    setHyrekaImportProgress(0);
    setHyrekaImportStatus("Stammdaten werden geladen...");

    let createdSuppliers = 0;
    let createdLocations = 0;
    let createdItems = 0;
    let updatedItems = 0;
    let stockAdjusted = 0;
    let skipped = 0;

    const warnings: string[] = [];
    const errors: string[] = [];
    const unknownLocationWarnings = new Set<string>();
    const productGroupMappingWarnings = new Set<string>();
    const droppedAlternateCodesWarnings = new Set<string>();

    try {
      const [supplierSeed, locationSeed, existingItemsResponse] = await Promise.all([
        suppliers.length > 0 ? Promise.resolve(suppliers) : fetchSuppliers(),
        locations.length > 0
          ? Promise.resolve(locations.filter((location: any) => location.type !== "VEHICLE"))
          : fetchLocations({ includeVehicles: false }),
        fetchItems({ page: 1, limit: 200000 }),
      ]);

      let supplierList: any[] = [...supplierSeed];
      let locationList: any[] = [...locationSeed].filter((location: any) => location.type !== "VEHICLE");
      const knownGroups = Array.from(
        new Set(
          existingItemsResponse.items
            .map((item: any) => cleanHyrekaText(item.productGroup))
            .filter(Boolean),
        ),
      );

      const existingByCode = new Map<string, any>();
      existingItemsResponse.items.forEach((item: any) => {
        existingByCode.set(normalizeLookupKey(item.code), item);
      });
      const alternateCodeOwners = new Map<string, string>();
      existingItemsResponse.items.forEach((item: any) => {
        const ownerCode = normalizeLookupKey(item.code);
        const codes = Array.isArray(item.alternateCodes) ? item.alternateCodes : [];
        codes.forEach((altCode: unknown) => {
          const clean = cleanHyrekaText(altCode);
          if (!clean) return;
          const key = normalizeLookupKey(clean);
          if (!key || isPlaceholderValue(clean)) return;
          if (!alternateCodeOwners.has(key)) {
            alternateCodeOwners.set(key, ownerCode);
          }
        });
      });

      const supplierByName = new Map<string, any>();
      supplierList.forEach((supplier) => {
        const key = normalizeLookupKey(cleanHyrekaText(supplier.name));
        if (key && !supplierByName.has(key)) {
          supplierByName.set(key, supplier);
        }
      });

      const locationsByStructuredKey = new Map<string, any>();
      const locationsByLookup = new Map<string, any[]>();
      const registerLocationLookup = (location: any) => {
        const structuredKey = getStructuredLocationKey(location);
        if (structuredKey && !locationsByStructuredKey.has(structuredKey)) {
          locationsByStructuredKey.set(structuredKey, location);
        }
        for (const candidate of [cleanHyrekaText(location.name), cleanHyrekaText(location.code)]) {
          const key = normalizeLocationLookup(candidate);
          if (!key) continue;
          const bucket = locationsByLookup.get(key) ?? [];
          bucket.push(location);
          locationsByLookup.set(key, bucket);
        }
      };
      const rebuildLocationLookups = (nextLocations: any[]) => {
        locationsByStructuredKey.clear();
        locationsByLookup.clear();
        nextLocations.forEach(registerLocationLookup);
      };
      rebuildLocationLookups(locationList);

      const parentIdForNewLocations = locationList.some((location) => location.id === hyrekaDefaultParentId)
        ? hyrekaDefaultParentId
        : "";

      const ensureSupplierId = async (
        supplierName?: string,
        supplierNumber?: string,
        code?: string,
      ): Promise<string | undefined> => {
        const cleanName = cleanHyrekaText(supplierName);
        if (!cleanName) return undefined;

        const key = normalizeLookupKey(cleanName);
        const existing = supplierByName.get(key);
        if (existing?.id) return existing.id;

        try {
          const created = await createSupplier({
            name: cleanName.slice(0, 255),
            customerNumber: cleanHyrekaText(supplierNumber) || undefined,
          } as any);
          supplierList.push(created);
          supplierByName.set(key, created);
          createdSuppliers += 1;
          return created.id;
        } catch (createError) {
          console.warn("[ItemsPage] Lieferant konnte nicht direkt angelegt werden", createError);
          try {
            supplierList = await fetchSuppliers();
            supplierByName.clear();
            supplierList.forEach((supplier) => {
              const supplierKey = normalizeLookupKey(cleanHyrekaText(supplier.name));
              if (supplierKey && !supplierByName.has(supplierKey)) {
                supplierByName.set(supplierKey, supplier);
              }
            });
            const resolved = supplierByName.get(key);
            if (resolved?.id) return resolved.id;
          } catch (reloadError) {
            console.warn("[ItemsPage] Lieferantenliste konnte nicht neu geladen werden", reloadError);
          }
          errors.push(`Lieferant konnte nicht angelegt werden (${cleanName}) bei Artikel ${code || "-"}.`);
          return undefined;
        }
      };

      const ensureLocationId = async (locationRaw?: string, code?: string): Promise<string | undefined> => {
        const raw = cleanHyrekaText(locationRaw);
        if (!raw || isPlaceholderValue(raw)) return undefined;

        const parsed = parseStructuredLocationFromText(raw);
        if (parsed) {
          const existing = locationsByStructuredKey.get(parsed.key);
          if (existing?.id) return existing.id;
        }

        const directMatches = locationsByLookup.get(normalizeLocationLookup(raw)) ?? [];
        if (directMatches.length === 1) {
          return directMatches[0].id;
        }
        if (directMatches.length > 1) {
          errors.push(`Lagerort mehrdeutig (${raw}) bei Artikel ${code || "-"}.`);
          return undefined;
        }

        if (!parsed) {
          const warningKey = normalizeLocationLookup(raw);
          if (!unknownLocationWarnings.has(warningKey)) {
            unknownLocationWarnings.add(warningKey);
            warnings.push(`Lagerortformat nicht erkannt (${raw}).`);
          }
          return undefined;
        }

        try {
          const created = await createLocation({
            type: parsed.type,
            name: parsed.canonicalName,
            parentId: parentIdForNewLocations || undefined,
          });
          locationList.push(created);
          registerLocationLookup(created);
          createdLocations += 1;
          return created.id;
        } catch (createError) {
          console.warn("[ItemsPage] Lagerort konnte nicht direkt angelegt werden", createError);
          try {
            const refreshed = await fetchLocations({ includeVehicles: false });
            locationList = refreshed.filter((location) => location.type !== "VEHICLE");
            rebuildLocationLookups(locationList);
            const resolved = locationsByStructuredKey.get(parsed.key);
            if (resolved?.id) return resolved.id;
          } catch (reloadError) {
            console.warn("[ItemsPage] Lagerorte konnten nicht neu geladen werden", reloadError);
          }
          errors.push(
            `Lagerort konnte nicht angelegt werden (${parsed.canonicalName}) bei Artikel ${code || "-"}.`,
          );
          return undefined;
        }
      };

      const newItems: CreateItemRequest[] = [];
      const existingUpdates: Array<{
        code: string;
        itemId: string;
        payload: UpdateItemRequest;
        desiredCurrentQuantity?: number;
        desiredLocationId?: string;
      }> = [];

      for (let index = 0; index < hyrekaImportRows.length; index += 1) {
        const row = hyrekaImportRows[index];
        setHyrekaImportProgress(Math.round(((index + 1) / hyrekaImportRows.length) * 25));
        setHyrekaImportStatus(`Zeile ${index + 1}/${hyrekaImportRows.length} wird vorbereitet...`);

        const existingItem = existingByCode.get(normalizeLookupKey(row.code));
        const supplierId = await ensureSupplierId(row.supplierName, row.supplierNumber, row.code);
        const locationId = await ensureLocationId(row.locationRaw, row.code);
        const productGroupResult = resolveKnownProductGroup(
          row.productGroupRaw,
          existingItem?.productGroup,
          knownGroups,
        );
        if (productGroupResult.fallbackUsed && !isPlaceholderValue(row.productGroupRaw)) {
          const warningKey = `${normalizeLookupKey(row.productGroupRaw)}=>${normalizeLookupKey(
            productGroupResult.value,
          )}`;
          if (!productGroupMappingWarnings.has(warningKey)) {
            productGroupMappingWarnings.add(warningKey);
            warnings.push(
              `Warengruppe gemappt (${row.productGroupRaw} -> ${productGroupResult.value}).`,
            );
          }
        }

        const manufacturer = resolveManufacturer(
          existingItem?.manufacturer,
          row.manufacturerHint,
          row.supplierName,
          row.productGroupRaw,
        );

        const basePayload: CreateItemRequest = {
          code: row.code,
          description: row.description,
          manufacturer,
          productGroup: productGroupResult.value,
          qrCodeValue: row.qrCodeValue || row.code,
          targetStock: row.targetStock,
        };

        const rowCodeKey = normalizeLookupKey(row.code);
        const rowAlternateCodes: string[] = [];
        row.alternateCodes.forEach((candidate) => {
          const clean = cleanHyrekaText(candidate);
          if (!clean || isPlaceholderValue(clean)) return;
          const altKey = normalizeLookupKey(clean);
          if (!altKey) return;
          const owner = alternateCodeOwners.get(altKey);
          if (owner && owner !== rowCodeKey) {
            const warningKey = `${altKey}:${owner}`;
            if (!droppedAlternateCodesWarnings.has(warningKey)) {
              droppedAlternateCodesWarnings.add(warningKey);
              warnings.push(
                `Alternativcode ${clean} wurde ignoriert (bereits bei Artikel ${owner.toUpperCase()}).`,
              );
            }
            return;
          }
          alternateCodeOwners.set(altKey, rowCodeKey);
          rowAlternateCodes.push(clean);
        });

        if (row.descriptionSecondary) basePayload.descriptionSecondary = row.descriptionSecondary;
        if (supplierId) basePayload.supplierId = supplierId;
        if (locationId) basePayload.storageLocationId = locationId;
        if (row.price !== undefined) basePayload.price = row.price;
        if (row.packSize !== undefined) basePayload.packSize = row.packSize;
        if (row.orderQuantity !== undefined) basePayload.orderQuantity = row.orderQuantity;
        if (row.minimumStock !== undefined) basePayload.minimumStock = row.minimumStock;
        if (row.reorderPoint !== undefined) basePayload.reorderPoint = row.reorderPoint;
        if (rowAlternateCodes.length > 0) basePayload.alternateCodes = rowAlternateCodes;

        if (existingItem) {
          const updatePayload: UpdateItemRequest = {
            description: basePayload.description,
            manufacturer: basePayload.manufacturer,
            productGroup: basePayload.productGroup,
            targetStock: basePayload.targetStock,
          };
          const existingQr = cleanHyrekaText((existingItem as any)?.qrCodeValue);
          if (!existingQr && basePayload.qrCodeValue && !isPlaceholderValue(basePayload.qrCodeValue)) {
            updatePayload.qrCodeValue = basePayload.qrCodeValue;
          }
          if (basePayload.descriptionSecondary !== undefined) updatePayload.descriptionSecondary = basePayload.descriptionSecondary;
          if (basePayload.supplierId) updatePayload.supplierId = basePayload.supplierId;
          if (basePayload.storageLocationId) updatePayload.storageLocationId = basePayload.storageLocationId;
          if (basePayload.price !== undefined) updatePayload.price = basePayload.price;
          if (basePayload.packSize !== undefined) updatePayload.packSize = basePayload.packSize;
          if (basePayload.orderQuantity !== undefined) updatePayload.orderQuantity = basePayload.orderQuantity;
          if (basePayload.minimumStock !== undefined) updatePayload.minimumStock = basePayload.minimumStock;
          if (basePayload.reorderPoint !== undefined) updatePayload.reorderPoint = basePayload.reorderPoint;
          const existingAlternateCodes = Array.isArray((existingItem as any)?.alternateCodes)
            ? ((existingItem as any).alternateCodes as string[])
            : [];
          if (
            existingAlternateCodes.length === 0 &&
            basePayload.alternateCodes &&
            basePayload.alternateCodes.length > 0
          ) {
            updatePayload.alternateCodes = basePayload.alternateCodes;
          }

          existingUpdates.push({
            code: row.code,
            itemId: existingItem.id,
            payload: updatePayload,
            desiredCurrentQuantity: row.currentQuantity,
            // Wenn Hyreka keinen Lagerort liefert, vorhandenen Lagerort des Artikels nutzen
            desiredLocationId: locationId ?? (existingItem as any).storageLocation?.id ?? undefined,
          });
        } else {
          if (row.currentQuantity !== undefined && locationId) {
            basePayload.currentQuantity = row.currentQuantity;
          }
          if (row.currentQuantity !== undefined && !locationId) {
            warnings.push(`Ist-Bestand ohne Lagerort bei neuem Artikel ${row.code} ignoriert.`);
          }
          newItems.push(basePayload);
        }
      }

      setHyrekaImportStatus("Neue Artikel werden angelegt...");
      if (newItems.length > 0) {
        const batchSize = 150;
        for (let index = 0; index < newItems.length; index += batchSize) {
          const batch = newItems.slice(index, index + batchSize);
          try {
            const result = await addItemsBulk(batch, { skipReload: true });
            createdItems += result.created;
            skipped += result.skipped;
            if (Array.isArray(result.errors) && result.errors.length > 0) {
              errors.push(...result.errors.map((entry: string) => `Create-Batch: ${entry}`));
            }
          } catch (batchError) {
            errors.push(`Create-Batch fehlgeschlagen: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
          }
          setHyrekaImportProgress(25 + Math.round((Math.min(index + batch.length, newItems.length) / Math.max(newItems.length, 1)) * 20));
        }
      }

      setHyrekaImportStatus("Bestehende Artikel werden aktualisiert...");
      if (existingUpdates.length > 0) {
        try {
          const bulkPayload = existingUpdates.map((entry) => ({ id: entry.itemId, ...entry.payload }));
          const result = await updateItemsBulk(bulkPayload);
          updatedItems += result.updated;
          errors.push(...result.errors.map((e) => `Update fehlgeschlagen: ${e}`));
        } catch (updateError) {
          errors.push(`Bulk-Update fehlgeschlagen: ${extractApiErrorMessage(updateError)}`);
        }
        setHyrekaImportProgress(70);
      }

      setHyrekaImportStatus("Bestände werden abgeglichen...");
      setHyrekaImportProgress(72);
      const refreshedItems = await fetchItems({ page: 1, limit: 200000 });
      const refreshedByCode = new Map<string, any>();
      refreshedItems.items.forEach((item: any) => {
        refreshedByCode.set(normalizeLookupKey(item.code), item);
      });

      // Warnungen für Artikel, bei denen Ist-Bestand vorhanden aber kein Lagerort ermittelt werden konnte
      existingUpdates.forEach((entry) => {
        if (entry.desiredCurrentQuantity !== undefined && !entry.desiredLocationId) {
          warnings.push(
            `Ist-Bestand (${entry.desiredCurrentQuantity}) bei ${entry.code} nicht übernommen – kein Lagerort im CSV und keiner im System hinterlegt.`,
          );
        }
      });

      const stockTargets = existingUpdates.filter(
        (entry) =>
          entry.desiredCurrentQuantity !== undefined &&
          entry.desiredLocationId &&
          Number.isFinite(entry.desiredCurrentQuantity),
      );

      for (let index = 0; index < stockTargets.length; index += 1) {
        const target = stockTargets[index];
        const refreshed = refreshedByCode.get(normalizeLookupKey(target.code));
        if (!refreshed) {
          errors.push(`Bestandsabgleich: Artikel nicht gefunden (${target.code}).`);
          continue;
        }
        if ((refreshed.storageLocation?.id ?? null) !== target.desiredLocationId) {
          warnings.push(
            `Ist-Bestand (${target.desiredCurrentQuantity}) bei ${target.code} nicht übernommen – Lagerort nach Update abweichend (erwartet: ${target.desiredLocationId}, aktuell: ${refreshed.storageLocation?.id ?? "keiner"}).`,
          );
          continue;
        }

        const current = typeof refreshed.currentQuantity === "number" ? refreshed.currentQuantity : 0;
        const desired = target.desiredCurrentQuantity ?? current;
        const delta = desired - current;
        if (delta === 0) {
          continue;
        }

        try {
          await recordMovement({
            itemId: refreshed.id,
            locationId: target.desiredLocationId,
            userId: user?.id ?? undefined,
            type: delta > 0 ? "CHECKIN" : "CHECKOUT",
            quantity: Math.abs(delta),
            occurredAt: new Date().toISOString(),
            note: "Hyreka-Einmalimport Bestandsabgleich",
            source: HYREKA_IMPORT_SOURCE,
          });
          stockAdjusted += 1;
        } catch (movementError) {
          errors.push(
            `Bestandsabgleich fehlgeschlagen (${target.code}): ${
              movementError instanceof Error ? movementError.message : String(movementError)
            }`,
          );
        }
        setHyrekaImportProgress(72 + Math.round(((index + 1) / Math.max(stockTargets.length, 1)) * 28));
      }

      setSuppliers(supplierList);
      setLocations(locationList);
      await loadItems({ force: true });
      setHyrekaImportProgress(100);
      setHyrekaImportStatus("Hyreka-Einmalimport abgeschlossen.");

      const summaryLines = [
        "Hyreka-Einmalimport abgeschlossen.",
        `Neu angelegt: ${createdItems}`,
        `Aktualisiert: ${updatedItems}`,
        `Lieferanten neu angelegt: ${createdSuppliers}`,
        `Lagerorte neu angelegt: ${createdLocations}`,
        `Bestandskorrekturen: ${stockAdjusted}`,
        `Übersprungen: ${skipped}`,
        `Hinweise: ${warnings.length}`,
        `Fehler: ${errors.length}`,
      ];
      if (warnings.length > 0) {
        summaryLines.push("", "--- Hinweise ---");
        warnings.slice(0, 20).forEach((w) => summaryLines.push(w));
        if (warnings.length > 20) summaryLines.push(`... und ${warnings.length - 20} weitere (siehe Browser-Konsole)`);
      }
      if (errors.length > 0) {
        summaryLines.push("", "--- Fehler ---");
        errors.slice(0, 10).forEach((e) => summaryLines.push(e));
        if (errors.length > 10) summaryLines.push(`... und ${errors.length - 10} weitere (siehe Browser-Konsole)`);
      }
      if (warnings.length > 20) console.warn("[HyrekaImport] Alle Hinweise:", warnings);
      if (errors.length > 10) console.error("[HyrekaImport] Alle Fehler:", errors);
      alert(summaryLines.join("\n"));
      setHyrekaImportRows([]);
      setHyrekaImportOpen(false);
    } catch (error) {
      console.error("[ItemsPage] Hyreka-Einmalimport fehlgeschlagen", error);
      setHyrekaImportError(
        `Hyreka-Einmalimport fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setHyrekaImportRunning(false);
    }
  };

  const prepareImportPayload = useCallback(async (itemsToImport: CsvImportItem[]): Promise<PreparedImportPayload> => {
    const supplierList = suppliers.length > 0 ? suppliers : await fetchSuppliers();
    const locationList = locations.length > 0 ? locations : await fetchLocations({ includeVehicles: false });
    if (suppliers.length === 0) setSuppliers(supplierList);
    if (locations.length === 0) setLocations(locationList);

    const supplierById = new Map<string, any>(supplierList.map((supplier: any) => [supplier.id, supplier]));
    const supplierByName = new Map<string, any>();
    for (const supplier of supplierList) {
      const key = normalizeLookupKey(String(supplier.name ?? ""));
      if (key && !supplierByName.has(key)) {
        supplierByName.set(key, supplier);
      }
    }

    const locationById = new Map<string, any>(locationList.map((location: any) => [location.id, location]));
    const locationsByCode = new Map<string, any[]>();
    for (const location of locationList) {
      const key = normalizeLookupKey(String(location.code ?? ""));
      if (!key) continue;
      const bucket = locationsByCode.get(key) ?? [];
      bucket.push(location);
      locationsByCode.set(key, bucket);
    }

    const preparedItems: CreateItemRequest[] = [];
    const preValidationErrors: string[] = [];

    for (const item of itemsToImport) {
      const {
        supplierName,
        storageLocationCode,
        storageLocationName: _storageLocationName,
        ...basePayload
      } = item;

      let supplierId = basePayload.supplierId?.trim();
      if (!supplierId && supplierName) {
        supplierId = supplierByName.get(normalizeLookupKey(supplierName))?.id;
      }
      if (supplierId && !supplierById.has(supplierId)) {
        preValidationErrors.push(`Lieferant nicht gefunden (Artikel ${basePayload.code}): ${supplierId}`);
        supplierId = undefined;
      }

      let storageLocationId = basePayload.storageLocationId?.trim();
      if (storageLocationId && !locationById.has(storageLocationId)) {
        storageLocationId = undefined;
      }
      if (!storageLocationId && storageLocationCode) {
        const matches = locationsByCode.get(normalizeLookupKey(storageLocationCode)) ?? [];
        if (matches.length === 1) {
          storageLocationId = matches[0].id;
        } else if (matches.length > 1) {
          preValidationErrors.push(`Lagerort-Code nicht eindeutig (Artikel ${basePayload.code}): ${storageLocationCode}`);
          continue;
        } else {
          preValidationErrors.push(`Lagerort nicht gefunden (Artikel ${basePayload.code}): ${storageLocationCode}`);
          continue;
        }
      }

      if (basePayload.currentQuantity !== undefined && !storageLocationId) {
        preValidationErrors.push(`Ist-Bestand ohne Lagerort (Artikel ${basePayload.code})`);
        continue;
      }

      preparedItems.push({
        ...basePayload,
        supplierId,
        storageLocationId,
      });
    }

    return { preparedItems, preValidationErrors };
  }, [locations, suppliers]);

  const handleImportConfirm = async () => {
    const itemsToImport = importDataRef.current;
    if (!itemsToImport || itemsToImport.length === 0) {
      setImportError("Keine Artikel geladen.");
      return;
    }
    setImportOpen(false);
    setImportFile(null);
    setImportError(null);
    setImportDryRunResult(null);
    setImporting(true);
    setImportProgress(0);
    setImportStatus("");
    
    try {
      const { preparedItems, preValidationErrors } = await prepareImportPayload(itemsToImport);

      if (preparedItems.length === 0) {
        throw new Error("Keine gültigen Datensätze nach Vorprüfung.");
      }

      const BATCH_SIZE = 1000;
      const CONCURRENCY = 3;
      const batches: any[] = [];
      for (let i = 0; i < preparedItems.length; i += BATCH_SIZE) {
        batches.push(preparedItems.slice(i, i + BATCH_SIZE));
      }

      console.log(`Import gestartet: ${preparedItems.length} Artikel in ${batches.length} Batches (Parallel=${CONCURRENCY})`);
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalErrors: string[] = [...preValidationErrors];
      let processed = 0;
      let nextBatchIndex = 0;

      const runNext = async () => {
        const current = nextBatchIndex++;
        if (current >= batches.length) return;
        const batch = batches[current];
        setImportStatus(`Batch ${current + 1}/${batches.length} (${processed}/${preparedItems.length} Artikel)`);
        try {
          const result = await addItemsBulk(batch, { skipReload: true });
          totalCreated += result.created;
          totalUpdated += result.updated ?? 0;
          totalSkipped += result.skipped;
          totalErrors = totalErrors.concat(result.errors);
        } catch (err) {
          console.error(`Fehler in Batch ${current + 1}:`, err);
          totalErrors.push(`Batch ${current + 1}: ${err}`);
        } finally {
          processed += batch.length;
          setImportProgress(Math.round((processed / preparedItems.length) * 100));
        }
        await runNext();
      };

      const workers = [];
      const parallel = Math.min(CONCURRENCY, batches.length);
      for (let i = 0; i < parallel; i++) {
        workers.push(runNext());
      }
      await Promise.all(workers);

      setImportProgress(100);
      setImportStatus("Aktualisiere Bestandsliste...");
      await loadItems();

      let message = `CSV-Import abgeschlossen:
${totalCreated} Artikel neu erstellt`;
      if (totalUpdated > 0) {
        message += `
${totalUpdated} Artikel aktualisiert`;
      }
      if (totalCreated + totalUpdated > 100) {
        message += `
 Grosser Datenimport erfolgreich verarbeitet`;
      }
      if (totalSkipped > 0) {
        message += `
${totalSkipped} übersprungen`;
      }
      if (totalErrors.length > 0) {
        message += `
${totalErrors.length} Fehler aufgetreten`;
        console.warn("Import-Fehler:", totalErrors);
      }
      message += `

Import erfolgreich! Die Artikel sind jetzt verfügbar.`;

      alert(message);
      setImportPreview([]);
      importDataRef.current = [];
      setImportTotal(0);
    } catch (err) {
      console.error("Bulk-Import Fehler:", err);
      setImportError("Fehler beim Importieren der Artikel.");
    } finally {
      setImporting(false);
      setImportProgress(0);
      setImportStatus("");
    }
  };

  const handleImportDryRun = async () => {
    const itemsToImport = importDataRef.current;
    if (!itemsToImport || itemsToImport.length === 0) {
      setImportError("Keine Artikel geladen.");
      return;
    }

    setImportError(null);
    setImportDryRunLoading(true);
    setImportStatus("Test-Import wird geprüft...");

    try {
      const { preparedItems, preValidationErrors } = await prepareImportPayload(itemsToImport);

      if (preparedItems.length === 0) {
        const onlyValidationResult: ItemsBulkPreviewResponse = {
          created: 0,
          updated: 0,
          skipped: 0,
          errors: preValidationErrors,
          rows: [],
        };
        setImportDryRunResult(onlyValidationResult);
        setImportStatus(`Test-Import fertig: 0 anlegen, 0 überspringen, ${preValidationErrors.length} Fehler`);
        return;
      }

      const preview = await previewItemsBulk(preparedItems);
      const combinedErrors = [...preValidationErrors, ...preview.errors];
      const combinedResult: ItemsBulkPreviewResponse = {
        ...preview,
        errors: combinedErrors,
      };

      setImportDryRunResult(combinedResult);
      setImportStatus(
        `Test-Import fertig: ${combinedResult.created} neu, ${combinedResult.updated} aktualisiert, ${combinedResult.skipped} überspringen, ${combinedResult.errors.length} Fehler`,
      );
    } catch (err) {
      console.error("Bulk-Preview Fehler:", err);
      setImportDryRunResult(null);
      setImportError("Fehler beim Test-Import.");
      setImportStatus("");
    } finally {
      setImportDryRunLoading(false);
    }
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageKey, setImageKey] = useState(0);

  const {
    items,
    loadItems,
    addItem,
    addItemsBulk,
    updateItem,
    deleteItem,
    isLoading,
    total,
    page: storePage,
  } = useItemsStore() as any;
  const { isOnline } = useNetworkStatus();
  const editingItem = useMemo(
    () => (editingId ? items.find((entry: any) => entry.id === editingId) : null),
    [editingId, items],
  );

  // Stelle sicher, dass beim Seitenaufruf der lokale Cache (offlineStorage) geladen wird
  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!isOnline) return;
    fetchSuppliers()
      .then(setSuppliers)
      .catch((err) => console.warn("[ItemsPage] Lieferanten konnten nicht geladen werden", err));
    fetchLocations({ includeVehicles: false })
      .then(setLocations)
      .catch((err) => console.warn("[ItemsPage] Lagerorte konnten nicht geladen werden", err));
  }, [isOnline]);

  useEffect(() => {
    if (!hyrekaDefaultParentId) return;
    const exists = locations.some(
      (location: any) => location.id === hyrekaDefaultParentId && location.type !== "VEHICLE",
    );
    if (exists) return;
    persistHyrekaDefaultParent("");
  }, [hyrekaDefaultParentId, locations, persistHyrekaDefaultParent]);

  // Debounced search - verzögert Search um 300ms für bessere Performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    // Bei neuer Suche/Filter zurück auf Seite 1
    setPage(1);
  }, [debouncedSearchTerm, selectedManufacturer, selectedProductGroup]);

  useEffect(() => {
    const run = async () => {
      setViewLoading(true);
      try {
        if (isOnline) {
          const data = await fetchItems({
            page,
            limit: itemsPerPage,
            search: debouncedSearchTerm || undefined,
            manufacturer: selectedManufacturer || undefined,
            productGroup: selectedProductGroup || undefined,
          });
          setViewItems(data.items);
          setViewTotal(data.total);
        } else {
          setViewItems(items);
          setViewTotal(items.length);
        }
      } catch (err) {
        console.error("[ItemsPage] Laden fehlgeschlagen, nutze Cache", err);
        setViewItems(items);
        setViewTotal(items.length);
      } finally {
        setViewLoading(false);
      }
    };
    void run();
  }, [page, itemsPerPage, debouncedSearchTerm, selectedManufacturer, selectedProductGroup, items, isOnline]);

  useEffect(() => {
    if (storePage) setPage(storePage);
  }, [storePage]);

  const totalPages = Math.max(1, Math.ceil((viewTotal || 0) / itemsPerPage));

  const sortedItems = useMemo(
    () => [...viewItems].sort((a, b) => a.code.localeCompare(b.code, "de", { sensitivity: "base" })),
    [viewItems],
  );

  // Verwende ALLE Artikel aus dem Store für die Dropdown-Listen (nicht nur die aktuelle Seite)
  const manufacturerOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item: any) => item.manufacturer)))
        .filter(Boolean)
        .sort((a: any, b: any) => a.localeCompare(b, "de", { sensitivity: "base" })),
    [items],
  );

  const productGroupOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item: any) => item.productGroup)))
        .filter(Boolean)
        .sort((a: any, b: any) => a.localeCompare(b, "de", { sensitivity: "base" })),
    [items],
  );

  const supplierOptions = useMemo(
    () =>
      [...suppliers].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "", "de", { sensitivity: "base" })),
    [suppliers],
  );

  const locationById = useMemo(() => {
    const map = new Map<string, any>();
    for (const location of locations) {
      map.set(location.id, location);
    }
    return map;
  }, [locations]);

  const getLocationPath = useCallback(
    (loc: any) => getLocationPathFromMap(loc, locationById),
    [locationById],
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

  const hyrekaParentOptions = useMemo(() => {
    const candidates = locations.filter((loc: any) => loc.type !== "VEHICLE");
    return [...candidates].sort((a: any, b: any) =>
      getLocationPathFromMap(a, locationById).localeCompare(
        getLocationPathFromMap(b, locationById),
        "de",
        { sensitivity: "base" },
      ),
    );
  }, [locations, locationById]);

  const getLocationLabel = useCallback((loc: any) => {
    if (!loc) return "";
    const path = getLocationPath(loc) || loc.code || "";
    const namePart = loc.name ? ` (${loc.name})` : "";
    return `${path}${namePart}`;
  }, [getLocationPath]);

  const getLocationGroup = useCallback((loc: any) => {
    const fullPath = getLocationPath(loc);
    const [topLevel] = fullPath.split(" / ");
    return topLevel || "Sonstige";
  }, [getLocationPath]);

  const getLocationSearchText = useCallback((loc: any) => {
    const path = getLocationPath(loc);
    return [
      loc.code,
      loc.name,
      path,
      loc.parent?.code,
      loc.parent?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }, [getLocationPath]);

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
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
      if (name === "packSize" || name === "orderQuantity" || name === "minimumStock" || name === "reorderPoint") {
        const parsed = Number.parseInt(value, 10);
        return { ...prev, [name]: Number.isNaN(parsed) || value === "" ? undefined : parsed } as ItemFormState;
      }
      if (name === "alternateCodesText") {
        return { ...prev, alternateCodesText: value };
      }
      return { ...prev, [name]: value } as ItemFormState;
    });
  };

  const handleManufacturerChange = (_: any, value: unknown) => {
    setForm((prev: any) => ({ ...prev, manufacturer: (value as string) ?? "" }));
  };

  const handleProductGroupChange = (_: any, value: unknown) => {
    setForm((prev: any) => ({ ...prev, productGroup: (value as string) ?? "" }));
  };

  const handleOpenCreate = () => {
    setForm(initialFormState);
    setError(null);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const item = items.find((entry: any) => entry.id === id);
    if (!item) return;
    setForm({
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
    setError(null);
    setEditingId(id);
    setOpen(true);
  };

  const handleCloseDialog = () => {
    if (isSubmitting) return;
    setOpen(false);
    setEditingId(null);
    setImageUploading(false);
  };

  const validate = () => {
    if (!form.code.trim()) return "Bitte Artikelnummer eingeben.";
    if (!form.description.trim()) return "Bitte Beschreibung eingeben.";
    if (!form.manufacturer.trim()) return "Bitte Hersteller angeben.";
    if (!form.productGroup.trim()) return "Bitte Warengruppe angeben.";
    if (form.targetStock !== undefined && form.targetStock < 0)
      return "Sollbestand darf nicht negativ sein.";
    if (form.currentQuantity !== undefined && form.currentQuantity < 0) {
      return "Ist-Bestand darf nicht negativ sein.";
    }
    if (form.currentQuantity !== undefined && !form.storageLocationId?.trim()) {
      return "Für den Ist-Bestand muss ein Lagerort angegeben werden.";
    }
    return null;
  };

  const createPayload = (): CreateItemRequest => {
    const safeTargetStock = typeof form.targetStock === "number" && Number.isFinite(form.targetStock) ? form.targetStock : 0;
    const targetStockValue = safeTargetStock > 0 ? Math.floor(safeTargetStock) : 0;
    const alternateCodes = parseAlternateCodesFromText(form.alternateCodesText, form.code);
    const secondary = form.descriptionSecondary?.trim();

    return {
      code: form.code.trim(),
      description: form.description.trim(),
      descriptionSecondary: secondary ? secondary : undefined,
      manufacturer: form.manufacturer.trim(),
      productGroup: form.productGroup.trim(),
      qrCodeValue: form.qrCodeValue?.trim() ? form.qrCodeValue.trim() : undefined,
      targetStock: targetStockValue,
      minimumStock: form.minimumStock != null && form.minimumStock >= 0 ? Math.floor(form.minimumStock) : null,
      reorderPoint: form.reorderPoint != null && form.reorderPoint >= 0 ? Math.floor(form.reorderPoint) : null,
      storageLocationId: form.storageLocationId?.trim() ? form.storageLocationId.trim() : undefined,
      supplierId: form.supplierId?.trim() ? form.supplierId.trim() : undefined,
      price: form.price !== undefined ? form.price : undefined,
      packSize: form.packSize ?? undefined,
      orderQuantity: form.orderQuantity !== undefined && form.orderQuantity > 0 ? form.orderQuantity : undefined,
      alternateCodes,
    };
  };

  const handleScanDetected = (code: string) => {
    setForm((prev) => ({
      ...prev,
      qrCodeValue: code,
      code: prev.code || code,
    }));
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteItem(deleteTarget);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExportItemsCsv = async () => {
    try {
      const blob = await downloadItemsMasterDataCsv({
        search: debouncedSearchTerm || undefined,
        manufacturer: selectedManufacturer || undefined,
        productGroup: selectedProductGroup || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artikel_stammdaten_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Artikel-CSV Export fehlgeschlagen", error);
      alert("Artikel-CSV konnte nicht erstellt werden.");
    }
  };

  const filteredItems = sortedItems;
  const paginatedItems = sortedItems;

  // Offline-Queue-Indikator
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  useEffect(() => {
    const checkOfflineQueue = async () => {
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        const queue = await storage.getItemQueue();
        setOfflineQueueCount(queue.length);
      } catch (err) {
        console.warn("[ItemsPage] Fehler beim Prüfen der Offline-Queue:", err);
      }
    };
    
    checkOfflineQueue();
    const interval = setInterval(checkOfflineQueue, 5000); // Check alle 5 Sekunden
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Artikelstammdaten
      </Typography>
      
      {offlineQueueCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {offlineQueueCount} Artikel-{offlineQueueCount === 1 ? "Änderung" : "Änderungen"} warten auf Synchronisation.
          Die Änderungen werden automatisch synchronisiert, sobald die Verbindung wiederhergestellt ist.
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 2, backgroundColor: "background.paper" }}>
        <Grid container spacing={{ xs: 1, sm: 2 }} alignItems="center">
          <Grid item xs={12} sm>
            <Typography variant="body2" color="text.secondary">
              Lege neue Ersatzteile an oder bearbeite bestehende Einträge. Alle
              Daten stehen anschließend auch mobil zur Verfügung.
            </Typography>
          </Grid>
          <Grid item xs={12} sm="auto" sx={{ 
            display: 'flex', 
            gap: { xs: 1, sm: 2 },
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            <Button 
              variant="contained" 
              onClick={handleOpenCreate}
              sx={{ 
                minHeight: 44,
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              Artikel anlegen
            </Button>
            {user?.role === 'MANAGER' && (
              <>
                <Button
                  variant="outlined"
                  color="info"
                  onClick={() => {
                    setImportError(null);
                    setImportDryRunResult(null);
                    setImportStatus("");
                    setImportOpen(true);
                  }}
                  sx={{
                    minHeight: 44,
                    width: { xs: '100%', sm: 'auto' }
                  }}
                >
                  Artikel importieren
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={handleOpenHyrekaImport}
                  sx={{
                    minHeight: 44,
                    width: { xs: "100%", sm: "auto" },
                  }}
                >
                  Hyreka Einmalimport
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  onClick={handleExportItemsCsv}
                  sx={{
                    minHeight: 44,
                    width: { xs: "100%", sm: "auto" },
                  }}
                >
                  Artikel exportieren (CSV)
                </Button>
              </>
            )}
            {user?.role === 'MANAGER' && (
              <Button 
                variant="outlined" 
                color="secondary"
                onClick={async () => {
                  try {
                    // Öffne vorab ein Fenster/Tab (für iOS Popup-Blocker)
                    const previewWin = window.open('', '_blank');
                    const blob = await downloadItemsQrCatalog({
                      search: debouncedSearchTerm || undefined,
                      manufacturer: selectedManufacturer || undefined,
                      productGroup: selectedProductGroup || undefined,
                    });
                    const url = window.URL.createObjectURL(blob);
                    // iOS Safari unterstützt a.download für Blobs oft nicht -> in neuem Tab öffnen
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
                    if (isIOS && previewWin) {
                      previewWin.location.href = url;
                    } else {
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `artikel_qr_katalog_${new Date().toISOString().split('T')[0]}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      if (previewWin) previewWin.close();
                    }
                    window.URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('QR-Katalog Download fehlgeschlagen', err);
                    alert('QR-Katalog konnte nicht erstellt werden.');
                  }
                }}
                sx={{ 
                  minHeight: 44,
                  width: { xs: '100%', sm: 'auto' }
                }}
              >
                QR-Katalog (PDF)
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>
      <Dialog 
        open={importOpen} 
        onClose={() => {
          setImportOpen(false);
          setImportDryRunResult(null);
          setImportStatus("");
          setImportError(null);
        }} 
        maxWidth="md" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            margin: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: 'auto' },
            maxHeight: { xs: '95vh', sm: '90vh' }
          }
        }}
      >
        <DialogTitle>Artikel importieren (CSV)</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Unterstützte CSV-Formate:</strong>
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              - <code>Artikel-Nr.,Beschreibung1,Beschreibung2,Hersteller,Warengruppe</code>
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              - <code>Artikel-Nr.,Beschreibung,Hersteller+Warengruppe</code>
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              - <code>Artikel-Nr.,Beschreibung,Hersteller,Warengruppe</code>
            </Typography>
            <Typography variant="body2">
              Die Datei muss UTF-8 kodiert sein. Hersteller und Warengruppe können auch zusammen stehen (z.B. "Toshiba Ersatzteil").
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Tipp: Mit <strong>Artikel exportieren (CSV)</strong> bekommst du ein Re-Import-Format inkl. Lagerort, Lieferant, Preis, Bestellmenge und Ist-Bestand.
            </Typography>
          </Alert>
          <input type="file" accept=".csv" onChange={handleImportFile} />
          {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
          {importPreview.length > 0 && (
            <Box sx={{ mt: 2, overflowX: 'auto' }}>
              {importTotal > importPreview.length && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Vorschau begrenzt auf {importPreview.length} von {importTotal} Artikeln.
                </Typography>
              )}
              <Typography variant="subtitle1" gutterBottom>
                Vorschau ({importPreview.length} Artikel)
              </Typography>
              <Table size="small" sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Artikelnummer</TableCell>
                    <TableCell>Beschreibung (1)</TableCell>
                    <TableCell>Beschreibung (2)</TableCell>
                    <TableCell>Hersteller</TableCell>
                    <TableCell>Warengruppe</TableCell>
                    <TableCell>QR-Code</TableCell>
                    <TableCell>Soll</TableCell>
                    <TableCell>Alternativcodes</TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {importPreview.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.descriptionSecondary || "-"}</TableCell>
                    <TableCell>{item.manufacturer}</TableCell>
                    <TableCell>{item.productGroup}</TableCell>
                    <TableCell>{item.qrCodeValue}</TableCell>
                    <TableCell>{item.targetStock}</TableCell>
                    <TableCell>{item.alternateCodes?.join(", ") || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </Box>
          )}
          {importDryRunResult && (
            <Box sx={{ mt: 2 }}>
              <Alert severity={importDryRunResult.errors.length > 0 ? "warning" : "success"} sx={{ mb: 1 }}>
                Test-Import Ergebnis: {importDryRunResult.created} neu, {importDryRunResult.updated} aktualisiert, {importDryRunResult.skipped} übersprungen, {importDryRunResult.errors.length} Fehler
              </Alert>
              {importDryRunResult.errors.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Erste Fehler: {importDryRunResult.errors.slice(0, 5).join(" | ")}
                </Typography>
              )}
              {importDryRunResult.rows.length > 0 && (
                <Box sx={{ overflowX: "auto" }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Zeilenvorschau ({Math.min(importDryRunResult.rows.length, 100)} von {importDryRunResult.rows.length})
                  </Typography>
                  <Table size="small" sx={{ minWidth: 520 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Zeile</TableCell>
                        <TableCell>Artikel</TableCell>
                        <TableCell>Aktion</TableCell>
                        <TableCell>Hinweis</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importDryRunResult.rows.slice(0, 100).map((row) => (
                        <TableRow key={`${row.row}-${row.code}-${row.action}`}>
                          <TableCell>{row.row}</TableCell>
                          <TableCell>{row.code || "-"}</TableCell>
                          <TableCell>{row.action}</TableCell>
                          <TableCell>{row.reason || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          )}
          {importing && (
            <Box sx={{ width: '100%', mb: 2 }}>
              <LinearProgress variant="determinate" value={importProgress} />
              <Typography variant="caption">Importiere Artikel... {importProgress}% {importStatus}</Typography>
            </Box>
          )}
          {importDryRunLoading && (
            <Box sx={{ width: '100%', mb: 2 }}>
              <LinearProgress />
              <Typography variant="caption">Test-Import läuft... {importStatus}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setImportOpen(false);
              setImportDryRunResult(null);
              setImportStatus("");
              setImportError(null);
            }}
          >
            Abbrechen
          </Button>
          <Button onClick={handleImportDryRun} disabled={!importPreview.length || importing || importDryRunLoading} variant="outlined">
            Test-Import
          </Button>
          <Button onClick={handleImportConfirm} disabled={!importPreview.length || importing || importDryRunLoading} variant="contained" color="primary">Importieren</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={hyrekaImportOpen}
        onClose={handleCloseHyrekaImport}
        maxWidth="lg"
        fullWidth
        sx={{
          "& .MuiDialog-paper": {
            margin: { xs: 1, sm: 2 },
            width: { xs: "calc(100% - 16px)", sm: "auto" },
            maxHeight: { xs: "95vh", sm: "90vh" },
          },
        }}
      >
        <DialogTitle>Hyreka Einmalimport (CSV)</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Dieser Import ist für die einmalige Übernahme aus Hyreka gedacht. Der normale Artikel-Import bleibt unverändert.
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            Fehlende Lieferanten und strukturierte Lagerorte (Regal/Fach, Schrank/Schublade) werden bei Bedarf automatisch angelegt.
          </Alert>
          {!isOnline && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Der Hyreka-Einmalimport funktioniert nur online.
            </Alert>
          )}

          <Autocomplete
            options={hyrekaParentOptions}
            value={hyrekaParentOptions.find((loc: any) => loc.id === hyrekaDefaultParentId) ?? null}
            onChange={(_: any, value: any) => persistHyrekaDefaultParent(value?.id ?? "")}
            isOptionEqualToValue={(option: any, value: any) => option.id === value.id}
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
                label="Standard-Parent für neue Lagerorte"
                helperText="Optional. Wird für neu angelegte Hyreka-Lagerorte verwendet und gespeichert."
                sx={{ mb: 2 }}
              />
            )}
          />

          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Hyreka-CSV auswählen (Semikolon-getrennt, UTF-8)
            </Typography>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleHyrekaImportFile}
              disabled={hyrekaImportRunning}
            />
          </Box>

          {hyrekaImportStatus && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {hyrekaImportStatus}
            </Typography>
          )}
          {hyrekaImportError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {hyrekaImportError}
            </Alert>
          )}

          {hyrekaImportRunning && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={hyrekaImportProgress} />
              <Typography variant="caption" color="text.secondary">
                Verarbeitung läuft... {hyrekaImportProgress}%
              </Typography>
            </Box>
          )}

          {hyrekaImportRows.length > 0 && (
            <Box sx={{ mt: 2, overflowX: "auto" }}>
              <Typography variant="subtitle1" gutterBottom>
                Vorschau ({Math.min(hyrekaImportRows.length, 100)} von {hyrekaImportRows.length} Artikeln)
              </Typography>
              <Table size="small" sx={{ minWidth: 840 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Zeile</TableCell>
                    <TableCell>Artikelnummer</TableCell>
                    <TableCell>Bezeichnung</TableCell>
                    <TableCell>Warengruppe Rohwert</TableCell>
                    <TableCell>Lieferant</TableCell>
                    <TableCell>Lagerort Rohwert</TableCell>
                    <TableCell align="right">Soll</TableCell>
                    <TableCell align="right">Ist</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hyrekaImportRows.slice(0, 100).map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.code}`}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{row.code}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.productGroupRaw || "-"}</TableCell>
                      <TableCell>{row.supplierName || "-"}</TableCell>
                      <TableCell>{row.locationRaw || "-"}</TableCell>
                      <TableCell align="right">{row.targetStock}</TableCell>
                      <TableCell align="right">{row.currentQuantity ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHyrekaImport} disabled={hyrekaImportRunning}>
            Schließen
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleHyrekaImportConfirm}
            disabled={!isOnline || hyrekaImportRows.length === 0 || hyrekaImportRunning}
          >
            {hyrekaImportRunning
              ? "Import läuft..."
              : `Einmalimport starten${hyrekaImportRows.length > 0 ? ` (${hyrekaImportRows.length})` : ""}`}
          </Button>
        </DialogActions>
      </Dialog>
      <Backdrop
        open={importing}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1, flexDirection: "column", gap: 2 }}
      >
        <CircularProgress color="inherit" />
        <Typography variant="subtitle1">
          {importStatus || `Importiere Artikel... ${importProgress}%`}
        </Typography>
      </Backdrop>
      <Paper sx={{ backgroundColor: "background.paper" }}>
        {/* Suche und Filter */}
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 }, 
          mb: 2, 
          flexWrap: 'wrap',
          flexDirection: { xs: 'column', sm: 'row' }
        }}>
          <Box sx={{ display: 'flex', gap: 1, minWidth: { xs: '100%', sm: 220 }, flex: { xs: 1, sm: 'none' } }}>
            <TextField
              label="Suche Artikel"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              sx={{ flex: 1 }}
              placeholder="Code, Beschreibung, alternativer Code..."
              size="small"
            />
            <Tooltip title="Barcode scannen">
              <IconButton 
                color="primary" 
                onClick={() => setSearchScanOpen(true)}
                size="small"
                sx={{ 
                  border: '1px solid',
                  borderColor: 'primary.main',
                  borderRadius: 1
                }}
              >
                <QrCodeScannerIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Autocomplete
            options={manufacturerOptions}
            value={selectedManufacturer}
            onChange={(_: any, value: any) => setSelectedManufacturer(value)}
            renderInput={(params: any) => <TextField {...params} label="Hersteller" size="small" />}
            sx={{ 
              minWidth: { xs: '100%', sm: 180 },
              flex: { xs: 1, sm: 'none' }
            }}
          />
          <Autocomplete
            options={productGroupOptions}
            value={selectedProductGroup}
            onChange={(_: any, value: any) => setSelectedProductGroup(value)}
            renderInput={params => <TextField {...params} label="Warengruppe" size="small" />}
            sx={{ 
              minWidth: { xs: '100%', sm: 180 },
              flex: { xs: 1, sm: 'none' }
            }}
          />
        </Box>
        {/* Anzeige der Artikelanzahl oberhalb der Tabelle */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">
            Gesamtanzahl Artikel: {viewTotal || viewItems.length}
            {totalPages > 1 && (
              <> | Seite {page} von {totalPages} ({itemsPerPage} pro Seite)</>
            )}
          </Typography>
        </Box>
        {/* Mobile Card-Ansicht */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {paginatedItems.map((item: any) => (
            <Paper 
              key={item.id} 
              sx={{ 
                p: 2, 
                mb: 2, 
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
                  {item.code}
                </Typography>
                <Box>
                  <IconButton 
                    size="small" 
                    onClick={() => handleOpenEdit(item.id)}
                    sx={{ mr: 1 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => setDeleteTarget(item.id)}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              
              <Typography
                variant="body1"
                sx={{ fontWeight: 500, mb: item.descriptionSecondary ? 0.25 : 1 }}
              >
                {item.description}
              </Typography>
              {item.descriptionSecondary && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {item.descriptionSecondary}
                </Typography>
              )}
              
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Hersteller:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {item.manufacturer}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Warengruppe:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {item.productGroup}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Lieferant:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {item.supplier?.name || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Lagerort:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {item.storageLocation ? getLocationLabel(item.storageLocation) : "-"}
                  </Typography>
                </Grid>
              </Grid>
              
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>QR-Code:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {item.qrCodeValue || "-"}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Ist-Bestand:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {item.storageLocation ? (item.currentQuantity ?? 0) : "-"}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Soll-Bestand:</strong>
                  </Typography>
                  <Typography variant="body2">
                    {item.targetStock}
                  </Typography>
                </Grid>
              </Grid>
              
              {(item.alternateCodes?.length || 0) > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Weitere Codes:</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {item.alternateCodes?.join(", ")}
                  </Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Box>

        {/* Desktop Tabellen-Ansicht */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48, p: 0.5 }} />
                <TableCell>Code</TableCell>
                <TableCell>Bezeichnung</TableCell>
                <TableCell>Hersteller</TableCell>
                <TableCell>Warengruppe</TableCell>
                <TableCell>Lieferant</TableCell>
                <TableCell>Lagerort</TableCell>
                <TableCell>Weitere Codes</TableCell>
                <TableCell>QR-Code</TableCell>
                <TableCell align="right">Ist-Bestand</TableCell>
                <TableCell align="right">Soll-Bestand</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
          <TableBody>
            {paginatedItems.map((item: any) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ width: 48, p: 0.5 }}>
                  {item.imagePath ? (
                    <Box
                      component="img"
                      src={getItemImageUrl(item.id)}
                      alt=""
                      sx={{ width: 40, height: 40, objectFit: "cover", borderRadius: 0.5, display: "block" }}
                    />
                  ) : null}
                </TableCell>
                <TableCell>{item.code}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.description}
                  </Typography>
                  {item.descriptionSecondary && (
                    <Typography variant="body2" color="text.secondary">
                      {item.descriptionSecondary}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{item.manufacturer}</TableCell>
                <TableCell>{item.productGroup}</TableCell>
                <TableCell>{item.supplier?.name ?? "-"}</TableCell>
                <TableCell>{item.storageLocation ? getLocationLabel(item.storageLocation) : "-"}</TableCell>
                <TableCell>{item.alternateCodes?.length ? item.alternateCodes.join(", ") : "-"}</TableCell>
                <TableCell>{item.qrCodeValue ?? "-"}</TableCell>
                <TableCell align="right">
                  {item.storageLocation ? (item.currentQuantity ?? 0) : "-"}
                </TableCell>
                <TableCell align="right">{item.targetStock}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Bearbeiten">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenEdit(item.id)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteTarget(item.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {paginatedItems.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={12} align="center">
                  {filteredItems.length === 0 ? 'Keine Artikel gefunden.' : 'Keine Artikel auf dieser Seite.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </Box>
      </Paper>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(event, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
            sx={{
              '& .MuiPagination-ul': {
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: { xs: 0.5, sm: 1 }
              }
            }}
          />
        </Box>
      )}
      <Dialog open={open} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            const validationError = validate();
            if (validationError) {
              setError(validationError);
              setSubmitting(false);
              return;
            }
            const desiredQuantity = form.currentQuantity;
            const locationId = form.storageLocationId?.trim()
              ? form.storageLocationId.trim()
              : editingItem?.storageLocation?.id;
            const currentQuantity = editingItem?.storageLocation
              ? (editingItem.currentQuantity ?? 0)
              : 0;
            try {
              const payload = createPayload();
              const savedItem = editingId
                ? await updateItem(editingId, payload)
                : await addItem(payload);

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

              await loadItems({ force: true });
              setOpen(false);
            } catch (err: any) {
              console.error(err);
              setError(editingId ? "Fehler beim Aktualisieren." : "Fehler beim Anlegen.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <DialogTitle>
            {editingId ? "Artikel bearbeiten" : "Neuen Artikel anlegen"}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {/* Artikelbild – nur im Edit-Modus */}
              {editingId && (
                <Grid item xs={12}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {editingItem?.imagePath ? (
                      <Box
                        component="img"
                        src={`${getItemImageUrl(editingId)}?v=${imageKey}`}
                        alt="Artikelbild"
                        sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                      />
                    ) : (
                      <Box sx={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "action.hover", borderRadius: 1, border: "1px dashed", borderColor: "divider" }}>
                        <AddPhotoAlternateIcon color="disabled" />
                      </Box>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        startIcon={imageUploading ? <CircularProgress size={14} /> : <AddPhotoAlternateIcon />}
                        disabled={imageUploading}
                      >
                        {editingItem?.imagePath ? "Bild ersetzen" : "Bild hochladen"}
                        <input
                          type="file"
                          hidden
                          accept="image/jpeg,image/png,image/webp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !editingId) return;
                            setImageUploading(true);
                            try {
                              await uploadItemImage(editingId, file);
                              setImageKey((k) => k + 1);
                              await loadItems({ force: true });
                            } catch {
                              setError("Bild konnte nicht hochgeladen werden.");
                            } finally {
                              setImageUploading(false);
                              e.target.value = "";
                            }
                          }}
                        />
                      </Button>
                      {editingItem?.imagePath && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          disabled={imageUploading}
                          onClick={async () => {
                            setImageUploading(true);
                            try {
                              await deleteItemImage(editingId);
                              setImageKey((k) => k + 1);
                              await loadItems({ force: true });
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
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Artikelnummer"
                  name="code"
                  value={form.code}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  autoFocus
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  freeSolo
                  options={manufacturerOptions}
                  value={form.manufacturer}
                  onChange={handleManufacturerChange}
                  onInputChange={handleManufacturerChange}
                  renderInput={(params: any) => (
                    <TextField {...params} label="Hersteller" required />
                  )}
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
                  helperText="Optional: erscheint z.B. in Artikellisten, Inventur nutzt weiterhin Bezeichnung 1"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  freeSolo
                  options={productGroupOptions}
                  value={form.productGroup}
                  onChange={handleProductGroupChange}
                  onInputChange={handleProductGroupChange}
                  renderInput={(params: any) => (
                    <TextField {...params} label="Warengruppe" required />
                  )}
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
                  renderInput={(params: any) => (
                    <TextField {...params} label="Lieferant" />
                  )}
                />
              </Grid>
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
                    return options.filter((option: any) =>
                      getLocationSearchText(option).includes(query),
                    );
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
                      helperText="Suche nach Code, Name oder Pfad (z.B. LAGER / REGAL / FACH)."
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 1,
                  }}
                >
                  <TextField
                    label="QR-Code"
                    name="qrCodeValue"
                    value={form.qrCodeValue ?? ""}
                    onChange={handleInputChange}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    type="button"
                    onClick={() => setScanOpen(true)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    QR scannen
                  </Button>
                </Box>
              </Grid>
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
                  helperText="0 = automatisch nach Differenz (Soll - Aktuell)"
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
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
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
                      sx={{ 
                        mt: 1,
                        border: '1px solid',
                        borderColor: 'primary.main',
                        borderRadius: 1
                      }}
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
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={isSubmitting}>
              Abbrechen
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              Speichern
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {scanOpen && (
        <QrScannerDialog
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={handleScanDetected}
        />
      )}

      {searchScanOpen && (
        <QrScannerDialog
          open={searchScanOpen}
          onClose={() => setSearchScanOpen(false)}
          onDetected={(code) => {
            setSearchTerm(code);
            setSearchScanOpen(false);
          }}
        />
      )}

      {altCodeScanOpen && (
        <QrScannerDialog
          open={altCodeScanOpen}
          onClose={() => setAltCodeScanOpen(false)}
          onDetected={(code) => {
            const trimmedCode = code.trim();
            if (trimmedCode && trimmedCode.toLowerCase() !== form.code.toLowerCase()) {
              const currentCodes = form.alternateCodesText.trim();
              const newCodesText = currentCodes 
                ? `${currentCodes}, ${trimmedCode}` 
                : trimmedCode;
              setForm({ ...form, alternateCodesText: newCodesText });
            }
            setAltCodeScanOpen(false);
          }}
        />
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Artikel löschen</DialogTitle>
        <DialogContent dividers>
          Möchtest du diesen Artikel wirklich entfernen? Die Buchungshistorie
          bleibt erhalten.
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

export default ItemsPage;


