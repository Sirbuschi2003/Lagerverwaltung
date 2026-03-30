# 🚀 KFZ Teilelager - Ein-Klick-Deployment

## Schnellstart (nur 1 Befehl!)

```bash
sudo ./start.sh
```

**Das war's!** 🎉

Das Script macht automatisch **ALLES**:
- ✅ .env Datei erstellen (falls nicht vorhanden)
- ✅ Container stoppen/bauen/starten  
- ✅ Auf MySQL warten
- ✅ Datenbank-Struktur reparieren
- ✅ Admin-Benutzer erstellen
- ✅ System validieren

## � Zugang

- **URL**: https://kfz-app.rr-hannover.local
- **Admin-Login**: `admin` / `admin123`

## � Bei Problemen

```bash
# Logs anschauen
docker compose logs backend

# Neustart (löst 99% aller Probleme)
sudo ./start.sh
```

## 🎯 Das war's wirklich!

Nur **ein einziges Script** - keine 1000 verschiedenen Befehle mehr. 
Einfach `./start.sh` ausführen und fertig! ✨