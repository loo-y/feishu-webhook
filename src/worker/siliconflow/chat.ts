export const getChatMessage = async ({message, token, modelName}: {message: string, token: string, modelName: string}) => {
    try{
        const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
            method: "POST",
            body: JSON.stringify({
                "model": modelName,
                "messages": [
                {
                    "role": "user",
                    "content": message
                }
                ],
                "stream": false,
                "max_tokens": 512,
                "enable_thinking": false,
                "thinking_budget": 4096,
                "min_p": 0.05,
                "stop": null,
                "temperature": 0.7,
                "top_p": 0.7,
                "top_k": 50,
                "frequency_penalty": 0.5,
                "n": 1,
                "response_format": {
                "type": "text"
                },
            }),
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        const data: Record<string, any> = await response.json();
        console.log(`chat_return---->`, data?.choices[0]?.message?.content);
        return data?.choices[0]?.message?.content || ""; 
    }catch(error){
        console.log(`getChatMessage error--->`);
    }
    console.log(`getChatMessage error--->`);
    return ""
}