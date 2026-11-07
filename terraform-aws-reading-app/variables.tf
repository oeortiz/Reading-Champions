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

variable "instance_type" {
  description = "Tipo de instancia EC2 (t3.micro entra en la capa gratuita)"
  type        = string
  default     = "t3.micro"
}

variable "volume_size" {
  description = "Tamano del disco en GB (la capa gratuita cubre hasta 30 GB)"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Nombre de la base de datos PostgreSQL"
  type        = string
  default     = "reading_champions"
}

variable "db_username" {
  description = "Usuario de PostgreSQL"
  type        = string
  default     = "reading"
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
