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
    jwtSecret: process.env.JWT_SECRET ?? "change-me",
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
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!",
    adminDisplayName: process.env.DEFAULT_ADMIN_DISPLAY_NAME ?? "System Administrator",
  },
});
