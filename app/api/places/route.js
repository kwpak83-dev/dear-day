import { NextResponse } from 'next/server';

export async function GET(request) {
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ items: [] });
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ items: [] }, { status: 503 });
  const response = await fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, cache: 'no-store' });
  if (!response.ok) return NextResponse.json({ items: [] }, { status: response.status });
  return NextResponse.json(await response.json());
}
