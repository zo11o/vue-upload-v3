<template>
  <div>
    <h1>用 Vue3 做一个支持断点续传，支持暂停的大文件上传组件演示</h1>
    <h2>上传原理 和 步骤</h2>
    <ol>
      <li>主要是用了 Blod.prototype.slice 对文件进行切片</li>
      <li>上传按钮: 修改文件后点击上传 `handleUpload`</li>
      <li>`createChunkFileList` 创建切片列表</li>
      <li>利用 `formData.append()` 构建上传 data</li>
      <li>发起合并请求。利用后端 ReadStream 、 WriteStream 、 和 readStream.pipe(writeSteam) 实现数据合并</li>
      <li>加入上传进度 xhr.upload.onprogress </li>
      <li>
        通过 spark-md5 计算文件hash，保证文件唯一性，
        考虑到计算可能会引起卡顿，所以讲计算进程放到 Worker 进程去，
        通过 new FileReader() 读取文件，
        将本地文件转化为二进制数组的形式在 readstream.onload 事件中推入 spark.appen(e.target.result)
        在全部文件加载了之后用 spark.end 获取hash 值，通过 self.postMessage() 告诉主线程
      </li>
      <li>断点续传</li>
      <li></li>
    </ol>
    <div>
      <upload></upload>
    </div>
  </div>
</template>

<script>
import Upload from './components/upload'

export default {
  name: 'App',
  components: {
    Upload
  }
}
</script>

<style>
</style>
