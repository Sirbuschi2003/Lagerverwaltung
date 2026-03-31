import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import * as https from "https";

export type UpdatePhase =
  | "idle"
  | "starting"
  | "pulling"
  | "restarting"
  | "done"
  | "error";

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: Date | null;
  checking: boolean;
  error: string | null;
  updateRunning: boolean;
  updatePhase: UpdatePhase;
  updateStartedAt: Date | null;
  updateLog: string[];
  instanceId: string; // Ändert sich bei jedem Neustart des Backends → Frontend erkennt Neustart
}

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private readonly GITHUB_REPO = "Sirbuschi2003/Lagerverwaltung";
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private cachedStatus: UpdateStatus;
  private lastCheckTime = 0;

  constructor() {
    const currentVersion = process.env.APP_VERSION || "dev";
    const instanceId = Math.random().toString(36).substring(2, 9);
    this.cachedStatus = {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      lastChecked: null,
      checking: false,
      error: null,
      updateRunning: false,
      updatePhase: "idle",
      updateStartedAt: null,
      updateLog: [],
      instanceId,
    };
  }

  async getStatus(forceRefresh = false): Promise<UpdateStatus> {
    const now = Date.now();
    if (!forceRefresh && now - this.lastCheckTime < this.CACHE_TTL) {
      return this.cachedStatus;
    }

    this.cachedStatus = { ...this.cachedStatus, checking: true, error: null };
    try {
      const latestVersion = await this.fetchLatestTag();
      const current = this.cachedStatus.currentVersion;
      const updateAvailable = current === "dev" || latestVersion !== current;
      this.cachedStatus = {
        ...this.cachedStatus,
        latestVersion,
        updateAvailable,
        lastChecked: new Date(),
        checking: false,
        error: null,
      };
      this.lastCheckTime = now;
    } catch (err: any) {
      this.cachedStatus = {
        ...this.cachedStatus,
        checking: false,
        error: err.message || "Unbekannter Fehler beim Update-Check",
      };
    }
    return this.cachedStatus;
  }

  async getChangelog(): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        {
          hostname: "raw.githubusercontent.com",
          path: `/${this.GITHUB_REPO}/master/CHANGELOG.md`,
          headers: { "User-Agent": "Lagerverwaltung-Update-Check/1.0" },
        },
        (res) => {
          if (res.statusCode === 404) {
            resolve("Kein Changelog verfügbar.");
            return;
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        },
      );
      req.on("error", reject);
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error("Changelog-Abruf Timeout"));
      });
    });
  }

  async applyUpdate(): Promise<{ message: string }> {
    if (this.cachedStatus.updateRunning) {
      return { message: "Update läuft bereits." };
    }

    const composeFile =
      process.env.COMPOSE_FILE_PATH || "/workspace/docker-compose.main.yml";
    const projectName = process.env.COMPOSE_PROJECT_NAME || "lagerverwaltung";
    const backendImage =
      process.env.BACKEND_IMAGE ||
      "ghcr.io/sirbuschi2003/lagerverwaltung-backend:latest";

    this.logger.log(`Starte Update: Projekt=${projectName}, Datei=${composeFile}`);

    this.cachedStatus = {
      ...this.cachedStatus,
      updateRunning: true,
      updatePhase: "starting",
      updateStartedAt: new Date(),
      updateLog: ["Update gestartet…"],
      error: null,
    };

    // Sicherheits-Timeout: nach 8 Minuten Status zurücksetzen falls Update hängt
    setTimeout(() => {
      if (this.cachedStatus.updateRunning) {
        this.logger.warn("Update-Timeout: Status wird zurückgesetzt");
        this.cachedStatus = {
          ...this.cachedStatus,
          updateRunning: false,
          updatePhase: "error",
          error: "Update-Timeout: Kein Abschluss nach 8 Minuten",
        };
      }
    }, 8 * 60 * 1000);

    // Phase 1: Pull – mit Live-Ausgabe
    setTimeout(async () => {
      this.addLog("Neue Images werden von GHCR heruntergeladen…");
      this.cachedStatus = { ...this.cachedStatus, updatePhase: "pulling" };

      const pullCmd = `docker-compose -p ${projectName} -f ${composeFile} pull 2>&1`;
      const pullChild = spawn("sh", ["-c", pullCmd], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      pullChild.stdout?.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter((l) => l.trim());
        lines.forEach((line) => this.addLog(line));
      });

      pullChild.on("close", async (code) => {
        if (code !== 0) {
          this.cachedStatus = {
            ...this.cachedStatus,
            updateRunning: false,
            updatePhase: "error",
            error: `docker-compose pull fehlgeschlagen (Exit-Code ${code})`,
          };
          this.addLog(`Fehler: Pull fehlgeschlagen (Code ${code})`);
          return;
        }

        // Phase 2: Host-Pfad des Projektverzeichnisses ermitteln.
        // Sibling-Container (via docker.sock) brauchen HOST-Pfade für Volumes, keine Container-Pfade.
        // Automatische Erkennung über Docker-Labels (com.docker.compose.project.working_dir).
        this.cachedStatus = { ...this.cachedStatus, updatePhase: "restarting" };
        this.addLog("Images bereit. Ermittle Host-Projektpfad…");

        const hostProjectPath = process.env.HOST_PROJECT_PATH || await this.getHostProjectPath();

        if (!hostProjectPath) {
          this.addLog("FEHLER: Host-Projektpfad konnte nicht ermittelt werden.");
          this.addLog("Tipp: HOST_PROJECT_PATH=/volume1/docker/Lagerverwaltung in .env setzen.");
          this.cachedStatus = {
            ...this.cachedStatus,
            updateRunning: false,
            updatePhase: "error",
            error: "Host-Projektpfad nicht ermittelbar. Bitte HOST_PROJECT_PATH in .env setzen.",
          };
          return;
        }

        this.addLog(`Host-Pfad: ${hostProjectPath}`);
        this.addLog("Starte Helper-Container für Neustart…");

        // Alten Helper-Container entfernen falls vorhanden (verhindert Namenskonflikt)
        spawn("sh", ["-c", "docker rm -f lager-update-helper 2>/dev/null || true"], { stdio: "ignore" });

        // Helper-Container startet als Sibling-Container unabhängig vom Backend.
        // Wenn der Backend-Container neu gestartet wird, stirbt unser Prozess –
        // der Helper läuft in einem eigenen Container weiter und führt up -d aus.
        const helperCmd = [
          "docker run --rm -d",
          "-v /var/run/docker.sock:/var/run/docker.sock",
          `-v ${hostProjectPath}:/workspace:ro`,  // HOST-Pfad → korrekt für Sibling-Container
          "--name lager-update-helper",
          backendImage,
          `sh -c "sleep 10 && docker-compose -p ${projectName} -f /workspace/docker-compose.main.yml up -d"`,
        ].join(" ");

        const helperChild = spawn("sh", ["-c", helperCmd], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let helperErr = "";
        helperChild.stderr?.on("data", (d: Buffer) => (helperErr += d.toString()));

        helperChild.on("close", (helperCode) => {
          if (helperCode === 0) {
            this.addLog("Helper-Container läuft. Container werden in ~10 Sekunden neu gestartet…");
          } else {
            this.addLog(`Helper-Start fehlgeschlagen (Code ${helperCode}): ${helperErr.trim()}`);
            this.addLog("Versuche direkten Neustart (detached)…");
            const upChild = spawn(
              "sh",
              ["-c", `docker-compose -p ${projectName} -f ${composeFile} up -d`],
              { detached: true, stdio: "ignore" },
            );
            upChild.unref();
          }
        });
      });
    }, 500);

    return {
      message: "Update wird eingespielt. Die Container werden in Kürze neu gestartet.",
    };
  }

  /**
   * Ermittelt den HOST-Pfad des Projektverzeichnisses automatisch über Docker-Labels.
   * docker-compose setzt com.docker.compose.project.working_dir auf den Host-Pfad.
   * Wird für den Sibling-Container-Volume-Mount benötigt.
   */
  private getHostProjectPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const { hostname } = require("os");
      const containerId = hostname();
      const child = spawn(
        "sh",
        [
          "-c",
          `docker inspect "${containerId}" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'`,
        ],
        { stdio: ["ignore", "pipe", "ignore"] },
      );
      let out = "";
      child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
      child.on("close", () => {
        const path = out.trim();
        if (path) this.logger.log(`Host-Projektpfad auto-erkannt: ${path}`);
        else this.logger.warn("Host-Projektpfad konnte nicht via Docker-Labels ermittelt werden");
        resolve(path || null);
      });
      child.on("error", () => resolve(null));
    });
  }

  private addLog(line: string): void {
    this.cachedStatus = {
      ...this.cachedStatus,
      updateLog: [...this.cachedStatus.updateLog.slice(-29), line],
    };
  }

  /** Neuesten Git-Tag = Versionsnummer */
  private fetchLatestTag(): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        {
          hostname: "api.github.com",
          path: `/repos/${this.GITHUB_REPO}/tags`,
          headers: {
            "User-Agent": "Lagerverwaltung-Update-Check/1.0",
            Accept: "application/vnd.github.v3+json",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const tags = JSON.parse(data) as Array<{ name: string }>;
              if (!Array.isArray(tags) || tags.length === 0) {
                reject(new Error("Keine Tags im Repository gefunden"));
                return;
              }
              resolve(tags[0].name.replace(/^v/, ""));
            } catch {
              reject(new Error("Ungültige GitHub-Antwort"));
            }
          });
        },
      );
      req.on("error", reject);
      req.setTimeout(10_000, () => {
        req.destroy();
        reject(new Error("GitHub API Timeout"));
      });
    });
  }
}
