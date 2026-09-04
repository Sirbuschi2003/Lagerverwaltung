import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';

/**
 * DSGVO-006: Bereinigt abgelaufene Auth-Tokens um unnötige Speicherung personenbezogener
 * Daten zu vermeiden (Datensparsamkeit, Art. 5 Abs. 1 lit. e DSGVO).
 */
@Injectable()
export class AuthCleanupService {
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {}

  /**
   * Löscht abgelaufene RefreshTokens und verbrauchte/abgelaufene PasswordResetTokens
   * die älter als 7 Tage sind.
   */
  async cleanupExpiredAuthTokens(): Promise<{ refreshTokens: number; passwordResetTokens: number }> {
    const now = new Date();

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [refreshResult, passwordResetResult] = await Promise.all([
      // Abgelaufene RefreshTokens entfernen
      this.refreshTokenRepository.delete({ expiresAt: LessThan(now) }),

      // Verwendete oder abgelaufene PasswordResetTokens älter als 7 Tage entfernen
      this.passwordResetTokenRepository
        .createQueryBuilder()
        .delete()
        .where('(used = true OR expiresAt < :now) AND createdAt < :sevenDaysAgo', {
          now,
          sevenDaysAgo,
        })
        .execute(),
    ]);

    const deletedRefreshTokens = refreshResult.affected ?? 0;
    const deletedPasswordResetTokens = passwordResetResult.affected ?? 0;

    this.logger.log(
      `Auth-Token-Cleanup: ${deletedRefreshTokens} RefreshTokens, ${deletedPasswordResetTokens} PasswordResetTokens gelöscht`,
    );

    return { refreshTokens: deletedRefreshTokens, passwordResetTokens: deletedPasswordResetTokens };
  }
}
