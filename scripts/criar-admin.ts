import prisma from '../src/server/lib/db'
import bcrypt from 'bcryptjs'

// ⬇️ TROQUE AQUI SEU EMAIL E SENHA
const EMAIL = 'nubiacittyadvogada@gmail.com'
const SENHA = 'nubiac08!'
const NOME  = 'Nubia'

async function main() {
  const hash = await bcrypt.hash(SENHA, 12)
  const u = await prisma.usuario.upsert({
    where: { email: EMAIL },
    update: { isAdmin: true, ativo: true, senhaHash: hash },
    create: { nome: NOME, email: EMAIL, senhaHash: hash, isAdmin: true, ativo: true },
  })
  console.log('\n✅ Admin criado/atualizado com sucesso!')
  console.log('   Email:', u.email)
  console.log('   Nome: ', u.nome)
  console.log('   ID:   ', u.id)
  console.log('\n👉 Acesse /login e depois /admin\n')
}

main()
  .catch((e) => { console.error('Erro:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
