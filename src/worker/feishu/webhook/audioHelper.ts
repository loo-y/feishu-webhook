export const updateAudio = async ({
    accessToken,
    audioHexData,
    audioName,
    audioDuration,
}: {
    accessToken: string,
    audioHexData: string,
    audioName: string,
    audioDuration?: number,
}) => {
    if (!accessToken) {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }

    try{
    const url = `https://open.feishu.cn/open-apis/im/v1/files`
    const formData = new FormData()
    formData.append('file_type', 'opus')
    formData.append('file_name', audioName)
    if(audioDuration){
        formData.append('duration', audioDuration.toString())
    }
    // 将音频数据转换为二进制
    // @ts-ignore
    // const audioBuffer = Buffer.from(audioHexData, 'hex')
    // formData.append('file', audioBuffer)

    const audioBytes = hexToUint8Array(audioHexData);
    const audioBlob = new Blob([audioBytes], { type: 'audio/wav' }); // 或 'audio/opus'，根据实际格式
    formData.append('file', audioBlob, audioName);


    const uploadResponse = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            // 不要手动设置 Content-Type
        },
        body: formData,
    })
    const uploadData: Record<string, any> = await uploadResponse.json()
    console.log(`updateAudioResult---->`, uploadData)
    if (uploadData?.data?.file_key) {
        return {
            code: 200,
            message: 'success',
            file_key: uploadData.data?.file_key,
        }
    } else {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
    } catch (error) {
        console.log(`updateAudio error--->`, String(error))
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
}

const hexToUint8Array = (hex: string) => {
    if (hex.length % 2 !== 0) return ''
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
}