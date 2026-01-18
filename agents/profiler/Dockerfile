# Data Profiler Agent Docker Image
# Base: Python 3.11 slim for minimal size

FROM python:3.11-slim

# Install system dependencies for scipy compilation and other build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the profiler agent code
COPY . /app/agents/profiler/

# Set PYTHONPATH to include the agents directory for imports
ENV PYTHONPATH="/app:${PYTHONPATH}"

# Default environment variables (overridden by container config)
ENV SOURCE_TYPE=""
ENV DATABASE=""
ENV TABLE=""
ENV CONNECTION_PARAMS="{}"
ENV SUPABASE_URL=""
ENV SUPABASE_KEY=""
ENV S3_BUCKET=""
ENV RUN_ID=""

# Health check - verify Python and imports work
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "from agents.profiler.agent import profiler_agent; print('healthy')" || exit 1

# Run the entrypoint script
ENTRYPOINT ["python", "/app/agents/profiler/entrypoint.py"]
