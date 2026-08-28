# KFZ Lagerverwaltung – Benutzerhandbuch

**Version 4.2 · Stand: August 2026**

---

## Inhaltsverzeichnis

0. [Installation & Ersteinrichtung](#0-installation--ersteinrichtung)
1. [Überblick](#1-überblick)
2. [Benutzerrollen](#2-benutzerrollen)
3. [Schnellbuchung](#3-schnellbuchung)
4. [Teile scannen (Fahrzeug-Scanner)](#4-teile-scannen-fahrzeug-scanner)
5. [Artikelverwaltung](#5-artikelverwaltung)
6. [Fahrzeuge & Bestand](#6-fahrzeuge--bestand)
7. [Bestellvorschläge & Einkauf](#7-bestellvorschläge--einkauf)
8. [Berichte & Analysen](#8-berichte--analysen)
9. [Inventur](#9-inventur)
10. [Lagerorte](#10-lagerorte)
11. [Lieferanten](#11-lieferanten)
12. [Backup & Wiederherstellung](#12-backup--wiederherstellung)
13. [Benutzerverwaltung & Zugriffssteuerung](#13-benutzerverwaltung--zugriffssteuerung)
14. [Einstellungen & Konfiguration](#14-einstellungen--konfiguration)
    - [14.5 Log-Archive](#145-log-archive-administration)
15. [Offline-Betrieb](#15-offline-betrieb)
16. [Häufige Fragen (FAQ)](#16-häufige-fragen-faq)

---

## 0. Installation & Ersteinrichtung

### Voraussetzungen

| Komponente | Mindestversion | Hinweis |
|------------|----------------|---------|
| Docker | 24+ | inkl. Docker Compose v2 |
| RAM | 2 GB | 4 GB empfohlen für NAS-Betrieb |
| Speicher | 5 GB | für Images, DB und Dateiablage |
| Netzwerk | LAN | HTTPS über selbstsigniertes Zertifikat (Caddy) |

> **Windows/Mac lokal:** Docker Desktop installieren. **Synology NAS:** Paket „Container Manager" im Paketcenter installieren.

---

### 0.1 Erstinstallation auf dem NAS (Synology)

1. **Projektdateien auf die NAS kopieren**

   Lade das Repository als ZIP von GitHub herunter und entpacke es auf der NAS, z.B. nach:
   ```
   /volume1/docker/Lagerverwaltung/
   ```

2. **Konfigurationsdatei anlegen**

   Im Projektverzeichnis liegt `.env.example`. Diese Datei kopieren und umbenennen:
   ```bash
   cp .env.example .env
   ```

3. **`.env` anpassen** – alle Werte mit `AENDERN_` **müssen** geändert werden:

   | Variable | Beschreibung | Beispiel |
   |----------|-------------|---------|
   | `MYSQL_ROOT_PASSWORD` | Root-Passwort MySQL (min. 20 Zeichen) | zufälliger String |
   | `MYSQL_USER` | DB-Benutzer | `lagerverwaltung` |
   | `MYSQL_PASSWORD` | DB-Passwort (min. 20 Zeichen) | zufälliger String |
   | `BACKEND_JWT_SECRET` | JWT-Signierungsschlüssel (min. 32 Zeichen) | `openssl rand -hex 32` |
   | `INVENTORY_HMAC_SECRET` | Inventur-Checksummen (min. 32 Zeichen) | `openssl rand -hex 32` |
   | `CADDY_HTTPS_PORT` | HTTPS-Port der App | `8443` |
   | `CADDY_HTTP_PORT` | HTTP-Port (Weiterleitung auf HTTPS) | `8080` |
   | `LOG_ARCHIVE_ENCRYPTION_KEY` | **Empfohlen:** Passphrase für AES-256-GCM-Verschlüsselung der Log-Archive (optional) | beliebiger String |
   | `PUPPETEER_DISABLE_SANDBOX` | Auf `true` setzen wenn Puppeteer im Container keine Sandbox nutzen darf (Synology) | `true` |

   **Dateiablage-Pfade** (optional, aber empfohlen für NAS-Zugriff per SMB):
   ```env
   BACKUP_STORAGE_HOST_PATH=/volume1/docker/Lagerverwaltung/backups
   PURCHASE_ORDER_STORAGE_HOST_PATH=/volume1/docker/Lagerverwaltung/purchase-orders
   DELIVERY_NOTES_STORAGE_HOST_PATH=/volume1/docker/Lagerverwaltung/lieferscheine
   ITEM_IMAGE_STORAGE_HOST_PATH=/volume1/docker/Lagerverwaltung/item-images
   LOG_ARCHIVE_STORAGE_HOST_PATH=/volume1/docker/Lagerverwaltung/log-archives
   ```
   Wenn diese Pfade leer bleiben, verwendet Docker interne Named Volumes (Daten bleiben erhalten, aber nicht per SMB sichtbar).

4. **System starten**

   Per SSH auf der NAS:
   ```bash
   cd /volume1/docker/Lagerverwaltung
   sudo ./deploy/start.sh
   ```
   Das Skript startet alle Container, wartet auf MySQL und richtet die Datenbankstruktur automatisch ein.

5. **App aufrufen**

   Browser öffnen und die NAS-IP mit dem konfigurierten Port aufrufen:
   ```
   https://192.168.1.100:8443
   ```
   Beim ersten Aufruf erscheint eine Browser-Warnung wegen des selbstsignierten Zertifikats → „Erweitert → Trotzdem fortfahren" klicken.

6. **Erstkonfiguration im Browser**

   Beim allerersten Start erscheint der **Einrichtungsassistent**:
   - Administrator-Konto anlegen (Benutzername + sicheres Passwort)
   - Erste Niederlassung anlegen (Name, Standort-Code z.B. `HAN`)
   - Grundeinstellungen (Firmenname, E-Mail)

---

### 0.2 Lokale Installation (Entwicklung / Test)

```bash
git clone https://github.com/Sirbuschi2003/Lagerverwaltung.git
cd Lagerverwaltung
cp .env.example .env
# .env nach Bedarf anpassen (Standard-Werte funktionieren lokal)
docker compose up -d --build
```

App erreichbar unter: `https://localhost:8443`

---

### 0.3 Update auf eine neue Version

1. Neue Dateien auf die NAS kopieren (ZIP von GitHub herunterladen und entpacken)
2. **`.env` beibehalten** – die bestehende Datei wird nicht überschrieben
3. Update-Skript ausführen:
   ```bash
   sudo ./deploy/start.sh
   ```
   Das Skript baut neue Images, führt Datenbankmigrationen aus und startet die Container neu. Vor jeder Migration wird **automatisch ein Backup** erstellt.

Alternativ kann das Update direkt über die Web-Oberfläche ausgelöst werden:  
**Administration → Wartung & Update → System aktualisieren**

---

### 0.4 Container-Übersicht

| Container | Aufgabe | Port (intern) |
|-----------|---------|---------------|
| `caddy` | Reverse-Proxy, HTTPS-Termination | 80 / 443 |
| `backend` | NestJS API | 3000 |
| `frontend` | React App (nginx) | 80 |
| `mysql` | Datenbank | 3306 |

```bash
# Status prüfen
sudo docker compose ps

# Logs anzeigen
sudo docker compose logs -f backend

# Neustart (löst die meisten Probleme)
sudo ./deploy/start.sh
```

---

### 0.5 Datensicherung der Volumes

Alle persistenten Daten liegen in den konfigurierten Host-Pfaden (siehe Schritt 3) oder in Docker Named Volumes. Für ein vollständiges NAS-Backup reicht es, das Verzeichnis `/volume1/docker/Lagerverwaltung/` zu sichern.

Zusätzlich steht in der App unter **Administration → Backup** ein Datenbank-Backup als JSON oder SQL-Dump zur Verfügung.

---

## 1. Überblick

Die KFZ Lagerverwaltung ist eine webbasierte Plattform zur Verwaltung von Ersatzteilen im Fuhrpark. Kernfunktionen:

- **Lagerbestand** erfassen, buchen und in Echtzeit verfolgen
- **Bestellvorschläge** automatisch berechnen (Meldebestand, Soll-Bestand, Reichweitenprognose)
- **QR-/Barcode-Scanning** direkt im Browser (Kamera oder USB-Scanner)
- **Offline-fähig** – Buchungen werden lokal gespeichert und automatisch synchronisiert
- **Mehrere Niederlassungen** mit strikter Datentrennung
- **Rollen & Berechtigungen** – granulare Zugriffssteuerung pro Benutzer

---

## 2. Benutzerrollen

| Rolle | Kurzname | Typische Aufgabe |
|-------|----------|-----------------|
| Super-Administrator | SUPER_ADMIN | Systemweit alle Daten, Wartung, NL-Verwaltung |
| Manager | MANAGER | Niederlassungsleitung, Bestellungen, Berichte |
| Lagermitarbeiter | WAREHOUSE | Wareneingang, Schnellbuchung, Bestellvorschläge |
| Techniker | TECHNICIAN | Teile aus Fahrzeug entnehmen/einbuchen, eigene Codes pflegen |
| Nur-Lesen | VIEWER | Berichte und Bestände einsehen |

Zusätzlich zu Rollen können einzelne Berechtigungen pro Benutzer aktiviert oder entzogen werden (unter **Zugriffssteuerung → Benutzer-Overrides**).

---

## 3. Schnellbuchung

Die Schnellbuchung ist das zentrale Werkzeug für den täglichen Lagerbetrieb. Aufruf über den Menüpunkt **Schnellbuchung**.

### 3.1 Ablauf

1. **Vorgangsnummer eingeben** (oder scannen) – z.B. `LFS/461101/101574/400`
2. **Artikel scannen** – Barcode-Scanner, Kamera oder manuelle Eingabe (ab 2 Zeichen Freitextsuche)
3. Menge anpassen (Standard: 1)
4. Weitere Artikel scannen
5. **Übernehmen** – alle Artikel werden gleichzeitig gebucht

### 3.2 Buchungsarten

| Art | Beschreibung |
|-----|-------------|
| **Lagerentnahme** | Artikel geht raus (z.B. zum Kunden) – reduziert den Lagerbestand |
| **Wareneingang** | Artikel kommt rein (z.B. von Lieferant) – erhöht den Lagerbestand |

### 3.3 Sofort-Buchen

Checkbox „Sofort buchen" aktivieren: Jeder Scan wird sofort gebucht, die Liste wird nicht aufgebaut. Nützlich wenn nur ein Artikel pro Vorgang gebucht wird.

### 3.4 Duplikat-Warnung

Wenn ein Artikel gescannt wird und dieselbe Kundennummer (aus der Vorgangsnummer) innerhalb des konfigurierten Zeitraums denselben Artikel erhalten hat, erscheint eine **gelbe Warnmeldung** auf der Seite:

> ⚠ TB-FC330 – bereits an Kunde 461101 ausgebucht  
> 15.04.2026 · Vorgang: LFS/461101/89999/200 · 2 Stk.

Die Warnung blockiert **nicht** – der Scan-Ablauf läuft normal weiter. Die Warnung kann mit ✕ geschlossen werden.

**Konfiguration** (unter dem Workflow-Toggle auf der Schnellbuchungsseite):
- Toggle ein/aus
- Zeitraum: 1 / 2 / 3 / 6 / 12 Monate

Die Einstellung wird pro Benutzer gespeichert und gilt auf allen Geräten.

### 3.5 Echtzeit-Sync (PC ↔ Handy)

Ist derselbe Benutzer gleichzeitig auf PC und Handy eingeloggt, wird die Buchungsliste in Echtzeit synchronisiert. Ein Scan auf dem Handy erscheint sofort auf dem PC. „Übernehmen" und „Löschen" wirken auf allen Geräten.

### 3.6 Workflow-Einstellung

Toggle „Workflow" direkt im Formular:
- **EIN (Vorgangsnummer → Artikel):** Fokus liegt beim Start auf der Vorgangsnummer (z.B. Tonerlager)
- **AUS (Direkt Artikel):** Fokus liegt beim Start auf dem Barcode-Feld (z.B. Teilelager)

---

## 4. Teile scannen (Fahrzeug-Scanner)

Für Techniker, die Teile direkt vom Fahrzeug buchen. Aufruf unter **Mein Fahrzeug**.

- QR-/Barcode per Kamera scannen oder Code manuell eingeben
- Modus über den **Umschalter** im oberen Bereich wählen:

| Modus | Funktion |
|-------|----------|
| **Ausbuchen** | Artikel aus dem Fahrzeug entnehmen (Bestand sinkt) |
| **Einbuchen** | Artikel ins Fahrzeug einlegen (Bestand steigt) |
| **Bestand prüfen** | Nur Anzeige – kein Buchen. Zeigt aktuellen Fahrzeugbestand für den gescannten Artikel |

- Scanner starten → Modus „Bestand prüfen" → Code scannen → Bestand wird angezeigt (grün = vorhanden, rot = 0)
- Nicht gefundene Artikel können direkt angelegt werden
- Offline-fähig: Buchungen werden bei fehlender Verbindung lokal gespeichert

---

## 5. Artikelverwaltung

Aufruf unter **Artikel**.

### 5.1 Artikelfelder

| Feld | Beschreibung |
|------|-------------|
| **Artikelcode** | Primärer Code (Pflicht, niederlassungsweit eindeutig) |
| **Weitere Codes** | Alternative Codes/Barcodes (werden ebenfalls beim Scannen erkannt) |
| **Bezeichnung 1 / 2** | Beschreibung und optionaler Zusatz |
| **Hersteller** | Herstellername |
| **Warengruppe** | Produktkategorie |
| **Lagerort** | Primärer Lagerort (Regal/Fach) |
| **Soll-Bestand** | Ziel-Bestand nach Auffüllung |
| **Meldebestand** | Ab diesem Wert wird Nachbestellung ausgelöst |
| **Mindestbestand** | Sicherheitspuffer (Filter „Mindestbestand unterschritten") |
| **Verpackungseinheit** | Mindestbestellmenge (packSize) |
| **Bilder** | Fotos per Kamera oder Datei-Upload |

### 5.2 Import

- **CSV-Import:** Spalten `Artikelcode`, `Bezeichnung`, `Hersteller`, `Warengruppe`, `Soll-Bestand` u.a. – vollständige Spaltenliste im Import-Dialog
- **Hyreka-Import:** Direktimport aus Hyreka-Exportdatei; `alarmbes` → Meldebestand, `mindestbes` → Mindestbestand

### 5.3 Artikeldetails

Klick auf einen Artikel öffnet den Detaildialog. Der Umfang hängt von der Rolle ab:

**Manager / Lagermitarbeiter:** Alle Felder editierbar (Stammdaten, Lagerort, Preise, Bestände).

**Techniker:** Der Dialog ist weitgehend schreibgeschützt.
- Stammdaten (Bezeichnung, Hersteller, etc.) sind nur zur Ansicht – grau, nicht änderbar
- **QR-Code** und **Weitere Codes** können Techniker bearbeiten und speichern (eigene Fahrzeugcodes)
- **Im Fahrzeug:** zeigt den eigenen aktuellen Fahrzeugbestand für diesen Artikel
- **Im Teilelager:** zeigt den Lagerbestand (nur Ansicht)
- Kein Zugriff auf Preise, Lagerort, Soll-/Melde-/Mindestbestand

---

## 6. Fahrzeuge & Bestand

### 6.1 Flottenübersicht

Zeigt alle Fahrzeuge mit aktuellem Bestand. Klick auf ein Fahrzeug öffnet die Detailansicht mit allen Artikeln, Beständen und Fehlmengen.

### 6.2 Mein Fahrzeug

Techniker sehen hier ihren persönlichen Fahrzeugbestand. Fehlbestände können direkt als Nachbestellung gemeldet werden.

**Bestand prüfen (Scan):** Der Modus-Umschalter oben bietet neben Ein-/Ausbuchen auch „Bestand prüfen". Scanner starten → Artikel scannen → Fahrzeugbestand wird sofort angezeigt, ohne zu buchen. Nützlich um schnell nachzusehen wie viele Stück eines Teils noch im Wagen sind.

### 6.3 Bestand buchen

- **CHECK_OUT:** Artikel aus Fahrzeug entnehmen
- **CHECK_IN:** Artikel ins Fahrzeug einlegen
- **ADJUSTMENT:** Bestandskorrektur (nur Manager/Admin)

---

## 7. Bestellvorschläge & Einkauf

### 7.1 Bestellvorschläge

Aufruf unter **Bestellungen → Bestellvorschläge**.

Das System berechnet Bestellvorschläge für alle Artikel, bei denen der Bestand den Meldebestand unterschreitet oder der Soll-Bestand nicht erreicht wird.

**Angezeigte Informationen je Artikel:**
| Spalte | Bedeutung |
|--------|-----------|
| Aktueller Bestand | Aktueller Lagerbestand |
| Meldebestand | Schwellwert für Nachbestellung |
| Soll-Bestand | Ziel nach Auffüllung |
| Benötigt | Differenz (Soll – Ist – Zulauf) |
| Zulauf | Bereits bestellte, noch nicht eingegangene Menge |
| Reichweite | Voraussichtliche Reichweite in Tagen (aus Verbrauchsdaten) |
| Verfügbar bei anderen NL | Chips zeigen Bestand in anderen Niederlassungen |

**Filter:**
- Nur Meldebestand unterschritten
- Nur Mindestbestand unterschritten
- Nach Lager filtern

Klick auf die Artikelnummer öffnet den Artikeldialog direkt.

### 7.2 Bestellungen erstellen

1. Bestellvorschläge auswählen oder manuell Artikel hinzufügen
2. Lieferant auswählen
3. Bestellung bestätigen → PDF wird generiert und gespeichert
4. **Status-Flow:** ENTWURF → BESTELLT → ARCHIVIERT

### 7.3 Wareneingang

1. Bestellung öffnen → Button **„Eingang"**
2. Lieferscheinnummer eingeben (optional, bei Fehlen erscheint ein Bestätigungsdialog)
3. Artikel scannen oder Menge manuell eingeben
4. Scan-Treffer mit **„OK übernehmen"** oder per **CONFIRM-QR-Code** bestätigen
5. Am Ende **„Wareneingang buchen"** klicken
6. Bei vollständigem Eingang wird die Bestellung automatisch archiviert

**Ablauf mit Handscanner (empfohlene Methode):**

| Schritt | Aktion |
|---------|--------|
| 1 | Artikel-Barcode scannen → Scan-Treffer erscheint mit Vorschlagsmenge |
| 2 | Menge prüfen (ggf. anpassen) |
| 3 | **CONFIRM-QR-Code** scannen → bestätigt den Treffer (= „OK übernehmen") |
| 4 | Nächsten Artikel scannen |
| 5 | „Wareneingang buchen" manuell klicken |

**CONFIRM-QR-Code drucken:**
- Im Wareneingang-Dialog auf **„CONFIRM-QR"** (Drucker-Symbol) klicken
- QR-Code-Dialog öffnet sich → **„Drucken"** → A6-Ausdruck
- Ausgedruckten Code im Lager aufhängen oder am Scanner-Arbeitsplatz anbringen
- Der CONFIRM-Code bestätigt **nur den aktuellen Scan-Treffer** — er löst **nicht** die Gesamtbuchung aus

**Draft-Persistenz (Tab-Wechsel):**
- Vorgemerkte Positionen (nach „OK übernehmen") werden automatisch zwischengespeichert
- Bei Tab-Wechsel oder Navigation zu einer anderen Seite bleibt der Stand erhalten
- Nach Rückkehr: Orange-Banner **„Vorgemerkter Entwurf geladen"** erscheint
- In der Bestellungsliste zeigt ein Chip **„Vorgemerkt"** an, welche Bestellung einen offenen Entwurf hat
- Der Entwurf wird erst nach erfolgreichem **„Wareneingang buchen"** automatisch gelöscht

---

## 8. Berichte & Analysen

Aufruf unter **Berichte & Analysen**.

### 8.1 Bewegungshistorie

Alle Ein- und Ausbuchungen mit Filtern nach:
- Zeitraum
- Artikel
- Fahrzeug / Lager
- Buchungstyp
- Vorgangsnummer (Suche via SQL-LIKE)
- Fahrzeugbuchungen ein-/ausblenden

Klick auf das PDF-Icon neben einer Buchung öffnet den zugehörigen Lieferschein (falls vorhanden).

**Pagination:** Standard 50 Zeilen, wählbar 25 / 50 / 100.

### 8.2 Lagerbestand-Bericht

Tabellarischer Überblick aller Artikel mit aktuellem Bestand, Soll-Bestand, Fehlmenge. Export als Excel möglich.

### 8.3 Verbrauchsprognose

- Zeiträume: 7 / 30 / 60 / 90 / 180 / 365 Tage
- Zeigt: Verbrauch gesamt, Verbrauch pro Tag, Reichweite in Tagen
- Datenqualitäts-Warnung wenn Datenbasis zu gering für zuverlässige Prognose

### 8.4 Artikel-Auswertung

- Verbrauch nach Warengruppe und Hersteller
- Klick auf einen Artikel öffnet Detailansicht mit vollständiger Buchungshistorie im gewählten Zeitraum

---

## 9. Inventur

Aufruf unter **Inventur**.

### 9.1 Sitzung erstellen

1. „Neue Inventur" starten
2. Name und Lager/Fahrzeug wählen
3. Optional: Benutzer zuweisen (Manager können mehrere Benutzer zuweisen)

### 9.2 Inventur durchführen

- Artikel scannen oder manuell eingeben
- Gezählte Menge eintragen
- Abweichungen werden sofort sichtbar

### 9.3 Finalisieren

- Manager kann die Sitzung finalisieren
- Bestandsabgleich wird ausgeführt: Abweichungen werden als ADJUSTMENT gebucht
- Excel-Export der Inventurergebnisse

---

## 10. Lagerorte

Aufruf unter **Einstellungen → Lagerorte**.

### Hierarchie

```
Lager (Typ: WAREHOUSE)
└── Regal (Typ: SHELF)
    └── Fach (Typ: BIN)
```

- Benutzer können einem oder mehreren Lagern zugewiesen werden
- Ein Benutzer ohne Lagerzuweisung sieht alle Lager seiner Niederlassung
- Strikte Isolation: Artikel, Bestellvorschläge und Berichte filtern nach dem zugewiesenen Lager

---

## 11. Lieferanten

Aufruf unter **Lieferanten**.

- Stammdaten: Name, Kontakt, Adresse, Lieferzeit, Mindestbestellwert
- Zuweisung zu einem Lager (Teilelager / Tonerlager)
- Verknüpfung mit Bestellvorschlägen: Lieferant wird beim Erstellen einer Bestellung vorausgewählt

---

## 12. Backup & Wiederherstellung

Aufruf unter **Administration → Backup**.

### 12.1 Backup erstellen

- **Vollständiges Backup:** alle Daten inkl. Artikel, Bestände, Buchungshistorie, Bestellungen, Benutzer
- **MySQL SQL-Dump:** direkter Download als `.sql.gz` – für manuelle Sicherung oder Migration

Vor jedem Datenbankupdate (Migration) wird automatisch ein Backup erstellt.

> **Sicherheitshinweis:** Passwort-Hashes werden **nicht** in das JSON-Backup exportiert. Nach einem Restore sind alle Benutzerkonten gesperrt – der Administrator muss die Passwörter über **Benutzer → Passwort zurücksetzen** für alle Benutzer neu vergeben.

### 12.2 Backup wiederherstellen

1. Backup-Datei hochladen
2. Datenkategorien auswählen (granulare Wiederherstellung – jede Kategorie einzeln aktivierbar)
3. Restore starten – vollständige Transaktion, automatischer Rollback bei Fehler
4. **Passwörter zurücksetzen** – nach einem vollständigen Restore alle Benutzerpasswörter neu vergeben

---

## 13. Benutzerverwaltung & Zugriffssteuerung

### 13.1 Benutzer anlegen

Aufruf unter **Benutzer**.

- Benutzername, Passwort, Rolle, Niederlassung, Fahrzeug-/Lager-Zuweisung
- E-Mail für Benachrichtigungen

### 13.2 Rollen & Berechtigungen

Aufruf unter **Zugriffssteuerung**.

**Tabs:**
| Tab | Funktion |
|-----|----------|
| Benutzer | Benutzerliste mit Rollenübersicht |
| Rollen verwalten | Rollen anlegen und benennen |
| Rollenrechte-Matrix | Alle Rechte pro Rolle tabellarisch ein-/ausschalten |
| Benutzer-Overrides | Einzelne Rechte für bestimmte Benutzer aktivieren (GRANT) oder entziehen (DENY) |
| Fahrzeuge | Fahrzeug-Zuweisung je Benutzer |

**Benutzer-Overrides (DENY-Mechanismus):**
- GRANT: Recht zusätzlich zur Rolle gewähren
- DENY: Recht trotz Rolle entziehen (auch für Manager möglich)

---

## 14. Einstellungen & Konfiguration

### 14.1 Allgemeine Einstellungen

Aufruf unter **Einstellungen**.

- Firmenname und Logo
- E-Mail-Konfiguration (SMTP) – niederlassungsspezifisch
- Benachrichtigungsregeln (Push/E-Mail bei Fehlbestand)

### 14.2 PDF-Vorlagen

Aufruf unter **Einstellungen → PDF-Vorlage**.

- Bestellungs-PDF: Felder pro Element einzeln konfigurierbar (Artikelnummer, Bezeichnung, Menge, Preis u.a.)
- QR-Code-Etikett: Layout und Felder konfigurierbar
- Layout wird niederlassungsspezifisch gerendert

### 14.3 Scan-Töne

Aufruf unter **Einstellungen → Scan-Töne**.

- Eigene Töne für Erfolg und Fehler hochladbar (WAV/MP3/OGG, max. 2 MB)
- Standard-Töne: deutlich hörbar auch in lauter Umgebung

### 14.4 Benutzer-Einstellungen (persönlich)

Jeder Benutzer kann eigene Präferenzen speichern (serverseitig, geräteübergreifend):
- **Theme:** Hell / Dunkel / Systemstandard + Farbschema
- **Schnellbuchung-Workflow:** Vorgangsnummer zuerst oder direkt Artikel
- **Duplikat-Warnung:** Ein/Aus + Zeitraum
- **Dashboard-Widgets:** Sichtbarkeit und Reihenfolge
- **Schnellzugriff-Buttons:** Konfigurierbar für Desktop und Mobil

Alle Einstellungen werden serverseitig gespeichert und sind nach Reload (F5) oder erneutem Anmelden sofort wiederhergestellt.

### 14.5 Log-Archive (Administration)

Aufruf unter **Administration → Logs → Archiv**.

Ältere Logs werden automatisch in tagesweise JSON-Dateien archiviert und aus der Datenbank entfernt. Der Archivierungszeitraum ist konfigurierbar.

**Verschlüsselung (empfohlen):**  
Wenn `LOG_ARCHIVE_ENCRYPTION_KEY` in der `.env` gesetzt ist, werden neu erstellte Archive mit AES-256-GCM verschlüsselt gespeichert. Ältere Plaintext-Archive bleiben weiterhin lesbar. Die Entschlüsselung erfolgt automatisch beim Abrufen über die Oberfläche.

> DSGVO-Hinweis: Archive enthalten keine Benutzernamen, IP-Adressen oder User-Agent-Strings. Nur pseudonymisierte User-IDs und Aktionsbeschreibungen werden gespeichert.

---

## 15. Offline-Betrieb

Die App ist als **Progressive Web App (PWA)** konzipiert und bleibt bei fehlendem Netzwerk funktionsfähig.

### Was funktioniert offline?

- **Schnellbuchung:** Buchungen werden lokal in einer Queue gespeichert (IndexedDB)
- **Teile scannen:** Buchungen werden ebenfalls offline gespeichert
- **Artikelstamm:** Zuletzt geladene Artikel stehen offline zur Verfügung
- **Inventur:** Offline-Erfassung möglich

### Synchronisation

- Beim Wiederherstellen der Netzwerkverbindung wird die Queue **automatisch** synchronisiert
- Manuell: Button „Bewegungen synchronisieren" auf der Scanner-Seite
- **Race-Condition-Schutz:** Das `isSyncing`-Flag verhindert parallele Sync-Versuche

### App auf dem Homescreen installieren

In Chrome/Safari: Browser-Menü → „Zum Startbildschirm hinzufügen" – die App verhält sich dann wie eine native App.

---

## 16. Häufige Fragen (FAQ)

**F: Ich sehe Artikel eines anderen Lagers in meinen Bestellvorschlägen.**  
A: Prüfe unter **Lagerorte**, ob die Regale korrekt dem richtigen Lager (Typ=WAREHOUSE) zugeordnet sind. Ein Regal, das dem falschen Lager zugeordnet ist, erscheint in den falschen Bestellvorschlägen.

**F: Die Duplikat-Warnung erscheint dauernd bei einem Großkunden mit mehreren Standorten.**  
A: Das ist bewusstes Verhalten – die Warnung zeigt, dass dieser Kunde den Artikel kürzlich erhalten hat. Sie kann manuell per ✕ geschlossen werden. Alternativ den Zeitraum auf einen kürzeren Wert (z.B. 1 Monat) reduzieren oder die Funktion für diesen Workflow deaktivieren.

**F: Buchungen tauchen doppelt auf.**  
A: Auf Mobilgeräten können Doppel-Taps zwei Buchungen auslösen. Seit v3.10 gibt es einen Debounce-Schutz. Falls das Problem weiterhin auftritt, prüfe ob die Offline-Queue noch ausstehende Buchungen enthält (Sync-Button auf der Scanner-Seite).

**F: Der Bestand auf der Berichtsseite weicht vom Artikel-Dialog ab.**  
A: Der Bericht zählt nur den primären Lagerort des Artikels. Wenn Bestand auf mehreren Lagerorten liegt, kann es Abweichungen geben. Seit v3.10 ist dies angeglichen.

**F: Ein Lieferschein-PDF wird nicht angezeigt.**  
A: Die PDF-Datei muss im konfigurierten Ordner liegen (`{NL-CODE}_{Name}/{YYYY}/{MM}/`) und der Dateiname muss die Auftragsnummer enthalten. Der Ordner-Watcher prüft jede Minute. Prüfe außerdem ob `DELIVERY_NOTES_STORAGE_HOST_PATH` in der `.env` korrekt gesetzt ist.

**F: Nach einem Hyreka-Import ist der Bestand weg.**  
A: Der Import erstellt neue Artikel-UUIDs. Bestehende Backups müssen nach dem Import über die Backup-Seite wiederhergestellt werden; das System mappt Bestände automatisch über den Artikelcode.

**F: Wie viele Benutzer / Artikel werden unterstützt?**  
A: Das System ist für bis zu ~200 gleichzeitige Benutzer und ~200.000 Artikel optimiert (DB-Indizes, Connection-Pool, Eager→Lazy Loading). Bei höherer Last empfiehlt sich Redis für Socket.io-Scaling.

**F: Meine Dashboard-Einstellungen gehen nach dem Reload verloren.**  
A: Seit v4.1 werden alle Einstellungen (Dashboard-Widgets, Schnellzugriff-Buttons, Theme, Farben) serverseitig gespeichert und sind geräteübergreifend verfügbar. Falls weiterhin Probleme auftreten, bitte einmal ab- und wieder anmelden.

**F: Nach einem Backup-Restore sind alle Passwörter gesperrt.**  
A: Das ist beabsichtigt. Seit v4.1 werden Passwort-Hashes nicht mehr im Backup gespeichert. Nach einem Restore müssen alle Passwörter vom Administrator unter **Benutzer → Passwort zurücksetzen** neu vergeben werden.

**F: Der PDF-Export (Bestellungs-PDF) schlägt im Docker-Container fehl.**  
A: Auf manchen NAS-Systemen (z.B. Synology) fehlt die Sandbox-Unterstützung für Chromium. Lösung: `PUPPETEER_DISABLE_SANDBOX=true` in der `.env` setzen und Container neu starten.
