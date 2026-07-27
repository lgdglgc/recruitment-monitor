import { runMonitoringWorkflow } from '@/lib/scraper';
import { NextRequest, NextResponse } from 'next/server';

// 确保函数在 Node.js Serverless 运行时中执行，并开启 dynamic 模式
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 定时任务 Trigger Handler
 * 允许 GET 与 POST 触发
 */
export async function GET(req: NextRequest) {
  return handleCronTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleCronTrigger(req);
}

async function handleCronTrigger(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const secretParam = req.nextUrl.searchParams.get('secret');

    const expectedSecret = process.env.CRON_SECRET;

    // 校验 Authorization 密钥 (如配置了 CRON_SECRET)
    if (expectedSecret) {
      const isHeaderMatch = authHeader === `Bearer ${expectedSecret}`;
      const isParamMatch = secretParam === expectedSecret;

      if (!isHeaderMatch && !isParamMatch) {
        console.warn('[Cron Auth Alert] 尝试访问 Cron 路由但密钥不符合！');
        return NextResponse.json(
          { success: false, message: 'Unauthorized: Invalid CRON_SECRET token.' },
          { status: 401 }
        );
      }
    }

    // 运行主逻辑
    const result = await runMonitoringWorkflow();

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Cron API Error] 定时任务运行异常:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
