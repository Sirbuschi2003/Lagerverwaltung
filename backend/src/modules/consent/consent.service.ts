import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { UserConsent } from "./entities/user-consent.entity";
import type { GrantConsentDto } from "./dto/consent.dto";

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(UserConsent)
    private readonly consentRepo: Repository<UserConsent>,
  ) {}

  async grantConsent(
    userId: string,
    dto: GrantConsentDto,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<UserConsent> {
    // Revoke any previous active consent for this purpose
    await this.consentRepo
      .createQueryBuilder()
      .update(UserConsent)
      .set({ revokedAt: new Date() })
      .where("userId = :userId AND purpose = :purpose AND revokedAt IS NULL", {
        userId,
        purpose: dto.purpose,
      })
      .execute();

    const consent = this.consentRepo.create({
      userId,
      purpose: dto.purpose,
      version: dto.version,
      granted: dto.granted,
      ipAddress,
      userAgent,
      revokedAt: null,
    });
    return this.consentRepo.save(consent);
  }

  async getActiveConsents(userId: string): Promise<UserConsent[]> {
    return this.consentRepo.find({
      where: { userId, revokedAt: undefined },
      order: { grantedAt: "DESC" },
    });
  }

  async getConsentHistory(userId: string): Promise<UserConsent[]> {
    return this.consentRepo.find({
      where: { userId },
      order: { grantedAt: "DESC" },
    });
  }

  async revokeConsent(userId: string, purpose: string): Promise<void> {
    await this.consentRepo
      .createQueryBuilder()
      .update(UserConsent)
      .set({ revokedAt: new Date() })
      .where("userId = :userId AND purpose = :purpose AND revokedAt IS NULL", { userId, purpose })
      .execute();
  }

  async revokeAllConsents(userId: string): Promise<void> {
    await this.consentRepo
      .createQueryBuilder()
      .update(UserConsent)
      .set({ revokedAt: new Date() })
      .where("userId = :userId AND revokedAt IS NULL", { userId })
      .execute();
  }
}
