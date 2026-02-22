from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Telegram
    telegram_bot_token: str

    # Anthropic
    anthropic_api_key: str
    anthropic_model: str = "claude-sonnet-4-5-20250929"

    # Database
    database_url: str
    database_pool_size: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Payments
    yookassa_shop_id: str = ""
    yookassa_secret_key: str = ""

    # Subscription prices (RUB)
    price_micro: int = 990
    price_small: int = 2990
    price_medium: int = 9990
    price_pro_extra_project: int = 490

    # Project limits
    max_projects_micro: int = 1
    max_projects_small: int = 1
    max_projects_medium: int = 1
    max_projects_pro: int = 3
    max_projects_agency: int = 10

    # Data retention
    data_retention_days: int = 180

    # App
    environment: str = "development"
    log_level: str = "INFO"
    webhook_url: str = ""
    webhook_secret: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
