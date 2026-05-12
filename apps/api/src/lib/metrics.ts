import { ECSClient, DescribeServicesCommand } from '@aws-sdk/client-ecs'
import type { MetricsResponse } from '@financio/types'

const AWS_SERVICE_NAME = process.env.APP_NAME ?? 'financio-api'
const AWS_ECS_CLUSTER = process.env.AWS_ECS_CLUSTER_NAME ?? 'default'

// ── Simulation (local dev) ────────────────────────────────────────────────

let simAwsInstances = 1

function updateSim() {
  const random = Math.random()
  let delta = 0
  if (random > 0.92) delta = 1
  else if (random < 0.15) delta = -1
  simAwsInstances = Math.max(1, Math.min(5, simAwsInstances + delta))
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

// ── Route export ─────────────────────────────────────────────────────────

export async function getMetrics(): Promise<MetricsResponse> {
  const storageCloud = process.env.STORAGE_CLOUD ?? 'local'
  const isLocal = storageCloud === 'local'

  if (isLocal) {
    updateSim()
    return {
      aws: { instanceCount: simAwsInstances, serviceName: `${AWS_SERVICE_NAME} (simulated)` },
      timestamp: new Date().toISOString(),
    }
  }

  const awsCount = await getAwsInstanceCount()

  return {
    aws: {
      instanceCount: awsCount,
      serviceName: AWS_SERVICE_NAME,
    },
    timestamp: new Date().toISOString(),
  }
}
