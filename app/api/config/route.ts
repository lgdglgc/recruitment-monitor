import { getFilterConfig, getSourcesConfig, saveFilterConfig, saveSourcesConfig } from '@/lib/dynamic-config';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sources = await getSourcesConfig();
    const filter = await getFilterConfig();
    return NextResponse.json({
      success: true,
      sources,
      filter,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.sources && Array.isArray(body.sources)) {
      await saveSourcesConfig(body.sources);
    }

    if (body.filter && typeof body.filter === 'object') {
      await saveFilterConfig(body.filter);
    }

    const updatedSources = await getSourcesConfig();
    const updatedFilter = await getFilterConfig();

    return NextResponse.json({
      success: true,
      message: '配置保存成功',
      sources: updatedSources,
      filter: updatedFilter,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
