// Global type augmentation for Express.Request.user.
// Without this, `req.user` resolves to `any` everywhere it is accessed
// (28 files), which cascades into hundreds of @typescript-eslint
// no-unsafe-* errors across every controller that reads req.user.role,
// req.user.branchId etc. This declares the actual shape returned by
// JwtStrategy.validate() (see modules/auth/strategies/jwt.strategy.ts).
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      displayName: string;
      email: string | null;
      role: string;
      vehicleId: string | null;
      branchId: string | null;
      refreshInterval: number | null;
      settings: object | null;
      failedLoginAttempts: number;
      lockedUntil: Date | null;
      mfaEnabled: boolean;
      // Added by JwtStrategy.validate() — flattened from the locations relation.
      locationIds: string[];
    }
  }
}

export {};
