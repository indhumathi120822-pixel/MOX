FROM ubuntu:14.04
RUN apt-get update && apt-get install -y openssl libssl-dev
COPY . /app
CMD ["node", "app.js"]
