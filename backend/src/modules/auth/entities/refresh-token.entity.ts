import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Persistierte Refresh-Tokens fuer DB-gestuetzte Token-Invalidierung (SEC-002).
 * Tokenwert wird als SHA-256-Hash gespeichert – nie im Klartext.
 */
@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Column()
  expiresAt!: Date;

  @Column({ type: "datetime", nullable: true })
  revokedAt!: Date | null;

  @Index()
  @Column({ default: false })
  isRevoked!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
