output "ecr_repository_url" {
  description = "ECR repository URL — used in Deploy API (deploy-aws.yml)"
  value       = aws_ecr_repository.api.repository_url
}

output "ecs_service_name" {
  description = "ECS Express Mode service name used by the AWS deploy workflow"
  value       = "${var.app_name}-api"
}

output "ecs_task_execution_role_arn" {
  description = "Task execution role ARN used by ECS Express Mode"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_infrastructure_role_arn" {
  description = "Infrastructure role ARN used by ECS Express Mode"
  value       = aws_iam_role.ecs_infrastructure.arn
}

output "ecs_task_role_arn" {
  description = "Application task role ARN used by ECS Express Mode"
  value       = aws_iam_role.ecs_task.arn
}

output "api_log_group_name" {
  description = "CloudWatch log group for the AWS API service"
  value       = aws_cloudwatch_log_group.api.name
}

output "rds_endpoint" {
  description = "RDS endpoint (private — reachable from ECS tasks inside the default VPC)"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for logo assets"
  value       = aws_s3_bucket.assets.bucket
}

output "frontend_bucket_name" {
  description = "S3 bucket that stores the built frontend assets"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the AWS frontend"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_cloudfront_domain_name" {
  description = "CloudFront domain for the AWS-hosted frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_acm_dns_validation" {
  description = "CNAME records to add at your DNS host (e.g. 123-reg) so ACM can issue the certificate. Required when frontend_custom_domains is non-empty."
  value = length(var.frontend_custom_domains) > 0 ? {
    for dvo in aws_acm_certificate.frontend[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  } : {}
}

output "frontend_cloudfront_aliases" {
  description = "Custom domain names configured on CloudFront (empty if using default distribution hostname only)"
  value       = aws_cloudfront_distribution.frontend.aliases
}

output "github_actions_role_arn" {
  description = "IAM role ARN to set as AWS_ROLE_ARN in GitHub Actions secrets"
  value       = aws_iam_role.github_actions.arn
}
