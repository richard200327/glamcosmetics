import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
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

export type TipoDeDescuentoManual = 'Porcentaje' | 'Monto';

export class LineaDePedidoDto {
  @IsInt()
  idProducto: number;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsBoolean()
  esRegalo?: boolean;

  @IsOptional()
  @IsIn(['Porcentaje', 'Monto'])
  tipoDescuentoManual?: TipoDeDescuentoManual;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorDescuentoManual?: number;
}

export class DescuentoManualDto {
  @IsIn(['Porcentaje', 'Monto'])
  tipo: TipoDeDescuentoManual;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor: number;
}

export class PagoDeContadoDto {
  @IsInt()
  idMetodoPago: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;
}

export class EvaluarLineasDto {
  @IsOptional()
  @IsInt()
  idPedidoWeb?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaDePedidoDto)
  detalles: LineaDePedidoDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DescuentoManualDto)
  descuentoGlobal?: DescuentoManualDto | null;
}

export class CrearPedidoDto extends EvaluarLineasDto {
  @IsInt()
  idCliente: number;

  @IsOptional()
  @IsInt()
  idUsuario?: number;

  @IsIn(['Pedido', 'Venta'])
  tipoOperacion: 'Pedido' | 'Venta';

  @IsBoolean()
  esContado: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasDeCredito?: number;

  @IsOptional()
  @IsInt()
  idMetodoPago?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoDeContadoDto)
  pagosDeContado?: PagoDeContadoDto[];

  @IsOptional()
  @IsString()
  @MaxLength(250)
  motivoDelDescuento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observaciones?: string | null;
}

export class AnularPedidoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  motivo?: string;
}
