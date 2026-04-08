# Lagerverwaltung – Benutzerhandbuch

> **Version:** 3.3.6
> **Zielgruppe:** Lageristen, Techniker, Manager, Administratoren
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
13. [Berichte & Systemprotokolle](#13-berichte--systemprotokolle)
14. [Offline-Modus & Synchronisation](#14-offline-modus--synchronisation)
15. [Systemeinstellungen](#15-systemeinstellungen)
16. [Benutzerverwaltung & Zugriffsrechte](#16-benutzerverwaltung--zugriffsrechte)
17. [Niederlassungen](#17-niederlassungen)
18. [Administration & Wartung](#18-administration--wartung)
19. [Anhang: Berechtigungsübersicht](#19-anhang-berechtigungsübersicht)

---

## 1. Überblick

Die **Lagerverwaltung** ist ein webbasiertes System zur Verwaltung von Ersatzteilen und Verbrauchsmaterialien. Es läuft vollständig im Browser und ist als Progressive Web App (PWA) auch offline nutzbar. Das System unterstützt mehrere Niederlassungen mit getrennten Beständen, Einstellungen und Benutzern.

### Kernfunktionen auf einen Blick

| Bereich | Beschreibung |
|---|---|
| Artikelverwaltung | Anlegen, Bearbeiten und Importieren von Ersatzteilen |
| Bestandsführung | Buchungen pro Fahrzeug, Scanner-Integration |
| Inventur | Körperliche Bestandsaufnahme pro Niederlassung |
| Bestellwesen | Bestellvorschläge, Bestellungen, Wareneingang |
| Niederlassungen | Mehrere Standorte mit getrennten Daten und Einstellungen |
| Offline-Betrieb | Buchungen ohne Internetverbindung möglich |
| Zugriffsrechte | Rollen- und benutzerbasierte Berechtigungen |
| Exporte | PDF, Excel, CSV für alle Bereiche |

### Benutzerrollen

| Rolle | Beschreibung |
|---|---|
| **Super-Admin** | Niederlassungsübergreifender Vollzugriff, Systemkonfiguration, Protokolle |
| **Manager** | Vollzugriff innerhalb der eigenen Niederlassung |
| **Lagerist** | Bestandsbuchungen, Bestellungen, Inventur |
| **Techniker** | Buchungen am eigenen Fahrzeug |

> Die genauen Rechte können je nach Konfiguration abweichen. Ihre zugewiesenen Rechte sehen Sie in der Benutzerverwaltung.

---

## 2. Erste Schritte – Login & Ersteinrichtung

### 2.1 Ersteinrichtung

Beim allerersten Start des Systems erscheint die **Einrichtungsseite**. Hier legen Sie den ersten Super-Admin-Account an:

1. **Benutzername** eingeben (wird für den Login verwendet)
2. **Anzeigename** eingeben (wird im System angezeigt)
3. **Passwort** vergeben – das Passwort muss folgende Anforderungen erfüllen:
   - Mindestens **8 Zeichen**
   - Mindestens ein **Großbuchstabe**
   - Mindestens eine **Zahl**
   - Mindestens ein **Sonderzeichen** (z.B. `!`, `@`, `#`, `$`)
4. **„Einrichtung abschließen"** klicken

Nach erfolgreicher Einrichtung werden Sie automatisch zur Anmeldeseite weitergeleitet.

### 2.2 Anmeldung

1. Öffnen Sie die App-URL in Ihrem Browser
2. Geben Sie **Benutzername** und **Passwort** ein
3. Klicken Sie auf **„Anmelden"**

> **Sicherheitshinweis:** Nach 10 aufeinanderfolgenden Fehlversuchen wird das Konto für 15 Minuten gesperrt.

**Offline-Anmeldung:** Wenn keine Internetverbindung besteht und Sie sich zuvor schon einmal online angemeldet haben, können Sie sich mit Ihren gespeicherten Zugangsdaten offline anmelden. Die App zeigt in diesem Fall einen Hinweis an.

### 2.3 Passwort ändern

Administratoren können in der Benutzerverwaltung Passwörter für alle Benutzer ändern. Benutzer können ihr eigenes Passwort über **„Profil"** → **„Passwort ändern"** ändern.

Das neue Passwort muss die Komplexitätsanforderungen erfüllen (siehe 2.1).

---

## 3. Dashboard

Das Dashboard ist die Startseite nach dem Login. Es zeigt auf einen Blick die wichtigsten Informationen der eigenen Niederlassung.

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

Die Artikelverwaltung ist das Herzstück des Systems. Hier werden alle Ersatzteile und Verbrauchsmaterialien gepflegt. Jede Niederlassung hat ihren eigenen, isolierten Artikelstamm.

### 4.1 Artikelübersicht

Navigieren Sie über das Menü zu **„Artikel"**. Die Übersicht zeigt alle Artikel der eigenen Niederlassung mit:
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
| Artikelnummer | ✅ | Eindeutige Kennung pro Niederlassung |
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

Klicken Sie auf das **Stift-Symbol** neben einem Artikel oder direkt auf die Zeile. Der Bearbeitungsdialog öffnet sich mit allen aktuellen Werten. Aus dem Bestellmenü kann ein Artikel auch direkt über einen Klick auf die Artikelnummer geöffnet werden.

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

> **Hinweis:** Der Import ist niederlassungsisoliert. Gleiche Artikelnummern in verschiedenen Niederlassungen sind möglich. Bestehende Artikel werden aktualisiert, neue angelegt.

### 4.6 CSV-Import (allgemein)

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

Lagerorte beschreiben die physische Struktur Ihres Lagers (Regale, Fächer, Schränke usw.). Lagerorte sind pro Niederlassung getrennt.

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

> **Tipp:** Strukturierte Codes wie `Regal 1 / Fach 3` oder `Schrank 2 / Schublade 1` werden in der Bestellansicht automatisch erkannt und lesbar angezeigt.

### 5.3 Lagerort zuweisen

Lagerorte werden in der Artikelverwaltung einem Artikel zugewiesen. Beim Anlegen/Bearbeiten eines Artikels wählen Sie den Lagerort aus dem Dropdown.

---

## 6. Fahrzeugverwaltung

Fahrzeuge repräsentieren die Servicefahrzeuge Ihres Fuhrparks. Jedes Fahrzeug hat seinen eigenen Bestand. Fahrzeuge sind pro Niederlassung getrennt.

### 6.1 Fahrzeug anlegen

1. Navigieren Sie zu **„Zugangskontrolle" → „Fahrzeuge"**
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

Die Fuhrpark-Übersicht zeigt den **aktuellen Bestand aller Fahrzeuge** der eigenen Niederlassung auf einen Blick.

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
2. Aktivieren Sie die Kamera über den **„Scanner starten"-Button**
3. Halten Sie den Barcode/QR-Code vor die Kamera
4. Der Artikel wird automatisch erkannt
5. Wählen Sie die **Buchart**: Einbuchen oder Ausbuchen
6. Passen Sie die **Menge** an (+ / – Buttons oder direkte Eingabe)
7. Klicken Sie auf **„Buchen"**

**Manuell suchen:** Wenn kein Scanner verfügbar ist, können Sie über **„Artikel manuell auswählen"** den Artikel über ein Suchfeld finden.

**Neuen Artikel anlegen:** Wenn ein gescannter Code nicht gefunden wird, erscheint ein Dialog. Sie können dort direkt einen neuen Artikel anlegen und anschließend sofort buchen.

> **Hinweis:** QR-Codes im Format `ARTIKELCODE - BESCHREIBUNG` werden korrekt erkannt – auch wenn der Artikelcode selbst Bindestriche enthält (z.B. `GO-00732000 - HDD`).

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

### 9.3 Offline-Buchungen

Buchungen können auch **ohne Internetverbindung** vorgenommen werden. Sie werden lokal in der Warteschlange gespeichert und beim nächsten Online-Gang automatisch übertragen. Die Anzahl der ausstehenden Buchungen wird im Sync-Bereich angezeigt.

---

## 10. Inventur

Die Inventur ermöglicht die **körperliche Bestandsaufnahme** aller Fahrzeuge einer Niederlassung. Jede Niederlassung führt ihre Inventur eigenständig durch. Super-Admin kann niederlassungsübergreifende Inventursitzungen anlegen.

### 10.1 Inventursitzung starten

1. Navigieren Sie zu **„Inventur"**
2. Klicken Sie auf **„Neue Sitzung"**
3. Vergeben Sie einen **Namen** (z.B. „Jahresinventur April 2026")
4. Optional: **Standort** eintragen
5. Klicken Sie auf **„Starten"**

### 10.2 Artikel zählen

1. Wählen Sie das **Fahrzeug** in der Sitzung aus
2. Scannen Sie den Barcode eines Artikels oder wählen Sie ihn manuell
3. Geben Sie die **gezählte Menge** ein
4. Klicken Sie auf **„Eintragen"**
5. Wiederholen Sie für alle Artikel

### 10.3 Inventurprozess

Die Sitzung durchläuft folgende Zustände:

| Status | Bedeutung |
|---|---|
| **Entwurf** | Sitzung angelegt, Zählung noch nicht begonnen |
| **In Bearbeitung** | Zählung läuft, Techniker buchen ein |
| **Eingereicht** | Fahrzeug vom Techniker zur Freigabe eingereicht |
| **Abgeschlossen** | Alle Fahrzeuge eingereicht, wartet auf Finalisierung |
| **Finalisiert** | Freigegeben, Bestände übernommen |

### 10.4 Differenzauswertung

Nach der Zählung zeigt das System die **Differenzen** zwischen gezähltem und erwartetem Bestand an. Sie können:
- Differenzen einzeln prüfen
- Sitzung für Nachzählungen neu öffnen
- Protokoll als **PDF** oder **Excel** exportieren

### 10.5 Sitzung finalisieren

Nach Überprüfung und Freigabe durch einen Manager wird die Sitzung **finalisiert**. Die gezählten Bestände werden als neue Sollwerte übernommen.

> **Techniker:** Sie können Ihre Fahrzeuginventur nach Abschluss als PDF herunterladen. Navigieren Sie zur Sitzung und klicken Sie auf das PDF-Symbol neben Ihrem Fahrzeug.

---

## 11. Bestellwesen

Das Bestellwesen umfasst den gesamten Beschaffungsprozess – von der automatischen Bedarfsermittlung bis zum Wareneingang.

### 11.1 Bestellvorschläge

Das System ermittelt automatisch Artikel, die bestellt werden sollten, basierend auf Meldebestand und Sollbestand.

**Ansicht aufrufen:** Navigieren Sie zu **„Bestellungen" → Tab „Vorschläge"**

#### Wie werden Vorschläge berechnet?

Ein Artikel erscheint in den Vorschlägen wenn:
- **Meldebestand gesetzt:** Ist-Bestand ≤ Meldebestand
- **Kein Meldebestand:** Ist-Bestand < Sollbestand

Die **benötigte Menge** ergibt sich aus: Sollbestand − Ist-Bestand − bereits bestellte Menge

#### Filter: Nur Mindestbestand unterschritten

Aktivieren Sie diese Checkbox um nur die **kritischen** Artikel anzuzeigen, deren Ist-Bestand den Mindestbestand (Sicherheitspuffer) unterschritten hat.

#### Bestand anderer Niederlassungen anzeigen

Aktivieren Sie den Schalter **„Bestand anderer Niederlassungen"** um bei jedem Artikel farbige Chips einzublenden, die zeigen ob und wie viel Bestand in anderen Niederlassungen vorhanden ist. Dies hilft, unnötige Bestellungen zu vermeiden wenn ein Artikel intern umgelagert werden kann.

#### Artikel direkt bearbeiten

Klicken Sie auf eine **Artikelnummer** um den Artikel direkt aus der Bestellansicht zu bearbeiten (Sollbestand, Melde- oder Mindestbestand anpassen) – ohne die Seite zu verlassen.

#### Aktualisieren (Cache umgehen)

Der **„Aktualisieren"-Button** lädt die Vorschläge neu und umgeht den serverseitigen Cache. Nutzen Sie ihn nach dem Bearbeiten von Artikeln um sofort aktuelle Daten zu sehen.

#### Bestellungen aus Vorschlägen erstellen

1. Haken Sie die gewünschten Artikel an (oder „Alle auswählen")
2. Passen Sie die Bestellmenge bei Bedarf an
3. Klicken Sie auf **„Bestellungen erstellen"**
4. Das System gruppiert die Artikel automatisch nach Lieferant und erstellt separate Bestellungen
5. Im folgenden Dialog wählen Sie die Aktion: **Als Entwurf speichern**, **PDF herunterladen** oder **Per E-Mail versenden**

### 11.2 Aktive Bestellungen

Hier sehen Sie alle offenen Bestellungen mit ihrem aktuellen Status.

#### Bestellstatus

| Status | Bedeutung |
|---|---|
| **Entwurf** | Erstellt, aber noch nicht abgesendet |
| **Bestellt** | An Lieferant übermittelt, Wareneingang steht aus |
| **Archiviert** | Ware vollständig eingegangen und abgeschlossen |

> **Hinweis:** Vollständig eingegangene Bestellungen werden automatisch archiviert. Das Bestell-PDF bleibt auch nach der Archivierung abrufbar.

#### Aktionen pro Bestellung

- **PDF erzeugen / herunterladen:** Druckbares Bestellformular als PDF
- **Per E-Mail senden:** Öffnet das Mailprogramm mit vorbereitetem Text und lädt das PDF herunter
- **Bearbeiten:** Positionen und Mengen ändern (nur im Status „Entwurf")
- **Löschen:** Bestellung löschen (nur Entwürfe)

### 11.3 Wareneingang

Im Tab **„Wareneingang"** erfassen Sie eingegangene Lieferungen.

**Vorgehensweise:**
1. Wählen Sie die zugehörige Bestellung aus
2. Scannen Sie die gelieferten Artikel oder wählen Sie sie manuell
3. Tragen Sie die **gelieferte Menge** ein
4. Bestätigen Sie den Eingang

Das System aktualisiert automatisch den Lagerbestand und den Bestellstatus. Bei Teillieferungen bleibt die Bestellung im Status „Bestellt" bis alle Positionen eingegangen sind. Bei vollständigem Eingang wird die Bestellung automatisch archiviert.

### 11.4 Archivierte Bestellungen

Alle abgeschlossenen Bestellungen finden Sie im Tab **„Archiv"**. Hier können Sie:
- Vergangene Bestellungen einsehen
- PDFs erneut herunterladen
- Bestellhistorie nach Jahr und Lieferant filtern

---

## 12. Lieferantenverwaltung

Lieferanten werden in der Bestellverwaltung verwendet und können Artikeln zugeordnet werden. Lieferanten sind pro Niederlassung getrennt.

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

## 13. Berichte & Systemprotokolle

### 13.1 Systemlogs

> **Zugriff:** Systemprotokolle sind ausschließlich für den **Super-Admin** zugänglich.

Navigieren Sie zu **„Logs"** im Admin-Bereich. Das System protokolliert alle wichtigen Ereignisse niederlassungsübergreifend.

#### Filteroptionen

| Filter | Optionen |
|---|---|
| Zeitraum | Von / Bis Datum |
| Level | Info, Warnung, Fehler, Sicherheit |
| Kategorie | Auth, Bestand, Inventur, System, API |
| Benutzer | Filter auf einzelnen Benutzer |
| Anzahl | 1 – 10.000 Einträge |

#### Log-Statistiken

Oben in der Log-Ansicht sehen Sie auf einen Blick:
- Gesamtanzahl der Logs (letzte 30 Tage)
- Anzahl Fehler
- Anzahl Warnungen
- Anzahl Sicherheitsereignisse

#### Log-Verwaltung

- **CSV exportieren:** Alle angezeigten Logs als CSV-Datei
- **JSON exportieren:** Alle Logs im JSON-Format
- **Logs bereinigen:** Alte Logs nach einstellbarer Aufbewahrungszeit löschen
- **Alle löschen:** Komplette Log-Datenbank leeren (Bestätigung erforderlich)

#### Aufbewahrungszeit

Legen Sie fest, wie lange Logs aufbewahrt werden sollen (1 bis 3650 Tage).

### 13.2 Archivverwaltung

Navigieren Sie zu **„Archiv"** um archivierte Dokumente zu verwalten.

**Funktionen:**
- Übersicht aller archivierten Dokumente nach Kategorie
- Einzelne Dokumente herunterladen
- Mehrere Dokumente als ZIP herunterladen
- Archiv-Statistiken (Anzahl, Größe, Datumsbereich)
- Aufbewahrungsrichtlinie konfigurieren

---

## 14. Offline-Modus & Synchronisation

Die App unterstützt vollständigen **Offline-Betrieb**. Buchungen können auch ohne Internetverbindung vorgenommen werden.

### 14.1 Wie funktioniert Offline?

1. Beim ersten Online-Aufruf werden **Artikelstammdaten** und **Fahrzeugbestände** lokal gespeichert
2. Buchungen werden in einer **lokalen Warteschlange** gespeichert
3. Sobald die Verbindung wiederhergestellt ist, werden die Buchungen automatisch übertragen

Die Offline-Sitzung ist bis zu **30 Tage** gültig – ausreichend für Techniker die längere Touren ohne Netzanbindung durchführen.

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

Einstellungen sind in zwei Ebenen unterteilt: **globale Einstellungen** (Super-Admin) und **niederlassungsspezifische Einstellungen** (Manager der jeweiligen Niederlassung). Niederlassungsspezifische Einstellungen überschreiben die globalen Werte.

### 15.1 Firmeneinstellungen

Navigieren Sie zu **„Einstellungen"** → **„Firmendaten"**.

**Konfigurierbare Felder:**
- Firmenname
- Adresse (Zeile 1, Zeile 2)
- Postleitzahl, Stadt, Land
- Telefon
- E-Mail
- **Logo** (PNG empfohlen, mindestens 512×512 Pixel)

Das Firmenlogo wird im Login-Bildschirm und in generierten PDFs verwendet.

> Manager sehen und bearbeiten nur die Daten ihrer eigenen Niederlassung. Super-Admin bearbeitet die globalen Firmendaten, die als Fallback für alle Niederlassungen dienen.

### 15.2 E-Mail-Einstellungen

Navigieren Sie zu **„Einstellungen" → „E-Mail"**.

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

Jede Niederlassung kann eine eigene SMTP-Konfiguration hinterlegen. Ist keine eigene Konfiguration vorhanden, wird automatisch die globale Konfiguration des Super-Admins verwendet.

### 15.3 Bestellvorlagen

Navigieren Sie zu **„Einstellungen"** für Template-Einstellungen:

#### Bestell-PDF Vorlage

Gestalten Sie das Layout der generierten Bestellungs-PDFs:
- Firmenlogo und Kopfzeile
- Spalten der Positionstabelle
- Fußzeile mit Zahlungsbedingungen
- Schriftarten und Abstände

#### E-Mail-Vorlage für Bestellungen

Konfigurieren Sie den Text der Bestell-E-Mails:
- Betreff-Template mit Variablen (`{{orderNumber}}`, `{{supplierName}}` etc.)
- E-Mail-Text mit Platzhaltern
- Automatischer Positionsblock

#### QR-Wagenkatalog Vorlage

Gestalten Sie die PDF-Vorlage für den Fahrzeug-Artikelkatalog:
- Kopfzeile mit Fahrzeugdaten
- QR-Code-Größe und -Position
- Artikeltabelle mit Bestandsdaten

### 15.4 Datensicherung (Backup)

> **Zugriff:** Nur für Super-Admin.

Navigieren Sie zu **„Datensicherung"**.

#### Manuelles Backup

Klicken Sie auf **„Backup herunterladen"** um eine Sicherungsdatei zu erzeugen und herunterzuladen. Das Backup enthält alle Daten aller Niederlassungen.

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
| Passwort | Anfangspasswort (min. 8 Zeichen, Großbuchstabe + Zahl + Sonderzeichen) |
| Rolle | System-Rolle zuweisen |
| Niederlassung | Niederlassungszuweisung (Super-Admin kann beliebige Niederlassung wählen) |
| Fahrzeug | Fahrzeugzuweisung (für Techniker) |

> **Passwortanforderungen:** Mindestens 8 Zeichen, ein Großbuchstabe, eine Zahl und ein Sonderzeichen. Beim ersten Login sollte das Passwort vom Benutzer geändert werden.

#### Benutzer bearbeiten

Klicken Sie auf das Stift-Symbol um Benutzerdaten zu ändern. Sie können Passwort, Rolle, Niederlassungszuweisung, Fahrzeugzuweisung und weitere Daten bearbeiten.

> Manager sehen und verwalten nur Benutzer ihrer eigenen Niederlassung. Super-Admin sieht alle Benutzer aller Niederlassungen und kann die Niederlassungszuweisung ändern.

### 16.2 Rollen verwalten

Im Tab **„Rollen verwalten"** erstellen und bearbeiten Sie Rollen.

Standardrollen:
- **MANAGER** – Vollzugriff innerhalb der Niederlassung
- **WAREHOUSE** – Lagerist: Buchungen, Bestellungen, Inventur
- **TECHNICIAN** – Techniker: Buchungen am eigenen Fahrzeug

Sie können eigene Rollen mit individuellen Rechten anlegen.

### 16.3 Rollenrechte-Matrix

Im Tab **„Rollenrechte"** sehen Sie alle Rollen mit ihren Berechtigungen in einer übersichtlichen Matrix. Berechtigungen können direkt in der Matrix ein- und ausgeschaltet werden.

Jede Berechtigung folgt dem Schema `bereich.aktion`, z.B.:
- `items.view` – Artikel ansehen
- `items.edit` – Artikel bearbeiten
- `orders.create` – Bestellungen erstellen
- `inventory.manage` – Inventur verwalten

### 16.4 Benutzer-Overrides

Im Tab **„Benutzer-Overrides"** können Sie einzelnen Benutzern abweichende Berechtigungen geben, die von der zugewiesenen Rolle abweichen:
- Berechtigung **hinzufügen** (über die Rolle hinaus, grün markiert)
- Berechtigung **entziehen** (trotz Rolle nicht erlaubt, rot markiert)

Dies ermöglicht es z.B. einem Manager gezielt einzelne Rechte zu entziehen, ohne eine neue Rolle anlegen zu müssen.

---

## 17. Niederlassungen

> **Zugriff:** Verwaltung nur für Super-Admin.

Das System unterstützt mehrere Niederlassungen (Standorte). Jede Niederlassung hat vollständig isolierte Daten:
- Eigener Artikelstamm
- Eigene Fahrzeuge und Bestände
- Eigene Lieferanten und Lagerorte
- Eigene Benutzer und Rollen
- Eigene Firmeneinstellungen und E-Mail-Konfiguration

### 17.1 Niederlassung anlegen

1. Navigieren Sie zu **„Niederlassungen"** (nur Super-Admin)
2. Klicken Sie auf **„Neue Niederlassung"**
3. Geben Sie **Name** und **Kürzel** ein
4. Speichern Sie

### 17.2 Benutzer einer Niederlassung zuweisen

Super-Admin kann in der Benutzerverwaltung bei jedem Benutzer die **Niederlassung** auswählen. Manager können nur innerhalb ihrer eigenen Niederlassung agieren.

### 17.3 Super-Admin

Der Super-Admin hat **branchId = null** (keine Niederlassung) und damit niederlassungsübergreifenden Vollzugriff. Er sieht alle Daten aller Niederlassungen und ist für die globale Systemkonfiguration zuständig.

---

## 18. Administration & Wartung

> **Zugriff:** Nur für Super-Admin.

### 18.1 Datenbankwartung

Navigieren Sie zu **„Wartung & Update"**.

Das Wartungswerkzeug prüft die Datenbank auf Inkonsistenzen und Probleme:
- Verwaiste Datensätze
- Ungültige Referenzen
- Fehlende Pflichtfelder

**Probleme automatisch beheben:**
1. Klicken Sie auf **„Datenbank prüfen"**
2. Sehen Sie sich die gefundenen Probleme an
3. Klicken Sie auf **„Automatisch beheben"** für lösbare Probleme
4. Bestätigen Sie die Aktion

### 18.2 Software-Update

Navigieren Sie zu **„Wartung & Update"** → Bereich **„Update"**.

Hier sehen Sie die aktuell installierte Version und können prüfen ob eine neue Version verfügbar ist.

---

## 19. Anhang: Berechtigungsübersicht

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
| `logs.view` | Systemprotokolle ansehen (nur Super-Admin) |
| `logs.manage` | Systemprotokolle verwalten und löschen (nur Super-Admin) |
| `backup.access` | Datensicherung erstellen und wiederherstellen (nur Super-Admin) |

---

## Häufige Fragen (FAQ)

**F: Ich sehe einen Artikel nicht in der Bestellvorschlagsliste, obwohl der Bestand niedrig ist.**
A: Prüfen Sie ob der Artikel einen **Sollbestand > 0** hat. Nur Artikel mit Sollbestand werden berücksichtigt. Außerdem muss ein Lieferant zugewiesen sein (ohne Lieferant erscheint der Artikel als „nicht bestellbar").

**F: Die Bestellvorschläge aktualisieren sich nach einer Artikeländerung nicht sofort.**
A: Klicken Sie auf **„Aktualisieren"** im Tab Bestellvorschläge. Der Button umgeht den Server-Cache und lädt aktuelle Daten.

**F: Ein Artikel erscheint in den Bestellvorschlägen, obwohl genug Bestand vorhanden ist.**
A: Prüfen Sie den **Meldebestand** des Artikels. Wenn Ist-Bestand ≤ Meldebestand, wird eine Bestellung vorgeschlagen – unabhängig davon ob der Mindestbestand unterschritten ist.

**F: Meine Offline-Buchungen werden nicht synchronisiert.**
A: Gehen Sie auf die **Sync-Seite** und klicken Sie auf „Jetzt synchronisieren". Prüfen Sie ob Sie online sind und ob Sie angemeldet sind.

**F: Ich kann keinen neuen Benutzer anlegen.**
A: Sie benötigen die Berechtigung `users.create`. Wenden Sie sich an Ihren Administrator.

**F: Wie ändere ich mein Passwort?**
A: Passwörter können von Administratoren in der Benutzerverwaltung geändert werden. Das neue Passwort muss mindestens 8 Zeichen enthalten sowie einen Großbuchstaben, eine Zahl und ein Sonderzeichen.

**F: Ich sehe die Systemprotokolle nicht.**
A: Die Systemprotokolle sind ausschließlich für den **Super-Admin** zugänglich. Manager und andere Rollen haben keinen Zugriff darauf.

**F: Ein Techniker kann sich nach mehreren Fehlversuchen nicht mehr anmelden.**
A: Nach 10 aufeinanderfolgenden falschen Passwörtern wird das Konto automatisch für **15 Minuten** gesperrt. Danach kann sich der Techniker wieder normal anmelden. Ein Administrator kann das Passwort in der Benutzerverwaltung zurücksetzen.

**F: Bestellungs-PDFs werden nicht auf dem Server gespeichert.**
A: Ursache sind fehlende Schreibrechte auf dem gemounteten Ordner. Behebung auf der NAS per SSH:
```bash
mkdir -p /volume1/docker/Lagerverwaltung/purchase-orders
chown 1001:1001 /volume1/docker/Lagerverwaltung/purchase-orders
```
Danach ein PDF herunterladen – in den Backend-Logs erscheint dann `[PurchasingService] PDF gespeichert`. Die PDFs sind anschließend auch per SMB-Freigabe erreichbar.

**F: Die App zeigt „Offline" obwohl das Netzwerk funktioniert.**
A: Prüfen Sie ob der Backend-Container läuft (`sudo docker logs lagerverwaltung-backend-1 --tail 20`). Häufige Ursache nach Updates: eine Pflicht-Umgebungsvariable fehlt in der `.env` (z.B. `INVENTORY_HMAC_SECRET`). Alle Pflichtfelder sind in `.env.example` dokumentiert.

---

*Lagerverwaltung – Benutzerhandbuch v3.3.6*
