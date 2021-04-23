<template>
  <div>
    <input type="file" @change="handleFileChange" />
    <el-button v-if="isUploading" @click="handlePause">停止上传</el-button>
    <el-button v-else @click="handleUpload">点击上传</el-button>
    <div class="progress-container">
      <div class="progress-container__item">
        <div class="progress-container__item--left">总进度:</div>
        <div class="progress-container__item--right">
          <el-progress
          :text-inside="true"
          :stroke-width="26"
          :percentage="fakeUploadPercentage"
          :color="customColorMethod"></el-progress>
        </div>
      </div>
      <template v-for="(item) in chunkData" :key="item.hash">
        <div class="progress-container__item">
          <div class="progress-container__item--left">{{ item.hash }}：</div>
          <div class="progress-container__item--right">
            <el-progress
            :text-inside="true"
            :stroke-width="16"
            :percentage="item.percentage"
            :color="customColorMethod"
            ></el-progress>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
const CHUNK_SIZE = 1 * 1024 * 1024;
const SERVER_UPLOAD_URL = "http://localhost:3000/upload";
const SERVER_MERGE_URL = "http://localhost:3000/merge";
const SERVER_VERIFY_URL = "http://localhost:3000/verify";

export default {
  data() {
    return {
      container: {
        file: null,
      },
      chunkData: [],
      requestList: [], // 正在进行上传的
      fakeUploadPercentage: 0,
      isUploading: false,
      customColorMethod(percentage) {
        if (percentage < 30) {
          return '#909399';
        } else if (percentage < 70) {
          return '#e6a23c';
        } else {
          return '#67c23a';
        }
      },
    };
  },
  computed: {
    /**
     * 计算总进度：
     * 算法：chunkData 的 item.percentage * size 求和，而 item.percentage 是通过 xhr.upload.onpergress 计算进度 ( e.loaded / e.totol )
     */
    uploadPercentage() {
      if (!this.container.file || !this.chunkData.length) return 0;
      const loaded = this.chunkData.map(item => item.chunk.size * item.percentage).reduce((acc, cur) => acc + cur)
      return parseInt((loaded / this.container.file.size).toFixed(2))
    }
  },
  watch: {
    uploadPercentage(now) {
      this.fakeUploadPercentage = now
    }
  },
  methods: {
    request({
      url,
      method = "post",
      data,
      headers = {},
      onProgress = e => e,
      requestList
    }) {
      return new Promise((resolve, rej) => {
        let xhr = new XMLHttpRequest();
        xhr.upload.onprogress = onProgress
        xhr.open(method, url, true)
        Object.keys(headers).forEach((key) => {
          xhr.setRequestHeader(key, headers[key]);
        });
        xhr.send(data);
        // xhr.onreadystatechange=()=>{
        //   if(xhr.readyState === 4) {
        //     if(xhr.status == 200) {
        //       let resp = 'response' in xhr ? xhr.response : xhr.responseText
        //       resolve(JSON.parse(resp))
        //     }
        //   }
        // }
        xhr.onload = (e) => {
          if(requestList && requestList.length) {
            const xhrIndex = requestList.findIndex(item => item === xhr)
            requestList.splice(xhrIndex, 1)
          }
          resolve(JSON.parse(e.target.response))
        };
        xhr.onerror = (e) => {
          rej(e);
        }

        requestList && requestList.push(xhr)
      })
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
        cur += size
      }
      return res
    },
    /**
     * 点击上传切片
     */
    async handleUpload() {
      if (!this.container.file) return
      this.isUploading = true
      // 创建切片 Blob 列表
      const fileChunkList = this.createFileChunkList(this.container.file)
      // spark-md5 计算当前文件 hash 值
      this.container.hash = await this.calculateHash(fileChunkList);
      let { shouldUpload, uploadedList } = await this.verifyUpload(this.container.file.name, this.container.hash)
      if (!shouldUpload) {
        this.fakeUploadPercentage = 100
        this.$message.success('上传成功')
        this.isUploading = false
        // TODO：进度条优化
        return
      }

      this.chunkData = fileChunkList.map(({ file }, i) => ({
        fileHash: this.container.hash,
        hash: this.container.hash + '_____' + i,
        chunk: file,
        index: i,
        percentage: uploadedList.includes(this.container.hash + '_____' + i) ? 100 : 0
      }))
      // 上传切片
      await this.uploadChunks(uploadedList)
    },
    /**
     * 上传切片
     */
    async uploadChunks(uploadedList = []) {
      if (!this.container.file) return
      const requestList = this.chunkData
        .filter(({ hash }) => !uploadedList.includes(hash))
        .map(({ chunk, hash, index, fileHash }) => {
          const formData = new FormData();
          formData.append('chunk', chunk)
          formData.append('hash', hash)
          formData.append('fileHash', fileHash)
          formData.append('filename', this.container.file.name)
          return { formData, index }
        })
        .map(async ({ formData, index }) =>
          this.request({
            url: SERVER_UPLOAD_URL,
            data: formData,
            onProgress: this.createProgressHandler(this.chunkData[index]),
            requestList: this.requestList
          })
        )

      // 并发切片
      await Promise.all(requestList)
      // 发送合并请求
      if (uploadedList.length + requestList.length === this.chunkData.length) {
        let result = await this.postMerge()
        if (result.code === 0) {
          this.$message.success(result.message)
          this.isUploading = false
        } else {
          this.$message.error(result.message)
          this.isUploading = false
        }
      }
    },

    async postMerge() {
      if (!this.container.file) {
        this.$message.error('请先选择文件')
        return
      }
      let {name} = this.container.file
      return this.request({
        url: SERVER_MERGE_URL,
        headers: {
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          fileHash: this.container.hash,
          filename: name,
          size: CHUNK_SIZE
        })
      })
    },

    /**
     * 为每个上传切片创建一个进度事件监听
     */
    createProgressHandler(item) {
      return e => {
        console.log(e.loaded, e.total)
        item.percentage = parseInt(String( (e.loaded / e.total) * 100 ))
      }
    },

    /**
     * 计算文件hash
     * @step 这里了解到了 Worker 只能访问网络文件,不能访问本地文件， 所以 hash.js 需要放在 pulic 中，因为 pulic 目录在开发环境会随着 deveServer 开启一个本地服务
     */
    calculateHash(fileChunkList) {
      return new Promise((resolve, reject) => {
        console.log(resolve, reject)
        this.container.worker = new Worker("hash.js")
        this.container.worker.postMessage({ fileChunkList })
        this.container.worker.onmessage = e => {
          const { percentage, hash } = e.data
          this.hashPercentage = percentage;
          if (hash) {
             resolve(hash);
          }
        }
      })
    },

    /**
     * 发起验证文件是否已经传过
     */
    async verifyUpload(filename, fileHash) {
      const { data } = await this.request({
        url: SERVER_VERIFY_URL,
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          filename,
          fileHash
        })
      })
      return data
    },

    handlePause() {
      this.requestList.forEach(xhr => xhr ? xhr.abort() : '')
      this.requestList = []
      this.isUploading = false
    }
  },
};
</script>

<style scoped>
/* .progress-container {
  width: 400px;
} */

.progress-container__item {
  display: flex;
  margin: 5px
}

.progress-container__item--right {
  width: 100%;
}
</style>
