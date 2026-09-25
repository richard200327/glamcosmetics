import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class DetalleDePagoDto {
  @IsInt()
  idCuenta: number;

  @IsInt()
  idMetodoPago: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montoAplicado: number;
}

export class RegistrarPagoDto {
  @IsOptional()
  @IsInt()
  idUsuario?: number;

  @IsOptional()
  @IsInt()
  idCliente?: number | null;

  @IsOptional()
  @IsInt()
  idProveedor?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observaciones?: string | null;

  @IsIn(['Automatico', 'Manual', 'ContadoDirecto'])
  modoDeAplicacion: 'Automatico' | 'Manual' | 'ContadoDirecto';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleDePagoDto)
  detalles: DetalleDePagoDto[];
}

export class AnularPagoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  motivoDeAnulacion: string;
}
