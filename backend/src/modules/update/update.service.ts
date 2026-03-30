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
    // Backslash am Ende des Pfads entfernen für das Volume-Argument
    const workspaceDir = composeFile.replace(/\/[^/]+$/, "");
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

    // Sicherheits-Timeout: nach 5 Minuten Status zurücksetzen falls Update hängt
    setTimeout(() => {
      if (this.cachedStatus.updateRunning) {
        this.logger.warn("Update-Timeout: Status wird zurückgesetzt");
        this.cachedStatus = {
          ...this.cachedStatus,
          updateRunning: false,
          updatePhase: "error",
          error: "Update-Timeout: Kein Abschluss nach 5 Minuten",
        };
      }
    }, 5 * 60 * 1000);

    // Phase 1: Pull – mit Live-Ausgabe
    setTimeout(() => {
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

      pullChild.on("close", (code) => {
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

        // Phase 2: Helper-Container starten der UNABHÄNGIG docker-compose up -d ausführt.
        // Wenn unser Backend-Container sich selbst neustartet, stirbt unser Prozess –
        // der Helper läuft in einem eigenen Container weiter und startet alle Container.
        this.addLog("Images bereit. Starte Helper-Container für Neustart…");
        this.cachedStatus = { ...this.cachedStatus, updatePhase: "restarting" };

        const helperCmd = [
          "docker run --rm -d",
          "-v /var/run/docker.sock:/var/run/docker.sock",
          `-v ${workspaceDir}:/workspace:ro`,
          "--name lager-update-helper",
          backendImage,
          `sh -c "sleep 8 && docker-compose -p ${projectName} -f /workspace/docker-compose.main.yml up -d 2>&1"`,
        ].join(" ");

        const helperChild = spawn("sh", ["-c", helperCmd], { stdio: "ignore" });
        helperChild.on("close", (helperCode) => {
          if (helperCode === 0) {
            this.addLog("Helper-Container läuft. Container werden in ~8 Sekunden neu gestartet…");
          } else {
            // Fallback: direkt up -d versuchen
            this.addLog("Helper konnte nicht gestartet werden – versuche direkten Neustart…");
            const upCmd = `docker-compose -p ${projectName} -f ${composeFile} up -d 2>&1`;
            const upChild = spawn("sh", ["-c", upCmd], { detached: true, stdio: "ignore" });
            upChild.unref();
          }
        });
      });
    }, 500);

    return {
      message: "Update wird eingespielt. Die Container werden in Kürze neu gestartet.",
    };
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
