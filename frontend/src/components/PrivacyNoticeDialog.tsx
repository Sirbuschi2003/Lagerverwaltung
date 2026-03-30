import React, { useEffect } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import useAuthStore from "../store/useAuthStore";
import { useUserSettingsStore } from "../store/useUserSettingsStore";

const CURRENT_VERSION = "1.0"; // Erhöhen wenn Datenschutzerklärung wesentlich geändert wird

/**
 * DSGVO Art. 13/14: Informationspflicht gegenüber betroffenen Personen.
 * Wird nach dem Login angezeigt. Akzeptierung wird server-seitig gespeichert
 * und bleibt auch nach Cache-Löschung erhalten.
 */
export const PrivacyNoticeDialog: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const { settings, loaded, loadSettings, acceptPrivacy } = useUserSettingsStore();

  useEffect(() => {
    if (token && !loaded) {
      loadSettings();
    }
  }, [token, loaded, loadSettings]);

  const open = !!token && loaded && settings.privacyAcceptedVersion !== CURRENT_VERSION;

  const handleAccept = async () => {
    await acceptPrivacy(CURRENT_VERSION);
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Datenschutzhinweis
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" gutterBottom>
          Diese Anwendung ist ein internes Werkzeug zur Lagerverwaltung. Im Rahmen des Betriebs
          werden folgende Daten verarbeitet:
        </Typography>

        <List dense>
          <ListItem disableGutters>
            <ListItemText
              primary="Benutzerkonto"
              secondary="Benutzername, E-Mail-Adresse, zugewiesenes Fahrzeug — zur Authentifizierung und Zugriffskontrolle"
            />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText
              primary="Lagerbuchungen"
              secondary="Benutzer-ID, Zeitpunkt, Art der Buchung — zur Nachvollziehbarkeit (GoBD)"
            />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText
              primary="Systemprotokolle (Audit-Trail)"
              secondary="Login-Zeitpunkte, Aktionen, IP-Adresse, Browser-Typ — zur Sicherheit und Fehleranalyse; werden nach 90 Tagen automatisch gelöscht"
            />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText
              primary="Inventurdaten"
              secondary="Zählmengen mit Benutzerzuordnung — dauerhaft für steuerliche Aufbewahrungspflichten (10 Jahre)"
            />
          </ListItem>
        </List>

        <Divider sx={{ my: 1.5 }} />

        <Typography variant="body2" gutterBottom>
          <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung /
          Arbeitsverhältnis) sowie Art. 6 Abs. 1 lit. c DSGVO (gesetzliche Verpflichtung nach
          HGB/GoBD).
        </Typography>
        <Typography variant="body2" gutterBottom>
          <strong>Ihre Rechte:</strong> Sie haben das Recht auf Auskunft (Art. 15), Berichtigung
          (Art. 16) und — soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen —
          Löschung (Art. 17 DSGVO). Wenden Sie sich dazu an Ihren Systemadministrator.
        </Typography>
        <Typography variant="body2">
          <strong>Speicherort:</strong> Alle Daten werden ausschließlich auf unternehmenseigenen
          Servern gespeichert. Es findet keine Weitergabe an Dritte statt.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleAccept} color="primary">
          Verstanden &amp; Weiter
        </Button>
      </DialogActions>
    </Dialog>
  );
};
