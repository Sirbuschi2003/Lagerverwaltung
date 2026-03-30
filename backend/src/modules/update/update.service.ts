import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import * as https from "https";

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: Date | null;
  checking: boolean;
  error: string | null;
}

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private readonly GITHUB_REPO = "Sirbuschi2003/Lagerverwaltung";
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 Minuten

  private cachedStatus: UpdateStatus;
  private lastCheckTime = 0;
  private updateRunning = false;

  constructor() {
    const currentVersion = process.env.APP_VERSION || "dev";
    this.cachedStatus = {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      lastChecked: null,
      checking: false,
      error: null,
    };
  }

  async getStatus(forceRefresh = false): Promise<UpdateStatus> {
    const now = Date.now();
    if (!forceRefresh && now - this.lastCheckTime < this.CACHE_TTL) {
      return this.cachedStatus;
    }

    this.cachedStatus = { ...this.cachedStatus, checking: true, error: null };
    try {
      const latestSha = await this.fetchLatestCommitSha();
      const latest7 = latestSha.substring(0, 7);
      const current = this.cachedStatus.currentVersion;
      // "dev" gilt als veraltet – es gibt immer eine neuere Version auf GitHub
      const updateAvailable = current === "dev" || latest7 !== current.substring(0, 7);
      this.cachedStatus = {
        ...this.cachedStatus,
        latestVersion: latest7,
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

  async applyUpdate(): Promise<{ message: string }> {
    if (this.updateRunning) {
      return { message: "Update läuft bereits." };
    }

    const composeFile =
      process.env.COMPOSE_FILE_PATH || "/workspace/docker-compose.main.yml";
    const projectName = process.env.COMPOSE_PROJECT_NAME || "lagerverwaltung";

    this.logger.log(
      `Starte Update: compose-Datei=${composeFile}, Projekt=${projectName}`,
    );

    this.updateRunning = true;

    const script = [
      "sleep 3",
      `docker compose -p ${projectName} -f ${composeFile} pull`,
      `docker compose -p ${projectName} -f ${composeFile} up -d`,
    ].join(" && ");

    const child = spawn("sh", ["-c", script], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    // Flag wird beim Neustart automatisch zurückgesetzt
    setTimeout(() => {
      this.updateRunning = false;
    }, 120_000);

    return {
      message:
        "Update wird eingespielt. Die Container werden neu gestartet – das dauert ca. 30–60 Sekunden.",
    };
  }

  private fetchLatestCommitSha(): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        {
          hostname: "api.github.com",
          path: `/repos/${this.GITHUB_REPO}/commits/master`,
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
              const json = JSON.parse(data);
              if (json.sha) {
                resolve(json.sha as string);
              } else {
                reject(
                  new Error(
                    (json.message as string) || "Keine SHA in GitHub-Antwort",
                  ),
                );
              }
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
