# Stage 1: Packer - Create a clean tarball of the source
FROM node:20-slim AS packer
COPY . /tmp/gsd-source
WORKDIR /tmp/gsd-source
RUN npm pack

# Stage 2: Final - The actual runtime image
FROM node:20-slim

# Install system dependencies
# git: for version control
# python3: often used by build scripts or GSD agents
# curl/wget: for web fetch tools
# procps: for ps command
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    curl \
    wget \
    procps \
    nano \
    && rm -rf /var/lib/apt/lists/*

# Global GSD installation from PACKER stage
# We copy the tarball from the previous stage, install it, and remove it.
# This prevents the source code history from bloating the final image layers.
COPY --from=packer /tmp/gsd-source/*.tgz /tmp/
RUN npm install -g /tmp/*.tgz && rm -rf /tmp/*.tgz

# Copy entrypoint script (path relative to repo root context)
COPY docker/entrypoint.sh /usr/local/bin/
# Fix Windows CRLF line endings if present, then make executable
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

# Set working directory to /app
# This is where the user's project will be mounted
WORKDIR /app

# Set entrypoint to our script
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Default command remains bash
CMD ["/bin/bash"]
