// Roles del sistema. Coinciden exactamente con los valores que se guardan en
// Usuario.Rol (varchar), para no tener que mapear entre un enum numerico y el string.
export enum Rol {
  Administrador = 'Administrador',
  Vendedor = 'Vendedor',
  Cajero = 'Cajero',
  Almacen = 'Almacen'
}
