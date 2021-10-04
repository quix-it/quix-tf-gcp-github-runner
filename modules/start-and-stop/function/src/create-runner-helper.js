const Compute = require('@google-cloud/compute')
const Fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const chalk = require('chalk')
const compute = new Compute()
const zone = compute.zone(require('./google-settings').zone())
const githubHelper = require('./github-helper.js')
const pWaitFor = require('p-wait-for')
const utils = require('./utils')
const runnerType = require('./runner-type')
const googleSettings = require('./google-settings')
const env = googleSettings.env()
const project = googleSettings.project()

module.exports.createRunner = createRunner
module.exports.getRunnerNamePrefix = getRunnerNamePrefix

async function createRunner (type) {
  const runnerName = createRunnerName(type)
  console.info(`start create runner ${runnerName}...`)
  const vm = await createRunnerVm(runnerName, type)
  await waitForRunnerConnectedToGitHub(vm, type)
  console.info(chalk.green(`runner ${vm.name} created, up, and connected to GitHub`))
  return vm
}

function getRunnerNamePrefix (type) {
  switch (type) {
    case runnerType.default:
      return `vm-gcp-${env}`
    case runnerType.ghost:
      return `vm-gcp-ghost-${env}`
    default:
      throw new Error(`Invalid runner type ${type}`)
  }
}

function createRunnerName (type) {
  return `${getRunnerNamePrefix(type)}-${uuidv4()}`
}

async function createRunnerVm (runnerName, type) {
  const createVmPromise = zone.createVM(runnerName, await createVmConfig(type, env))
  utils.logPromise(createVmPromise, `create runner ${runnerName} VM (type:${type})`)
  const [vm] = await createVmPromise

  const awaitRunningStatePromise = vm.waitFor('RUNNING')
  utils.logPromise(awaitRunningStatePromise, `waiting runner ${vm.name} VM to be in RUNNING State`)
  await awaitRunningStatePromise

  return vm
}

async function waitForRunnerConnectedToGitHub (vm, type) {
  let status
  switch (type) {
    case runnerType.default:
      status = 'online'
      break
    case runnerType.ghost:
      status = 'offline'
      break
    default:
      throw new Error(`Invalid runner type ${type}`)
  }
  const githubApiConnectionPromise = pWaitFor(
    () => githubHelper.checkGitHubRunnerStatus(vm.name, status),
    {
      interval: 10_000,
      timeout: 60_000 * 2
    }
  )
  utils.logPromise(githubApiConnectionPromise, `waiting runner ${vm.name} to have status ${status} on GitHub API`)
  await githubApiConnectionPromise
}

async function createVmConfig (type, env) {
  const startScript = Fs.readFileSync('runner-scripts/start-script.sh', 'utf8')
  const stopScript = Fs.readFileSync('runner-scripts/stop-script.sh', 'utf8')
  const token = await githubHelper.createRegistrationToken()
  const config = {
    machineType: process.env.RUNNER_MACHINE_TYPE,
    https: true,
    scheduling: {
      automaticRestart: false,
      preemptible: (process.env.RUNNER_PREEMPTIBLE == "true")
    },
    disks: [
      {
        boot: true,
        autoDelete: true,
        initializeParams: {
          sourceImage: `global/images/${process.env.RUNNER_IMAGE}`
        }
      }
    ],
    networkInterfaces: [
      {
        network: `global/networks/${process.env.RUNNER_NETWORK || 'default'}`,
        accessConfigs: []
      }
    ],
    labels: {
      type: type,
      env: env
    },
    serviceAccounts: [
      {
        email: process.env.RUNNER_SERVICE_ACCOUNT,
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform'
        ]
      }
    ],
    metadata: {
      items: [
        {
          value: type,
          key: 'type'
        },
        {
          value: env,
          key: 'env'
        },
        {
          value: token,
          key: 'registration-token'
        },
        {
          value: process.env.RUNNER_LABELS,
          key: 'runner-labels'
        },
        {
          value: process.env.REMOVE_TOKEN_TRIGGER_URL,
          key: 'get-remove-token-trigger-url'
        },
        {
          value: process.env.GITHUB_ORG,
          key: 'github-org'
        },
        {
          value: process.env.RUNNER_TAINT_LABELS,
          key: 'taint-labels'
        },
        {
          value: startScript,
          key: 'startup-script'
        },
        {
          value: stopScript,
          key: 'shutdown-script'
        }
      ]
    }
  }
  return config
}
