const express = require('express')
const PROT = 3000
const app = express()
const logger = require('morgan')
const cookieParser = require('cookie-parser')
const multiparty = require('multiparty')
const fse = require('fs-extra')
const path = require('path')

const UPLOAD_DIR = path.resolve(__dirname, ".", "uploadDir"); // 大文件存储目录
// const UPLOAD_UPLOAD_DIR = path.resolve(__dirname, ".", "uploadDir", "upload"); // 大文件存储目录
const CHUNK_DIR_PREFIX = 'dir__'

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
  res.header('Access-Control-Allow-Credentials', 'true');
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
  // 这里斜获取上传数据的逻辑
  let form = new multiparty.Form()
  form.parse(req, async (err, fields, files) => {
    if (err) {
      next(err)
      return
    }
    const [chunk] = files.chunk
    const [hash] = fields.hash
    const [filename] = fields.filename
    const chunkDir = path.resolve(UPLOAD_DIR, CHUNK_DIR_PREFIX + filename)

    // 切片目录不存在即创建目录
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir)
    }
    await fse.move(chunk.path, `${chunkDir}/${hash}`);
    res.send("received file chunk")
  })
})

const resolvePath = async (req) => {
  return new Promise((resolve, reject) => {
    let chunks = ''
    req.on('data', data => {
      chunks += data
    })
    req.on('end', () => {
      resolve(JSON.parse(chunks))
    })
  })
}

/**
 * 合并切片
 */
const mergeChunkData = async (filePath, filename, size) => {
  const chunkDir = path.resolve(UPLOAD_DIR, `${CHUNK_DIR_PREFIX + filename}`)
  const chunkPaths = fse.readdirSync(chunkDir)
  // 排序
  chunkPaths.sort((a, b) => a.split('_')[1] - b.split('_')[1])
  let promiseArr = chunkPaths.map((chunkPath, index) => {
    let _fp = path.resolve(chunkDir, chunkPath)
    return pipeStream(_fp, fse.createWriteStream(path.resolve(UPLOAD_DIR, filename), {
      start: index * size,
      end: (index + 1) * size
    }))
  })

  await Promise.all(promiseArr)
  fse.rmdirSync(chunkDir)
}

const pipeStream = async (path, writeStream) => {
  return new Promise(resolve => {
    const readStream = fse.createReadStream(path)
    readStream.on('end', function () {
      // console.log(data)
      fse.unlinkSync(path)
      resolve()
    })
    readStream.pipe(writeStream)
  })

}

/**
 * 发起合并请求
 * @step createReadStream(writStream) 文档和文件同名.导致不写 不会触发 data 事件
 * @step size 为每个切片的大小 而不是文件总大小
 */
app.post('/merge', async (req, res) => {
  let data = await resolvePath(req)
  const { filename, size } = data
  const filePath = path.resolve(UPLOAD_DIR, `${CHUNK_DIR_PREFIX + filename}`)
  // 合并切片
  await mergeChunkData(filePath, filename, size)
  res.json({
    code: 0,
    message: '操作成功'
  })
})

app.listen(PROT, () => {
  console.log(`serve has working on localhost port ${PROT}`)
})
