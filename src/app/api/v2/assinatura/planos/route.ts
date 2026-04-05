import { PLANOS } from '@/lib/planos'

export async function GET() {
  return Response.json(PLANOS)
}
