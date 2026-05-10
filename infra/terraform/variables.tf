variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-west-2"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Application name used as resource name prefix"
  type        = string
  default     = "financio"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "financio"
}

variable "db_password" {
  description = "RDS master password — use a strong value, never commit"
  type        = string
  sensitive   = true
}

variable "clerk_secret_key" {
  description = "Clerk secret key for JWT verification"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

variable "brandfetch_api_key" {
  description = "Brandfetch API key for logo fetching"
  type        = string
  sensitive   = true
}

variable "cors_origin" {
  description = "Allowed CORS origin (your frontend URL, e.g. https://financio.example.com)"
  type        = string
}
