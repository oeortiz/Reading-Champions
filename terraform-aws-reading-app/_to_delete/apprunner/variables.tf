variable "aws_region" {
  description = "Region de AWS para el despliegue"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nombre base para identificar los recursos"
  type        = string
  default     = "reading-app"
}

variable "db_name" {
  description = "Nombre de la base de datos PostgreSQL"
  type        = string
  default     = "reading_champions"
}

variable "db_username" {
  description = "Usuario maestro de PostgreSQL"
  type        = string
  default     = "dbadmin"
}

variable "admin_username" {
  description = "Usuario administrador inicial que crea el seed"
  type        = string
  default     = "admin"
}

variable "admin_password" {
  description = "Contrasena del administrador inicial de la app"
  type        = string
  sensitive   = true
}
