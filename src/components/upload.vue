<template>
  <div>这里是上传组件</div>
  <div>
    <input type="file" @change="handleFileChange" />点我上传
    <el-button @click="handleUpload">点击上传</el-button>
    <el-button @click="handleMerge">点击合并</el-button>
  </div>
</template>

<script>
const CHUNK_SIZE = 1 * 1024 * 1024;
const SERVER_UPLOAD_URL = "http://localhost:3000/upload";
const SERVER_MERGE_URL = "http://localhost:3000/merge";

export default {
  data() {
    return {
      container: {
        file: null,
      },
      chunkData: []
    };
  },
  methods: {
    request({ url, method = "post", data, headers = {} }) {
      return new Promise((res, rej) => {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url, true)
        Object.keys(headers).forEach((key) => {
          xhr.setRequestHeader(key, headers[key]);
        });
        console.log(xhr);
        xhr.onload = (e) => {
          console.log(e);
          res({
            data: e.target.response,
          });
        };
        xhr.onerror = (e) => {
          console.log(e);
          rej(e);
        };
        xhr.send(data);
      });
    },
    handleFileChange(e) {
      // 获取上传文件列表对象
      let [file] = e.target.files;
      if (!file) {
        return;
      }
      Object.assign(this.$data, this.$options.data());
      this.container.file = file;
    },
    /**
     * 生成切片
     */
    createFileChunkList(file, size = CHUNK_SIZE) {
      let res = []
      if (!file) return res
      // 文件大小
      let totalSize = file.size;
      // let chunkLength = Math.ceil(totalSize / CHUNK_SIZE);
      let cur = 0
      while(cur < totalSize) {
        res.push({file: file.slice(cur, cur + size)})
        cur+=size
      }
      return res
    },
    /**
     * 点击上传切片
     */
    async handleUpload() {
      if (!this.container.file) return
      // 创建切片 Blob 列表
      const fileChunkList = this.createFileChunkList(this.container.file)
      this.chunkData = fileChunkList.map(({ file }, i) => ({
        hash: this.container.file.name + '_' + i,
        chunk: file
      }))
      // 上传切片
      await this.uploadChunks()
    },
    /**
     * 上传切片
     */
    async uploadChunks() {
      // const requestList = this.data
      if (!this.container.file) return
      const requestList = this.chunkData
        .map(({ chunk, hash }) => {
          const formData = new FormData();
          formData.append('chunk', chunk)
          formData.append('hash', hash)
          formData.append('filename', this.container.file.name)
          console.log(formData)
          return { formData }
        })
        .map(async ({ formData }) => {
          this.request({
            url: SERVER_UPLOAD_URL,
            data: formData
          })
        })

      // 并发切片
      await Promise.all(requestList)
    },

    handleMerge() {
      if (!this.container.file) {
        this.$message.error('请先选择文件')
        return
      }
      console.log(this.container.file)
      let {name} = this.container.file

      this.request({
        url: SERVER_MERGE_URL,
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          filename: name,
          size: CHUNK_SIZE
        })
      })
    }
  },
};
</script>

<style scoped>
</style>
