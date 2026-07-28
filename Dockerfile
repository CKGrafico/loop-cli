FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends git gh && rm -rf /var/lib/apt/lists/*
RUN npm install -g @plainconceptsplatform/loop-task@latest
VOLUME ["/root/.loop-cli"]
ENTRYPOINT ["loop-task"]
