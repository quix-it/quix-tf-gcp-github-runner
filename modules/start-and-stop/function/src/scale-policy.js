const chalk = require('chalk')
const gitHubHelper = require('./github-helper')
const getRunnerHelper = require('./get-runner-helper')
const scaleHelper = require('./scale-helper')
const scalePolicySettings = require('./scale-policy-settings')
const parser = require('cron-parser')
const googleSettings = require('./google-settings')
const moment = require('moment-timezone')

// module.exports.scaleUp = scaleUp
module.exports.scaleDown = scaleDown

module.exports.smartScaleUp = smartScaleUp

async function smartScaleUp(params = {}) {
  const maxLoops = 3
  const waitForMillis = 5000
  const runners = await getRunnerHelper.getRunnersVms()
  const runnersCount = runners.length
  const maxRunnersCount = scalePolicySettings.upMax()
  const upRate = scalePolicySettings.upRate()

  const owner = params.owner
  const repo = params.repo
  const check_run_id = params.check_run_id
  var loop = params.loop || 0
  if (maxRunnersCount - runnersCount <= 0) {
    console.log(`Unable to scale up: runners count limit exceeded (${maxRunnersCount})`)
  } else {
    loop++
    gitHubHelper.getAvailableGitHubRunners().then( (available) => {
      if(available.length < upRate) {
        // scale up
        const scaleUpCount = Math.min(maxRunnersCount - runnersCount, upRate - available.length)
        console.log(chalk.yellow(`Current amount of runners: ${runnersCount}. Available: ${available.length}. Scaling up by ${scaleUpCount} runners.`))
        scaleHelper.scaleUpRunners(scaleUpCount).then(() => {
          console.log(chalk.green(`Scale up completed.`))
        })
      } else if (loop >= maxLoops) {
        console.log(chalk.red(`Scale up retried ${loop} times for (${owner}, ${repo}, ${check_run_id}): giving up.`))
      } else if (owner && repo && check_run_id) {
        // wait and check request status
        console.log(chalk.yellow(`Found ${available.length} available runners. Waiting ${waitForMillis} ms for one of them to pick up the current job.`))
        setTimeout(() => {
          gitHubHelper.getCheckRun(owner, repo, check_run_id).then( (checkrun) => {
            if (checkrun.status == 'queued') {
              // call smartScaleUp again
              console.log(chalk.yellow(`Check run ${check_run_id} is still in 'queued' status.`))
              smartScaleUp({owner: owner, repo: repo, check_run_id: check_run_id, loop: loop})
            }
          })
        }, waitForMillis)
      } else {
        console.log(chalk.green(`No scale up needed. ${available.length} available runners.`))
      }
    })  
  }
}

async function scaleUp () {
  console.log('scale up...')
  const nonBusyRunnersCount = await gitHubHelper.getNotBusyGcpGitHubRunnersCount()
  const upRate = scalePolicySettings.upRate()
  if (nonBusyRunnersCount < upRate) {
    console.log(`non busy runners (${nonBusyRunnersCount}) < threshold (${upRate}), evaluate scale up possibility`)
    const runnersToCreateTargetCount = upRate - nonBusyRunnersCount
    const runners = await getRunnerHelper.getRunnersVms()
    const runnersCount = runners.length
    const maxRunnersCount = scalePolicySettings.upMax()
    const availableRunnersSlotForScaleUp = maxRunnersCount - runnersCount
    console.log(`runners to create to meet target count = ${runnersToCreateTargetCount}, available runners slot for scale up = ${availableRunnersSlotForScaleUp}`)
    const scaleUpCount = Math.min(runnersToCreateTargetCount, availableRunnersSlotForScaleUp)
    await scaleHelper.scaleUpRunners(scaleUpCount)
  } else {
    console.log(`non busy runners (${nonBusyRunnersCount}) >= threshold (${scalePolicySettings.upRate()}), nothing to do`)
  }
  console.log(chalk.green('scale up done'))
}

async function scaleDown () {
  console.log('scale down...')
  const nonBusyRunnersCount = await gitHubHelper.getNotBusyGcpGitHubRunnersCount()
  if (nonBusyRunnersCount > 0) {
    console.log(`non busy runners ${nonBusyRunnersCount} > 0, evaluate scale down possibility`)
    var availableRunnersForScaleDown
    if (scalePolicySettings.idleCount() > 0 && isDateInIdlePeriod(moment())) {
      availableRunnersForScaleDown = Math.max(0, nonBusyRunnersCount - scalePolicySettings.idleCount())
      console.log(`in idling range, trying to keep ${scalePolicySettings.idleCount()} idle runner(s)`)
    } else {
      availableRunnersForScaleDown = nonBusyRunnersCount
      console.log('outside idling range')
    }
    const scaleDownRate = scalePolicySettings.downRate()
    console.log(`scale down rate = ${scaleDownRate}, available runners for scale down = ${availableRunnersForScaleDown}`)
    const scaleDownCount = Math.min(availableRunnersForScaleDown, scaleDownRate)
    await scaleHelper.scaleDownRunners(scaleDownCount)
  } else {
    console.log(`non busy runners count (${nonBusyRunnersCount}) is 0, nothing to do`)
  }
  console.log(chalk.green('scale down done'))
}

function isDateInIdlePeriod (date) {
  const dateOnGivenTimeZone = date.tz(googleSettings.timezone())
  const localDateTime = dateOnGivenTimeZone.format('YYYY-MM-DD HH:mm')
  const options = {
    currentDate: localDateTime,
    tz: googleSettings.timezone()
  }
  const cronExpression = parser.parseExpression(
    scalePolicySettings.idleSchedule(),
    options
  )
  const next = moment(cronExpression.next().toDate())
  const diffMinutes = Math.abs(next.diff(date, 'minutes'))
  return diffMinutes <= 1
}
