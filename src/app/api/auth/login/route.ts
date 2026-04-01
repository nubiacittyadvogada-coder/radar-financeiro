import { NextRequest } from 'next/server'
import { login } from '@/server/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, senha, tipo } = await req.json()

    if (!email || !senha || !tipo) {
      return Response.json({ erro: 'Email, senha e tipo são obrigatórios' }, { status: 400 })
    }

    if (tipo !== 'bpo' && tipo !== 'cliente') {
      return Response.json({ erro: 'Tipo deve ser "bpo" ou "cliente"' }, { status: 400 })
    }

    const resultado = await login(email, senha, tipo)
    if (!resultado) {
      return Response.json({ erro: 'Email ou senha inválidos' }, { status: 401 })
    }

    return Response.json({
      token: resultado.token,
      usuario: {
        id: resultado.usuario.id,
        tipo: resultado.usuario.tipo,
        email: resultado.usuario.email,
        bpoId: resultado.usuario.bpoId,
      },
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
