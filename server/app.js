const express = require('express')
const PROT = 3000
const app = express()
const logger = require('morgan')

// function hanldeUpload(req, res) {
//   console.log(req, res)
// }
app.use(logger())

app.get('/', (req, res) => {
  res.send('这里是上传页面')
})

app.get('/upload', (req, res) => {
  res.send('hello')
})

app.listen(PROT, () => {
  console.log(`serve has working on localhost port ${PROT}`)
})
