import { Context } from "hono";
import { getAccessToken, createUUID, isAtMessage } from "./access";
import { getChatMessage, createImage } from "../../siliconflow/chat";
export const requestGroupMessage = async (c: Context) => {
    const envConfig = c.env || {};
    const { rainy_night_appId, rainy_night_appSecret } = envConfig || {};
    const accessToken = await getAccessToken({app_id: rainy_night_appId, app_secret: rainy_night_appSecret});
    if(!accessToken){
        return c.json({
            code: 500,
            message: "Internal Server Error"
        })
    }
    let messageText, group_id;
    if (c.req.method === 'GET') {
        const queryParams = c.req.query();
        messageText = queryParams?.message_text;
        group_id = queryParams?.group_id;
    }else if(c.req.method === 'POST'){
        const body = await c.req.json();
        messageText = body?.messageText;
        group_id = body?.groupId;
    }

    if(!messageText || !group_id){
        return c.json({
            code: 500,
            message: "Internal Server Error"
        })
    }
    console.log(`messageText---->`, messageText);
    const messageContent = JSON.stringify({text: messageText});
    const result: Record<string, any> = await sendGroupMessage(
        group_id,
        "text",
        messageContent,
        accessToken
    );
    return c.json(result);
}

const sendGroupMessage = async(group_id: string, messageType: string, messageContent: string, accessToken: string) =>{
    const url = `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`
    console.log(`group_id---->`, group_id);
    console.log(`messageType---->`, messageType);
    console.log(`messageContent---->`, messageContent);
    try{
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                receive_id: group_id,
                content: messageContent,
                msg_type: messageType,
                uuid: createUUID(),
            }),
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json; charset=utf-8"
            }
        })
        const data: Record<string, any> = await response.json();
        return {
            code: 200,
            message: "success",
            ...data,
        };
    }catch(error){
        console.log(`error--->`, String(error));
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }
}

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
            // 如果text中包含 "createImage"，则发送图片消息
            if(text.includes("createImage:")){
                await sendImageMessage(text.replace("createImage:", ""), message_id, envConfig);
            }else{
                await sendTextMessage(text, message_id, envConfig);
            }
        }catch(error){
            console.error(error);
        }
    }
    return {
        code: 200,
        message: "success"
    }
}


const replyMessage = async(messageType: string, messageContent: string, message_id: string, accessToken: string) =>{
    const url = `https://open.feishu.cn/open-apis/im/v1/messages/${message_id}/reply`;
    try{
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                content: messageContent,
                msg_type: messageType,
                reply_in_thread: false,
                uuid: createUUID(),
            }),
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });
    const data: Record<string, any> = await response.json();
    return data;
    }catch(error){
        console.log(`error--->`, String(error));
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }
}

const sendTextMessage = async (messageText: string, message_id: string, envConfig: Record<string, string>): Promise<Record<string, any>> => {
    const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey } = envConfig || {};
    const accessToken = await getAccessToken({app_id: rainy_night_appId, app_secret: rainy_night_appSecret});
    if(!accessToken){
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }

    const chatMessage = await getChatMessage({message: messageText, token: siliconflow_apikey, modelName: "Qwen/Qwen3-235B-A22B"});
    console.log(`chatMessage---->`, chatMessage);
    await replyMessage("text", JSON.stringify({text: chatMessage ? chatMessage : `I have received your message: ${messageText}`}), message_id, accessToken);
    return {
        code: 200,
        message: "success"
    }
}

// 发送图片消息， 需要先上传图片，获取图片的key，然后以此key发送图片消息
const sendImageMessage = async (messageText: string, message_id: string, envConfig: Record<string, string>): Promise<Record<string, any>> => {
    const { rainy_night_appId, rainy_night_appSecret, siliconflow_apikey } = envConfig || {};
    const accessToken = await getAccessToken({app_id: rainy_night_appId, app_secret: rainy_night_appSecret});
    if(!accessToken){
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }

    const imageResult = await createImage({
        prompt: messageText,
        token: siliconflow_apikey
    });
    if(!imageResult?.images?.[0]?.url){
        await replyMessage("text", `I have received your message: ${messageText}`, message_id, accessToken);
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }

    const uploadImageResult = await uploadImage(accessToken, imageResult.images[0].url);
    console.log(`uploadImageResult---->`, uploadImageResult);

    if(uploadImageResult.image_key){
        // 发送图片消息
        await replyMessage("image", JSON.stringify({image_key: uploadImageResult.image_key}), message_id, accessToken);
    }else{
        await replyMessage("text", `I have received your message: ${messageText}`, message_id, accessToken);
    }
    return {
        code: 200,
        message: "success"
    }
}



const uploadImage = async (accessToken: string, imageUrl: string): Promise<{code: number, message: string, image_key?: string}> => {
    if(!accessToken){
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }
    const response = await fetch(imageUrl);
    const imageBlob = await response.blob();

    // 构造 multipart/form-data
    const formData = new FormData();
    formData.append('image_type', 'message');
    formData.append('image', imageBlob, 'image.jpg');

    const uploadResponse = await fetch("https://open.feishu.cn/open-apis/im/v1/images", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`
            // 不要手动设置 Content-Type
        },
        body: formData
    });
    const uploadData: Record<string, any> = await uploadResponse.json();
    if(uploadData?.data?.image_key){
        return {
            code: 200,
            message: "success",
            image_key: uploadData.data?.image_key
        }
    }else{
        return {
            code: 500,
            message: "Internal Server Error"
        }
    }
}


