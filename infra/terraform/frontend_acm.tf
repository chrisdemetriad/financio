# ACM for CloudFront must live in us-east-1 (provider requirement).
# DNS validation records are output for you to add at your registrar (e.g. 123-reg).

locals {
  frontend_has_custom_domain = length(var.frontend_custom_domains) > 0
}

resource "aws_acm_certificate" "frontend" {
  count = local.frontend_has_custom_domain ? 1 : 0

  provider = aws.us_east_1

  domain_name               = var.frontend_custom_domains[0]
  subject_alternative_names = length(var.frontend_custom_domains) > 1 ? slice(var.frontend_custom_domains, 1, length(var.frontend_custom_domains)) : []

  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "frontend" {
  count = local.frontend_has_custom_domain ? 1 : 0

  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.frontend[0].arn

  validation_record_fqdns = [
    for dvo in aws_acm_certificate.frontend[0].domain_validation_options : dvo.resource_record_name
  ]

  timeouts {
    create = "45m"
  }
}
