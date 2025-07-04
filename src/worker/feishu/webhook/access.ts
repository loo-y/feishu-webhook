import { botApp } from '../util/constants'
export const getAccessToken = async (appConfig: Record<string, string>) => {
    const url = `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(appConfig),
        })
        const data: Record<string, any> = await response.json()
        return data.tenant_access_token
    } catch (error) {
        console.error(error)
        return null
    }

    return null
}

// create random uuid; example: a0d69e20-1dd1-458b-k525-dfeca4015204
export const createUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export const isAtMessage = ({message, messageHeader}: {message: Record<string, any>, messageHeader: Record<string, any>}) => {
    const { mentions, chat_type } = message
    if (chat_type == 'p2p') {
        const { app_id } = messageHeader
        // @ts-ignore botApp
        const theBot = Object.keys(botApp).find((bot) => botApp[bot].appId == app_id)
        if(theBot){
            return {
                isAtMessage: true,
                bot: (botApp as any)[theBot],
            }
        }
    }
    if (chat_type == 'group' && mentions && mentions.length > 0) {
        let theBot = null
        const theMention = mentions.find((mention: Record<string, any>) => {
            theBot = Object.keys(botApp).find((bot) => (botApp as any)[bot].openId == mention?.id?.open_id )
            return !!theBot
        })
        return {
            isAtMessage: theMention ? true : false,
            bot: theBot ? (botApp as any)[theBot] : null,
        }
    }
    return {
        isAtMessage: false,
    }
}
