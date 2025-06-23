

export const uploadImage = async (
    accessToken: string,
    imageUrl: string
): Promise<{ code: number; message: string; image_key?: string }> => {
    if (!accessToken) {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
    const response = await fetch(imageUrl)
    const imageBlob = await response.blob()

    // 构造 multipart/form-data
    const formData = new FormData()
    formData.append('image_type', 'message')
    formData.append('image', imageBlob, 'image.jpg')

    const uploadResponse = await fetch('https://open.feishu.cn/open-apis/im/v1/images', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            // 不要手动设置 Content-Type
        },
        body: formData,
    })
    const uploadData: Record<string, any> = await uploadResponse.json()
    if (uploadData?.data?.image_key) {
        return {
            code: 200,
            message: 'success',
            image_key: uploadData.data?.image_key,
        }
    } else {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
}
