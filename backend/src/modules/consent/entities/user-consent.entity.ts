import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// DSGVO Art. 6/7: Consent tracking per user, purpose and version
@Entity({ name: "user_consents" })
@Index(["userId", "purpose"], { unique: false })
export class UserConsent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 36 })
  @Index("IDX_consent_userId")
  userId!: string;

  // e.g. "analytics", "marketing", "necessary"
  @Column({ type: "varchar", length: 100 })
  purpose!: string;

  // Consent text version shown to user
  @Column({ type: "varchar", length: 20 })
  version!: string;

  @Column({ type: "boolean", default: true })
  granted!: boolean;

  // Anonymized IP at time of consent
  @Column({ type: "varchar", length: 40, nullable: true })
  ipAddress!: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn()
  grantedAt!: Date;

  @Column({ type: "datetime", nullable: true })
  revokedAt!: Date | null;
}
