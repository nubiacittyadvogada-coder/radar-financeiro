import { NextRequest } from 'next/server'
import { loginUsuario } from '@/server/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()
    if (!email || !senha) {
      return Response.json({ erro: 'Email e senha obrigatórios' }, { status: 400 })
    }

    const resultado = await loginUsuario(email, senha)
    if (!resultado) {
      return Response.json({ erro: 'Email ou senha inválidos' }, { status: 401 })
    }

    return Response.json({
      token: resultado.token,
      usuario: resultado.usuario,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
