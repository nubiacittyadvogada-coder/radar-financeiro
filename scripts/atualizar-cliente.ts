import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const c = await p.cliente.update({
    where: { id: '14b98f63-f4f1-40df-a5e6-a6ac2eb9d584' },
    data: { email: 'matheus@tvnmonitoramento.com.br' }
  })
  console.log('✅ Atualizado:', c.nomeEmpresa, '|', c.responsavel)
  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
