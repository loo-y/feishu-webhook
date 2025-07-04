
import { Env } from './index';

interface GetShortDomainParams {
    text: string;
    sender: any; // The sender object from the Feishu event
    envConfig?: Record<string, string>;
}

/**
 * Calls the short domain service to create a short URL for a user's Feishu chat.
 * @param {GetShortDomainParams} params - The parameters for getting the short domain.
 * @returns {Promise<string>} The response message from the short domain service.
 */
export const getShortDomain = async ({ text, sender }: GetShortDomainParams): Promise<string> => {
    const openId = sender?.sender_id?.open_id;
    if (!openId) {
        return '无法获取用户信息';
    }

    if (!text) {
        return '请输入你想要的短域名名称';
    }

    const feishuUrl = `https://applink.feishu.cn/client/chat/open?openId=${openId}`;
    const apiUrl = 'https://t.021968.xyz/s'; // The short domain service endpoint

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: feishuUrl,
                custom_code: text,
            }),
        });

        if (response.ok) {
            const result = await response.json() as { short_url?: string; message?: string, destination_url?: string };
            if (result.message) {
                return result.message + `${result.destination_url ? '\n\nRedirect to: ' +result.destination_url : ''}`;
            } else if (result.short_url) {
                return `短域名创建成功: ${result.short_url}`;
            }
            return '短域名创建成功，但未返回链接';
        } else {
            const errorResult = await response.json() as { message?: string };
            return `短域名创建失败: ${errorResult.message || response.statusText}`;
        }
    } catch (error) {
        console.error('Error creating short domain:', error);
        return '调用短域名服务时发生网络错误';
    }
};
