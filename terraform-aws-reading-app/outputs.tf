output "app_url" {
  description = "URL publica de la app (HTTPS por CloudFront)"
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "ecr_repository_url" {
  description = "Repositorio ECR de la imagen"
  value       = aws_ecr_repository.app.repository_url
}

output "instance_id" {
  description = "ID de la instancia EC2 (para conectarte con SSM)"
  value       = aws_instance.app.id
}
