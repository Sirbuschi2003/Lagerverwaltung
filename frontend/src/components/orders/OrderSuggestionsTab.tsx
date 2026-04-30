import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DownloadIcon from "@mui/icons-material/Download";
import EmailIcon from "@mui/icons-material/Email";
import DraftsIcon from "@mui/icons-material/Drafts";
import StorefrontIcon from "@mui/icons-material/Storefront";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import useAuthStore from "../../store/useAuthStore";
import {
  fetchPurchaseSuggestions,
  createPurchaseOrder,
  updatePurchaseOrder,
  fetchPurchaseOrderPdf,
  fetchPublicCompanyConfig,
  fetchPurchaseOrderEmailTemplate,
  fetchItems,
  type PurchaseOrderSuggestionDto,
  type PurchaseOrderDto,
  type LocationDto,
  type ItemDto,
  fetchLocations,
  fetchWarehouses,
  type CompanyConfigDto,
  type EmailTemplate,
} from "../../utils/api";
import ItemEditDialog from "../items/ItemEditDialog";

interface WizardLine {
  itemId: string;
  code: string;
  description: string;
  descriptionSecondary?: string | null;
  quantity: number;
}

interface WizardGroup {
  supplierId: string;
  supplierName: string;
  lines: WizardLine[];
}

