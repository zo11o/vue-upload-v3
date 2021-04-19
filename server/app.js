const express = require('express')
const PROT = 3000
const app = express()
const logger = require('morgan')
const cookieParser = require('cookie-parser')

// function hanldeUpload(req, res) {
//   console.log(req, res)
// }
app.use(logger())
app.use(cookieParser())

app.get('/', (req, res) => {
  res.send('这里是上传页面')
})

app.get('/upload', (req, res) => {
  res.send('hello')
})

function logOriginalUrl (req, res, next) {
  console.log('Request URL:', req.originalUrl)
  next()
}
function logMethod (req, res, next) {
  console.log('Request Type:', req.method)
  next()
}
var logStuff = [logOriginalUrl, logMethod]
app.get('/user/:id', logStuff, function (req, res, next) {
  res.send('User Info')
})

app.listen(PROT, () => {
  console.log(`serve has working on localhost port ${PROT}`)
})
