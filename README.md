# Lagerverwaltung

Eine vollständige, webbasierte Lagerverwaltungssoftware. Verwaltet Artikel, Lager- und Fahrzeugbestände, Bestellungen und Inventuren – mit mobiler Scanner-App und Offline-Unterstützung.

---

## Inhalt

- [Was kann die Software?](#was-kann-die-software)
- [Funktionen im Überblick](#funktionen-im-überblick)
- [Benutzerrollen](#benutzerrollen)
- [Technischer Stack](#technischer-stack)
- [Installation](#installation)
  - [Voraussetzungen](#voraussetzungen)
  - [Option 1 – Lokale Entwicklung](#option-1--lokale-entwicklung-docker-desktop)
  - [Option 2 – NAS / Server (Produktion)](#option-2--nas--server-produktion)
- [Konfiguration (.env)](#konfiguration-env)
- [Erster Start & Einrichtung](#erster-start--einrichtung)
- [Architektur](#architektur)
- [Häufige Fragen](#häufige-fragen)

---

## Was kann die Software?

Die Lagerverwaltung ist eine **selbst gehostete Webanwendung**, die als Progressive Web App (PWA) im Browser läuft – auf dem PC genauso wie auf dem Smartphone oder Tablet.

Kern-Anwendungsfälle:
- Internes Lager: Bestände in Lagerhallen und Lagerorten verwalten, Wareneingänge buchen, Bestellungen steuern
- Fahrzeuglager: Techniker scannen Teile direkt am Fahrzeug per QR-Code ein und aus – auch ohne stabile Verbindung
- Manager behalten den Überblick über Fehlbestände, führen Inventuren durch und erstellen Berichte
- Alle Vorgänge werden protokolliert und sind lückenlos nachvollziehbar

---

## Funktionen im Überblick

### Dashboard
Die Startseite zeigt auf einen Blick:
- Aktuelle Fehlbestände und Nachschubmeldungen
- Letzte Lagerbewegungen
- KPI-Kacheln (Artikelanzahl, offene Bestellungen, Fahrzeuge)
- Konfigurierbare Widgets pro Benutzer

### Artikel
- Vollständige Artikelstammdaten (Artikelnummer, Bezeichnung 1 & 2, Hersteller, Warengruppe)
- Alternative Artikelcodes (Hersteller-Nummern, Barcodes)
- Artikelbilder (JPEG, automatisch skaliert auf 800×800 px)
- Soll-Bestand pro Fahrzeug/Lagerort festlegen
- Excel-Import für Massenanlage von Artikeln
- Hyreka-Abgleich für Katalogdaten

### Schnellbuchung (Scanner)
Die wichtigste Funktion für Techniker im Alltag:
- QR-Code scannen → Artikel wird sofort erkannt
- Menge einstellen und ein- oder ausbuchen
- Akustisches Feedback: aufsteigender Ton bei Erfolg, tiefer Buzzer bei Fehler
- **Offline-fähig:** Buchungen werden zwischengespeichert und automatisch synchronisiert sobald die Verbindung wieder steht
- Bereitgestellte Mengen aus Lager werden automatisch vorgeschlagen

### Lagerorte
- Beliebig viele Lagerorte anlegen (Regale, Hallen, Bereiche)
- Bestand pro Lagerort verwalten
- Lagerort-spezifische Ein-/Ausbuchungen

### Lieferanten
- Lieferantenstammdaten pflegen
- Artikel einem Lieferanten zuordnen
- Lieferantenspezifische Bestellnummern

### Bestellungen
- Bestellvorschläge automatisch berechnen (Soll-/Ist-Vergleich)
- Bestellungen anlegen, bearbeiten und verwalten
- **Bestellungen als PDF exportieren** (mit Firmenlogo und Lieferanteninformationen)
- PDF-Archiv: alle Bestell-PDFs werden dauerhaft gespeichert und sind jederzeit abrufbar
- E-Mail-Versand direkt aus der Anwendung (SMTP konfigurierbar)
- Waren-Eingang erfassen und Lagerbestand automatisch aktualisieren
- Reichweiten-Prognose: zeigt wann Artikel aufgebraucht sein werden

### Bewegungshistorie & Berichte
- Vollständiges Journal aller Ein-/Ausbuchungen
- Filterbar nach Artikel, Fahrzeug, Benutzer und Zeitraum
- Berichte als Excel-Export
- Fahrzeugspezifische Bewegungshistorie

### Fahrzeugbestände (Flottenübersicht)
- Bestandsübersicht für jedes Fahrzeug
- Fehlbestandsmeldungen pro Fahrzeug
- Fahrzeug-übergreifende Verfügbarkeitsanzeige
- Techniker können ihren eigenen Fahrzeugbestand einsehen

### Inventur
Die Inventur-Funktion ist besonders für mobile Geräte optimiert:

**Ablauf:**
1. Manager startet eine Inventur-Sitzung
2. Techniker scannen ihre Fahrzeuge per QR-Code und tragen Mengen ein
3. Techniker reichen ihre Inventur zur Prüfung ein
4. Manager prüft Differenzen und finalisiert die Inventur

**Features:**
- QR-Code scannen: sofortiger Ton bei Erkennung
- **Fortschrittsanzeige:** zeigt wie viele Artikel bereits erfasst wurden (z.B. „15 / 42 erfasst")
- **Duplikat-Warnung:** Hinweis wenn ein Artikel bereits gescannt wurde, mit vorausgefüllter Menge zur einfachen Korrektur
- **Fehlende Artikel:** beim Einreichen wird angezeigt, welche Artikel mit Bestand noch nicht gescannt wurden
- Leere Mengenangabe übernimmt automatisch den Systemwert (spart Klicks)
- Excel-/PDF-Export der Inventurliste
- Delta-Buchung: nur echte Differenzen werden gebucht, Ausbuchungen während der Inventur verfälschen das Ergebnis nicht
- Offline-Unterstützung für Bereiche ohne WLAN

### Synchronisierung
- Übersicht aller ausstehenden Offline-Buchungen
- Manuelle Synchronisation bei Bedarf
- Status-Anzeige für Verbindungsprobleme

### Systemprotokolle
- Alle sicherheitsrelevanten Vorgänge werden geloggt (Login, Buchungen, Bestellungen)
- Live-Log-Ansicht für Administratoren
- Log-Archiv (tagesweise, dauerhaft gespeichert)
- Konform mit NIS2-Anforderungen an Nachvollziehbarkeit

### Datensicherung
- Manuelle Datenbank-Backups aus der Oberfläche heraus erstellen
- MySQL-Dump als Datei herunterladen
- Backups auf dem Host-Dateisystem gespeichert (für NAS-Backup geeignet)

### Einstellungen
- **Firmendaten:** Name, Logo – erscheinen auf Login-Seite und in PDF-Exporten
- **E-Mail:** SMTP-Konfiguration für Bestellungen und Passwort-Reset
- **Lagereinstellungen:** Konfiguration der Lager-Struktur
- **QR-Vorlage:** eigene QR-Code-Aufkleber gestalten und drucken
- **Bestellungsvorlage:** PDF-Layout anpassen
- **Scan-Töne:** eigene Sounds für Erfolg/Fehler hochladen

### Benutzerverwaltung & Zugriffskontrolle
- Benutzer anlegen und Rollen zuweisen
- Fahrzeuge einem Benutzer fest zuordnen
- Granulare Berechtigungen pro Benutzer konfigurierbar
- Passwort-Reset per E-Mail

### Niederlassungen (Multi-Standort)
- Mehrere Niederlassungen in einem System verwalten
- Vollständige Datentrennung zwischen Niederlassungen
- Super-Admin hat Zugriff auf alle Niederlassungen
- Eigene SMTP-Konfiguration pro Niederlassung

### In-App-Update
- Neue Versionen direkt aus der Oberfläche einspielen (erfordert Docker-Socket-Zugriff)
- Kein manueller SSH-Zugang notwendig

---

## Benutzerrollen

| Rolle | Beschreibung |
|---|---|
| **TECHNICIAN** (Techniker) | Kann Artikel ein-/ausbuchen, eigenen Fahrzeugbestand einsehen, Inventur für eigenes Fahrzeug durchführen |
| **WAREHOUSE** (Lager) | Wie Techniker, zusätzlich: Wareneingänge erfassen, Bestände verwalten |
| **MANAGER** | Vollzugriff: Artikelstammdaten, Bestellungen, Inventur finalisieren, Benutzer verwalten, Berichte, Systemeinstellungen |

Zusätzlich zu den Rollen können einzelne Berechtigungen pro Benutzer feinjustiert werden.

---

## Technischer Stack

| Komponente | Technologie |
|---|---|
| Backend | [NestJS 10](https://nestjs.com) · TypeORM · MySQL 8 |
| Frontend | [React](https://react.dev) · [Vite](https://vitejs.dev) · [Material UI](https://mui.com) |
| Datenbank | MySQL 8.3 |
| Reverse Proxy | [Caddy 2](https://caddyserver.com) (HTTPS, automatische Zertifikate) |
| Containerisierung | Docker · Docker Compose |
| PWA/Offline | Service Worker · IndexedDB (idb) |

---

## Installation

### Voraussetzungen

- **Docker** und **Docker Compose** müssen installiert sein
  - Windows/Mac: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - Linux/NAS: Docker Engine + Docker Compose Plugin
- Mindestens **2 GB RAM** empfohlen (NAS: 4 GB für ruhigen Betrieb)
- Freie Ports: standardmäßig 80 (HTTP) und 443 (HTTPS)

---

### Option 1 – Lokale Entwicklung (Docker Desktop)

Für Tests auf dem eigenen PC:

```bash
# 1. Repository klonen
git clone https://github.com/Sirbuschi2003/Lagerverwaltung.git
cd Lagerverwaltung

# 2. Konfiguration erstellen
cp .env.example .env
# Passwörter in .env anpassen (für lokale Tests reichen die Standardwerte)

# 3. Starten
docker compose up -d --build
```

Die Anwendung ist danach erreichbar unter:
- **Frontend:** http://localhost (Port 80)
- **API:** http://localhost:3000/api

> **Hinweis:** Für den QR-Code-Scanner im Browser ist HTTPS erforderlich. Verwende für echte Kamera-Tests die NAS/Server-Installation oder konfiguriere ein Zertifikat.

---

### Option 2 – NAS / Server (Produktion)

Dies ist die empfohlene Installation für den dauerhaften Betrieb, z.B. auf einer Synology NAS.

#### Schritt 1 – Dateien auf den Server kopieren

Alle Dateien aus dem Repository in ein Verzeichnis auf dem Server kopieren, z.B.:

```
/volume1/docker/Lagerverwaltung/
```

#### Schritt 2 – Konfiguration anlegen

```bash
cp .env.example .env
```

Die `.env` Datei im Texteditor öffnen und mindestens diese Werte anpassen (Details siehe [Konfiguration](#konfiguration-env)):

```env
MYSQL_ROOT_PASSWORD=SehrSicheresPasswort123!
MYSQL_PASSWORD=NochEinPasswort456!
BACKEND_JWT_SECRET=ZufälligerStringMitMindestens32Zeichen
INVENTORY_HMAC_SECRET=NochEinZufälligerStringMindestens32Zeichen
APP_HOST=192.168.1.100   # IP-Adresse des Servers im lokalen Netz
```

Sichere Zufalls-Strings erzeugen:
```bash
openssl rand -hex 32
```

#### Schritt 3 – Netzwerk vorbereiten (Synology NAS)

Die Anwendung nutzt ein externes Docker-Netzwerk `LAN02`. Dieses muss einmalig angelegt werden:

```bash
# IP-Adresse des NAS und gewünschte Netz-Adresse anpassen
sudo docker network create \
  --driver macvlan \
  --subnet=192.168.3.0/24 \
  --gateway=192.168.3.1 \
  -o parent=eth0 \
  LAN02
```

> Für einfache Setups ohne eigene IP-Adresse kann stattdessen `docker-compose.yml` verwendet werden – dort entfällt das externe Netzwerk.

#### Schritt 4 – Starten

```bash
sudo docker compose -f docker-compose.main.yml up -d
```

Status prüfen:
```bash
sudo docker compose -f docker-compose.main.yml ps
sudo docker compose -f docker-compose.main.yml logs -f backend
```

#### Schritt 5 – Erreichbarkeit prüfen

Die Anwendung ist erreichbar unter der in `APP_HOST` eingetragenen IP-Adresse:
```
http://192.168.3.15
```

---

### Automatisches Update

Nach dem ersten Start kann die Anwendung **direkt aus der Oberfläche** aktualisiert werden:

1. Als Manager einloggen
2. Einstellungen → Wartung & Update
3. „Auf Updates prüfen" klicken
4. Update starten

Voraussetzung: Docker-Images müssen im GitHub Container Registry öffentlich sein (Standard bei diesem Repository).

---

## Konfiguration (.env)

Die Datei `.env` steuert alle wichtigen Parameter. Eine vollständige Vorlage liegt als `.env.example` im Repository.

### Datenbank

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | Root-Passwort für MySQL (nur intern) | `SicheresPasswort!` |
| `MYSQL_DATABASE` | Name der Datenbank | `lagerverwaltung` |
| `MYSQL_USER` | Datenbankbenutzer | `lagerverwaltung` |
| `MYSQL_PASSWORD` | Passwort des Datenbankbenutzers | `NochEinPasswort!` |

### Sicherheit

| Variable | Beschreibung | Hinweis |
|---|---|---|
| `BACKEND_JWT_SECRET` | Geheimschlüssel für Login-Token | Min. 32 Zeichen, zufällig |
| `BACKEND_JWT_EXPIRES_IN` | Gültigkeitsdauer des Tokens | z.B. `8h` oder `1d` |
| `INVENTORY_HMAC_SECRET` | Sicherheitsschlüssel für Inventur-Prüfsummen | Min. 32 Zeichen, zufällig |

### Netzwerk

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `APP_HOST` | IP-Adresse oder Domain des Servers | `192.168.3.15` |
| `ALLOWED_ORIGINS` | Erlaubte Frontend-Adressen (CORS) | `http://192.168.3.15` |

### Dateiablage

Alle Pfade sind optional. Wenn nicht gesetzt, werden Docker-Volumes verwendet (Daten bleiben bei Updates erhalten).

| Variable | Beschreibung |
|---|---|
| `BACKUP_STORAGE_HOST_PATH` | Pfad für Datenbank-Backups |
| `PURCHASE_ORDER_STORAGE_HOST_PATH` | Pfad für Bestell-PDFs |
| `ITEM_IMAGE_STORAGE_HOST_PATH` | Pfad für Artikelbilder |
| `DELIVERY_NOTES_STORAGE_HOST_PATH` | Pfad für Lieferschein-PDFs |
| `LOG_ARCHIVE_STORAGE_HOST_PATH` | Pfad für Log-Archive |

Beispiel für Synology NAS:
```env
BACKUP_STORAGE_HOST_PATH=/volume1/docker/Lagerverwaltung/backups
PURCHASE_ORDER_STORAGE_HOST_PATH=/volume1/docker/Lagerverwaltung/purchase-orders
```

### E-Mail / Web Push (optional)

| Variable | Beschreibung |
|---|---|
| `VAPID_PUBLIC_KEY` | Öffentlicher Schlüssel für Web-Push-Benachrichtigungen |
| `VAPID_PRIVATE_KEY` | Privater Schlüssel für Web-Push-Benachrichtigungen |
| `VAPID_SUBJECT` | Absender-Adresse für Push (`mailto:...`) |

Push-Keys erzeugen:
```bash
npx web-push generate-vapid-keys
```

### Performance-Tuning

| Variable | Beschreibung | Standard |
|---|---|---|
| `MYSQL_INNODB_BUFFER_POOL_SIZE` | MySQL-Cache (70 % des RAM empfohlen) | `512M` |
| `MYSQL_MAX_CONNECTIONS` | Max. gleichzeitige DB-Verbindungen | `200` |
| `DB_POOL_SIZE` | TypeORM Connection Pool Größe | `30` |

---

## Erster Start & Einrichtung

### Standard-Anmeldedaten

Nach dem ersten Start wird automatisch ein Admin-Benutzer angelegt:

| Feld | Wert |
|---|---|
| Benutzername | `admin` |
| Passwort | `ChangeMe123!` |

> **Wichtig:** Passwort nach dem ersten Login sofort ändern!

### Einrichtungsreihenfolge

1. **Als Admin einloggen**
2. **Firmendaten** eintragen (Einstellungen → Firmendaten): Name, Logo
3. **Niederlassungen** anlegen falls mehrere Standorte (optional)
4. **Benutzer** anlegen und Rollen zuweisen (Einstellungen → Benutzer & Fahrzeuge)
5. **Fahrzeuge** anlegen und Benutzern zuordnen
6. **Lagerorte** anlegen (falls Lagerhaltung ohne Fahrzeuge)
7. **Lieferanten** anlegen
8. **Artikel** anlegen oder per Excel importieren
9. **Soll-Bestände** pro Fahrzeug/Lagerort festlegen
10. **E-Mail** konfigurieren falls Bestellungen per Mail versendet werden sollen

---

## Architektur

```
Browser / Smartphone
       │
       ▼
  Caddy (HTTPS)
  ┌────┴──────────┐
  │               │
Frontend        Backend API
(React PWA)    (NestJS)
Nginx:80       Port:3000
       │
       ▼
   MySQL 8.3
```

### Verzeichnisstruktur

```
Lagerverwaltung/
├── backend/          # NestJS API (Module: auth, items, stock, inventory, orders, ...)
├── frontend/         # React PWA (Seiten, Stores, Hooks, Scanner)
├── deploy/
│   ├── caddy/        # Reverse-Proxy Konfiguration
│   └── start.sh      # Startskript
├── docker-compose.yml          # Einfaches Setup (lokal)
├── docker-compose.main.yml     # Produktions-Setup (NAS/Server)
├── .env.example                # Konfigurationsvorlage
└── README.md
```

### Backend-Module

| Modul | Funktion |
|---|---|
| `auth` | Login, JWT-Token, Passwort-Reset |
| `items` | Artikelstammdaten, Import, Bilder |
| `stock` | Bestandsverwaltung, Buchungen, Fehlbestände |
| `vehicles` | Fahrzeuge, Fahrzeugbestände |
| `inventory` | Inventursitzungen, Inventurpositionen |
| `orders` | Bestellungen, Wareneingänge, PDF-Export |
| `reports` | Berichte, Bewegungshistorie, Excel-Export |
| `users` | Benutzerverwaltung, Rollen, Berechtigungen |
| `branches` | Niederlassungen, Multi-Standort |
| `logging` | System-Logs, Audit-Trail |
| `email` | SMTP, Bestellversand, Passwort-Reset |

---

## Häufige Fragen

### Der QR-Scanner funktioniert nicht

Der Browser benötigt HTTPS, um auf die Kamera zuzugreifen. Bei lokaler Installation über `http://localhost` kann dies im Browser manuell erlaubt werden. Auf dem NAS/Server mit HTTPS-Zugriff funktioniert der Scanner automatisch.

### Die Anwendung startet nicht (Fehler im Log)

```bash
# Logs aller Container anzeigen
sudo docker compose -f docker-compose.main.yml logs

# Nur Backend-Fehler
sudo docker compose -f docker-compose.main.yml logs backend

# Container-Status
sudo docker compose -f docker-compose.main.yml ps
```

Häufige Ursachen:
- `.env` fehlt oder enthält Platzhalter-Werte (`AENDERN_...`)
- Port 80 oder 443 wird von einem anderen Dienst belegt
- Das externe Docker-Netzwerk `LAN02` wurde nicht angelegt

### Passwort vergessen

Über die Login-Seite → „Passwort vergessen" – erfordert konfiguriertes SMTP.

Alternativ direkt in der Datenbank zurücksetzen:
```bash
# Neues Passwort-Hash erzeugen (bcrypt, 10 Runden)
# Dann in der Datenbank ersetzen
sudo docker compose exec mysql mysql -u lagerverwaltung -p lagerverwaltung \
  -e "UPDATE users SET password='<NEUER_HASH>' WHERE username='admin';"
```

### Wie wird gesichert?

Datensicherung → Backup-Schaltfläche in der Oberfläche erstellt einen MySQL-Dump. Alternativ das Backup-Verzeichnis auf dem Host regelmäßig sichern:

```bash
# Beispiel: tägliches Backup per Cron auf der NAS
0 2 * * * cp -r /volume1/docker/Lagerverwaltung/backups /volume1/backup/lagerverwaltung/$(date +%Y%m%d)
```

### Wie werden Updates eingespielt?

**Über die Oberfläche:** Einstellungen → Wartung & Update → „Update starten"

**Manuell:**
```bash
sudo docker compose -f docker-compose.main.yml pull
sudo docker compose -f docker-compose.main.yml up -d
```

### Mehrere Standorte – wie richtet man das ein?

1. Als Super-Admin einloggen (Benutzer ohne zugewiesene Niederlassung mit Manager-Rolle)
2. Einstellungen → Niederlassungen → neue Niederlassung anlegen
3. Benutzer der jeweiligen Niederlassung zuordnen
4. Daten (Artikel, Fahrzeuge, Bestände) sind vollständig getrennt pro Niederlassung

---

## Lizenz

Dieses Projekt ist für den internen Gebrauch entwickelt. Für Fragen zur Nutzung bitte ein [Issue](https://github.com/Sirbuschi2003/Lagerverwaltung/issues) öffnen.
