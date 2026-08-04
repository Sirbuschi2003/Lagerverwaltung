import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  GetApp as ExportIcon,
  TableChart as TableChartIcon,
  PlayArrow as StartIcon,
  Stop as CompleteIcon,
  Sync as SyncIcon,
  PictureAsPdf as PdfIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";
import { ScannerButton } from "../components/ScannerButton";
import { findItemByCode } from "../utils/itemLookup";
import useScanSound from "../hooks/useScanSound";
import useAuthStore from "../store/useAuthStore";
import useItemsStore from "../store/useItemsStore";
import useVehiclesStore from "../store/useVehiclesStore";
import useUsersStore from "../store/useUsersStore";
import {
  fetchInventorySessions,
  fetchInventorySessionDetail,
  startInventorySession,
  recordInventoryLine,
  completeInventorySession,
  exportInventorySession,
  exportInventoryProtocol,
  deleteInventoryLine,
  deleteInventorySession,
  fetchVehicleStock,
  fetchLocationStock,
  submitInventorySession,
  reopenInventorySession,
  reopenInventoryVehicle,
  finalizeInventorySession,
  fetchInventoryDifferences,
  fetchInventoryVehicleStatuses,
  type InventorySessionDto,
  type InventoryLineDto,
  type InventorySessionStatus,
  type InventoryDifferenceDto,
  type StockLevelDto,
  type VehicleStatusDto,
} from "../utils/api";

