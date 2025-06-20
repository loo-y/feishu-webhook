const group_id = '请填写您的group_id'
const api_key = '请填写您的api_key'

const requestBody = {
    model: 'speech-02-hd',
    text: '各位创意艺术家们，听说隔壁饮水机暗恋你们很久了，它抱怨说今天还没被激活过呢！工时过半记得给嗓子续个杯，毕竟我们的摄影棚还在等甲方爸爸的膝盖奇观解密——（温馨提示：菊花亏了可比代码bug更致命哦～）',
    timber_weights: [
        {
            voice_id: 'Chinese (Mandarin)_Laid_BackGirl',
            weight: 1,
        },
    ],
    voice_setting: {
        voice_id: '',
        speed: 1,
        pitch: 0,
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

fetch(`https://api.minimax.chat/v1/t2a_v2?GroupId={group_id}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer {api_key}`,
    },
    body: JSON.stringify(requestBody),
})
