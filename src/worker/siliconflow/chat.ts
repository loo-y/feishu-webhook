export const getChatMessage = async ({
    message,
    token,
    modelName,
}: {
    message: string
    token: string
    modelName: string
}) => {
    try {
        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model: modelName,
                messages: [
                    {
                        role: 'user',
                        content: message,
                    },
                ],
                stream: false,
                max_tokens: 512,
                enable_thinking: false,
                thinking_budget: 4096,
                min_p: 0.05,
                stop: null,
                temperature: 0.7,
                top_p: 0.7,
                top_k: 50,
                frequency_penalty: 0.5,
                n: 1,
                response_format: {
                    type: 'text',
                },
            }),
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })
        const data: Record<string, any> = await response.json()
        console.log(`chat_return---->`, data?.choices[0]?.message?.content)
        return data?.choices[0]?.message?.content || ''
    } catch (error) {
        console.log(`getChatMessage error--->`)
    }
    return ''
}

export const createImage = async ({
    token,
    prompt,
    modelName = 'Kwai-Kolors/Kolors',
    image_size = '512x512',
    batch_size = 1,
    num_inference_steps = 20,
    guidance_scale = 7.5,
}: {
    token: string
    prompt: string
    modelName?: string
    image_size?: string
    batch_size?: number
    num_inference_steps?: number
    guidance_scale?: number
}): Promise<Record<string, any> | null> => {
    try {
        const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                prompt,
                negative_prompt: '',
                image_size,
                batch_size,
                seed: Math.floor(Math.random() * 10000000000),
                num_inference_steps,
                guidance_scale,
            }),
        })
        const data: Record<string, any> = await response.json()
        console.log(`createImage data--->`, JSON.stringify(data))
        return data
    } catch (error) {
        console.log('createImage error--->', error)
        return null
    }
}
