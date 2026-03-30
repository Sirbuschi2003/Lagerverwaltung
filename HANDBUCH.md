# KFZ-Lagerverwaltung – Benutzerhandbuch

> **Version:** 2.x
> **Zielgruppe:** Lageristen, Disponenten, Techniker, Administratoren
> **Sprache:** Deutsch

---

## Inhaltsverzeichnis

1. [Überblick](#1-überblick)
2. [Erste Schritte – Login & Ersteinrichtung](#2-erste-schritte--login--ersteinrichtung)
3. [Dashboard](#3-dashboard)
4. [Artikelverwaltung](#4-artikelverwaltung)
5. [Lagerorte](#5-lagerorte)
6. [Fahrzeugverwaltung](#6-fahrzeugverwaltung)
7. [Fuhrpark-Übersicht](#7-fuhrpark-übersicht)
8. [Mein Fahrzeug (Technikerseite)](#8-mein-fahrzeug-technikerseite)
9. [Buchungen – Scanner & Schnellbuchung](#9-buchungen--scanner--schnellbuchung)
10. [Inventur](#10-inventur)
11. [Bestellwesen](#11-bestellwesen)
12. [Lieferantenverwaltung](#12-lieferantenverwaltung)
13. [Berichte, Protokolle & Logs](#13-berichte-protokolle--logs)
14. [Offline-Modus & Synchronisation](#14-offline-modus--synchronisation)
15. [Systemeinstellungen](#15-systemeinstellungen)
16. [Benutzerverwaltung & Zugriffsrechte](#16-benutzerverwaltung--zugriffsrechte)
17. [Administration & Wartung](#17-administration--wartung)
18. [Anhang: Berechtigungsübersicht](#18-anhang-berechtigungsübersicht)

---

## 1. Überblick

Die **KFZ-Lagerverwaltung** ist ein webbasiertes System zur Verwaltung von Ersatzteilen und Verbrauchsmaterialien im Fuhrpark. Es läuft vollständig im Browser und ist als Progressive Web App (PWA) auch offline nutzbar.

### Kernfunktionen auf einen Blick

| Bereich | Beschreibung |
|---|---|
| Artikelverwaltung | Anlegen, Bearbeiten und Importieren von Ersatzteilen |
| Bestandsführung | Buchungen pro Fahrzeug, Scanner-Integration |
| Inventur | Zählung und Abgleich des Fahrzeugbestands |
| Bestellwesen | Bestellvorschläge, Bestellungen, Wareneingang |
| Offline-Betrieb | Buchungen ohne Internetverbindung möglich |
| Zugriffsrechte | Rollen- und benutzerbasierte Berechtigungen |
| Exporte | PDF, Excel, CSV für alle Bereiche |

### Benutzerrollen

| Rolle | Beschreibung |
|---|---|
| **Administrator** | Vollzugriff auf alle Funktionen |
| **Manager** | Bestellwesen, Berichte, Benutzer verwalten |
| **Techniker** | Buchungen am eigenen Fahrzeug |
| **Betrachter** | Nur-Lesen-Zugriff |

> Die genauen Rechte können je nach Konfiguration abweichen. Ihre zugewiesenen Rechte sehen Sie in der Benutzerverwaltung.

---

## 2. Erste Schritte – Login & Ersteinrichtung

### 2.1 Ersteinrichtung

Beim ersten Start des Systems erscheint die **Einrichtungsseite**. Hier legen Sie den ersten Administrator-Account an:

1. **Benutzername** eingeben (wird für den Login verwendet)
2. **Anzeigename** eingeben (wird im System angezeigt)
3. **Passwort** vergeben (mindestens 6 Zeichen)
4. **Passwort bestätigen**
5. Auf **„Einrichtung abschließen"** klicken

Nach erfolgreicher Einrichtung werden Sie automatisch zur Anmeldeseite weitergeleitet.

### 2.2 Anmeldung

1. Öffnen Sie die App-URL in Ihrem Browser
2. Geben Sie **Benutzername** und **Passwort** ein
3. Klicken Sie auf **„Anmelden"**

**Offline-Anmeldung:** Wenn keine Internetverbindung besteht und Sie sich zuvor schon einmal angemeldet haben, können Sie sich mit Ihren gespeicherten Zugangsdaten auch offline anmelden. Die App zeigt in diesem Fall einen Hinweis an.

### 2.3 Passwort ändern

Das Passwort können Administratoren in der Benutzerverwaltung für jeden Benutzer ändern.

---

## 3. Dashboard

Das Dashboard ist die Startseite nach dem Login. Es zeigt auf einen Blick die wichtigsten Informationen.

### 3.1 Verfügbare Widgets

| Widget | Beschreibung |
|---|---|
| **KPI-Übersicht** | Kennzahlen: Artikelanzahl, offene Bestellungen, Inventursitzungen |
| **Schnellaktionen** | Direkte Links zu den häufigsten Funktionen |
| **Nachbestellanfragen** | Ausstehende Nachbestellungen auf einen Blick |
| **Letzte Buchungen** | Die zuletzt durchgeführten Lagerbewegungen |

### 3.2 Dashboard anpassen

Klicken Sie auf das **Zahnrad-Symbol** oben rechts im Dashboard, um Widgets ein- oder auszublenden. Ihre Einstellungen werden automatisch gespeichert.

### 3.3 Offline-Hinweis

Wenn die App keine Verbindung zum Server hat, erscheint oben ein gelber Warnbalken. In diesem Zustand stehen nur gecachte Daten zur Verfügung. Buchungen werden lokal zwischengespeichert und beim nächsten Online-Gang synchronisiert.

---

## 4. Artikelverwaltung

Die Artikelverwaltung ist das Herzstück des Systems. Hier werden alle Ersatzteile und Verbrauchsmaterialien gepflegt.

### 4.1 Artikelübersicht

Navigieren Sie über das Menü zu **„Artikel"**. Die Übersicht zeigt alle angelegten Artikel mit:
- Artikelnummer
- Bezeichnung
- Hersteller
- Warengruppe
- Sollbestand
- Aktueller Bestand
- Lagerort
- Lieferant

**Suchen:** Verwenden Sie das Suchfeld oben links, um nach Artikelnummer, Bezeichnung oder Hersteller zu suchen.

**Filtern:** Nutzen Sie die Filter-Dropdowns für Hersteller und Warengruppe.

### 4.2 Artikel anlegen

1. Klicken Sie auf **„Neuer Artikel"**
2. Füllen Sie das Formular aus:

| Feld | Pflicht | Beschreibung |
|---|---|---|
| Artikelnummer | ✅ | Eindeutige Kennung (z.B. Hersteller-Teilenummer) |
| Bezeichnung | ✅ | Kurzbeschreibung des Artikels |
| Bezeichnung (2) | – | Zusatzinfo (erscheint in Listen und bei Bestellvorschlägen) |
| Hersteller | ✅ | Herstellername |
| Warengruppe | ✅ | Kategorie (z.B. „Filter", „Verschleißteile") |
| Lieferant | – | Zugeordneter Lieferant für Bestellungen |
| Lagerort | – | Fester Lagerplatz im Zentrallager |
| QR-Code | – | Alternativer Scan-Code |
| Preis (EUR) | – | Einkaufspreis |
| Verpackungseinheit | – | Stück pro Packung |
| Bestellmenge | – | Feste Bestellmenge (0 = automatisch) |
| Sollbestand | – | Zielbestand nach Auffüllung |
| Meldebestand | – | Schwellwert: Bestellung wird ausgelöst wenn Bestand ≤ diesem Wert |
| Mindestbestand | – | Sicherheitspuffer / absolute Untergrenze |
| Ist-Bestand | – | Aktueller Bestand (beim Anlegen direkt eintragen) |
| Weitere Codes | – | Alternative Barcodes (kommagetrennt) |

3. Klicken Sie auf **„Speichern"**

> **Tipp:** Meldebestand und Mindestbestand sind unterschiedliche Schwellwerte:
> - **Meldebestand**: Löst eine Bestellanfrage aus (z.B. bei ≤ 10 Stück)
> - **Mindestbestand**: Absolute Untergrenze / Sicherheitspuffer (z.B. 5 Stück)

### 4.3 Artikel bearbeiten

Klicken Sie auf das **Stift-Symbol** neben einem Artikel oder direkt auf die Zeile. Das Bearbeitungsdialog öffnet sich mit allen aktuellen Werten.

### 4.4 Artikel löschen

Klicken Sie auf das **Papierkorb-Symbol**. Eine Bestätigung ist erforderlich. Die Buchungshistorie des Artikels bleibt erhalten.

### 4.5 Hyreka-Import (CSV)

Das System unterstützt den Import von Artikelstammdaten aus der **Hyreka**-Software.

**Vorgehensweise:**
1. Klicken Sie auf **„Hyreka Import"**
2. Wählen Sie die exportierte CSV-Datei aus Hyreka
3. Das System zeigt eine **Vorschau** der zu importierenden Daten
4. Prüfen Sie die Vorschau auf Korrektheit
5. Klicken Sie auf **„Import starten"**

**Importierte Felder aus Hyreka:**
- Artikelnummer, Bezeichnung 1 & 2
- Hersteller, Warengruppe
- Sollbestand (`dauerSoll`), Meldebestand (`alarmbes`), Mindestbestand (`mindestbes`)
- Lieferant (wird ggf. neu angelegt)
- Lagerort (wird ggf. neu angelegt)

> **Hinweis:** Bestehende Artikel werden aktualisiert, neue Artikel werden angelegt. Bereits vorhandene Daten werden nicht gelöscht.

### 4.6 CSV-Import (allgemein)

Für den allgemeinen CSV-Import:
1. Laden Sie zunächst das **CSV-Template** herunter
2. Befüllen Sie die Vorlage mit Ihren Daten
3. Importieren Sie die CSV-Datei

### 4.7 Exporte

- **QR-Katalog (PDF):** Erzeugt ein PDF mit QR-Codes aller Artikel (für Beschriftung)
- **Stammdaten (CSV):** Exportiert alle Artikeldaten als CSV-Datei

### 4.8 Buchungshistorie

In der Artikeldetailansicht sehen Sie die **Bewegungshistorie** des Artikels: alle Ein- und Ausbuchungen mit Datum, Menge, Benutzer und Notiz.

---

## 5. Lagerorte

Lagerorte beschreiben die physische Struktur Ihres Zentrallagers (Regale, Fächer, Schränke usw.).

### 5.1 Ortstypen

| Typ | Beschreibung |
|---|---|
| **Lager (WAREHOUSE)** | Oberstes Element: das Lager selbst |
| **Regal (SHELF)** | Regaleinheit im Lager |
| **Fach (BIN)** | Einzelnes Fach in einem Regal |
| **Fahrzeug (VEHICLE)** | Automatisch für Fahrzeuge angelegt |

### 5.2 Lagerort anlegen

1. Wählen Sie den **Typ** aus
2. Tragen Sie einen **Code** ein (z.B. „R01-F03" für Regal 1, Fach 3)
3. Optional: **Name** (z.B. „Filter-Regal")
4. Optional: **Übergeordneten Ort** wählen (für Hierarchie)
5. Klicken Sie auf **„Speichern"**

> **Tipp:** Verwenden Sie strukturierte Codes wie `LAGER / REGAL-01 / FACH-03` — diese werden in der Suche automatisch erkannt und angezeigt.

### 5.3 Lagerort zuweisen

Lagerorte werden in der Artikelverwaltung einem Artikel zugewiesen. Beim Anlegen/Bearbeiten eines Artikels wählen Sie den Lagerort aus dem Dropdown.

---

## 6. Fahrzeugverwaltung

Fahrzeuge repräsentieren die Servicefahrzeuge Ihres Fuhrparks. Jedes Fahrzeug hat seinen eigenen Bestand.

### 6.1 Fahrzeug anlegen

1. Navigieren Sie zu **„Zugangskontrolle" → „Fahrzeuge"** (oder direkt im Menü)
2. Klicken Sie auf **„Neues Fahrzeug"**
3. Geben Sie **Kennzeichen** und **Beschreibung** ein
4. Klicken Sie auf **„Speichern"**

### 6.2 Bestand klonen

Sie können den kompletten Artikelbestand von einem Fahrzeug auf ein anderes übertragen:

1. Klicken Sie auf **„Bestand klonen"** neben dem Quellfahrzeug
2. Wählen Sie das **Zielfahrzeug**
3. Entscheiden Sie: **Mit Ist-Bestand** (Mengen übernehmen) oder nur Sollwerte
4. Bestätigen Sie den Vorgang

> **Achtung:** Bereits vorhandene Artikel im Zielfahrzeug werden überschrieben.

---

## 7. Fuhrpark-Übersicht

Die Fuhrpark-Übersicht zeigt den **aktuellen Bestand aller Fahrzeuge** auf einen Blick.

**Funktionen:**
- Suche nach Kennzeichen oder Beschreibung
- Filter nach Techniker
- Bestandsübersicht je Fahrzeug (Soll vs. Ist)
- Statusanzeige für Unterbestände
- Automatische Aktualisierung via WebSocket

---

## 8. Mein Fahrzeug (Technikerseite)

Die Seite **„Mein Fahrzeug"** ist die persönliche Ansicht für Techniker. Hier sehen Sie den Bestand Ihres zugewiesenen Fahrzeugs.

### 8.1 Bestandsübersicht

- Alle Artikel mit Soll- und Ist-Bestand
- Farbliche Kennzeichnung bei Unterbestand (rot)
- Suche und Filterung
- QR-Katalog des eigenen Fahrzeugs als PDF

### 8.2 Buchungen vornehmen

Direkt aus der „Mein Fahrzeug"-Ansicht können Sie:
- Artikel **einbuchen** (Nachschub erhalten)
- Artikel **ausbuchen** (verbraucht / eingebaut)
- Buchungen über die Scanner-Integration vornehmen

### 8.3 Sollbestand anpassen

Als Techniker können Sie (je nach Berechtigung) den **Sollbestand** einzelner Artikel für Ihr Fahrzeug anpassen.

---

## 9. Buchungen – Scanner & Schnellbuchung

### 9.1 Scanner

Der Scanner erlaubt das schnelle Buchen über Barcode- oder QR-Code-Scan.

**Vorgehensweise:**
1. Navigieren Sie zu **„Scanner"**
2. Aktivieren Sie die Kamera über den **Scanner-Button**
3. Halten Sie den Barcode/QR-Code vor die Kamera
4. Der Artikel wird automatisch erkannt
5. Wählen Sie die **Buchart**: Einbuchen oder Ausbuchen
6. Passen Sie die **Menge** an (+ / – Buttons oder direkte Eingabe)
7. Klicken Sie auf **„Buchen"**

**Manuell suchen:** Wenn kein Scanner verfügbar ist, können Sie den Artikel auch über das Suchfeld manuell auswählen.

**Neuen Artikel anlegen:** Wenn ein gescannter Code nicht gefunden wird, können Sie direkt aus dem Scanner heraus einen neuen Artikel anlegen.

### 9.2 Schnellbuchung

Die Schnellbuchung eignet sich für **Massenbuchungen**, z.B. beim Auffüllen mehrerer Artikel gleichzeitig.

**Buchmodi:**
- **Ausbuchung** (Verbrauch, Lieferung an Kunden)
- **Einbuchung** (Wareneingang, Auffüllung)

**Vorgehensweise:**
1. Navigieren Sie zu **„Schnellbuchung"**
2. Wählen Sie den Buchungsmodus
3. Optional: **Referenz** eintragen (Auftragsnummer, Kundenname etc.)
4. Scannen oder suchen Sie Artikel und tragen Sie die Menge ein
5. Klicken Sie auf **„Hinzufügen"**
6. Wiederholen Sie für alle weiteren Artikel
7. Klicken Sie auf **„Alle buchen"** um alle Positionen zu verbuchen

**Liste bearbeiten:** Einzelne Positionen können vor dem Buchen noch entfernt oder geändert werden.

### 9.3 Offline-Buchungen

Buchungen können auch **ohne Internetverbindung** vorgenommen werden. Sie werden lokal in der Warteschlange gespeichert und beim nächsten Online-Gang automatisch übertragen. Die Anzahl der ausstehenden Buchungen wird im Sync-Bereich angezeigt.

---

## 10. Inventur

Die Inventur ermöglicht die **körperliche Bestandsaufnahme** aller Fahrzeuge.

### 10.1 Inventursitzung starten

1. Navigieren Sie zu **„Inventur"**
2. Klicken Sie auf **„Neue Sitzung"**
3. Wählen Sie:
   - **Einzelnes Fahrzeug**: Inventur für ein bestimmtes Fahrzeug
   - **Ganzer Fuhrpark**: Inventur für alle Fahrzeuge gleichzeitig
4. Die Sitzung wird geöffnet

### 10.2 Artikel zählen

1. Scannen Sie den Barcode eines Artikels oder wählen Sie ihn manuell
2. Geben Sie die **gezählte Menge** ein
3. Klicken Sie auf **„Eintragen"**
4. Wiederholen Sie für alle Artikel

**Tipp:** Nutzen Sie den eingebauten Barcode-Scanner für schnelleres Arbeiten.

### 10.3 Inventurprozess

Die Sitzung durchläuft folgende Zustände:

| Status | Bedeutung |
|---|---|
| **Offen** | Sitzung angelegt, Zählung noch nicht begonnen |
| **In Bearbeitung** | Zählung läuft |
| **Abgeschlossen** | Zählung beendet, wartet auf Überprüfung |
| **Eingereicht** | Zur Freigabe eingereicht |
| **Finalisiert** | Freigegeben, Bestände übernommen |

### 10.4 Differenzauswertung

Nach der Zählung zeigt das System die **Differenzen** zwischen gezähltem und erwartetem Bestand an. Sie können:
- Differenzen einzeln prüfen
- Sitzung neu öffnen für Nachzählungen
- Protokoll als **PDF** oder **Excel** exportieren

### 10.5 Sitzung finalisieren

Nach Überprüfung und Freigabe durch einen Manager wird die Sitzung **finalisiert**. Die gezählten Bestände werden als neue Sollwerte übernommen.

---

## 11. Bestellwesen

Das Bestellwesen umfasst den gesamten Beschaffungsprozess – von der automatischen Bedarfsermittlung bis zum Wareneingang.

### 11.1 Bestellvorschläge

Das System ermittelt automatisch Artikel, die bestellt werden sollten, basierend auf Meldebestand und Sollbestand.

**Ansicht aufrufen:** Navigieren Sie zu **„Bestellungen" → Tab „Bestellvorschläge"**

#### Wie werden Vorschläge berechnet?

Ein Artikel erscheint in den Vorschlägen wenn:
- **Meldebestand gesetzt:** Ist-Bestand ≤ Meldebestand
- **Kein Meldebestand:** Ist-Bestand < Sollbestand

Die **benötigte Menge** ergibt sich aus: Sollbestand − Ist-Bestand − bereits bestellte Menge

#### Filter: Nur Mindestbestand unterschritten

Aktivieren Sie diese Checkbox um nur die **kritischen** Artikel anzuzeigen, deren Ist-Bestand den Mindestbestand (Sicherheitspuffer) unterschritten hat.

#### Artikel direkt bearbeiten

Klicken Sie auf eine **Artikelnummer** um den Artikel direkt aus der Bestellansicht zu bearbeiten (Sollbestand, Melde- oder Mindestbestand anpassen) – ohne die Seite zu verlassen.

#### Aktualisieren (Cache umgehen)

Der **„Aktualisieren"-Button** lädt die Vorschläge neu und umgeht den serverseitigen Cache. Nutzen Sie ihn nach dem Bearbeiten von Artikeln um sofort aktuelle Daten zu sehen.

#### Bestellungen aus Vorschlägen erstellen

1. Haken Sie die gewünschten Artikel an (oder „Alle auswählen")
2. Passen Sie die Bestellmenge bei Bedarf an
3. Klicken Sie auf **„Bestellungen erstellen"**
4. Das System gruppiert die Artikel automatisch nach Lieferant und erstellt separate Bestellungen

### 11.2 Aktive Bestellungen

Hier sehen Sie alle offenen Bestellungen mit ihrem aktuellen Status.

#### Bestellstatus

| Status | Bedeutung |
|---|---|
| **Entwurf** | Erstellt, aber noch nicht abgesendet |
| **Bestellt** | An Lieferant übermittelt |
| **Empfangen** | Ware vollständig eingegangen |
| **Archiviert** | Abgeschlossen und archiviert |

#### Aktionen pro Bestellung

- **PDF erzeugen:** Druckbares Bestellformular als PDF
- **E-Mail senden:** Bestellung per E-Mail an Lieferanten senden
- **Bearbeiten:** Positionen und Mengen ändern (nur im Status „Entwurf")
- **Archivieren:** Abgeschlossene Bestellungen archivieren
- **Löschen:** Bestellung löschen (nur Entwürfe)

### 11.3 Wareneingang

Im Tab **„Wareneingang"** erfassen Sie eingegangene Lieferungen.

**Vorgehensweise:**
1. Wählen Sie die zugehörige Bestellung aus
2. Scannen Sie die gelieferten Artikel oder wählen Sie sie manuell
3. Tragen Sie die **gelieferte Menge** ein
4. Bestätigen Sie den Eingang

Das System aktualisiert automatisch den Lagerbestand und den Bestellstatus. Bei Teillieferungen bleibt die Bestellung im Status „Bestellt" bis alle Positionen eingegangen sind.

### 11.4 Archivierte Bestellungen

Alle abgeschlossenen Bestellungen finden Sie im Tab **„Archiv"**. Hier können Sie:
- Vergangene Bestellungen einsehen
- PDFs erneut herunterladen
- Bestellhistorie nach Datum und Lieferant filtern

---

## 12. Lieferantenverwaltung

Lieferanten werden in der Bestellverwaltung verwendet und können Artikeln zugeordnet werden.

### 12.1 Lieferant anlegen

1. Navigieren Sie zu **„Lieferanten"**
2. Klicken Sie auf **„Neuer Lieferant"**
3. Füllen Sie das Formular aus:

| Feld | Beschreibung |
|---|---|
| Name | Firmenname (Pflichtfeld) |
| Ansprechpartner | Kontaktperson |
| E-Mail | E-Mail-Adresse für Bestellungen |
| Telefon | Telefonnummer |
| Kundennummer | Ihre Kundennummer beim Lieferanten |
| Adresse | Straße, PLZ, Ort, Land |
| Notizen | Interne Notizen |

4. Klicken Sie auf **„Speichern"**

**Adresse automatisch vervollständigen:** Geben Sie eine Adresse ein – das System schlägt Treffer via OpenStreetMap vor.

### 12.2 Lieferant einem Artikel zuweisen

Öffnen Sie einen Artikel zur Bearbeitung und wählen Sie den Lieferanten aus dem Dropdown-Feld „Lieferant".

---

## 13. Berichte, Protokolle & Logs

### 13.1 Systemlogs

Navigieren Sie zu **„Logs"** (im Admin-Bereich). Das System protokolliert alle wichtigen Ereignisse.

#### Filteroptionen

| Filter | Optionen |
|---|---|
| Quelle | Frontend, Backend |
| Level | Info, Warnung, Fehler, Sicherheit |
| Kategorie | Auth, Bestand, Inventur, System, API |
| Anzahl | 25 / 50 / 100 / 200 Einträge |

#### Log-Statistiken

Oben in der Log-Ansicht sehen Sie auf einen Blick:
- Gesamtanzahl der Logs
- Anzahl Fehler
- Anzahl Warnungen
- Anzahl Sicherheitsereignisse

#### Log-Verwaltung

- **CSV exportieren:** Alle angezeigten Logs als CSV-Datei
- **JSON exportieren:** Alle Logs im JSON-Format
- **Logs bereinigen:** Alte Logs löschen (nach einstellbarer Aufbewahrungszeit)
- **Alle löschen:** Komplette Log-Datenbank leeren (Bestätigung erforderlich)

#### Aufbewahrungszeit

Legen Sie fest, wie lange Logs aufbewahrt werden sollen (1 bis 3650 Tage). Klicken Sie auf **„Speichern"** um die Einstellung zu übernehmen.

### 13.2 Archivverwaltung

Navigieren Sie zu **„Archiv"** um archivierte Dokumente zu verwalten.

**Funktionen:**
- Übersicht aller archivierten Dokumente nach Kategorie
- Einzelne Dokumente herunterladen
- Mehrere Dokumente als ZIP herunterladen
- Archiv-Statistiken (Anzahl, Größe, Datumsbereich)
- Aufbewahrungsrichtlinie konfigurieren
- Manuell archivieren

---

## 14. Offline-Modus & Synchronisation

Die App unterstützt vollständigen **Offline-Betrieb**. Sie können Buchungen vornehmen, auch wenn keine Internetverbindung besteht.

### 14.1 Wie funktioniert Offline?

1. Beim ersten Online-Aufruf werden **Artikelstammdaten** und **Fahrzeugbestände** lokal gespeichert
2. Buchungen werden in einer **lokalen Warteschlange** gespeichert
3. Sobald die Verbindung wiederhergestellt ist, werden die Buchungen automatisch übertragen

### 14.2 Synchronisationsseite

Navigieren Sie zu **„Sync"** um den Synchronisationsstatus einzusehen und manuell zu synchronisieren.

**Anzeigen:**
- Verbindungsstatus (Online/Offline)
- Anzahl ausstehender Buchungen
- Zeitpunkt der letzten Synchronisation
- Liste der wartenden Buchungen

**Manueller Sync-Prozess:**

| Schritt | Aktion |
|---|---|
| 1 | Ausstehende Buchungen übertragen |
| 2 | Artikel-Warteschlange synchronisieren |
| 3 | Artikelstammdaten laden |
| 4 | Offline-Sollwerte synchronisieren |
| 5 | Fahrzeugbestände laden |
| 6 | Fertig |

### 14.3 Offline-Indikatoren

- **Gelber Balken** oben im Dashboard: Keine Serververbindung
- **Chip „Offline"** in der Navigationsleiste
- **Buchungs-Counter** zeigt die Anzahl der wartenden Buchungen

> **Wichtig:** Melden Sie sich mindestens einmal online an, bevor Sie offline arbeiten möchten. Nur dann stehen lokale Daten zur Verfügung.

---

## 15. Systemeinstellungen

### 15.1 Firmeneinstellungen

Navigieren Sie zu **„Einstellungen"** (nur für Manager und Administratoren).

**Konfigurierbare Felder:**
- Firmenname
- Adresse (Zeile 1, Zeile 2)
- Postleitzahl, Stadt, Land
- Telefon
- E-Mail
- **Logo** (PNG empfohlen, mindestens 512×512 Pixel)

Das Firmenlogo wird im Login-Bildschirm und in generierten PDFs verwendet.

### 15.2 E-Mail-Einstellungen

Navigieren Sie zu **„Lagerverwaltung" → „E-Mail-Einstellungen"** (nur für Manager).

**SMTP-Konfiguration:**

| Feld | Beschreibung |
|---|---|
| Host | SMTP-Server (z.B. smtp.gmail.com) |
| Port | Serverport (z.B. 587) |
| Benutzername | E-Mail-Adresse oder SMTP-Benutzer |
| Passwort | SMTP-Passwort |
| Sichere Verbindung | TLS/SSL aktivieren |
| Absenderadresse | Anzeigename und E-Mail des Absenders |

**E-Mail testen:** Geben Sie eine Testadresse ein und klicken Sie auf **„Test-Mail senden"** um die Konfiguration zu prüfen.

### 15.3 Bestellvorlagen

Navigieren Sie zu **„Lagerverwaltung"** für Template-Einstellungen:

#### Bestell-PDF Vorlage

Gestalten Sie das Layout der generierten Bestellungs-PDFs:
- Firmenlogo und Kopfzeile
- Spalten der Positionstabelle
- Fußzeile mit Zahlungsbedingungen
- Schriftarten und Abstände

#### E-Mail-Vorlage für Bestellungen

Konfigurieren Sie den Text der Bestell-E-Mails:
- Betreff-Template mit Variablen ({{orderNumber}}, {{supplierName}} etc.)
- E-Mail-Text mit Platzhaltern
- Automatischer Positionsblock

#### QR-Wagenkatalog Vorlage

Gestalten Sie die PDF-Vorlage für den Fahrzeug-Artikelkatalog:
- Kopfzeile mit Fahrzeugdaten
- QR-Code-Größe und -Position
- Artikeltabelle mit Bestandsdaten

### 15.4 Datensicherung (Backup)

Navigieren Sie zu **„Datensicherung"** (nur für Administratoren).

#### Manuelles Backup

Klicken Sie auf **„Backup herunterladen"** um eine Sicherungsdatei zu erzeugen und herunterzuladen.

#### Backup wiederherstellen

1. Klicken Sie auf **„Backup wiederherstellen"**
2. Wählen Sie eine zuvor heruntergeladene Backup-Datei
3. Das System prüft die Datei auf Kompatibilität
4. Bestätigen Sie die Wiederherstellung

> **Achtung:** Die Wiederherstellung überschreibt alle aktuellen Daten. Erstellen Sie vorher ein aktuelles Backup.

#### Automatische Sicherungen

Konfigurieren Sie regelmäßige automatische Backups:
- **Häufigkeit:** Täglich, Wöchentlich, Monatlich
- **Uhrzeit:** Zeitpunkt der Sicherung
- Automatische Backups werden serverseitig gespeichert und können heruntergeladen oder gelöscht werden

---

## 16. Benutzerverwaltung & Zugriffsrechte

### 16.1 Benutzer verwalten

Navigieren Sie zu **„Zugangskontrolle"** → Tab **„Benutzer"**.

#### Benutzer anlegen

1. Klicken Sie auf **„Neuer Benutzer"**
2. Füllen Sie das Formular aus:

| Feld | Beschreibung |
|---|---|
| Benutzername | Einzigartiger Login-Name |
| Anzeigename | Name im System |
| E-Mail | E-Mail-Adresse |
| Passwort | Anfangspasswort (min. 6 Zeichen) |
| Rolle | System-Rolle zuweisen |
| Fahrzeug | Fahrzeugzuweisung (für Techniker) |

#### Benutzer bearbeiten

Klicken Sie auf das Stift-Symbol um Benutzerdaten zu ändern. Sie können Passwort, Rolle, Fahrzeugzuweisung und weitere Daten bearbeiten.

### 16.2 Rollen verwalten

Im Tab **„Rollen verwalten"** erstellen und bearbeiten Sie Rollen.

Standardrollen:
- **Admin** – Vollzugriff
- **Manager** – Verwaltungszugriff
- **Techniker** – Buchungen und Fahrzeugbestand
- **Viewer** – Nur-Lese-Zugriff

Sie können eigene Rollen mit individuellen Rechten anlegen.

### 16.3 Rollenrechte

Im Tab **„Rollenrechte"** weisen Sie einer Rolle konkrete Berechtigungen zu.

Jede Berechtigung folgt dem Schema `bereich.aktion`, z.B.:
- `items.view` – Artikel ansehen
- `items.edit` – Artikel bearbeiten
- `orders.create` – Bestellungen erstellen
- `inventory.manage` – Inventur verwalten

### 16.4 Rechte-Matrix

Die **Rechte-Matrix** zeigt übersichtlich alle Rollen mit ihren Berechtigungen in einer Tabelle. Berechtigungen können direkt in der Matrix ein- und ausgeschaltet werden.

### 16.5 Benutzer-Overrides

Im Tab **„Benutzer-Overrides"** können Sie einzelnen Benutzern abweichende Berechtigungen geben, die von der zugewiesenen Rolle abweichen:
- Berechtigung **hinzufügen** (über die Rolle hinaus)
- Berechtigung **entziehen** (trotz Rolle nicht erlaubt)

---

## 17. Administration & Wartung

### 17.1 Datenbankwartung

Navigieren Sie zu **„Admin" → „Wartung"** (nur für Administratoren).

Das Wartungswerkzeug prüft die Datenbank auf Inkonsistenzen und Probleme:
- Verwaiste Datensätze
- Ungültige Referenzen
- Fehlende Pflichtfelder

**Probleme automatisch beheben:**
1. Klicken Sie auf **„Datenbank prüfen"**
2. Sehen Sie sich die gefundenen Probleme an
3. Klicken Sie auf **„Automatisch beheben"** für lösbare Probleme
4. Bestätigen Sie die Aktion

### 17.2 Protokollverwaltung

Navigieren Sie zu **„Admin" → „Protokollverwaltung"** für erweiterte Log-Verwaltung:
- Logs nach Datum filtern
- Ältere Logs archivieren
- Export für externe Analyse

---

## 18. Anhang: Berechtigungsübersicht

| Berechtigung | Beschreibung |
|---|---|
| `items.view` | Artikel ansehen |
| `items.create` | Artikel anlegen |
| `items.edit` | Artikel bearbeiten |
| `items.delete` | Artikel löschen |
| `stock.view` | Bestand ansehen |
| `stock.manage` | Bestand buchen und verwalten |
| `inventory.count` | Inventurzählung durchführen |
| `inventory.manage` | Inventur verwalten und freigeben |
| `vehicles.view` | Fahrzeuge ansehen |
| `vehicles.create` | Fahrzeuge anlegen |
| `vehicles.edit` | Fahrzeuge bearbeiten |
| `vehicles.delete` | Fahrzeuge löschen |
| `locations.view` | Lagerorte ansehen |
| `locations.create` | Lagerorte anlegen |
| `locations.edit` | Lagerorte bearbeiten |
| `locations.delete` | Lagerorte löschen |
| `suppliers.view` | Lieferanten ansehen |
| `suppliers.create` | Lieferanten anlegen |
| `suppliers.edit` | Lieferanten bearbeiten |
| `suppliers.delete` | Lieferanten löschen |
| `orders.view` | Bestellungen ansehen |
| `orders.create` | Bestellungen erstellen |
| `orders.edit` | Bestellungen bearbeiten |
| `orders.delete` | Bestellungen löschen |
| `users.view` | Benutzer ansehen |
| `users.create` | Benutzer anlegen |
| `users.edit` | Benutzer bearbeiten |
| `users.delete` | Benutzer löschen |
| `settings.company` | Firmeneinstellungen bearbeiten |
| `settings.email` | E-Mail-Einstellungen bearbeiten |
| `logs.view` | Logs ansehen |
| `logs.manage` | Logs verwalten und löschen |
| `backup.create` | Backups erstellen |
| `backup.restore` | Backups wiederherstellen |

---

## Tastaturkürzel & Tipps

| Aktion | Hinweis |
|---|---|
| Artikel suchen | Suchfeld aktiv, einfach tippen |
| Barcode scannen | Scanner-Seite oder Quick-Booking öffnen |
| Buchung rückgängig | Nicht direkt möglich – Gegenbuchung vornehmen |
| Offline-Sync | Sync-Seite → „Jetzt synchronisieren" |
| Alle Vorschläge auswählen | Checkbox in der Kopfzeile der Bestellvorschläge |

---

## Häufige Fragen (FAQ)

**F: Ich sehe einen Artikel nicht in der Bestellvorschlagsliste, obwohl der Bestand niedrig ist.**
A: Prüfen Sie ob der Artikel einen **Sollbestand > 0** hat. Nur Artikel mit Sollbestand werden berücksichtigt. Außerdem muss ein Lagerort zugewiesen sein.

**F: Die Bestellvorschläge aktualisieren sich nach einer Artikeländerung nicht sofort.**
A: Klicken Sie auf **„Aktualisieren"** im Tab Bestellvorschläge. Der Button umgeht den Server-Cache und lädt aktuelle Daten.

**F: Ein Artikel erscheint in den Bestellvorschlägen, obwohl genug Bestand vorhanden ist.**
A: Prüfen Sie den **Meldebestand** des Artikels. Wenn Ist-Bestand ≤ Meldebestand, wird eine Bestellung vorgeschlagen – unabhängig davon ob Mindestbestand unterschritten ist.

**F: Meine Offline-Buchungen werden nicht synchronisiert.**
A: Gehen Sie auf die **Sync-Seite** und klicken Sie auf „Jetzt synchronisieren". Prüfen Sie ob Sie online sind und ob Sie angemeldet sind.

**F: Ich kann keinen neuen Benutzer anlegen.**
A: Sie benötigen die Berechtigung `users.create`. Wenden Sie sich an Ihren Administrator.

**F: Wie ändere ich mein Passwort?**
A: Passwörter können derzeit nur von Administratoren in der Benutzerverwaltung geändert werden.

**F: Bestellungs-PDFs werden nicht im `purchase-orders`-Ordner auf dem Server gespeichert.**
A: Ursache sind fehlende Schreibrechte auf dem gemounteten Ordner. Der Backend-Container läuft als Benutzer mit UID 1001 und benötigt Schreibzugriff auf das Verzeichnis. Behebung auf der NAS per SSH:
```bash
mkdir -p /volume1/docker/Lagerverwaltung/purchase-orders
chown 1001:1001 /volume1/docker/Lagerverwaltung/purchase-orders
```
Danach ein PDF herunterladen – in den Backend-Logs erscheint dann `[PurchasingService] PDF gespeichert: 2026/...`. Die PDFs sind anschließend auch per SMB-Freigabe erreichbar (Freigabe auf `/volume1/docker/Lagerverwaltung/purchase-orders` im NAS-Adminbereich einrichten).

---

*Dieses Handbuch wurde automatisch generiert. Bei Fragen oder Anmerkungen wenden Sie sich an Ihren Systemadministrator.*
