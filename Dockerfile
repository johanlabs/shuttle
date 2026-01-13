FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* ./

RUN npm install --production

COPY server.js ./

EXPOSE 5332

CMD ["node", "server.js"]