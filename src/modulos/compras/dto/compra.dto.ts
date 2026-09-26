import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { PagoDeContadoDto } from '../../pedidos/dto/pedido.dto';

export class LineaDeCompraDto {
  @IsInt()
  idProducto: number;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costoUnitario: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  nuevoPrecioDeVenta?: number | null;
}

export class CrearCompraDto {
  @IsInt()
  idProveedor: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  numeroDeFactura?: string | null;

  @IsOptional()
  @IsDateString()
  fechaDeFactura?: string | null;

  @IsBoolean()
  esContado: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasDeCredito?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoDeDescuento?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastosAdicionales?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observaciones?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoDeContadoDto)
  pagosDeContado?: PagoDeContadoDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaDeCompraDto)
  detalles: LineaDeCompraDto[];
}

export class AnularCompraDto {
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  motivo: string;
}
