const { GoogleAuth } = require('google-auth-library')
const auth = new GoogleAuth()

module.exports.createRemoveToken = createRemoveToken

async function createRemoveToken () {
  const githubApiFunctionUrl = process.env.GITHUB_API_TRIGGER_URL
  const client = await auth.getIdTokenClient(githubApiFunctionUrl)
  const res = await client.request({
    url: githubApiFunctionUrl,
    method: 'POST',
    data: {
      scope: 'actions',
      function: 'createRemoveTokenForOrg',
      params: {
        org: process.env.GITHUB_ORG
      }
    }
  })
  return res.data.token
}
