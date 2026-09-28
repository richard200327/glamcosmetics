import { Module } from '@nestjs/common';
import { FidelidadService } from './fidelidad.service';
import { FidelidadController } from './fidelidad.controller';

@Module({
  controllers: [FidelidadController],
  providers: [FidelidadService]
})
export class FidelidadModule {}
