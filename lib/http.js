
var start = Date.now()

var http = require('http')
var domain = require('domain')
var cluster = require('cluster')

var args = process.argv

var app = require(args[args.length - 1])
var callback = app.callback()

var server = http.createServer()
server.on('request', handler)
server.on('checkContinue', function (req, res) {
  req.checkContinue = true
  handler(req, res)
})

// custom koa settings
// defaults to http://nodejs.org/api/http.html#http_server_maxheaderscount
server.maxHeadersCount = app.maxHeadersCount || 1000
server.timeout = app.timeout || 120000

server.listen(app.port, function (err) {
  if (err) throw err
  console.log('%s listening on port %s, started in %sms',
    app.name || 'koa app',
    this.address().port,
    Date.now() - start)
})

// don't try to close the server multiple times
var closing = false
process.on('SIGTERM', close)
process.on('SIGINT', close)

process.on('exit', function () {
  console.log('process exiting')
})

// http://nodejs.org/api/domain.html
function handler(req, res) {
  var d = domain.create()

  d.on('error', function (err) {
    console.error(err.stack)
    close(1)

    try {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain')
      res.end('Oops, sorry!')
    } catch (err) {
      console.error(err.stack)
    }
  })

  d.add(req)
  d.add(res)

  d.run(function () {
    callback(req, res)
  })
}

function close(code) {
  if (closing) return
  console.log('closing worker %s', cluster.worker.id)
  closing = true

  // to do: make this an option
  var killtimer = setTimeout(function () {
    process.exit(code || 0)
  }, 30000)

  // http://nodejs.org/api/timers.html#timers_unref
  killtimer.unref()
  server.close()
  cluster.worker.disconnect()
}
