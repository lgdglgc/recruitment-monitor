import { createAdapter } from '@/lib/scraper';
import { getFilterConfig } from '@/lib/dynamic-config';
import { filterJobs } from '@/lib/filter';
import { SourceConfig } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source: SourceConfig = body.source;

    if (!source || !source.url) {
      return NextResponse.json(
        { success: false, error: '缺少数据源配置或 URL 参数' },
        { status: 400 }
      );
    }

    const adapter = createAdapter(source);
    const rawItems = await adapter.fetchItems();

    const filterConfig = await getFilterConfig();
    const matchedItems = filterJobs(rawItems, filterConfig);

    return NextResponse.json({
      success: true,
      totalFetched: rawItems.length,
      matchedCount: matchedItems.length,
      rawItems,
      matchedItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || '测试抓取过程中发生未知错误' },
      { status: 500 }
    );
  }
}
