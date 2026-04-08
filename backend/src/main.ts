import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NextFunction, Request, Response } from "express";

import { AppModule } from "./app.module";

async function bootstrap() {
  const requestLogger = new Logger("HTTP");
  const app = await NestFactory.create(AppModule);

  // Sicherheits-Header (OWASP-Empfehlungen)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.setGlobalPrefix("api");

  // CORS: nur erlaubte Origins zulassen (nie origin: true in Produktion!)
  // APP_HOST aus .env wird automatisch als erlaubte Origin aufgenommen (http + https)
  const appHost = process.env.APP_HOST ? process.env.APP_HOST.trim() : null;
  const defaultOrigins = ["http://localhost:5173", "http://localhost:3000"];
  if (appHost) {
    defaultOrigins.push(`http://${appHost}`, `https://${appHost}`);
  }
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : defaultOrigins;
  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin Requests (kein Origin-Header) und erlaubte Origins durchlassen
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin '${origin}' nicht erlaubt`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Cookie-Parser für HttpOnly-Refresh-Token
  app.use(cookieParser());

  // Body-Limit global 1 MB – Backup-Endpoints setzen eigene Limits per Middleware
  app.use(bodyParser.json({ limit: "1mb" }));
  app.use(bodyParser.urlencoded({ limit: "1mb", extended: true }));

  // Backup-Endpoints benoetigen groessere Payloads (bis 50 MB)
  app.use("/api/setup/restore", bodyParser.json({ limit: "50mb" }));

  // UTF-8 Content-Type Header fuer alle Responses
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  // Request-Logging mit User-Kontext (ohne Healthcheck-Spam)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith("/api/health")) {
      return next();
    }
    const started = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - started;
      // User-ID aus JWT-Payload extrahieren (nur base64-decode, kein Verify – nur fuer Logging)
      let userId = "-";
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ") && !auth.startsWith("Bearer offline.")) {
        try {
          const parts = auth.substring(7).split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { sub?: string };
            if (payload?.sub) userId = payload.sub.substring(0, 8);
          }
        } catch {
          // Ignorieren – nur fuer Logging
        }
      }
      requestLogger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms [user:${userId}]`,
      );
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
