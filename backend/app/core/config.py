import socket

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

    PROJECT_NAME: str = "NatWest Core Banking Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    INSTANCE_ID: str = socket.gethostname()

    # Database
    POSTGRES_SERVER: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "banking_user"
    POSTGRES_PASSWORD: str = "banking_secure_password_2026"
    POSTGRES_DB: str = "core_banking"
    DATABASE_URL: str | None = None
    ASYNC_DATABASE_URL: str | None = None

    # Security
    JWT_SECRET: str = "super-secret-jwt-key-natwest-production-ready-32char"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # Fraud Detection Strategy Pattern Thresholds
    FRAUD_LARGE_AMOUNT_THRESHOLD_PENCE: int = 1000000  # £10,000.00
    FRAUD_RAPID_REPEAT_WINDOW_SECONDS: int = 60
    FRAUD_RAPID_REPEAT_MAX_COUNT: int = 3
    FRAUD_ODD_HOURS_START: int = 1  # 01:00 UTC
    FRAUD_ODD_HOURS_END: int = 5    # 05:00 UTC

    # Mock Payment Gateway
    MOCK_GATEWAY_URL: str = "http://gateway:8001"
    GATEWAY_TIMEOUT_SECONDS: float = 3.0
    GATEWAY_MAX_RETRIES: int = 3

    @property
    def sync_db_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def async_db_url(self) -> str:
        if self.ASYNC_DATABASE_URL:
            return self.ASYNC_DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
