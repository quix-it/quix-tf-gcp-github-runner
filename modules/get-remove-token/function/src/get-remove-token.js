const GithubHelper = require('./github-helper.js')

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 *                     More info: https://expressjs.com/en/api.html#req
 * @param {Object} res Cloud Function response context.
 *                     More info: https://expressjs.com/en/api.html#res
 */
module.exports.getRemoveToken = async (req, res) => {
  try {
    console.log(`Received request from ${req.ips}`)
    validateRequest(req)
    const token = await GithubHelper.createRemoveToken()
    res.status(200).send(token)
  } catch (err) {
    console.log(err)
    res.status(400).send(err)
  }
}

function validateRequest (request) {
  if (request.method !== 'GET') {
    throw new Error('Only POST method supported')
  }
  return request
}
