FROM node:20-slim

WORKDIR /app

# OpenSSL necessário para o Prisma em runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copiar package.json e lock file
COPY package*.json ./

# Instalar dependências SEM rodar postinstall (prisma generate precisa de rede)
RUN npm ci --ignore-scripts

# Copiar código fonte
COPY . .

EXPOSE 3000

# prisma generate roda no startup (quando há acesso à rede/CDN do Prisma)
CMD ["sh", "-c", "npx prisma generate && npx tsx src/server/index.ts"]
