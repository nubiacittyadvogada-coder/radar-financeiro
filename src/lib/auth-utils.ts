import { NextRequest } from 'next/server'
import { verificarToken, TokenPayload } from '@/server/lib/auth'

export type { TokenPayload }

export function getUsuario(req: NextRequest): TokenPayload | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    return verificarToken(auth.slice(7))
  } catch {
    return null
  }
}

export function requireUsuario(req: NextRequest): TokenPayload | Response {
  const u = getUsuario(req)
  if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })
  return u
}

export function isBpo(u: TokenPayload) {
  return u.tipo === 'bpo' || u.tipo === 'usuario_bpo'
}
