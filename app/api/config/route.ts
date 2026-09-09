import { validateAuth } from '@/lib/auth';
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
    // 管理端鉴权校验
    const auth = validateAuth(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.reason || '无权限修改系统配置 (Unauthorized)' },
        { status: 401 }
      );
    }

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
