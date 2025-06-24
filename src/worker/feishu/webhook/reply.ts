import { getAccessToken, createUUID, isAtMessage } from './access'
import { uploadImage } from './imageHelper'
import { getChatMessage, createImage, getSoundMessage as getSoundMessageBySiliconFlow } from '../../siliconflow/chat'
import { updateAudio } from './audioHelper'
import { sendGroupMessage } from './group'


export const replyMessage = async (messageType: string, messageContent: string, message_id: string, accessToken: string) => {
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${message_id}/reply`
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                content: messageContent,
                msg_type: messageType,
                reply_in_thread: false,
                uuid: createUUID(),
            }),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        })
        const data: Record<string, any> = await response.json()
        return data
    } catch (error) {
        console.log(`error--->`, String(error))
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
}

export const replyTextMessage = async (
    messageText: string,
    message_id: string,
    envConfig: Record<string, string>
): Promise<Record<string, any>> => {
    const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey } = envConfig || {}
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret })
    if (!accessToken) {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }

    const chatMessage = await getChatMessage({
        message: messageText,
        token: siliconflow_apikey,
        modelName: 'Qwen/Qwen3-235B-A22B',
    })
    console.log(`chatMessage---->`, chatMessage)

    await replyMessage(
        'text',
        JSON.stringify({ text: chatMessage ? chatMessage : `I have received your message: ${messageText}` }),
        message_id,
        accessToken
    )
    return {
        code: 200,
        message: 'success',
    }
}

// 发送图片消息， 需要先上传图片，获取图片的key，然后以此key发送图片消息
export const replyImageMessage = async (
    messageText: string,
    message_id: string,
    envConfig: Record<string, string>
): Promise<Record<string, any>> => {
    const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey } = envConfig || {}
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret })
    if (!accessToken) {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }

    const imageResult = await createImage({
        prompt: messageText,
        token: siliconflow_apikey,
    })
    if (!imageResult?.images?.[0]?.url) {
        await replyMessage('text', `I have received your message: ${messageText}`, message_id, accessToken)
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }

    const uploadImageResult = await uploadImage(accessToken, imageResult.images[0].url)
    console.log(`uploadImageResult---->`, uploadImageResult)

    if (uploadImageResult.image_key) {
        // 发送图片消息
        await replyMessage('image', JSON.stringify({ image_key: uploadImageResult.image_key }), message_id, accessToken)
    } else {
        await replyMessage('text', `I have received your message: ${messageText}`, message_id, accessToken)
    }
    return {
        code: 200,
        message: 'success',
    }
}

export const replyAudioMessage = async ({
    messageText,
    voiceId,
    message_id,
    envConfig,
}: {
    messageText: string,
    voiceId: string,
    message_id: string,
    envConfig: Record<string, string>
}): Promise<Record<string, any>> => {
    const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey } = envConfig || {}
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret })
    if (!accessToken) {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }

    const soundMessage: Record<string, any> | null = (siliconflow_apikey ? await getSoundMessageBySiliconFlow({ text: messageText, token: siliconflow_apikey, voiceId: voiceId }) : null)

    if(soundMessage?.success){
        const uuid = createUUID()
        console.log(`soundMessage---->`, `success`)
        const updateAudioResult = soundMessage?.audioHex ? await updateAudio({
            accessToken,
            audioHexData: soundMessage.audioHex,
            audioName: `water_reminder_${uuid}.wav`,
            audioDuration: soundMessage.audioSeconds,
        }) : await updateAudio({
            accessToken,
            audioArrayBuffer: soundMessage.audioBuffer,
            audioName: `water_reminder_${uuid}.wav`,
            // audioDuration: soundMessage.audioSeconds,
        })

        console.log(`updateAudioResult---->`, updateAudioResult)
        if(updateAudioResult?.file_key){
            
            const audioResult = await replyMessage(
                'audio',
                JSON.stringify({ file_key: updateAudioResult.file_key }),
                message_id,
                accessToken
            )
            return audioResult
        }
    }

    return {
        audioCode: -1,
        audioMessage: 'Internal Server Error',
    }
}