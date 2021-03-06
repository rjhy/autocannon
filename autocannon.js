#! /usr/bin/env node

'use strict'

const minimist = require('minimist')
const fs = require('fs')
const path = require('path')
const URL = require('url').URL
const help = fs.readFileSync(path.join(__dirname, 'help.txt'), 'utf8')
const run = require('./lib/run')
const track = require('./lib/progressTracker')

if (typeof URL !== 'function') {
  console.error('autocannon requires the WHATWG URL API, but it is not available. Please upgrade to Node 6.13+.')
  process.exit(1)
}

module.exports = run
module.exports.track = track

module.exports.start = start
module.exports.parseArguments = parseArguments

function parseArguments (argvs) {
  const argv = minimist(argvs, {
    boolean: ['json', 'n', 'help', 'renderLatencyTable', 'renderProgressBar', 'forever', 'idReplacement', 'excludeErrorStats'],
    alias: {
      connections: 'c',
      pipelining: 'p',
      timeout: 't',
      duration: 'd',
      amount: 'a',
      json: 'j',
      renderLatencyTable: ['l', 'latency'],
      method: 'm',
      headers: ['H', 'header'],
      body: 'b',
      servername: 's',
      bailout: 'B',
      input: 'i',
      maxConnectionRequests: 'M',
      maxOverallRequests: 'O',
      connectionRate: 'r',
      overallRate: 'R',
      reconnectRate: 'D',
      renderProgressBar: 'progress',
      title: 'T',
      version: 'v',
      forever: 'f',
      idReplacement: 'I',
      socketPath: 'S',
      excludeErrorStats: 'x',
      help: 'h'
    },
    default: {
      connections: 10,
      timeout: 10,
      pipelining: 1,
      duration: 10,
      reconnectRate: 0,
      renderLatencyTable: false,
      renderProgressBar: true,
      json: false,
      forever: false,
      method: 'GET',
      idReplacement: false,
      excludeErrorStats: false
    }
  })

  argv.url = argv._[0]

  // support -n to disable the progress bar and results table
  if (argv.n) {
    argv.renderProgressBar = false
    argv.renderResultsTable = false
  }

  if (argv.version) {
    console.log('autocannon', 'v' + require('./package').version)
    console.log('node', process.version)
    return
  }

  if (!argv.url || argv.help) {
    console.error(help)
    return
  }

  // if PORT is set (like by `0x`), target `localhost:PORT/path` by default.
  // this allows doing:
  //     0x --on-port 'autocannon /path' -- node server.js
  if (process.env.PORT) {
    argv.url = new URL(argv.url, `http://localhost:${process.env.PORT}`).href
  }
  // Add http:// if it's not there and this is not a /path
  if (argv.url.indexOf('http') !== 0 && argv.url[0] !== '/') {
    argv.url = `http://${argv.url}`
  }

  // check that the URL is valid.
  try {
    new URL(argv.url) // eslint-disable-line no-new
  } catch (err) {
    console.error(err.message)
    console.error('')
    console.error('When targeting a path without a hostname, the PORT environment variable must be available.')
    console.error('Use a full URL or set the PORT variable.')
    process.exit(1)
  }

  if (argv.input) {
    argv.body = fs.readFileSync(argv.input)
  }

  if (argv.headers) {
    if (!Array.isArray(argv.headers)) {
      argv.headers = [argv.headers]
    }

    argv.headers = argv.headers.reduce((obj, header) => {
      let index
      if (
        (index = header.indexOf('=')) > 0 ||
        (index = header.indexOf(':')) > 0
      ) {
        obj[header.slice(0, index)] = header.slice(index + 1)
        return obj
      } else throw new Error(`An HTTP header was not correctly formatted: ${header}`)
    }, {})
  }

  return argv
}

function start (argv) {
  if (!argv) {
    // we are printing the help
    return
  }

  const tracker = run(argv)

  tracker.on('done', (result) => {
    if (argv.json) {
      console.log(JSON.stringify(result))
    }
  })

  tracker.on('error', (err) => {
    if (err) {
      throw err
    }
  })

  // if not rendering json, or if std isn't a tty, track progress
  if (!argv.json || !process.stdout.isTTY) track(tracker, argv)

  process.once('SIGINT', () => {
    tracker.stop()
  })
}

if (require.main === module) {
  start(parseArguments(process.argv.slice(2)))
}
