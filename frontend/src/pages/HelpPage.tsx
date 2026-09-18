import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  useTheme,
} from "@mui/material";
import {
  ExpandMore,
  Search,
  Dashboard,
  QrCodeScanner,
  Inventory,
  Inventory2,
  Storefront,
  LocalShipping,
  TableChart,
  DirectionsCar,
  Assignment,
  Build,
  Sync,
  Settings as SettingsIcon,
  CloudDownload,
  Analytics,
  AdminPanelSettings,
  CorporateFare,
  CheckCircleOutline,
  TipsAndUpdates,
  WarningAmber,
} from "@mui/icons-material";

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactElement;
  roles: Array<"MANAGER" | "WAREHOUSE" | "TECHNICIAN">;
  keywords: string[];
  content: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "Administrator",
  WAREHOUSE: "Lager",
  TECHNICIAN: "Techniker",
};

const ROLE_COLORS: Record<string, "primary" | "secondary" | "success"> = {
  MANAGER: "primary",
  WAREHOUSE: "secondary",
  TECHNICIAN: "success",
};

const Step: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ListItem sx={{ py: 0.25, alignItems: "flex-start" }}>
    <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>
      <CheckCircleOutline fontSize="small" color="primary" />
    </ListItemIcon>
    <ListItemText primary={children} primaryTypographyProps={{ variant: "body2" }} />
  </ListItem>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Alert severity="info" icon={<TipsAndUpdates fontSize="small" />} sx={{ mt: 1.5, mb: 0.5, py: 0.5 }}>
    <Typography variant="body2">{children}</Typography>
  </Alert>
);

const Warn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Alert severity="warning" icon={<WarningAmber fontSize="small" />} sx={{ mt: 1.5, mb: 0.5, py: 0.5 }}>
    <Typography variant="body2">{children}</Typography>
  </Alert>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.72rem" }}>
    {children}
  </Typography>
);

