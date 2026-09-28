import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'Proveedor' })
export class Proveedor {
  @PrimaryGeneratedColumn({ name: 'IdProveedor' })
  idProveedor: number;

  @Column({ name: 'Nombre', type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'Documento', type: 'varchar', length: 50 })
  documento: string;

  @Column({ name: 'Telefono', type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'Correo', type: 'varchar', length: 150, nullable: true })
  correo: string | null;

  @Column({ name: 'Direccion', type: 'varchar', length: 250, nullable: true })
  direccion: string | null;

  @Column({ name: 'PersonaDeContacto', type: 'varchar', length: 150, nullable: true })
  personaDeContacto: string | null;

  @Column({ name: 'DiasDeCredito', type: 'int', default: 0 })
  diasDeCredito: number;

  @Column({ name: 'Activo', type: 'tinyint', width: 1, default: 1 })
  activo: boolean;
}
