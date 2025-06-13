import { Context } from "hono";
import { getAccessToken, createUUID, isAtMessage } from "./access";
import { getChatMessage } from "../../siliconflow/chat";
export default async (c: Context) => {
    const body = await c.req.json();
    const envConfig = c.env || {};
    try{
        const { challenge, type, event, header } = body;
        const event_type = header?.event_type;
        if(challenge && type === 'url_verification'){
            return c.json({ challenge });
        }
        console.log(`event_type---->`, event_type);
        if(event_type === 'im.message.receive_v1' && event?.message?.content){
            const longTaskPromise = (async () => {
                await handleReplyMessage(event, envConfig);
            })();

            // 使用 waitUntil() 告诉 Worker 等待这个 Promise 完成
            // 注意：waitUntil 不会阻塞当前的响应发送
            c.executionCtx.waitUntil(longTaskPromise);
        }
        console.log(`no wait executionCtx`);
        return c.json({ code: 200, message: "success" });
    }catch(error){
        console.log(error);
        return c.json({ error: "Internal Server Error" }, 500);
    }
}

// 处理接收消息
const handleReplyMessage = async (event: {message: Record<string, any>, sender: Record<string, any>}, envConfig: Record<string, string>) => {
    const { message, sender } = event;
    const { content, message_id, mentions, chat_type } = message;
    // 仅处理单聊和群聊at消息
    if(isAtMessage(message, envConfig.rainy_night_open_id)){
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
        try{
            const contentJson = JSON.parse(content);
            const { text } = contentJson;
            await sendMessage(text, message_id, envConfig);
        }catch(error){
            console.error(error);
        }
    }
    return {
        code: 200,
        message: "success"
    }
}
export const requestSendMessage = async (c: Context) => {
    const envConfig = c.env || {};
    const body = await c.req.json();
    const { messageText, message_id } = body || {};
    console.log(`messageText---->`, messageText);
    console.log(`message_id---->`, message_id);
    const result: Record<string, any> = await sendMessage(messageText, message_id, envConfig);
    return c.json(result);
}


const sendMessage = async (messageText: string, message_id: string, envConfig: Record<string, string>): Promise<Record<string, any>> => {
    const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey } = envConfig || {};
    const accessToken = await getAccessToken({app_id: rainy_night_appId, app_secret: rainy_night_appSecret});
    if(!accessToken){
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }
    console.log(`message---->`, messageText);
    // https://open.feishu.cn/open-apis/im/v1/messages/:message_id/reply
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${message_id}/reply`;
    const chatMessage = await getChatMessage({message: messageText, token: siliconflow_apikey, modelName: "Qwen/Qwen3-235B-A22B"});
    console.log(`chatMessage---->`, chatMessage);
    try{
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                content: JSON.stringify({text: chatMessage ? chatMessage : `I have received your message: ${messageText}`}),
                msg_type: "text",
                reply_in_thread: false,
                uuid: createUUID(),
            }),
         headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
         }
    });
    const data: Record<string, any> = await response.json();
    console.log(`data---->`, JSON.stringify(data));
    return data;
    }catch(error){
        console.log(`error--->`, String(error));
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }
}