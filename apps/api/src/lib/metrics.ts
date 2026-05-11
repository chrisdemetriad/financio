import { ECSClient, DescribeServicesCommand } from '@aws-sdk/client-ecs'
import type { MetricsResponse } from '@financio/types'

const AWS_SERVICE_NAME = process.env.APP_NAME ?? 'financio-api'
const AWS_ECS_CLUSTER = process.env.AWS_ECS_CLUSTER_NAME ?? 'default'
const GCP_PROJECT = process.env.GCP_PROJECT_ID ?? 'financio-495909'
const CLOUD_RUN_SERVICE = process.env.CLOUD_RUN_SERVICE_NAME ?? 'financio-api'
const GCP_REGION = process.env.GCP_REGION ?? 'europe-west1'

// ── Simulation (local dev) ────────────────────────────────────────────────

// Tracks a simulated instance count that drifts based on recent load
const simInstances = { aws: 1, gcp: 0 }

function updateSim() {
  // Slowly drift toward 1 when idle, occasional spikes
  const drift = () => {
    const random = Math.random()
    if (random > 0.92) return 1   // scale up event
    if (random < 0.15) return -1  // scale down event
    return 0
  }

  simInstances.aws = Math.max(1, Math.min(5, simInstances.aws + drift()))
  simInstances.gcp = Math.max(0, Math.min(5, simInstances.gcp + drift()))
}

// ── AWS ECS Express Mode ─────────────────────────────────────────────────

async function getAwsInstanceCount(): Promise<number | null> {
  try {
    const ecs = new ECSClient({ region: process.env.AWS_REGION ?? 'eu-west-2' })
    const result = await ecs.send(
      new DescribeServicesCommand({
        cluster: AWS_ECS_CLUSTER,
        services: [AWS_SERVICE_NAME],
      }),
    )

    return result.services?.[0]?.runningCount ?? null
  } catch {
    return null
  }
}

// ── GCP Cloud Monitoring ─────────────────────────────────────────────────

async function getGcpInstanceCount(): Promise<number | null> {
  try {
    const { GoogleAuth } = await import('google-auth-library')
    const auth = new GoogleAuth({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/monitoring.read'],
    })
    const client = await auth.getClient()
    const token = await client.getAccessToken()
    if (!token.token) return null

    const now = new Date()
    const start = new Date(now.getTime() - 5 * 60 * 1000)
    const filter = [
      'metric.type="run.googleapis.com/container/instance_count"',
      `resource.labels.service_name="${CLOUD_RUN_SERVICE}"`,
      `resource.labels.location="${GCP_REGION}"`,
    ].join(' AND ')

    const url = new URL(
      `https://monitoring.googleapis.com/v3/projects/${GCP_PROJECT}/timeSeries`,
    )
    url.searchParams.set('filter', filter)
    url.searchParams.set('interval.startTime', start.toISOString())
    url.searchParams.set('interval.endTime', now.toISOString())
    url.searchParams.set('aggregation.alignmentPeriod', '60s')
    url.searchParams.set('aggregation.perSeriesAligner', 'ALIGN_MAX')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token.token}` },
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      timeSeries?: Array<{ points?: Array<{ value?: { int64Value?: string } }> }>
    }

    const latest = data.timeSeries?.[0]?.points?.[0]?.value?.int64Value
    return latest ? parseInt(latest, 10) : 0
  } catch {
    return null
  }
}

// ── Route export ─────────────────────────────────────────────────────────

export async function getMetrics(): Promise<MetricsResponse> {
  const storageCloud = process.env.STORAGE_CLOUD ?? 'local'
  const isLocal = storageCloud === 'local'

  if (isLocal) {
    updateSim()
    return {
      aws: { instanceCount: simInstances.aws, serviceName: `${AWS_SERVICE_NAME} (simulated)` },
      gcp: { instanceCount: simInstances.gcp, serviceName: `${CLOUD_RUN_SERVICE} (simulated)` },
      timestamp: new Date().toISOString(),
    }
  }

  const [awsCount, gcpCount] = await Promise.allSettled([
    getAwsInstanceCount(),
    getGcpInstanceCount(),
  ])

  return {
    aws: {
      instanceCount: awsCount.status === 'fulfilled' ? awsCount.value : null,
      serviceName: AWS_SERVICE_NAME,
    },
    gcp: {
      instanceCount: gcpCount.status === 'fulfilled' ? gcpCount.value : null,
      serviceName: CLOUD_RUN_SERVICE,
    },
    timestamp: new Date().toISOString(),
  }
}
