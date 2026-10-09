# Imagen de la API. Se construye desde la raíz del repositorio (contexto ".")
# para poder usar el package-lock.json del monorepo.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/api
COPY apps/api apps/api
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 3000
# Aplica las migraciones pendientes y luego reemplaza el shell por la API (exec),
# para que SIGTERM llegue a Node y se ejecute el apagado ordenado.
CMD ["sh", "-c", "node scripts/migrate.js && exec node src/server.js"]
