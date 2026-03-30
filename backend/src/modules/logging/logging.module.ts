import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggingController } from './controllers/logging.controller';
import { SystemConfig } from './entities/system-config.entity';
import { SystemLog } from './entities/system-log.entity';
import { LoggingService } from './services/logging.service';
import { LoggingCleanupService } from './services/logging-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog, SystemConfig])],
  providers: [LoggingService, LoggingCleanupService],
  controllers: [LoggingController],
  exports: [LoggingService],
})
export class LoggingModule {}