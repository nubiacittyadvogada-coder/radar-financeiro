import { NextRequest, NextResponse } from 'next/server'

// Rotas protegidas — requerem autenticação
const ROTAS_PROTEGIDAS = ['/pessoal', '/empresa', '/admin', '/bpo', '/dashboard', '/onboarding', '/conta']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Verifica se é rota protegida
  const protegida = ROTAS_PROTEGIDAS.some((r) => pathname.startsWith(r))
  if (!protegida) return NextResponse.next()

  // Verifica cookie de sessão (definido no login)
  const sessao = req.cookies.get('radar_sessao')
  if (!sessao?.value) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/pessoal/:path*',
    '/empresa/:path*',
    '/admin/:path*',
    '/bpo/:path*',
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/conta/:path*',
  ],
}