const SECTIONS: HelpSection[] = [
  {
    id: "rollen",
    title: "Rollen & Berechtigungen",
    icon: <AdminPanelSettings />,
    roles: ["MANAGER", "WAREHOUSE", "TECHNICIAN"],
    keywords: ["rollen", "berechtigungen", "rechte", "manager", "lager", "techniker", "zugriff"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Jeder Benutzer hat eine Rolle, die bestimmt, welche Bereiche er sehen und bearbeiten darf.
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <AdminPanelSettings color="primary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>Administrator (MANAGER)</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Vollzugriff auf alle Funktionen: Artikel, Bestellungen, Berichte, Einstellungen, Benutzerverwaltung, Backup, Niederlassungen. Kann Rollen vergeben und Systemeinstellungen ändern.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Inventory2 color="secondary" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>Lager-Mitarbeiter (WAREHOUSE)</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Zugriff auf Lageroperationen: Artikel, Schnellbuchung, Lagerorte, Lieferanten, Bestellungen, Fahrzeugbestände. Kann die Benutzerliste einsehen (nicht bearbeiten), aber keine Systemeinstellungen ändern.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Build color="success" fontSize="small" />
              <Typography variant="subtitle2" fontWeight={700}>Techniker (TECHNICIAN)</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Zugriff auf das eigene Fahrzeug, Inventur-Ausführung und Artikelübersicht. Scanner für Buchungen. Offline-Modus verfügbar.
            </Typography>
          </Paper>
        </Stack>
        <Tip>Feingranulare Berechtigungen: im Bereich „Benutzer & Fahrzeuge" im Tab „Rollenrechte-Matrix" pro Rolle einzelne Rechte an-/abschalten. Im Tab „Benutzer-Overrides" lassen sich zusätzlich einzelne Benutzer abweichend von ihrer Rolle freischalten oder einschränken.</Tip>
      </Box>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: <Dashboard />,
    roles: ["MANAGER", "WAREHOUSE"],
    keywords: ["dashboard", "übersicht", "startseite", "kennzahlen", "statistiken", "bestand"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Das Dashboard gibt einen schnellen Überblick über den aktuellen Lagerzustand.
        </Typography>
        <SectionTitle>Anzeigebereiche</SectionTitle>
        <List dense disablePadding>
          <Step><strong>Kennzahlen-Karten:</strong> „Artikel gesamt" und „Offene Inventuren".</Step>
          <Step><strong>Offene Anforderungen (Lager):</strong> Zeigt, welche Techniker welche Artikel im Fahrzeug benötigen (Fehlmenge). Nach Techniker filterbar. Menge eintragen und „Bereitstellen" (einzeln oder „Alles") markiert die Anforderung als vom Lager erledigt – der Techniker sieht das dann in „Mein Fahrzeug" und kann es einbuchen.</Step>
          <Step><strong>Letzte Buchungen:</strong> Die jüngsten Ein- und Ausbuchungen auf einen Blick.</Step>
        </List>
        <Tip>Über „Dashboard anpassen" lassen sich die Anzeigebereiche ein-/ausblenden und in der Reihenfolge anpassen.</Tip>
      </Box>
    ),
  },
  {
    id: "quick-booking",
    title: "Schnellbuchung",
    icon: <QrCodeScanner />,
    roles: ["MANAGER", "WAREHOUSE"],
    keywords: ["schnellbuchung", "scannen", "barcode", "qr", "einbuchen", "ausbuchen", "buchung", "menge"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Mit der Schnellbuchung kannst du Artikel blitzschnell per Barcode/QR-Code ein- oder ausbuchen – ideal für den täglichen Lagerbetrieb.
        </Typography>
        <SectionTitle>Einbuchen (Wareneingang)</SectionTitle>
        <List dense disablePadding>
          <Step>Modus „Einbuchen" oben auswählen.</Step>
          <Step>Barcode oder QR-Code des Artikels scannen (oder manuell in das Suchfeld eingeben).</Step>
          <Step>Menge prüfen/anpassen – Standard ist 1.</Step>
          <Step>„Übernehmen" drücken, um den Artikel zur Buchungsliste hinzuzufügen.</Step>
          <Step>Alle Buchungen mit „Jetzt buchen" bestätigen und absenden.</Step>
        </List>
        <SectionTitle>Ausbuchen (Warenausgang)</SectionTitle>
        <List dense disablePadding>
          <Step>Modus „Ausbuchen" oben auswählen.</Step>
          <Step>Artikel scannen und Menge einstellen.</Step>
          <Step>Optional: Fahrzeug oder Lagerort für die Buchung angeben.</Step>
          <Step>Mit „Übernehmen" zur Liste hinzufügen, dann „Jetzt buchen".</Step>
        </List>
        <SectionTitle>Sofortbuchung</SectionTitle>
        <List dense disablePadding>
          <Step>Schalte „Sofort buchen" ein, damit jeder Scan sofort gebucht wird – ohne Bestätigungsschritt.</Step>
        </List>
        <SectionTitle>Vorgangsnummer (z.B. Auftrags-/Kundenbezug)</SectionTitle>
        <List dense disablePadding>
          <Step>Ist der Workflow „Vorgangsnummer → Artikel" aktiv, zuerst die Vorgangsnummer scannen oder eingeben.</Step>
          <Step>Alle danach gescannten Artikel werden dieser Vorgangsnummer zugeordnet – praktisch, wenn mehrere Techniker am selben Auftrag/Gerät arbeiten (die Liste ist geräteübergreifend sichtbar).</Step>
          <Step>Über „QR-Aktionscodes" lassen sich physische QR-Karten drucken, mit denen sich z.B. „Übernehmen" oder „Neue Vorgangsnummer" direkt scannen lässt, ohne den Bildschirm zu berühren.</Step>
        </List>
        <Tip>Nach jedem Scan wird die Menge automatisch auf 1 zurückgesetzt – so entstehen keine Fehlbuchungen.</Tip>
        <Tip>Die Duplikat-Warnung meldet sich, wenn derselbe Artikel innerhalb eines einstellbaren Zeitraums (Standard: einige Monate) bereits für denselben Kunden/Vorgang gebucht wurde – als Hinweis, nicht als Blockade.</Tip>
        <Warn>Stelle sicher, dass der richtige Modus (Einbuchen/Ausbuchen) aktiv ist, bevor du scannst.</Warn>
      </Box>
    ),
  },
  {
    id: "items",
    title: "Artikel",
    icon: <Inventory />,
    roles: ["MANAGER", "WAREHOUSE", "TECHNICIAN"],
    keywords: ["artikel", "items", "erstellen", "bearbeiten", "löschen", "barcode", "artikelcode", "mindestmenge", "kategorie", "bestand"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Die Artikelverwaltung ist das Herzstück des Lagersystems. Hier pflegst du alle Artikel mit ihren Stammdaten und Beständen.
        </Typography>
        <SectionTitle>Artikel anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>„Artikel anlegen" Button oben klicken.</Step>
          <Step>Code, Bezeichnung, Hersteller/Warengruppe und ggf. Lieferant eintragen.</Step>
          <Step>Mindestmenge und Sollbestand festlegen (löst Nachbestellvorschlag aus). Preis (EUR) ist optional und wird standardmäßig NICHT auf Bestellungs-PDFs angezeigt (siehe „Bestellungen").</Step>
          <Step>Alternative Codes (z.B. weitere Barcodes/EAN) als kommagetrennte Liste im Formularfeld hinterlegen – kein eigener Tab.</Step>
          <Step>Bild hochladen (optional).</Step>
          <Step>Speichern.</Step>
        </List>
        <SectionTitle>Ist-Bestand anpassen</SectionTitle>
        <List dense disablePadding>
          <Step>Artikel anklicken → im Formular das Feld „Ist-Bestand" auf den korrekten Wert ändern.</Step>
          <Step>Beim Speichern bucht das System automatisch die Differenz (Ein- oder Ausbuchung) – eine manuelle Typ-Auswahl gibt es nicht.</Step>
        </List>
        <SectionTitle>Import &amp; Export</SectionTitle>
        <List dense disablePadding>
          <Step>„Artikel importieren" → CSV-Datei hochladen, Feldmapping prüfen und Import bestätigen.</Step>
          <Step>„Hyreka Einmalimport" → separater, einmaliger Abgleich der Artikelstammdaten im Hyreka-Format (nicht zu verwechseln mit der laufenden Synchronisierung).</Step>
          <Step>„Artikel exportieren (CSV)" und „QR-Katalog (PDF)" exportieren die aktuelle (gefilterte) Artikelliste.</Step>
        </List>
        <Tip>Suchfunktion oben filtert nach Code, Bezeichnung oder alternativem Code. Zusätzlich nach Hersteller/Warengruppe filterbar, und über die Checkbox „Ohne Lagerort" lassen sich Artikel ohne zugewiesenen Lagerort anzeigen.</Tip>
        <Warn>Beim Löschen eines Artikels werden alle zugehörigen Buchungen, Bestellzeilen und Codes mitgelöscht. Diese Aktion ist nicht rückgängig zu machen.</Warn>
      </Box>
    ),
  },
  {
    id: "locations",
    title: "Lagerorte",
    icon: <Inventory2 />,
    roles: ["MANAGER", "WAREHOUSE"],
    keywords: ["lagerort", "lager", "standort", "regal", "fach", "location"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Lagerorte bilden die physischen Lagerbereiche ab (z.B. Regal A1, Toner-Lager, Hauptlager).
        </Typography>
        <SectionTitle>Lagerort anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>„+ Lagerort" klicken.</Step>
          <Step>Typ wählen: Lager, Regal, Schrank oder Fahrzeug – Regale/Schränke können einem übergeordneten Lager zugeordnet werden (z.B. „Regal 6 / Fach 2", „Schrank 8 / Schublade 5").</Step>
          <Step>Name und Beschreibung eingeben.</Step>
          <Step>Niederlassung zuweisen (bei mehreren Standorten).</Step>
          <Step>Speichern.</Step>
        </List>
        <SectionTitle>Lager-Isolation</SectionTitle>
        <List dense disablePadding>
          <Step>Benutzer können einem oder mehreren Lagerorten zugewiesen werden.</Step>
          <Step>Zugewiesene Benutzer sehen nur Artikel und Buchungen ihrer eigenen Lagerorte.</Step>
        </List>
        <Tip>Lagerorte können in Bestellungen und Buchungen direkt als Ziel angegeben werden.</Tip>
      </Box>
    ),
  },
  {
    id: "suppliers",
    title: "Lieferanten",
    icon: <Storefront />,
    roles: ["MANAGER", "WAREHOUSE"],
    keywords: ["lieferant", "supplier", "kontakt", "email", "bestellung"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Lieferanten werden Artikeln und Bestellungen zugeordnet. Hinterlege Kontaktdaten für den automatischen E-Mail-Versand von Bestellungen.
        </Typography>
        <SectionTitle>Lieferant anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>„+ Lieferant" klicken.</Step>
          <Step>Name, E-Mail-Adresse, optionale Kundennummer und Adresse/Notiz eintragen.</Step>
          <Step>Speichern.</Step>
        </List>
        <SectionTitle>Lieferant mit Artikel verknüpfen</SectionTitle>
        <List dense disablePadding>
          <Step>In der Artikelbearbeitung den Lieferanten im Dropdown auswählen.</Step>
          <Step>Bestellvorschläge verwenden diesen Lieferanten automatisch.</Step>
        </List>
        <Tip>Mit einer hinterlegten E-Mail-Adresse kann die Bestellung direkt aus dem System per E-Mail versandt werden.</Tip>
      </Box>
    ),
  },
  {
    id: "orders",
    title: "Bestellungen",
    icon: <LocalShipping />,
    roles: ["MANAGER", "WAREHOUSE"],
    keywords: ["bestellung", "bestellungen", "order", "bestellen", "pdf", "email", "wareneingang", "erhalten", "bestellvorschlag"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Verwalte Bestellungen von der Anlage über den Versand bis zum Wareneingang.
        </Typography>
        <SectionTitle>Neue Bestellung anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>„+ Neue Bestellung" klicken oder einen Bestellvorschlag übernehmen.</Step>
          <Step>Lieferant auswählen.</Step>
          <Step>Artikel und Mengen zur Bestellliste hinzufügen. Netto-Preis und MwSt.-Satz pro Position sind optional eintragbar.</Step>
          <Step>Bestellnummer (optional) und Notiz eintragen.</Step>
          <Step>Speichern → Status: ENTWURF.</Step>
        </List>
        <SectionTitle>Bestellung absenden</SectionTitle>
        <List dense disablePadding>
          <Step>Bestellung öffnen → „Als bestellt markieren".</Step>
          <Step>Optional: Bestellung als PDF herunterladen oder direkt per E-Mail an den Lieferanten senden.</Step>
          <Step>Status wechselt auf BESTELLT.</Step>
        </List>
        <SectionTitle>Wareneingang buchen</SectionTitle>
        <List dense disablePadding>
          <Step>Bestellung öffnen → „Wareneingang erfassen", Lieferschein-Nummer eintragen.</Step>
          <Step>Erhaltene Mengen eintragen (können von bestellten abweichen).</Step>
          <Step>„Einbuchen" → Bestand wird automatisch erhöht.</Step>
          <Step>Ist noch nicht alles vollständig erhalten, bleibt die Bestellung auf BESTELLT und „Wareneingang erfassen" kann später erneut für die restliche Menge genutzt werden (mehrere Teil-Lieferungen möglich, jede mit eigener Lieferschein-Nummer). Erst wenn alle Positionen vollständig sind, wechselt der Status direkt auf ARCHIVIERT und verschwindet automatisch aus der aktiven Liste (seit 16.09.2026) – kein manueller Archivieren-Klick mehr nötig.</Step>
        </List>
        <SectionTitle>Bestellung archivieren</SectionTitle>
        <List dense disablePadding>
          <Step>Ein vollständiger Wareneingang archiviert die Bestellung automatisch (siehe oben).</Step>
          <Step>Der „Archivieren"-Button bleibt trotzdem verfügbar, z. B. um eine Bestellung manuell zu archivieren, die nie vollständig geliefert wurde.</Step>
        </List>
        <SectionTitle>Bestellvorschläge</SectionTitle>
        <List dense disablePadding>
          <Step>Das System erkennt automatisch Artikel, die unter den Mindestbestand gefallen sind.</Step>
          <Step>Unter „Bestellvorschläge" werden diese gelistet – mit einem Klick als Bestellung übernehmen.</Step>
        </List>
        <Tip>Im Archiv findest du alle archivierten Bestellungen als PDF-Kopie.</Tip>
        <Tip>Unter Einstellungen → „Bestellungs-PDF-Vorlage" lässt sich mit einem visuellen Designer festlegen, welche Felder auf dem PDF erscheinen – inklusive Tabellenspalten, Kopf-/Fußzeile und Logo. Preis-Spalten sind dort bewusst standardmäßig ausgeblendet und müssen aktiv eingeblendet werden.</Tip>
      </Box>
    ),
  },
  {
    id: "movements",
    title: "Bewegungen & Berichte",
    icon: <TableChart />,
    roles: ["MANAGER"],
    keywords: ["bewegung", "buchung", "historie", "bericht", "report", "export", "csv", "filter", "verlauf"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Vollständige Buchungshistorie aller Lagerbewegungen mit Filter- und Exportfunktion.
        </Typography>
        <SectionTitle>Bewegungen filtern</SectionTitle>
        <List dense disablePadding>
          <Step>Nach Typ (Eingang/Ausgang/Korrektur), Zeitraum, Artikel, Fahrzeug oder Benutzer filtern.</Step>
          <Step>Filter kombinierbar – mehrere gleichzeitig aktiv möglich.</Step>
        </List>
        <SectionTitle>Berichte exportieren</SectionTitle>
        <List dense disablePadding>
          <Step>„Export" Button → CSV-Datei mit allen gefilterten Buchungen.</Step>
          <Step>Zeitraum-Filter vorher setzen, um nur relevante Daten zu exportieren.</Step>
        </List>
        <SectionTitle>Reichweitenprognose</SectionTitle>
        <List dense disablePadding>
          <Step>In den Bestellvorschlägen wird angezeigt, für wie viele Tage der aktuelle Bestand noch ausreicht (basierend auf dem Durchschnittsverbrauch).</Step>
        </List>
        <Tip>Fahrzeugbuchungen lassen sich separat filtern, um den Verbrauch pro Fahrzeug auszuwerten.</Tip>
        <Tip>Jede Buchung zeigt Herkunft und Notiz (z.B. „Wareneingang [Bestellnummer] · LS: [Lieferschein]" oder „Bereitgestellt für [Kennzeichen]") – hilfreich, um nachzuvollziehen, woher eine Buchung stammt.</Tip>
        <Tip>Für steuerliche Prüfungen (GoBD/GDPdU) steht ein „GDPdU-Export" zur Verfügung, der alle Bewegungsdaten in einem prüfungskonformen Format bereitstellt.</Tip>
      </Box>
    ),
  },
  {
    id: "fleet",
    title: "Fahrzeugbestände",
    icon: <DirectionsCar />,
    roles: ["MANAGER", "WAREHOUSE"],
    keywords: ["fahrzeug", "fleet", "bestand", "kennzeichen", "techniker", "fahrzeugbestand", "ziel", "soll"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Übersicht aller Fahrzeuge und ihrer aktuellen Bestände. Hier siehst du, was jeder Techniker im Fahrzeug hat.
        </Typography>
        <SectionTitle>Fahrzeugbestand anzeigen</SectionTitle>
        <List dense disablePadding>
          <Step>Fahrzeug oder Techniker über das Auswahlfeld filtern.</Step>
          <Step>Alle Artikel mit aktuellem Ist-Bestand und Sollbestand werden angezeigt, gruppiert nach Techniker.</Step>
          <Step>Status pro Artikel: „Fehlbestand" (Ist = 0, rot), „Unterbestand" (unter Soll, orange), „OK" (Soll erreicht, grün), „Überbestand" (mehr als Soll, blau).</Step>
        </List>
        <Warn>Die Sollmenge lässt sich auf dieser Übersichtsseite nicht ändern – das geschieht in „Mein Fahrzeug" durch den Techniker selbst (siehe dort).</Warn>
        <SectionTitle>Anforderungen bearbeiten (zentraler Nachschub-Workflow)</SectionTitle>
        <List dense disablePadding>
          <Step>Fehlt einem Techniker ein Artikel (Ist unter Soll), erscheint automatisch eine Anforderung im Dashboard-Bereich „Offene Anforderungen (Lager)".</Step>
          <Step>Lager trägt die bereitgestellte Menge ein und klickt „Bereitstellen" (oder „Alles" für die volle Fehlmenge) → Status wechselt auf „Bereitgestellt".</Step>
          <Step>Der Techniker sieht das in „Mein Fahrzeug" als Hinweis und bucht die bereitgestellte Menge mit einem Klick ein („+X vom Lager") → Status wechselt auf „Erledigt", der Bestand wird aktualisiert.</Step>
        </List>
        <SectionTitle>Fahrzeugbestand klonen</SectionTitle>
        <List dense disablePadding>
          <Step>„Bestand klonen" kopiert den kompletten Bestand (Soll-Mengen) eines Fahrzeugs auf ein anderes.</Step>
        </List>
        <SectionTitle>Techniker bekommt ein neues Fahrzeug</SectionTitle>
        <List dense disablePadding>
          <Step>Neues Fahrzeug anlegen (Benutzer &amp; Fahrzeuge → Tab „Fahrzeuge" → „+ Fahrzeug").</Step>
          <Step>„Bestand klonen" nutzen, um die Soll-Mengen vom alten auf das neue Fahrzeug zu übertragen.</Step>
          <Step>Teile physisch umräumen und die Buchungen entsprechend erfassen (aus dem alten Fahrzeug aus-, ins neue einbuchen).</Step>
          <Step>Den Techniker in Benutzer &amp; Fahrzeuge auf das neue Fahrzeug umstellen.</Step>
          <Step>Altes Fahrzeug archivieren oder löschen, sobald es nicht mehr gebraucht wird.</Step>
        </List>
        <Warn>Beim reinen Umbenennen des Kennzeichens am bestehenden Fahrzeug bleibt die komplette Bewegungshistorie unter diesem Datensatz erhalten und würde dann fälschlich so aussehen, als hätte sie im neuen Fahrzeug stattgefunden. Das nur tun, wenn es sich um eine reine Korrektur handelt (z.B. Tippfehler) und physisch dasselbe Fahrzeug gemeint ist – nicht bei einem echten Fahrzeugwechsel.</Warn>
        <Tip>Ein Scanner-Abgleich (Modus „Fahrzeugbestand scannen") ermöglicht es dem Techniker, seinen Bestand selbst zu erfassen.</Tip>
      </Box>
    ),
  },
  {
    id: "inventory",
    title: "Inventur",
    icon: <Assignment />,
    roles: ["MANAGER", "WAREHOUSE", "TECHNICIAN"],
    keywords: ["inventur", "zählen", "inventursitzung", "session", "abgleich", "differenz", "inventurvorlage"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Mit der Inventur erfasst du den tatsächlichen Lagerbestand und korrigierst Abweichungen gegenüber dem Buchbestand.
        </Typography>
        <SectionTitle>Inventur starten (Manager/Lager)</SectionTitle>
        <List dense disablePadding>
          <Step>„+ Neue Inventur" → Name und Lagerort/Vorlage wählen.</Step>
          <Step>Techniker oder Mitarbeiter der Sitzung zuweisen (optional).</Step>
          <Step>Inventur starten → Status: AKTIV.</Step>
        </List>
        <SectionTitle>Artikel zählen (Techniker/Lager)</SectionTitle>
        <List dense disablePadding>
          <Step>Offene Inventursitzung öffnen.</Step>
          <Step>Jeden Artikel scannen oder manuell suchen und Ist-Menge eintragen.</Step>
          <Step>Gezählte Artikel werden automatisch als „erfasst" markiert.</Step>
          <Step>„Sitzung abschließen" wenn alle Artikel gezählt sind.</Step>
        </List>
        <SectionTitle>Inventur abschließen (Manager)</SectionTitle>
        <List dense disablePadding>
          <Step>Sitzung öffnen → Differenzbericht einsehen (Soll vs. Ist).</Step>
          <Step>„Buchungen anwenden" → Bestandsunterschiede werden als Korrekturbuchungen ins System geschrieben.</Step>
        </List>
        <Warn>Die Bestandskorrektur kann nicht rückgängig gemacht werden. Vor dem Abschließen prüfen!</Warn>
        <Tip>Mit einer Inventurvorlage (Lagereinstellungen) kannst du festlegen, welche Artikel standardmäßig gezählt werden.</Tip>
        <Tip>Eine Inventur kann auch gezielt pro Fahrzeug durchgeführt werden (nicht nur pro Lagerort) – die Sitzung lässt sich für ein einzelnes Fahrzeug erneut öffnen, ohne die restliche Inventur zu beeinflussen.</Tip>
      </Box>
    ),
  },
  {
    id: "my-vehicle",
    title: "Mein Fahrzeug",
    icon: <Build />,
    roles: ["TECHNICIAN"],
    keywords: ["mein fahrzeug", "techniker", "scanner", "abgleich", "soll", "ist", "auffüllen"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Techniker verwalten ihren persönlichen Fahrzeugbestand hier. Der Tab ist nur für Benutzer mit zugewiesenem Fahrzeug sichtbar.
        </Typography>
        <SectionTitle>Bestand anzeigen</SectionTitle>
        <List dense disablePadding>
          <Step>Der aktuelle Ist-Bestand und der Sollbestand aller Fahrzeugartikel werden angezeigt, Artikel mit Fehlmenge stehen oben.</Step>
          <Step>Artikel unter Sollmenge sind rot hervorgehoben → Auffüllung erforderlich.</Step>
          <Step>Bei mehr als 25 Artikeln wird die Liste seitenweise angezeigt (Blättern unten). Suche und Scannen wirken immer auf den kompletten Bestand, unabhängig von der aktuellen Seite.</Step>
          <Step>Sollmenge pro Artikel kann direkt in der Liste selbst eingetragen und gespeichert werden.</Step>
        </List>
        <SectionTitle>Ein-/Ausbuchen per Scanner</SectionTitle>
        <List dense disablePadding>
          <Step>Modus „Ausbuchen", „Einbuchen" oder „Bestand prüfen" (nur Anzeige, keine Buchung) oben auswählen.</Step>
          <Step>„Scanner starten" aktivieren, Artikel scannen – jeder Scan bucht sofort die angegebene Menge (kein separater Abgleich-Abschluss-Schritt).</Step>
          <Step>„Scanner stoppen", wenn fertig.</Step>
        </List>
        <SectionTitle>Vom Lager bereitgestellte Artikel einbuchen</SectionTitle>
        <List dense disablePadding>
          <Step>Hat das Lager eine Anforderung bereitgestellt, erscheint ein Hinweis mit der bereitgestellten Menge.</Step>
          <Step>Mit „+X vom Lager" wird die Menge direkt eingebucht, ohne den Artikel erneut scannen zu müssen.</Step>
        </List>
        <SectionTitle>Offline-Modus</SectionTitle>
        <List dense disablePadding>
          <Step>Buchungen können auch ohne Internetverbindung erfasst werden.</Step>
          <Step>Bei Verbindungswiederherstellung werden alle Offline-Buchungen automatisch synchronisiert.</Step>
        </List>
        <Tip>Offline-Anmeldedaten werden sicher im Gerät gespeichert – du kannst dich auch ohne Internet einloggen.</Tip>
      </Box>
    ),
  },
  {
    id: "sync",
    title: "Synchronisierung",
    icon: <Sync />,
    roles: ["MANAGER", "TECHNICIAN"],
    keywords: ["sync", "synchronisierung", "offline", "hyreka", "abgleich", "import"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Verwalte Offline-Buchungen und externe Datensynchronisierung.
        </Typography>
        <SectionTitle>Offline-Buchungen</SectionTitle>
        <List dense disablePadding>
          <Step>Alle im Offline-Modus erfassten Buchungen werden hier aufgelistet.</Step>
          <Step>„Jetzt synchronisieren" überträgt alle ausstehenden Buchungen zum Server.</Step>
          <Step>Konflikte (z.B. zu wenig Bestand) werden als Fehler angezeigt und können überprüft werden.</Step>
        </List>
        <Warn>Nach max. 5 Fehlversuchen wird eine Buchung automatisch verworfen und aus der Warteschlange entfernt.</Warn>
        <Tip>Der Hyreka-Abgleich für Artikelstammdaten läuft NICHT hier, sondern über den Button „Hyreka Einmalimport" im Bereich „Artikel".</Tip>
      </Box>
    ),
  },
  {
    id: "settings",
    title: "Einstellungen",
    icon: <SettingsIcon />,
    roles: ["MANAGER"],
    keywords: ["einstellungen", "firma", "firmendaten", "logo", "email", "smtp", "lager", "vorlage", "qr", "template"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Systemweite Einstellungen, aufgeteilt in drei Bereiche.
        </Typography>
        <SectionTitle>Firmendaten</SectionTitle>
        <List dense disablePadding>
          <Step>Firmenname, Adresse, Logo und Kontaktdaten hinterlegen.</Step>
          <Step>Standard-MwSt. (%) zentral festlegen – wird als Vorschlag für neue Bestellpositionen verwendet.</Step>
          <Step>Diese Daten erscheinen auf Bestellungs-PDFs und E-Mails.</Step>
        </List>
        <SectionTitle>E-Mail Einstellungen</SectionTitle>
        <List dense disablePadding>
          <Step>SMTP-Server, Port, Benutzername und Passwort eintragen.</Step>
          <Step>TLS/SSL-Modus wählen.</Step>
          <Step>„Testmail senden" zur Überprüfung nutzen.</Step>
          <Step>E-Mail-Vorlage für Bestellungen anpassen.</Step>
        </List>
        <SectionTitle>Lagereinstellungen</SectionTitle>
        <List dense disablePadding>
          <Step>QR-Code-Vorlage für Artikeletiketten gestalten (Größe, Felder, Logo).</Step>
          <Step>Inventur-Vorlage: Standardartikelliste für neue Inventursitzungen.</Step>
          <Step>Bestellungs-PDF-Vorlage anpassen.</Step>
        </List>
        <SectionTitle>Wartung & Update</SectionTitle>
        <List dense disablePadding>
          <Step>Systemversion und Datenbankstatus anzeigen.</Step>
          <Step>Online-Update starten (jeder Administrator/Manager kann das auslösen).</Step>
          <Step>Ein Zurücksetzen einzelner Niederlassungsdaten ist zusätzlich abgesichert und nur für den Super-Admin (Konto ohne eigene Niederlassung) verfügbar.</Step>
        </List>
        <Tip>Änderungen an der E-Mail-Konfiguration gelten sofort – kein Neustart erforderlich.</Tip>
      </Box>
    ),
  },
  {
    id: "backup",
    title: "Datensicherung",
    icon: <CloudDownload />,
    roles: ["MANAGER"],
    keywords: ["backup", "sicherung", "restore", "wiederherstellen", "zip", "export", "import", "datensicherung"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Sichere regelmäßig alle Daten und stelle sie bei Bedarf wieder her.
        </Typography>
        <SectionTitle>Backup erstellen</SectionTitle>
        <List dense disablePadding>
          <Step>„Backup erstellen" → Das System erstellt ein ZIP-Archiv mit Datenbank-Dump, Bildern und Konfiguration.</Step>
          <Step>Die Datei wird automatisch heruntergeladen.</Step>
        </List>
        <SectionTitle>Backup wiederherstellen</SectionTitle>
        <List dense disablePadding>
          <Step>„ZIP-Archiv wiederherstellen" → zuvor erstelltes Backup hochladen.</Step>
          <Step>Vollständige Wiederherstellung: Das System extrahiert alle Daten und stellt den Zustand zum Backup-Zeitpunkt wieder her.</Step>
          <Step>Alternativ „Selektive Wiederherstellung": nur einzelne Bereiche zurückspielen (z.B. nur bestimmte Fahrzeuge oder Lagerorte), statt alles zu überschreiben.</Step>
        </List>
        <SectionTitle>Konfiguration exportieren</SectionTitle>
        <List dense disablePadding>
          <Step>Nur Systemkonfiguration (ohne Buchungsdaten) als JSON exportieren und importieren.</Step>
          <Step>Nützlich für die Einrichtung einer neuen Installation mit gleichen Einstellungen.</Step>
        </List>
        <Warn>Eine Wiederherstellung überschreibt alle aktuellen Daten. Vorher ein aktuelles Backup erstellen!</Warn>
        <Tip>Richte auf der NAS einen automatischen Cronjob ein, der täglich ein Backup in einen gesicherten Ordner schreibt.</Tip>
      </Box>
    ),
  },
  {
    id: "logs",
    title: "Systemprotokolle",
    icon: <Analytics />,
    roles: ["MANAGER"],
    keywords: ["logs", "protokoll", "systemlog", "fehler", "aktivität", "audit", "live"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Lückenlose Aufzeichnung aller sicherheitsrelevanten und betrieblichen Ereignisse.
        </Typography>
        <SectionTitle>Protokolltypen</SectionTitle>
        <List dense disablePadding>
          <Step><strong>AUTH:</strong> Login-Versuche, Passwortänderungen, Sperren.</Step>
          <Step><strong>STOCK:</strong> Alle Lagerein- und -ausgänge mit Benutzer und Zeitstempel.</Step>
          <Step><strong>VEHICLE, RESTOCK, USER, INVENTORY, PURCHASE, EMAIL:</strong> weitere Kategorien für Fahrzeug-, Anforderungs-, Benutzer-, Inventur-, Bestell- und E-Mail-Ereignisse.</Step>
          <Step><strong>SYSTEM:</strong> Migrationen, Backup-Ereignisse, Konfigurationsänderungen.</Step>
        </List>
        <Tip>Zusätzlich zur Kategorie hat jeder Eintrag eine Stufe (INFO, WARNING, ERROR, SECURITY) – SECURITY-Einträge (z.B. „alle Logs gelöscht") können nicht gelöscht werden.</Tip>
        <SectionTitle>Live-Protokoll</SectionTitle>
        <List dense disablePadding>
          <Step>Unter „Live-Protokolle" werden Ereignisse in Echtzeit angezeigt (WebSocket-basiert).</Step>
        </List>
        <SectionTitle>Filtern und Exportieren</SectionTitle>
        <List dense disablePadding>
          <Step>Nach Kategorie, Freitext (Aktion) und Zeitraum ("Von"/"Bis" mit Datum und Uhrzeit) filtern.</Step>
          <Step>Für Super-Admins bezieht die Suche ab dem Feld „Von" automatisch auch bereits archivierte Protokolle mit ein, sofern der Zeitraum in die Vergangenheit reicht – man muss also nicht separat im Archiv suchen. Archivierte Treffer sind mit einem „Archiv"-Chip gekennzeichnet und enthalten aus Datenschutzgründen keinen gespeicherten Benutzernamen, nur die Benutzer-ID.</Step>
          <Step>Bei sehr weit zurückliegenden/breiten Zeiträumen wird die Archiv-Suche auf ca. 400 Tage pro Anfrage begrenzt – ein Hinweis in der Filterleiste zeigt das an; den Zeitraum bei Bedarf enger fassen.</Step>
          <Step>Protokolle als CSV exportieren.</Step>
        </List>
        <SectionTitle>Archivierung (nur Super-Admin)</SectionTitle>
        <List dense disablePadding>
          <Step>Ganz unten im Bereich „Log-Verwaltung" lässt sich die Aktiv-Aufbewahrung einstellen (Standard: 90 Tage) – so lange bleiben Protokolle in der durchsuchbaren Liste, bevor sie ins Archiv wandern.</Step>
          <Step>Seit 16.09.2026 verschiebt ein automatischer nächtlicher Vorgang (04:00 Uhr) Protokolle, die älter als die eingestellte Frist sind, selbstständig in verschlüsselte Archivdateien und entfernt sie aus der aktiven Tabelle – ohne das wächst die Datenbank sonst unbegrenzt.</Step>
          <Step>Über den Button „Alle archivieren" kann das auch jederzeit manuell sofort angestoßen werden, z.B. um einen bestehenden Rückstand aufzuholen.</Step>
          <Step>Archivierte Protokolle bleiben mindestens 10 Jahre erhalten (§147 AO/GoBD) und sind über die separate Seite „Archiv-Verwaltung" einsehbar, herunterladbar (auch als ZIP) und – nach Ablauf der Aufbewahrungsfrist – löschbar.</Step>
        </List>
      </Box>
    ),
  },
  {
    id: "access-control",
    title: "Benutzer & Fahrzeuge",
    icon: <AdminPanelSettings />,
    roles: ["MANAGER"],
    keywords: ["benutzer", "user", "fahrzeug", "vehicle", "rollen", "passwort", "zugriff", "berechtigung", "anlegen", "löschen"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Benutzer und Fahrzeuge anlegen, Rollen zuweisen, Berechtigungen verwalten.
        </Typography>
        <SectionTitle>Benutzer anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>„+ Benutzer" klicken.</Step>
          <Step>Benutzername und Passwort vergeben.</Step>
          <Step>Rolle wählen: Administrator, Lager-Mitarbeiter oder Techniker.</Step>
          <Step>Optional: Niederlassung, Lagerort und Fahrzeug zuweisen.</Step>
          <Step>Speichern.</Step>
        </List>
        <SectionTitle>Passwort ändern</SectionTitle>
        <List dense disablePadding>
          <Step>Als Administrator für einen Benutzer: Benutzer anklicken → „Passwort ändern" (min. 8 Zeichen).</Step>
          <Step>Ändert ein Benutzer sein eigenes Passwort selbst (z.B. nach „Passwort vergessen"), gilt eine höhere Mindestlänge von 12 Zeichen.</Step>
          <Step>Die letzten 5 Passwörter können nicht wiederverwendet werden.</Step>
        </List>
        <SectionTitle>Zwei-Faktor-Authentifizierung (MFA)</SectionTitle>
        <List dense disablePadding>
          <Step>Jeder Benutzer kann MFA für sein eigenes Konto in den Benutzereinstellungen (Symbol oben rechts) aktivieren.</Step>
          <Step>Nach Aktivierung wird beim Login zusätzlich ein Code aus einer Authenticator-App abgefragt.</Step>
        </List>
        <SectionTitle>Fahrzeug anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>Tab „Fahrzeuge" → „+ Fahrzeug" klicken.</Step>
          <Step>Kennzeichen und Beschreibung eingeben.</Step>
          <Step>Fahrzeug einem Techniker zuweisen.</Step>
        </List>
        <Tip>Bekommt ein Techniker ein komplett neues Fahrzeug (nicht nur eine Kennzeichen-Korrektur), siehe „Techniker bekommt ein neues Fahrzeug" im Bereich Fahrzeugbestände – dort steht der komplette Ablauf inkl. Bestand umziehen.</Tip>
        <SectionTitle>Rollen & Berechtigungen</SectionTitle>
        <List dense disablePadding>
          <Step>Tab „Rollenrechte-Matrix" → Rolle auswählen → Berechtigungen aktivieren/deaktivieren.</Step>
          <Step>Tab „Benutzer-Overrides" → einzelne Benutzer abweichend von ihrer Rolle freischalten oder einschränken.</Step>
        </List>
        <Warn>Ein Benutzer kann sich nach 10 fehlgeschlagenen Anmeldeversuchen vorübergehend nicht mehr einloggen. Die Sperre läuft nach 15 Minuten automatisch ab.</Warn>
      </Box>
    ),
  },
  {
    id: "branches",
    title: "Niederlassungen",
    icon: <CorporateFare />,
    roles: ["MANAGER"],
    keywords: ["niederlassung", "standort", "filiale", "branch", "trennung", "isolation"],
    content: (
      <Box>
        <Typography variant="body2" gutterBottom>
          Bei mehreren Standorten können Niederlassungen angelegt werden, um Daten vollständig zu trennen.
        </Typography>
        <SectionTitle>Niederlassung anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>Nur Super-Admin (kein Niederlassungskennzeichen) kann neue Niederlassungen erstellen.</Step>
          <Step>„+ Niederlassung" → Name, Niederlassungsnummer und Adresse eingeben, aktiv schalten.</Step>
          <Step>Benutzer werden anschließend einzeln (unter „Benutzer & Fahrzeuge") der Niederlassung zugewiesen, nicht bereits beim Anlegen.</Step>
          <Step>Eigene SMTP-Einstellungen pro Niederlassung werden separat unter „E-Mail Einstellungen" konfiguriert.</Step>
        </List>
        <SectionTitle>Datentrennung</SectionTitle>
        <List dense disablePadding>
          <Step>Jede Niederlassung hat eigene Artikel, Bestände, Bestellungen und Fahrzeuge.</Step>
          <Step>Benutzer einer Niederlassung sehen nur die Daten ihrer eigenen Niederlassung.</Step>
          <Step>Der Super-Admin hat Einsicht in alle Niederlassungen.</Step>
        </List>
        <Tip>Niederlassungsübergreifende Berichte sind aktuell nicht verfügbar – jede Niederlassung wird separat ausgewertet.</Tip>
      </Box>
    ),
  },
];

const HelpPage: React.FC = () => {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MANAGER" | "WAREHOUSE" | "TECHNICIAN">("ALL");
  const [expanded, setExpanded] = useState<string | false>(false);

  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    return SECTIONS.filter((s) => {
      const matchesRole = roleFilter === "ALL" || s.roles.includes(roleFilter as any);
      if (!matchesRole) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.includes(q))
      );
    });
  }, [search, roleFilter]);

  const handleChange = (id: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? id : false);
  };

  return (
    <Box sx={{ maxWidth: 860, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Benutzerhandbuch
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Hier findest du Erklärungen und Schritt-für-Schritt-Anleitungen für alle Funktionen des Systems.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          size="small"
          placeholder="Funktion suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Stack direction="row" spacing={0.75} flexWrap="wrap">
          {(["ALL", "MANAGER", "WAREHOUSE", "TECHNICIAN"] as const).map((role) => (
            <Chip
              key={role}
              label={role === "ALL" ? "Alle Rollen" : ROLE_LABELS[role]}
              size="small"
              variant={roleFilter === role ? "filled" : "outlined"}
              color={role === "ALL" ? "default" : ROLE_COLORS[role]}
              onClick={() => setRoleFilter(role)}
              clickable
            />
          ))}
        </Stack>
      </Stack>

      {filteredSections.length === 0 && (
        <Alert severity="info">
          Keine Treffer für „{search}". Suchbegriff anpassen oder Filter zurücksetzen.
        </Alert>
      )}

      {filteredSections.map((section) => (
        <Accordion
          key={section.id}
          expanded={expanded === section.id}
          onChange={handleChange(section.id)}
          disableGutters
          sx={{
            mb: 1,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: "8px !important",
            "&:before": { display: "none" },
            boxShadow: "none",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
              <Box sx={{ color: "primary.main", display: "flex" }}>{section.icon}</Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {section.title}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Stack direction="row" spacing={0.5} sx={{ pr: 1 }}>
                {section.roles.map((role) => (
                  <Chip
                    key={role}
                    label={ROLE_LABELS[role]}
                    size="small"
                    variant="outlined"
                    color={ROLE_COLORS[role]}
                    sx={{ fontSize: "0.65rem", height: 20 }}
                  />
                ))}
              </Stack>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Divider sx={{ mb: 2 }} />
            {section.content}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default HelpPage;
