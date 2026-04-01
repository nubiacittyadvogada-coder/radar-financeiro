FROM node:20-slim

WORKDIR /app

# Instalar OpenSSL (necessário para o Prisma no Debian slim)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copiar package.json e lock file
COPY package*.json ./

# Instalar dependências (incluindo devDeps para ter tsx/typescript disponível)
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Expor porta (Railway sobrescreve via PORT env var)
EXPOSE 3000

# Iniciar o servidor Express
CMD ["npx", "tsx", "src/server/index.ts"]
