import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    IS_PRODUCTION: bool = ENVIRONMENT == "production"
    IS_DEVELOPMENT: bool = ENVIRONMENT == "development"
    IS_RAILWAY: bool = os.getenv("RAILWAY_ENVIRONMENT") is not None

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    API_BASE_URL: str = os.getenv("API_BASE_URL") or (
        f"https://{os.getenv('RAILWAY_PUBLIC_DOMAIN')}" if os.getenv("RAILWAY_PUBLIC_DOMAIN")
        else "http://localhost:8000"
    )

    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/mist_db")

    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "mist-music-cdn")

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY") or SECRET_KEY

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO" if IS_PRODUCTION else "DEBUG")

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        if self.IS_DEVELOPMENT:
            return [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:8000",
            ]
        client_urls = os.getenv("CLIENT_URLS", "").split(",")
        origins = [url.strip() for url in client_urls if url.strip()]
        return origins if origins else ["*"]

    @property
    def KEY_CORS_ORIGIN(self) -> str:
        if self.IS_DEVELOPMENT:
            return "*"
        client_urls = os.getenv("CLIENT_URLS", "")
        if client_urls:
            return client_urls.split(",")[0].strip()
        return "*"

    @property
    def KEY_ALLOWED_ORIGINS(self) -> List[str]:
        if self.IS_DEVELOPMENT:
            return ["*"]
        client_urls = os.getenv("CLIENT_URLS", "").split(",")
        origins = [url.strip() for url in client_urls if url.strip()]
        return origins if origins else ["*"]

    def get_key_cors_origin(self, request_origin: str | None) -> str:
        allowed_origins = self.KEY_ALLOWED_ORIGINS

        if "*" in allowed_origins:
            return "*"

        if request_origin and request_origin in allowed_origins:
            return request_origin

        return allowed_origins[0]

    def validate(self):
        if self.IS_PRODUCTION:
            errors = []
            warnings = []
            if not self.AWS_ACCESS_KEY_ID:
                warnings.append("AWS_ACCESS_KEY_ID not set - S3 will not work")
            if not self.AWS_SECRET_ACCESS_KEY:
                warnings.append("AWS_SECRET_ACCESS_KEY not set - S3 will not work")
            if self.SECRET_KEY == "dev-secret-key-change-in-production":
                errors.append("SECRET_KEY must be changed in production")
            if warnings:
                for w in warnings:
                    print(f"  WARNING: {w}")
            if errors:
                raise ValueError("Production config errors:\n" + "\n".join(errors))


settings = Settings()
