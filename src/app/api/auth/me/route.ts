import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'

export async function GET(req: NextRequest) {
  const u = getUsuario(req)
  if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  return Response.json({ usuario: u })
}
