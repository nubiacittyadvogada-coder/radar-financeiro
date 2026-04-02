import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import { verificarSenha, hashSenha } from '@/server/lib/auth'
import { enviarEmailAlteracaoSenha } from '@/lib/email'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { senhaAtual, novaSenha } = await req.json()
    if (!senhaAtual || !novaSenha) {
      return Response.json({ erro: 'senhaAtual e novaSenha são obrigatórios' }, { status: 400 })
    }
    if (novaSenha.length < 6) {
      return Response.json({ erro: 'Nova senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: u.id } })
    if (!usuario) return Response.json({ erro: 'Usuário não encontrado' }, { status: 404 })

    const senhaOk = await verificarSenha(senhaAtual, usuario.senhaHash)
    if (!senhaOk) return Response.json({ erro: 'Senha atual incorreta' }, { status: 400 })

    const novoHash = await hashSenha(novaSenha)
    await prisma.usuario.update({ where: { id: u.id }, data: { senhaHash: novoHash } })

    // Email de confirmação (não bloqueia se falhar)
    enviarEmailAlteracaoSenha({ toEmail: usuario.email, toNome: usuario.nome }).catch(() => {})

    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
