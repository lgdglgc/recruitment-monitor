import { getFilterConfig } from '@/lib/dynamic-config';
import { evaluateJobPreference } from '@/lib/filter';
import { getRecentJobs } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawJobs = await getRecentJobs();
    const filterConfig = await getFilterConfig();

    // 动态为历史所有岗位计算最新的个人求职画像匹配信息
    const jobs = rawJobs.map((job) => ({
      ...job,
      matchInfo: evaluateJobPreference(job, filterConfig.preferences),
    }));

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query')?.toLowerCase().trim();
    const source = searchParams.get('source');
    const matchedOnly = searchParams.get('matchedOnly') === 'true';

    let filtered = jobs;

    if (matchedOnly) {
      filtered = filtered.filter((job) => job.matchInfo?.isMatched);
    }

    if (query) {
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(query) ||
          (job.summary && job.summary.toLowerCase().includes(query))
      );
    }

    if (source) {
      filtered = filtered.filter((job) => job.sourceName === source);
    }

    return NextResponse.json({
      success: true,
      total: jobs.length,
      count: filtered.length,
      jobs: filtered,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
