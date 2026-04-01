import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const p = new PrismaClient()
async function main() {
  const hash = await bcrypt.hash('123456', 10)
  await p.cliente.update({
    where: { id: '20b75982-08df-4e40-a662-d87389374495' },
    data: { senhaHash: hash }
  })
  // Deletar cliente duplicado
  await p.cliente.delete({ where: { id: '8d58a816-8eb7-4d3c-a562-fe1b2ea2b6f6' } })
  console.log('Senha redefinida para cliente@radarfinanceiro.com → 123456')
  console.log('Cliente duplicado removido')
  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