const InventoryPage = () => {
  const user = useAuthStore((state: any) => state.user);
  const { items, loadItems, forceLoadItems } = useItemsStore();
  const { vehicles, loadVehicles } = useVehiclesStore();
  const { users, loadUsers } = useUsersStore();
  
  const [sessions, setSessions] = useState<InventorySessionDto[]>([]);
  const [activeSession, setActiveSession] = useState<InventorySessionDto | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleStock, setVehicleStock] = useState<any[]>([]);
  const [locationStock, setLocationStock] = useState<any[]>([]);
  const [vehicleStatuses, setVehicleStatuses] = useState<any[]>([]);
  const [currentVehicleSubmitted, setCurrentVehicleSubmitted] = useState(false);
  
  // Dialog states
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionLocation, setNewSessionLocation] = useState("");
  const [newSessionAssignedUserIds, setNewSessionAssignedUserIds] = useState<string[]>([]);
  
  // Inventory recording
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [countedQuantity, setCountedQuantity] = useState<string>("");
  const [expectedQuantity, setExpectedQuantity] = useState<string>("");
  const [note, setNote] = useState("");
  const [manualCode, setManualCode] = useState("");
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const canManageInventory = hasPermission("inventory.manage");
  const canExportInventory = hasPermission("stock.read");
  const isTechnician = user?.role === "TECHNICIAN";
  const canManageInventoryNonTech = canManageInventory && !isTechnician;
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down("sm"));

  const { playSuccess, playError } = useScanSound();

  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [quantityInput, setQuantityInput] = useState("");
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<any>(null);
  const [pendingExpected, setPendingExpected] = useState<number | null>(null);
  const [alreadyScannedLine, setAlreadyScannedLine] = useState<any>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [exportVehicleFilters, setExportVehicleFilters] = useState<Record<string, string | null>>({});
  
  // Edit-Dialog für bereits erfasste Positionen
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<any>(null);
  const [editQuantity, setEditQuantity] = useState("");
  
  // Delete-Confirmation Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<InventorySessionDto | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Finalize preview dialog
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalizeTargetSession, setFinalizeTargetSession] = useState<InventorySessionDto | null>(null);
  const [differencesPreview, setDifferencesPreview] = useState<InventoryDifferenceDto[]>([]);
  const [differencesTotals, setDifferencesTotals] = useState({
    count: 0,
    deltaSum: 0,
    positiveDeltaSum: 0,
    negativeDeltaSum: 0,
  });
  const [differencesLoading, setDifferencesLoading] = useState(false);

  const defaultVehicle = useMemo(() => {
    if (!user?.vehicleId) {
      return null;
    }
    return vehicles.find((vehicle: any) => vehicle.id === user.vehicleId) || null;
  }, [vehicles, user?.vehicleId]);

  const normalizeSessionStatus = useCallback(
    (status?: string | null): InventorySessionStatus => {
      const upper = (status || "").toString().toUpperCase();
      if (upper === "DRAFT" || upper === "SUBMITTED" || upper === "FINALIZED" || upper === "CANCELLED") {
        return upper as InventorySessionStatus;
      }
      return "DRAFT";
    },
    [],
  );


  useEffect(() => {
    if (!selectedVehicle && defaultVehicle) {
      setSelectedVehicle(defaultVehicle);
    }
    // Prüfe Offline-Inventur beim Laden
    const offlineLines = JSON.parse(localStorage.getItem('offlineInventoryLines') || '[]');
    setOfflineCount(offlineLines.length);
    
    if (offlineLines.length > 0) {
      console.log(`[InventoryPage] Found ${offlineLines.length} offline inventory lines on startup`);
    }
  }, [selectedVehicle, defaultVehicle]);

  const resolveExpectedQuantity = useCallback((item: any) => {
    if (!item) return 0;

    // Fahrzeug-Inventur: Bestand aus vehicleStock
    const vehicleEntry = vehicleStock.find((s: StockLevelDto) => s.item.id === item.id);
    if (vehicleEntry && Number.isFinite(vehicleEntry.quantity) && vehicleEntry.quantity >= 0) {
      return vehicleEntry.quantity;
    }

    // Lager-Inventur (kein Fahrzeug): Bestand aus locationStock (aggregiert über alle Lagerorte)
    const locationTotal = locationStock
      .filter((s: StockLevelDto) => s.item.id === item.id)
      .reduce((sum: number, s: StockLevelDto) => sum + (s.quantity ?? 0), 0);
    if (locationStock.some((s: StockLevelDto) => s.item.id === item.id)) {
      return locationTotal;
    }

    return 0;
  }, [vehicleStock, locationStock]);

  // Synchronisiere Offline-Inventur-Positionen
  const syncOfflineInventoryLines = async () => {
    const offlineLines = JSON.parse(localStorage.getItem('offlineInventoryLines') || '[]');
    if (offlineLines.length === 0) return;

    console.log(`[InventoryPage] Synchronizing ${offlineLines.length} offline inventory lines...`);
    
    let successCount = 0;
    const errors = [];

    for (const line of offlineLines) {
      try {
        const requestData = {
          sessionId: line.sessionId,
          itemId: line.itemId,
          vehicleId: line.vehicleId,
          countedQuantity: line.countedQuantity,
          expectedQuantity: line.expectedQuantity,
          note: line.note,
        };
        
        await recordInventoryLine(requestData);
        successCount++;
      } catch (err) {
        console.error('[InventoryPage] Failed to sync offline line:', err);
        errors.push(line);
      }
    }

    // Entferne erfolgreich synchronisierte Einträge
    const remainingLines = errors;
    localStorage.setItem('offlineInventoryLines', JSON.stringify(remainingLines));
    setOfflineCount(remainingLines.length);
    
    if (successCount > 0) {
      console.log(`[InventoryPage] Successfully synced ${successCount} offline lines`);
      await loadSessions(); // Aktualisiere UI
      setError(`${successCount} Position(en) erfolgreich synchronisiert.`);
      setTimeout(() => setError(null), 3000);
    } else if (errors.length > 0) {
      console.log(`[InventoryPage] Sync failed: Backend still has issues (HTTP 500)`);
      setError(`Synchronisation fehlgeschlagen - Backend wird repariert. ${errors.length} Position(en) bleiben offline gespeichert.`);
      setTimeout(() => setError(null), 8000);
    }
    
    return { synced: successCount, failed: errors.length };
  };

  const selectItemForEntry = useCallback(
    (item: any | null) => {
      if (!item) {
        setSelectedItem(null);
        setExpectedQuantity("");
        return 0;
      }

      setSelectedItem(item);

      if (!selectedVehicle && defaultVehicle) {
        setSelectedVehicle(defaultVehicle);
      }

      const expected = resolveExpectedQuantity(item);
      setExpectedQuantity(String(expected));
      return expected;
    },
    [defaultVehicle, resolveExpectedQuantity, selectedVehicle],
  );

  const openQuantityDialogForItem = useCallback(
    (item: any) => {
      const expected = selectItemForEntry(item);
      setPendingItem(item);
      setPendingExpected(expected);
      setQuantityInput("");
      setQuantityError(null);

      // Prüfe ob Artikel bereits in dieser Session erfasst wurde
      const vehicle = selectedVehicle ?? defaultVehicle;
      const existing = activeSession?.lines?.find(
        (line: any) =>
          line.item?.id === item.id &&
          (line.vehicle?.id || null) === (vehicle?.id || null),
      ) ?? null;
      setAlreadyScannedLine(existing);

      setQuantityDialogOpen(true);
      return expected;
    },
    [selectItemForEntry, activeSession, selectedVehicle, defaultVehicle],
  );

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchInventorySessions();
      const normalized = data.map((session: any) => ({
        ...session,
        status: normalizeSessionStatus(session.status),
      }));
      setSessions(normalized);
      
      // Wähle die jüngste Session, die noch nicht finalisiert ist (inkl. CANCELLED zum Reaktivieren)
      const active = normalized.find(
        (session: any) =>
          session.status === 'DRAFT' || session.status === 'SUBMITTED' || session.status === 'CANCELLED',
      );

      if (active) {
        // Die Listenansicht liefert nur linesCount, keine vollen Zeilen (Performance).
        // Für die aktive Session brauchen wir die vollen Zeilen (Positionsliste, Dubletten-Check).
        try {
          const detail = await fetchInventorySessionDetail(active.id);
          setActiveSession({ ...detail, status: normalizeSessionStatus(detail.status) });
        } catch (detailErr) {
          console.error('[InventoryPage] Fehler beim Laden der Session-Details:', detailErr);
          setActiveSession(active);
        }
      } else {
        setActiveSession(null);
      }

      setError(null);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Laden der Inventur-Sitzungen.");
    } finally {
      setLoading(false);
    }
  }, [normalizeSessionStatus]);

  const loadVehicleStatusesForSession = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const result = await fetchInventoryVehicleStatuses(sessionId);
      setVehicleStatuses(result);
      
      console.log('[InventoryPage] Vehicle Statuses geladen:', result);
      console.log('[InventoryPage] isTechnician:', isTechnician);
      console.log('[InventoryPage] defaultVehicle:', defaultVehicle);
      
      // Prüfe ob das aktuelle Fahrzeug des Technikers eingereicht wurde
      if (isTechnician && defaultVehicle) {
        const myVehicleStatus = result.find((vs: any) => vs.vehicleId === defaultVehicle.id);
        console.log('[InventoryPage] Mein Fahrzeug-Status:', myVehicleStatus);
        const isSubmitted = myVehicleStatus?.status === 'SUBMITTED';
        console.log('[InventoryPage] currentVehicleSubmitted wird gesetzt auf:', isSubmitted);
        setCurrentVehicleSubmitted(isSubmitted);
      } else {
        setCurrentVehicleSubmitted(false);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Fahrzeug-Status:", err);
      setVehicleStatuses([]);
      setCurrentVehicleSubmitted(false);
    }
  }, [isTechnician, defaultVehicle]);

  const loadVehicleStock = useCallback(async (vehicleId: string) => {
    try {
      const stock = await fetchVehicleStock(vehicleId);
      setVehicleStock(stock);
    } catch (err) {
      console.error('Fehler beim Laden der Fahrzeugbestände:', err);
      setVehicleStock([]);
    }
  }, []);

  const loadLocationStock = useCallback(async () => {
    try {
      const stock = await fetchLocationStock();
      setLocationStock(stock);
    } catch (err) {
      console.error('Fehler beim Laden der Lagerbestände:', err);
      setLocationStock([]);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    if (items.length < 1000) void forceLoadItems({ limit: 200000 });
    if (vehicles.length === 0) void loadVehicles();
    if (users.length === 0) void loadUsers();
  }, [loadSessions, forceLoadItems, loadVehicles, loadUsers, items.length, vehicles.length, users.length]);

  useEffect(() => {
    if (selectedVehicle?.id) {
      loadVehicleStock(selectedVehicle.id);
    } else {
      // Lager-Inventur ohne Fahrzeug: Lagerort-Bestände laden
      void loadLocationStock();
    }
  }, [selectedVehicle?.id, loadVehicleStock, loadLocationStock]);

  useEffect(() => {
    if (activeSession?.id) {
      void loadVehicleStatusesForSession(activeSession.id);
    } else {
      setVehicleStatuses([]);
    }
  }, [activeSession?.id, loadVehicleStatusesForSession]);

  const sortedLines = useMemo(() => {
    if (!activeSession?.lines) return [];

    const filteredLines =
      isTechnician && defaultVehicle
        ? activeSession.lines.filter(
            (line: InventoryLineDto) => line.vehicle?.id === defaultVehicle.id,
          )
        : activeSession.lines;

    return [...filteredLines].sort((a, b) => {
      const manufacturerCompare = (a.item?.manufacturer || "").localeCompare(
        b.item?.manufacturer || "",
        "de",
        { sensitivity: "base" },
      );
      if (manufacturerCompare !== 0) {
        return manufacturerCompare;
      }

      const productGroupCompare = (a.item?.productGroup || "").localeCompare(
        b.item?.productGroup || "",
        "de",
        { sensitivity: "base" },
      );
      if (productGroupCompare !== 0) {
        return productGroupCompare;
      }

      return (a.item?.code || "").localeCompare(b.item?.code || "", "de", {
        sensitivity: "base",
      });
    });
  }, [activeSession?.lines, defaultVehicle?.id, isTechnician]);

  const usingVehicle = selectedVehicle ?? defaultVehicle;

  const totalExpectedCount = useMemo(() => {
    const stock = usingVehicle ? vehicleStock : locationStock;
    const uniqueIds = new Set(stock.filter((s: any) => s.quantity > 0).map((s: any) => s.item?.id));
    return uniqueIds.size;
  }, [usingVehicle, vehicleStock, locationStock]);

  const missingItems = useMemo(() => {
    const stock = usingVehicle ? vehicleStock : locationStock;
    const scannedIds = new Set(sortedLines.map((l: any) => l.item?.id));
    return stock.filter((s: any) => s.quantity > 0 && !scannedIds.has(s.item?.id));
  }, [usingVehicle, vehicleStock, locationStock, sortedLines]);

  const renderDifferenceChip = (difference: number) => (
    <Chip
      label={difference}
      color={difference === 0 ? "success" : difference > 0 ? "warning" : "error"}
      size="small"
    />
  );

  const handleStartSession = async () => {
    if (!newSessionName.trim()) return;
    
    try {
      setLoading(true);
      await startInventorySession({
        name: newSessionName.trim(),
        createdBy: user?.displayName ?? "Unbekannt",
        location: newSessionLocation.trim() || undefined,
        startedAt: new Date().toISOString(),
        assignedUserIds: newSessionAssignedUserIds.length ? newSessionAssignedUserIds : undefined,
      });

      await loadSessions();
      setStartDialogOpen(false);
      setNewSessionName("");
      setNewSessionLocation("");
      setNewSessionAssignedUserIds([]);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Starten der Inventur.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    // Deprecated: Old complete logic, replaced by submit/finalize workflow
    setError("Diese Funktion wurde ersetzt. Bitte 'Fertig (zur Prüfung)' oder 'Finalisieren' verwenden.");
  };

  const calculateSessionChecksum = (session: InventorySessionDto): string => {
    // SHA-256 Checksum Calculation (same as backend logic)
    // For now, return empty string and let backend calculate (client checksum optional)
    return '';
  };

  const handleSubmitSession = async (sessionId: string) => {
    try {
      setDifferencesLoading(true);
      const session = sessions.find((s) => s.id === sessionId) || null;
      setFinalizeTargetSession(session);
      setDifferencesPreview([]);
      setDifferencesTotals({ count: 0, deltaSum: 0, positiveDeltaSum: 0, negativeDeltaSum: 0 });
      const diffResponse = await fetchInventoryDifferences(sessionId);
      setDifferencesPreview(diffResponse.differences);
      setDifferencesTotals(diffResponse.totals);
      setFinalizeDialogOpen(true);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Fehler beim Laden der Differenzen.");
    } finally {
      setDifferencesLoading(false);
    }
  };

  const handleReopenSession = async (sessionId: string) => {
    if (!window.confirm("Inventur wieder zur Bearbeitung freigeben?")) {
      return;
    }
    
    try {
      setLoading(true);
      await reopenInventorySession(sessionId);
      await loadSessions();
      setError(null);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("Keine Berechtigung zum Wiedereröffnen (nur Manager).");
      } else {
        setError("Fehler beim Wiedereröffnen der Inventur.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReopenVehicle = async (sessionId: string, vehicleId: string, vehicleLabel: string) => {
    if (!window.confirm(`Fahrzeug "${vehicleLabel}" wieder zur Bearbeitung freigeben?`)) {
      return;
    }
    
    try {
      setLoading(true);
      await reopenInventoryVehicle(sessionId, vehicleId);
      await loadVehicleStatusesForSession(sessionId);
      setError(null);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("Keine Berechtigung zum Wiedereröffnen (nur Manager).");
      } else {
        setError("Fehler beim Wiedereröffnen des Fahrzeugs.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openFinalizeDialog = async (sessionId: string) => {
    try {
      setDifferencesLoading(true);
      const session = sessions.find((s) => s.id === sessionId) || null;
      setDifferencesPreview([]);
      setDifferencesTotals({ count: 0, deltaSum: 0, positiveDeltaSum: 0, negativeDeltaSum: 0 });
      setFinalizeTargetSession(session);
      const diffResponse = await fetchInventoryDifferences(sessionId);
      setDifferencesPreview(diffResponse.differences);
      setDifferencesTotals(diffResponse.totals);
      setFinalizeDialogOpen(true);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Fehler beim Laden der Differenzen.");
    } finally {
      setDifferencesLoading(false);
    }
  };

  const handleFinalizeSession = async (applyAdjustments: boolean) => {
    if (!finalizeTargetSession) {
      return;
    }

    const confirmation = applyAdjustments
      ? "Inventur finalisieren und Differenzen buchen?" 
      : "Inventur endgültig abschließen (ohne automatische Buchung)?";

    if (!window.confirm(confirmation)) {
      return;
    }

    try {
      setLoading(true);
      const checksum = calculateSessionChecksum(finalizeTargetSession);
      await finalizeInventorySession(finalizeTargetSession.id, {
        clientChecksum: checksum || undefined,
        applyAdjustments,
      });
      await loadSessions();
      setFinalizeDialogOpen(false);
      setFinalizeTargetSession(null);
      setError(null);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setError("Keine Berechtigung zum Finalisieren (nur Manager).");
      } else if (err.response?.status === 409) {
        setError("Session kann nicht finalisiert werden: " + (err.response?.data?.message || "Konflikt"));
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.message || "Fehler beim Finalisieren der Inventur.");
      } else {
        setError("Fehler beim Finalisieren der Inventur.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWithChoice = async (applyAdjustments: boolean, vehicleId?: string) => {
    if (!finalizeTargetSession) return;

    const confirmation = applyAdjustments
      ? "Inventur einreichen und Differenzen buchen? Danach ist keine Bearbeitung mehr möglich bis zur Freigabe durch den Manager."
      : "Inventur zur Prüfung einreichen (ohne automatische Buchung)?";

    if (!window.confirm(confirmation)) {
      return;
    }

    try {
      setLoading(true);
      const checksum = calculateSessionChecksum(finalizeTargetSession);
      await submitInventorySession(finalizeTargetSession.id, {
        clientChecksum: checksum || undefined,
        applyAdjustments,
        vehicleId: vehicleId || (isTechnician ? defaultVehicle?.id : undefined),
      });
      
      // Sessions neu laden
      await loadSessions();
      
      // Fahrzeug-Status neu laden um currentVehicleSubmitted zu aktualisieren
      if (finalizeTargetSession) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Kleine Verzögerung damit Backend Updated hat
        await loadVehicleStatusesForSession(finalizeTargetSession.id);
      }
      
      setFinalizeDialogOpen(false);
      setFinalizeTargetSession(null);
      setError(null);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 409) {
        setError("Session kann nicht eingereicht werden: " + (err.response?.data?.message || "Konflikt"));
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.message || "Fehler beim Einreichen der Inventur.");
      } else {
        setError("Fehler beim Einreichen der Inventur.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetEntryForm = () => {
    setSelectedItem(null);
    setCountedQuantity("");
    setExpectedQuantity("");
    setNote("");
    setManualCode("");
    setPendingItem(null);
    setPendingExpected(null);
    setAlreadyScannedLine(null);
    setQuantityInput("");
    setQuantityError(null);
    setQuantityDialogOpen(false);
  };

  const submitInventoryLine = async (params: { item: any; counted: number; expected: number; vehicle?: any; note?: string }) => {
    if (!activeSession) {
      setError("Keine aktive Inventur vorhanden.");
      return;
    }

    const vehicle = params.vehicle ?? selectedVehicle ?? defaultVehicle;
    
    // PRÜFEN: Gibt es bereits einen Eintrag für diesen Artikel?
    const existingLine = activeSession.lines?.find((line: any) => 
      line.item?.id === params.item.id && 
      (line.vehicle?.id || null) === (vehicle?.id || null)
    );
    
    if (existingLine) {
      // Summiere die Mengen auf
      const newCountedQuantity = existingLine.countedQuantity + params.counted;
      
      console.log('[InventoryPage] Artikel bereits erfasst - summiere Mengen:', {
        existing: existingLine.countedQuantity,
        adding: params.counted,
        newTotal: newCountedQuantity
      });
      
      // Lösche alte Position und erstelle neue mit summierter Menge
      try {
        await deleteInventoryLine(existingLine.id);
        // Fahre fort mit der neuen summierten Menge
        params.counted = newCountedQuantity;
      } catch (err) {
        console.error('[InventoryPage] Fehler beim Aufsummieren:', err);
        setError("Fehler beim Aktualisieren der Menge.");
        return;
      }
    }
    
    const requestData = {
      sessionId: activeSession.id,
      itemId: params.item.id,
      vehicleId: vehicle?.id || null,
      // Für Lager-Inventuren (kein Fahrzeug): Artikel-Lagerort mitschicken
      locationId: vehicle ? null : (params.item.storageLocation?.id || null),
      countedQuantity: params.counted,
      expectedQuantity: params.expected,
      note: params.note || null,
    };
    
    console.log('[InventoryPage] Submitting inventory line:', requestData);

    try {
      setLoading(true);
      await recordInventoryLine(requestData);

      await loadSessions();
      resetEntryForm();
      setError(null);
    } catch (err: any) {
      console.error('[InventoryPage] API Error, fallback to offline mode:', err);
      
      // WORKAROUND: Offline-Fallback für defekten Backend-Endpunkt
      if (err.response?.status === 500) {
        console.log('[InventoryPage] HTTP 500 detected - using offline fallback');
        
        // Simuliere erfolgreiche Erfassung lokal
        const tempLine = {
          id: `temp-${Date.now()}`,
          ...requestData,
          item: params.item,
          vehicle: params.vehicle ?? selectedVehicle ?? defaultVehicle,
          createdAt: new Date().toISOString()
        };
        
        // Speichere in localStorage für spätere Synchronisation  
        const offlineInventory = JSON.parse(localStorage.getItem('offlineInventoryLines') || '[]');
        offlineInventory.push(tempLine);
        localStorage.setItem('offlineInventoryLines', JSON.stringify(offlineInventory));
        
        // Aktualisiere UI optimistisch
        await loadSessions();
        resetEntryForm();
        setError("Position offline erfasst - wird bei nächster Synchronisation übertragen.");
        
        // Auto-clear Warnung nach 5 Sekunden
        setTimeout(() => setError(null), 5000);
      } else {
        playError();
        setError("Fehler beim Erfassen der Inventur-Position.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecordLine = async () => {
    if (!activeSession) {
      setError("Keine aktive Inventur vorhanden.");
      return;
    }
    let itemToUse = selectedItem;
    if (!itemToUse) {
      const code = manualCode.trim();
      if (code) {
        const item = findItemByCode(items, code);
        if (!item) {
          setError(`Artikel mit Code "${code}" nicht gefunden.`);
          return;
        }
        itemToUse = item;
        selectItemForEntry(item);
      } else {
        setError("Bitte einen Artikel auswählen oder angeben.");
        return;
      }
    }

    const parsedCounted = Number.parseInt(countedQuantity, 10);
    const parsedExpected = Number.parseInt(expectedQuantity, 10);
    const countedValue = Number.isNaN(parsedCounted) ? 0 : parsedCounted;
    const expectedValue = Number.isNaN(parsedExpected) ? 0 : parsedExpected;

    await submitInventoryLine({
      item: itemToUse,
      counted: countedValue,
      expected: expectedValue,
      vehicle: selectedVehicle ?? defaultVehicle ?? undefined,
      note: note.trim() || undefined,
    });
  };

  const handleManualCodeApply = () => {
    if (!activeSession) {
      setError("Keine aktive Inventur vorhanden.");
      return;
    }
    const code = manualCode.trim();
    if (!code) {
      setError("Bitte eine Artikelnummer eingeben.");
      return;
    }
    const item = findItemByCode(items, code);
    if (!item) {
      playError();
      setError(`Artikel mit Code "${code}" nicht gefunden.`);
      return;
    }
    playSuccess();
    openQuantityDialogForItem(item);
    setManualCode('');
    setError(null);
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!window.confirm("Diese Inventur-Position wirklich entfernen?")) {
      return;
    }
    try {
      setLoading(true);
      await deleteInventoryLine(lineId);
      await loadSessions();
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Löschen der Inventur-Position.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditLine = (line: any) => {
    setEditingLine(line);
    setEditQuantity(line.countedQuantity.toString());
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLine) return;
    
    const newQuantity = parseInt(editQuantity, 10);
    if (isNaN(newQuantity) || newQuantity < 0) {
      setError("Bitte gültige Menge eingeben.");
      return;
    }

    try {
      setLoading(true);
      
      // Lösche alte Position
      await deleteInventoryLine(editingLine.id);
      
      // Erstelle neue Position mit aktualisierter Menge
      const vehicleId = editingLine.vehicle?.id;
      const payload: any = {
        sessionId: editingLine.session?.id || activeSession?.id,
        itemId: editingLine.item.id,
        countedQuantity: newQuantity,
        expectedQuantity: editingLine.expectedQuantity,
      };
      
      if (vehicleId) {
        payload.vehicleId = vehicleId;
      }
      
      if (editingLine.note) {
        payload.note = editingLine.note;
      }
      
      await recordInventoryLine(payload);
      
      await loadSessions();
      setEditDialogOpen(false);
      setEditingLine(null);
      setEditQuantity("");
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Aktualisieren der Position.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSessionClick = (session: InventorySessionDto) => {
    setSessionToDelete(session);
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteSessionConfirm = async () => {
    if (!sessionToDelete) return;
    
    if (deleteConfirmText !== sessionToDelete.name) {
      setError("Der eingegebene Name stimmt nicht überein.");
      return;
    }

    const isSuperAdmin = user?.role === "MANAGER" && user?.branchId === null;
    const forceDelete = isSuperAdmin && sessionToDelete.status === "FINALIZED";

    try {
      setLoading(true);
      await deleteInventorySession(sessionToDelete.id, forceDelete);
      await loadSessions();
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      setDeleteConfirmText("");
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Löschen der Inventur-Sitzung.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportVehicleChange = (sessionId: string, vehicleId: string | null) => {
    setExportVehicleFilters((prev) => ({ ...prev, [sessionId]: vehicleId }));
  };

  const handleExportSession = async (sessionId: string, format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      // Für Techniker: Immer ihr zugewiesenes Fahrzeug verwenden
      // Für Manager: Manuell ausgewähltes Fahrzeug oder alle
      const selectedVehicleId = isTechnician 
        ? user?.vehicleId 
        : (canManageInventory ? exportVehicleFilters[sessionId] : user?.vehicleId) || undefined;

      // iOS/Safari-Fallback: neues Tab vorab öffnen
      const previewWin = window.open('', '_blank');

      const blob = await exportInventorySession(
        sessionId,
        format,
        selectedVehicleId ? { vehicleId: selectedVehicleId } : undefined,
      );
      const url = window.URL.createObjectURL(blob);
      const safeVehicleLabel = selectedVehicleId ? `_${selectedVehicleId}` : '';

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      if (format === 'pdf' && isIOS && previewWin) {
        // PDF direkt im neuen Tab anzeigen (besseres mobiles Verhalten)
        previewWin.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventur_${sessionId}${safeVehicleLabel}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (previewWin) previewWin.close();
      }
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(`Fehler beim Export als ${format.toUpperCase()}.`);
    }
  };

  const handleExportProtocol = async (sessionId: string, format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const previewWin = window.open('', '_blank');
      const blob = await exportInventoryProtocol(sessionId, format);
      const url = window.URL.createObjectURL(blob);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      if (format === 'pdf' && isIOS && previewWin) {
        previewWin.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventur_protokoll_${sessionId}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (previewWin) previewWin.close();
      }
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(`Fehler beim Protokoll-Export als ${format.toUpperCase()}.`);
    }
  };

  const handleScanCode = (code: string) => {
    if (!activeSession) {
      playError();
      setError('Keine aktive Inventur vorhanden.');
      return;
    }
    const item = findItemByCode(items, code);
    if (!item) {
      playError();
      setError(`Artikel mit Code "${code}" nicht gefunden.`);
      return;
    }
    playSuccess();
    openQuantityDialogForItem(item);
    setError(null);
  };

  const handleQuantityDialogClose = () => {
    setQuantityDialogOpen(false);
    setPendingItem(null);
    setPendingExpected(null);
    setAlreadyScannedLine(null);
    setQuantityInput("");
    setQuantityError(null);
  };

  const handleQuantityConfirm = async () => {
    if (!pendingItem) {
      handleQuantityDialogClose();
      return;
    }
    if (!activeSession) {
      setError("Keine aktive Inventur vorhanden.");
      handleQuantityDialogClose();
      return;
    }

    const expected = pendingExpected ?? resolveExpectedQuantity(pendingItem);
    const normalized = quantityInput.trim();

    // Leere Eingabe → Systemwert (erwartete Menge) übernehmen
    const counted = normalized === "" ? expected : Number.parseInt(normalized, 10);
    if (Number.isNaN(counted) || counted < 0) {
      setQuantityError("Bitte eine gültige Menge eingeben.");
      return;
    }

    await submitInventoryLine({
      item: pendingItem,
      counted,
      expected,
      vehicle: selectedVehicle ?? defaultVehicle ?? undefined,
    });
  };

  const itemOptions = useMemo(
    () =>
      items.map((item: any) => ({
        ...item,
        label: `${item.code} - ${item.description}`,
      })),
    [items],
  );

  const vehicleOptions = useMemo(() => {
    if (isTechnician) {
      if (!defaultVehicle) {
        return [];
      }
      return [
        {
          ...defaultVehicle,
          label: `${defaultVehicle.licensePlate} - ${defaultVehicle.description}`,
        },
      ];
    }

    return vehicles.map((vehicle: any) => ({
      ...vehicle,
      label: `${vehicle.licensePlate} - ${vehicle.description}`,
    }));
  }, [defaultVehicle, isTechnician, vehicles]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Inventur</Typography>
    <Typography variant="body2" color="text.secondary">
          Starte eine neue Inventur oder setze eine laufende Inventur fort. Ergebnisse können als Excel exportiert werden; CSV nur für Manager.
        </Typography>
      </Box>

      {/* Offline Status Indicator */}
      {offlineCount > 0 && (
        <Alert severity="warning" action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={syncOfflineInventoryLines}
            startIcon={<SyncIcon />}
          >
            Synchronisieren
          </Button>
        }>
          <strong>{offlineCount} Inventur-Position(en) offline gespeichert.</strong><br/>
          Wird automatisch synchronisiert sobald das Backend verfügbar ist.
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Active Session */}
      {activeSession && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6">{activeSession.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Gestartet: {new Date(activeSession.startedAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Freigegeben durch: {activeSession.createdBy}
                  </Typography>
                  {(activeSession.location || null) && (
                    <Typography variant="body2" color="text.secondary">
                      Warenort: {activeSession.location}
                    </Typography>
                  )}
                  <Chip
                    label={
                      activeSession.status === 'DRAFT' ? 'Entwurf' :
                      activeSession.status === 'SUBMITTED' ? 'Zur Prüfung' :
                      activeSession.status === 'FINALIZED' ? 'Abgeschlossen' :
                      'Abgebrochen'
                    }
                    color={
                      activeSession.status === 'DRAFT' ? 'default' :
                      activeSession.status === 'SUBMITTED' ? 'warning' :
                      activeSession.status === 'FINALIZED' ? 'success' :
                      'error'
                    }
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Stack spacing={1}>
                  {/* Techniker: Submit Button (DRAFT → SUBMITTED) */}
                  {activeSession.status === 'DRAFT' && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CompleteIcon />}
                      onClick={() => handleSubmitSession(activeSession.id)}
                      disabled={isLoading || (activeSession.linesCount ?? activeSession.lines?.length ?? 0) === 0}
                    >
                      Fertig (zur Prüfung)
                    </Button>
                  )}

                  {/* Manager: Reopen Button (SUBMITTED/FINALIZED/CANCELLED → DRAFT) */}
                  {(activeSession.status === 'SUBMITTED' || activeSession.status === 'FINALIZED' || activeSession.status === 'CANCELLED') && !isTechnician && canManageInventory && (
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => handleReopenSession(activeSession.id)}
                      disabled={isLoading}
                    >
                      {activeSession.status === 'FINALIZED'
                        ? 'Wieder zur Bearbeitung öffnen'
                        : activeSession.status === 'CANCELLED'
                        ? 'Reaktivieren'
                        : 'Zurück in Bearbeitung'}
                    </Button>
                  )}

                  {/* Manager: Finalize Button (nur bei SUBMITTED) */}
                  {activeSession.status === 'SUBMITTED' && !isTechnician && canManageInventory && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CompleteIcon />}
                      onClick={() => openFinalizeDialog(activeSession.id)}
                      disabled={isLoading}
                    >
                      Finalisieren
                    </Button>
                  )}

                  {/* Info für SUBMITTED Status (für Techniker) */}
                  {activeSession.status === 'SUBMITTED' && (isTechnician || !canManageInventory) && (
                    <Alert severity="info">
                      Inventur wurde zur Prüfung eingereicht. Keine Bearbeitung mehr möglich.
                    </Alert>
                  )}

                  {/* Per-Fahrzeug Status Anzeige */}
                  {vehicleStatuses && vehicleStatuses.length > 0 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {isTechnician ? 'Status meines Fahrzeugs:' : 'Status pro Fahrzeug:'}
                      </Typography>
                      <Stack spacing={1}>
                        {(isTechnician
                          ? vehicleStatuses.filter((vs: any) => vs.vehicleId === defaultVehicle?.id)
                          : vehicleStatuses
                        ).map((vs: any) => (
                          <Box key={vs.vehicleId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: 'background.paper', borderRadius: 0.5 }}>
                            <Typography variant="body2">
                              <strong>{vs.vehicleLabel}</strong>
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip
                                label={vs.status === 'DRAFT' ? 'laufende Inventur' : 'Eingereicht'}
                                color={vs.status === 'DRAFT' ? 'default' : 'success'}
                                size="small"
                              />
                              {vs.status === 'SUBMITTED' && (
                                <>
                                  <Typography variant="caption" color="text.secondary">
                                    {vs.submittedBy ? `von ${vs.submittedBy}` : ''}
                                    {vs.adjustmentsApplied && ' (Buchung erfolgt)'}
                                  </Typography>
                                  {!isTechnician && canManageInventory && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      onClick={() => handleReopenVehicle(activeSession.id, vs.vehicleId, vs.vehicleLabel)}
                                      disabled={isLoading}
                                      sx={{ ml: 1 }}
                                    >
                                      Freigeben
                                    </Button>
                                  )}
                                </>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Info für FINALIZED Status */}
                  {activeSession.status === 'FINALIZED' && (
                    <Alert severity="success">
                      Inventur wurde abgeschlossen.
                      {!isTechnician && canManageInventory && ' Manager können die Inventur wieder zur Bearbeitung öffnen.'}
                    </Alert>
                  )}

                  {/* Info für CANCELLED Status */}
                  {activeSession.status === 'CANCELLED' && (
                    <Alert severity="warning">
                      Inventur wurde abgebrochen. Manager kann sie reaktivieren und wieder auf DRAFT setzen.
                    </Alert>
                  )}
                </Stack>
              </Stack>

              <Divider />

              {/* Recording Form */}
              {!currentVehicleSubmitted && activeSession.status === 'DRAFT' ? (
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">Neue Position erfassen</Typography>
                  {totalExpectedCount > 0 && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        <strong>{sortedLines.length}</strong> / {totalExpectedCount} erfasst
                      </Typography>
                      {missingItems.length === 0 ? (
                        <Chip label="Alle erfasst" size="small" color="success" />
                      ) : (
                        <Chip label={`${missingItems.length} fehlen`} size="small" color="warning" />
                      )}
                    </Stack>
                  )}
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Autocomplete
                    sx={{ flex: 1 }}
                    options={itemOptions}
                    value={selectedItem}
                    onChange={(_: any, value: any) => selectItemForEntry(value)}
                    renderInput={(params: any) => (
                      <TextField {...params} label="Artikel" />
                    )}
                    getOptionLabel={(option: any) => option.label}
                    isOptionEqualToValue={(option: any, value: any) => option.id === value?.id}
                    disabled={isLoading}
                  />
                  <ScannerButton onDetected={handleScanCode} size="large" disabled={isLoading} />
                </Stack>

                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    label="Artikelnummer manuell"
                    value={manualCode}
                    onChange={(e: any) => setManualCode(e.target.value)}
                    placeholder="z.B. 12345678"
                    inputProps={{ autoCapitalize: "characters" }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleManualCodeApply}
                    disabled={!manualCode.trim() || !activeSession || isLoading}
                  >
                    Manuell übernehmen
                  </Button>
                </Stack>

                {isTechnician ? (
                  <TextField
                    label="Fahrzeug"
                    value={
                      defaultVehicle
                        ? `${defaultVehicle.licensePlate} - ${defaultVehicle.description}`
                        : "Kein Fahrzeug zugewiesen"
                    }
                    InputProps={{ readOnly: true }}
                    helperText={
                      defaultVehicle
                        ? undefined
                        : "Bitte weist dem Benutzer ein Fahrzeug zu."
                    }
                  />
                ) : (
                  <Autocomplete
                    options={vehicleOptions}
                    value={selectedVehicle}
                    onChange={(_: any, value: any) => setSelectedVehicle(value)}
                    renderInput={(params: any) => (
                      <TextField {...params} label="Fahrzeug (optional)" />
                    )}
                    getOptionLabel={(option: any) => option.label}
                    isOptionEqualToValue={(option: any, value: any) => option.id === value?.id}
                  />
                )}

                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Erwartete Menge"
                    type="number"
                    value={expectedQuantity}
                    onChange={(e: any) => setExpectedQuantity(e.target.value)}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                  <TextField
                    label="Gezählte Menge"
                    type="number"
                    value={countedQuantity}
                    onChange={(e: any) => setCountedQuantity(e.target.value)}
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Stack>

                <TextField
                  label="Notiz (optional)"
                  value={note}
                  onChange={(e: any) => setNote(e.target.value)}
                  multiline
                  rows={2}
                />

                <Button
                  variant="contained"
                  onClick={handleRecordLine}
                  disabled={!selectedItem || countedQuantity.trim() === "" || isLoading}
                  startIcon={<AddIcon />}
                >
                  Position erfassen
                </Button>

                {/* Offline Sync Button */}
                {offlineCount > 0 && (
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={syncOfflineInventoryLines}
                    disabled={isLoading}
                    startIcon={<SyncIcon />}
                  >
                    {offlineCount} Offline-Position(en) synchronisieren
                  </Button>
                )}
              </Stack>
              ) : (
                <Alert severity="info">
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Inventur ist {activeSession.status === 'SUBMITTED'
                      ? 'zur Prüfung eingereicht'
                      : activeSession.status === 'FINALIZED'
                      ? 'abgeschlossen'
                      : 'eingereicht'} - Eingaben gesperrt
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Du kannst keine neuen Positionen mehr scannen oder eingeben. {
                      activeSession.status === 'SUBMITTED'
                      ? 'Warte auf die Prüfung durch einen Manager oder bitte darum, die Inventur erneut zu öffnen.'
                      : ''
                    }
                  </Typography>
                </Alert>
              )}

              {/* Current Session Lines */}
              {sortedLines.length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle1">
                    Erfasste Positionen ({sortedLines.length})
                  </Typography>
                  {isMobileView ? (
                    <Stack spacing={1}>
                      {sortedLines.map((line: any) => {
                        const difference = line.countedQuantity - line.expectedQuantity;
                        const diffColor = difference === 0 ? "success.main" : difference > 0 ? "warning.main" : "error.main";
                        return (
                          <Paper
                            key={line.id}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderLeft: "4px solid",
                              borderLeftColor: diffColor,
                            }}
                          >
                            <Stack spacing={0.75}>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box sx={{ flex: 1, mr: 1 }}>
                                  <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                                    {line.item?.code || "-"}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                    {line.item?.description || "-"}
                                  </Typography>
                                  {line.item?.descriptionSecondary && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                      {line.item.descriptionSecondary}
                                    </Typography>
                                  )}
                                </Box>
                                {renderDifferenceChip(difference)}
                              </Stack>
                              <Box
                                sx={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 1fr 1fr",
                                  gap: 0.5,
                                  bgcolor: "action.hover",
                                  borderRadius: 0.5,
                                  p: 1,
                                  textAlign: "center",
                                }}
                              >
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">Erwartet</Typography>
                                  <Typography variant="h6" fontWeight={700} lineHeight={1}>{line.expectedQuantity}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">Gezählt</Typography>
                                  <Typography variant="h6" fontWeight={700} lineHeight={1}>{line.countedQuantity}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">Differenz</Typography>
                                  <Typography variant="h6" fontWeight={700} lineHeight={1} sx={{ color: diffColor }}>
                                    {difference > 0 ? `+${difference}` : difference}
                                  </Typography>
                                </Box>
                              </Box>
                              {(line.vehicle?.licensePlate || line.note) && (
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                  {line.vehicle?.licensePlate && (
                                    <Typography variant="caption" color="text.secondary">
                                      {line.vehicle.licensePlate}
                                    </Typography>
                                  )}
                                  {line.note && (
                                    <Typography variant="caption" color="text.secondary">
                                      Notiz: {line.note}
                                    </Typography>
                                  )}
                                </Stack>
                              )}
                              <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                                {!currentVehicleSubmitted && activeSession.status === 'DRAFT' && (
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleEditLine(line)}
                                    title="Menge bearbeiten"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                )}
                                {canManageInventoryNonTech && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteLine(line.id)}
                                    title="Position löschen"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  ) : (
                    <TableContainer sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Artikelnummer</TableCell>
                            <TableCell>Bezeichnung</TableCell>
                            <TableCell>Hersteller</TableCell>
                            <TableCell>Warengruppe</TableCell>
                            <TableCell>Warenort / Fahrzeug</TableCell>
                            <TableCell align="right">Gezählte Menge</TableCell>
                            <TableCell align="right">Erwartete Menge</TableCell>
                            <TableCell align="right">Differenz</TableCell>
                            <TableCell>Notiz</TableCell>
                            <TableCell align="center">Aktionen</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedLines.map((line: any) => (
                            <TableRow key={line.id}>
                              <TableCell>{line.item?.code || "-"}</TableCell>
                              <TableCell>{line.item?.description || "-"}</TableCell>
                              <TableCell>{line.item?.manufacturer || "-"}</TableCell>
                              <TableCell>{line.item?.productGroup || "-"}</TableCell>
                              <TableCell>
                                {line.vehicle?.licensePlate || activeSession.location || "-"}
                              </TableCell>
                              <TableCell align="right">{line.countedQuantity}</TableCell>
                              <TableCell align="right">{line.expectedQuantity}</TableCell>
                              <TableCell align="right">
                                {renderDifferenceChip(line.countedQuantity - line.expectedQuantity)}
                              </TableCell>
                              <TableCell>{line.note || "-"}</TableCell>
                              <TableCell align="center">
                                {!currentVehicleSubmitted && activeSession.status === 'DRAFT' && (
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleEditLine(line)}
                                    title="Menge bearbeiten"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                )}
                                {canManageInventoryNonTech && (
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteLine(line.id)}
                                    title="Position löschen"
                                    disabled={activeSession.status !== 'DRAFT'}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Sessions Overview */}
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Inventur-Sitzungen</Typography>
            {canManageInventory && (
              <Button
                variant="contained"
                startIcon={<StartIcon />}
                onClick={() => setStartDialogOpen(true)}
                disabled={isLoading || !!activeSession}
              >
                Neue Inventur starten
              </Button>
            )}
          </Stack>

          {sessions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Noch keine Inventur-Sitzungen vorhanden.
            </Typography>
          ) : (
            <List>
              {sessions.map((session: any) => (
                <ListItem key={session.id} divider>
                  <ListItemText
                    primary={session.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Gestartet: {new Date(session.startedAt).toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Freigegeben durch: {session.createdBy}
                        </Typography>
                        {user?.branchId === null && session.branch && (
                          <Typography variant="body2" color="text.secondary">
                            Niederlassung: <strong>{session.branch.name}</strong>
                          </Typography>
                        )}
                        {session.location && (
                          <Typography variant="body2" color="text.secondary">
                            Warenort: {session.location}
                          </Typography>
                        )}
                        {session.completedAt && (
                          <Typography variant="body2" color="text.secondary">
                            Abgeschlossen: {new Date(session.completedAt).toLocaleString()}
                          </Typography>
                        )}
                        <Typography variant="body2">
                          {session.linesCount ?? session.lines?.length ?? 0} Position(en) erfasst
                        </Typography>
                      </Box>
                    }
                  />
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
                    <Chip
                      label={
                        session.status === 'DRAFT' ? 'Entwurf' :
                        session.status === 'SUBMITTED' ? 'Zur Prüfung' :
                        session.status === 'FINALIZED' ? 'Abgeschlossen' :
                        'Abgebrochen'
                      }
                      color={
                        session.status === 'DRAFT' ? 'default' :
                        session.status === 'SUBMITTED' ? 'warning' :
                        session.status === 'FINALIZED' ? 'success' :
                        'error'
                      }
                      size="small"
                    />
                    {canManageInventory && (
                      <Autocomplete
                        size="small"
                        options={vehicleOptions}
                        value={
                          vehicleOptions.find(
                            (option) => option.id === exportVehicleFilters[session.id],
                          ) ?? null
                        }
                        onChange={(_, value) => handleExportVehicleChange(session.id, value?.id ?? null)}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Fahrzeug für Export"
                            variant="outlined"
                            size="small"
                            sx={{ minWidth: 220 }}
                          />
                        )}
                      />
                    )}
                    {canExportInventory && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleExportSession(session.id, 'xlsx')}
                          title="Als Excel exportieren"
                        >
                          <TableChartIcon />
                        </IconButton>
                        {canManageInventory && (
                          <IconButton
                            size="small"
                            onClick={() => handleExportSession(session.id, 'csv')}
                            title="Als CSV exportieren (nur Manager)"
                          >
                            <ExportIcon />
                          </IconButton>
                        )}
                        <Tooltip title="Protokoll mit Buchungen (Excel)">
                          <IconButton
                            size="small"
                            onClick={() => handleExportProtocol(session.id, 'xlsx')}
                          >
                            <DescriptionIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {session.status !== 'FINALIZED' && (
                      <Chip
                        label={session.status === 'DRAFT' ? 'Entwurf' : 'Zur Prüfung'}
                        size="small"
                        variant="outlined"
                        color="default"
                      />
                    )}
                    {session.status === 'FINALIZED' && session.finalizedAt && (() => {
                      const deletionDate = new Date(session.finalizedAt);
                      deletionDate.setFullYear(deletionDate.getFullYear() + 10);
                      return (
                        <Tooltip title={`Gesetzliche Aufbewahrungspflicht (§ 257 HGB): Automatische Löschung am ${deletionDate.toLocaleDateString('de-DE')}`}>
                          <Chip
                            label={`Löschung: ${deletionDate.toLocaleDateString('de-DE')}`}
                            size="small"
                            variant="outlined"
                            color="info"
                          />
                        </Tooltip>
                      );
                    })()}
                    {canManageInventoryNonTech && (session.status !== 'FINALIZED' || (user?.role === "MANAGER" && user?.branchId === null)) && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSessionClick(session)}
                        title={session.status === 'FINALIZED' ? "Inventur erzwungen löschen (Super Admin)" : "Inventur löschen"}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </Paper>

      {/* Start Session Dialog */}
      <Dialog open={startDialogOpen} onClose={() => { setStartDialogOpen(false); setNewSessionAssignedUserIds([]); }} maxWidth="sm" fullWidth>
        <DialogTitle>Neue Inventur starten</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Inventur-Name"
              fullWidth
              variant="outlined"
              value={newSessionName}
              onChange={(e: any) => setNewSessionName(e.target.value)}
              placeholder="z.B. Jahresinventur 2025"
            />
            <TextField
              label="Warenort / Bereich"
              fullWidth
              variant="outlined"
              value={newSessionLocation}
              onChange={(e: any) => setNewSessionLocation(e.target.value)}
              placeholder="z.B. Lagerhalle Nord"
            />
            {user?.role === "MANAGER" && (
              <Autocomplete
                multiple
                options={users.filter((u: any) => u.branchId === user.branchId || user.branchId === null)}
                getOptionLabel={(u: any) => u.displayName || u.username}
                value={users.filter((u: any) => newSessionAssignedUserIds.includes(u.id))}
                onChange={(_: any, val: any[]) => setNewSessionAssignedUserIds(val.map((u: any) => u.id))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Zugewiesen an (optional)"
                    placeholder={newSessionAssignedUserIds.length === 0 ? "Alle Benutzer sehen diese Inventur" : ""}
                    helperText="Wenn leer: für alle Benutzer der Niederlassung sichtbar"
                  />
                )}
                noOptionsText="Keine Benutzer gefunden"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setStartDialogOpen(false); setNewSessionAssignedUserIds([]); }}>Abbrechen</Button>
          <Button
            onClick={handleStartSession}
            variant="contained"
            disabled={!newSessionName.trim() || isLoading}
          >
            Starten
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={quantityDialogOpen} onClose={handleQuantityDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle>Menge erfassen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {pendingItem && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {pendingItem.code}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {pendingItem.description}
                </Typography>
                {pendingItem.descriptionSecondary && (
                  <Typography variant="caption" color="text.secondary">
                    {pendingItem.descriptionSecondary}
                  </Typography>
                )}
              </Box>
            )}

            {alreadyScannedLine && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Bereits erfasst: <strong>{alreadyScannedLine.countedQuantity}</strong> Stk. — neue Menge wird addiert.
              </Alert>
            )}

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                bgcolor: "action.hover",
                borderRadius: 1,
                px: 2,
                py: 1.5,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Erwartete Menge
              </Typography>
              <Typography variant="h4" fontWeight={800} color="primary.main">
                {pendingExpected ?? (pendingItem ? resolveExpectedQuantity(pendingItem) : 0)}
              </Typography>
            </Box>
            <TextField
              autoFocus
              label="Gezählte Menge"
              type="number"
              value={quantityInput}
              onChange={(e: any) => {
                setQuantityInput(e.target.value);
                if (quantityError) {
                  setQuantityError(null);
                }
              }}
              onKeyDown={(e: any) => {
                if (e.key === "Enter") {
                  void handleQuantityConfirm();
                }
              }}
              inputProps={{ min: 0, inputMode: "numeric" }}
              fullWidth
              helperText="Leer lassen = erwartete Menge übernehmen"
            />
            {quantityError && (
              <Alert severity="warning">{quantityError}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleQuantityDialogClose}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleQuantityConfirm}
            disabled={isLoading}
          >
            Übernehmen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Quantity Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Menge bearbeiten</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editingLine && (
              <>
                <Typography variant="body2" color="text.secondary">
                  <strong>{editingLine.item?.code}</strong> - {editingLine.item?.description}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Erwartete Menge: {editingLine.expectedQuantity}
                </Typography>
                <TextField
                  autoFocus
                  label="Gezählte Menge"
                  type="number"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  inputProps={{ min: 0, inputMode: "numeric" }}
                  fullWidth
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={isLoading}
          >
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Differences dialog (used for submit or finalize) */}
      <Dialog
        open={finalizeDialogOpen}
        onClose={() => setFinalizeDialogOpen(false)}
        maxWidth={isMobileView ? "sm" : "md"}
        fullWidth
        PaperProps={{
          sx: {
            m: isMobileView ? 1.5 : 3,
            width: isMobileView ? "100%" : undefined,
            borderRadius: isMobileView ? 2 : 3,
          },
        }}
      >
        <DialogTitle sx={{ pr: { xs: 3, sm: 3 }, pl: { xs: 3, sm: 3 } }}>
          {finalizeTargetSession?.status === 'SUBMITTED' ? 'Inventur finalisieren' : 'Inventur einreichen'}{finalizeTargetSession ? `: ${finalizeTargetSession.name}` : ''}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 3, sm: 3 }, pb: { xs: 2, sm: 2 }, pt: { xs: 1.5, sm: 2 } }}>
          {missingItems.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="warning">
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {missingItems.length} Artikel aus dem Bestand noch nicht gescannt:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {missingItems.slice(0, 10).map((s: any) => (
                    <li key={s.item?.id}>
                      <Typography variant="caption">
                        <strong>{s.item?.code}</strong> – {s.item?.description}
                        {s.item?.descriptionSecondary ? ` · ${s.item.descriptionSecondary}` : ''}{' '}
                        (Bestand: {s.quantity})
                      </Typography>
                    </li>
                  ))}
                  {missingItems.length > 10 && (
                    <li>
                      <Typography variant="caption" color="text.secondary">
                        … und {missingItems.length - 10} weitere
                      </Typography>
                    </li>
                  )}
                </Box>
              </Alert>
            </Box>
          )}

          {differencesLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              Lade Differenzen...
            </Typography>
          ) : differencesPreview.length === 0 ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              Keine Differenzen gefunden. Du kannst ohne Buchung finalisieren.
            </Alert>
          ) : (
            <>
              <TableContainer sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Artikel</TableCell>
                      <TableCell>Hersteller</TableCell>
                      <TableCell>Warengruppe</TableCell>
                      <TableCell>Fahrzeug / Ort</TableCell>
                      <TableCell align="right">Gezählt</TableCell>
                      <TableCell align="right">Erwartet</TableCell>
                      <TableCell align="right">Differenz</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {differencesPreview.map((diff) => (
                      <TableRow key={diff.lineId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{diff.itemCode}</Typography>
                          <Typography variant="body2" color="text.secondary">{diff.itemDescription}</Typography>
                        </TableCell>
                        <TableCell>{diff.manufacturer || '-'}</TableCell>
                        <TableCell>{diff.productGroup || '-'}</TableCell>
                        <TableCell>{diff.vehicleLabel || finalizeTargetSession?.location || '-'}</TableCell>
                        <TableCell align="right">{diff.countedQuantity}</TableCell>
                        <TableCell align="right">{diff.expectedQuantity}</TableCell>
                        <TableCell align="right">{renderDifferenceChip(diff.delta)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Chip label={`Positionen mit Differenz: ${differencesTotals.count}`} size="small" />
                <Chip label={`Summierte Differenz: ${differencesTotals.deltaSum}`} size="small" />
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Stack
            direction={isMobileView ? "column" : "row"}
            spacing={isMobileView ? 1.25 : 2}
            width="100%"
            alignItems={isMobileView ? "stretch" : "center"}
            justifyContent="flex-end"
          >
            <Button onClick={() => setFinalizeDialogOpen(false)} disabled={isLoading} fullWidth={isMobileView}>
              Abbrechen
            </Button>
            {finalizeTargetSession?.status === 'SUBMITTED' ? (
              <>
                <Button
                  variant="outlined"
                  onClick={() => handleFinalizeSession(false)}
                  disabled={isLoading || differencesLoading}
                  fullWidth={isMobileView}
                >
                  {finalizeTargetSession.adjustmentsApplied ? 'Finalisieren' : 'Nur finalisieren'}
                </Button>
                {!finalizeTargetSession.adjustmentsApplied && (
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() => handleFinalizeSession(true)}
                    disabled={isLoading || differencesLoading || differencesPreview.length === 0}
                    fullWidth={isMobileView}
                  >
                    Finalisieren & buchen
                  </Button>
                )}
                {finalizeTargetSession.adjustmentsApplied && (
                  <Alert
                    severity="info"
                    sx={{
                      ml: isMobileView ? 0 : 2,
                      mt: isMobileView ? 1 : 0,
                      alignSelf: isMobileView ? "stretch" : "center",
                      width: isMobileView ? "100%" : "auto",
                    }}
                  >
                    Differenzen wurden bereits beim Einreichen gebucht.
                  </Alert>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="outlined"
                  onClick={() => handleSubmitWithChoice(false)}
                  disabled={isLoading || differencesLoading}
                  fullWidth={isMobileView}
                >
                  Nur einreichen
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleSubmitWithChoice(true)}
                  disabled={isLoading || differencesLoading || differencesPreview.length === 0}
                  fullWidth={isMobileView}
                >
                  Einreichen & buchen
                </Button>
                <Alert
                  severity="info"
                  sx={{
                    ml: isMobileView ? 0 : 2,
                    mt: isMobileView ? 1 : 0,
                    maxWidth: isMobileView ? "100%" : 400,
                    alignSelf: isMobileView ? "stretch" : "center",
                    width: isMobileView ? "100%" : "auto",
                  }}
                >
                  <Typography variant="caption">
                    Durch Delta-Buchungen werden nur Änderungen seit der letzten Buchung erfasst. Keine Doppelbuchungen möglich.
                  </Typography>
                </Alert>
              </>
            )}
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Delete Session Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Inventur löschen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {sessionToDelete && (
              <>
                <Alert severity="error">
                  <strong>WARNUNG:</strong> Diese Aktion kann nicht rückgängig gemacht werden!
                </Alert>
                {sessionToDelete.status === "FINALIZED" && (
                  <Alert severity="warning">
                    <strong>Finalisierte Inventur:</strong> Diese Inventur wurde bereits abgeschlossen. Das Löschen umgeht die gesetzliche Aufbewahrungspflicht — nur im Testumfeld verwenden.
                  </Alert>
                )}
                <Typography variant="body2">
                  Sie sind dabei, die Inventur <strong>"{sessionToDelete.name}"</strong> mit{" "}
                  <strong>{sessionToDelete.lines?.length || 0} erfassten Position(en)</strong> zu löschen.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bitte geben Sie zur Bestätigung den Namen der Inventur ein:
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  label={`Inventur-Name: ${sessionToDelete.name}`}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={sessionToDelete.name}
                  helperText={`Geben Sie "${sessionToDelete.name}" ein, um zu bestätigen`}
                  error={deleteConfirmText !== "" && deleteConfirmText !== sessionToDelete.name}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteSessionConfirm}
            disabled={isLoading || deleteConfirmText !== sessionToDelete?.name}
          >
            Unwiderruflich löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default InventoryPage;
















