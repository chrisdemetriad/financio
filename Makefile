.PHONY: help \
	infra-up-aws infra-down-aws infra-plan-aws \
	infra-up-gcp infra-down-gcp infra-preview-gcp \
	docker-build docker-push-aws docker-push-gcp \
	db-migrate

AWS_REGION  ?= eu-west-2
GCP_REGION  ?= europe-west1
APP_NAME    ?= financio
IMAGE_TAG   ?= latest

# Read ECR url from terraform output if available
ECR_URL     ?= $(shell cd infra/terraform && terraform output -raw ecr_repository_url 2>/dev/null)
GCR_URL     ?= $(GCP_REGION)-docker.pkg.dev/financio-495909/$(APP_NAME)-api

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-28s\033[0m %s\n", $$1, $$2}'

# ── AWS / Terraform ────────────────────────────────────────────────────────

infra-plan-aws: ## Preview Terraform changes (AWS)
	cd infra/terraform && terraform init -upgrade && terraform plan

infra-up-aws: ## Apply Terraform — provision / update AWS infrastructure
	cd infra/terraform && terraform init -upgrade && terraform apply -auto-approve

infra-down-aws: ## Destroy all AWS infrastructure (CAREFUL)
	cd infra/terraform && terraform destroy

# ── GCP / Pulumi ──────────────────────────────────────────────────────────

infra-preview-gcp: ## Preview Pulumi changes (GCP)
	cd infra/pulumi && npm install && pulumi preview

infra-up-gcp: ## Deploy GCP infrastructure via Pulumi
	cd infra/pulumi && npm install && pulumi up --yes

infra-down-gcp: ## Destroy all GCP infrastructure (CAREFUL)
	cd infra/pulumi && pulumi destroy --yes

# ── Docker ────────────────────────────────────────────────────────────────

docker-build: ## Build the API Docker image locally
	docker build -f Dockerfile.api -t $(APP_NAME)-api:$(IMAGE_TAG) .

docker-push-aws: docker-build ## Tag and push image to AWS ECR
	aws ecr get-login-password --region $(AWS_REGION) | \
		docker login --username AWS --password-stdin $(ECR_URL)
	docker tag $(APP_NAME)-api:$(IMAGE_TAG) $(ECR_URL):$(IMAGE_TAG)
	docker push $(ECR_URL):$(IMAGE_TAG)

docker-push-gcp: docker-build ## Tag and push image to GCP Artifact Registry
	gcloud auth configure-docker $(GCP_REGION)-docker.pkg.dev --quiet
	docker tag $(APP_NAME)-api:$(IMAGE_TAG) $(GCR_URL):$(IMAGE_TAG)
	docker push $(GCR_URL):$(IMAGE_TAG)

# ── Database ──────────────────────────────────────────────────────────────

db-migrate: ## Run Prisma migrations against DATABASE_URL
	pnpm --filter @financio/api db:migrate
