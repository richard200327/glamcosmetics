import { IsDateString, IsOptional } from 'class-validator';

export class FiltrosDeReporteDto {
  @IsOptional()
  idCliente?: number | null;

  @IsDateString()
  fechaDesde: string;

  @IsDateString()
  fechaHasta: string;
}
