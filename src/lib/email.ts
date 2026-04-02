import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || 'placeholder')
}

const FROM = process.env.EMAIL_FROM || 'Radar Financeiro <noreply@radarfinanceiro.com.br>'

export async function enviarEmailPagamentoRecebido({
  toEmail,
  toNome,
  nomeDevedor,
  descricao,
  valor,
}: {
  toEmail: string
  toNome: string
  nomeDevedor: string
  descricao: string
  valor: number
}) {
  const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: `✅ Pagamento recebido — ${nomeDevedor}`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
        <h2 style="color:#16a34a">Pagamento confirmado</h2>
        <p>Olá, <strong>${toNome}</strong>!</p>
        <p>Um pagamento foi confirmado via Asaas:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Devedor</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">${nomeDevedor}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Descrição</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${descricao}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Valor pago</td><td style="padding:8px;font-weight:700;color:#16a34a;font-size:20px">${valorFormatado}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px">Acesse o painel para mais detalhes.</p>
      </div>
    `,
  })
}

export async function enviarEmailAlteracaoSenha({ toEmail, toNome }: { toEmail: string; toNome: string }) {
  await getResend().emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Sua senha foi alterada — Radar Financeiro',
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px">
        <h2 style="color:#1d4ed8">Senha alterada com sucesso</h2>
        <p>Olá, <strong>${toNome}</strong>!</p>
        <p>Sua senha foi alterada. Se não foi você, entre em contato imediatamente.</p>
        <p style="color:#6b7280;font-size:13px">Radar Financeiro</p>
      </div>
    `,
  })
}