const OrderSuggestionsTab: React.FC = () => {
  const theme = useTheme();
  const hasPermission = useAuthStore((state: any) => state.hasPermission);
  const user = useAuthStore((state: any) => state.user);
  const canCreate = hasPermission("orders.create");

  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [warehouses, setWarehouses] = useState<LocationDto[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PurchaseOrderSuggestionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [filterBelowMinimum, setFilterBelowMinimum] = useState(false);
  const [filterSupplier, setFilterSupplier] = useState<string | null>(null);
  const [showCrossBranchAvailability, setShowCrossBranchAvailability] = useState(false);

  // Artikel-Bearbeitung Dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDialogId, setItemDialogId] = useState<string | null>(null);

  const handleOpenItemDialog = (itemId: string) => {
    setItemDialogId(itemId);
    setItemDialogOpen(true);
  };

  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, boolean>>({});
  const [suggestionQuantities, setSuggestionQuantities] = useState<Record<string, number>>({});
  
  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardGroups, setWizardGroups] = useState<WizardGroup[]>([]);
  const [wizardCreating, setWizardCreating] = useState(false);
  const [addSearches, setAddSearches] = useState<Record<string, string>>({});
  const [addOptions, setAddOptions] = useState<Record<string, ItemDto[]>>({});
  const [addItems, setAddItems] = useState<Record<string, ItemDto | null>>({});
  const [addQtys, setAddQtys] = useState<Record<string, number>>({});
  const [addCounters, setAddCounters] = useState<Record<string, number>>({});

  // Dialog für Bestellaktionen
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [createdOrders, setCreatedOrders] = useState<PurchaseOrderDto[]>([]);
  const [processingAction, setProcessingAction] = useState(false);
  
  // E-Mail Dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddresses, setEmailAddresses] = useState<Record<string, string>>({});
  const [companyConfig, setCompanyConfig] = useState<CompanyConfigDto | null>(null);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null);
  const [attachmentReminderOpen, setAttachmentReminderOpen] = useState(false);
  const [preparedAttachments, setPreparedAttachments] = useState<
    Array<{ supplierName: string; recipient: string; fileName: string }>
  >([]);

  const locationMap = useMemo(() => {
    const map = new Map<string, LocationDto>();
    locations.forEach((loc) => map.set(loc.id, loc));
    return map;
  }, [locations]);

  const getLocationChain = (loc?: LocationDto | null): LocationDto[] => {
    if (!loc) return [];

    const chain: LocationDto[] = [];
    const seen = new Set<string>();
    let current: LocationDto | null | undefined = loc;

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.push(current);
      const parentId: string | undefined = current.parent?.id;
      current = parentId ? (locationMap.get(parentId) ?? current.parent) : null;
    }

    return chain.reverse();
  };

  const formatStructuredCode = (code?: string | null): string | null => {
    const raw = code?.trim() ?? "";
    if (!raw) return null;

    const shelfMatch = raw.match(/regal\D*(\d+)\D+fach\D*(\d+)/i);
    if (shelfMatch) {
      return `Regal ${shelfMatch[1]} / Fach ${shelfMatch[2]}`;
    }

    const cabinetMatch = raw.match(/schrank\D*(\d+)\D+schublade\D*(\d+)/i);
    if (cabinetMatch) {
      return `Schrank ${cabinetMatch[1]} / Schublade ${cabinetMatch[2]}`;
    }

    return null;
  };

  const getLocationLabel = (loc?: LocationDto | null) => {
    if (!loc) return "-";

    const chain = getLocationChain(loc);
    const relevantNodes = chain.filter(
      (entry) => entry.type !== "WAREHOUSE" && entry.type !== "VEHICLE",
    );
    const target = relevantNodes[relevantNodes.length - 1] ?? chain[chain.length - 1] ?? loc;

    const structuredName = target.name?.trim();
    if (structuredName) return structuredName;

    const structuredCode = formatStructuredCode(target.code);
    if (structuredCode) return structuredCode;

    return target.code || "-";
  };

  const formatLocation = (locationId?: string | null) => {
    if (!locationId) return "-";
    const loc = locationMap.get(locationId);
    return getLocationLabel(loc);
  };

  const applyTemplateTokens = (template: string, replacements: Record<string, string>) => {
    return Object.entries(replacements).reduce((current, [key, value]) => {
      return current.split(`{{${key}}}`).join(value);
    }, template);
  };

  const buildExternalOrderMail = (order: PurchaseOrderDto, recipient: string) => {
    const orderNumber = order.orderNumber || order.id;
    const supplierName = order.supplier?.name || "Lieferant";
    const companyName = companyConfig?.name?.trim() || "Lagerverwaltung";
    const companyEmail = companyConfig?.email?.trim() || "";
    const companyPhone = companyConfig?.phone?.trim() || "";
    const userName = user?.displayName?.trim() || user?.username?.trim() || "";

    const positions = order.lines
      .map((line) => `- ${line.item?.code || "-"} | ${line.item?.description || "-"} | Menge: ${line.quantity}`)
      .join("\n");

    const fallbackTemplate: EmailTemplate = {
      subject: "Bestellung {{orderNumber}}",
      body: [
        "Guten Tag {{supplierName}},",
        "",
        "anbei unsere Bestellung {{orderNumber}}.",
        "",
        "Positionen:",
        "{{positions}}",
        "",
        "Mit freundlichen Grüßen",
        "{{companyName}}",
        "Tel: {{companyPhone}}",
        "E-Mail: {{companyEmail}}",
      ].join("\n"),
    };

    const selectedTemplate = emailTemplate ?? fallbackTemplate;
    const replacements: Record<string, string> = {
      orderNumber,
      supplierName,
      companyName,
      companyEmail,
      companyPhone,
      userName,
      positions: positions || "-",
    };

    const subject = applyTemplateTokens(selectedTemplate.subject || fallbackTemplate.subject, replacements).trim();
    const body = applyTemplateTokens(selectedTemplate.body || fallbackTemplate.body, replacements)
      .replace(/\\n/g, "\n")
      .replace(/^Tel:\s*$/gm, "")
      .replace(/^E-Mail:\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const triggerMailClient = (mailtoUrl: string) => {
    const anchor = document.createElement("a");
    anchor.href = mailtoUrl;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const loadData = async (refresh = false, warehouseId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const [suggData, locData] = await Promise.all([
        fetchPurchaseSuggestions(refresh, warehouseId ?? undefined),
        fetchLocations({ includeVehicles: false }),
      ]);
      setSuggestions(suggData);
      setLocations(locData);

      // Initialisiere Mengen und Auswahl
      const nextQuantities: Record<string, number> = {};
      const nextSelected: Record<string, boolean> = {};
      suggData.forEach((suggestion) => {
        nextQuantities[suggestion.itemId] = Math.max(0, suggestion.neededQuantity);
        nextSelected[suggestion.itemId] = false;
      });
      setSuggestionQuantities(nextQuantities);
      setSelectedSuggestions(nextSelected);
    } catch (err) {
      console.error(err);
      setError("Vorschläge konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const whs = await fetchWarehouses().catch(() => [] as LocationDto[]);
      setWarehouses(whs);
      // Vorauswahl: erstes Lager aus Benutzer-Zuweisung, sonst erstes Lager insgesamt
      const userLocationIds: string[] = (user as any)?.locationIds ?? [];
      const preselected = whs.find((w) => userLocationIds.includes(w.id)) ?? whs[0] ?? null;
      const preselectedId = preselected?.id ?? null;
      setSelectedWarehouseId(preselectedId);
      await loadData(false, preselectedId);
    };
    init();
  }, []);

  useEffect(() => {
    const loadMailConfiguration = async () => {
      const [company, template] = await Promise.all([
        fetchPublicCompanyConfig().catch(() => null),
        fetchPurchaseOrderEmailTemplate().catch(() => null),
      ]);
      setCompanyConfig(company);
      setEmailTemplate(template);
    };

    loadMailConfiguration().catch(() => {
      setCompanyConfig(null);
      setEmailTemplate(null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    wizardGroups.forEach((group) => {
      const search = addSearches[group.supplierId] ?? "";
      if (search.length < 2) {
        setAddOptions((prev) => ({ ...prev, [group.supplierId]: [] }));
        return;
      }
      const t = setTimeout(async () => {
        try {
          const result = await fetchItems({ search, limit: 50 });
          if (!cancelled) {
            setAddOptions((prev) => ({ ...prev, [group.supplierId]: result.items ?? [] }));
          }
        } catch {
          // ignore
        }
      }, 300);
      timers.push(t);
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [addSearches, wizardGroups]);

  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    suggestions.forEach((s) => {
      const key = s.supplierId || "NO_SUPPLIER";
      if (!seen.has(key)) seen.set(key, s.supplierName || "Kein Lieferant");
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  }, [suggestions]);

  const sortedSuggestions = useMemo(() => {
    let filtered = suggestions;
    if (filterBelowMinimum) {
      // Wie Hyreka: nur Artikel zeigen wo Ist-Bestand STRIKT unter Mindestbestand liegt
      filtered = filtered.filter(
        (s) => s.minimumStock != null && s.currentQuantity < s.minimumStock,
      );
    }
    if (filterSupplier) {
      filtered = filtered.filter(
        (s) => (s.supplierId || "NO_SUPPLIER") === filterSupplier,
      );
    }
    return [...filtered].sort((a, b) => {
      const supplierCompare = (a.supplierName || "").localeCompare(
        b.supplierName || "",
        "de",
        { sensitivity: "base" }
      );
      if (supplierCompare !== 0) return supplierCompare;
      return a.code.localeCompare(b.code, "de", { sensitivity: "base" });
    });
  }, [suggestions, filterBelowMinimum, filterSupplier]);

  const groupedSuggestions = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        supplierId: string | null;
        supplierName: string;
        items: PurchaseOrderSuggestionDto[];
      }
    >();

    sortedSuggestions.forEach((suggestion) => {
      const key = suggestion.supplierId || "NO_SUPPLIER";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          supplierId: suggestion.supplierId || null,
          supplierName: suggestion.supplierName || "Kein Lieferant",
          items: [],
        });
      }
      groups.get(key)!.items.push(suggestion);
    });

    return Array.from(groups.values());
  }, [sortedSuggestions]);

  const allSuggestionsSelected =
    sortedSuggestions.length > 0 &&
    sortedSuggestions.every((s) => selectedSuggestions[s.itemId]);

  const toggleAllSuggestions = () => {
    const next = !allSuggestionsSelected;
    const updated: Record<string, boolean> = {};
    sortedSuggestions.forEach((s) => {
      updated[s.itemId] = next;
    });
    setSelectedSuggestions(updated);
  };

  const getSupplierSelectionState = (items: PurchaseOrderSuggestionDto[]) => {
    const selectedCount = items.filter((item) => selectedSuggestions[item.itemId]).length;
    return {
      checked: items.length > 0 && selectedCount === items.length,
      indeterminate: selectedCount > 0 && selectedCount < items.length,
    };
  };

  const toggleSupplierSuggestions = (items: PurchaseOrderSuggestionDto[]) => {
    const { checked } = getSupplierSelectionState(items);
    const next = !checked;
    setSelectedSuggestions((prev) => {
      const updated = { ...prev };
      items.forEach((item) => {
        updated[item.itemId] = next;
      });
      return updated;
    });
  };

  const handleCreateOrders = () => {
    const selectedItems = sortedSuggestions.filter((s) => selectedSuggestions[s.itemId]);
    if (selectedItems.length === 0) {
      alert("Bitte wählen Sie mindestens einen Artikel aus.");
      return;
    }

    const groupMap = new Map<string, WizardGroup>();
    let hasNoSupplier = false;
    selectedItems.forEach((item) => {
      if (!item.supplierId) {
        hasNoSupplier = true;
        return;
      }
      if (!groupMap.has(item.supplierId)) {
        groupMap.set(item.supplierId, {
          supplierId: item.supplierId,
          supplierName: item.supplierName || "Kein Lieferant",
          lines: [],
        });
      }
      const qty = Number(suggestionQuantities[item.itemId] ?? 0);
      const needed = Math.max(0, Number(item.neededQuantity ?? 0));
      groupMap.get(item.supplierId)!.lines.push({
        itemId: item.itemId,
        code: item.code,
        description: item.description,
        descriptionSecondary: item.descriptionSecondary,
        quantity: qty > 0 ? qty : needed,
      });
    });

    if (hasNoSupplier) {
      alert("Einige Artikel haben keinen Lieferanten und werden übersprungen.");
    }

    if (groupMap.size === 0) {
      alert("Keine bestellbaren Artikel ausgewählt (alle ohne Lieferant).");
      return;
    }

    setWizardGroups(Array.from(groupMap.values()));
    setAddSearches({});
    setAddOptions({});
    setAddItems({});
    setAddQtys({});
    setAddCounters({});
    setWizardOpen(true);
  };

  const handleWizardCreateOrders = async () => {
    setWizardCreating(true);
    try {
      const ordersList: PurchaseOrderDto[] = [];
      for (const group of wizardGroups) {
        const lines = group.lines
          .filter((l) => l.quantity > 0)
          .map((l) => ({ itemId: l.itemId, quantity: l.quantity }));
        if (lines.length === 0) continue;
        const order = await createPurchaseOrder({
          supplierId: group.supplierId,
          lines,
          note: "Automatisch erstellt aus Bestellvorschlägen",
        });
        ordersList.push(order);
      }

      if (ordersList.length === 0) {
        alert("Keine Bestellungen erstellt (alle Positionen haben Menge 0).");
        return;
      }

      setWizardOpen(false);
      setCreatedOrders(ordersList);
      setActionDialogOpen(true);
      await loadData();
      setSelectedSuggestions({});
    } catch (err: any) {
      alert("Fehler beim Erstellen der Bestellungen: " + (err.response?.data?.message || err.message));
    } finally {
      setWizardCreating(false);
    }
  };
  
  const handleOrderAsDraft = () => {
    setActionDialogOpen(false);
    setSuccessMessage(`${createdOrders.length} Bestellung(en) als Entwurf gespeichert.`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };
  
  const handleOrderAndDownload = async () => {
    setProcessingAction(true);
    try {
      for (const order of createdOrders) {
        // Status auf ORDERED setzen — dabei wird die Bestellnummer generiert
        const updatedOrder = await updatePurchaseOrder(order.id, { status: "ORDERED" as any });
        try {
          const blob = await fetchPurchaseOrderPdf(updatedOrder.id);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${(updatedOrder.orderNumber || updatedOrder.id).replace(/[^a-zA-Z0-9_.-]/g, "_")}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (pdfErr) {
          console.error("PDF Download fehlgeschlagen:", pdfErr);
        }
      }
      
      setActionDialogOpen(false);
      setSuccessMessage(`${createdOrders.length} Bestellung(en) bestellt und PDFs heruntergeladen.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert("Fehler beim Bestellen: " + (err.response?.data?.message || err.message));
    } finally {
      setProcessingAction(false);
    }
  };
  
  const handleOrderAndEmail = async () => {
    // Initialisiere E-Mail-Adressen
    const emails: Record<string, string> = {};
    createdOrders.forEach((order) => {
      emails[order.id] = order.supplier?.email || "";
    });
    setEmailAddresses(emails);
    setActionDialogOpen(false);
    setEmailDialogOpen(true);
  };
  
  const handleSendEmails = async () => {
    setProcessingAction(true);
    try {
      const results: Array<{order: PurchaseOrderDto; success: boolean; error?: string}> = [];
      const downloadedAttachments: Array<{ supplierName: string; recipient: string; fileName: string }> = [];
      
      // Externes Mailprogramm öffnen, PDF herunterladen und dann auf ORDERED setzen
      for (const order of createdOrders) {
        try {
          const emailTo = emailAddresses[order.id]?.trim();
          if (!emailTo) {
            results.push({ order, success: false, error: "Keine E-Mail-Adresse" });
            continue;
          }

          // Wichtig: mailto zuerst aus dem direkten Klick-Kontext ausloesen (Popup-Blocker vermeiden)
          const mailtoUrl = buildExternalOrderMail(order, emailTo);
          triggerMailClient(mailtoUrl);

          // Status auf ORDERED setzen (generiert Bestellnummer) VOR PDF-Download
          const updatedOrder = await updatePurchaseOrder(order.id, { status: "ORDERED" as any });

          const blob = await fetchPurchaseOrderPdf(updatedOrder.id);
          const pdfUrl = window.URL.createObjectURL(blob);
          const pdfAnchor = document.createElement("a");
          const fileName = `${(updatedOrder.orderNumber || updatedOrder.id).replace(/[^a-zA-Z0-9_.-]/g, "_")}.pdf`;
          pdfAnchor.href = pdfUrl;
          pdfAnchor.download = fileName;
          document.body.appendChild(pdfAnchor);
          pdfAnchor.click();
          document.body.removeChild(pdfAnchor);
          window.URL.revokeObjectURL(pdfUrl);

          results.push({ order, success: true });
          downloadedAttachments.push({
            supplierName: order.supplier?.name || "Unbekannter Lieferant",
            recipient: emailTo,
            fileName,
          });
        } catch (err: any) {
          console.error(`Fehler bei Bestellung ${order.id}:`, err);
          results.push({ order, success: false, error: err.response?.data?.message || err.message });
        }
      }

      setEmailDialogOpen(false);

      // Zusammenfassung
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount === 0) {
        setSuccessMessage(
          `${successCount} Bestellung(en) vorbereitet. Mailprogramm geöffnet und PDFs heruntergeladen.`,
        );
      } else {
        const failedOrders = results.filter(r => !r.success);
        alert(
          `${successCount} Bestellung(en) erfolgreich vorbereitet.\n` +
          `${failCount} Bestellung(en) fehlgeschlagen:\n\n` +
          failedOrders.map(r => `- ${r.order.supplier?.name}: ${r.error}`).join('\n') +
          `\n\nDie fehlgeschlagenen Bestellungen bleiben als Entwurf und können erneut bearbeitet werden.`
        );
        setSuccessMessage(`${successCount} von ${createdOrders.length} Bestellung(en) erfolgreich vorbereitet.`);
      }

      if (downloadedAttachments.length > 0) {
        setPreparedAttachments(downloadedAttachments);
        setAttachmentReminderOpen(true);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert("Fehler bei externer E-Mail-Vorbereitung: " + (err.response?.data?.message || err.message));
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6">
            Bestellvorschläge ({sortedSuggestions.length}
            {filterBelowMinimum || filterSupplier ? ` / ${suggestions.length}` : ""})
          </Typography>
          {warehouses.length > 1 && (
            <TextField
              select
              label="Lager"
              size="small"
              sx={{ minWidth: 180 }}
              value={selectedWarehouseId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                setSelectedWarehouseId(id);
                loadData(false, id);
              }}
              SelectProps={{ native: true }}
            >
              <option value="">Alle Lager</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name || w.code}</option>
              ))}
            </TextField>
          )}
          <Autocomplete
            options={supplierOptions}
            getOptionLabel={(o) => o.name}
            value={supplierOptions.find((o) => o.id === filterSupplier) ?? null}
            onChange={(_, val) => setFilterSupplier(val ? val.id : null)}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            renderInput={(params) => (
              <TextField {...params} label="Lieferant filtern" size="small" sx={{ minWidth: 220 }} />
            )}
            clearOnEscape
            clearText="Alle Lieferanten"
            sx={{ minWidth: 220 }}
          />
          <Tooltip title="Zeigt nur Artikel, bei denen der Ist-Bestand den Mindestbestand (Sicherheitspuffer) unterschritten hat. Artikel die nur den Meldebestand unterschritten haben werden ausgeblendet.">
            <FormControlLabel
              control={
                <Checkbox
                  checked={filterBelowMinimum}
                  onChange={(e) => setFilterBelowMinimum(e.target.checked)}
                  size="small"
                />
              }
              label="Nur Mindestbestand unterschritten"
            />
          </Tooltip>
          <Tooltip title="Zeigt bei jedem Artikel an, ob und wie viel Bestand in anderen Niederlassungen vorhanden ist.">
            <FormControlLabel
              control={
                <Switch
                  checked={showCrossBranchAvailability}
                  onChange={(e) => setShowCrossBranchAvailability(e.target.checked)}
                  size="small"
                />
              }
              label="Bestand anderer Niederlassungen"
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadData(true, selectedWarehouseId)}
            disabled={loading}
          >
            Aktualisieren
          </Button>
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<ShoppingCartIcon />}
              onClick={handleCreateOrders}
              disabled={!Object.values(selectedSuggestions).some(Boolean)}
            >
              Bestellungen erstellen
            </Button>
          )}
        </Box>
      </Box>

      {sortedSuggestions.length === 0 ? (
        <Alert severity="info">
          Keine Bestellvorschläge vorhanden. Alle Artikel sind ausreichend bevorratet.
        </Alert>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSuggestionsSelected}
                    onChange={toggleAllSuggestions}
                    disabled={!canCreate}
                  />
                </TableCell>
                <TableCell>Artikelnummer</TableCell>
                <TableCell>Bezeichnung</TableCell>
                <TableCell>Lieferant</TableCell>
                <TableCell>Lagerort</TableCell>
                <TableCell align="right">Aktuell</TableCell>
                <TableCell align="right">Soll</TableCell>
                <TableCell align="right">Benötigt</TableCell>
                <TableCell align="right">Menge bestellen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedSuggestions.map((group) => {
                const supplierSelection = getSupplierSelectionState(group.items);
                const isSupplierMissing = !group.supplierId;

                return (
                  <React.Fragment key={group.key}>
                    <TableRow
                      key={`supplier-header-${group.key}`}
                      sx={{
                        "& td": {
                          py: 0.95,
                          borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                          background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.07),
                        },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={supplierSelection.checked}
                          indeterminate={supplierSelection.indeterminate}
                          onChange={() => toggleSupplierSuggestions(group.items)}
                          disabled={!canCreate || isSupplierMissing}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          borderLeft: `1px solid ${alpha(theme.palette.grey[500], 0.35)}`,
                          fontWeight: 800,
                          color: "text.primary",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 28 }}>
                          <Typography variant="body2" fontWeight={800} color="text.primary">
                            {group.supplierName}
                          </Typography>
                          {isSupplierMissing && (
                            <Chip label="nicht bestellbar" size="small" color="error" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                          Bezeichnung
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                          Lieferant
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                          Lagerort
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                          Aktuell
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                          Soll
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                          Benötigt
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ borderRight: `1px solid ${alpha(theme.palette.grey[500], 0.35)}` }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                            Menge
                          </Typography>
                          <Chip label={`${group.items.length} Artikel`} size="small" />
                        </Box>
                      </TableCell>
                    </TableRow>

                    {group.items.map((suggestion, itemIndex) => (
                      <TableRow
                        key={suggestion.itemId}
                        sx={{
                          bgcolor: selectedSuggestions[suggestion.itemId]
                            ? alpha(theme.palette.primary.main, 0.09)
                            : "inherit",
                          "& td": {
                            borderBottom:
                              itemIndex === group.items.length - 1
                                ? `1.5px solid ${alpha(theme.palette.divider, 1)}`
                                : `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                          },
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedSuggestions[suggestion.itemId] || false}
                            onChange={(e) =>
                              setSelectedSuggestions((prev) => ({
                                ...prev,
                                [suggestion.itemId]: e.target.checked,
                              }))
                            }
                            disabled={!canCreate}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Artikeldaten öffnen">
                            <Typography
                              variant="body2"
                              fontWeight="medium"
                              sx={{ cursor: "pointer", color: "primary.main", "&:hover": { textDecoration: "underline" } }}
                              onClick={() => handleOpenItemDialog(suggestion.itemId)}
                            >
                              {suggestion.code}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{suggestion.description}</Typography>
                          {suggestion.descriptionSecondary && (
                            <Typography variant="body2" color="text.secondary">{suggestion.descriptionSecondary}</Typography>
                          )}
                          {showCrossBranchAvailability && suggestion.availableInOtherBranches && suggestion.availableInOtherBranches.length > 0 && (
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                              {suggestion.availableInOtherBranches.map((branch) => (
                                <Tooltip
                                  key={branch.branchId}
                                  title={`In ${branch.branchName} verfügbar: ${branch.quantity} Stk.`}
                                >
                                  <Chip
                                    icon={<StorefrontIcon />}
                                    label={`${branch.branchName}: ${branch.quantity}`}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                    sx={{ fontSize: "0.7rem" }}
                                  />
                                </Tooltip>
                              ))}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {suggestion.supplierName ? (
                            <Chip
                              label={suggestion.supplierName}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ) : (
                            <Chip
                              label="Kein Lieferant"
                              size="small"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {formatLocation(suggestion.storageLocationId)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={
                              suggestion.reorderPoint != null
                                ? suggestion.currentQuantity <= suggestion.reorderPoint
                                  ? "error"
                                  : "inherit"
                                : suggestion.currentQuantity < suggestion.targetStock
                                  ? "error"
                                  : "inherit"
                            }
                          >
                            {suggestion.currentQuantity}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {suggestion.targetStock}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color="error"
                          >
                            {suggestion.neededQuantity}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            size="small"
                            value={suggestionQuantities[suggestion.itemId] || 0}
                            onChange={(e) =>
                              setSuggestionQuantities((prev) => ({
                                ...prev,
                                [suggestion.itemId]: Math.max(0, parseInt(e.target.value) || 0),
                              }))
                            }
                            inputProps={{ min: 0, style: { textAlign: "right" } }}
                            sx={{ width: 80 }}
                            disabled={!canCreate}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
      
      {/* Bestellungs-Wizard */}
      <Dialog
        open={wizardOpen}
        onClose={() => { if (!wizardCreating) setWizardOpen(false); }}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={wizardCreating}
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ShoppingCartIcon color="primary" />
            <Typography variant="h6">Bestellung prüfen &amp; aufgeben</Typography>
          </Box>
          <Stepper activeStep={0} sx={{ mt: 1.5 }}>
            <Step completed={false}>
              <StepLabel>Positionen prüfen</StepLabel>
            </Step>
            <Step>
              <StepLabel>Bestellung aufgeben</StepLabel>
            </Step>
          </Stepper>
        </DialogTitle>
        <DialogContent dividers>
          {wizardGroups.map((group) => (
            <Box key={group.supplierId} sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <StorefrontIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                  {group.supplierName}
                </Typography>
                <Chip label={`${group.lines.length} Artikel`} size="small" />
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Artikelnummer</TableCell>
                    <TableCell>Bezeichnung</TableCell>
                    <TableCell align="right" sx={{ width: 100 }}>Menge</TableCell>
                    <TableCell sx={{ width: 48 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.lines.map((line) => (
                    <TableRow key={line.itemId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">{line.code}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{line.description}</Typography>
                        {line.descriptionSecondary && (
                          <Typography variant="caption" color="text.secondary">{line.descriptionSecondary}</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={line.quantity}
                          onChange={(e) => {
                            const qty = Math.max(0, parseInt(e.target.value) || 0);
                            setWizardGroups((prev) =>
                              prev.map((g) =>
                                g.supplierId === group.supplierId
                                  ? { ...g, lines: g.lines.map((l) => l.itemId === line.itemId ? { ...l, quantity: qty } : l) }
                                  : g,
                              ),
                            );
                          }}
                          onFocus={(e) => e.target.select()}
                          inputProps={{ min: 0, style: { textAlign: "right" } }}
                          sx={{ width: 80 }}
                          disabled={wizardCreating}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={wizardCreating}
                          onClick={() =>
                            setWizardGroups((prev) =>
                              prev
                                .map((g) =>
                                  g.supplierId === group.supplierId
                                    ? { ...g, lines: g.lines.filter((l) => l.itemId !== line.itemId) }
                                    : g,
                                )
                                .filter((g) => g.lines.length > 0),
                            )
                          }
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Artikel hinzufügen */}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Autocomplete
                        key={`add-${group.supplierId}-${addCounters[group.supplierId] ?? 0}`}
                        freeSolo={false}
                        size="small"
                        options={addOptions[group.supplierId] ?? []}
                        getOptionLabel={(o) => typeof o === "string" ? o : `${o.code} – ${o.description}`}
                        isOptionEqualToValue={(opt, val) => opt.id === val.id}
                        filterOptions={(x) => x}
                        value={addItems[group.supplierId] ?? null}
                        onInputChange={(_, val, reason) => {
                          if (reason === "input") {
                            setAddSearches((prev) => ({ ...prev, [group.supplierId]: val }));
                          } else if (reason === "clear") {
                            setAddSearches((prev) => ({ ...prev, [group.supplierId]: "" }));
                            setAddItems((prev) => ({ ...prev, [group.supplierId]: null }));
                          }
                        }}
                        onChange={(_, val) => {
                          setAddItems((prev) => ({ ...prev, [group.supplierId]: val as ItemDto | null }));
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Artikel suchen und hinzufügen..."
                            size="small"
                          />
                        )}
                        noOptionsText={
                          (addSearches[group.supplierId]?.length ?? 0) < 2
                            ? "Mindestens 2 Zeichen eingeben"
                            : "Kein Artikel gefunden"
                        }
                        disabled={wizardCreating}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={addQtys[group.supplierId] ?? 1}
                        onChange={(e) =>
                          setAddQtys((prev) => ({
                            ...prev,
                            [group.supplierId]: Math.max(1, parseInt(e.target.value) || 1),
                          }))
                        }
                        onFocus={(e) => e.target.select()}
                        inputProps={{ min: 1, style: { textAlign: "right" } }}
                        sx={{ width: 80 }}
                        disabled={wizardCreating}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={wizardCreating || !addItems[group.supplierId]}
                        onClick={() => {
                          const item = addItems[group.supplierId];
                          if (!item) return;
                          const qty = addQtys[group.supplierId] ?? 1;
                          setWizardGroups((prev) =>
                            prev.map((g) => {
                              if (g.supplierId !== group.supplierId) return g;
                              const existing = g.lines.find((l) => l.itemId === item.id);
                              if (existing) {
                                return {
                                  ...g,
                                  lines: g.lines.map((l) =>
                                    l.itemId === item.id ? { ...l, quantity: l.quantity + qty } : l,
                                  ),
                                };
                              }
                              return {
                                ...g,
                                lines: [
                                  ...g.lines,
                                  {
                                    itemId: item.id,
                                    code: item.code,
                                    description: item.description,
                                    descriptionSecondary: item.descriptionSecondary,
                                    quantity: qty,
                                  },
                                ],
                              };
                            }),
                          );
                          setAddItems((prev) => ({ ...prev, [group.supplierId]: null }));
                          setAddSearches((prev) => ({ ...prev, [group.supplierId]: "" }));
                          setAddQtys((prev) => ({ ...prev, [group.supplierId]: 1 }));
                          setAddCounters((prev) => ({ ...prev, [group.supplierId]: (prev[group.supplierId] ?? 0) + 1 }));
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Divider sx={{ mt: 2 }} />
            </Box>
          ))}
          {wizardGroups.length === 0 && (
            <Alert severity="warning">Alle Positionen wurden entfernt. Bitte fügen Sie Artikel hinzu oder schließen Sie den Wizard.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setWizardOpen(false)} disabled={wizardCreating}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="large"
            endIcon={wizardCreating ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardIcon />}
            onClick={handleWizardCreateOrders}
            disabled={
              wizardCreating ||
              wizardGroups.length === 0 ||
              wizardGroups.every((g) => g.lines.every((l) => l.quantity === 0))
            }
          >
            {wizardCreating ? "Erstelle Bestellungen..." : "Bestellung aufgeben"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog für Bestellaktionen */}
      <Dialog
        open={actionDialogOpen}
        onClose={(_, reason) => {
          if (processingAction) return;
          if (reason === "backdropClick") return;
          setActionDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={processingAction}
      >
        <DialogTitle>Bestellungen erstellt – Was möchten Sie tun?</DialogTitle>
        <DialogContent>
          {createdOrders.length > 0 && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Es wurden {createdOrders.length} Bestellung(en) erstellt:
              </Typography>
              <List dense>
                {createdOrders.map((order) => (
                  <ListItem key={order.id}>
                    <ListItemText
                      primary={order.supplier?.name || "Unbekannter Lieferant"}
                      secondary={`${order.lines.length} Artikel`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            Wählen Sie eine Aktion für diese Bestellungen:
          </Alert>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2 }}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={handleOrderAndDownload}
            disabled={processingAction}
          >
            {processingAction ? "Verarbeite..." : "Bestellen und PDF herunterladen"}
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<EmailIcon />}
            onClick={handleOrderAndEmail}
            disabled={processingAction}
          >
            Bestellen und im Mailprogramm öffnen
          </Button>
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<DraftsIcon />}
            onClick={handleOrderAsDraft}
            disabled={processingAction}
          >
            Als Entwurf speichern
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* E-Mail Dialog */}
      <Dialog 
        open={emailDialogOpen} 
        onClose={(_, reason) => {
          if (processingAction) return;
          if (reason === "backdropClick") return;
          setEmailDialogOpen(false);
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>E-Mail im externen Mailprogramm vorbereiten</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Die Anwendung sendet keine E-Mails selbst. Das externe Mailprogramm wird geöffnet und die PDF startet automatisch als Download.
          </Alert>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Technische Einschränkung im Browser: Das automatische Anhängen der PDF im externen Mailprogramm ist nicht zuverlässig möglich.
            Bitte die heruntergeladene PDF kurz im Mailprogramm anhängen und dann senden.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Bitte prüfen Sie die E-Mail-Adressen:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {createdOrders.map((order) => (
              <Box
                key={order.id}
                sx={{
                  border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                  borderRadius: 1,
                  p: 2,
                  backgroundColor: alpha(theme.palette.background.paper, 0.9),
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1.5,
                    pb: 1,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "primary.main" }}>
                    {order.supplier?.name || "Unbekannter Lieferant"}
                  </Typography>
                  <Chip label={`${order.lines.length} Artikel`} size="small" />
                </Box>
                <TextField
                  label={order.supplier?.name || "Unbekannter Lieferant"}
                  type="email"
                  value={emailAddresses[order.id] || ""}
                  onChange={(e) => setEmailAddresses(prev => ({
                    ...prev,
                    [order.id]: e.target.value
                  }))}
                  fullWidth
                  required
                  error={!emailAddresses[order.id]}
                  helperText={!emailAddresses[order.id] ? "E-Mail-Adresse erforderlich" : ""}
                  sx={{ mb: 2 }}
                />
                
                {/* Artikel-Übersicht */}
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Artikel in dieser Bestellung:
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Artikelnummer</TableCell>
                      <TableCell>Beschreibung</TableCell>
                      <TableCell align="right">Menge</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{line.item?.code || "-"}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{line.item?.description || "-"}</Typography>
                          {line.item?.descriptionSecondary && (
                            <Typography variant="body2" color="text.secondary">{line.item.descriptionSecondary}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{line.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)} disabled={processingAction}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSendEmails} 
            variant="contained" 
            disabled={processingAction || createdOrders.some(o => !emailAddresses[o.id]?.trim())}
          >
            {processingAction ? "Bereite E-Mails vor..." : "Mailprogramm öffnen"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={attachmentReminderOpen}
        onClose={() => setAttachmentReminderOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>PDF-Anhang noch hinzufügen</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Bitte hängen Sie die heruntergeladenen PDFs jetzt im Mailprogramm als Anhang an und senden Sie die E-Mail.
          </Alert>
          <List dense>
            {preparedAttachments.map((entry, index) => (
              <ListItem key={`${entry.fileName}-${index}`}>
                <ListItemText
                  primary={entry.fileName}
                  secondary={`${entry.supplierName} -> ${entry.recipient}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachmentReminderOpen(false)} variant="contained">
            Verstanden
          </Button>
        </DialogActions>
      </Dialog>

      <ItemEditDialog
        itemId={itemDialogId}
        open={itemDialogOpen}
        onClose={() => setItemDialogOpen(false)}
        onSaved={() => loadData(true)}
      />
    </Box>
  );
};

export default OrderSuggestionsTab;

