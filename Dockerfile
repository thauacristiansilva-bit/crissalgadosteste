# SaborFlow - compilacao alternativa no Railway
# Esta imagem substitui as etapas automaticas do Railpack.
FROM node:22-bookworm-slim

WORKDIR /app

# Dependencias instaladas de forma reproduzivel pelo lockfile.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Nao copiar .env nem segredos para a imagem (veja .dockerignore).
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
