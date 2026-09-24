FROM node:22-slim
WORKDIR /app
COPY packages/contracts packages/contracts
COPY apps/game-server/package.json apps/game-server/package-lock.json apps/game-server/
RUN cd apps/game-server && npm ci --omit=dev
COPY apps/game-server apps/game-server
# zod para los contratos compartidos
RUN cd packages/contracts && ln -s ../../apps/game-server/node_modules node_modules
WORKDIR /app/apps/game-server
EXPOSE 2567
CMD ["npx", "tsx", "src/index.ts"]
