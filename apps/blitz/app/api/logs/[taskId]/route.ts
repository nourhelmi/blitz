import { NextResponse } from 'next/server'
import { readTaskLog } from '@/lib/logs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{
    taskId: string
  }>
}

export const GET = async (_request: Request, { params }: Params): Promise<Response> => {
  try {
    const { taskId } = await params
    const log = await readTaskLog(taskId)
    return NextResponse.json({ log })
  } catch {
    return NextResponse.json({ log: '' })
  }
}
