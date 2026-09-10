import { runMonitoringWorkflow } from '@/lib/scraper';
import { NextRequest, NextResponse } from 'next/server';

// 确保函数在 Node.js Serverless 运行时中执行，并开启 dynamic 模式与 60 秒运行超时
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 定时任务 Trigger Handler
 * 允许 GET 与 POST 触发 (纯净免密模式)
 */
export async function GET(req: NextRequest) {
  return handleCronTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleCronTrigger(req);
}

async function handleCronTrigger(_req: NextRequest) {
  try {

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
