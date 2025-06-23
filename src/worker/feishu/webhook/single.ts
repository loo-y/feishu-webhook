import { getAccessToken, createUUID, isAtMessage } from './access'
import { updateAudio } from './audioHelper'
import { getSoundMessage } from '../../minimax/index'
import { getSoundMessage as getSoundMessageBySiliconFlow } from '../../siliconflow/chat'
import { voices } from '../../siliconflow/constants'

// 和 replyMessage的区别是主动发起消息，而不是回复消息
// 单聊需要用户在应用的可用范围内，群聊需要用户在群内
export const sendSingleMessageByEmail = async ({
    messageType,
    messageContent,
    userEmail,
    accessToken,
}: {
    messageType: string, messageContent: string, userEmail: string, accessToken: string}) => {
    const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=email`
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                receive_id: userEmail,
                content: messageContent,
                msg_type: messageType,
                uuid: createUUID(),
            }),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=utf-8',
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

export const sendSingleMessageByEmailWithAudio = async ({
    userEmail,
    messageText,
    accessToken,
    soundAPI_group_id,
    soundAPI_api_key,
    siliconFlow_api_key,
}: {
    userEmail: string, 
    messageText: string, 
    accessToken: string,
    soundAPI_group_id?: string,
    soundAPI_api_key?: string,
    siliconFlow_api_key?: string,
}) => {
    if (!accessToken) {
        return {
            code: 500,
            message: 'Internal Server Error',
        }
    }
    const uuid = createUUID()
    try {
        if((soundAPI_group_id && soundAPI_api_key) || siliconFlow_api_key){
            const [result, audioResult] = await Promise.all([
                (async ()=>{
                    await sendSingleMessageByEmail({
                        userEmail,
                        messageType: 'text',
                        messageContent: JSON.stringify({ text: messageText }),
                        accessToken,
                    })
                    return {}
                })(),
                (async ()=>{
                    console.log(`start getSoundMessage ---->`)
                    const soundMessage: Record<string, any> | null = soundAPI_group_id && soundAPI_api_key ?  await getSoundMessage({ text: messageText, group_id: soundAPI_group_id, api_key: soundAPI_api_key }) : (siliconFlow_api_key ? await getSoundMessageBySiliconFlow({ text: messageText, token: siliconFlow_api_key, voice: voices.wangyibo_voice_002 }) : null)
                    if(soundMessage?.success){
                        console.log(`soundMessage---->`, soundMessage)
                        const updateAudioResult = soundMessage?.audioHex ? await updateAudio({
                            accessToken,
                            audioHexData: soundMessage.audioHex,
                            audioName: `water_reminder_${uuid}.wav`,
                            audioDuration: soundMessage.audioSeconds,
                        }) : await updateAudio({
                            accessToken,
                            audioArrayBuffer: soundMessage.audioBuffer,
                            audioName: `water_reminder_${uuid}.wav`,
                            audioDuration: soundMessage.audioSeconds,
                        })
                        console.log(`updateAudioResult---->`, updateAudioResult)
                        if(updateAudioResult?.file_key){ 
                            const audioResult = await sendSingleMessageByEmail({
                                userEmail,
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
