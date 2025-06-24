import { getAccessToken, createUUID, isAtMessage } from './access'
import { updateAudio } from './audioHelper'
import { getSoundMessage } from '../../minimax/index'
import { getSoundMessage as getSoundMessageBySiliconFlow } from '../../siliconflow/chat'
export const sendGroupMessage = async ({
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

export const sendGroupMessageWithAudio = async ({
    group_id,
    messageText,
    accessToken,
    soundAPI_group_id,
    soundAPI_api_key,
    siliconFlow_api_key,
}: {
    group_id: string, 
    messageText: string, 
    accessToken: string,
    soundAPI_group_id?: string,
    soundAPI_api_key?: string,
    siliconFlow_api_key?: string,
}) => {
    console.log(`sendGroupMessageWithAudio messageText---->`, messageText)
    console.log(`sendGroupMessageWithAudio soundAPI_group_id---->`, soundAPI_group_id)
    const uuid = createUUID()
    try {
        if((soundAPI_group_id && soundAPI_api_key) || siliconFlow_api_key){
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
                    // const soundMessage = await getSoundMessage({ text: messageText, group_id: soundAPI_group_id, api_key: soundAPI_api_key })
                    const soundMessage: Record<string, any> | null = soundAPI_group_id && soundAPI_api_key ?  await getSoundMessage({ text: messageText, group_id: soundAPI_group_id, api_key: soundAPI_api_key }) : (siliconFlow_api_key ? await getSoundMessageBySiliconFlow({ text: messageText, token: siliconFlow_api_key }) : null)

                    if(soundMessage?.success){
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