import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'

export const maxDuration = 60

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ erro: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ erro: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const prompt = `Analise este extrato bancário e extraia TODAS as transações financeiras reais.

═══ EXCLUIR (não incluir na lista) ═══
- Saldo inicial / saldo final / linhas de saldo
- PAGAMENTO PIX para "NUBIA DOS SANTOS CITTY" / CPF 11407456628 — transferência para conta própria
- PAGTO FATURA / DEB.CTA.FATURA / PAGAMENTO CARTAO / DEB CC / FAT CARTAO / DEBITO FATURA — pagamento de fatura CC (já contado)
- PAGAMENTO PIX para FERNANDA BORGES MON (CNPJ 50849168000144) — repasse empresarial

═══ INCLUIR como RECEITA (tipo="receita") ═══
- RECEBIMENTO PIX SICREDI / CNPJ 40993929000183 / NUBIA CIT → Salário
- RECEBIMENTO PIX SICREDI / CNPJ 35175758000145 / MATHEUS H → Salário
- RECEBIMENTO PIX ELI MAGNO DOS SANTOS → Freelance / Consultoria
- RECEBIMENTO PIX JADE HELENA OLIVEIRA → Freelance / Consultoria
- RECEBIMENTO PIX Vitoria Jovana → Freelance / Consultoria
- RECEBIMENTO PIX Camila Canedo → Freelance / Consultoria
- RECEBIMENTO PIX Vinicius Martins → Freelance / Consultoria
- RESG.APLIC.FIN / RESGATE / CAPTACAO (crédito) → Investimentos
- Todo RECEBIMENTO PIX de pessoa física não identificada acima → Freelance / Consultoria

═══ INCLUIR como DESPESA (tipo="despesa") ═══
- Todos os débitos: PIX enviado, boletos, compras, IOF, tarifas
- PAGAMENTO PIX SICREDI NUBIA CITTY (CNPJ 40993929000183) débito → Investimentos (aporte na empresa)

═══ CATEGORIAS — use EXATAMENTE um destes nomes ═══
Supermercado | Restaurante | Combustível | Transporte | Moradia | Saúde | Educação | Lazer | Vestuário | Loja / Compras | Serviços / Assinaturas | Impostos pessoais | Investimentos | Salário | Freelance / Consultoria | Empréstimos | Outros

═══ REGRAS DE CATEGORIZAÇÃO (aplique na ordem) ═══

SALÁRIO / RECEITA:
- NUBIA CIT / SICREDI NUBIA / CNPJ 40993929000183 → Salário
- MATHEUS HENRIQUE / CPF 11740146603 → Salário
- PIX recebido de pessoa física desconhecida → Freelance / Consultoria
- PIX recebido sem identificação clara → Freelance / Consultoria

MORADIA:
- CONDOMINIO / CONDOM → Moradia
- ALUGUEL / ALUGAR → Moradia
- AGUA / SANEAMENTO / COPASA / SAAE / EMBASA → Moradia
- LUZ / CEMIG / CELPE / COELBA / ENERGISA / ENEL / COPEL → Moradia
- GAS / COMGAS / CEG → Moradia
- IPTU / IPVA → Impostos pessoais

SAÚDE:
- CAIXA ASSISTENC / CASSI / UNIMED / AMIL / SULAMERICA / BRADESCO SAUDE → Saúde
- LIQUIDACAO BOLETO CAIXA ASSISTENC → Saúde (plano de saúde)
- PLANO DE SAUDE / CONVENIO / ODONTO / DENTAL → Saúde
- FARMACIA / DROGARIA / RAIA / PACHECO / PAGUE MENOS / FARMACIA INDIANA → Saúde
- LABORATORIO / LABORATORIO NOSSA / CLINICA / HOSPITAL / MEDICO / CARDIOADVANCE → Saúde

EDUCAÇÃO:
- MAPLE BEAR / COLÉGIO / ESCOLA / COLEGIO → Educação
- APRIMORART / CURSO / FACULDADE / UNIVERSIDADE → Educação
- MENSALIDADE ESCOLAR / BOLETO ESCOLAR → Educação

COMBUSTÍVEL:
- COMBUSTIVEL / GASOLINA / ETANOL / DIESEL → Combustível
- POSTO / AUTO POSTO / BR DISTRIBUIDORA → Combustível
- SHELL / PETROBRAS / IPIRANGA / RAIZEN → Combustível
- REDSUL / VIBRA → Combustível

TRANSPORTE:
- UBER / 99 / CABIFY / LYFT → Transporte
- PEDAGIO / BR-381 / AUTOBAN → Transporte
- PASSAGEM / ONIBUS / METRO → Transporte
- MECANICA / OFICINA / PNEU / BORRACHARIA → Transporte
- IPVA → Impostos pessoais

SUPERMERCADO:
- SUPERMERCADO / MERCADO / CARREFOUR / EXTRA / ATACADAO / ASSAI → Supermercado
- MAGNIFICO CARNES / JL SUPERMERCADOS / S J SUPERMERCADOS → Supermercado
- HORTIFRUTTI / HORTIFRUTI / ACOUGUE / MERCEARIA → Supermercado
- ATACAREJO / MAKRO / COSTCO / SAO CHARBEL → Supermercado

RESTAURANTE:
- PIZZARIA / PIZZA / RESTAURANTE / LANCHONETE → Restaurante
- BURGUER / HAMBURGUER / CHURRASCARIA → Restaurante
- PADARIA / CAFE / BAR / ESPETINHO / SORVETERIA → Restaurante
- DELIVERY / IFOOD / RAPPI / UBER EATS / AIQFOME → Restaurante

LOJA / COMPRAS:
- LOJA / LOJAS / MAGAZINE / MAGAZINE LUIZA / AMERICANAS → Loja / Compras
- MERCADO LIVRE / SHOPEE / MAGALU / SHOPTIME / WHALECO / TEMU → Loja / Compras
- NAYARA BIJUTEIRIAS / COSMETICOS FM / UNIVERSO PRESENTES → Loja / Compras
- EMBALAGENS / MATERIAL / FERRAGENS / KALUNGA → Loja / Compras

LAZER:
- ACADEMIA / ARENA / PARQUE / CLUBE / PRACA DE ESPORT → Lazer
- CINEMA / TEATRO / SHOW / INGRESSO / TICKETMASTER → Lazer
- VIAGEM / HOTEL / RESORT / AIRBNB / BOOKING → Lazer
- GOL / AZUL / LATAM / GOL LINHAS / SMILES / PASSAGEM AEREA → Transporte

VESTUÁRIO:
- AREZZO / SCHUTZ / SHEIN / SEPHORA / GATZZ / HMSC CONFECCOES → Vestuário
- CALCADOS / SAPATO / BOLSA / MODA / ROUPA / VESTUARIO → Vestuário
- RENNER / RIACHUELO / C&A / ZARA / HERING / PAGMODA → Vestuário

SERVIÇOS / ASSINATURAS:
- NETFLIX / SPOTIFY / APPLE / GOOGLE / AMAZON PRIME / DISNEY → Serviços / Assinaturas
- WELLHUB / GYMPASS / TIKTOK → Serviços / Assinaturas
- CESTA DE RELACIONAMENTO / ANUIDADE / TARIFA → Serviços / Assinaturas
- JUROS CH.ESPECIAL / JUROS UTILIZ / CHEQUE ESPECIAL → Serviços / Assinaturas
- DEBITO CONVENIOS / CLARSP / CLARO / VIVO / TIM / OI → Serviços / Assinaturas
- CERTIFICA / CERTIFICADO DIGITAL / SERPRO → Serviços / Assinaturas
- LIQUIDACAO BOLETO NU PAGAMENTOS (Nubank) → Serviços / Assinaturas
- INTERNET / BANDA LARGA / NET / CLARO NET → Moradia

EMPRÉSTIMOS / FINANCIAMENTOS:
- AMORTIZACAO CONTRATO / LIQUIDACAO DE PARCELA / PARCELA FINANC → Empréstimos
- FINANCIAMENTO / CREDITO PESSOAL / FGTS → Empréstimos

INVESTIMENTOS:
- APLIC.FIN / APLICACAO / APLIC (débito) → Investimentos
- RESG.APLIC.FIN / RESGATE / CAPTACAO (crédito) → Investimentos

IMPOSTOS:
- IOF BASICO / IOF ADICIONAL / IOF → Impostos pessoais
- DARF / IR / IMPOSTO → Impostos pessoais

OUTROS (apenas se não se enquadra em nenhuma categoria acima):
- PIX enviado para pessoa física sem contexto claro → Outros

═══ FORMATO DA RESPOSTA ═══
6. DESCRIÇÃO: nome limpo sem CPF/CNPJ/código. Ex: "Supermercado Pão de Açúcar", "Netflix", "Condomínio", "PIX recebido Christiane"

Responda APENAS JSON válido (sem markdown):
{
  "banco": "nome do banco",
  "periodo": "ex: Abril/2026",
  "transacoes": [
    {"data": "2026-04-02", "descricao": "Nome limpo", "tipo": "despesa", "valor": 259.00, "categoria": "Moradia"}
  ],
  "observacoes": "transferências internas ignoradas etc"
}`

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
          { role: 'assistant', content: '{' },
        ],
      }),
    })

    const aiData = await res.json()
    if (aiData.error) return Response.json({ erro: aiData.error.message || 'Erro na API de IA' }, { status: 500 })

    const text = '{' + (aiData.content?.[0]?.text ?? '{}')
    let resultado: any = {}
    try {
      resultado = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) try { resultado = JSON.parse(match[0]) } catch {}
    }

    if (!resultado.transacoes || !Array.isArray(resultado.transacoes)) {
      return Response.json({ erro: 'Não foi possível identificar transações neste PDF.' }, { status: 422 })
    }

    return Response.json({
      banco: resultado.banco || 'Desconhecido',
      periodo: resultado.periodo || '',
      observacoes: resultado.observacoes || '',
      transacoes: resultado.transacoes,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
