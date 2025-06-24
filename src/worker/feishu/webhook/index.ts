import { Context } from 'hono'
import { getAccessToken, createUUID, isAtMessage } from './access'
import { getChatMessage } from '../../siliconflow/chat'
import { replyTextMessage, replyImageMessage, replyAudioMessage } from './reply'
import { sendGroupMessage, sendGroupMessageWithAudio } from './group'
import { sendSingleMessageByEmail, sendSingleMessageByEmailWithAudio } from './single'

export interface Env {
    rainy_night_appId: string
    rainy_night_appSecret: string
    siliconflow_apikey: string
    minimax_group_id: string
    minimax_apikey: string
}

export const requestSingleMessage = async (c: Context) => {
    const envConfig = c.env || {}
    const { rainy_night_appId, rainy_night_appSecret, minimax_group_id, minimax_apikey, siliconflow_apikey } = envConfig || {}
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret })
    if (!accessToken) {
        return c.json({
            code: 500,
            message: 'Internal Server Error',
        })
    }
    let messageText, email, attachAudio = false;
    if (c.req.method === 'GET') {
        const queryParams = c.req.query()
        messageText = queryParams?.message_text
        email = queryParams?.email
        attachAudio = queryParams?.attach_audio == "1"
    } else if (c.req.method === 'POST') {
        const body = await c.req.json()
        messageText = body?.messageText
        email = body?.email
        attachAudio = body?.attachAudio == true
    }

    if(!messageText || !email){
        return c.json({
            code: 500,
            message: 'Internal Server Error',
        })
    }

    const result = attachAudio ? await sendSingleMessageByEmailWithAudio({
        messageText: messageText,
        userEmail: email,
        accessToken,
        // soundAPI_group_id: minimax_group_id,
        // soundAPI_api_key: minimax_apikey,
        siliconFlow_api_key: siliconflow_apikey,
    }) : await sendSingleMessageByEmail({
        messageType: 'text',
        messageContent: JSON.stringify({ text: messageText }),
        userEmail: email,
        accessToken,
    })
    return c.json(result)
}

export const requestGroupMessage = async (c: Context) => {
    const envConfig = c.env || {}
    const { rainy_night_appId, rainy_night_appSecret, minimax_group_id, minimax_apikey, siliconflow_apikey } = envConfig || {}
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
        // soundAPI_group_id: minimax_group_id,
        // soundAPI_api_key: minimax_apikey,
        siliconFlow_api_key: siliconflow_apikey,
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
    const result = await sendGroupMessageWithAudio({
        group_id,
        messageText: waterMessage,
        accessToken,
        // soundAPI_group_id: minimax_group_id,
        // soundAPI_api_key: minimax_apikey,
        siliconFlow_api_key: siliconflow_apikey,
    })
    console.log(`result---->`, JSON.stringify(result))
    return result
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
                await handleAtMeMessage(event, envConfig)
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

// 处理at机器人的消息
const handleAtMeMessage = async (
    event: { message: Record<string, any>; sender: Record<string, any> },
    envConfig: Record<string, string>
) => {
    const { message, sender } = event
    const { content, message_id, mentions, chat_type } = message
    // 仅处理单聊和群聊at消息
    if (isAtMessage(message, envConfig.rainy_night_open_id)) {
        try {
            const contentJson = JSON.parse(content)
            const { text } = contentJson
            const command = isCommand(text)
            console.log(`command---->`, JSON.stringify(command))
            if(command?.command){
                switch(command.command){
                    case 'help':
                        await replyTextMessage(command.text, message_id, envConfig)
                        break;
                    case 'image':
                        await replyImageMessage(command.text.replace('createImage:', ''), message_id, envConfig)
                        break;
                    case 'speak':
                        await replyAudioMessage({
                            messageText: command.text,
                            voiceId: command.subCommand,
                            message_id,
                            envConfig,
                        })
                        break;
                    default:
                        await replyTextMessage(text, message_id, envConfig)
                }
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

// 用于辨别发送给机器人中的文本是否包含特定的命令，比如 /help， /image，/speak，并且需要返回命令的类型 ，同时返回命令之外的其他文本信息，如果包含多个命令，则返回第一个命令。文本信息需要trim，并且保证存在
function isCommand(text: string): { command: string, subCommand: string, text: string } | null {
    // 获取以 / 开头的命令，到空格结束，剩下的为命令对应的文本信息
    const command = text.match(/^\/([^\s]+)/)
    if(command && command[0]){
        const commandText = command[0]
        const otherText = text.replace(commandText, '').trim()
        // 移除 /
        const commandTextTrim = commandText.replace('/', '').trim()
        // 拆解command，如果有冒号，则返回冒号前的命令，冒号后的为子命令内容
        const commandArray = commandTextTrim.split(':')
        if(commandArray.length > 1){
            const mainCommand = commandArray[0]
            const subCommand = commandArray[1]
            return { command: mainCommand, subCommand: subCommand, text: otherText }
        } else {
            return { command: commandTextTrim, subCommand: '', text: otherText }
        }
    }
    return null
}