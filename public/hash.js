self.importScripts('./spark-md5.js')

self.onmessage = e => {
  console.log(e)
  const { fileChunkList } = e.data
  const spark = new self.SparkMD5.ArrayBuffer()
  let percentage = 0
  let count = 0

  const loadNext = index => {
    const reader = new FileReader()
    reader.readAsArrayBuffer(fileChunkList[index].file);
    reader.onload = e => {
      count++;
      spark.append(e.target.result)
      if (count === fileChunkList.length) {
        self.postMessage({
          percentage: 100,
          hash: spark.end()
        })
      } else {
        percentage += 100 / fileChunkList.length;
        self.postMessage({
          percentage
        })

        // 递归计算下一切片
        loadNext(count)
      }
    }
  }

  loadNext(0)

  console.log(self.SparkMD5)
}
