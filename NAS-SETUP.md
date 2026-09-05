# Neues System einrichten (Portainer / NAS)

Diese Anleitung bringt die Lagerverwaltung auf einem **neuen** System zum Laufen,
ohne Docker-Images lokal bauen zu muessen. Portainer laedt die fertigen Images
direkt von GitHub (werden automatisch bei jedem Push neu gebaut).

## Voraussetzung

Portainer Community Edition ist auf dem NAS installiert und erreichbar.

## Schritt 1: Stack anlegen

Portainer -> **Stacks** -> **Add stack**

| Feld | Wert |
|---|---|
| Name | z.B. `lagerverwaltung` |
| Build method | `Repository` |
| Repository URL | `https://github.com/Sirbuschi2003/Lagerverwaltung` |
| Repository reference | `refs/heads/master` |
| Compose path | `docker-compose.portainer.yml` |
| Automatic updates | GitOps aktivieren, Polling z.B. alle 5 Min (optional) |

## Schritt 2: Environment Variables setzen

Unten im Stack-Formular unter "Environment variables" **genau diese** eintragen
(Namen exakt so schreiben, Tippfehler wie `FONTEND_PORT` verhindern den Start):

```
MYSQL_ROOT_PASSWORD=<langes-zufaelliges-passwort>
MYSQL_DATABASE=lagerverwaltung
MYSQL_USER=lagerverwaltung
MYSQL_PASSWORD=<anderes-langes-zufaelliges-passwort>
BACKEND_JWT_SECRET=<mindestens-32-zufaellige-zeichen>
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=<sicheres-admin-passwort>
INVENTORY_HMAC_SECRET=<noch-ein-zufaelliges-secret>
BACKEND_PORT=3000
FRONTEND_PORT=8080
APP_HOST=<NAS-IP>:<FRONTEND_PORT>
```

**`APP_HOST` ist wichtig** - ohne diese Variable blockt das Backend alle
Anfragen vom Frontend mit einem CORS-Fehler ("Origin ... nicht erlaubt").
Beispiel: laeuft das Frontend unter `http://10.10.10.4:8090`, dann:

```
APP_HOST=10.10.10.4:8090
```

**`COOKIE_SECURE` ist bereits auf `false` voreingestellt** (dieser Stack hat
keine eigene HTTPS-Terminierung). Falls ihr spaeter einen Reverse-Proxy mit
TLS vorschaltet, auf `true` setzen - sonst funktioniert der automatische
Login-Refresh nicht (Nutzer werden nach kurzer Zeit ausgeloggt, Fehler
"Kein Refresh-Token gefunden").

**Passwoerter generieren** (falls kein Passwort-Manager zur Hand ist), z.B. in
PowerShell: `-join ((48..57)+(65..90)+(97..122)|Get-Random -Count 32|%{[char]$_})`

Falls Port `3000` oder `8080` auf dem NAS schon belegt sind: einfach andere
Zahlen eintragen, z.B. `3001` / `8090`.

## Schritt 3: Deploy

**Deploy the stack** klicken. Portainer zieht die drei Container:

- `lagerverwaltung-db` (MySQL) - wird zuerst "healthy"
- `lagerverwaltung-api` (Backend) - wartet auf MySQL, fuehrt Migrationen aus
- `lagerverwaltung-ui` (Frontend) - wartet auf Backend

Nach ca. 1-2 Minuten sind alle drei **grün/healthy**.

## Schritt 4: Aufrufen

Im Browser: `http://<NAS-IP>:<FRONTEND_PORT>` (Standard: Port 8080)

Login mit `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` aus Schritt 2.

---

## Falls etwas nicht startet

**Container `lagerverwaltung-db` wird nicht "healthy"**
-> Logs ansehen (Portainer -> Container -> Logs). Meistens: Environment
Variables fehlen oder sind falsch geschrieben.

**Container `lagerverwaltung-api` haengt in "restarting"**
-> Logs ansehen. Meist Datenbankverbindung. Wenn `ER_HOST_NOT_PRIVILEGED`
oder aehnliche MySQL-Fehler auftauchen, obwohl die Variablen stimmen: Es
existiert vermutlich noch ein **altes** `lagerverwaltung_mysql_data`-Volume
von einem vorherigen, fehlgeschlagenen Versuch (siehe unten: "Kompletter Reset").

## Kompletter Reset (alle Daten löschen, komplett neu anfangen)

Nur wenn wirklich keine Daten erhalten werden müssen (frisches System)!

1. Stack loeschen: **Delete this stack**
2. Portainer -> **Volumes** -> alle drei loeschen:
   - `lagerverwaltung_mysql_data`
   - `lagerverwaltung_backups`
   - `lagerverwaltung_purchase_orders`
3. Portainer -> **Containers** -> falls noch verwaiste `lagerverwaltung-*`
   Container da sind -> loeschen
4. Stack neu anlegen (Schritt 1-3 oben, exakt gleiche Environment Variables)

Da die Volume-Namen jetzt **fest** sind (`lagerverwaltung_mysql_data` etc.,
nicht mehr vom Portainer-Stacknamen abgeleitet), kann es keine Verwechslung
mit einem alten Volume mehr geben - Schritt 2 findet immer garantiert das
richtige.

## Updates erhalten

Bei "Automatic updates" (GitOps) in Schritt 1 aktiviert: Portainer prueft
selbststaendig auf neue Commits und zieht neue Images automatisch.

Manuell: Stack -> **Pull and redeploy**.

**Wichtig:** Ein Redeploy startet die Container neu, loescht aber keine
Daten (die Volumes bleiben unangetastet) - Updates sind daher gefahrlos.
