#!/bin/bash
# Script de inicialização do Radar Financeiro API
# Carrega o .env e sobe o servidor corretamente

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📂 Pasta: $SCRIPT_DIR"

# Carregar variáveis do .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
  echo "✅ .env carregado"
else
  echo "⚠️  .env não encontrado"
fi

echo "🚀 Iniciando servidor na porta ${API_PORT:-3005}..."
npx tsx src/server/index.ts
