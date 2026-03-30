import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 255 })
  token!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @Column({ length: 45, nullable: true })
  requestedFromIp?: string;

  @Column({ type: 'datetime', nullable: true })
  usedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}