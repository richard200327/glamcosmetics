import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

export class ReglaCantidadDto {
  @IsInt()
  @Min(1)
  cantidadMinima: number;

  @IsIn(['Porcentaje', 'MontoFijo'])
  tipoDescuento: 'Porcentaje' | 'MontoFijo';

  @IsNumber()
  @Min(0)
  valorDescuento: number;
}

export class ReglaPrecioEspecialDto {
  @IsInt()
  idProducto: number;

  @IsNumber()
  @Min(0)
  precioEspecial: number;
}

export class ReglaMontoPedidoDto {
  @IsNumber()
  @Min(0)
  montoMinimoPedido: number;

  @IsIn(['DescuentoPorcentaje', 'ProductoGratis'])
  tipoBeneficio: 'DescuentoPorcentaje' | 'ProductoGratis';

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorDescuento?: number | null;

  @IsOptional()
  @IsInt()
  idProductoRegalo?: number | null;
}

export class CrearPromocionDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsIn(['DescuentoPorCantidad', 'PrecioEspecial', 'DescuentoPorMontoPedido', 'ProductoGratisPorMonto'])
  tipoPromocion: 'DescuentoPorCantidad' | 'PrecioEspecial' | 'DescuentoPorMontoPedido' | 'ProductoGratisPorMonto';

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsBoolean()
  acumulable: boolean;

  // Productos a los que aplica la promocion (para DescuentoPorCantidad y PrecioEspecial).
  @IsOptional()
  @IsArray()
  idsDeProductos?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReglaCantidadDto)
  reglasDeCantidad?: ReglaCantidadDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReglaPrecioEspecialDto)
  reglasDePrecioEspecial?: ReglaPrecioEspecialDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReglaMontoPedidoDto)
  reglasDeMontoPedido?: ReglaMontoPedidoDto[];
}

export class ActualizarPromocionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsBoolean()
  acumulable?: boolean;
}
