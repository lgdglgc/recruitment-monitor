import { AIAnalysisResult, JobItem } from './types';

const AI_BASE_URL = (process.env.AI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const AI_TIMEOUT_MS = 12000;

/**
 * 检查是否已启用 AI 智能分析
 */
export function isAIEnabled(): boolean {
  return process.env.AI_ENABLE !== 'false' && Boolean(AI_API_KEY);
}

/**
 * 清理可能存在的 Markdown 代码块包裹符，提取纯 JSON 字符串
 */
function cleanJsonString(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  return text;
}

/**
 * 对单条招聘信息进行 AI 深度语义提炼
 */
export async function analyzeJobWithAI(item: JobItem): Promise<AIAnalysisResult | null> {
  if (!isAIEnabled()) return null;

  const endpoint = `${AI_BASE_URL}/chat/completions`;

  const systemPrompt = `你是一个资深招聘与人事招考信息分析专家。
请根据给定的招聘信息标题、来源以及可能存在的摘要内容，提取核心招录关键信息并生成结构化速览简报。
请严格输出 JSON 格式（不要输出 markdown 解释代码以外的闲聊文字），字段定义如下：
{
  "summary": "一句话核心速览，30字以内 (如: 南阳市县事业单位统考招录156人)",
  "targetAudience": "招录对象 (如: 高校应届生/社会在职/高层次人才)",
  "requirements": "主要学历或专业要求 (如: 大专/本科及以上，含计算机/管理类)",
  "deadline": "推断的报名或考试时间点 (如未标明则写'见原文通知')",
  "isRecruitment": true,
  "highlights": ["事业编制", "南阳市县联考", "统招"]
}`;

  const userContent = `【招聘标题】：${item.title}
【数据来源】：${item.sourceName}
【原文链接】：${item.link}
${item.summary ? `【已有摘要】：${item.summary}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 350,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[AI Analysis] 调用大模型失败: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    const cleaned = cleanJsonString(rawContent);
    const parsed = JSON.parse(cleaned) as AIAnalysisResult;

    return {
      summary: parsed.summary || item.title,
      targetAudience: parsed.targetAudience,
      requirements: parsed.requirements,
      deadline: parsed.deadline,
      isRecruitment: parsed.isRecruitment !== false,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    };
  } catch (error: any) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      console.warn(`[AI Analysis Timeout] 分析岗位 [${item.title.slice(0, 20)}...] 超时 (${AI_TIMEOUT_MS}ms)`);
    } else {
      console.warn(`[AI Analysis Exception] 解析岗位异常:`, error.message);
    }
    return null;
  }
}

/**
 * 批量并行分析待推送的全新招聘条目
 * 仅对通过关键词过滤与 Redis 去重后的新岗位调用，保障速度并严格控制 Token 消耗
 */
export async function batchAnalyzeJobsWithAI(items: JobItem[]): Promise<JobItem[]> {
  if (!isAIEnabled() || !items || items.length === 0) {
    return items;
  }

  console.log(`[AI Analysis] 正在使用模型 [${AI_MODEL}] 智能提炼 ${items.length} 条全新招聘公告...`);

  const tasks = items.map(async (item) => {
    try {
      const analysis = await analyzeJobWithAI(item);
      if (analysis) {
        return {
          ...item,
          aiAnalysis: analysis,
        };
      }
    } catch (e) {}
    return item;
  });

  const results = await Promise.allSettled(tasks);

  return results.map((r, index) => (r.status === 'fulfilled' ? r.value : items[index]));
}
