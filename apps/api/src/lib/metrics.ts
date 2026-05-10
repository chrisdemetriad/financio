import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch'
import { AppRunnerClient, DescribeServiceCommand, ListServicesCommand } from '@aws-sdk/client-apprunner'
import type { MetricsResponse } from '@financio/types'

const APP_RUNNER_SERVICE_NAME = process.env.APP_NAME ?? 'financio-api'
const GCP_PROJECT = process.env.GCP_PROJECT_ID ?? 'financio-495909'
const CLOUD_RUN_SERVICE = process.env.CLOUD_RUN_SERVICE_NAME ?? 'financio-api'
const GCP_REGION = process.env.GCP_REGION ?? 'europe-west1'

// ── Simulation (local dev) ────────────────────────────────────────────────

// Tracks a simulated instance count that drifts based on recent load
let simInstances = { aws: 1, gcp: 0 }
let lastSim = Date.now()

function updateSim() {
  const now = Date.now()
  const elapsed = (now - lastSim) / 1000
  lastSim = now

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

// ── AWS CloudWatch ────────────────────────────────────────────────────────

async function getAwsInstanceCount(): Promise<number | null> {
  try {
    const apprunner = new AppRunnerClient({ region: process.env.AWS_REGION ?? 'eu-west-2' })

    // Find the service ARN
    const list = await apprunner.send(new ListServicesCommand({}))
    const svc = list.ServiceSummaryList?.find((s) => s.ServiceName === APP_RUNNER_SERVICE_NAME)
    if (!svc?.ServiceArn) return null

    // Describe the service to get current status
    const desc = await apprunner.send(new DescribeServiceCommand({ ServiceArn: svc.ServiceArn }))
    const serviceId = desc.Service?.ServiceId
    if (!serviceId) return null

    const cw = new CloudWatchClient({ region: process.env.AWS_REGION ?? 'eu-west-2' })
    const now = new Date()
    const start = new Date(now.getTime() - 5 * 60 * 1000) // last 5 min

    const result = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/AppRunner',
        MetricName: 'ActiveInstances',
        Dimensions: [{ Name: 'ServiceId', Value: serviceId }],
        StartTime: start,
        EndTime: now,
        Period: 60,
        Statistics: ['Maximum'],
      }),
    )

    const points = (result.Datapoints ?? []).sort((a, b) =>
      (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0),
    )

    return points[0]?.Maximum ?? null
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
      aws: { instanceCount: simInstances.aws, serviceName: `${APP_RUNNER_SERVICE_NAME} (simulated)` },
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
      serviceName: APP_RUNNER_SERVICE_NAME,
    },
    gcp: {
      instanceCount: gcpCount.status === 'fulfilled' ? gcpCount.value : null,
      serviceName: CLOUD_RUN_SERVICE,
    },
    timestamp: new Date().toISOString(),
  }
}
