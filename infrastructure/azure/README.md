# GSD Labs Azure Deployment

Deploy GSD Dashboard to Azure Container Apps with HTTP Basic Authentication.

## Prerequisites

- Azure CLI (`az`) installed and logged in
- Terraform >= 1.0
- Docker
- Access to Azure Container Registry (aversoftacr.azurecr.io)

## Quick Start

### 1. Set up Azure credentials

```bash
# Login to Azure
az login

# Set subscription (if needed)
az account set --subscription "Your Subscription Name"

# Login to ACR
az acr login --name aversoftacr
```

### 2. Build and push Docker images

From the repository root:

```bash
# Build server image
docker build -f apps/server/Dockerfile -t aversoftacr.azurecr.io/gsd-server:latest .

# Build web image (pass API URLs for build-time)
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://ca-gsd-server.internal.southafricanorth.azurecontainerapps.io \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://ca-gsd-server.internal.southafricanorth.azurecontainerapps.io \
  -t aversoftacr.azurecr.io/gsd-web:latest .

# Push images
docker push aversoftacr.azurecr.io/gsd-server:latest
docker push aversoftacr.azurecr.io/gsd-web:latest
```

### 3. Deploy with Terraform

```bash
cd infrastructure/azure

# Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your credentials

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 4. Configure custom domain

After deployment, get the Container App FQDNs:

```bash
terraform output web_fqdn
terraform output server_fqdn
```

Update the DNS records in `/Users/mauricevandermerwe/Projects/aversoft/infrastructure`:

```bash
cd /Users/mauricevandermerwe/Projects/aversoft/infrastructure

# Update terraform.tfvars with the FQDNs
# gsd_labs_fqdn     = "<web_fqdn>"
# gsd_labs_api_fqdn = "<server_fqdn>"

terraform apply
```

## GitHub Actions Deployment

For automated deployments, configure these secrets in your repository:

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Azure service principal JSON |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AUTH_USERNAME` | Basic auth username |
| `AUTH_PASSWORD` | Basic auth password |

Create the Azure service principal:

```bash
az ad sp create-for-rbac \
  --name "gsd-labs-deploy" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-gsd-labs \
  --sdk-auth
```

## Architecture

```
                    ┌─────────────────────────────────┐
                    │   labs.aversoft.net (Route53)   │
                    └─────────────┬───────────────────┘
                                  │
                    ┌─────────────▼───────────────────┐
                    │  Azure Container App: ca-gsd-web │
                    │  Next.js Frontend (Port 3000)    │
                    │  - Basic Auth Middleware         │
                    └─────────────┬───────────────────┘
                                  │
                    ┌─────────────▼───────────────────┐
                    │ Azure Container App: ca-gsd-server│
                    │ Hono REST + Socket.IO (Port 4000) │
                    │ - Basic Auth on /api/* (except health)│
                    └─────────────────────────────────┘
```

## Environment Variables

### Server (ca-gsd-server)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (4000) |
| `NODE_ENV` | production |
| `MOCK_EXECUTION` | true (demo mode) |
| `AUTH_USERNAME` | Basic auth username |
| `AUTH_PASSWORD` | Basic auth password |

### Web (ca-gsd-web)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (3000) |
| `NODE_ENV` | production |
| `NEXT_PUBLIC_API_URL` | Server API URL |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL |
| `AUTH_USERNAME` | Basic auth username |
| `AUTH_PASSWORD` | Basic auth password |
