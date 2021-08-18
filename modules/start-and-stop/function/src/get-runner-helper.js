const Compute = require('@google-cloud/compute')
const compute = new Compute()
const zone = compute.zone(require('./google-settings').zone())
const env = require('./google-settings').env()

module.exports.getRunnersVms = getRunnersVms
module.exports.getRunnerVmByName = getRunnerVmByName
module.exports.getAgedRunnersVms = getAgedRunnersVms
module.exports.getVMAgeSeconds = getVMAgeSeconds

async function getRunnersVms (minAge = 0) {
  const filter = `labels.env=${env}`
  const options = {
    filter: filter
  }
  const [vms] = await compute.getVMs(options)

  if (minAge > 0) {
    const items = await Promise.all(
      vms.map( async (vm) => {
        const age = await getVMAgeSeconds(vm)
        return [ vm, age ]
      })
    )
    return Promise.resolve(items.filter( vm => vm[1] > minAge).map( vm => vm[0] ))
  } else {
    return Promise.all(vms)
  }
}

async function getRunnerVmByName (vmName) {
  return zone.vm(vmName)
}

async function getVMAgeSeconds(vm) {
  const [metadata] = await vm.getMetadata()
  const startDate = Date.parse(metadata.creationTimestamp)
  return (new Date() - startDate) / 1000
}

async function getAgedRunnersVms () {
  const vms = await getRunnersVms()
  const vmsAgeMinutes = await Promise.all(vms.map(async vm => {
    const [metadata] = await vm.getMetadata()
    const startDate = Date.parse(metadata.creationTimestamp)
    const now = new Date()
    const vmAgeMinutes = (now - startDate) / 1000 / 60
    return vmAgeMinutes
  }))
  const agedVms = vms.filter((vm, index, array) => {
    return vmsAgeMinutes[index] > 24 * 60 // 1 day
  })
  return agedVms
}
