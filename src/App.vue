<template>
  <div>
    <h1>文用 Vue3 做一个支持断点续传，支持暂停，的大文件上传组件演示</h1>
    <h2>首先做一下原来的解释</h2>
    <ol>
      <li>主要是用了 Blod.prototype.slice 对文件进行切片</li>
      <li>上传按钮: 修改文件后点击上传 `handleUpload`</li>
      <li>`createChunkFileList` 创建切片列表</li>
      <li>利用 `formData.append()` 构建上传 data</li>
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
