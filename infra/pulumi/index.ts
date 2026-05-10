import * as pulumi from '@pulumi/pulumi'
import * as gcp from '@pulumi/gcp'

const cfg = new pulumi.Config()
const gcpCfg = new pulumi.Config('gcp')

const project = gcpCfg.require('project')
const region = gcpCfg.get('region') ?? 'europe-west1'
const appName = 'financio'

// ── Artifact Registry repository for API Docker images ────────────────────
const artifactRepo = new gcp.artifactregistry.Repository('api-repo', {
  repositoryId: `${appName}-api`,
  location: region,
  format: 'DOCKER',
  description: 'Financio API Docker images',
})

// ── Service account for Cloud Run ─────────────────────────────────────────
const runnerSa = new gcp.serviceaccount.Account('cloud-run-sa', {
  accountId: `${appName}-runner`,
  displayName: 'Financio Cloud Run service account',
})

// Allow the service account to read/write GCS
new gcp.storage.BucketIAMMember('runner-gcs-rw', {
  bucket: `${appName}-assets`,
  role: 'roles/storage.objectAdmin',
  member: pulumi.interpolate`serviceAccount:${runnerSa.email}`,
})

// Allow Cloud Run to pull from Artifact Registry
new gcp.artifactregistry.RepositoryIamMember('runner-ar-pull', {
  repository: artifactRepo.repositoryId,
  location: region,
  role: 'roles/artifactregistry.reader',
  member: pulumi.interpolate`serviceAccount:${runnerSa.email}`,
})

// ── Cloud SQL (Postgres 16) ────────────────────────────────────────────────
const dbInstance = new gcp.sql.DatabaseInstance('postgres', {
  name: `${appName}-postgres`,
  databaseVersion: 'POSTGRES_16',
  region,
  settings: {
    tier: 'db-f1-micro',
    availabilityType: 'ZONAL',
    backupConfiguration: {
      enabled: true,
      startTime: '03:00',
    },
    ipConfiguration: {
      ipv4Enabled: false,
      privateNetwork: `projects/${project}/global/networks/default`,
    },
  },
  deletionProtection: true,
})

const dbPassword = cfg.requireSecret('db_password')

const dbUser = new gcp.sql.User('db-user', {
  instance: dbInstance.name,
  name: appName,
  password: dbPassword,
})

const database = new gcp.sql.Database('db', {
  instance: dbInstance.name,
  name: appName,
})

// ── Cloud Run service ──────────────────────────────────────────────────────
const corsOrigin = cfg.get('cors_origin') ?? 'https://localhost:5173'
const clerkSecretKey = cfg.requireSecret('clerk_secret_key')
const openaiApiKey = cfg.requireSecret('openai_api_key')
const brandfetchApiKey = cfg.requireSecret('brandfetch_api_key')

const apiService = new gcp.cloudrunv2.Service('api', {
  name: `${appName}-api`,
  location: region,
  ingress: 'INGRESS_TRAFFIC_ALL',

  template: {
    serviceAccount: runnerSa.email,
    scaling: {
      minInstanceCount: 0,
      maxInstanceCount: 10,
    },
    containers: [{
      image: pulumi.interpolate`${region}-docker.pkg.dev/${project}/${artifactRepo.repositoryId}/${appName}-api:latest`,
      resources: {
        limits: {
          cpu: '1',
          memory: '512Mi',
        },
        cpuIdle: true,
        startupCpuBoost: true,
      },
      ports: [{ containerPort: 3001 }],
      envs: [
        { name: 'NODE_ENV', value: 'production' },
        { name: 'PORT', value: '3001' },
        { name: 'HOST', value: '0.0.0.0' },
        { name: 'CORS_ORIGIN', value: corsOrigin },
        { name: 'STORAGE_CLOUD', value: 'gcp' },
        { name: 'GCS_BUCKET', value: `${appName}-assets` },
        {
          name: 'DATABASE_URL',
          value: pulumi.interpolate`postgresql://${appName}:${dbPassword}@localhost/financio?host=/cloudsql/${project}:${region}:${dbInstance.name}`,
        },
        { name: 'CLERK_SECRET_KEY', value: clerkSecretKey },
        { name: 'OPENAI_API_KEY', value: openaiApiKey },
        { name: 'BRANDFETCH_API_KEY', value: brandfetchApiKey },
      ],
      volumeMounts: [{
        name: 'cloudsql',
        mountPath: '/cloudsql',
      }],
    }],
    volumes: [{
      name: 'cloudsql',
      cloudSqlInstance: {
        instances: [pulumi.interpolate`${project}:${region}:${dbInstance.name}`],
      },
    }],
  },
})

// Allow unauthenticated (Clerk handles auth at app layer)
new gcp.cloudrunv2.ServiceIamMember('api-public', {
  name: apiService.name,
  location: region,
  role: 'roles/run.invoker',
  member: 'allUsers',
})

// ── Workload Identity Federation for GitHub Actions ───────────────────────
const wifPool = new gcp.iam.WorkloadIdentityPool('github-pool', {
  workloadIdentityPoolId: 'github-actions-pool',
  displayName: 'GitHub Actions',
})

const wifProvider = new gcp.iam.WorkloadIdentityPoolProvider('github-provider', {
  workloadIdentityPoolId: wifPool.workloadIdentityPoolId,
  workloadIdentityPoolProviderId: 'github-provider',
  displayName: 'GitHub',
  oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
  attributeMapping: {
    'google.subject': 'assertion.sub',
    'attribute.repository': 'assertion.repository',
  },
  attributeCondition: 'attribute.repository.startsWith("YOUR_GITHUB_ORG/")',
})

const deployerSa = new gcp.serviceaccount.Account('github-deployer', {
  accountId: `${appName}-deployer`,
  displayName: 'GitHub Actions deployer',
})

// Deployer can push images and deploy Cloud Run
new gcp.projects.IAMMember('deployer-ar-writer', {
  project,
  role: 'roles/artifactregistry.writer',
  member: pulumi.interpolate`serviceAccount:${deployerSa.email}`,
})

new gcp.projects.IAMMember('deployer-run-developer', {
  project,
  role: 'roles/run.developer',
  member: pulumi.interpolate`serviceAccount:${deployerSa.email}`,
})

new gcp.serviceaccount.IAMMember('wif-binding', {
  serviceAccountId: deployerSa.name,
  role: 'roles/iam.workloadIdentityUser',
  member: pulumi.interpolate`principalSet://iam.googleapis.com/${wifPool.name}/attribute.repository/YOUR_GITHUB_ORG/financio`,
})

// ── Outputs ───────────────────────────────────────────────────────────────
export const artifactRepoUrl = pulumi.interpolate`${region}-docker.pkg.dev/${project}/${artifactRepo.repositoryId}`
export const cloudRunUrl = apiService.uri
export const dbConnectionName = dbInstance.connectionName
export const workloadIdentityProvider = pulumi.interpolate`projects/${project}/locations/global/workloadIdentityPools/${wifPool.workloadIdentityPoolId}/providers/${wifProvider.workloadIdentityPoolProviderId}`
export const deployerServiceAccount = deployerSa.email
