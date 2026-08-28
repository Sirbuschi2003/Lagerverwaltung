import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import axios from "axios";
import { Autocomplete } from "@mui/material";
import { findItemByCode } from "../utils/itemLookup";
import { useLiveFleetStock } from "../hooks/useLiveFleetStock";
import useBarcodeScanner from "../hooks/useBarcodeScanner";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Fab from "@mui/material/Fab";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchIcon from "@mui/icons-material/Search";
import useAuthStore from "../store/useAuthStore";
import useItemsStore from "../store/useItemsStore";
import useRestockStore from "../store/useRestockStore";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useOfflineStorage } from "../hooks/useOfflineStorage";
import useOfflineQueue from "../store/useOfflineQueue";
// import useOfflineStore from "../store/useOfflineStore";
// import { useVehicleStock } from "../hooks/useVehicleStock";
import {
  ItemDto,
  RestockRequestDto,
  StockLevelDto,
  fetchVehicleStock,
  recordMovement,
  updateVehicleTarget,
  type UpdateVehicleTargetRequest,
  removeVehicleStock,
} from "../utils/api";
import VehicleMovementPanel from "../components/VehicleMovementPanel";
import { SyncStatusIndicator } from "../components/SyncStatusIndicator";
import { RestockRequestStatus } from "../utils/api";
import { downloadVehicleQrCatalog, getItemImageUrl } from "../utils/api";

const restockStatusLabelMap: Record<RestockRequestStatus, string> = {
  PENDING: "Offen",
  APPROVED: "Bereitgestellt",
  FULFILLED: "Erledigt",
  CANCELLED: "Storniert",
};

const restockStatusColorMap: Record<RestockRequestStatus, "default" | "warning" | "info" | "success" | "secondary"> = {
  PENDING: "warning",
  APPROVED: "info",
  FULFILLED: "success",
  CANCELLED: "secondary",
};

type ScanFeedback = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  targetQuantity: number;
  existsOnVehicle: boolean;
  bookedType?: "CHECKIN" | "CHECKOUT";
};

