import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const aBooleano = ({ value }: { value: unknown }) => {
  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return value;
};

export class ActualizarFidelidadDto {
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  meta?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoMinimo?: number;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  soloPagadas?: boolean;

  @IsOptional()
  @IsIn(['producto', 'porcentaje', 'monto', 'otro'])
  tipoDePremio?: 'producto' | 'porcentaje' | 'monto' | 'otro';

  @IsOptional()
  @IsInt()
  idProducto?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  cantidadDelProducto?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorDelDescuento?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  descripcionDelPremio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  mensajeProgreso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  mensajeMeta?: string;
}

export class CanjearPremioDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  notas?: string;
}
