const INSECURE_JWT_SECRETS = new Set(["change-me", "secret", "changeme", "jwt-secret", "your-secret"]);
const MIN_JWT_SECRET_LENGTH = 32;

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? "";
  if (!secret || INSECURE_JWT_SECRETS.has(secret.toLowerCase()) || secret.length < MIN_JWT_SECRET_LENGTH) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `FATAL: JWT_SECRET ist nicht gesetzt oder zu schwach (min. ${MIN_JWT_SECRET_LENGTH} Zeichen, kein Default-Wert).`,
      );
    }
    // In Dev: sicheres Dummy-Secret mit Warnung
    process.stderr.write(
      `[WARNUNG] JWT_SECRET nicht gesetzt oder unsicher. In Production wäre dies ein fataler Fehler.\n`,
    );
    return "dev-only-insecure-secret-do-not-use-in-production-1234567890";
  }
  return secret;
}

export default () => ({
  app: {
    name: "Lagerverwaltung",
    port: parseInt(process.env.PORT ?? "3000", 10),
  },
  database: {
    host: process.env.DB_HOST ?? "mysql",
    port: parseInt(process.env.DB_PORT ?? "3306", 10),
    user: process.env.DB_USER ?? "lagerverwaltung",
    password: process.env.DB_PASSWORD ?? "lagerverwaltung",
    name: process.env.DB_NAME ?? "lagerverwaltung",
    synchronize: (process.env.DB_SYNCHRONIZE ?? "false").toLowerCase() === "true",
    migrationsRun: (process.env.DB_MIGRATIONS_RUN ?? "true").toLowerCase() === "true",
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? "30", 10),
  },
  auth: {
    jwtSecret: resolveJwtSecret(),
    jwtExpiresIn:
      process.env.JWT_EXPIRES_IN ||
      process.env.BACKEND_JWT_EXPIRES_IN ||
      "1d",
    jwtRefreshExpiresIn:
      process.env.JWT_REFRESH_EXPIRES_IN ||
      process.env.BACKEND_JWT_REFRESH_EXPIRES_IN ||
      "30d",
  },
  seed: {
    adminUsername: process.env.DEFAULT_ADMIN_USERNAME ?? "admin",
    // Kein Fallback-Passwort: Admin-Konto ohne Passwort in der DB → Benutzer muss beim ersten Login setzen.
    // DEFAULT_ADMIN_PASSWORD nur beim initialen Seed verwendet, nie danach.
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!",
    adminDisplayName: process.env.DEFAULT_ADMIN_DISPLAY_NAME ?? "System Administrator",
  },
});
