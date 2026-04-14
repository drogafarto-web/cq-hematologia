# ==========================================
# Etapa 1: Build da aplicação React
# ==========================================
FROM node:20-alpine AS builder

# Diretório de trabalho dentro do container
WORKDIR /app

# Copiar arquivos de descrição de dependências
COPY package.json package-lock.json ./

# Instalar dependências (um "npm ci" limpo)
RUN npm ci

# Copiar o resto do código da aplicação
COPY . .

# Fazer a compilação do Vite gerando a pasta /dist
RUN npm run build

# ==========================================
# Etapa 2: Servidor Web Nginx
# ==========================================
FROM nginx:alpine

# Apagar a configuração html default do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar os arquivos estáticos compilados do passo anterior (builder)
COPY --from=builder /app/dist /usr/share/nginx/html

# Ajustar as configurações do nginx para lidar com Rotas do React (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor a porta 80 que o Nginx usa por padrão
EXPOSE 80

# Iniciar o servidor
CMD ["nginx", "-g", "daemon off;"]
