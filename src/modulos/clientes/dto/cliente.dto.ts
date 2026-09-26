import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CrearClienteDto {
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
}

export class ActualizarClienteDto {
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
  @IsBoolean()
  activo?: boolean;
}
