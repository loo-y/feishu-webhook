const group_id = '请填写您的group_id'
const api_key = '请填写您的api_key'

interface AudioData {
    data: {
        audio?: string // 合成后的音频片段，采用hex编码，按照输入定义的格式进行生成（mp3/pcm/flac）。
        subtitle_file?: string // 合成的字幕下载链接。音频文件对应的字幕，精确到句（不超过50字），单位为毫秒，格式为json。
        status?: number // 当前音频流状态，1表示合成中，2表示合成结束。
    },
    trace_id?: string // 本次会话的id。用于在咨询/反馈时帮助定位问题。
    extra_info: {
        audio_length?: number // 音频长度，单位为秒。
        audio_sample_rate?: number // 音频采样率，单位为赫兹。
        audio_size?: number // 音频大小，单位为字节。
        bitrate?: number // 音频比特率，单位为bps。
        format?: string // 音频格式，mp3/pcm/flac。
        audio_format?: string // 生成音频文件的格式。取值范围mp3/pcm/flac。
        audio_channel?: number // 音频声道数。
        invisible_character_ratio?: number // 不可见字符占比。
        usage_characters?: number // 计费字符数。本次语音生成的计费字符数。
    },
    base_resp: {
        status_code: number // 状态码。
        status_msg: string // 状态信息。
    }
}

export const getSoundMessage = async ({ text, group_id, api_key }: { text: string; group_id: string; api_key: string }) => {
    const requestBody = {
        model: 'speech-02-hd',
        text: text,
        timber_weights: [
            {
                voice_id: 'Chinese (Mandarin)_Laid_BackGirl', // 慵懒少女
                weight: 1,
            },
        ],
        voice_setting: {
            voice_id: '',
            speed: 1,
            pitch: -1,
            vol: 1,
            latex_read: false,
        },
        audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
        },
        language_boost: 'auto',
    }

    try{

        const response = await fetch(`https://api.minimax.chat/v1/t2a_v2?GroupId=${group_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${api_key}`,
            },
            body: JSON.stringify(requestBody),
        })
        const responseData: AudioData = await response.json()
        return {
            audioHex: responseData?.data?.audio || '',
            audioSeconds: responseData?.extra_info?.audio_length || 0,
        }
    } catch (error) {
        console.log(`getSoundMessage error--->`, error)
    }

    return null
}
