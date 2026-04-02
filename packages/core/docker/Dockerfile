FROM node:22-slim
RUN npm install -g @anthropic-ai/claude-code
RUN useradd -m -s /bin/bash coder
USER coder
WORKDIR /workspace
ENTRYPOINT ["claude"]
