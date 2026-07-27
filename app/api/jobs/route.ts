import { getRecentJobs } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const jobs = await getRecentJobs();
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query')?.toLowerCase().trim();
    const source = searchParams.get('source');

    let filtered = jobs;

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
