import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings with environment-based configuration"""
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    IS_PRODUCTION: bool = ENVIRONMENT == "production"
    IS_DEVELOPMENT: bool = ENVIRONMENT == "development"
    IS_RAILWAY: bool = os.getenv("RAILWAY_ENVIRONMENT") is not None
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    API_BASE_URL: str = os.getenv("API_BASE_URL") or (
        f"https://{os.getenv('RAILWAY_PUBLIC_DOMAIN')}" if os.getenv("RAILWAY_PUBLIC_DOMAIN")
        else "http://localhost:8000"
    )
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/mist_db")
    
    # AWS
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "mist-music-cdn")
    
    # Redis (for Celery)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # CORS Configuration
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Return allowed origins based on environment"""
        if self.IS_DEVELOPMENT:
            return [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:8000",
            ]
        else:
            # Production: Only specific domains
            client_urls = os.getenv("CLIENT_URLS", "").split(",")
            origins = [url.strip() for url in client_urls if url.strip()]
            # If no CLIENT_URLS set, allow all origins (not recommended but prevents blocking)
            return origins if origins else ["*"]
    
    @property
    def CORS_ALLOW_CREDENTIALS(self) -> bool:
        """Allow credentials only in production with specific origins"""
        return True 
        #return self.IS_PRODUCTION#
    
    @property
    def KEY_CORS_ORIGIN(self) -> str:
        """CORS origin for encryption key endpoint"""
        if self.IS_DEVELOPMENT:
            return "*"
        else:
            # Production: Return first client URL
            client_urls = os.getenv("CLIENT_URLS", "")
            if client_urls:
                return client_urls.split(",")[0].strip()
            return "*"
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO" if IS_PRODUCTION else "DEBUG")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY") or SECRET_KEY
    
    def validate(self):
        """Validate critical production settings"""
        if self.IS_PRODUCTION:
            warnings = []
            errors = []
            
            if not self.AWS_ACCESS_KEY_ID:
                warnings.append("AWS_ACCESS_KEY_ID is not set - S3 uploads will not work")
            
            if not self.AWS_SECRET_ACCESS_KEY:
                warnings.append("AWS_SECRET_ACCESS_KEY is not set - S3 uploads will not work")
            
            
            if not os.getenv("CLIENT_URLS") and not self.IS_RAILWAY:
                warnings.append("CLIENT_URLS is not set - CORS may not work correctly")
            
            if self.SECRET_KEY == "dev-secret-key-change-in-production":
                errors.append("SECRET_KEY must be changed in production")
            
            if self.JWT_SECRET_KEY == "dev-secret-key-change-in-production":
                errors.append("JWT_SECRET_KEY must be changed in production")
            
            if warnings:
                print("\n⚠️  Configuration Warnings:")
                for warning in warnings:
                    print(f"  - {warning}")
                print()
            
            if errors:
                raise ValueError(
                    "Production configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
                )
    
    def print_config(self):
        """Print current configuration"""
        print("\n" + "="*50)
        print(f"MIST Music Streaming Platform")
        print("="*50)
        print(f"Environment:      {self.ENVIRONMENT}")
        print(f"Server:           {self.HOST}:{self.PORT}")
        print(f"API Base:         {self.API_BASE_URL}")
        print(f"S3 Bucket:        {self.S3_BUCKET_NAME}")
        print(f"CORS Origins:     {len(self.ALLOWED_ORIGINS)} allowed")
        print(f"Log Level:        {self.LOG_LEVEL}")
        print("="*50 + "\n")


settings = Settings()
