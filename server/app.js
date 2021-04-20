const express = require('express')
const PROT = 3000
const app = express()
const logger = require('morgan')
const cookieParser = require('cookie-parser')
const multiparty = require('multiparty')
const fse = require('fs-extra')
const path = require('path')

const UPLOAD_DIR = path.resolve(__dirname, ".", "uploadDir"); // 大文件存储目录

app.use(logger())
app.use(cookieParser())

/**
 * 处理跨域
 */
app.all('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Content-Type', 'application/json;charset=utf-8');
  res.header('Access-Control-Allow-Credentials','true');
  next()
})

app.options('*', (req, res, next) => {
  res.status = 200
  res.end()
})

app.get('/', (req, res) => {
  res.send('这里是上传页面')
})

/**
 * 上传的主要接口
 * @step 此处发生过的事情：1 跨域问题 通过 app.all() 写 CORS 跨域头处理
 * @step 2. 客户端发送 Http 请求的时候没有带上 http
 * @step 3. 客户端发送 Http 请求的时候带上了 https SSL/TLS 导致没有发送成功
 * @step 4. Access-Control-Allow-Origin 写错 通过 chrome 提示发现了
 */
app.post('/upload', (req, res, next) => {
  // TODO: 这里斜获取上传数据的逻辑
  let form = new multiparty.Form()
  form.parse(req, async (err, fields, files) => {
    if (err) {
      next(err)
      return
    }
    console.log(fields)
    const [chunk] = files.chunk
    const [hash] = fields.hash
    const [filename] = fields.filename
    const chunkDir = path.resolve(UPLOAD_DIR, filename)

    // 切片目录不存在即创建目录
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir)
    }
    await fse.move(chunk.path, `${chunkDir}/${hash}`);
    res.send("received file chunk")
  })
  // res.json({
  //   data: '',
  //   code: 0,
  //   message: 'ok'
  // })
})

app.listen(PROT, () => {
  console.log(`serve has working on localhost port ${PROT}`)
})
