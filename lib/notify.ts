import { JobItem } from './types';

/**
 * Server酱 (ServerChan Turbo) 消息推送模块
 */

/**
 * 将匹配的招聘条目格式化为整洁的 Markdown Digest 消息
 */
export function formatMarkdownDigest(items: JobItem[]): { title: string; desp: string } {
  const count = items.length;
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/\//g, '-');

  const timeStr = now.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

  const title = `📢 招聘监控日报 (${dateStr}) - 今日新增 ${count} 条匹配岗位`;

  let desp = `### 📢 招聘监控每日提醒 (${dateStr})\n\n`;
  desp += `> **推送日期**：${dateStr} ${timeStr} (北京时间)\n`;
  desp += `> **今日新增**：经过关键词筛选与自动去重，今日收录 **${count}** 条新岗位：\n\n`;
  desp += `---\n\n`;

  items.forEach((item, index) => {
    desp += `#### ${index + 1}. [${item.title}](${item.link})\n`;
    desp += `- **来源平台**: \`${item.sourceName}\``;
    if (item.date) {
      desp += ` | **公告发布**: \`${item.date}\``;
    }
    desp += ` | **收录日期**: \`${item.crawledDate || dateStr}\``;
    desp += `\n\n`;

    if (item.summary) {
      const cleanSummary = item.summary.replace(/\s+/g, ' ').slice(0, 150);
      desp += `- **摘要内容**: ${cleanSummary}...\n\n`;
    }

    desp += `[👉 点击查看原文公告](${item.link})\n\n`;
    desp += `---\n\n`;
  });

  desp += `*由 Recruitment Monitor 定时监控系统自动发送*`;

  return { title, desp };
}

/**
 * 发送 Server酱 微信推送
 */
export async function sendServerChanNotification(items: JobItem[]): Promise<boolean> {
  const sendKey = process.env.SERVERCHAN_SENDKEY;
  if (!sendKey) return false;

  const { title, desp } = formatMarkdownDigest(items);
  const serverChanUrl = `https://sctapi.ftqq.com/${sendKey}.send`;

  try {
    const response = await fetch(serverChanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ title, desp }),
    });
    const data = await response.json();
    if (data.code === 0 || data.errno === 0) {
      console.log(`[Server酱] 成功推送 ${items.length} 条招聘提醒！`);
      return true;
    }
    console.error('[Server酱 Error] 推送失败:', data);
    return false;
  } catch (error: any) {
    console.error('[Server酱 Exception]:', error.message);
    return false;
  }
}

/**
 * 发送 企业微信群机器人 Webhook 推送
 */
export async function sendQywxNotification(items: JobItem[]): Promise<boolean> {
  const webhookUrl = process.env.QYWX_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const { desp } = formatMarkdownDigest(items);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          content: desp,
        },
      }),
    });
    const data = await response.json();
    if (data.errcode === 0) {
      console.log(`[企业微信] 机器人成功推送 ${items.length} 条招聘提醒！`);
      return true;
    }
    console.error('[企业微信 Error] 推送失败:', data);
    return false;
  } catch (error: any) {
    console.error('[企业微信 Exception]:', error.message);
    return false;
  }
}

/**
 * 发送 飞书群机器人 Webhook 推送
 */
export async function sendFeishuNotification(items: JobItem[]): Promise<boolean> {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const { title, desp } = formatMarkdownDigest(items);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: title },
            template: 'blue',
          },
          elements: [
            {
              tag: 'markdown',
              content: desp,
            },
          ],
        },
      }),
    });
    const data = await response.json();
    if (data.code === 0 || data.StatusCode === 0) {
      console.log(`[飞书] 机器人成功推送 ${items.length} 条招聘提醒！`);
      return true;
    }
    console.error('[飞书 Error] 推送失败:', data);
    return false;
  } catch (error: any) {
    console.error('[飞书 Exception]:', error.message);
    return false;
  }
}

/**
 * 发送 钉钉群机器人 Webhook 推送
 */
export async function sendDingTalkNotification(items: JobItem[]): Promise<boolean> {
  const webhookUrl = process.env.DINGTALK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const { title, desp } = formatMarkdownDigest(items);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title,
          text: desp,
        },
      }),
    });
    const data = await response.json();
    if (data.errcode === 0) {
      console.log(`[钉钉] 机器人成功推送 ${items.length} 条招聘提醒！`);
      return true;
    }
    console.error('[钉钉 Error] 推送失败:', data);
    return false;
  } catch (error: any) {
    console.error('[钉钉 Exception]:', error.message);
    return false;
  }
}

/**
 * 发送 PushPlus (推送加) 微信通知
 */
export async function sendPushPlusNotification(items: JobItem[]): Promise<boolean> {
  const token = process.env.PUSHPLUS_TOKEN;
  if (!token) return false;

  const { title, desp } = formatMarkdownDigest(items);

  try {
    const response = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        title,
        content: desp,
        template: 'markdown',
      }),
    });
    const data = await response.json();
    if (data.code === 200) {
      console.log(`[PushPlus] 成功推送 ${items.length} 条招聘提醒！`);
      return true;
    }
    console.error('[PushPlus Error] 推送失败:', data);
    return false;
  } catch (error: any) {
    console.error('[PushPlus Exception]:', error.message);
    return false;
  }
}

/**
 * 统一分发推送至所有已配置的渠道
 * 只要有一个渠道推送成功即视为成功，避免重复推送
 */
export async function sendAllNotifications(items: JobItem[]): Promise<boolean> {
  if (!items || items.length === 0) {
    console.log('[Notification] 没有新匹配的招聘条目，无需推送。');
    return true;
  }

  const channels = [
    { name: 'Server酱', fn: () => sendServerChanNotification(items), enabled: !!process.env.SERVERCHAN_SENDKEY },
    { name: '企业微信', fn: () => sendQywxNotification(items), enabled: !!process.env.QYWX_WEBHOOK_URL },
    { name: '飞书机器人', fn: () => sendFeishuNotification(items), enabled: !!process.env.FEISHU_WEBHOOK_URL },
    { name: '钉钉机器人', fn: () => sendDingTalkNotification(items), enabled: !!process.env.DINGTALK_WEBHOOK_URL },
    { name: 'PushPlus', fn: () => sendPushPlusNotification(items), enabled: !!process.env.PUSHPLUS_TOKEN },
  ];

  const activeChannels = channels.filter((c) => c.enabled);

  if (activeChannels.length === 0) {
    console.warn('[Notification Warning] 未检测到任何已配置的推送渠道 (Server酱/企微/飞书/钉钉/PushPlus)，跳过实际推送。');
    return true;
  }

  const results = await Promise.allSettled(activeChannels.map((c) => c.fn()));
  let anySuccess = false;

  results.forEach((res, idx) => {
    if (res.status === 'fulfilled' && res.value === true) {
      anySuccess = true;
    } else {
      console.error(`[Notification] 渠道 [${activeChannels[idx].name}] 推送未成功`);
    }
  });

  return anySuccess;
}
