const getRunnerHelper = require('./get-runner-helper')
const createRunnerHelper = require('./create-runner-helper')
const deleteRunnerHelper = require('./delete-runner-helper')
const gitHubHelper = require('./github-helper')
const chalk = require('chalk')
const runnerType = require('./runner-type')
const scalePolicySettings = require('./scale-policy-settings')

module.exports.scaleUpAllRunners = scaleUpAllRunners
module.exports.scaleDownAllRunners = scaleDownAllRunners
module.exports.getRunnersDeltaToMaxCount = getRunnersDeltaToMaxCount
module.exports.scaleUpRunners = scaleUpRunners
module.exports.scaleDownRunners = scaleDownRunners

async function scaleUpAllRunners () {
  console.info('scale up all runners...')
  const targetRunnerCountDelta = await getRunnersDeltaToMaxCount()
  if (targetRunnerCountDelta > 0) {
    await scaleUpRunners(targetRunnerCountDelta)
  }
  console.info(chalk.green('scale up all runners succeed'))
}

async function scaleDownAllRunners () {
  console.info('scale down all runners...')
  const runnerVms = await getRunnerHelper.getRunnersVms()
  await scaleDownRunners(runnerVms.length)
  console.info(chalk.green('scale down all runners succeed'))
}

async function getRunnersDeltaToMaxCount () {
  const runnersVms = await getRunnerHelper.getRunnersVms()
  const targetRunnersCount = scalePolicySettings.upMax()
  const targetRunnerCountDelta = targetRunnersCount - runnersVms.length
  return targetRunnerCountDelta
}

async function scaleUpRunners (count) {
  console.info(`scale up ${count} runners...`)
  const createPromises = []
  for (let i = 0; i < count; i++) {
    createPromises[i] = createRunnerHelper.createRunner(runnerType.default)
  }
  await Promise.all(createPromises)
  console.info(chalk.green(`scale up ${count} runners succeeded`))
}

module.exports.smartScaleDownRunners = smartScaleDownRunners

async function smartScaleDownRunners (downRate, idleCount, minAgeSeconds = 0) {
  // filter VMs by age
  // remove ALL offline runners
  // do not touch runners younger than ${minAgeSeconds} seconds
  // remove at most ${downRate} runners
  // retain at least ${idleCount} runners
  const age = minAgeSeconds || 0

  console.info(`scale down ${downRate < 0 ? "all" : downRate} online runners older than ${age} seconds keeping at least ${idleCount} runners`)

  const vms = await getRunnerHelper.getRunnersVms(age)

  // remove offline runners
  console.info(`remove offline github runners older than ${age} seconds`)
  const offlineGcpGitHubRunners = (await gitHubHelper.getOfflineGitHubRunners()).filter( runner => { vms.map(vm => { vm.name }).includes(runner.name) })
  console.info(`${offlineGcpGitHubRunners.length} GitHub runners offline older than ${age} seconds`)
  const offlineDeleted = await Promise.all(offlineGcpGitHubRunners.map(async offlineGitHubRunner => {
    await deleteRunnerHelper.deleteRunner(offlineGitHubRunner.name)
  }))
  console.info(chalk.green(`${offlineDeleted.map(result => {result}).length} offline github runners removed`))

  // scale down not busy runners
  if (downRate === 0) {
    console.info(chalk.green(`scale down rate is 0, nothing to do`))
    return
  }
  const notBusyRunners = await gitHubHelper.getNotBusyGcpGitHubRunners()
  const runners = notBusyRunners.filter( gitHubRunner => vms.map(vm => vm.name).includes(gitHubRunner.name) )
  const runnersToDelete = (downRate > 0) ? runners.slice(0, downRate) : runners.map(x => x)
  while ((runnersToDelete.length > 0) && (runners.length - runnersToDelete.length < idleCount)) {
    runnersToDelete.pop()
  }
  console.info(`${runnersToDelete.length} not busy gcp runners to delete`)
  const results = await Promise.all(runnersToDelete.map(async (gitHubRunner) => {
    await deleteRunnerHelper.deleteRunner(gitHubRunner.name)
  }))
  console.info(chalk.green(`scale down completed: ${results.filter(result => {result}).length} deleted, ${results.filter(result => {!result}).length} retained`))
}

async function scaleDownRunners (count) {
  console.info(`scale down ${count} runners...`)
  if (count === 0) {
    console.info(chalk.green(`scale down ${count}, nothing to do`))
    return
  }
  const runnersVms = await getRunnerHelper.getRunnersVms()
  const gcpGitHubRunners = await gitHubHelper.getGcpGitHubRunners()
  const gcpFilteredGitHubRunners = gcpGitHubRunners.filter(gitHubRunner => {
    return runnersVms.map(vm => vm.name).includes(gitHubRunner.name)
  })
  const nonBusyFilteredGcpGitHubRunners = gcpFilteredGitHubRunners.filter(gitHubRunner => {
    return gitHubRunner.busy === false
  })
  const runnersToDelete = nonBusyFilteredGcpGitHubRunners.slice(-count)
  console.info(`${runnersToDelete.length} non busy gcp runner(s) to delete`)
  await Promise.all(runnersToDelete.map(async (gitHubRunner) => {
    await deleteRunnerHelper.deleteRunner(gitHubRunner.name)
  }))
  console.info(chalk.green(`scale down ${count} runners succeeded`))
}
