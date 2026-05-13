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
  description = "Allowed CORS origin(s) for the API. Comma-separated if you use several (e.g. https://a.com,https://www.a.com). Written to SSM /{app}/cors_origin."
  type        = string
}

variable "frontend_custom_domains" {
  description = <<-EOT
    Hostnames served by CloudFront over HTTPS (e.g. ["invoicingengine.com", "www.invoicingengine.com"]).
    First entry is the ACM primary domain; any further entries are subject alternative names.
    Leave [] to keep only the default *.cloudfront.net URL (no custom TLS).
    After first apply that creates aws_acm_certificate, add the terraform output DNS validation CNAMEs
    at your registrar before validation can succeed.
  EOT
  type        = list(string)
  default     = []
}
