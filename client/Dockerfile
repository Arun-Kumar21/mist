# Client Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

ARG VITE_SERVER_URL=http://localhost:8000/api/v1
ENV VITE_SERVER_URL=$VITE_SERVER_URL

RUN npm run build 

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
