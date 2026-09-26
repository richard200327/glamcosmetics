import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

export class GuardarMarcaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  descripcion?: string | null;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class GuardarCategoriaDto extends GuardarMarcaDto {}

export class GuardarFamiliaDeColorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB.' })
  codigoHex: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class VarianteDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombreDeVariante?: string | null;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB.' })
  codigoHex?: string | null;

  @IsOptional()
  @IsInt()
  idFamiliaDeColor?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoDeBarras?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costoPromedio?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  existenciaInicial?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  existenciaMinima?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  ordenEnCatalogo?: number;
}

export class ActualizarVarianteDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombreDeVariante?: string | null;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB.' })
  codigoHex?: string | null;

  @IsOptional()
  @IsInt()
  idFamiliaDeColor?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoDeBarras?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  existenciaMinima?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  ordenEnCatalogo?: number;
}

export class GuardarProductoDeCatalogoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsInt()
  idMarca?: number | null;

  @IsOptional()
  @IsInt()
  idCategoria?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  descripcionCorta?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  modoDeUso?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  ingredientes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  atributos?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nombreDeLaVariante?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  destacado?: boolean;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => VarianteDto)
  variantes?: VarianteDto[];
}

export class ActualizarImagenDto {
  @IsOptional()
  @IsInt()
  idProducto?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  textoAlternativo?: string | null;
}

export class OrdenarImagenesDto {
  @IsArray()
  @ArrayMaxSize(60)
  @IsInt({ each: true })
  ids: number[];
}

export class VincularVarianteDto {
  @IsInt()
  idProducto: number;
}

export class ActualizarConfiguracionDeTiendaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombreDeLaTienda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  eslogan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroDeWhatsApp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  instagram?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  horarioDeAtencion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  mensajeDeEnvio?: string | null;

  @IsOptional()
  @IsBoolean()
  mostrarPreciosEnBolivares?: boolean;

  @IsOptional()
  @IsBoolean()
  mostrarExistenciaBaja?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  umbralDeExistenciaBaja?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoMinimoDePedido?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  horasDeReserva?: number;
}

export class DatosDelClienteWebDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nombre: string;

  @IsString()
  @Matches(/^[VEJGPvejgp]?[-\s.]?\d[\d.\s]{4,11}$/, { message: 'Escribe una cedula valida (ej: V-12345678).' })
  cedula: string;

  @IsString()
  @Matches(/^[+\d\s().-]{10,20}$/, { message: 'Escribe un telefono valido (ej: 0414-1234567).' })
  telefono: string;

  @IsString()
  @MinLength(8)
  @MaxLength(300)
  direccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notas?: string | null;
}

export class LineaDePedidoWebDto {
  @IsInt()
  idProducto: number;

  @IsInt()
  @Min(1)
  @Max(50)
  cantidad: number;
}

export class CrearPedidoWebDto {
  @ValidateNested()
  @Type(() => DatosDelClienteWebDto)
  cliente: DatosDelClienteWebDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LineaDePedidoWebDto)
  lineas: LineaDePedidoWebDto[];
}

export class PagoDeConversionDto {
  @IsInt()
  idMetodoPago: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;
}

export class ConvertirPedidoWebDto {
  @IsIn(['Contado', 'Credito'])
  tipo: 'Contado' | 'Credito';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PagoDeConversionDto)
  pagos?: PagoDeConversionDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasDeCredito?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observaciones?: string | null;
}

export class EliminarPedidoWebDto {
  @IsString()
  @MinLength(3)
  @MaxLength(250)
  motivo: string;
}

export class PublicarDesdeInventarioDto {
  @IsInt()
  idProducto: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsInt()
  idMarca?: number | null;

  @IsOptional()
  @IsInt()
  idCategoria?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombreDeVariante?: string | null;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB.' })
  codigoHex?: string | null;
}

export class CambiarVisibilidadDto {
  @IsBoolean()
  visible: boolean;
}

export class CambiarDestacadoDto {
  @IsBoolean()
  destacado: boolean;
}
