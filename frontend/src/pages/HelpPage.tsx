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
              Zugriff auf Lageroperationen: Artikel, Schnellbuchung, Lagerorte, Lieferanten, Bestellungen, Fahrzeugbestände. Keine Einstellungen oder Benutzerverwaltung.
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
        <Tip>Berechtigungen können im Bereich „Benutzer & Fahrzeuge" → „Rollen" feingranular angepasst werden.</Tip>
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
          <Step><strong>Bestandsübersicht:</strong> Zeigt Artikel mit kritischem oder niedrigem Bestand (unter Mindestmenge).</Step>
          <Step><strong>Nachbestellungsanfragen:</strong> Artikel, für die eine Nachbestellung ausgelöst wurde.</Step>
          <Step><strong>Letzte Buchungen:</strong> Die jüngsten Ein- und Ausbuchungen auf einen Blick.</Step>
          <Step><strong>Kennzahlen-Karten:</strong> Gesamtartikel, Gesamtbestand, offene Bestellungen.</Step>
        </List>
        <Tip>Klicke auf einen Artikel im Dashboard direkt, um zur Detailansicht zu gelangen.</Tip>
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
        <Tip>Nach jedem Scan wird die Menge automatisch auf 1 zurückgesetzt – so entstehen keine Fehlbuchungen.</Tip>
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
          <Step>„+ Artikel" Button oben rechts klicken.</Step>
          <Step>Name, Kategorie/Warengruppe und ggf. Lieferant eintragen.</Step>
          <Step>Mindestmenge und Sollbestand festlegen (löst Nachbestellvorschlag aus).</Step>
          <Step>Artikelcodes (Barcode/QR) im Tab „Codes" hinterlegen – mehrere pro Artikel möglich.</Step>
          <Step>Bild hochladen (optional).</Step>
          <Step>Speichern.</Step>
        </List>
        <SectionTitle>Bestand anpassen</SectionTitle>
        <List dense disablePadding>
          <Step>Artikel anklicken → „Bestand anpassen" Button.</Step>
          <Step>Menge und Typ (Eingang/Ausgang/Korrektur) wählen und bestätigen.</Step>
        </List>
        <SectionTitle>Artikel importieren (Hyreka)</SectionTitle>
        <List dense disablePadding>
          <Step>„Import" Button → CSV oder Hyreka-Format auswählen.</Step>
          <Step>Datei hochladen, Feldmapping prüfen und Import bestätigen.</Step>
        </List>
        <Tip>Verwende die Suchfunktion oben, um Artikel nach Name, Code oder Kategorie zu filtern.</Tip>
        <Warn>Beim Löschen eines Artikels werden alle zugehörigen Buchungen und Bestellzeilen mitgelöscht. Diese Aktion ist nicht rückgängig zu machen.</Warn>
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
          <Step>Name, E-Mail-Adresse und optionale Adresse/Notiz eintragen.</Step>
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
          <Step>Artikel und Mengen zur Bestellliste hinzufügen.</Step>
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
          <Step>Bestellung öffnen → „Wareneingang erfassen".</Step>
          <Step>Erhaltene Mengen eintragen (können von bestellten abweichen).</Step>
          <Step>„Einbuchen" → Bestand wird automatisch erhöht. Status: ERHALTEN.</Step>
        </List>
        <SectionTitle>Bestellvorschläge</SectionTitle>
        <List dense disablePadding>
          <Step>Das System erkennt automatisch Artikel, die unter den Mindestbestand gefallen sind.</Step>
          <Step>Unter „Bestellvorschläge" werden diese gelistet – mit einem Klick als Bestellung übernehmen.</Step>
        </List>
        <Tip>Im Archiv findest du alle abgeschlossenen Bestellungen als PDF-Kopie.</Tip>
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
          <Step>Fahrzeug in der Liste anklicken.</Step>
          <Step>Alle Artikel mit aktuellem Ist-Bestand und Sollbestand werden angezeigt.</Step>
          <Step>Rot = unter Sollbestand, Grün = Sollbestand erreicht oder überschritten.</Step>
        </List>
        <SectionTitle>Sollbestand festlegen</SectionTitle>
        <List dense disablePadding>
          <Step>Artikel im Fahrzeug anklicken → Sollmenge eintragen.</Step>
          <Step>Der Techniker sieht auf seinem Fahrzeug-Tab, welche Artikel aufgefüllt werden müssen.</Step>
        </List>
        <SectionTitle>Fahrzeugbestand klonen</SectionTitle>
        <List dense disablePadding>
          <Step>„Bestand klonen" kopiert den kompletten Bestand (Soll-Mengen) eines Fahrzeugs auf ein anderes.</Step>
        </List>
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
          <Step>Der aktuelle Ist-Bestand und der Sollbestand aller Fahrzeugartikel werden angezeigt.</Step>
          <Step>Artikel unter Sollmenge sind rot hervorgehoben → Auffüllung erforderlich.</Step>
        </List>
        <SectionTitle>Bestand per Scanner abgleichen</SectionTitle>
        <List dense disablePadding>
          <Step>„Scanner-Abgleich starten" aktivieren.</Step>
          <Step>Jeden Artikel im Fahrzeug scannen und die gezählte Menge eingeben.</Step>
          <Step>Am Ende „Abgleich abschließen" → Differenzen werden angezeigt.</Step>
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
        <SectionTitle>Hyreka-Abgleich</SectionTitle>
        <List dense disablePadding>
          <Step>Artikelstammdaten können mit dem Hyreka-System synchronisiert werden.</Step>
          <Step>Neue Artikel werden importiert, bestehende aktualisiert.</Step>
        </List>
        <Warn>Nach max. 5 Fehlversuchen wird eine Buchung automatisch verworfen und aus der Warteschlange entfernt.</Warn>
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
          <Step>Online-Update starten (nur Super-Admin / ohne Niederlassungszuweisung).</Step>
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
          <Step>Das System extrahiert alle Daten und stellt den Zustand zum Backup-Zeitpunkt wieder her.</Step>
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
          <Step><strong>SYSTEM:</strong> Migrationen, Backup-Ereignisse, Konfigurationsänderungen.</Step>
          <Step><strong>ERROR:</strong> Anwendungsfehler und Ausnahmen.</Step>
        </List>
        <SectionTitle>Live-Protokoll</SectionTitle>
        <List dense disablePadding>
          <Step>Unter „Live-Protokolle" werden Ereignisse in Echtzeit angezeigt (WebSocket-basiert).</Step>
        </List>
        <SectionTitle>Filtern und Exportieren</SectionTitle>
        <List dense disablePadding>
          <Step>Nach Kategorie, Zeitraum oder Benutzer filtern.</Step>
          <Step>Protokolle als CSV exportieren.</Step>
        </List>
        <Tip>Die Protokolle werden für eine konfigurierbare Zeitspanne aufbewahrt (Retention Policy in den Lagereinstellungen).</Tip>
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
          <Step>Benutzer anklicken → „Passwort ändern".</Step>
          <Step>Neues Passwort eingeben (min. 8 Zeichen). Die letzten 5 Passwörter können nicht wiederverwendet werden.</Step>
        </List>
        <SectionTitle>Fahrzeug anlegen</SectionTitle>
        <List dense disablePadding>
          <Step>Tab „Fahrzeuge" → „+ Fahrzeug" klicken.</Step>
          <Step>Kennzeichen und Beschreibung eingeben.</Step>
          <Step>Fahrzeug einem Techniker zuweisen.</Step>
        </List>
        <SectionTitle>Rollen & Berechtigungen</SectionTitle>
        <List dense disablePadding>
          <Step>Tab „Rollen" → Rolle auswählen → Berechtigungen aktivieren/deaktivieren.</Step>
          <Step>Feingranulare Steuerung, welche Aktionen jede Rolle durchführen darf.</Step>
        </List>
        <Warn>Ein Benutzer kann sich nach 5 fehlgeschlagenen Anmeldeversuchen nicht mehr einloggen (Kontosperrung). Administrator kann die Sperre aufheben.</Warn>
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
          <Step>„+ Niederlassung" → Name und SMTP-Einstellungen für diesen Standort eingeben.</Step>
          <Step>Benutzer der Niederlassung zuweisen.</Step>
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
