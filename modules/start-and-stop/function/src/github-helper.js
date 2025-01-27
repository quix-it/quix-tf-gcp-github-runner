const { GoogleAuth } = require('google-auth-library')
const auth = new GoogleAuth()
const createRunnerHelper = require('./create-runner-helper')
const runnerType = require('./runner-type')
const YAML = require('yaml')

module.exports.getGitHubRunners = getGitHubRunners
module.exports.getGcpGitHubRunners = getGcpGitHubRunners
module.exports.deleteGitHubRunner = deleteGitHubRunner
module.exports.filterGitHubRunner = filterGitHubRunner
module.exports.getGitHubRunnerByName = getGitHubRunnerByName
module.exports.checkGitHubRunnerStatus = checkGitHubRunnerStatus
module.exports.getNotBusyGcpGitHubRunnersCount = getNotBusyGcpGitHubRunnersCount
module.exports.getNotBusyGcpGitHubRunners = getNotBusyGcpGitHubRunners
module.exports.getAvailableGitHubRunners = getAvailableGitHubRunners
module.exports.gitHubGhostRunnerExists = gitHubGhostRunnerExists
module.exports.getOfflineGitHubRunners = getOfflineGitHubRunners
module.exports.listWorkflowRunsForRepo = listWorkflowRunsForRepo
module.exports.createRegistrationToken = createRegistrationToken
module.exports.getCheckRun = getCheckRun
module.exports.getJobLabels = getJobLabels

async function getGitHubRunners () {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'listSelfHostedRunnersForOrg',
      params: {
        org: process.env.GITHUB_ORG
      }
    }
  })
  return res.data.runners
}

async function getGcpGitHubRunners () {
  const gitHubRunners = await getGitHubRunners()
  const gcpGitHubRunners = gitHubRunners.filter(gitHubRunner => {
    return gitHubRunner.name.startsWith(createRunnerHelper.getRunnerNamePrefix(runnerType.default))
  })
  return gcpGitHubRunners
}

async function gitHubGhostRunnerExists () {
  const gitHubRunners = await getGitHubRunners()
  const gcpGitHubGhostRunners = gitHubRunners.filter(gitHubRunner => {
    return gitHubRunner.name.startsWith(createRunnerHelper.getRunnerNamePrefix(runnerType.ghost))
  })
  return gcpGitHubGhostRunners.length > 0
}

async function deleteGitHubRunner (gitHubRunnerId) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'deleteSelfHostedRunnerFromOrg',
      params: {
        org: process.env.GITHUB_ORG,
        runner_id: gitHubRunnerId
      }
    }
  })
}

function filterGitHubRunner (githubRunners, runnerName) {
  const [githubRunner] = githubRunners.filter(runner => {
    return runner.name === runnerName
  })
  if (githubRunner === undefined) {
    return null
  }
  return githubRunner
}

async function getGitHubRunnerByName (runnerName) {
  const githubRunners = await getGitHubRunners()
  const [githubRunner] = githubRunners.filter(runner => {
    return runner.name === runnerName
  })
  if (githubRunner === undefined) {
    return null
  }
  return githubRunner
}

async function checkGitHubRunnerStatus (runnerName, targetStatus) {
  const runnerGitHubState = await getGitHubRunnerByName(runnerName)
  if (runnerGitHubState === null) {
    console.log(`runner ${runnerName} github status is unknown`)
    return Promise.resolve(false)
  }
  const gitHubStatus = runnerGitHubState.status
  if (gitHubStatus !== targetStatus) {
    console.log(`runner ${runnerName} github status is ${gitHubStatus}`)
    return Promise.resolve(false)
  }
  console.log(`runner ${runnerName} github status is ${targetStatus}`)
  return Promise.resolve(true)
}

async function getNotBusyGcpGitHubRunnersCount () {
  const notBusyRunners = await getNotBusyGcpGitHubRunners()
  return notBusyRunners.length
}

async function getNotBusyGcpGitHubRunners () {
  const gcpGitHubRunners = await getGcpGitHubRunners()
  return gcpGitHubRunners.filter(gitHubRunner => {
    return ( gitHubRunner.busy === false)
  })
}

async function getOfflineGitHubRunners () {
  const gcpGitHubRunners = await getGcpGitHubRunners()
  const offlineGcpGitHubRunners = gcpGitHubRunners.filter(gcpGitHubRunner => {
    return gcpGitHubRunner.status === 'offline'
  })
  return offlineGcpGitHubRunners
}

async function getAvailableGitHubRunners () {
  const notBusyRunners = await getNotBusyGcpGitHubRunners()
  return notBusyRunners.filter(runner => {
    return runner.status !== 'offline'
  })
}

async function listWorkflowRunsForRepo (owner, repo) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'listWorkflowRunsForRepo',
      params: {
        owner: owner,
        repo: repo
      }
    }
  })
  return res.data.workflow_runs
}

async function listJobsForWorkflowRun (owner, repo, run_id) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'listJobsForWorkflowRun',
      params: {
        owner: owner,
        repo: repo,
        run_id: run_id
      }
    }
  })
  return res.data.jobs
}

async function getRepoContent (owner, repo, path, ref = null) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const optparams = {}
  if (ref != null) {
    optparams.ref = ref
  }
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'repos',
      function: 'getContent',
      params: {
        owner: owner,
        repo: repo,
        path: path,
        ...optparams
      }
    }
  })
  return res.data
}

async function createRegistrationToken () {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'createRegistrationTokenForOrg',
      params: {
        org: process.env.GITHUB_ORG
      }
    }
  })
  return res.data.token
}

async function getCheckRun (owner, repo, check_run_id) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'checks',
      function: 'get',
      params: {
        owner: owner,
        repo: repo,
        check_run_id: check_run_id
      }
    }
  })
  return res.data
}

async function getJobForWorkflowRun (owner, repo, job_id) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'getJobForWorkflowRun',
      params: {
        owner: owner,
        repo: repo,
        job_id: job_id
      }
    }
  })
  return res.data
}

async function getWorkflowRun (owner, repo, run_id) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'getWorkflowRun',
      params: {
        owner: owner,
        repo: repo,
        run_id: run_id
      }
    }
  })
  return res.data
}

async function getWorkflow (owner, repo, workflow_id) {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'getWorkflow',
      params: {
        owner: owner,
        repo: repo,
        workflow_id: workflow_id
      }
    }
  })
  return res.data
}

async function getContent (owner, repo, path, ref = "") {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const params = {
    owner: owner,
    repo: repo,
    path: path
  }
  if (ref && ref.length > 0) {
    params['ref'] = ref
  }
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'repos',
      function: 'getContent',
      params: params
    }
  })
  return res.data
}

async function getJobLabels(owner, repo, job_id) {
  const job = await getJobForWorkflowRun(owner, repo, job_id)
  const run = await getWorkflowRun(owner, repo, job.run_id)
  const wf = await getWorkflow(owner, repo, run.workflow_id)
  const file = await getContent(owner, repo, wf.path, job.head_sha)

  const ascii = Buffer.from(file.content, 'base64').toString('ascii')
  const workflow = YAML.parse(ascii)
  const labels = workflow['jobs'][job.name]['runs-on']

  return labels
}
