resource "aws_cloudwatch_log_group" "api" {
  name              = "/financio/api"
  retention_in_days = 30
}

resource "aws_apprunner_service" "api" {
  service_name = "${var.app_name}-api"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.api.repository_url}:latest"
      image_repository_type = "ECR"

      image_configuration {
        port = "3001"

        runtime_environment_variables = {
          NODE_ENV      = "production"
          PORT          = "3001"
          HOST          = "0.0.0.0"
          CORS_ORIGIN   = var.cors_origin
          STORAGE_CLOUD = "aws"
          AWS_REGION    = var.aws_region
          AWS_S3_BUCKET = aws_s3_bucket.assets.bucket
          DATABASE_URL  = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/financio"
        }

        runtime_environment_secrets = {
          CLERK_SECRET_KEY   = aws_ssm_parameter.clerk_secret_key.arn
          OPENAI_API_KEY     = aws_ssm_parameter.openai_api_key.arn
          BRANDFETCH_API_KEY = aws_ssm_parameter.brandfetch_api_key.arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = "0.25 vCPU"
    memory            = "0.5 GB"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.api.arn

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 3
  }

  observability_configuration {
    observability_enabled               = true
    observability_configuration_arn     = aws_apprunner_observability_configuration.api.arn
  }
}

resource "aws_apprunner_auto_scaling_configuration_version" "api" {
  auto_scaling_configuration_name = "${var.app_name}-api"
  min_size                        = 1
  max_size                        = 5
  max_concurrency                 = 100
}

resource "aws_apprunner_observability_configuration" "api" {
  observability_configuration_name = "${var.app_name}-api"

  trace_configuration {
    vendor = "AWSXRAY"
  }
}

# SSM Parameter Store for secrets (referenced by App Runner)
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
