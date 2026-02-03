import { NextResponse } from 'next/server'
import { getState } from '@/lib/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (): Promise<Response> => {
  const state = await getState()
  return NextResponse.json({ state })
}
