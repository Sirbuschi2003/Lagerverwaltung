import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggingController } from './controllers/logging.controller';
import { BranchConfig } from './entities/branch-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { SystemLog } from './entities/system-log.entity';
import { LogArchiveService } from './services/log-archive.service';
import { LoggingCleanupService } from './services/logging-cleanup.service';
import { LoggingService } from './services/logging.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog, SystemConfig, BranchConfig])],
  providers: [LoggingService, LoggingCleanupService, LogArchiveService],
  controllers: [LoggingController],
  exports: [LoggingService],
})
export class LoggingModule {}