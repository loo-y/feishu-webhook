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

export const isAtMessage = (message: Record<string, any>, open_id: string) => {
    const { mentions, chat_type } = message
    if (chat_type == 'p2p') return true
    if (chat_type == 'group' && mentions && mentions.length > 0) {
        return mentions.some((mention: Record<string, any>) => mention?.id?.open_id == open_id) // 判断是否at了机器人: 绵雨星夜
    }
    return false
}
