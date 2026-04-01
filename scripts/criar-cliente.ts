import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Buscar BPO existente
  const bpos = await prisma.bpo.findMany()
  console.log('BPOs encontrados:', bpos.map(b => ({ id: b.id, nome: b.nome, email: b.email })))

  const clientes = await prisma.cliente.findMany()
  console.log('Clientes existentes:', clientes.map(c => ({ id: c.id, nome: c.nomeEmpresa, email: c.email })))

  if (bpos.length === 0) {
    console.log('Nenhum BPO encontrado.')
    return
  }

  const bpoId = bpos[0].id

  // Verificar se já existe
  const existe = await prisma.cliente.findUnique({
    where: { email: 'marido@segurancaeletronica.com.br' }
  })
  if (existe) {
    console.log('Cliente já existe:', existe.id)
    console.log('Email: marido@segurancaeletronica.com.br')
    console.log('Senha: 123456')
    await prisma.$disconnect()
    return
  }

  const senhaHash = await bcrypt.hash('123456', 10)

  const novoCliente = await prisma.cliente.create({
    data: {
      bpoId,
      nomeEmpresa: 'Empresa de Segurança Eletrônica',
      setor: 'seguranca',
      responsavel: 'Marido de Núbia',
      email: 'marido@segurancaeletronica.com.br',
      senhaHash,
      ativo: true,
    }
  })

  console.log('\n✅ Cliente criado com sucesso!')
  console.log('ID:', novoCliente.id)
  console.log('Empresa:', novoCliente.nomeEmpresa)
  console.log('Email de acesso: marido@segurancaeletronica.com.br')
  console.log('Senha: 123456')
  console.log('\nAcesse: http://localhost:3002/login')

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
