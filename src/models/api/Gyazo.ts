import { UCLogger } from "@models/utils"

// config.js
declare const config:any             //  from ../../config.js included from index.html

const miscLog = UCLogger.getByFeature("misc");

export interface GayazoReturnType{
  url: string,
  size: [number, number],
}
export function uploadToGyazo(imageData: Blob):Promise<string> {
  const promise = new Promise<string>((resolutionFunc, rejectionFunc) => {
    const formData = new FormData()
    // formData.append('access_token', 'e9889a51fca19f2712ec046016b7ec0808953103e32cd327b91f11bfddaa8533')
    // IMI access_token
    formData.append('access_token', config.gyazo.access_token)
    formData.append('imagedata', imageData)
    fetch('https://upload.gyazo.com/api/upload', {method: 'POST', body: formData})
    .then(response => response.json())
    .then((responseJson) => {
      // miscLog.info("URL = " + responseJson.url)
      //  To do, add URL and ask user position to place the image
      resolutionFunc(responseJson.url)
    })
    .catch((error) => {
      if (`${error}` === 'TypeError: Failed to fetch'){
        rejectionFunc('type')
      }else{
        miscLog.error(error)
        rejectionFunc('')
      }
    })
  })

  return promise
}

export function getImageSize(url: string) {
  const promise = new Promise<[number, number]>((resolutionFunc, rejectionFunc) => {
    miscLog.info("getImageSize url = " + url)
    const img = new Image()
    img.src = url
    img.onload = () => {
      const size:[number, number] = [img.width, img.height]
      miscLog.info("size = " + size)
      resolutionFunc(size)
    }
    img.onerror = () => { rejectionFunc([0, 0]) }
  })

  return promise
}
