import { Module } from '@nestjs/common';

import { LoggingModule } from '../logging/logging.module';

import { EmailController } from './email.controller';
import { EmailService } from './email.service';

@Module({
  imports: [LoggingModule],
  providers: [EmailService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule {}