import { Context } from 'hono'
import { getAccessToken, createUUID, isAtMessage } from './access'
import { getShortDomain } from './shortdomain'
import { getChatMessage } from '../../siliconflow/chat'
import { replyMessage, replyTextMessage, replyImageMessage, replyAudioMessage } from './reply'
import { sendGroupMessage, sendGroupMessageWithAudio } from './group'
import { sendSingleMessageByEmail, sendSingleMessageByEmailWithAudio } from './single'
import { voices } from '../../siliconflow/constants'
import { botApp } from '../util/constants'

const COMMANDS = {
    HELP: 'help',
    IMAGE: 'image',
    SPEAK: 'speak',
    SHORTDOMAIN: 'shortdomain',
};

export interface Env {
    // rainy_night_appId: string
    // rainy_night_open_id: string
    rainy_night_appSecret: string
    siliconflow_apikey: string
    minimax_group_id: string
    minimax_apikey: string
    shoppingcart_helper_appSecret: string
}

async function extractParams(c: Context, fields: string[]): Promise<Record<string, any>> {
    let params: Record<string, any> = {};
    if (c.req.method === 'GET') {
        const queryParams = c.req.query();
        fields.forEach(field => params[field] = queryParams[field]);
    } else if (c.req.method === 'POST') {
        const body = await c.req.json();
        fields.forEach(field => params[field] = body[field]);
    }
    return params;
}

export const requestSingleMessage = async (c: Context) => {
    const envConfig = c.env || {};
    const { appId: rainy_night_appId, } = botApp.rainy_night
    const { rainy_night_appSecret, siliconflow_apikey } = envConfig || {};
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret });
    if (!accessToken) {
        return c.json({ code: 500, message: 'Internal Server Error no accessToken' });
    }

    const { message_text, email, attach_audio, voiceid, speed, message_type, card_template_id, card_template_version, card_template_variable } = await extractParams(c, ['message_text', 'email', 'attach_audio', 'voiceid', 'speed', 'message_type', 'card_template_id', 'card_template_version', 'card_template_variable']);
    const attachAudio = attach_audio === '1' || attach_audio === true;
    const voiceId = voiceid;
    const speedNum = speed ? Number(speed) : 1;

    if ((!message_text && !message_type) || !email) {
        return c.json({ code: 500, message: 'Internal Server Error no message_text or email' });
    }
    if(message_type === 'interactive' && card_template_id && card_template_version && card_template_variable){
        const result = await sendSingleMessageByEmail({
            messageType: 'interactive',
            messageContent: JSON.stringify({ 
                type: 'template',
                data: {
                    template_id: card_template_id,
                    template_version_name: card_template_version,
                    template_variable: typeof card_template_variable === 'string' ? JSON.parse(card_template_variable) : card_template_variable,
                }
             }),
            userEmail: email,
            accessToken,
        });
        return c.json(result);
    }

    const result = attachAudio ? await sendSingleMessageByEmailWithAudio({
        messageText: message_text,
        userEmail: email,
        accessToken,
        // soundAPI_group_id: minimax_group_id,
        // soundAPI_api_key: minimax_apikey,
        siliconFlow_api_key: siliconflow_apikey,
        voiceId,
        speed: speedNum,
    }) : await sendSingleMessageByEmail({
        messageType: 'text',
        messageContent: JSON.stringify({ text: message_text }),
        userEmail: email,
        accessToken,
    });
    return c.json(result);
}

export const requestGroupMessage = async (c: Context) => {
    const envConfig = c.env || {};
    const { appId: rainy_night_appId, } = botApp.rainy_night
    const { rainy_night_appSecret, siliconflow_apikey } = envConfig || {};
    const accessToken = await getAccessToken({ app_id: rainy_night_appId, app_secret: rainy_night_appSecret });
    if (!accessToken) {
        return c.json({ code: 500, message: 'Internal Server Error no accessToken' });
    }

    const { message_text, group_id, attach_audio, message_type, card_template_id, card_template_version, card_template_variable } = await extractParams(c, ['message_text', 'group_id', 'attach_audio', 'message_type', 'card_template_id', 'card_template_version', 'card_template_variable']);
    const attachAudio = attach_audio === '1' || attach_audio === true;

    if ((!message_text && !message_type) || !group_id) {
        return c.json({ code: 500, message: 'Internal Server Error no message_text or group_id' });
    }

    if(message_type === 'interactive' && card_template_id && card_template_version && card_template_variable){
        const result = await sendGroupMessage({
            group_id,
            messageType: 'interactive',
            messageContent: JSON.stringify({ 
                type: 'template',
                data: {
                    template_id: card_template_id,
                    template_version_name: card_template_version,
                    template_variable: typeof card_template_variable === 'string' ? JSON.parse(card_template_variable) : card_template_variable,
                }
            }),
            accessToken,
        })  
        return c.json(result);
    }

    console.log(`messageText---->`, message_text);
    const result: Record<string, any> = attachAudio ? await sendGroupMessageWithAudio({
        group_id,
        messageText: message_text,
        accessToken,
        // soundAPI_group_id: minimax_group_id,
        // soundAPI_api_key: minimax_apikey,
        siliconFlow_api_key: siliconflow_apikey,
    }) : await sendGroupMessage({
        group_id,
        messageType: 'text',
        messageContent: JSON.stringify({ text: message_text }),
        accessToken,
    })
    return c.json(result)
}

