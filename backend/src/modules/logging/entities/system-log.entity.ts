import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SECURITY = 'SECURITY',
}

export enum LogCategory {
  AUTH = 'AUTH',
  STOCK = 'STOCK',
  VEHICLE = 'VEHICLE',
  RESTOCK = 'RESTOCK',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  INVENTORY = 'INVENTORY',
  EMAIL = 'EMAIL',
  PURCHASE = 'PURCHASE',
}

@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ 
    type: 'enum', 
    enum: LogLevel,
    default: LogLevel.INFO 
  })
  level!: LogLevel;

  @Column({ 
    type: 'enum', 
    enum: LogCategory 
  })
  category!: LogCategory;

  @Column({ length: 255 })
  action!: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @Column({ nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ length: 45, nullable: true })
  ipAddress?: string;

  @Column({ length: 500, nullable: true })
  userAgent?: string;

  @CreateDateColumn()
  createdAt!: Date;
}