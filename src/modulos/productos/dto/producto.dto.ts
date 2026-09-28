import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CrearProductoDto {
  @IsString()
  @MinLength(1)
  codigo: string;

  @IsOptional()
  @IsString()
  codigoDeBarras?: string | null;

  @IsString()
  @MinLength(1)
  descripcion: string;

  @IsNumber()
  @Min(0)
  precioUnitario: number;

  // Costo promedio de adquisicion/produccion. Se usa para calcular la ganancia bruta
  // en reportes (precioUnitario - costoPromedio); nunca se expone al cliente final.
  @IsNumber()
  @Min(0)
  costoPromedio: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioAlMayor?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  cantidadMinimaParaPrecioAlMayor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  existencia?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  existenciaMinima?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarProductoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  codigo?: string;

  @IsOptional()
  @IsString()
  codigoDeBarras?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  descripcion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnitario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoPromedio?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioAlMayor?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  cantidadMinimaParaPrecioAlMayor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  existenciaMinima?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class AjustarExistenciaDto {
  @IsInt()
  @Min(1)
  cantidad: number;

  @IsIn(['Entrada', 'Salida'])
  tipoMovimiento: 'Entrada' | 'Salida';

  // Costo unitario de ESTA entrada de mercancia (ej: si llego un lote nuevo a un
  // precio distinto al de la ultima compra). Solo aplica y es obligatorio cuando
  // tipoMovimiento es 'Entrada'; se ignora en 'Salida' (una salida no cambia el costo
  // promedio, solo descuenta existencia). Con este dato, el backend recalcula el
  // costo promedio ponderado del producto automaticamente.
  @IsOptional()
  @IsNumber()
  @Min(0)
  costoUnitario?: number;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}
