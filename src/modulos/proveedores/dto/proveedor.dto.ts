import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CrearProveedorDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsString()
  @MinLength(1)
  documento: string;

  @IsOptional()
  @IsString()
  telefono?: string | null;

  @IsOptional()
  @IsString()
  correo?: string | null;

  @IsOptional()
  @IsString()
  direccion?: string | null;

  @IsOptional()
  @IsString()
  personaDeContacto?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasDeCredito?: number;
}

export class ActualizarProveedorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  documento?: string;

  @IsOptional()
  @IsString()
  telefono?: string | null;

  @IsOptional()
  @IsString()
  correo?: string | null;

  @IsOptional()
  @IsString()
  direccion?: string | null;

  @IsOptional()
  @IsString()
  personaDeContacto?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasDeCredito?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
