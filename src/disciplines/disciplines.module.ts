import { Module } from '@nestjs/common';
import { DisciplinesService } from './disciplines.service';
import { DisciplinesController } from './disciplines.controller';

@Module({
  providers: [DisciplinesService],
  controllers: [DisciplinesController],
})
export class DisciplinesModule {}
