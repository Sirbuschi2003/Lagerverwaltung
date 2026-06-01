import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "delivery_notes" })
export class DeliveryNote {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "varchar", length: 100 })
  vorgangsnummer!: string;

  @Column({ type: "varchar", length: 500 })
  filePath!: string;

  @Index()
  @Column({ type: "varchar", length: 36, nullable: true, default: null })
  branchId!: string | null;

  @Column({ type: "datetime", precision: 6, default: () => "CURRENT_TIMESTAMP(6)" })
  detectedAt!: Date;
}
