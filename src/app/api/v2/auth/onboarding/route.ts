import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { gerarToken } from '@/server/lib/auth'

// POST /api/v2/auth/onboarding
// body: { modos: ['empresa', 'pessoal'], empresa?: { nomeEmpresa, cnpj, setor, telefoneAlerta } }
export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') {
      return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    }

    const { modos, empresa } = await req.json()
    if (!Array.isArray(modos) || modos.length === 0) {
      return Response.json({ erro: 'modos[] obrigatório' }, { status: 400 })
    }

    if (modos.includes('empresa')) {
      const jaExiste = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
      if (!jaExiste) {
        await prisma.contaEmpresa.create({
          data: {
            usuarioId: u.id,
            nomeEmpresa: empresa?.nomeEmpresa || '',
            cnpj: empresa?.cnpj || null,
            setor: empresa?.setor || null,
            telefoneAlerta: empresa?.telefoneAlerta || null,
          },
        })
      }
    }

    if (modos.includes('pessoal')) {
      const jaExiste = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
      if (!jaExiste) {
        const cp = await prisma.contaPessoal.create({ data: { usuarioId: u.id } })

        // Cria categorias padrão
        const categoriasPadrao = [
          { nome: 'Salário', tipo: 'receita' },
          { nome: 'Freelance', tipo: 'receita' },
          { nome: 'Investimentos', tipo: 'receita' },
          { nome: 'Outros Rendimentos', tipo: 'receita' },
          { nome: 'Moradia', tipo: 'despesa' },
          { nome: 'Alimentação', tipo: 'despesa' },
          { nome: 'Transporte', tipo: 'despesa' },
          { nome: 'Saúde', tipo: 'despesa' },
          { nome: 'Educação', tipo: 'despesa' },
          { nome: 'Lazer', tipo: 'despesa' },
          { nome: 'Vestuário', tipo: 'despesa' },
          { nome: 'Serviços / Assinaturas', tipo: 'despesa' },
          { nome: 'Impostos pessoais', tipo: 'despesa' },
          { nome: 'Outros', tipo: 'despesa' },
        ]
        await prisma.categoriaPessoal.createMany({
          data: categoriasPadrao.map((c) => ({ ...c, contaPessoalId: cp.id, padrao: true })),
        })
      }
    }

    // Gera novo token com flags atualizadas
    const usuario = await prisma.usuario.findUnique({
      where: { id: u.id },
      include: { contaEmpresa: true, contaPessoal: true },
    })
    const novoPayload = {
      id: u.id,
      tipo: 'usuario' as const,
      email: u.email,
      nome: usuario?.nome,
      temEmpresa: !!usuario?.contaEmpresa,
      temPessoal: !!usuario?.contaPessoal,
    }
    const token = gerarToken(novoPayload)

    return Response.json({ token, usuario: novoPayload })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
