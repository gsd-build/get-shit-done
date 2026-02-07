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

# Global GSD installation from LOCAL source
# We use npm pack to create a tarball, then install from it.
# This avoids the symlink issue that occurs with direct local installs.
COPY . /tmp/gsd-source
WORKDIR /tmp/gsd-source
RUN npm pack && npm install -g get-shit-done-cc-*.tgz && rm -rf /tmp/gsd-source

# Copy entrypoint script (path relative to repo root context)
COPY docker/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory to /app
# This is where the user's project will be mounted
WORKDIR /app

# Set entrypoint to our script
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Default command remains bash
CMD ["/bin/bash"]
