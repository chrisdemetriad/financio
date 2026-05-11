resource "aws_cloudwatch_log_group" "api" {
  name              = "/financio/api"
  retention_in_days = 30
}

# Runtime configuration consumed by the ECS Express Mode deployment workflow.
# The workflow references these parameters by name so it can create/update the
# service without storing app config in GitHub secrets.
resource "aws_ssm_parameter" "cors_origin" {
  name  = "/${var.app_name}/cors_origin"
  type  = "String"
  value = var.cors_origin
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.app_name}/database_url"
  type  = "SecureString"
  value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/financio"
}

resource "aws_ssm_parameter" "clerk_secret_key" {
  name  = "/${var.app_name}/clerk_secret_key"
  type  = "SecureString"
  value = var.clerk_secret_key
}

resource "aws_ssm_parameter" "openai_api_key" {
  name  = "/${var.app_name}/openai_api_key"
  type  = "SecureString"
  value = var.openai_api_key
}

resource "aws_ssm_parameter" "brandfetch_api_key" {
  name  = "/${var.app_name}/brandfetch_api_key"
  type  = "SecureString"
  value = var.brandfetch_api_key
}
