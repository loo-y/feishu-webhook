import { voices } from './constants'
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
        console.log(`getChatMessage error--->`, String(error))
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

export const getSoundMessage = async ({
    text,
    token,
    voiceId = "songyi", // 'FunAudioLLM/CosyVoice2-0.5B:claire',
    model = 'FunAudioLLM/CosyVoice2-0.5B',
    sample_rate = 48000,
    stream = false,
    speed = 1,
    gain = 0,
}: {
    text: string    
    token: string
    voiceId?: string
    model?: string
    sample_rate?: number
    stream?: boolean
    speed?: number
    gain?: number
}) => {
    const url = `https://api.siliconflow.cn/v1/audio/speech`;
    // @ts-ignore
    const voice = voices[voiceId] || voices.songyi
    const body = {
        model: model,   
        input: text,
        voice: voice,
        response_format: 'opus',
        sample_rate: sample_rate,
        stream: stream,
        speed: speed,
        gain: gain,
    }
    console.log(`silliconflow getSoundMessage body--->`, body)
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })
        const audioBuffer = await response.arrayBuffer();
        // 计算每秒的字节数
        const bytesPerSecond = sample_rate * 1 * (8 / 8);
        const audioBufferLength = audioBuffer.byteLength;
        console.log(`audioBufferLength---->`, audioBufferLength)
        const audioSeconds = Math.ceil(audioBufferLength / bytesPerSecond) * 1000; // TODO 这个值有问题

        return {
            audioBuffer,
            audioSeconds,
            success: true,
        }
    } catch (error) {
        console.log('silliconflow getSoundMessage error--->', error)
        return null
    }
}