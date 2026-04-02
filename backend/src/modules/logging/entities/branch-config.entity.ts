import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

/**
 * Niederlassungsspezifische Konfigurationsüberschreibungen.
 * Liest-Reihenfolge: branch_configs (branchId) → system_config (global).
 * Super-Admin schreibt/liest immer aus system_config (branchId = null im JWT).
 */
@Entity({ name: "branch_configs" })
@Unique(["branchId", "key"])
export class BranchConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "char", length: 36 })
  branchId!: string;

  @Column({ length: 100 })
  key!: string;

  @Column({ type: "longtext", nullable: true })
  value!: string | null;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ default: false })
  isSecret!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
