output "ecr_repository_url" {
  description = "URL del repositorio ECR donde se sube la imagen Docker"
  value       = aws_ecr_repository.backend.repository_url
}

output "app_url" {
  description = "URL publica de la app (API + SPA)"
  value       = "https://${aws_apprunner_service.backend.service_url}"
}

output "rds_endpoint" {
  description = "Endpoint privado de PostgreSQL"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}
