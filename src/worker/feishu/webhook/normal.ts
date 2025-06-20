import { Context } from 'hono'
import { getAccessToken, createUUID, isAtMessage } from './access'
import { getChatMessage, createImage } from '../../siliconflow/chat'
import { getSoundMessage } from '../../minimax/index'

export interface Env {
    rainy_night_appId: string
    rainy_night_appSecret: string
    siliconflow_apikey: string
    minimax_group_id: string
    minimax_apikey: string
}

export const requestGroupMessage = async (c: Context) => {
    const envConfig = c.env || {}
    const { rainy_night_appId, rainy_night_appSecret, minimax_group_id, minimax_apikey } = envConfig || {}
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret })
    if (!accessToken) {
        return c.json({
            code: 500,
            message: 'Internal Server Error',
        })
    }
    let messageText, group_id, attachAudio = false;
    if (c.req.method === 'GET') {
        const queryParams = c.req.query()
        messageText = queryParams?.message_text
        group_id = queryParams?.group_id
        attachAudio = queryParams?.attach_audio == "1"
    } else if (c.req.method === 'POST') {
        const body = await c.req.json()
        messageText = body?.messageText
        group_id = body?.groupId
        attachAudio = body?.attachAudio == true
    }

    if (!messageText || !group_id) {
        return c.json({
            code: 500,
            message: 'Internal Server Error',
        })
    }
    console.log(`messageText---->`, messageText)
    const result: Record<string, any> = attachAudio ? await sendGroupMessageWithAudio({
        group_id,
        messageText,
        accessToken,
        soundAPI_group_id: minimax_group_id,
        soundAPI_api_key: minimax_apikey,
    }) : await sendGroupMessage({
        group_id,
        messageType: 'text',
        messageContent: JSON.stringify({ text: messageText }),
        accessToken,
    })
    return c.json(result)
}

// 一个定时触发sendGroupMessage的方法
export const hydrationReminder = async (env: Env) => {
    const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey, minimax_group_id, minimax_apikey } = env || {}
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret })
    console.log(`accessToken---->`, accessToken)
    if (!accessToken) {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
    const group_id = 'oc_89587f96f9ae6428eddebbda70e092db'
    const now = new Date()
    const hour = now.getUTCHours() // 注意：UTC小时
    const minute = now.getUTCMinutes()
    // 转换为utc+8小时
    const hour_utc8 = hour + 8
    const getAIReminderText = await getChatMessage({
        message: `你是一个飞书机器人，主要作用是定时提醒群里面的人喝水，我们的日常工作时间是10:00到19:00(弹性工时，大致是这个时间)，现在是${hour_utc8}点${minute}分左右，你可以结合工作时间段，请你给出一句对应的喝水提醒话术，要幽默/鼓励/有趣。话术内不要有具体的时间点。只需要给出话术，不需要其他额外的任何内容。`,
        token: siliconflow_apikey,
        modelName: 'Qwen/Qwen3-235B-A22B',
    })
    const waterMessage = getAIReminderText || getHydrationMessageByHour(hour)
    // const result: Record<string, any> = await sendGroupMessage({
    //     group_id,
    //     messageType: 'text',
    //     messageContent: JSON.stringify({ text: waterMessage }),
    //     accessToken,
    // })
    const result = await sendGroupMessageWithAudio({
        group_id,
        messageText: waterMessage,
        accessToken,
        soundAPI_group_id: minimax_group_id,
        soundAPI_api_key: minimax_apikey,
    })
    console.log(`result---->`, JSON.stringify(result))
    return result
}


