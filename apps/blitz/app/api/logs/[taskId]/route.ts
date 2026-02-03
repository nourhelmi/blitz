import { NextResponse } from 'next/server'
import { readTaskLog } from '@/lib/logs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: {
    taskId: string
  }
}

export const GET = async (_request: Request, { params }: Params): Promise<Response> => {
  try {
    const log = await readTaskLog(params.taskId)
    return NextResponse.json({ log })
  } catch {
    return NextResponse.json({ log: '' })
  }
}
