FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