const sendGroupMessage = async ({
    group_id,
    messageContent,
    messageType,
    accessToken,
}:{
    group_id: string, messageType: string, messageContent: string, accessToken: string
}) => {
    const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`
    console.log(`group_id---->`, group_id)
    console.log(`messageType---->`, messageType)
    console.log(`messageContent---->`, messageContent)
    const bodyString = JSON.stringify({
        receive_id: group_id,
        content: messageContent,
        msg_type: messageType,
        uuid: createUUID(),
    })
    console.log(`bodyString---->`, bodyString)
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: bodyString,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=utf-8',
            },
        })
        const data: Record<string, any> = await response.json()
        return {
            code: 200,
            message: 'success',
            ...data,
        }
    } catch (error) {
        console.log(`error--->`, String(error))
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
}


const sendGroupMessageWithAudio = async ({
    group_id,
    messageText,
    accessToken,
    soundAPI_group_id,
    soundAPI_api_key,
}: {
    group_id: string, 
    messageText: string, 
    accessToken: string,
    soundAPI_group_id: string,
    soundAPI_api_key: string,
}) => {
    console.log(`sendGroupMessageWithAudio messageText---->`, messageText)
    console.log(`sendGroupMessageWithAudio soundAPI_group_id---->`, soundAPI_group_id)
    const uuid = createUUID()
    try {
        if(soundAPI_group_id && soundAPI_api_key){
            const [result, audioResult] = await Promise.all([
                (async ()=>{
                    await sendGroupMessage({
                        group_id,
                        messageType: 'text',
                        messageContent: JSON.stringify({ text: messageText }),
                        accessToken,
                    })
                    console.log(`start sendGroupMessage ---->`)
                    return {}
                })(),
                (async ()=>{
                    console.log(`start getSoundMessage ---->`)
                    const soundMessage = await getSoundMessage({ text: messageText, group_id: soundAPI_group_id, api_key: soundAPI_api_key })
                    if(soundMessage?.audioHex){
                        console.log(`soundMessage---->`, `success`)
                        const updateAudioResult = await updateAudio({
                            accessToken,
                            audioHexData: soundMessage.audioHex,
                            audioName: `water_reminder_${uuid}.mp3`,
                            audioDuration: soundMessage.audioSeconds,
                        })
                        console.log(`updateAudioResult---->`, updateAudioResult)
                        if(updateAudioResult?.file_key){
                            
                            const audioResult = await sendGroupMessage({
                                group_id,
                                messageType: 'audio',
                                messageContent: JSON.stringify({ file_key: updateAudioResult.file_key }),
                                accessToken,
                            })
                            return audioResult
                        }
                    }

                    return {
                        audioCode: -1,
                        audioMessage: 'Internal Server Error',
                    }
                })(),
            ])

            return {
                ...result,
                ...audioResult,
            }
        }

    } catch (error) {
        console.log(`error--->`, String(error))
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }

    return {
        code: 500,
        message: 'Internal Server Error',
    }
}

export default async (c: Context) => {
    const body = await c.req.json()
    const envConfig = c.env || {}
    try {
        const { challenge, type, event, header } = body
        const event_type = header?.event_type
        if (challenge && type === 'url_verification') {
            return c.json({ challenge })
        }
        console.log(`event_type---->`, event_type)
        console.log(`body---->`, JSON.stringify(body))
        if (event_type === 'im.message.receive_v1' && event?.message?.content) {
            const longTaskPromise = (async () => {
                await handleReplyMessage(event, envConfig)
            })()

            // 使用 waitUntil() 告诉 Worker 等待这个 Promise 完成
            // 注意：waitUntil 不会阻塞当前的响应发送
            c.executionCtx.waitUntil(longTaskPromise)
        }
        console.log(`no wait executionCtx`)
        return c.json({ code: 200, message: 'success' })
    } catch (error) {
        console.log(error)
        return c.json({ error: 'Internal Server Error' }, 500)
    }
}

// 处理接收消息
const handleReplyMessage = async (
    event: { message: Record<string, any>; sender: Record<string, any> },
    envConfig: Record<string, string>
) => {
    const { message, sender } = event
    const { content, message_id, mentions, chat_type } = message
    // 仅处理单聊和群聊at消息
    if (isAtMessage(message, envConfig.rainy_night_open_id)) {
        // try{
        //     const contentJson = JSON.parse(content);
        //     const { text } = contentJson;
        //     const response = await fetch("https://webhook.127321.xyz/feishu/send_message", {
        //         method: "POST",
        //         body: JSON.stringify({
        //             messageText: text,
        //             message_id: message_id
        //         })
        //     })
        //     const data: Record<string, any> = await response.json();
        //     console.log(`data---->`, JSON.stringify(data));
        // }catch(error){
        //     console.error(error);
        // }
        try {
            const contentJson = JSON.parse(content)
            const { text } = contentJson
            // 如果text中包含 "createImage"，则发送图片消息
            if (text.includes('createImage:')) {
                await replyImageMessage(text.replace('createImage:', ''), message_id, envConfig)
            } else {
                await replyTextMessage(text, message_id, envConfig)
            }
        } catch (error) {
            console.error(error)
        }
    }
    return {
        code: 200,
        message: 'success',
    }
}

const replyMessage = async (messageType: string, messageContent: string, message_id: string, accessToken: string) => {
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

const replyTextMessage = async (
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
const replyImageMessage = async (
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

const uploadImage = async (
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


// const sendAudioMessage = async (
//     messageText: string,
//     message_id: string,
//     envConfig: Record<string, string>
// ): Promise<Record<string, any>> => {
//     const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey } = envConfig || {}
//     const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret })
//     if (!accessToken) {
//         return {
//             code: 500,
//             message: 'Internal Server Error',
//         }
//     }
// }

const updateAudio = async ({
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
    const audioBlob = new Blob([audioBytes], { type: 'audio/mp3' }); // 或 'audio/opus'，根据实际格式
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

// 根据小时返回不同的提醒文案
function getHydrationMessageByHour(hour: number): string {
    switch (hour) {
        case 2:
            return '早安！新的一天开始了，记得喝水哦~'
        case 3:
            return '工作两小时啦~ 起来接杯水，舒展肩颈更放松！'
        case 5:
            return '午后时光，喝口水唤醒肠胃，再战下午！'
        case 8:
            return '下午茶时间，用白开水代替奶茶，抗糖又提神~'
        case 10:
            return '下班倒计时！喝口水缓解久坐疲劳，效率up↑'
        case 11:
            return '收工前最后提醒！补水助力完美收官，明天见~'
        default:
            return '该喝水了'
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