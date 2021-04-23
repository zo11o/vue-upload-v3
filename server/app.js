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
// 提取后缀名
const extractExt = filename => filename.slice(filename.lastIndexOf("."), filename.length)

/**
 * 处理跨域
 */
app.all('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Content-Type', 'application/json;charset=utf-8');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.json({
      data: '',
      message: 'ok',
      code: 0
    })
    return
  }
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
    const [fileHash] = fields.fileHash
    // const [filename] = fields.filename
    const chunkDir = path.resolve(UPLOAD_DIR, CHUNK_DIR_PREFIX + fileHash)

    // 切片目录不存在即创建目录
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir)
    }
    await fse.move(chunk.path, `${chunkDir}/${hash}`);
    res.json({
      data: '',
      message: "received file chunk",
      code: 0
    })
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
const mergeChunkData = async (filePath, filename, fileHash ,size) => {
  const chunkDir = path.resolve(UPLOAD_DIR, `${CHUNK_DIR_PREFIX + fileHash}`)
  const chunkPaths = fse.readdirSync(chunkDir)
  // 排序
  chunkPaths.sort((a, b) => a.split('_____')[1] - b.split('_____')[1])
  const mergeFileName = fileHash + `[${filename}]` + extractExt(filename)
  let promiseArr = chunkPaths.map((chunkPath, index) => {
    let _fp = path.resolve(chunkDir, chunkPath)
    return pipeStream(_fp, fse.createWriteStream(path.resolve(UPLOAD_DIR, mergeFileName), {
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
 * 获取已经上传的文件目录
 * @param {String} fileHash 文件hash
 */
const createUploadedList = async (fileHash) => {
  return fse.existsSync(path.resolve(UPLOAD_DIR, `${CHUNK_DIR_PREFIX + fileHash}`))
    ? await fse.readdir(path.resolve(UPLOAD_DIR, `${CHUNK_DIR_PREFIX + fileHash}`))
    : []
}

/**
 * 发起合并请求
 * @step createReadStream(writStream) 文档和文件同名.导致不写 不会触发 data 事件
 * @step size 为每个切片的大小 而不是文件总大小
 */
app.post('/merge', async (req, res) => {
  let data = await resolvePath(req)
  const { filename, size, fileHash } = data
  const filePath = path.resolve(UPLOAD_DIR, `${CHUNK_DIR_PREFIX + fileHash}`)
  // 合并切片
  await mergeChunkData(filePath, filename, fileHash, size)
  res.json({
    code: 0,
    message: '操作成功'
  })
})

app.post('/verify', async (req, res) => {
  let data = await resolvePath(req)
  const { filename, fileHash } = data
  const ext = extractExt(filename)
  const filePath = path.resolve(UPLOAD_DIR, `${fileHash}[${filename}]${ext}`)
  console.log(filePath)
  if (fse.existsSync(filePath)) {
    res.json({
      code: 0,
      message: 'ok',
      data: {
        shouldUpload: false
      }
    })
  } else {
    res.json({
      code: 0,
      message: 'ok',
      data: {
        shouldUpload: true,
        uploadedList: await createUploadedList(fileHash)
      }
    })
  }
})

app.listen(PROT, () => {
  console.log(`serve has working on localhost port ${PROT}`)
})
