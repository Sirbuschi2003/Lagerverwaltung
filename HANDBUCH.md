# Lagerverwaltung – Benutzerhandbuch

> **Version:** 3.5.1
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
10. [Bewegungshistorie](#10-bewegungshistorie)
11. [Inventur](#11-inventur)
12. [Bestellwesen](#12-bestellwesen)
13. [Lieferantenverwaltung](#13-lieferantenverwaltung)
14. [Benachrichtigungen](#14-benachrichtigungen)
15. [Offline-Modus & Synchronisation](#15-offline-modus--synchronisation)
16. [Benutzereinstellungen & Personalisierung](#16-benutzereinstellungen--personalisierung)
17. [Systemeinstellungen](#17-systemeinstellungen)
18. [Benutzerverwaltung & Zugriffsrechte](#18-benutzerverwaltung--zugriffsrechte)
19. [Niederlassungen](#19-niederlassungen)
20. [Administration & Wartung](#20-administration--wartung)
21. [Anhang: Berechtigungsübersicht](#21-anhang-berechtigungsübersicht)
22. [Häufige Fragen (FAQ)](#22-häufige-fragen-faq)

---

## 1. Überblick

Die **Lagerverwaltung** ist ein webbasiertes System zur Verwaltung von Ersatzteilen und Verbrauchsmaterialien für Fuhrparks und Werkstätten. Es läuft vollständig im Browser und ist als Progressive Web App (PWA) auch offline nutzbar. Das System unterstützt mehrere Niederlassungen mit vollständig getrennten Beständen, Einstellungen und Benutzern.

### Kernfunktionen auf einen Blick

| Bereich | Beschreibung |
|---|---|
| Artikelverwaltung | Anlegen, Bearbeiten, Importieren von Ersatzteilen |
| Bestandsführung | Buchungen pro Fahrzeug oder Lagerort, mit Scanner-Integration |
| Inventur | Körperliche Bestandsaufnahme, mehrere Prüfer gleichzeitig |
| Bestellwesen | Automatische Bedarfsermittlung, Bestellungen, Wareneingang |
| Bewegungshistorie | Vollständige Buchungshistorie mit Filterung und Pagination |
| Offline-Betrieb | Buchungen ohne Internetverbindung möglich |
| Niederlassungen | Mehrere Standorte mit vollständig getrennten Daten |
| Zugriffsrechte | Rollen- und benutzerbasierte Berechtigungen |
| Exporte | PDF, Excel, CSV für alle Bereiche |
| Personalisierung | Dashboard, Header-Buttons und Themes pro Benutzer konfigurierbar |

### Benutzerrollen

| Rolle | Beschreibung |
|---|---|
| **Super-Admin** | Niederlassungsübergreifender Vollzugriff, Systemkonfiguration, Protokolle |
| **Manager** | Vollzugriff innerhalb der eigenen Niederlassung |
| **Lagerist** | Bestandsbuchungen, Bestellungen, Inventur im Zentrallager |
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

Administratoren können in der Benutzerverwaltung Passwörter für alle Benutzer ändern. Das neue Passwort muss die Komplexitätsanforderungen erfüllen (siehe 2.1).

---

## 3. Dashboard

Das Dashboard ist die Startseite nach dem Login. Es zeigt auf einen Blick die wichtigsten Informationen der eigenen Niederlassung.

### 3.1 Verfügbare Widgets

| Widget | Beschreibung |
|---|---|
| **KPI-Übersicht** | Kennzahlen: Artikelanzahl, Sollbestandssumme, aktive Inventuren |
| **Nachbestellanfragen / Teileübersicht** | Ausstehende Bestellanfragen und Unterbestände |
| **Letzte Buchungen** | Die zuletzt durchgeführten Lagerbewegungen |

### 3.2 Dashboard anpassen

Klicken Sie oben rechts auf **„Dashboard anpassen"** (Regler-Symbol). Im folgenden Dialog können Sie:

**Widgets ein-/ausblenden:**
- Aktivieren oder deaktivieren Sie einzelne Widgets per Checkbox
- Die Reihenfolge der Widgets entspricht der Darstellung auf der Seite

**Schnellzugriff-Buttons im Header konfigurieren:**
- Fügen Sie eigene Schnellzugriff-Buttons für den Header-Bereich hinzu
- Separate Konfiguration für **PC/Desktop** und **Mobil/Tablet**
- Jeder Button hat eine Bezeichnung, eine Zielseite und eine Farbe
- Buttons erscheinen oben in der App-Leiste und sind per Klick erreichbar

> Alle Dashboard-Einstellungen werden **pro Benutzer** in der Datenbank gespeichert und gelten auf allen Geräten, auf denen Sie sich anmelden.

### 3.3 Offline-Hinweis

Wenn die App keine Verbindung zum Server hat, erscheint oben ein gelber Warnbalken. In diesem Zustand stehen nur gecachte Daten zur Verfügung. Buchungen werden lokal zwischengespeichert und beim nächsten Online-Gang synchronisiert.

---

## 4. Artikelverwaltung

Die Artikelverwaltung ist das Herzstück des Systems. Hier werden alle Ersatzteile und Verbrauchsmaterialien gepflegt. Jede Niederlassung hat ihren eigenen, isolierten Artikelstamm.

### 4.1 Artikelübersicht

Navigieren Sie über das Menü zu **„Artikel"**. Die Übersicht zeigt alle Artikel der eigenen Niederlassung in einer Tabelle.

**Suchen:** Verwenden Sie das Suchfeld um nach Artikelnummer, Bezeichnung oder Hersteller zu suchen.

**Filtern:** Nutzen Sie die Dropdowns für Hersteller und Warengruppe.

**Artikel öffnen:** Klicken Sie auf **eine beliebige Zeile** in der Tabelle, um den Artikel direkt zu bearbeiten. Alternativ nutzen Sie das **Stift-Symbol** am Ende der Zeile.

### 4.2 Artikel anlegen

1. Klicken Sie auf **„Neuer Artikel"**
2. Füllen Sie das Formular aus:

| Feld | Pflicht | Beschreibung |
|---|---|---|
| Artikelnummer | ✅ | Eindeutige Kennung pro Niederlassung |
| Bezeichnung | ✅ | Kurzbeschreibung des Artikels |
| Bezeichnung (2) | – | Zusatzinfo (erscheint in Listen, Bestellungen und Vorschlägen) |
| Hersteller | ✅ | Herstellername |
| Warengruppe | ✅ | Kategorie (z.B. „Filter", „Verschleißteile") |
| Lieferant | – | Zugeordneter Lieferant für Bestellungen |
| Lagerort | – | Fester Lagerplatz im Zentrallager |
| QR-Code | – | Alternativer Scan-Code |
| Preis (EUR) | – | Einkaufspreis |
| Verpackungseinheit | – | Stück pro Packung |
| Bestellmenge | – | Feste Bestellmenge (0 = automatisch aus Soll − Ist) |
| Sollbestand | – | Zielbestand nach Auffüllung |
| Meldebestand | – | Schwellwert: Bestellung wird vorgeschlagen wenn Ist-Bestand ≤ diesem Wert |
| Mindestbestand | – | Sicherheitspuffer / absolute Untergrenze |
| Ist-Bestand | – | Aktueller Bestand (beim Anlegen direkt eintragen) |
| Weitere Codes | – | Alternative Barcodes, getrennt durch Komma oder Leerzeichen |

3. Klicken Sie auf **„Speichern"**

> **Tipp – Schwellwerte verstehen:**
> - **Meldebestand**: Löst eine Bestellanfrage aus (z.B. bei ≤ 10 Stück bestellen)
> - **Mindestbestand**: Absoluter Sicherheitspuffer (z.B. 5 Stück müssen immer da sein)
> - **Sollbestand**: Zielbestand nach Auffüllung (z.B. immer auf 20 Stück auffüllen)

### 4.3 Artikel bearbeiten

Klicken Sie auf eine **Zeile** in der Übersicht oder das **Stift-Symbol**. Der Bearbeitungsdialog öffnet sich mit allen aktuellen Werten.

**Artikelbild:** Sie können ein Bild zum Artikel hochladen (JPG, PNG, WebP). Das Bild erscheint in der Übersichtsliste und im Bearbeitungsdialog.

### 4.4 Manuelle Lagerbuchung im Artikel

Im Bearbeitungsdialog eines Artikels gibt es – sobald dem Artikel ein Lagerort zugewiesen ist – den Bereich **„Manuelle Buchung"**:

- **+1 einbuchen**: Bucht 1 Stück als Zugang auf den Lagerort des Artikels
- **-1 ausbuchen**: Bucht 1 Stück als Abgang vom Lagerort des Artikels

Jede manuelle Buchung wird in der Bewegungshistorie mit dem Vermerk **„Manuelle Buchung"** protokolliert und ist vollständig nachvollziehbar.

> **Wann sinnvoll?** Wenn ein einzelnes Teil manuell korrigiert werden muss, ohne die Schnellbuchung aufzurufen. Zum Beispiel bei Inventurdifferenzen oder Verlusten.

### 4.5 Artikel löschen

Klicken Sie auf das **Papierkorb-Symbol** neben einem Artikel. Eine Bestätigung ist erforderlich. Die Buchungshistorie des Artikels bleibt erhalten.

### 4.6 Hyreka-Import (CSV)

Das System unterstützt den Import von Artikelstammdaten aus der **Hyreka**-Software.

**Vorgehensweise:**
1. Klicken Sie auf **„Hyreka Import"**
2. Wählen Sie die exportierte CSV-Datei aus Hyreka
3. Das System zeigt eine **Vorschau** der zu importierenden Daten
4. Prüfen Sie die Vorschau auf Korrektheit
5. Klicken Sie auf **„Import starten"**

**Importierte Felder:**
- Artikelnummer, Bezeichnung 1 & 2
- Hersteller, Warengruppe
- Sollbestand (`dauerSoll`), Meldebestand (`alarmbes`), Mindestbestand (`mindestbes`)
- Lieferant (wird ggf. neu angelegt)
- Lagerort (wird ggf. neu angelegt)

> **Hinweis:** Der Import ist niederlassungsisoliert. Bestehende Artikel werden aktualisiert, neue angelegt. Gleiche Artikelnummern in verschiedenen Niederlassungen sind möglich.

### 4.7 CSV-Import (allgemein)

1. Laden Sie zunächst das **CSV-Template** herunter
2. Befüllen Sie die Vorlage mit Ihren Daten
3. Importieren Sie die CSV-Datei über die Import-Schaltfläche

### 4.8 Exporte

- **QR-Katalog (PDF):** Erzeugt ein PDF mit QR-Codes aller Artikel (z.B. zur Regalbeschriftung)
- **Stammdaten (CSV):** Exportiert alle Artikeldaten als CSV-Datei für Excel

---

## 5. Lagerorte

Lagerorte beschreiben die physische Struktur Ihres Lagers (Regale, Fächer, Schränke usw.). Lagerorte sind pro Niederlassung getrennt.

### 5.1 Ortstypen

| Typ | Beschreibung |
|---|---|
| **Lager (WAREHOUSE)** | Oberstes Element: das Lager selbst (z.B. „Teilelager", „Tonerlager") |
| **Regal (SHELF)** | Regaleinheit im Lager (z.B. „Regal 1") |
| **Fach (BIN)** | Einzelnes Fach in einem Regal (z.B. „Fach 3") |
| **Fahrzeug (VEHICLE)** | Automatisch für Fahrzeuge angelegt – nicht manuell ändern |

### 5.2 Lagerort anlegen

1. Navigieren Sie zu **„Lagerorte"**
2. Klicken Sie auf **„Neuer Lagerort"**
3. Wählen Sie den **Typ** aus
4. Tragen Sie einen **Code** ein (z.B. „R01-F03" für Regal 1, Fach 3)
5. Optional: **Name** (z.B. „Filter-Regal")
6. Optional: **Übergeordneten Ort** wählen (für die Hierarchie: Fach gehört zu Regal, Regal gehört zu Lager)
7. Klicken Sie auf **„Speichern"**

> **Tipp:** Strukturieren Sie Ihre Lagerorte immer hierarchisch: Lager → Regal → Fach. Das System zeigt dann in Bestellungen und Artikeldetails den vollständigen Pfad an, z.B. „Teilelager / Regal 3 / Fach 4".

### 5.3 Lager-Trennung

Wenn Sie mehrere Lager haben (z.B. Teilelager und Tonerlager), legen Sie für jedes ein eigenes Lager (Typ: WAREHOUSE) an. Artikel, die einem Fach des Tonerlagers zugewiesen sind, erscheinen dann ausschließlich in den Bestellvorschlägen des Tonerlagers – nicht im Teilelager.

### 5.4 Lagerort einem Artikel zuweisen

Lagerorte werden in der Artikelverwaltung einem Artikel zugewiesen. Beim Anlegen oder Bearbeiten eines Artikels wählen Sie den Lagerort aus dem Dropdown. Die Suche funktioniert nach Code, Name oder Pfad.

---

## 6. Fahrzeugverwaltung

Fahrzeuge repräsentieren die Servicefahrzeuge Ihres Fuhrparks. Jedes Fahrzeug hat seinen eigenen Bestand. Fahrzeuge sind pro Niederlassung getrennt.

### 6.1 Fahrzeug anlegen

1. Navigieren Sie zu **„Zugangskontrolle" → Tab „Fahrzeuge"**
2. Klicken Sie auf **„Neues Fahrzeug"**
3. Geben Sie **Kennzeichen** und **Beschreibung** ein
4. Klicken Sie auf **„Speichern"**

Das Fahrzeug erhält automatisch einen eigenen Lagerort (Typ: VEHICLE) für die Bestandsführung.

### 6.2 Bestand klonen

Sie können den kompletten Artikelbestand von einem Fahrzeug auf ein anderes übertragen:

1. Klicken Sie auf **„Bestand klonen"** neben dem Quellfahrzeug
2. Wählen Sie das **Zielfahrzeug**
3. Entscheiden Sie: **Mit Ist-Bestand** (Mengen übernehmen) oder nur Sollwerte übertragen
4. Bestätigen Sie den Vorgang

> **Achtung:** Bereits vorhandene Artikel im Zielfahrzeug werden überschrieben.

---

## 7. Fuhrpark-Übersicht

Die Fuhrpark-Übersicht zeigt den **aktuellen Bestand aller Fahrzeuge** der eigenen Niederlassung auf einen Blick.

**Funktionen:**
- Suche nach Kennzeichen oder Beschreibung
- Filter nach Techniker
- Bestandsübersicht je Fahrzeug (Soll vs. Ist)
- Farbliche Statusanzeige für Unterbestände
- Echtzeit-Aktualisierung: Änderungen durch andere Benutzer erscheinen sofort ohne Seitenneuladen

---

## 8. Mein Fahrzeug (Technikerseite)

Die Seite **„Mein Fahrzeug"** ist die persönliche Ansicht für Techniker. Hier sehen Sie den Bestand Ihres zugewiesenen Fahrzeugs.

### 8.1 Bestandsübersicht

- Alle Artikel mit Soll- und Ist-Bestand
- Farbliche Kennzeichnung bei Unterbestand (rot)
- Suche und Filterung nach Bezeichnung oder Artikelnummer
- QR-Katalog des eigenen Fahrzeugs als PDF herunterladen

### 8.2 Buchungen vornehmen

Direkt aus der „Mein Fahrzeug"-Ansicht können Sie:
- Artikel **einbuchen** (Nachschub erhalten)
- Artikel **ausbuchen** (verbraucht / eingebaut)
- Menge eingeben und bestätigen

### 8.3 Sollbestand anpassen

Als Techniker können Sie (je nach Berechtigung) den **Sollbestand** einzelner Artikel für Ihr Fahrzeug anpassen, um individuelle Bedarfe zu hinterlegen.

---

## 9. Buchungen – Scanner & Schnellbuchung

### 9.1 Scanner

Der Scanner erlaubt das schnelle Buchen über Barcode- oder QR-Code-Scan mit der Gerätekamera.

**Vorgehensweise:**
1. Navigieren Sie zu **„Scanner"**
2. Aktivieren Sie die Kamera über den **„Scanner starten"-Button**
3. Halten Sie den Barcode oder QR-Code vor die Kamera
4. Der Artikel wird automatisch erkannt und angezeigt
5. Wählen Sie die **Buchart**: Einbuchen oder Ausbuchen
6. Passen Sie die **Menge** an (+ / – Buttons oder direkte Eingabe)
7. Klicken Sie auf **„Buchen"**

**Manuell suchen:** Wenn kein Scanner verfügbar ist, können Sie über **„Artikel manuell auswählen"** den Artikel über ein Suchfeld finden.

**Neuen Artikel anlegen:** Wenn ein gescannter Code nicht gefunden wird, erscheint ein Dialog. Sie können dort direkt einen neuen Artikel anlegen und anschließend sofort buchen.

> **Hinweis:** QR-Codes im Format `ARTIKELCODE - BESCHREIBUNG` werden korrekt erkannt – auch wenn der Artikelcode selbst Bindestriche enthält (z.B. `GO-00732000 - HDD`).

### 9.2 Schnellbuchung

Die Schnellbuchung eignet sich für **Massenbuchungen**, z.B. beim Auffüllen mehrerer Artikel gleichzeitig oder bei der Verarbeitung von Lieferscheinen.

#### Buchmodi

- **Ausbuchung:** Verbrauch, Lieferung an Kunden, Entnahme
- **Einbuchung:** Wareneingang, Auffüllung aus dem Lager

#### Workflow-Modus

Es gibt zwei Arbeitsweisen, die Sie in den Einstellungen (Schalter unten auf der Schnellbuchungsseite) wählen können:

| Modus | Erster Fokus | Geeignet für |
|---|---|---|
| **Vorgangsnummer zuerst** | Vorgangsnummer-Feld | Lageristen, die Aufträge oder Lieferscheine abarbeiten |
| **Barcode zuerst** | Barcode/Artikel-Feld | Techniker, die direkt Artikel scannen ohne Auftragsnummer |

> **Wichtig:** Diese Einstellung wird **pro Benutzer** gespeichert und gilt auf allen Geräten. Wechselt ein anderer Benutzer an denselben Computer, hat er seinen eigenen Modus.

#### Vorgehensweise

1. Navigieren Sie zu **„Schnellbuchung"**
2. Wählen Sie den **Buchungsmodus** (Einbuchung / Ausbuchung)
3. Optional: **Vorgangsnummer** eintragen (Auftragsnummer, Lieferscheinnummer etc.)
4. Scannen Sie einen Artikel oder tippen Sie Teile der Bezeichnung oder Artikelnummer ein (Freitextsuche ab 2 Zeichen)
5. Wählen Sie den Artikel aus der Vorschlagsliste
6. Tragen Sie die **Menge** ein und klicken Sie auf **„Hinzufügen"**
7. Wiederholen Sie ab Schritt 4 für alle weiteren Artikel
8. Klicken Sie auf **„Alle buchen"** um alle gesammelten Positionen zu verbuchen

Nach dem Buchen wird die Vorgangsnummer geleert und der Fokus springt automatisch zurück ans Anfang, sodass die nächste Buchung sofort beginnen kann.

### 9.3 Offline-Buchungen

Buchungen können auch **ohne Internetverbindung** vorgenommen werden. Sie werden lokal in einer Warteschlange gespeichert und beim nächsten Online-Gang automatisch übertragen. Die Anzahl der ausstehenden Buchungen wird im Sync-Bereich angezeigt.

---

## 10. Bewegungshistorie

Die Bewegungshistorie zeigt alle Buchungen (Ein- und Ausbuchungen) der eigenen Niederlassung chronologisch.

### 10.1 Ansicht aufrufen

Navigieren Sie zu **„Bewegungen"** im Menü.

### 10.2 Filteroptionen

| Filter | Beschreibung |
|---|---|
| **Fahrzeug** | Nur Buchungen für ein bestimmtes Fahrzeug anzeigen |
| **Buchungsart** | Nur Einbuchungen oder nur Ausbuchungen |
| **Zeitraum** | Von/Bis Datum eingrenzen |
| **Vorgangsnummer / Quelle** | Suche nach der eingetragenen Auftragsnummer oder Herkunft der Buchung |

> Die Suche nach Vorgangsnummer/Quelle läuft serverseitig als Volltextsuche – es genügen Teilbegriffe.

### 10.3 Pagination

Die Ergebnisse werden seitenweise geladen. Sie können wählen, wie viele Einträge pro Seite angezeigt werden (25, 50 oder 100). Blättern Sie mit den Pfeilen unten durch die Seiten. Eine Zusammenfassung (Gesamtanzahl, Einbuchungen, Ausbuchungen) erscheint über der Tabelle.

### 10.4 Buchungsdetails

Jede Zeile zeigt:
- Datum und Uhrzeit
- Artikel (Nummer und Bezeichnung)
- Fahrzeug oder Lagerort
- Buchungsart (Einbuchung / Ausbuchung)
- Menge
- Benutzer, der gebucht hat
- Vorgangsnummer / Quelle (wenn angegeben)
- Notiz (wenn vorhanden)

---

## 11. Inventur

Die Inventur ermöglicht die **körperliche Bestandsaufnahme** aller Fahrzeuge einer Niederlassung.

### 11.1 Inventursitzung starten

1. Navigieren Sie zu **„Inventur"**
2. Klicken Sie auf **„Neue Sitzung"**
3. Vergeben Sie einen **Namen** (z.B. „Jahresinventur April 2026")
4. Optional: **Standort** eintragen
5. Optional: **Benutzer zuweisen** – wählen Sie eine oder mehrere Personen aus, die diese Sitzung bearbeiten sollen. Nur diesen Personen (und dem Manager) wird die Sitzung angezeigt. Ohne Zuweisung sehen alle Benutzer die Sitzung.
6. Klicken Sie auf **„Starten"**

> **Mehrfachzuweisung:** Sie können einer Inventursitzung mehrere Benutzer gleichzeitig zuweisen, z.B. wenn mehrere Techniker gleichzeitig zählen sollen. Jeder zugewiesene Benutzer sieht die Sitzung in seiner Ansicht.

### 11.2 Artikel zählen

1. Wählen Sie das **Fahrzeug** in der Sitzung aus
2. Scannen Sie den Barcode eines Artikels oder wählen Sie ihn manuell
3. Geben Sie die **gezählte Menge** ein
4. Klicken Sie auf **„Eintragen"**
5. Wiederholen Sie für alle Artikel des Fahrzeugs

### 11.3 Inventurprozess

Die Sitzung durchläuft folgende Zustände:

| Status | Bedeutung |
|---|---|
| **Entwurf** | Sitzung angelegt, Zählung noch nicht begonnen |
| **In Bearbeitung** | Zählung läuft |
| **Eingereicht** | Fahrzeug vom Techniker zur Freigabe eingereicht |
| **Abgeschlossen** | Alle Fahrzeuge eingereicht, wartet auf Finalisierung |
| **Finalisiert** | Freigegeben, Bestände übernommen |

### 11.4 Differenzauswertung

Nach der Zählung zeigt das System die **Differenzen** zwischen gezähltem und erwartetem Bestand an. Sie können:
- Differenzen einzeln prüfen
- Sitzung für Nachzählungen wieder öffnen
- Protokoll als **PDF** oder **Excel** exportieren

### 11.5 Sitzung finalisieren

Nach Überprüfung und Freigabe durch einen Manager wird die Sitzung **finalisiert**. Die gezählten Bestände werden als neue Sollwerte übernommen.

> **Techniker:** Sie können Ihre Fahrzeuginventur nach Abschluss als PDF herunterladen. Klicken Sie auf das PDF-Symbol neben Ihrem Fahrzeug in der Sitzungsansicht.

---

## 12. Bestellwesen

Das Bestellwesen umfasst den gesamten Beschaffungsprozess – von der automatischen Bedarfsermittlung bis zum Wareneingang.

### 12.1 Bestellvorschläge

Das System ermittelt automatisch Artikel, die bestellt werden sollten, basierend auf Meldebestand und Sollbestand.

**Ansicht aufrufen:** Navigieren Sie zu **„Bestellungen" → Tab „Vorschläge"**

#### Wie werden Vorschläge berechnet?

Ein Artikel erscheint in den Vorschlägen wenn:
- **Meldebestand gesetzt:** Ist-Bestand ≤ Meldebestand
- **Kein Meldebestand:** Ist-Bestand < Sollbestand

Die **vorgeschlagene Bestellmenge** ergibt sich aus: Sollbestand − Ist-Bestand − bereits bestellte Menge (aus offenen Bestellungen)

#### Filter: Nur Mindestbestand unterschritten

Aktivieren Sie diese Checkbox um nur die **kritischen** Artikel anzuzeigen, deren Ist-Bestand den Mindestbestand (Sicherheitspuffer) unterschritten hat. Diese Artikel haben höchste Priorität.

#### Bestand anderer Niederlassungen

Aktivieren Sie den Schalter **„Bestand anderer Niederlassungen"** um bei jedem Artikel farbige Chips einzublenden. Diese zeigen, ob und wie viel Bestand in anderen Niederlassungen vorhanden ist. So lassen sich unnötige Bestellungen vermeiden, wenn ein Artikel intern umgelagert werden kann.

#### Artikel direkt bearbeiten

Klicken Sie auf eine **Artikelnummer** in der Vorschlagsliste um den Artikel direkt zu bearbeiten (Sollbestand, Melde- oder Mindestbestand anpassen) – ohne die Seite zu verlassen. Nach dem Speichern klicken Sie auf „Aktualisieren" um die aktualisierten Vorschläge zu sehen.

#### Aktualisieren (Cache umgehen)

Der **„Aktualisieren"-Button** lädt die Vorschläge neu und umgeht den serverseitigen Cache. Nutzen Sie ihn nach dem Bearbeiten von Artikeln.

#### Bestellungen aus Vorschlägen erstellen

1. Haken Sie die gewünschten Artikel an (oder „Alle auswählen")
2. Passen Sie die Bestellmenge bei Bedarf manuell an
3. Klicken Sie auf **„Bestellungen erstellen"**
4. Das System gruppiert die Artikel automatisch nach Lieferant und erstellt separate Bestellungen
5. Im folgenden Dialog wählen Sie: **Als Entwurf speichern**, **PDF herunterladen** oder **Per E-Mail versenden**

### 12.2 Aktive Bestellungen

Hier sehen Sie alle offenen Bestellungen mit ihrem aktuellen Status.

#### Bestellstatus

| Status | Bedeutung |
|---|---|
| **Entwurf** | Erstellt, aber noch nicht abgesendet |
| **Bestellt** | An Lieferant übermittelt, Wareneingang steht aus |
| **Archiviert** | Ware vollständig eingegangen und abgeschlossen |

> Vollständig eingegangene Bestellungen werden automatisch archiviert. Das Bestell-PDF bleibt auch nach der Archivierung abrufbar.

#### Aktionen pro Bestellung

- **PDF erzeugen / herunterladen:** Druckbares Bestellformular als PDF
- **Per E-Mail senden:** Öffnet das Mailprogramm mit vorbereitetem Text und lädt das PDF herunter
- **Bearbeiten:** Positionen und Mengen ändern (nur im Status „Entwurf")
- **Löschen:** Bestellung löschen (nur Entwürfe, Bestätigung erforderlich)
- **Wareneingang buchen:** Gelieferte Mengen direkt aus der Bestellübersicht einbuchen

#### Artikel direkt öffnen

Klicken Sie im Wareneingang-Dialog auf einen **Artikelnamen** um den Artikelstamm direkt zu öffnen – ohne die Bestellungsseite zu verlassen. So können Sie z.B. schnell prüfen ob der gelieferte Artikel korrekt ist.

### 12.3 Wareneingang

Im Tab **„Wareneingang"** erfassen Sie eingegangene Lieferungen.

**Vorgehensweise:**
1. Suchen und wählen Sie die zugehörige Bestellung aus der Übersicht
2. Klicken Sie auf das **Eingangs-Symbol** neben der Bestellung
3. Im Dialog: Scannen Sie die gelieferten Artikel über das Barcode-Feld, oder tragen Sie die Mengen manuell ein
4. Überprüfen Sie die vorgeschlagenen Mengen und passen Sie sie bei Bedarf an
5. Tragen Sie optional die **Lieferscheinnummer** ein
6. Klicken Sie auf **„Wareneingang buchen"**

**Artikel-Details aus dem Wareneingang:** Machen Sie einen **Doppelklick** auf eine Artikelzeile im Wareneingang-Dialog um den Artikelstamm zu öffnen.

Das System aktualisiert automatisch den Lagerbestand und den Bestellstatus. Bei **Teillieferungen** bleibt die Bestellung im Status „Bestellt" bis alle Positionen vollständig eingegangen sind. Bei vollständigem Eingang wird die Bestellung automatisch archiviert.

**Scanner-Integration im Wareneingang:** Das Barcode-Feld im Wareneingang-Dialog erkennt gescannte Artikel automatisch und erhöht die eingegangene Menge für die passende Position.

### 12.4 Archivierte Bestellungen

Alle abgeschlossenen Bestellungen finden Sie im Tab **„Archiv"**. Hier können Sie:
- Vergangene Bestellungen einsehen und nach Jahr und Lieferant filtern
- PDFs erneut herunterladen
- Die vollständige Bestellhistorie einsehen

---

## 13. Lieferantenverwaltung

Lieferanten werden im Bestellwesen verwendet und können Artikeln zugeordnet werden. Lieferanten sind pro Niederlassung getrennt.

### 13.1 Lieferant anlegen

1. Navigieren Sie zu **„Lieferanten"**
2. Klicken Sie auf **„Neuer Lieferant"**
3. Füllen Sie das Formular aus:

| Feld | Beschreibung |
|---|---|
| Name | Firmenname (Pflichtfeld) |
| Ansprechpartner | Kontaktperson beim Lieferanten |
| E-Mail | E-Mail-Adresse für Bestellungen |
| Telefon | Telefonnummer |
| Kundennummer | Ihre Kundennummer beim Lieferanten |
| Adresse | Straße, PLZ, Ort, Land |
| Notizen | Interne Notizen (erscheinen nicht in Bestellungen) |

4. Klicken Sie auf **„Speichern"**

**Adresse automatisch vervollständigen:** Das System schlägt beim Tippen Adressen über OpenStreetMap vor.

### 13.2 Lieferant einem Artikel zuweisen

Öffnen Sie einen Artikel zur Bearbeitung und wählen Sie den Lieferanten aus dem Dropdown-Feld „Lieferant". Nur Artikel mit zugewiesenem Lieferanten erscheinen in den Bestellvorschlägen als bestellbar.

---

## 14. Benachrichtigungen

Das System informiert Sie über wichtige Ereignisse per **Benachrichtigungsglocke** in der oberen Leiste.

### 14.1 Benachrichtigungstypen

| Typ | Auslöser |
|---|---|
| **Nachbestellanfrage** | Ein Artikel hat den Meldebestand unterschritten |
| **Wareneingang** | Eine Bestellung wurde vollständig oder teilweise eingegangen |
| **Inventur** | Eine Inventursitzung wurde gestartet oder finalisiert |
| **System** | Systemereignisse (z.B. Update verfügbar) |

### 14.2 Benachrichtigungen verwalten

Klicken Sie auf die **Glocke** oben rechts um die Benachrichtigungsliste zu öffnen. Neue Benachrichtigungen werden mit einem farbigen Punkt markiert. Sie können einzelne Benachrichtigungen als gelesen markieren oder alle auf einmal schließen.

---

## 15. Offline-Modus & Synchronisation

Die App unterstützt vollständigen **Offline-Betrieb**. Buchungen können auch ohne Internetverbindung vorgenommen werden.

### 15.1 Wie funktioniert Offline?

1. Beim ersten Online-Aufruf werden **Artikelstammdaten** und **Fahrzeugbestände** lokal im Browser gespeichert
2. Buchungen werden in einer **lokalen Warteschlange** gespeichert
3. Sobald die Verbindung wiederhergestellt ist, werden die Buchungen automatisch übertragen

Die Offline-Sitzung ist bis zu **30 Tage** gültig – ausreichend für Techniker, die längere Touren ohne Netzanbindung durchführen.

### 15.2 Synchronisationsseite

Navigieren Sie zu **„Sync"** um den Synchronisationsstatus einzusehen und manuell zu synchronisieren.

**Anzeigen:**
- Verbindungsstatus (Online / Offline)
- Anzahl ausstehender Buchungen
- Zeitpunkt der letzten Synchronisation
- Liste der wartenden Buchungen mit Details

**Manuell synchronisieren:**

| Schritt | Aktion |
|---|---|
| 1 | Ausstehende Buchungen übertragen |
| 2 | Artikel-Warteschlange synchronisieren |
| 3 | Artikelstammdaten laden |
| 4 | Offline-Sollwerte synchronisieren |
| 5 | Fahrzeugbestände laden |
| 6 | Fertig |

### 15.3 Offline-Indikatoren

- **Gelber Balken** oben im Dashboard: Keine Serververbindung
- **Chip „Offline"** in der Kopfleiste
- **Buchungs-Counter** zeigt die Anzahl der wartenden Buchungen

> **Wichtig:** Melden Sie sich mindestens einmal online an, bevor Sie offline arbeiten möchten. Nur dann stehen lokale Daten zur Verfügung.

---

## 16. Benutzereinstellungen & Personalisierung

Alle persönlichen Einstellungen werden **pro Benutzer in der Datenbank** gespeichert. Das bedeutet: Egal auf welchem Gerät oder Browser Sie sich anmelden, Ihre Einstellungen sind immer dabei.

### 16.1 Dashboard anpassen

Klicken Sie auf **„Dashboard anpassen"** auf der Dashboard-Seite. Im Dialog können Sie:

- **Widgets** ein- oder ausblenden (KPI-Übersicht, Nachbestellungen, Letzte Buchungen)
- **Schnellzugriff-Buttons** für den Header konfigurieren (getrennt für PC und Mobil)

#### Header-Buttons konfigurieren

Im Tab **„PC / Desktop"** und **„Mobil / Tablet"** des Einstellungsdialogs können Sie jeweils eigene Schnellzugriff-Buttons anlegen:

1. Klicken Sie auf **„Hinzufügen"**
2. Vergeben Sie eine **Bezeichnung** (z.B. „Schnellbuchung")
3. Wählen Sie die **Zielseite** aus der Liste
4. Wählen Sie eine **Farbe**
5. Klicken Sie auf **„Speichern"**

Die Buttons erscheinen danach in der Mitte der Kopfleiste. Auf dem Desktop als beschriftete Schaltflächen, auf dem Handy als Icon-Buttons mit Tooltip.

### 16.2 Farbschema & Erscheinungsbild

Klicken Sie auf das **Paletten-Symbol** oben rechts um ein Farbschema (Theme) zu wählen:

| Theme | Beschreibung |
|---|---|
| Standard | Neutrales Design, gut lesbar |
| Ocean | Blaue Akzentfarben |
| Forest | Grüne Akzentfarben |
| Sunset | Warme, rötliche Töne |
| Monochrom | Schwarz-Weiß ohne Farbakzente |

Klicken Sie auf das **Mond/Sonne-Symbol** um zwischen **Hellmodus** und **Dunkelmodus** zu wechseln.

Alle Theme-Einstellungen werden pro Benutzer gespeichert.

### 16.3 Schnellbuchung-Workflow

Auf der Schnellbuchungsseite finden Sie unten einen **Schalter** für den Arbeitsablauf:

- **Vorgangsnummer zuerst:** Beim Öffnen der Seite springt der Fokus automatisch auf das Vorgangsnummer-Feld. Sinnvoll für Lageristen, die Aufträge abarbeiten.
- **Barcode zuerst:** Der Fokus springt direkt auf das Barcode/Artikel-Feld. Sinnvoll für Techniker ohne feste Vorgangsnummern.

Diese Einstellung wird pro Benutzer gespeichert.

---

## 17. Systemeinstellungen

Einstellungen sind in zwei Ebenen unterteilt: **globale Einstellungen** (Super-Admin) und **niederlassungsspezifische Einstellungen** (Manager der jeweiligen Niederlassung). Niederlassungsspezifische Einstellungen überschreiben die globalen Werte.

### 17.1 Firmeneinstellungen

Navigieren Sie zu **„Einstellungen" → „Firmendaten"**.

**Konfigurierbare Felder:**
- Firmenname
- Adresse (Zeile 1, Zeile 2)
- Postleitzahl, Stadt, Land
- Telefon
- E-Mail
- **Logo** (PNG empfohlen, mindestens 512×512 Pixel)

Das Firmenlogo wird im Login-Bildschirm und in generierten PDFs verwendet.

> Manager sehen und bearbeiten nur die Daten ihrer eigenen Niederlassung. Super-Admin bearbeitet die globalen Firmendaten, die als Fallback für alle Niederlassungen dienen.

### 17.2 E-Mail-Einstellungen

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

### 17.3 Lagereinstellungen

Navigieren Sie zu **„Einstellungen" → „Lager"**.

Hier konfigurieren Sie niederlassungsspezifische Lagerparameter wie Standard-Buchungsverhalten und weitere Lagereinstellungen.

### 17.4 Bestell-PDF Vorlage

Navigieren Sie zu **„Einstellungen"** → Template-Bereich.

Gestalten Sie das Layout der generierten Bestellungs-PDFs:
- Firmenlogo und Kopfzeile
- Spalten der Positionstabelle
- Fußzeile mit Zahlungsbedingungen
- Schriftarten und Abstände

### 17.5 E-Mail-Vorlage für Bestellungen

Konfigurieren Sie den Text der Bestell-E-Mails:
- Betreff-Template mit Variablen (`{{orderNumber}}`, `{{supplierName}}` etc.)
- E-Mail-Text mit Platzhaltern für automatischen Positionsblock

### 17.6 QR-Wagenkatalog Vorlage

Gestalten Sie die PDF-Vorlage für den Fahrzeug-Artikelkatalog:
- Kopfzeile mit Fahrzeugdaten
- QR-Code-Größe und -Position
- Artikeltabelle mit Bestandsdaten

### 17.7 Datensicherung (Backup)

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

## 18. Benutzerverwaltung & Zugriffsrechte

### 18.1 Benutzer verwalten

Navigieren Sie zu **„Zugangskontrolle"** → Tab **„Benutzer"**.

#### Benutzer anlegen

1. Klicken Sie auf **„Neuer Benutzer"**
2. Füllen Sie das Formular aus:

| Feld | Beschreibung |
|---|---|
| Benutzername | Einzigartiger Login-Name |
| Anzeigename | Name, der im System angezeigt wird |
| E-Mail | E-Mail-Adresse |
| Passwort | Anfangspasswort (min. 8 Zeichen, Großbuchstabe + Zahl + Sonderzeichen) |
| Rolle | System-Rolle zuweisen (Manager, Lagerist, Techniker etc.) |
| Niederlassung | Niederlassungszuweisung (Super-Admin kann beliebige Niederlassung wählen) |
| Fahrzeug | Fahrzeugzuweisung (für Techniker – bestimmt welches Fahrzeug unter „Mein Fahrzeug" erscheint) |
| Lagerorte | Lagerzuweisung (für Lageristen – bestimmt welche Lager der Benutzer verwaltet) |

> **Lagerorte für Lageristen:** Weisen Sie einem Lageristen die Lager zu, für die er zuständig ist (z.B. nur „Teilelager"). Dann sieht er unter „Offene Anforderungen" nur die Teile, die in seinen zugewiesenen Lagern aufbewahrt werden – nicht die anderer Lager.

#### Benutzer bearbeiten

Klicken Sie auf das Stift-Symbol um Benutzerdaten zu ändern. Sie können Passwort, Rolle, Niederlassungszuweisung, Fahrzeugzuweisung und Lagerorte bearbeiten.

> Manager sehen und verwalten nur Benutzer ihrer eigenen Niederlassung. Super-Admin sieht alle Benutzer aller Niederlassungen.

### 18.2 Rollen verwalten

Im Tab **„Rollen verwalten"** erstellen und bearbeiten Sie Rollen.

**Standardrollen:**
- **MANAGER** – Vollzugriff innerhalb der Niederlassung
- **WAREHOUSE** – Lagerist: Buchungen, Bestellungen, Inventur
- **TECHNICIAN** – Techniker: Buchungen am eigenen Fahrzeug

Sie können eigene Rollen mit individuell zusammengestellten Rechten anlegen.

### 18.3 Rollenrechte-Matrix

Im Tab **„Rollenrechte"** sehen Sie alle Rollen mit ihren Berechtigungen in einer übersichtlichen Matrix. Berechtigungen können direkt in der Matrix per Klick ein- und ausgeschaltet werden.

Jede Berechtigung folgt dem Schema `bereich.aktion`, z.B.:
- `items.view` – Artikel ansehen
- `items.edit` – Artikel bearbeiten
- `orders.create` – Bestellungen erstellen
- `inventory.manage` – Inventur verwalten

### 18.4 Benutzer-Overrides

Im Tab **„Benutzer-Overrides"** können Sie einzelnen Benutzern abweichende Berechtigungen geben:
- Berechtigung **hinzufügen** (grün markiert – über die Rolle hinaus)
- Berechtigung **entziehen** (rot markiert – trotz Rolle nicht erlaubt)

Dies ermöglicht es z.B. einem Manager gezielt einzelne Rechte zu entziehen, ohne eine komplett neue Rolle anlegen zu müssen.

---

## 19. Niederlassungen

> **Zugriff:** Verwaltung nur für Super-Admin.

Das System unterstützt mehrere Niederlassungen (Standorte). Jede Niederlassung hat vollständig isolierte Daten:
- Eigener Artikelstamm
- Eigene Fahrzeuge und Bestände
- Eigene Lieferanten und Lagerorte
- Eigene Benutzer und Rollen
- Eigene Firmeneinstellungen und E-Mail-Konfiguration

### 19.1 Niederlassung anlegen

1. Navigieren Sie zu **„Niederlassungen"** (nur Super-Admin)
2. Klicken Sie auf **„Neue Niederlassung"**
3. Geben Sie **Name** und **Kürzel** ein
4. Speichern Sie

### 19.2 Benutzer einer Niederlassung zuweisen

Super-Admin kann in der Benutzerverwaltung bei jedem Benutzer die **Niederlassung** auswählen. Manager können nur innerhalb ihrer eigenen Niederlassung agieren.

### 19.3 Super-Admin

Der Super-Admin hat **keine Niederlassung** und damit niederlassungsübergreifenden Vollzugriff. Er sieht alle Daten aller Niederlassungen und ist für die globale Systemkonfiguration zuständig.

---

## 20. Administration & Wartung

> **Zugriff:** Nur für Super-Admin.

### 20.1 Systemprotokolle (Logs)

Navigieren Sie zu **„Logs"** im Admin-Bereich. Das System protokolliert alle wichtigen Ereignisse.

#### Filteroptionen

| Filter | Optionen |
|---|---|
| Zeitraum | Von / Bis Datum |
| Level | Info, Warnung, Fehler, Sicherheit |
| Kategorie | Auth, Bestand, Inventur, System, API |
| Benutzer | Filter auf einzelnen Benutzer |
| Anzahl | 1 – 10.000 Einträge |

#### Log-Statistiken (oben in der Ansicht)
- Gesamtanzahl der Logs (letzte 30 Tage)
- Anzahl Fehler, Warnungen, Sicherheitsereignisse

#### Log-Verwaltung
- **CSV exportieren:** Alle angezeigten Logs als CSV
- **JSON exportieren:** Alle Logs im JSON-Format
- **Logs bereinigen:** Alte Logs nach konfigurierbarer Aufbewahrungszeit löschen
- **Alle löschen:** Komplette Log-Datenbank leeren (Bestätigung erforderlich)

### 20.2 Archivverwaltung

Navigieren Sie zu **„Archiv"** um archivierte Dokumente (z.B. Bestell-PDFs) zu verwalten.

**Funktionen:**
- Übersicht aller archivierten Dokumente nach Kategorie
- Einzelne Dokumente herunterladen
- Mehrere Dokumente als ZIP herunterladen
- Aufbewahrungsrichtlinie konfigurieren

### 20.3 Datenbankwartung

Navigieren Sie zu **„Wartung & Update"**.

Das Wartungswerkzeug prüft die Datenbank auf Inkonsistenzen:
- Verwaiste Datensätze
- Ungültige Referenzen
- Fehlende Pflichtfelder

**Probleme automatisch beheben:**
1. Klicken Sie auf **„Datenbank prüfen"**
2. Sehen Sie sich die gefundenen Probleme an
3. Klicken Sie auf **„Automatisch beheben"** für lösbare Probleme
4. Bestätigen Sie die Aktion

### 20.4 Software-Update

Navigieren Sie zu **„Wartung & Update"** → Bereich **„Update"**.

Hier sehen Sie die aktuell installierte Version. Wenn eine neue Version verfügbar ist, erscheint ein **„Update verfügbar"-Chip** in der Kopfleiste (nur für Manager/Admin sichtbar). Klicken Sie darauf um zur Update-Seite zu navigieren.

---

## 21. Anhang: Berechtigungsübersicht

| Berechtigung | Beschreibung |
|---|---|
| `dashboard.view` | Dashboard ansehen |
| `items.view` | Artikel ansehen |
| `items.create` | Artikel anlegen |
| `items.edit` | Artikel bearbeiten |
| `items.delete` | Artikel löschen |
| `stock.view` | Bestand ansehen |
| `stock.manage` | Bestand buchen und verwalten |
| `movements.view` | Bewegungshistorie ansehen |
| `inventory.count` | Inventurzählung durchführen |
| `inventory.execute` | Inventursitzung bearbeiten (Techniker-Inventur) |
| `inventory.manage` | Inventur verwalten, starten und finalisieren |
| `inventory.view` | Inventursitzungen ansehen |
| `vehicles.view` | Fahrzeuge ansehen |
| `vehicles.create` | Fahrzeuge anlegen |
| `vehicles.edit` | Fahrzeuge bearbeiten |
| `vehicles.delete` | Fahrzeuge löschen |
| `fleet.view` | Fuhrpark-Übersicht ansehen |
| `myvehicle.view` | Eigenes Fahrzeug ansehen und buchen |
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
| `orders.receive` | Wareneingang buchen |
| `scanner.use` | Scanner nutzen |
| `quick-booking.use` | Schnellbuchung nutzen |
| `sync.use` | Synchronisationsseite nutzen |
| `users.view` | Benutzer ansehen |
| `users.create` | Benutzer anlegen |
| `users.edit` | Benutzer bearbeiten |
| `users.delete` | Benutzer löschen |
| `access.manage` | Rollen und Rechte verwalten |
| `settings.company` | Firmeneinstellungen bearbeiten |
| `settings.email` | E-Mail-Einstellungen bearbeiten |
| `settings.warehouse` | Lagereinstellungen bearbeiten |
| `logs.view` | Systemprotokolle ansehen (nur Super-Admin) |
| `logs.manage` | Systemprotokolle verwalten und löschen (nur Super-Admin) |
| `backup.access` | Datensicherung erstellen und wiederherstellen (nur Super-Admin) |

---

## 22. Häufige Fragen (FAQ)

**F: Ich sehe einen Artikel nicht in der Bestellvorschlagsliste, obwohl der Bestand niedrig ist.**
A: Prüfen Sie ob der Artikel einen **Sollbestand > 0** hat. Nur Artikel mit Sollbestand werden berücksichtigt. Außerdem muss ein Lieferant zugewiesen sein (ohne Lieferant erscheint der Artikel als „nicht bestellbar").

**F: Die Bestellvorschläge aktualisieren sich nach einer Artikeländerung nicht sofort.**
A: Klicken Sie auf **„Aktualisieren"** im Tab Bestellvorschläge. Der Button umgeht den Server-Cache und lädt aktuelle Daten.

**F: Ein Artikel erscheint in den Bestellvorschlägen, obwohl genug Bestand vorhanden ist.**
A: Prüfen Sie den **Meldebestand** des Artikels. Wenn Ist-Bestand ≤ Meldebestand, wird eine Bestellung vorgeschlagen – auch wenn der Sollbestand noch nicht erreicht ist.

**F: Ein Tonerartikel erscheint in den Bestellvorschlägen des Teileelagers.**
A: Der Artikel ist vermutlich einem Lagerort zugewiesen, der unter dem falschen Lager (WAREHOUSE) angelegt ist. Prüfen Sie in der Lagerortverwaltung ob das Tonerlager ein eigenes WAREHOUSE-Element ist und der Artikel einem Fach darunter zugewiesen ist.

**F: Meine Offline-Buchungen werden nicht synchronisiert.**
A: Gehen Sie auf die **Sync-Seite** und klicken Sie auf „Jetzt synchronisieren". Prüfen Sie ob Sie online sind und ob Sie angemeldet sind.

**F: Ich kann keinen neuen Benutzer anlegen.**
A: Sie benötigen die Berechtigung `users.create`. Wenden Sie sich an Ihren Administrator.

**F: Ich sehe unter „Offene Anforderungen" Artikel, die nicht zu meinem Lager gehören.**
A: In der Benutzerverwaltung müssen Ihrem Benutzer die richtigen **Lagerorte** (Ihr Lager) zugewiesen sein. Ist kein Lager zugewiesen, sehen Sie alle Anforderungen der Niederlassung.

**F: Wie ändere ich mein Passwort?**
A: Passwörter können von Administratoren in der Benutzerverwaltung geändert werden. Das neue Passwort muss mindestens 8 Zeichen sowie einen Großbuchstaben, eine Zahl und ein Sonderzeichen enthalten.

**F: Ich sehe die Systemprotokolle nicht.**
A: Die Systemprotokolle sind ausschließlich für den **Super-Admin** zugänglich.

**F: Ein Techniker kann sich nach mehreren Fehlversuchen nicht mehr anmelden.**
A: Nach 10 aufeinanderfolgenden falschen Passwörtern wird das Konto automatisch für **15 Minuten** gesperrt. Ein Administrator kann das Passwort in der Benutzerverwaltung zurücksetzen.

**F: Ich habe versehentlich eine falsche Menge eingebucht – wie korrigiere ich das?**
A: Öffnen Sie den betroffenen Artikel und nutzen Sie im Bearbeitungsdialog den Bereich **„Manuelle Buchung"** um die Differenz zu korrigieren (+1 oder -1). Alternativ können Sie über die Schnellbuchung eine Gegenbuchung vornehmen. Jede Korrektur erscheint in der Bewegungshistorie.

**F: Bestellungs-PDFs werden nicht auf dem Server gespeichert.**
A: Ursache sind fehlende Schreibrechte auf dem gemounteten Ordner. Behebung auf der NAS per SSH:
```bash
mkdir -p /volume1/docker/Lagerverwaltung/purchase-orders
chown 1001:1001 /volume1/docker/Lagerverwaltung/purchase-orders
```
Danach ein PDF herunterladen – in den Backend-Logs erscheint dann `[PurchasingService] PDF gespeichert`.

**F: Die App zeigt „Offline" obwohl das Netzwerk funktioniert.**
A: Prüfen Sie ob der Backend-Container läuft (`sudo docker logs lagerverwaltung-backend-1 --tail 20`). Häufige Ursache nach Updates: eine Pflicht-Umgebungsvariable fehlt in der `.env`. Alle Pflichtfelder sind in `.env.example` dokumentiert.

**F: Meine Theme-Einstellung (Farbe / Dunkelmodus) geht nach dem Ausloggen verloren.**
A: Theme-Einstellungen werden nach dem Login aus der Datenbank geladen. Kurz nach dem Login werden die gespeicherten Einstellungen angewendet. Stellen Sie sicher, dass Sie nach der Änderung kurz warten, bis die Einstellung gespeichert ist (kein explizites Speichern notwendig – geschieht automatisch).

---

*Lagerverwaltung – Benutzerhandbuch v3.5.1*
