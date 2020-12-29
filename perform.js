
let { Octokit } = require('@octokit/rest')
let fetchArticle = require('./src/fetchArticle')
let renderToMarkdown = require('./src/renderToMarkdown')

require('dotenv').config()

let TOKEN = process.env.TOKEN
let REPOSITORY = process.env.REPOSITORY
let EVENT = process.env.EVENT
let [OWNER, REPO] = REPOSITORY.split('/')

let octokit = new Octokit({
  auth: TOKEN
})

function checkSubmission(body) {
  //if (body.split("\n").length > 1) return false
  return true
}

async function getTasks() {
  if (EVENT) {
    return [JSON.parse(EVENT).issue]
  } else {
    let { data } = await octokit.issues.listForRepo({
      owner: OWNER,
      repo: REPO,
      state: 'open'
    })
    return data
  }
}

async function performTasks(list) {
  let promises = list.map(async (issue) => {
    try {
      if (!checkSubmission(issue.body)) {
        throw "Invalid submission"
      }
      let articleData = await fetchArticle(issue.body)
      await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: issue.number,
        body: renderToMarkdown(articleData)
      })
      await octokit.issues.update({
        owner: OWNER,
        repo: REPO,
        issue_number: issue.number,
        state: 'closed',
        title: articleData.title,
        labels: ['fetched']
      })
    } catch(error) {
      await octokit.issues.createComment({
        owner: OWNER,
        repo: REPO,
        issue_number: issue.number,
        body: `错误 ${error.toString()}`
      })
      await octokit.issues.update({
        owner: OWNER,
        repo: REPO,
        issue_number: issue.number,
        state: 'closed',
        labels: ['error']
      })
      throw error
    }
  })

  await Promise.all(promises)
}

async function perform() {
  let tasks = await getTasks()
  await performTasks(tasks)
}

perform()