import { Injectable, Logger } from "@nestjs/common";
import * as webpush from "web-push";

import { LoggingService } from "../logging/services/logging.service";
import { User } from "../users/entities/user.entity";

interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private vapidPublicKey = "";
  private vapidPrivateKey = "";
  private vapidSubject = "mailto:admin@example.com";
  private readonly initPromise: Promise<void>;

  constructor(private readonly loggingService: LoggingService) {
    this.initPromise = this.initializeVapidKeys();
  }

  private async initializeVapidKeys(): Promise<void> {
    const envPublic = process.env.VAPID_PUBLIC_KEY;
    const envPrivate = process.env.VAPID_PRIVATE_KEY;
    const envSubject = process.env.VAPID_SUBJECT;

    if (envPublic && envPrivate) {
      this.vapidPublicKey = envPublic;
      this.vapidPrivateKey = envPrivate;
      this.vapidSubject = envSubject || this.vapidSubject;
      this.logger.log("VAPID Keys aus Umgebungsvariablen geladen.");
    } else {
      const storedPublic = await this.loggingService.getConfig("push.vapid.public");
      const storedPrivate = await this.loggingService.getConfig("push.vapid.private");
      const storedSubject = await this.loggingService.getConfig("push.vapid.subject");

      if (storedPublic && storedPrivate) {
        this.vapidPublicKey = storedPublic;
        this.vapidPrivateKey = storedPrivate;
        this.vapidSubject = storedSubject || this.vapidSubject;
        this.logger.log("VAPID Keys aus SystemConfig geladen.");
      } else {
        const generated = webpush.generateVAPIDKeys();
        this.vapidPublicKey = generated.publicKey;
        this.vapidPrivateKey = generated.privateKey;
        this.logger.warn(
          "VAPID Keys fehlten. Neue Keys generiert und gespeichert. Bitte fuer Produktion in .env setzen."
        );

        await this.loggingService.setConfig("push.vapid.public", this.vapidPublicKey, "Web Push VAPID Public Key");
        await this.loggingService.setConfig("push.vapid.private", this.vapidPrivateKey, "Web Push VAPID Private Key", true);
        await this.loggingService.setConfig("push.vapid.subject", this.vapidSubject, "Web Push VAPID Subject");
      }
    }

    webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
  }

  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  async getPublicKey(): Promise<string> {
    await this.ensureInitialized();
    return this.vapidPublicKey;
  }

  private configKey(userId: string): string {
    return `push.subscription.${userId}`;
  }

  private parseSubscriptions(raw: string | null): StoredSubscription[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry) => entry?.endpoint && entry?.keys?.p256dh && entry?.keys?.auth);
      }
    } catch (error) {
      this.logger.warn("Push-Subscription JSON konnte nicht geparst werden:", error as any);
    }
    return [];
  }

  async getSubscriptions(userId: string): Promise<StoredSubscription[]> {
    await this.ensureInitialized();
    const raw = await this.loggingService.getConfig(this.configKey(userId));
    return this.parseSubscriptions(raw);
  }

  async saveSubscription(userId: string, subscription: any): Promise<void> {
    await this.ensureInitialized();
    const key = this.configKey(userId);
    const current = await this.getSubscriptions(userId);

    // Duplikate nach Endpoint entfernen und neu hinzufügen
    const filtered = current.filter((s) => s.endpoint !== subscription.endpoint);
    filtered.push({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date().toISOString(),
    });

    await this.loggingService.setConfig(
      key,
      JSON.stringify(filtered),
      "Push Subscription des Nutzers"
    );
  }

  async sendRestockApproved(users: User[], payload: { itemCode: string; itemDescription: string; quantity: number; quantityNeeded?: number; vehicle: string; note?: string | null; url?: string; partial?: boolean }): Promise<void> {
    await this.ensureInitialized();
    const isPartial = payload.partial || (payload.quantityNeeded !== undefined && payload.quantity < (payload.quantityNeeded || payload.quantity));
    const title = isPartial ? "Artikel teilweise bereitgestellt" : "Artikel bereitgestellt";
    const progress = payload.quantityNeeded
      ? `Bereitgestellt: ${payload.quantity}/${payload.quantityNeeded}${isPartial ? " (Teilmenge)" : " (Komplett)"}`
      : undefined;

    const bodyLines = [
      `${payload.quantity}x ${payload.itemDescription} (${payload.itemCode}) fuer ${payload.vehicle}`,
    ];
    // Wenn ein Hinweis bereits in note steckt (z.B. "Bereitgestellt: ..."), dann keinen Progress doppelt anhängen
    if (payload.note) {
      bodyLines.push(payload.note);
    } else if (progress) {
      bodyLines.push(progress);
    }

    const notification = {
      title,
      body: bodyLines.join("\n"),
      url: payload.url,
      tag: "restock-ready",
      renotify: true,
    };

    let totalTargets = 0;
    let totalSent = 0;
    let totalFailed = 0;

    for (const user of users) {
      const subs = await this.getSubscriptions(user.id);
      if (subs.length === 0) continue;
      totalTargets += subs.length;

      const stillValid: StoredSubscription[] = [];
      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub as any, JSON.stringify(notification));
          stillValid.push(sub);
          totalSent++;
        } catch (error: any) {
          const status = error?.statusCode;
          if (status === 404 || status === 410) {
            this.logger.warn(`Push-Subscription ungueltig und wird entfernt (User ${user.id})`);
            continue;
          }
          this.logger.error(`Push-Senden fehlgeschlagen (User ${user.id}): ${error?.message || error}`);
          totalFailed++;
          stillValid.push(sub); // nur entfernten, wenn wirklich ungültig
        }
      }

      // Speichere bereinigte Liste
      await this.loggingService.setConfig(
        this.configKey(user.id),
        JSON.stringify(stillValid),
        "Push Subscription des Nutzers"
      );
    }

    this.logger.log(`Push Restock: targets=${totalTargets}, sent=${totalSent}, failed=${totalFailed}`);
  }
}
