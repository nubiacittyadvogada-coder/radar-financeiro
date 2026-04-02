import { NextRequest } from 'next/server'
import { cadastrarUsuario, gerarToken } from '@/server/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { nome, email, senha } = await req.json()
    if (!nome || !email || !senha) {
      return Response.json({ erro: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    }
    if (senha.length < 6) {
      return Response.json({ erro: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
    }

    const usuario = await cadastrarUsuario(nome, email, senha)
    const token = gerarToken(usuario)

    return Response.json({ token, usuario }, { status: 201 })
  } catch (err: any) {
    const status = err.message === 'Email já cadastrado' ? 409 : 500
    return Response.json({ erro: err.message }, { status })
  }
}
