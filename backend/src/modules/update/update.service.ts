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

    const projectName = process.env.COMPOSE_PROJECT_NAME || "lagerverwaltung";
    const backendImage =
      process.env.BACKEND_IMAGE ||
      "ghcr.io/sirbuschi2003/lagerverwaltung-backend:latest";

    this.cachedStatus = {
      ...this.cachedStatus,
      updateRunning: true,
      updatePhase: "starting",
      updateStartedAt: new Date(),
      updateLog: ["Update gestartet…"],
      error: null,
    };

    // Sicherheits-Timeout nach 10 Minuten
    setTimeout(() => {
      if (this.cachedStatus.updateRunning) {
        this.logger.warn("Update-Timeout: Status wird zurückgesetzt");
        this.cachedStatus = {
          ...this.cachedStatus,
          updateRunning: false,
          updatePhase: "error",
          error: "Update-Timeout nach 10 Minuten – bitte manuell prüfen.",
        };
      }
    }, 10 * 60 * 1000);

    setImmediate(() => this.runUpdate(projectName, backendImage));

    return { message: "Update wird eingespielt. Die Container werden in Kürze neu gestartet." };
  }

  private async runUpdate(projectName: string, backendImage: string): Promise<void> {
    // ── Phase 1: Host-Pfad ermitteln ────────────────────────────
    this.addLog("Ermittle Host-Projektpfad…");
    const hostProjectPath = process.env.HOST_PROJECT_PATH || await this.getHostProjectPath();

    if (!hostProjectPath) {
      this.addLog("FEHLER: Host-Projektpfad nicht ermittelbar.");
      this.addLog("Lösung: HOST_PROJECT_PATH=/pfad/zum/projekt in .env eintragen.");
      this.cachedStatus = {
        ...this.cachedStatus,
        updateRunning: false,
        updatePhase: "error",
        error: "HOST_PROJECT_PATH nicht ermittelbar. Bitte in .env setzen.",
      };
      return;
    }
    this.addLog(`Host-Pfad: ${hostProjectPath}`);

    // ── Phase 2: Images pullen ───────────────────────────────────
    this.cachedStatus = { ...this.cachedStatus, updatePhase: "pulling" };
    this.addLog("Neue Images werden von GHCR heruntergeladen…");

    const pullOk = await this.runCompose(
      hostProjectPath, projectName,
      ["pull"],
      (line) => this.addLog(line),
    );

    if (!pullOk) {
      this.cachedStatus = {
        ...this.cachedStatus,
        updateRunning: false,
        updatePhase: "error",
        error: "Image-Pull fehlgeschlagen. Bitte Logs prüfen.",
      };
      return;
    }
    this.addLog("Images bereit.");

    // ── Phase 3: Container neu starten ──────────────────────────
    this.cachedStatus = { ...this.cachedStatus, updatePhase: "restarting" };
    this.addLog("Starte Helper-Container für Neustart…");

    // Alten Helper-Container entfernen (verhindert Namenskonflikt)
    await this.execShell("docker rm -f lager-update-helper 2>/dev/null || true");

    // Helper-Container startet das eigentliche Compose-Up NACHDEM unser Prozess beendet ist.
    // Volume wird am GLEICHEN Pfad wie auf dem Host gemountet → relative Pfade im
    // Compose-File (./deploy/caddy/...) lösen sich korrekt zum Host-Pfad auf.
    const helperCmd = [
      "docker run --rm -d",
      "-v /var/run/docker.sock:/var/run/docker.sock",
      `-v ${hostProjectPath}:${hostProjectPath}:ro`,
      `-e COMPOSE_PROJECT_NAME=${projectName}`,
      "--name lager-update-helper",
      backendImage,
      `sh /app/update.sh ${hostProjectPath}`,
    ].join(" ");

    const { code: helperCode, stderr: helperErr } = await this.execShell(helperCmd);

    if (helperCode === 0) {
      this.addLog("Helper-Container gestartet. Container werden neu gestartet…");
    } else {
      this.addLog(`Helper-Start fehlgeschlagen (Code ${helperCode}): ${helperErr.trim()}`);
      this.addLog("Fallback: Direkter detached Neustart…");
      // Letzter Ausweg: detached spawnen
      const fallback = spawn("sh", ["-c",
        `sh /app/update.sh ${hostProjectPath}`,
      ], { detached: true, stdio: "ignore" });
      fallback.unref();
    }
  }

  /**
   * Führt einen Docker-Compose-Befehl aus. Erkennt automatisch ob
   * 'docker compose' (v2) oder 'docker-compose' (v1) verfügbar ist.
   */
  private runCompose(
    projectPath: string,
    projectName: string,
    args: string[],
    onLog?: (line: string) => void,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Prüfe welche Compose-Variante verfügbar ist
      const detectCmd = `
        if docker compose version >/dev/null 2>&1; then
          DC="docker compose"
        elif docker-compose --version >/dev/null 2>&1; then
          DC="docker-compose"
        else
          echo "KEIN_COMPOSE" && exit 1
        fi
        $DC -p "${projectName}" -f "${projectPath}/docker-compose.main.yml" --project-directory "${projectPath}" ${args.join(" ")} 2>&1
      `;

      const child = spawn("sh", ["-c", detectCmd], { stdio: ["ignore", "pipe", "pipe"] });

      child.stdout?.on("data", (d: Buffer) => {
        d.toString().split("\n").filter((l) => l.trim()).forEach((l) => onLog?.(l));
      });
      child.stderr?.on("data", (d: Buffer) => {
        d.toString().split("\n").filter((l) => l.trim()).forEach((l) => onLog?.(l));
      });

      child.on("close", (code) => {
        this.logger.log(`Compose ${args.join(" ")} exit=${code}`);
        resolve(code === 0);
      });
      child.on("error", (err) => {
        onLog?.(`Prozess-Fehler: ${err.message}`);
        resolve(false);
      });
    });
  }

  /** Führt einen Shell-Befehl aus und gibt Exit-Code + stderr zurück. */
  private execShell(cmd: string): Promise<{ code: number; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn("sh", ["-c", cmd], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
      child.on("error", (err) => resolve({ code: 1, stderr: err.message }));
    });
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
