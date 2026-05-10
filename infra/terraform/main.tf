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
