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

    const prompt = `Extraia TODAS as transações desta fatura de cartão de crédito.

REGRAS:
1. INCLUIR: todas as linhas com valor POSITIVO
2. EXCLUIR: Pag Fat Deb Cc, PAGAMENTO, Devolucao de Compras (negativo), Parcela Gratis de An (negativo), DEBITO DE IOF, totais, cabeçalhos, qualquer linha com valor NEGATIVO
3. tipo = sempre "despesa"
4. Data no formato YYYY-MM-DD (data original da compra)
5. Se houver parcela ex "07/10", inclua na descrição: "Arezzo Itabira (7/10)"
6. cartao = nome do cartão (ex: "Visa Sicredi" ou "Mastercard Sicredi")
7. fatura = mês/ano de vencimento (ex: "Março/2026")

CATEGORIAS — use exatamente um destes nomes:
Supermercado | Restaurante | Combustível | Transporte | Moradia | Saúde | Educação | Lazer | Vestuário | Loja / Compras | Serviços / Assinaturas | Impostos pessoais | Investimentos | Empréstimos | Outros

CATEGORIZAÇÃO:
- FARMACIA / DROGARIAS / RAIA / PACHECO / FARMACIA INDIANA / DROGARIAS PACHECO → Saúde
- CARDIOADVANCE / médico / clínica / UNIMED / PLANO → Saúde
- AREZZO / PAGMODA / HMSC CONFECCOES / SEPHORA / COSMETICOS / GATZZ / OUT LET ESTILO → Vestuário
- SHOPEE / SHEIN / MERCADO LIVRE / MP MERCADOLIVRE / MP BAZAARBB / TEMU / EBN TEMU → Loja / Compras
- KALUNGA / UNIVERSO PRESENTES / LOJAS REGGLA / JIM COM / TIBES TEGNER / PAHUL COMERCIO → Loja / Compras
- MUNDO LUGANO / CASA LUGANO / AVENIDA BORGES / GRUPO GRAHAM → Loja / Compras
- POSTO / COMBUSTIVEL / GASOLINA / SHELL / IPIRANGA / PETROBRAS → Combustível
- SUPERMERCADO / MERCEARIA / PANITA / SUPERFOODS / HORTIFRUTTI / ATACADAO → Supermercado
- S J SUPERMERCADOS / JL SUPERMERCADOS / MAGNIFICO CARNES → Supermercado
- RESTAURANTE / PIZZARIA / LANCHONETE / ESPETINHO / PIZZA / HAMBURGUER / CAFE → Restaurante
- STEVE PIZZA / RESTAURANTE NENI / RESTAURANTE MALBEC / LA PORTEIRA / IFOOD / RAPPI → Restaurante
- PADARIA / SORVETERIA / BAR / CHURRASCARIA / DELIVERY / UBER EATS / FAMILIA PIRES → Restaurante
- HOTEL / IBIS / Wyndham / HOTEL CERCANO / AIRBNB → Lazer
- HOT PARK / PARQUE / ARENA / TRAMPOLIM / MEET / SPACE PARK → Lazer
- UBER / DL UberRid / UBER TRIP / UBER PENDING → Transporte
- GOL LINHAS / AZUL / AZULAWF / GOL / PASSAGEM → Transporte
- EG TR / DL EGTR (Expedia/viagens) / SMILES / Smiles Clube → Transporte
- NETFLIX / DL GOOGLE / APPLECOMBILL / Wellhub / IFD BR / HTM MEUASSESSOR → Serviços / Assinaturas
- YOUSE RESID / YOUSE AUTO → Serviços / Assinaturas
- ANUIDADE DIFERENC → Serviços / Assinaturas
- MAPLE BEAR / CLUBE DA LEITURA / DIPAPIE PAPELARIA → Educação
- M R SERVICOS DE IM / financiamento / parcela → Empréstimos

Responda SOMENTE com JSON válido:
{"cartao":"Visa Sicredi","fatura":"Março/2026","transacoes":[{"data":"2025-11-10","descricao":"Wyndham Gramado (4/6)","tipo":"despesa","valor":1630.36,"categoria":"Lazer","cartao":"Visa Sicredi"}]}`

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
        ],
      }),
    })

    const aiData = await res.json()
    if (aiData.error) return Response.json({ erro: aiData.error.message || 'Erro na API de IA' }, { status: 500 })

    const text = aiData.content?.[0]?.text ?? '{}'
    let resultado: any = {}
    try {
      resultado = JSON.parse(text)
    } catch {
      // tenta extrair JSON do meio do texto
      const match = text.match(/\{[\s\S]*\}/)
      if (match) try { resultado = JSON.parse(match[0]) } catch {}
    }

    // se transacoes não existe mas existe array direto, tenta adaptar
    if (!resultado.transacoes && Array.isArray(resultado)) {
      resultado = { transacoes: resultado }
    }

    if (!resultado.transacoes || !Array.isArray(resultado.transacoes) || resultado.transacoes.length === 0) {
      // retorna o texto bruto para diagnóstico
      return Response.json({
        erro: 'Não foi possível identificar transações nesta fatura.',
        debug: text.slice(0, 500),
      }, { status: 422 })
    }

    return Response.json({
      cartao: resultado.cartao || 'Cartão',
      fatura: resultado.fatura || '',
      transacoes: resultado.transacoes,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
