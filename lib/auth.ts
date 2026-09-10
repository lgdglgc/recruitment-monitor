import { NextRequest } from 'next/server';

/**
 * 统一 API 校验函数
 * 免密模式：无须任何密码凭证，直接开放访问
 */
export function validateAuth(_req?: NextRequest): { authorized: boolean; reason?: string } {
  return { authorized: true };
}

/**
 * SSRF 安全防护检查
 * 确保爬虫请求的 URL 为公开合法的 HTTP/HTTPS 目标，阻断针对内网、本地回环或云元数据的探测
 */
export function isSafePublicUrl(urlString: string): { safe: boolean; reason?: string } {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, reason: 'URL 不能为空' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { safe: false, reason: 'URL 格式无效' };
  }

  // 1. 限制协议必须为 http 或 https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `不支持的协议类型: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. 拦截本地回环
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return { safe: false, reason: '禁止请求本地回环地址 (Localhost)' };
  }

  // 3. 拦截常见私有/局域网 IP 与 云服务元数据地址
  // 169.254.169.254 (AWS / GCP / Azure 实例元数据)
  if (hostname.startsWith('169.254.')) {
    return { safe: false, reason: '禁止请求云实例元数据地址 (Link-local)' };
  }

  // 10.0.0.0/8
  if (hostname.startsWith('10.')) {
    return { safe: false, reason: '禁止请求内网 A 类私有地址' };
  }

  // 192.168.0.0/16
  if (hostname.startsWith('192.168.')) {
    return { safe: false, reason: '禁止请求内网 C 类私有地址' };
  }

  // 172.16.0.0/12
  if (hostname.startsWith('172.')) {
    const parts = hostname.split('.');
    const second = parseInt(parts[1], 10);
    if (!isNaN(second) && second >= 16 && second <= 31) {
      return { safe: false, reason: '禁止请求内网 B 类私有地址' };
    }
  }

  // 4. 拦截内部域名后缀
  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  ) {
    return { safe: false, reason: '禁止请求内部保留域名' };
  }

  return { safe: true };
}
