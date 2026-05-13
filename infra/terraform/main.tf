terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Switch to an S3 backend once the bucket exists:
  # backend "s3" {
  #   bucket = "financio-tf-state"
  #   key    = "prod/terraform.tfstate"
  #   region = var.aws_region
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "financio"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront TLS certificates must be requested in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "financio"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
