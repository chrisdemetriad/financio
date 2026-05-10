output "ecr_repository_url" {
  description = "ECR repository URL — used in deploy-aws.yml"
  value       = aws_ecr_repository.api.repository_url
}

output "app_runner_service_url" {
  description = "App Runner service URL (set as VITE_API_URL in the frontend)"
  value       = "https://${aws_apprunner_service.api.service_url}"
}

output "rds_endpoint" {
  description = "RDS endpoint (private — reachable from App Runner via VPC connector)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for logo assets"
  value       = aws_s3_bucket.assets.bucket
}

output "github_actions_role_arn" {
  description = "IAM role ARN to set as AWS_ROLE_ARN in GitHub Actions secrets"
  value       = aws_iam_role.github_actions.arn
}
