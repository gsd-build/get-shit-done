terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "tfstate"
    storage_account_name = "aversofttfstate"
    container_name       = "tfstate"
    key                  = "gsd-labs.tfstate"
  }
}

provider "azurerm" {
  features {}
}

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

variable "location" {
  description = "Azure region"
  type        = string
  default     = "South Africa North"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "auth_username" {
  description = "Basic auth username"
  type        = string
  sensitive   = true
}

variable "auth_password" {
  description = "Basic auth password"
  type        = string
  sensitive   = true
}

variable "acr_login_server" {
  description = "Azure Container Registry login server"
  type        = string
  default     = "aversoftacr.azurecr.io"
}

variable "acr_username" {
  description = "Azure Container Registry username"
  type        = string
  sensitive   = true
}

variable "acr_password" {
  description = "Azure Container Registry password"
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

# -----------------------------------------------------------------------------
# Resource Group
# -----------------------------------------------------------------------------

resource "azurerm_resource_group" "gsd" {
  name     = "rg-gsd-labs"
  location = var.location

  tags = {
    Environment = var.environment
    Project     = "gsd-labs"
    ManagedBy   = "terraform"
  }
}

# -----------------------------------------------------------------------------
# Log Analytics Workspace (required for Container Apps)
# -----------------------------------------------------------------------------

resource "azurerm_log_analytics_workspace" "gsd" {
  name                = "law-gsd-labs"
  location            = azurerm_resource_group.gsd.location
  resource_group_name = azurerm_resource_group.gsd.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = azurerm_resource_group.gsd.tags
}

# -----------------------------------------------------------------------------
# Container App Environment
# -----------------------------------------------------------------------------

resource "azurerm_container_app_environment" "gsd" {
  name                       = "cae-gsd-labs"
  location                   = azurerm_resource_group.gsd.location
  resource_group_name        = azurerm_resource_group.gsd.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.gsd.id

  tags = azurerm_resource_group.gsd.tags
}

# -----------------------------------------------------------------------------
# Container App - Server (API + Socket.IO)
# -----------------------------------------------------------------------------

resource "azurerm_container_app" "server" {
  name                         = "ca-gsd-server"
  container_app_environment_id = azurerm_container_app_environment.gsd.id
  resource_group_name          = azurerm_resource_group.gsd.name
  revision_mode                = "Single"

  registry {
    server               = var.acr_login_server
    username             = var.acr_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = var.acr_password
  }

  secret {
    name  = "auth-username"
    value = var.auth_username
  }

  secret {
    name  = "auth-password"
    value = var.auth_password
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "server"
      image  = "${var.acr_login_server}/gsd-server:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "4000"
      }

      env {
        name  = "MOCK_EXECUTION"
        value = "true"
      }

      env {
        name        = "AUTH_USERNAME"
        secret_name = "auth-username"
      }

      env {
        name        = "AUTH_PASSWORD"
        secret_name = "auth-password"
      }

      liveness_probe {
        path             = "/api/health/summary"
        port             = 4000
        transport        = "HTTP"
        initial_delay    = 10
        interval_seconds = 30
      }

      readiness_probe {
        path             = "/api/health/summary"
        port             = 4000
        transport        = "HTTP"
        initial_delay    = 5
        interval_seconds = 10
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 4000
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = azurerm_resource_group.gsd.tags
}

# -----------------------------------------------------------------------------
# Container App - Web (Next.js Frontend)
# -----------------------------------------------------------------------------

resource "azurerm_container_app" "web" {
  name                         = "ca-gsd-web"
  container_app_environment_id = azurerm_container_app_environment.gsd.id
  resource_group_name          = azurerm_resource_group.gsd.name
  revision_mode                = "Single"

  registry {
    server               = var.acr_login_server
    username             = var.acr_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = var.acr_password
  }

  secret {
    name  = "auth-username"
    value = var.auth_username
  }

  secret {
    name  = "auth-password"
    value = var.auth_password
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "web"
      image  = "${var.acr_login_server}/gsd-web:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://${azurerm_container_app.server.ingress[0].fqdn}"
      }

      env {
        name  = "NEXT_PUBLIC_SOCKET_URL"
        value = "https://${azurerm_container_app.server.ingress[0].fqdn}"
      }

      env {
        name        = "AUTH_USERNAME"
        secret_name = "auth-username"
      }

      env {
        name        = "AUTH_PASSWORD"
        secret_name = "auth-password"
      }

      liveness_probe {
        path             = "/"
        port             = 3000
        transport        = "HTTP"
        initial_delay    = 10
        interval_seconds = 30
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = azurerm_resource_group.gsd.tags
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "server_fqdn" {
  value       = azurerm_container_app.server.ingress[0].fqdn
  description = "Server container app FQDN"
}

output "web_fqdn" {
  value       = azurerm_container_app.web.ingress[0].fqdn
  description = "Web container app FQDN"
}

output "web_url" {
  value       = "https://${azurerm_container_app.web.ingress[0].fqdn}"
  description = "Web application URL"
}
