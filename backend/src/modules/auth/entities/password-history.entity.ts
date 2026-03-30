import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";

/**
 * Speichert die letzten N Passwort-Hashes eines Benutzers.
 * Verhindert die Wiederverwendung von kürzlich genutzten Passwörtern.
 */
@Entity({ name: "password_history" })
export class PasswordHistory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