// 一个定时触发sendGroupMessage的方法
export const hydrationReminder = async (env: Env) => {
    const { appId: rainy_night_appId, } = botApp.rainy_night
    const { rainy_night_appSecret, siliconflow_apikey, minimax_group_id, minimax_apikey } = env || {}
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
    const voiceId = 'wangyibo'
    const getAIReminderText = await getChatMessage({
        message: `你是一个飞书机器人，主要作用是定时提醒群里面的人喝水，我们的日常工作时间是10:00到19:00(弹性工时，大致是这个时间)，现在是${hour_utc8}点${minute}分左右，你可以结合工作时间段，请你给出一句对应的喝水提醒话术，要幽默/鼓励/有趣。话术内不要有具体的时间点。只需要给出话术，不需要其他额外的任何内容。`,
        token: siliconflow_apikey,
        modelName: 'Qwen/Qwen3-235B-A22B',
        temperature: 1,
    })
    const waterMessage = getAIReminderText || getHydrationMessageByHour(hour)
    const result = await sendGroupMessageWithAudio({
        group_id,
        messageText: `${waterMessage}`,
        accessToken,
        // soundAPI_group_id: minimax_group_id,
        // soundAPI_api_key: minimax_apikey,
        siliconFlow_api_key: siliconflow_apikey,
        voiceId,
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
                await handleAtMeMessage(event, header,envConfig)
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
    messageHeader: Record<string, any>,
    envConfig: Record<string, string>
) => {
    const { message, sender } = event
    const { content, message_id, mentions, chat_type } = message
    const isAtMessageResult = isAtMessage({message, messageHeader});
    const { appId: rainy_night_appId, } = botApp.rainy_night
    // 仅处理单聊和群聊at消息
    if (isAtMessageResult?.isAtMessage) {
        try {
            const contentJson = JSON.parse(content)
            const { text } = contentJson
            // 这里需要先移除 @ 机器人 的文本 以 @ 开头，以 空格结尾
            const textWithoutAt = text.replace(/@[^ ]* /, '').trim()

            const command = isCommand(textWithoutAt)
            console.log(`command---->`, JSON.stringify(command))
            const accessToken = await getAccessToken({ app_id: isAtMessageResult?.bot?.appId, app_secret: envConfig[`${isAtMessageResult?.bot?.id}_appSecret`] })
            if(command?.command){
                switch(command.command){
                    case COMMANDS.SHORTDOMAIN:
                        const shortDomain = await getShortDomain({text: command.text, sender, envConfig})
                        await replyMessage('text', JSON.stringify({ text: shortDomain }), message_id, accessToken)
                        break;
                    case COMMANDS.HELP:
                        await replyMessage('text', JSON.stringify({ text:  showHelpMessage() }), message_id, accessToken)
                        break;
                    case COMMANDS.IMAGE:
                        await replyImageMessage({
                            messageText: command.text.replace('createImage:', ''),
                            message_id,
                            envConfig,
                            accessToken,
                        })
                        break;
                    case COMMANDS.SPEAK:
                        await replyAudioMessage({
                            messageText: command.text,
                            voiceId: command.subCommand,
                            message_id,
                            envConfig,
                            accessToken,
                        })
                        break;
                    default:
                        await replyTextMessage({
                            messageText: textWithoutAt,
                            message_id,
                            envConfig,
                            accessToken,
                        })
                }
            } else {
                await replyTextMessage({
                    messageText: textWithoutAt,
                    message_id,
                    envConfig,
                    accessToken,
                })
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
const getHydrationMessageByHour = (hour: number): string => {
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
const isCommand = (text: string): { command: string, subCommand: string, text: string } | null => {
    const match = text.match(/^\/([^\s]+)/);
    if (!match) {
        return null;
    }

    const fullCommand = match[1];
    const otherText = text.replace(match[0], '').trim();
    const [command, subCommand = ''] = fullCommand.split(':');

    return { command, subCommand, text: otherText };
}

// 当用户输入 /help 时 返回可用的命令
const showHelpMessage = () => {
    const voiceList = Object.keys(voices).map(key => key).join(', ')
    return `
    可用的命令：
    /${COMMANDS.IMAGE} 创建图片

    /${COMMANDS.SPEAK} 说话
        示例：
        /${COMMANDS.SPEAK}:wangyibo 使用王一博的声音说话
        可用的声音列表：
        ${voiceList}
        
    /${COMMANDS.SHORTDOMAIN} 获取自己飞书账号的短域名
        示例：
        /${COMMANDS.SHORTDOMAIN} luyia
        说明：传入想要的名称，会自动生成对应的短域名，用于跳转当前用户的聊天窗口。如果名称已存在，则自动生成一个6位的短域名名称。
    `
}   

