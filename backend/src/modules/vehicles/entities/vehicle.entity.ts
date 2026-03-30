import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "vehicles" })
export class Vehicle {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  licensePlate!: string;

  @Column({ length: 120 })
  description!: string;
}