const MyVehiclePage = () => {
  // Barcode-Scanner für Fahrzeugseite
  const [scannerActive, setScannerActive] = useState(false); // Scanner standardmäßig AUS
  // Buchungsrichtung beim Scannen: standardmäßig Ausbuchen (Techniker nimmt Teile vom Fahrzeug)
  const [bookingMode, setBookingMode] = useState<"CHECKIN" | "CHECKOUT">("CHECKOUT");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scanActionDialogOpen, setScanActionDialogOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [scanQuickActionsActive, setScanQuickActionsActive] = useState(false);
  const [scanFeedbackSource, setScanFeedbackSource] = useState<"scan" | "manual" | null>(null);
  const [scanPurpose, setScanPurpose] = useState<"booking" | "check">("booking");
  const [checkStockDialogOpen, setCheckStockDialogOpen] = useState(false);
  const [checkStockResult, setCheckStockResult] = useState<{ item: ItemDto; quantity: number } | null>(null);
  const [scanTargetSaving, setScanTargetSaving] = useState<string | null>(null);
  const [notFoundDialogOpen, setNotFoundDialogOpen] = useState(false); // Dialog für "Artikel nicht gefunden"
  const [notFoundCode, setNotFoundCode] = useState<string>(""); // Code des nicht gefundenen Artikels
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);
  // States für Scanner Action Dialog
  const [scanActionQuantity, setScanActionQuantity] = useState<number>(1);
  const [scanActionTargetQuantity, setScanActionTargetQuantity] = useState<number | null>(null);
  const [scanActionShowTargetInput, setScanActionShowTargetInput] = useState(false);
  // Inline-Aktionen wieder aktiv (Ein-/Ausbuchen + Löschen in Liste)
  const [createDraft, setCreateDraft] = useState({
    code: "",
    description: "",
    manufacturer: "",
    productGroup: "",
    targetStock: "",
    alternateCodes: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastScannedItemId, setLastScannedItemId] = useState<string | null>(null);
  // Scan-Handler
  const handleDetected = (code: string) => {
    // 1. Zuerst im globalen Artikelstamm suchen
    let item = findItemByCode(items, code);

    // 2. Fallback: Im geladenen Wagenbestand suchen (z.B. wenn Artikelstamm noch lädt oder Codes abweichen)
    if (!item && stock.length > 0) {
      const stockItem = findItemByCode(stock.map((s) => s.item), code);
      if (stockItem) {
        item = stockItem;
      }
    }

    if (scanPurpose === "check") {
      setScannerActive(false);
      if (item) {
        const stockEntry = stock.find((s) => s.item.id === item!.id);
        setCheckStockResult({ item, quantity: stockEntry?.quantity ?? 0 });
        setCheckStockDialogOpen(true);
      } else {
        setNotFoundCode(code);
        setNotFoundDialogOpen(true);
      }
      return;
    }

    if (item) {
      // Sofort automatisch buchen (Menge 1, Richtung aus dem Modus-Umschalter oben)
      void handleAutoBookScan(item);
      setScannerActive(false);
      setCreateDialogOpen(false);
    } else {
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
      updateScanFeedback(null);
    }
  };

  const { videoRef, isSupported, error: scannerError } = useBarcodeScanner({
    onDetected: handleDetected,
    enabled: scannerActive,
  });
  // Dialog zum Artikel anlegen
  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = createDraft.code.trim();
    const description = createDraft.description.trim();
    const manufacturer = createDraft.manufacturer.trim();
    const productGroup = createDraft.productGroup.trim();

    if (!code || !description || !manufacturer || !productGroup) {
      setCreateError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }

    const targetStockValue = Number(createDraft.targetStock);
    const alternateCodes = createDraft.alternateCodes
      ? createDraft.alternateCodes.split(/[,;\s]+/).map((s: string) => s.trim()).filter((s: string) => s && s !== code)
      : [];

    const payload = {
      code,
      description,
      manufacturer,
      productGroup,
      qrCodeValue: code,
      targetStock: 0, // Sollmenge im Artikelstamm immer 0
      alternateCodes,
    };

    try {
      const createdItem = await addItem(payload);
      setCreateDialogOpen(false);
      setCreateError(null);
      
      // Automatisch Scan-Action-Dialog öffnen mit neuem Artikel
      // Behandle sowohl temporäre als auch echte IDs (offline/online)
      const itemToScan = createdItem || {
        id: payload.code, // Fallback falls addItem undefined zurückgibt
        code: payload.code,
        description: payload.description,
        manufacturer: payload.manufacturer,
        productGroup: payload.productGroup
      };
      
      setScannedItem(itemToScan);
      setScanActionDialogOpen(true);
      
      // Lade Items neu (funktioniert auch offline aus Cache) und ziehe alle Artikel für Offline-Buchungen
      await forceLoadItems({ limit: 200000 });
    } catch (err: any) {
      if (err?.response?.data?.message) {
        setCreateError(Array.isArray(err.response.data.message) ? err.response.data.message.join(", ") : err.response.data.message);
      } else {
        setCreateError("Artikel konnte nicht angelegt werden.");
      }
    }
  };
  const user = useAuthStore((state: any) => state.user);
  
  // Fallback für vehicleId - BENUTZERABHÄNGIG (SICHERHEITSFIX)
  const getVehicleId = () => {
    // Zuerst versuche vom user Objekt
    if (user?.vehicleId) {
      // SICHERHEITSFIX: Benutzerabhängiger Cache-Key
      const cacheKey = `lv-offline-vehicleId-${user.id}`;
      localStorage.setItem(cacheKey, user.vehicleId);
      return user.vehicleId;
    }
    
    // Fallback auf localStorage NUR für denselben Benutzer
    if (user?.id) {
      const cacheKey = `lv-offline-vehicleId-${user.id}`;
      const cached = localStorage.getItem(cacheKey);
      console.log('[MyVehiclePage] VehicleId from user:', user?.vehicleId, 'from user-specific cache:', cached);
      return cached;
    }
    
    console.log('[MyVehiclePage] No user or vehicleId available');
    return null;
  };
  
  const vehicleId = getVehicleId();
  
  // Fahrzeug-Daten laden (Kennzeichen wird nicht mehr angezeigt)
  const [vehicleData, setVehicleData] = useState<any>(null);
  
  // Intervall-Auswahl für Polling
  const [refreshInterval, setRefreshInterval] = useState<number>(user?.refreshInterval ?? 15000);
  const [intervalSaved, setIntervalSaved] = useState<boolean>(false);
  // vehicleId ist bereits oben deklariert
  const { items, loadItems, forceLoadItems, addItem } = useItemsStore();
  const loadRestock = useRestockStore((state: any) => state.loadForVehicle);
  // Kein Live-Update für Techniker-Ansicht! Nur einmalig laden und nach Aktionen neu laden.
  const restockRequests: RestockRequestDto[] = useRestockStore((state: any) => state.myRequests);
  const activeRestockRequests = useMemo(
    () => (restockRequests || []).filter((request) => request.status !== "FULFILLED" && request.status !== "CANCELLED"),
    [restockRequests],
  );
  const { isOnline } = useNetworkStatus();
  const offlineStorage = useOfflineStorage();
  const { enqueueMovement, movements } = useOfflineQueue();

  // Fahrzeugbestand Status
  const [stock, setStock] = useState<StockLevelDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  const updateScanFeedback = (item: ItemDto | null, source: "scan" | "manual" = "scan") => {
    if (!item) {
      setScanFeedback(null);
      setScanQuickActionsActive(false);
      setScanFeedbackSource(null);
      return;
    }

    setLastScannedItemId(item.id);

    // Scan (egal ob über den Kamera-Scanner oben oder den im Bewegungs-Panel):
    // sofort automatisch im aktuellen Modus (Ein-/Ausbuchen) buchen.
    if (source === "scan") {
      void handleAutoBookScan(item);
      return;
    }

    // Für manuelle Auswahl: Quick-Actions wie bisher
    setScanFeedbackSource(source);

    const stockEntry = stock.find((s) => s.item.id === item.id);
    if (!stockEntry) {
      setScanFeedback({
        id: item.id,
        code: item.code,
        description: item.description,
        quantity: 0,
        targetQuantity: item.targetStock ?? 0,
        existsOnVehicle: false,
      });
      return;
    }

    setScanFeedback({
      id: stockEntry.item.id,
      code: stockEntry.item.code,
      description: stockEntry.item.description,
      quantity: stockEntry.quantity,
      targetQuantity: stockEntry.targetQuantity,
      existsOnVehicle: true,
    });
  };

  useEffect(() => {
    if (!scanFeedback) {
      setScanQuickActionsActive(false);
      setScanFeedbackSource(null);
    }
  }, [scanFeedback]);

  const handleManualInput = () => {
    setScanQuickActionsActive(false);
    setScanFeedback(null);
  };


  // Offline-fähige Stock-Ladung mit Queue-Movements
  const loadStock = async () => {
    if (!vehicleId) return;
    setIsLoading(true);
    setError(null);
    try {
      let baseStock: StockLevelDto[] = [];
      if (isOnline) {
        // Online: Lade von API und cache
        try {
          const stockData = await fetchVehicleStock(vehicleId);
          baseStock = stockData;
          await offlineStorage.setVehicleStock(vehicleId, stockData);
        } catch (apiError) {
          console.warn('[MyVehiclePage] API-Fehler beim Laden - falle auf Cache zurück:', apiError);
          // Bei API-Fehler (Timeout, Network Error) -> Cache laden
          const cachedStock = await offlineStorage.getVehicleStock(vehicleId);
          if (cachedStock && cachedStock.length > 0) {
            baseStock = cachedStock;
            setError('Online-Daten nicht verfügbar, zeige Cache an.');
          } else {
            throw apiError; // Kein Cache vorhanden, werfe Fehler weiter
          }
        }
      } else {
        // Offline: Lade aus Cache
        const cachedStock = await offlineStorage.getVehicleStock(vehicleId);
        if (cachedStock && cachedStock.length > 0) {
          baseStock = cachedStock;
        } else {
          // Kein Cache, aber evtl. Bewegungen vorhanden? Dann virtuellen Bestand aus Queue bauen
          const relevantMovements = (movements || []).filter(m => m.vehicleId === vehicleId);
          if (relevantMovements.length > 0) {
            let stockMap = new Map<string, StockLevelDto>();
            relevantMovements.forEach(movement => {
              if (movement.type === "CHECKIN") {
                const fallbackItem = {
                  id: movement.itemId,
                  code: movement.code,
                  description: movement.code,
                  manufacturer: '',
                  productGroup: '',
                  targetStock: 0,
                  alternateCodes: [],
                };
                stockMap.set(movement.itemId, {
                  item: items.find(i => i.id === movement.itemId) || fallbackItem,
                  quantity: movement.quantity,
                  targetQuantity: 0,
                  id: "offline-" + movement.itemId
                });
              }
            });
            setStock(Array.from(stockMap.values()));
            setIsLoading(false);
            setError('⚠️ Offline-Modus: Zeige nur offline erfasste Bewegungen. Fahrzeugbestand wurde noch nicht gecacht.');
            return;
          } else {
            // Offline und kein Cache: Benutzerfreundliche Fehlermeldung
            setError('⚠️ Offline-Modus: Fahrzeugbestand nicht zwischengespeichert. Bitte stellen Sie eine Verbindung her, um die Daten zu cachen.');
            setStock([]);
            setIsLoading(false);
            return;
          }
        }
      }

      // Bewegungen aus der Queue auf den Bestand anwenden (nur für dieses Fahrzeug)
      let stockMap = new Map<string, StockLevelDto>();
      baseStock.forEach(entry => stockMap.set(entry.item.id, { ...entry }));

      // Alle relevanten Bewegungen (CHECKIN/CHECKOUT) für dieses Fahrzeug
      const relevantMovements = (movements || []).filter(m => m.vehicleId === vehicleId);
      relevantMovements.forEach(movement => {
        const entry = stockMap.get(movement.itemId);
        if (entry) {
          // Artikel existiert schon im Bestand
          if (movement.type === "CHECKIN") {
            entry.quantity += movement.quantity;
          } else if (movement.type === "CHECKOUT") {
            entry.quantity = Math.max(0, entry.quantity - movement.quantity);
          }
        } else {
          // Artikel ist NEU (z.B. offline eingebucht)
          if (movement.type === "CHECKIN") {
            const fallbackItem = {
              id: movement.itemId,
              code: movement.code,
              description: movement.code,
              manufacturer: '',
              productGroup: '',
              targetStock: 0,
              alternateCodes: [],
            };
            stockMap.set(movement.itemId, {
              item: items.find(i => i.id === movement.itemId) || fallbackItem,
              quantity: movement.quantity,
              targetQuantity: 0,
              id: "offline-" + movement.itemId
            });
          }
        }
      });

      // Offline-Sollwerte anwenden (überschreiben die API/Cache-Werte)
      const offlineTargets = await offlineStorage.getOfflineTargets(vehicleId);
      if (Object.keys(offlineTargets).length > 0) {
        console.log('[MyVehiclePage] Wende Offline-Sollwerte an:', offlineTargets);
        stockMap.forEach((entry, itemId) => {
          if (offlineTargets[itemId] !== undefined) {
            entry.targetQuantity = offlineTargets[itemId];
          }
        });
      }

      setStock(Array.from(stockMap.values()));
    } catch (err) {
      console.error('[MyVehiclePage] Fehler beim Laden des Bestands:', err);
      setError('Fahrzeugbestand konnte nicht geladen werden. Bitte synchronisieren Sie sich einmal online.');
      setStock([]); // Leere Liste setzen statt undefined
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStock = () => {
    void loadStock();
  };

  const handleDownloadQrCatalog = async () => {
    try {
      setDownloadingQr(true);
      // Öffne vorab ein Fenster/Tab (für iOS Popup-Blocker)
      const previewWin = window.open('', '_blank');
      const blob = await downloadVehicleQrCatalog(vehicleId || undefined);
      const url = window.URL.createObjectURL(blob);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      if (isIOS && previewWin) {
        // iOS Safari: PDF im neuen Tab anzeigen (Speichern/Teilen möglich)
        previewWin.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `wagen_qr_katalog_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (previewWin) previewWin.close();
      }
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('QR-Katalog Download fehlgeschlagen', err);
      alert('QR-Katalog konnte nicht erstellt werden.');
    } finally {
      setDownloadingQr(false);
    }
  };

  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({});
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [isProcessing, setProcessing] = useState(false);
  // Synchronous guard prevents double-tap submitting two identical offline movements
  // React state (isProcessing) is async — both taps can pass before React re-renders
  const movementProcessingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);

  // Bewegungs-Auswahl: bevorzugt Stammdaten (items), sonst fallback auf aktuellen Fahrzeugbestand (offline)
  const movementItems = useMemo(() => {
    if (items && items.length > 0) return items;
    return stock.map((entry) => entry.item);
  }, [items, stock]);

  // vehicleId ist bereits oben deklariert

  useEffect(() => {
    // Lade Items beim Mount, lade vollständigen Cache (max. 200.000 Artikel)
    console.log('[MyVehiclePage] Loading items on mount with full offline cache');
    void forceLoadItems({ limit: 200000 });
    
    // Auto-Refresh alle 30 Minuten im Hintergrund
    const refreshInterval = setInterval(() => {
      if (navigator.onLine) {
        console.log('[MyVehiclePage] Auto-Refresh: Lade Items im Hintergrund...');
        void forceLoadItems({ limit: 200000 });
      }
    }, 30 * 60 * 1000); // 30 Minuten
    
    return () => clearInterval(refreshInterval);
  }, [forceLoadItems]);

  const loadVehicle = async () => {
    if (!vehicleId) return;
    if (!isOnline) {
      console.log('[MyVehiclePage] Offline - überspringe loadVehicle');
      return; // Im Offline-Modus kein Vehicle-Load
    }
    try {
      const response = await axios.get(`/api/vehicles/${vehicleId}`);
      setVehicleData(response.data);
    } catch (err) {
      console.error("Fahrzeug konnte nicht geladen werden", err);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      console.log('[MyVehiclePage] Loading data for vehicle:', vehicleId);
      void loadVehicle();
      void loadStock();
      void loadRestock(vehicleId);
    }
  }, [vehicleId]); // loadRestock dependency entfernt um Zucken zu vermeiden

  // Live-Updates deaktiviert für bessere Offline-Kompatibilität
  // Das useVehicleStock Hook übernimmt das Stock-Management

  useEffect(() => {
    if (stock.length > 0) {
      setTargetDrafts(
        stock.reduce<Record<string, string>>((acc: any, entry: any) => {
          acc[entry.item.id] = entry.targetQuantity.toString();
          return acc;
        }, {}),
      );
    }
  }, [stock]);

  useEffect(() => {
    setScanFeedback((prev) => {
      if (!prev) {
        return prev;
      }
      const entry = stock.find((s) => s.item.id === prev.id);
      if (!entry) {
        if (!prev.existsOnVehicle) {
          return prev;
        }
        return {
          ...prev,
          quantity: 0,
          existsOnVehicle: false,
        };
      }
      if (
        prev.existsOnVehicle &&
        entry.quantity === prev.quantity &&
        entry.targetQuantity === prev.targetQuantity
      ) {
        return prev;
      }
      return {
        ...prev,
        quantity: entry.quantity,
        targetQuantity: entry.targetQuantity,
        existsOnVehicle: true,
      };
    });
  }, [stock]);

  const handleMovement = async (
    type: "CHECKIN" | "CHECKOUT",
    itemId: string,
    qty: number,
  ) => {
    if (!vehicleId) {
      setError("Deinem Benutzer ist kein Fahrzeug zugeordnet.");
      return false;
    }

    // Synchronous guard: prevents double-tap creating duplicate offline movements.
    // setProcessing(true) alone is insufficient because React batches state updates.
    if (movementProcessingRef.current) return false;
    movementProcessingRef.current = true;
    setProcessing(true);
    try {
      if (isOnline) {
        console.log('[MyVehiclePage] Online: Recording movement via API...');
        await recordMovement({
          itemId,
          vehicleId,
          userId: user?.id ?? undefined,
          type,
          quantity: qty,
          occurredAt: new Date().toISOString(),
          source: "device",
        });
        await loadStock();
        await loadRestock(vehicleId);
        setError(null);
        return true;
      } else {
        console.log('[MyVehiclePage] Offline: Queueing movement...');
        // Offline: Bewegung in Queue einreihen
        // Suche Artikel auch mit temporären IDs (beginnend mit "temp-")
        let currentItem = items.find((item: any) => item.id === itemId);
        
        // Falls nicht gefunden und itemId ist temporär, suche nach Code in scannedItem
        if (!currentItem && itemId.startsWith('temp-') && scannedItem) {
          currentItem = scannedItem;
        }
        
        if (currentItem) {
          // ? KRITISCH: Prüfe Bestand bei CHECKOUT (Offline)
          if (type === 'CHECKOUT') {
            const stockEntry = stock.find(s => s.item.id === itemId);
            const currentQuantity = stockEntry?.quantity || 0;
            
            if (currentQuantity < qty) {
              setError(`? Ausbuchung nicht möglich! Nur ${currentQuantity} Stück auf dem Fahrzeug (${qty} angefordert).`);
              return false;
            }
          }

          await enqueueMovement({
            itemId,
            code: currentItem.code,
            type,
            quantity: qty,
            timestamp: new Date().toISOString(),
            source: "device",
            vehicleId,
            userId: user?.id,
          });
          
          // Lokale Stock-Aktualisierung für UI-Feedback
          setStock(prevStock => {
            const existingIndex = prevStock.findIndex(s => s.item.id === itemId);
            
            if (existingIndex >= 0) {
              // Artikel existiert bereits im Stock - aktualisiere Menge
              const updatedStock = [...prevStock];
              const newQuantity = type === 'CHECKIN' 
                ? updatedStock[existingIndex].quantity + qty 
                : Math.max(0, updatedStock[existingIndex].quantity - qty); // Math.max verhindert negative Werte
              updatedStock[existingIndex] = {
                ...updatedStock[existingIndex],
                quantity: newQuantity
              };
              return updatedStock;
            } else if (type === 'CHECKIN') {
              // Artikel ist NEU auf dem Fahrzeug - füge hinzu
              console.log('[MyVehiclePage] Füge neuen Artikel zum Stock hinzu:', currentItem.code);
              return [...prevStock, {
                id: "offline-" + itemId,
                item: currentItem,
                quantity: qty,
                targetQuantity: 0
              }];
            }
            
            return prevStock;
          });
          
          setError("? Offline: Buchung vorgemerkt und wird später synchronisiert.");
          return true;
        } else {
          setError("Artikel nicht gefunden für Offline-Buchung.");
          return false;
        }
      }
    } catch (err) {
      console.error(err);
      
      // Offline-Queue: Bei Netzwerkfehlern Bewegung für später vormerken
      if (!isOnline || (axios.isAxiosError(err) && (!(err as any).response || (err as any).code === 'NETWORK_ERROR'))) {
        console.log('[MyVehiclePage] Netzwerk nicht verfügbar - füge Bewegung zur Offline-Queue hinzu');
        
        const currentItem = items.find((item: any) => item.id === itemId);
        if (currentItem) {
          // ? KRITISCH: Prüfe Bestand bei CHECKOUT (Offline Fallback)
          if (type === 'CHECKOUT') {
            const stockEntry = stock.find(s => s.item.id === itemId);
            const currentQuantity = stockEntry?.quantity || 0;
            
            if (currentQuantity < qty) {
              setError(`? Ausbuchung nicht möglich! Nur ${currentQuantity} Stück auf dem Fahrzeug (${qty} angefordert).`);
              return false;
            }
          }
          
          // Offline-Queue: Bewegung für später vormerken
          await enqueueMovement({
            itemId,
            code: currentItem.code,
            type,
            quantity: qty,
            timestamp: new Date().toISOString(),
            source: "device",
            vehicleId,
            userId: user?.id,
          });
          
          console.log('[MyVehiclePage] Offline-Bewegung erfolgreich eingereiht:', {
            code: currentItem.code,
            type,
            quantity: qty
          });
          
          // Lokale Stock-Aktualisierung für sofortiges UI-Feedback
          setStock(prevStock => 
            prevStock.map(stockEntry => {
              if (stockEntry.item.id === itemId) {
                const newQuantity = type === 'CHECKIN' 
                  ? stockEntry.quantity + qty 
                  : Math.max(0, stockEntry.quantity - qty); // Math.max verhindert negative Werte
                return { ...stockEntry, quantity: newQuantity };
              }
              return stockEntry;
            })
          );
          
          setError("? Offline-Modus: Buchung wurde vorgemerkt und wird später synchronisiert.");
          return true; // Erfolgreich in Offline-Queue eingereiht
        }
      }
      
      if (axios.isAxiosError(err) && (err as any).response) {
        const message = Array.isArray((err as any).response.data?.message)
          ? (err as any).response.data.message.join(", ")
          : (err as any).response.data?.message ?? "Buchung konnte nicht gespeichert werden.";
        setError(message);
      } else {
        setError("Buchung konnte nicht gespeichert werden.");
      }
      return false;
    } finally {
      movementProcessingRef.current = false;
      setProcessing(false);
    }
  };

  // Scan-Sofortbuchung: bucht 1 Stück in der aktuell gewählten Richtung (bookingMode)
  // und blendet danach eine kurze Bestätigung ein, statt einen Dialog zu öffnen.
  const handleAutoBookScan = async (item: ItemDto) => {
    setScannedItem(item);
    setLastScannedItemId(item.id);
    setScanFeedbackSource("scan");
    setScanQuickActionsActive(true);

    const existingEntry = stock.find((s) => s.item.id === item.id);
    setScanFeedback({
      id: item.id,
      code: item.code,
      description: item.description,
      quantity: existingEntry?.quantity ?? 0,
      targetQuantity: existingEntry?.targetQuantity ?? item.targetStock ?? 0,
      existsOnVehicle: Boolean(existingEntry),
      bookedType: bookingMode,
    });

    await handleMovement(bookingMode, item.id, 1);
  };

  // Spezielle Funktion für bereitgestellte Mengen einbuchen
  const handleCheckinProvidedQuantity = async (_itemId: string, restockRequestId: string, quantity: number) => {
    if (movementProcessingRef.current) return;
    movementProcessingRef.current = true;
    try {
      setProcessing(true);

      if (!isOnline) {
        setError("Abholung bereitgestellter Teile funktioniert nur online.");
        return;
      }

      const api = await import("../utils/api");
      await api.updateRestockStatus(restockRequestId, {
        status: "FULFILLED" as any,
        note: `${quantity} Stück vom Lager übernommen`,
      });

      await loadStock();
      await loadRestock(vehicleId!);
      setError(null);
    } catch (err: any) {
      console.error("Fehler beim Einbuchen bereitgestellter Menge:", err);
      setError("Fehler beim Einbuchen: " + (err?.response?.data?.message || err.message));
    } finally {
      movementProcessingRef.current = false;
      setProcessing(false);
    }
  };

  const handleTargetChange = (itemId: string, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }
    setTargetDrafts((prev: any) => ({ ...prev, [itemId]: value }));
  };

  const persistTarget = async (vehicle: string, payload: UpdateVehicleTargetRequest) => {
    await updateVehicleTarget(vehicle, payload);
    // Lade Stock nach Ã"nderung neu
    await refreshStock();
  };

  const handleTargetBlur = async (itemId: string) => {
    if (!vehicleId) {
      return;
    }

    const currentEntry = stock.find((entry) => entry.item.id === itemId);
    if (!currentEntry) {
      return;
    }

    const draftValue = targetDrafts[itemId];
    const parsed = draftValue === "" ? 0 : Number(draftValue);
    if (!Number.isFinite(parsed)) {
      setTargetDrafts((prev: any) => ({ ...prev, [itemId]: currentEntry.targetQuantity.toString() }));
      return;
    }

    const normalized = Math.max(0, Math.round(parsed));
    if (normalized === currentEntry.targetQuantity) {
      setTargetDrafts((prev: any) => ({ ...prev, [itemId]: currentEntry.targetQuantity.toString() }));
      return;
    }

    setSavingTarget(itemId);
    try {
      if (isOnline) {
        // Online: Speichere via API
        await persistTarget(vehicleId, { itemId, targetQuantity: normalized });
        await loadRestock(vehicleId);
        setTargetDrafts((prev: any) => ({ ...prev, [itemId]: normalized.toString() }));
        setTargetError(null);
      } else {
        // Offline: Speichere persistent in IndexedDB
        console.log('[MyVehiclePage] Offline: Sollwert persistent gespeichert für', itemId, normalized);
        
        // Lade aktuelle Offline-Sollwerte
        const currentTargets = await offlineStorage.getOfflineTargets(vehicleId);
        currentTargets[itemId] = normalized;
        
        // Speichere zurück in IndexedDB
        await offlineStorage.setOfflineTargets(vehicleId, currentTargets);
        
        // Aktualisiere UI
        setStock(prevStock => 
          prevStock.map(entry => 
            entry.item.id === itemId 
              ? { ...entry, targetQuantity: normalized }
              : entry
          )
        );
        setTargetDrafts((prev: any) => ({ ...prev, [itemId]: normalized.toString() }));
        setTargetError(null);
        
        // Hinweis für Benutzer
        setError('Offline: Sollwert gespeichert - wird beim nächsten Sync übertragen.');
      }
    } catch (err: any) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response) {
        const message = Array.isArray(err.response.data?.message)
          ? err.response.data.message.join(", ")
          : err.response.data?.message ?? "Soll konnte nicht gespeichert werden.";
        setTargetError(message);
      } else {
        setTargetError("Soll konnte nicht gespeichert werden.");
      }
      setTargetDrafts((prev: any) => ({ ...prev, [itemId]: currentEntry.targetQuantity.toString() }));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleTargetKeyDown = (event: KeyboardEvent<HTMLDivElement>, itemId: string) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      const currentEntry = stock.find((entry) => entry.item.id === itemId);
      if (currentEntry) {
        setTargetDrafts((prev: any) => ({ ...prev, [itemId]: currentEntry.targetQuantity.toString() }));
      }
      event.currentTarget.blur();
    }
  };

  const handleSetScanTarget = async (item: ItemDto, rawValue: number) => {
    if (!vehicleId) {
      setError("Deinem Benutzer ist kein Fahrzeug zugeordnet.");
      return;
    }

    const normalized = Math.max(0, Math.round(rawValue));
    setScanTargetSaving(item.id);
    try {
      if (isOnline) {
        await persistTarget(vehicleId, { itemId: item.id, targetQuantity: normalized });
        await loadRestock(vehicleId);
        await loadStock();
        setError(null);
      } else {
        const currentTargets = await offlineStorage.getOfflineTargets(vehicleId);
        currentTargets[item.id] = normalized;
        await offlineStorage.setOfflineTargets(vehicleId, currentTargets);
        setStock(prevStock => {
          const existing = prevStock.find(entry => entry.item.id === item.id);
          if (existing) {
            return prevStock.map(entry =>
              entry.item.id === item.id
                ? { ...entry, targetQuantity: normalized }
                : entry,
            );
          }
          return [
            ...prevStock,
            {
              id: `offline-${item.id}`,
              item,
              quantity: 0,
              targetQuantity: normalized,
            },
          ];
        });
        setError("Offline: Sollwert gespeichert - wird beim nächsten Sync übertragen.");
      }

      setTargetDrafts(prev => ({ ...prev, [item.id]: normalized.toString() }));
      setScanFeedback(prev => {
        if (prev && prev.id === item.id) {
          return {
            ...prev,
            targetQuantity: normalized,
            existsOnVehicle: true,
          };
        }
        return prev;
      });
    } catch (err: any) {
      console.error(err);
      if (axios.isAxiosError(err) && err.response) {
        const message = Array.isArray(err.response.data?.message)
          ? err.response.data.message.join(", ")
          : err.response.data?.message ?? "Soll konnte nicht gespeichert werden.";
        setError(message);
      } else {
        setError("Soll konnte nicht gespeichert werden.");
      }
    } finally {
      setScanTargetSaving(null);
    }
  };


  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const filteredStock = useMemo(() => {
    if (!searchQuery.trim()) {
      return stock || [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    return (stock || []).filter((entry: StockLevelDto) => {
      const item = entry.item;
      return (
        item.code?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.descriptionSecondary?.toLowerCase().includes(query) ||
        item.manufacturer?.toLowerCase().includes(query) ||
        item.productGroup?.toLowerCase().includes(query) ||
        item.alternateCodes?.some((code: string) => code.toLowerCase().includes(query))
      );
    });
  }, [stock, searchQuery]);

  const sortedStock = useMemo(() => {
    return [...filteredStock].sort((a, b) => {
      // Gescannter Artikel immer ganz oben
      if (lastScannedItemId) {
        if (a.item.id === lastScannedItemId) return -1;
        if (b.item.id === lastScannedItemId) return 1;
      }
      
      // Fehlende Artikel (quantity < targetQuantity) oben
      const aIsShortage = a.targetQuantity > 0 && a.quantity < a.targetQuantity;
      const bIsShortage = b.targetQuantity > 0 && b.quantity < b.targetQuantity;
      
      if (aIsShortage && !bIsShortage) return -1;
      if (!aIsShortage && bIsShortage) return 1;
      
      // Sonst alphabetisch nach Code
      return a.item.code.localeCompare(b.item.code, "de", { sensitivity: "base" });
    });
  }, [filteredStock, lastScannedItemId]);

  const displayStock = useMemo(() => {
    // Verwende sortedStock für korrekte Sortierung (gescannt, dann Fehlartikel, dann alphabetisch)
    return sortedStock;
  }, [sortedStock]);

  const restockMap = useMemo(
    () => new Map((activeRestockRequests || []).map((request) => [request.stockLevelId, request])),
    [activeRestockRequests],
  );

  const readyRestock = useMemo(
    () =>
      (activeRestockRequests || []).filter(
        (request) =>
          request.status === "APPROVED" || (request.quantityProvided ?? 0) > 0,
      ),
    [activeRestockRequests],
  );

  const shortages = useMemo(() => {
    return (sortedStock || []).filter((entry: StockLevelDto) => entry.targetQuantity > 0 && entry.quantity < entry.targetQuantity);
  }, [sortedStock]);

  // Gesamtmenge aller Artikel berechnen
  const totalQuantity = useMemo(() => {
    return stock.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  }, [stock]);

  // Anzahl unterschiedlicher Artikel (nur Artikel mit Menge > 0)
  const totalArticles = useMemo(() => {
    return stock.filter((entry) => entry.quantity > 0).length;
  }, [stock]);

  if (!vehicleId) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Mein Fahrzeugbestand
        </Typography>
        <Alert severity="info">
          Deinem Benutzer ist kein Fahrzeug zugeordnet. Bitte wende dich an die Leitung oder Benutzerverwaltung.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Sync-Status für Offline-Queue */}
      <SyncStatusIndicator />

      {/* Ein-/Ausbuchen-Modus (immer sichtbar, sticky – unabhaengig davon, ob der native
          Kamera-Scanner oder der Fallback-Scanner im "Bewegungen erfassen"-Bereich genutzt wird) */}
      <Paper
        sx={{
          position: "sticky",
          top: 8,
          zIndex: (theme) => theme.zIndex.appBar + 2,
          mb: 2,
          p: 1.5,
          boxShadow: 3,
        }}
      >
        {isSupported && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Button
              variant={scannerActive && scanPurpose === "booking" ? "outlined" : "contained"}
              color={scannerActive && scanPurpose === "booking" ? "secondary" : "primary"}
              startIcon={<QrCodeScannerIcon />}
              fullWidth
              onClick={() => {
                if (scannerActive && scanPurpose === "booking") {
                  setScannerActive(false);
                } else {
                  setScanPurpose("booking");
                  setScannerActive(true);
                }
              }}
              sx={{ fontWeight: 600 }}
            >
              {scannerActive && scanPurpose === "booking" ? "Scanner stoppen" : "Scanner starten"}
            </Button>
            <Chip
              label={scannerActive ? "Aktiv" : "Inaktiv"}
              color={scannerActive ? "success" : "default"}
              size="small"
            />
          </Box>
        )}
        {isSupported && (
          <Button
            variant={scannerActive && scanPurpose === "check" ? "outlined" : "text"}
            color="info"
            startIcon={<QrCodeScannerIcon />}
            fullWidth
            size="small"
            onClick={() => {
              if (scannerActive && scanPurpose === "check") {
                setScannerActive(false);
              } else {
                setScanPurpose("check");
                setScannerActive(true);
              }
            }}
            sx={{ mb: 1, fontWeight: 600 }}
          >
            {scannerActive && scanPurpose === "check" ? "Bestand-Scanner stoppen" : "Bestand prüfen"}
          </Button>
        )}

        <ToggleButtonGroup
          value={bookingMode}
          exclusive
          fullWidth
          size="small"
          onChange={(_event, value: "CHECKIN" | "CHECKOUT" | null) => {
            if (value) {
              setBookingMode(value);
            }
          }}
        >
          <ToggleButton value="CHECKOUT" color="error">
            Ausbuchen
          </ToggleButton>
          <ToggleButton value="CHECKIN" color="success">
            Einbuchen
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* Stock-Load Fehler */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Scanner Fehler */}
      {scannerError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Kamera-Problem:</strong> {scannerError}
        </Alert>
      )}

      {/* Barcode-Scanner Video - optimiert für Performance */}
      {isSupported && (
        <video 
          ref={videoRef} 
          style={{ 
            width: 1, 
            height: 1, 
            position: "absolute", 
            top: -1000, 
            left: -1000, 
            pointerEvents: "none",
            opacity: 0
          }} 
          muted 
          playsInline 
        />
      )}

      {/* Kurze Bestätigung nach dem Scan (verschwindet automatisch) */}
      <Snackbar
        open={Boolean(scanQuickActionsActive && scanFeedback && scanFeedbackSource === "scan")}
        autoHideDuration={2500}
        onClose={() => setScanQuickActionsActive(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={scanFeedback?.bookedType === "CHECKIN" ? "success" : "info"}
          onClose={() => setScanQuickActionsActive(false)}
          sx={{ width: "100%" }}
        >
          {scanFeedback?.code} {scanFeedback?.bookedType === "CHECKIN" ? "eingebucht (+1)" : "ausgebucht (-1)"}
        </Alert>
      </Snackbar>

      {/* Dialog: Artikel nicht gefunden */}
      <Dialog 
        open={notFoundDialogOpen} 
        onClose={() => setNotFoundDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Artikel nicht gefunden</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Der Artikel mit dem Code <strong>{notFoundCode}</strong> wurde nicht in den Stammdaten gefunden.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Möchten Sie diesen Artikel jetzt in die Stammdaten aufnehmen?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotFoundDialogOpen(false)}>
            Abbrechen
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setNotFoundDialogOpen(false);
              setCreateDraft({
                code: notFoundCode,
                description: "",
                manufacturer: "",
                productGroup: "",
                targetStock: "",
                alternateCodes: "",
              });
              setCreateError(null);
              setCreateDialogOpen(true);
            }}
          >
            Artikel aufnehmen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Bestand prüfen (read-only) */}
      <Dialog
        open={checkStockDialogOpen}
        onClose={() => { setCheckStockDialogOpen(false); setCheckStockResult(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Bestand prüfen</DialogTitle>
        <DialogContent>
          {checkStockResult && (
            <Box>
              <Typography variant="h6" sx={{ mb: 0.5 }}>{checkStockResult.item.code}</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{checkStockResult.item.description}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                {checkStockResult.item.manufacturer} · {checkStockResult.item.productGroup}
              </Typography>
              <Box sx={{
                p: 3,
                borderRadius: 2,
                textAlign: "center",
                bgcolor: checkStockResult.quantity === 0 ? "error.light" : "success.light",
                color: checkStockResult.quantity === 0 ? "error.contrastText" : "success.contrastText",
              }}>
                <Typography variant="h2" sx={{ fontWeight: "bold", lineHeight: 1 }}>
                  {checkStockResult.quantity}
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5, opacity: 0.9 }}>
                  {checkStockResult.quantity === 1 ? "Stück im Fahrzeug" : "Stück im Fahrzeug"}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            fullWidth
            variant="contained"
            onClick={() => { setCheckStockDialogOpen(false); setCheckStockResult(null); }}
          >
            Schließen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog zum Artikel anlegen - identisch zu ItemsPage */}
      <Dialog open={createDialogOpen} onClose={() => { setCreateDialogOpen(false); setScannerActive(true); }} fullWidth maxWidth="sm">
        <DialogTitle>Neuen Artikel anlegen</DialogTitle>
        <Box component="form" onSubmit={handleCreateSubmit} noValidate>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="Artikelcode"
                value={createDraft.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateDraft((d: any) => ({ ...d, code: e.target.value }))}
                required
                autoFocus
                disabled
              />
              <TextField
                label="Beschreibung"
                value={createDraft.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateDraft((d: any) => ({ ...d, description: e.target.value }))}
                required
              />
              <Autocomplete
                freeSolo
                options={Array.from(new Set(items.map((item: any) => item.manufacturer))).filter(Boolean).sort((a: any, b: any) => a.localeCompare(b, "de", { sensitivity: "base" }))}
                value={createDraft.manufacturer}
                onChange={(_: React.SyntheticEvent, value: string | null) => setCreateDraft((d: any) => ({ ...d, manufacturer: value ?? "" }))}
                onInputChange={(_: React.SyntheticEvent, value: string) => setCreateDraft((d: any) => ({ ...d, manufacturer: value }))}
                renderInput={(params: any) => (
                  <TextField {...params} label="Hersteller" required />
                )}
              />
              <Autocomplete
                freeSolo
                options={Array.from(new Set(items.map((item: any) => item.productGroup))).filter(Boolean).sort((a: any, b: any) => a.localeCompare(b, "de", { sensitivity: "base" }))}
                value={createDraft.productGroup}
                onChange={(_: React.SyntheticEvent, value: string | null) => setCreateDraft((d: any) => ({ ...d, productGroup: value ?? "" }))}
                onInputChange={(_: React.SyntheticEvent, value: string) => setCreateDraft((d: any) => ({ ...d, productGroup: value }))}
                renderInput={(params: any) => (
                  <TextField {...params} label="Warengruppe" required />
                )}
              />
              <TextField
                label="Soll-Bestand"
                type="number"
                inputProps={{ min: 0, inputMode: "numeric", pattern: "[0-9]*" }}
                value={createDraft.targetStock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateDraft((d: any) => ({ ...d, targetStock: e.target.value }))}
              />
              <TextField
                label="Weitere Codes"
                helperText="Optional: getrennt durch Komma oder Leerzeichen"
                multiline
                minRows={2}
                value={createDraft.alternateCodes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateDraft((d: any) => ({ ...d, alternateCodes: e.target.value }))}
              />
              {createError && (
                <Alert severity="error" onClose={() => setCreateError(null)}>
                  {createError}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setCreateDialogOpen(false); setScannerActive(true); }}>Abbrechen</Button>
            <Button type="submit" variant="contained">Anlegen</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Scanner Action Dialog für existierende Artikel */}
      <Dialog 
        open={scanActionDialogOpen} 
        onClose={() => { 
          setScanActionDialogOpen(false); 
          setScannerActive(true);
          // States zurücksetzen
          setScanActionQuantity(1);
          setScanActionTargetQuantity(null);
          setScanActionShowTargetInput(false);
        }} 
        fullWidth
        maxWidth="sm"
        disableScrollLock={false}
        sx={{
          position: 'fixed',
          zIndex: 1300,
          '& .MuiBackdrop-root': {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          '& .MuiDialog-container': {
            position: 'fixed !important',
            top: '0 !important',
            left: '0 !important',
            right: '0 !important',
            bottom: '0 !important',
            display: 'flex !important',
            alignItems: 'center !important',
            justifyContent: 'center !important',
            overflow: 'hidden !important',
          },
          '& .MuiDialog-paper': {
            position: 'relative !important',
            margin: '16px !important',
            maxHeight: 'calc(100vh - 32px) !important',
            overflowY: 'auto',
          }
        }}
      >
        <DialogTitle>Gescannter Artikel</DialogTitle>
        <DialogContent dividers>
          {scannedItem && (() => {
            console.log('[ScanDialog v0.3.6 DEV] scannedItem:', scannedItem);
            console.log('[ScanDialog v0.3.6 DEV] stock array:', stock);
            console.log('[ScanDialog v0.3.6 DEV] Suche nach ID:', scannedItem.id);
            
            const stockEntry = stock.find(s => {
              console.log('[ScanDialog v0.3.6 DEV] Vergleiche:', s.item.id, 'mit', scannedItem.id, '=', s.item.id === scannedItem.id);
              return s.item.id === scannedItem.id;
            });
            
            console.log('[ScanDialog v0.3.6 DEV] RESULT stockEntry:', stockEntry);
            const restockRequest = readyRestock.find((r: any) => r.item.id === scannedItem.id);
            
            return (
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {scannedItem.code}
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {scannedItem.description}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {scannedItem.manufacturer}  {scannedItem.productGroup}
                </Typography>
                
                {stockEntry && (
                  <Box sx={{ 
                    mb: 2, 
                    p: 2, 
                    borderRadius: 1, 
                    bgcolor: stockEntry.quantity === 0 ? 'error.light' : (stockEntry.quantity < stockEntry.targetQuantity && stockEntry.targetQuantity > 0) ? 'warning.light' : 'success.light',
                    color: stockEntry.quantity === 0 ? 'error.contrastText' : (stockEntry.quantity < stockEntry.targetQuantity && stockEntry.targetQuantity > 0) ? 'warning.contrastText' : 'success.contrastText'
                  }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                      Verfügbar: {stockEntry.quantity} Stück
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Soll-Bestand: {stockEntry.targetQuantity}
                      {stockEntry.quantity < stockEntry.targetQuantity && (
                        <>  <strong>Fehlt: {stockEntry.targetQuantity - stockEntry.quantity}</strong></>
                      )}
                    </Typography>
                  </Box>
                )}
                
                {!stockEntry && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Dieser Artikel ist noch nicht auf deinem Fahrzeug vorhanden.
                  </Alert>
                )}

                {restockRequest && (restockRequest.quantityProvided ?? 0) > 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>Vom Lager bereitgestellt:</strong> {restockRequest.quantityProvided} Stück
                  </Alert>
                )}

                {/* Soll-Bestand Input: Nur wenn kein Target oder Target = 0 */}
                {(!stockEntry || stockEntry.targetQuantity === 0) && !scanActionShowTargetInput && (
                  <Button
                    fullWidth
                    variant="text"
                    size="small"
                    onClick={() => setScanActionShowTargetInput(true)}
                    sx={{ mb: 1 }}
                  >
                    Soll-Bestand setzen
                  </Button>
                )}

                {(!stockEntry || stockEntry.targetQuantity === 0) && scanActionShowTargetInput && (
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      label="Soll-Bestand"
                      type="number"
                      inputProps={{ min: "0", step: "1" }}
                      value={scanActionTargetQuantity === null ? '' : scanActionTargetQuantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setScanActionTargetQuantity(val === '' ? null : parseInt(val) || null);
                      }}
                      fullWidth
                      size="small"
                      placeholder="Soll-Bestand eingeben"
                    />
                  </Box>
                )}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2 }}>


          {/* Ein-/Ausbuchen Buttons mit dynamischer Menge */}
          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={() => {
                if (scannedItem) {
                  handleMovement("CHECKOUT", scannedItem.id, 1);
                  // Dialog bleibt offen für weitere Buchungen
                }
              }}
              disabled={isProcessing}
            >
              -1 Ausbuchen
            </Button>
            <Button
              fullWidth
              variant="outlined"
              color="success"
              onClick={() => {
                if (scannedItem) {
                  const stockEntry = stock.find(s => s.item.id === scannedItem.id);
                  // Wenn Sollwert eingegeben wurde, erst Target setzen
                  if (scanActionTargetQuantity !== null && vehicleId) {
                    updateVehicleTarget(vehicleId, {
                      itemId: scannedItem.id,
                      targetQuantity: scanActionTargetQuantity
                    }).then(() => {
                      handleMovement("CHECKIN", scannedItem.id, 1);
                    });
                  } else {
                    handleMovement("CHECKIN", scannedItem.id, 1);
                  }
                  // Dialog bleibt offen für weitere Buchungen
                  // Sollwert bleibt erhalten falls gesetzt
                }
              }}
              disabled={isProcessing}
            >
              +1 Einbuchen
            </Button>
          </Box>

          {/* Nur Lagererhalt-Button für bereitgestellte Menge */}
          {scannedItem && (() => {
            const restockRequest = readyRestock.find((r: any) => r.item.id === scannedItem.id);
            return restockRequest && (restockRequest.quantityProvided ?? 0) > 0 ? (
              <Button
                fullWidth
                variant="contained"
                color="primary"
                sx={{ mt: 1 }}
                onClick={() => {
                  handleCheckinProvidedQuantity(scannedItem.id, restockRequest.id, restockRequest.quantityProvided ?? 0);
                  // Dialog bleibt offen
                }}
                disabled={isProcessing}
              >
                +{restockRequest.quantityProvided} Lagererhalt (bereitgestellt)
              </Button>
            ) : null;
          })()}

          <Button 
            fullWidth 
            variant="contained"
            onClick={() => { 
              setScanActionDialogOpen(false); 
              setScannerActive(true);
              setScanActionQuantity(1);
              setScanActionTargetQuantity(null);
              setScanActionShowTargetInput(false);
              // Bestand neu laden statt Seite reload (offline-freundlich)
              void loadStock();
            }}
          >
            Fertig
          </Button>
        </DialogActions>
      </Dialog>

      
      <Typography variant="h5" sx={{ mb: 2 }}>
        Mein Fahrzeugbestand {vehicleData?.licensePlate ? `- ${vehicleData.licensePlate}` : ''}
      </Typography>

      {/* QR-Katalog Download */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          onClick={handleDownloadQrCatalog}
          disabled={downloadingQr}
          sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
        >
          {downloadingQr ? 'Erstelle…' : 'QR-Katalog (PDF)'}
        </Button>
      </Box>

      {/* Suchfeld für Wagenbestand */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Im Wagenbestand suchen (Code, Bezeichnung, Hersteller, Warengruppe)..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchQuery && (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={() => setSearchQuery("")}
                edge="end"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {shortages.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Dir fehlen {shortages.reduce((sum: number, entry: any) => sum + (entry.targetQuantity - entry.quantity), 0)} Teile bei {shortages.length} Artikeln.
        </Alert>
      )}

      {readyRestock.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {readyRestock.length === 1
            ? "Ein Teil liegt im Lager bereit."
            : `${readyRestock.length} Teile liegen im Lager bereit.`}
        </Alert>
      )}

      {targetError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTargetError(null)}>
          {targetError}
        </Alert>
      )}

      {/* Suchhinweis: Keine Ergebnisse */}
      {searchQuery && filteredStock.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Keine Artikel im Wagenbestand gefunden für "{searchQuery}". 
          {stock.length > 0 && (
            <> Versuche eine andere Suche oder lösche den Suchbegriff, um alle {stock.length} Artikel anzuzeigen.</>
          )}
        </Alert>
      )}

      {/* Suchergebnis-Anzeige */}
      {searchQuery && filteredStock.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {filteredStock.length} {filteredStock.length === 1 ? 'Artikel gefunden' : 'Artikel gefunden'} im Wagenbestand.
        </Alert>
      )}

      <VehicleMovementPanel
        items={movementItems}
        isProcessing={isProcessing}
        onMovement={handleMovement}
        onReceiveProvided={async (itemId, quantity) => {
          const request = (activeRestockRequests || []).find(
            (entry: any) =>
              entry.item.id === itemId
              && entry.status === "APPROVED"
              && (entry.quantityProvided ?? 0) > 0,
          );
          if (!request) {
            setError("Keine bereitgestellte Menge für diesen Artikel gefunden.");
            return;
          }
          await handleCheckinProvidedQuantity(itemId, request.id, quantity);
        }}
        externalError={error}
        onClearError={() => setError(null)}
        onItemNotFound={(code) => {
          setNotFoundCode(code);
          setNotFoundDialogOpen(true);
        }}
        onItemScanned={updateScanFeedback}
        scanFeedback={scanQuickActionsActive && scanFeedbackSource === "manual" ? scanFeedback : null}
        onSetTargetForMissingItem={handleSetScanTarget}
        scanTargetSaving={scanTargetSaving}
        hideActionButtons={false}
        onManualInput={handleManualInput}
        restockRequests={activeRestockRequests.map(r => {
          const fullItem = items.find((i: any) => i.id === r.item.id);
          const item = fullItem ?? { ...r.item, targetStock: 0, alternateCodes: [] };
          return {
            item,
            status: r.status,
            quantityNeeded: r.quantityNeeded,
            quantityProvided: r.quantityProvided,
            preparedBy: r.preparedBy,
          };
        })}
      />

      {/* Mobile Card-Ansicht für kleine Bildschirme */}
      <Box sx={{ 
        display: { xs: 'block', sm: 'block', md: 'none' },
        '@media (max-width: 1024px)': { display: 'block' },
        '@media (min-width: 1025px)': { display: 'none' }
      }}>
        {isLoading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={24} />
          </Box>
        )}
        <Stack spacing={2}>
          {displayStock.map((entry: any) => {
            const shortage = Math.max(0, entry.targetQuantity - entry.quantity);
            const restockRequest = restockMap.get(entry.id) ?? null;
            const draftValue = targetDrafts[entry.item.id] ?? entry.targetQuantity.toString();
            const isSaving = savingTarget === entry.item.id;
            const cardBorder = restockRequest?.status === "APPROVED"
              ? "2px solid #1976d2"
              : shortage > 0
              ? "2px solid #d32f2f"
              : "1px solid rgba(0, 0, 0, 0.12)";

            return (
              <Paper 
                key={entry.id} 
                sx={{ 
                  p: 2, 
                  border: cardBorder,
                  backgroundColor: restockRequest?.status === "APPROVED"
                    ? "rgba(25, 118, 210, 0.03)"
                    : shortage > 0
                    ? "rgba(229, 57, 53, 0.03)"
                    : "background.paper"
                }}
              >
                <Stack spacing={2}>
                  {/* Header: Code und Bezeichnung */}
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                        {entry.item.code}
                      </Typography>
                      <Typography variant="body2" color="text.primary" sx={{ mt: 0.5 }}>
                        {entry.item.description}
                        {entry.item.descriptionSecondary && (
                          <Typography variant="body2" color="text.secondary">
                            {entry.item.descriptionSecondary}
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.item.manufacturer || "-"} • {entry.item.productGroup || "-"}
                      </Typography>
                    </Box>
                    {entry.item.imagePath && (
                      <Box
                        component="img"
                        src={getItemImageUrl(entry.item.id)}
                        alt=""
                        onClick={() => setLightboxItemId(entry.item.id)}
                        sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1, cursor: 'zoom-in', flexShrink: 0 }}
                      />
                    )}
                  </Box>

                  {/* Bestands-Informationen */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Bestand</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: shortage > 0 ? 'error.main' : 'text.primary' }}>
                          {entry.quantity}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Soll</Typography>
                        <TextField
                          type="number"
                          inputProps={{ 
                            min: 0, 
                            inputMode: "numeric", 
                            pattern: "[0-9]*",
                            style: { textAlign: 'center', fontWeight: 'bold', fontSize: '1.25rem' }
                          }}
                          value={draftValue}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleTargetChange(entry.item.id, event.target.value)}
                          onBlur={() => handleTargetBlur(entry.item.id)}
                          onKeyDown={(event) => handleTargetKeyDown(event, entry.item.id)}
                          size="small"
                          sx={{ width: 70 }}
                          disabled={isSaving || isLoading}
                          InputProps={
                            isSaving
                              ? {
                                  endAdornment: (
                                    <InputAdornment position="end">
                                      <CircularProgress size={16} />
                                    </InputAdornment>
                                  ),
                                }
                              : undefined
                          }
                        />
                      </Box>
                      {shortage > 0 && (
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Fehlt</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                            {shortage}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Status-Chip */}
                  {restockRequest && (
                    <Box>
                      <Chip
                        size="small"
                        color={restockStatusColorMap[restockRequest.status]}
                        label={restockStatusLabelMap[restockRequest.status]}
                      />
                      {restockRequest.status === "APPROVED" && restockRequest.preparedBy && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          Bereit durch {restockRequest.preparedBy.displayName}
                        </Typography>
                      )}
                    </Box>
                  )}

                                    {/* Schnelle Aktionen: Aus-/Einbuchen + Entfernen */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, gap: 1 }}>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="1 Stück ausbuchen">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleMovement("CHECKOUT", entry.item.id, 1)}
                            disabled={isProcessing || entry.quantity <= 0}
                            sx={{ 
                              backgroundColor: 'rgba(211, 47, 47, 0.08)',
                              '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.16)' }
                            }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="1 Stück einbuchen">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleMovement("CHECKIN", entry.item.id, 1)}
                          disabled={isProcessing}
                          sx={{ 
                            backgroundColor: 'rgba(46, 125, 50, 0.08)',
                            '&:hover': { backgroundColor: 'rgba(46, 125, 50, 0.16)' }
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Tooltip title="Artikel aus Fahrzeug entfernen">
                      <IconButton
                        color="warning"
                        onClick={() => setDeleteTarget(entry.item.id)}
                        disabled={isProcessing}
                        sx={{ 
                          backgroundColor: 'rgba(255, 152, 0, 0.12)',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 152, 0, 0.2)',
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
        {filteredStock.length === 0 && !isLoading && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Keine passenden Bestände gefunden.
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Desktop Tabellen-Ansicht für große Bildschirme */}
      <Paper sx={{ 
        backgroundColor: "background.paper", 
        display: { xs: 'none', sm: 'none', md: 'block' },
        '@media (max-width: 1024px)': { display: 'none' },
        '@media (min-width: 1025px)': { display: 'block' }
      }}>
        <TableContainer sx={{ maxHeight: { md: 600 } }}>
          <Table size="small" stickyHeader={displayStock.length > 10}>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Bezeichnung</TableCell>
                <TableCell align="right">Bestand</TableCell>
                <TableCell align="right">Soll</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Fehlt</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {displayStock.map((entry) => {
                const shortage = Math.max(0, entry.targetQuantity - entry.quantity);
                const restockRequest = restockMap.get(entry.id) ?? null;
                const draftValue = targetDrafts[entry.item.id] ?? entry.targetQuantity.toString();
                const isSaving = savingTarget === entry.item.id;
                const rowHighlight = restockRequest?.status === "APPROVED"
                  ? "rgba(25, 118, 210, 0.08)"
                  : shortage > 0
                  ? "rgba(229, 57, 53, 0.08)"
                  : undefined;

                return (
                  <TableRow key={entry.id} hover sx={{ backgroundColor: rowHighlight }}>
                    <TableCell>{entry.item.code}</TableCell>
                    <TableCell>
                      {entry.item.description}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {entry.item.manufacturer || "-"} - {entry.item.productGroup || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{entry.quantity}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        inputProps={{ min: 0, inputMode: "numeric", pattern: "[0-9]*" }}
                        value={draftValue}
                        onChange={(event) => handleTargetChange(entry.item.id, event.target.value)}
                        onBlur={() => handleTargetBlur(entry.item.id)}
                        onKeyDown={(event) => handleTargetKeyDown(event, entry.item.id)}
                        size="small"
                        sx={{ width: 96 }}
                        disabled={isSaving || isLoading}
                        InputProps={
                          isSaving
                            ? {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <CircularProgress size={16} />
                                  </InputAdornment>
                                ),
                              }
                            : undefined
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {restockRequest ? (
                        <Stack spacing={0.5} alignItems="flex-start">
                          <Chip
                            size="small"
                            color={restockStatusColorMap[restockRequest.status]}
                            label={restockStatusLabelMap[restockRequest.status]}
                          />
                          {restockRequest.status === "APPROVED" && restockRequest.preparedBy && (
                            <Typography variant="caption" color="text.secondary">
                              Bereit durch {restockRequest.preparedBy.displayName}
                            </Typography>
                          )}
                        </Stack>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell align="right">{shortage > 0 ? shortage : "-"}</TableCell>
                    <TableCell align="right">
                      {/* Spezielle Aktion für bereitgestellte Mengen bleibt sichtbar */}
                      {restockRequest?.status === "APPROVED" && (restockRequest.quantityProvided ?? 0) > 0 && (
                        <Tooltip title={`${restockRequest.quantityProvided} vom Lager bereitgestellte Menge einbuchen`}>
                          <Button
                            size="small"
                            variant="contained"
                            color="info"
                            sx={{ mr: 1, mb: 0.5 }}
                            onClick={() => handleCheckinProvidedQuantity(entry.item.id, restockRequest.id, restockRequest.quantityProvided ?? 0)}
                            disabled={isProcessing}
                          >
                            +{restockRequest.quantityProvided ?? 0} vom Lager
                          </Button>
                        </Tooltip>
                      )}

                      {/* Inline Ein-/Ausbuchen + Entfernen immer sichtbar */}
                      <Tooltip title="1 Stück ausbuchen">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleMovement("CHECKOUT", entry.item.id, 1)}
                            disabled={isProcessing || entry.quantity <= 0}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="1 Stück einbuchen">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleMovement("CHECKIN", entry.item.id, 1)}
                          disabled={isProcessing}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Artikel aus Fahrzeug entfernen">
                        <span>
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => setDeleteTarget(entry.item.id)}
                            disabled={isProcessing}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredStock.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    Keine passenden Bestände gefunden.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dezente Mengenanzeige am Ende */}
      <Box sx={{ mt: 2, p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          Insgesamt <strong>{totalArticles}</strong> verschiedene Artikel
        </Typography>
      </Box>

      {/* Delete Dialog - shared by both mobile and desktop */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Artikel aus Fahrzeug entfernen</DialogTitle>
        <DialogContent>
          {(() => {
            const entry = stock.find(s => s.item.id === deleteTarget);
            const qty = entry?.quantity ?? 0;
            const target = entry?.targetQuantity ?? 0;
            const itemCode = entry?.item?.code || "Artikel";
            return (
              <Box>
                <Typography sx={{ mb: 2 }}>
                  <strong>{itemCode}</strong><br/>
                  Ist-Bestand: {qty}<br/>
                  Soll-Bestand: {target}
                </Typography>
                <Typography sx={{ mb: 2 }}>
                  Wie möchtest du vorgehen?
                </Typography>
                {qty > 0 && (
                  <Typography variant="body2" sx={{ color: 'warning.main', mb: 1 }}>
                    Noch {qty} Stück im Fahrzeug vorhanden
                  </Typography>
                )}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} fullWidth>
            Abbrechen
          </Button>
          
          {(() => {
            const entry = stock.find(s => s.item.id === deleteTarget);
            const qty = entry?.quantity ?? 0;
            
            return (
              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                {qty > 0 && (
                  <Button 
                    color="warning" 
                    variant="outlined" 
                    fullWidth
                    onClick={async () => {
                      if (deleteTarget && vehicleId) {
                        try {
                          if (isOnline) {
                            await recordMovement({
                              itemId: deleteTarget,
                              vehicleId,
                              userId: user?.id ?? undefined,
                              type: "CHECKOUT",
                              quantity: qty,
                              occurredAt: new Date().toISOString(),
                              source: "checkout-only",
                            });
                            await loadStock();
                          } else {
                            const currentItem = items.find((item: any) => item.id === deleteTarget);
                            if (currentItem) {
                              await enqueueMovement({
                                itemId: deleteTarget,
                                code: currentItem.code,
                                type: "CHECKOUT",
                                quantity: qty,
                                timestamp: new Date().toISOString(),
                                source: "checkout-only",
                                vehicleId,
                                userId: user?.id,
                              });
                              await loadStock();
                            }
                          }
                          setError(null);
                          setDeleteTarget(null);
                        } catch (err: any) {
                          setError("Fehler beim Ausbuchen: " + (err?.response?.data?.message || err.message));
                        }
                      }
                    }}
                  >
                    Nur ausbuchen
                  </Button>
                )}
                
                <Button 
                  color="error" 
                  variant="contained" 
                  fullWidth
                  onClick={async () => {
                    if (deleteTarget && vehicleId) {
                      try {
                        if (isOnline) {
                          const entry = stock.find(s => s.item.id === deleteTarget);
                          const currentQty = entry?.quantity ?? 0;
                          // 1. Falls Bestand > 0, alles ausbuchen
                          if (currentQty > 0) {
                            await recordMovement({
                              itemId: deleteTarget,
                              vehicleId,
                              userId: user?.id ?? undefined,
                              type: "CHECKOUT",
                              quantity: currentQty,
                              occurredAt: new Date().toISOString(),
                              source: "remove-complete",
                            });
                          }
                          // 2. Danach wirklich löschen (auch wenn currentQty = 0)
                          await removeVehicleStock(vehicleId, deleteTarget);
                          // 3. Stock neu laden und Dialog schließen
                          await loadStock();
                          await loadRestock(vehicleId);
                          setError(null);
                          setDeleteTarget(null);
                        } else {
                          // Offline: Fallback wie bisher (nur ausbuchen und Ziel auf 0)
                          const entry = stock.find(s => s.item.id === deleteTarget);
                          const currentQty = entry?.quantity ?? 0;
                          const currentItem = items.find((item: any) => item.id === deleteTarget);
                          if (currentItem) {
                            if (currentQty > 0) {
                              await enqueueMovement({
                                itemId: deleteTarget,
                                code: currentItem.code,
                                type: "CHECKOUT",
                                quantity: currentQty,
                                timestamp: new Date().toISOString(),
                                source: "remove-complete",
                                vehicleId,
                                userId: user?.id,
                              });
                            }
                            setError("Offline: Komplette Entfernung vorgemerkt. Bitte später synchronisieren.");
                            await loadStock();
                            setDeleteTarget(null);
                          } else {
                            setError("Artikel konnte offline nicht entfernt werden (Code nicht gefunden).");
                          }
                        }
                      } catch (err: any) {
                        console.error("[RemoveItem] Fehler:", err);
                        setError("Fehler beim kompletten Entfernen: " + (err?.message || err));
                        // Dialog NICHT schließen bei Fehler, damit User Fehler sieht
                      }
                    }
                  }}
                >
                  Komplett entfernen
                </Button>
              </Box>
            );
          })()}
        </DialogActions>
      </Dialog>

      {/* Bild-Lightbox */}
      <Dialog
        open={lightboxItemId !== null}
        onClose={() => setLightboxItemId(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent
          sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#000', minHeight: 200 }}
          onClick={() => setLightboxItemId(null)}
        >
          {lightboxItemId && (
            <Box
              component="img"
              src={getItemImageUrl(lightboxItemId)}
              alt=""
              sx={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Action entfernt zugunsten des sticky Headers */}
    </Box>
  );
};

export default MyVehiclePage;











