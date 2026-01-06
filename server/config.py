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
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    API_BASE_URL: str = os.getenv("API_BASE_URL", "http://localhost:8000")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/mist_db")
    
    # AWS
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "mist-music-cdn")
    CLOUDFRONT_DOMAIN: str = os.getenv("CLOUDFRONT_DOMAIN", "")
    
    # Redis (for Celery)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # CORS Configuration
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Return allowed origins based on environment"""
        if self.IS_DEVELOPMENT:
            # Development: Allow localhost and file protocol
            return [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:8000",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:8000",
                "null"  # For local HTML files
            ]
        else:
            # Production: Only specific domains
            client_urls = os.getenv("CLIENT_URLS", "").split(",")
            return [url.strip() for url in client_urls if url.strip()]
    
    @property
    def CORS_ALLOW_CREDENTIALS(self) -> bool:
        """Allow credentials only in production with specific origins"""
        return self.IS_PRODUCTION
    
    @property
    def ENABLE_PROXY(self) -> bool:
        """Enable S3 proxy only in development"""
        return self.IS_DEVELOPMENT
    
    @property
    def KEY_CORS_ORIGIN(self) -> str:
        """CORS origin for encryption key endpoint"""
        if self.IS_DEVELOPMENT:
            return "*"
        else:
            # Production: Return first client URL or CloudFront domain
            client_urls = os.getenv("CLIENT_URLS", "")
            if client_urls:
                return client_urls.split(",")[0].strip()
            return f"https://{self.CLOUDFRONT_DOMAIN}" if self.CLOUDFRONT_DOMAIN else "*"
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO" if IS_PRODUCTION else "DEBUG")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    def validate(self):
        """Validate critical production settings"""
        if self.IS_PRODUCTION:
            errors = []
            
            if not self.AWS_ACCESS_KEY_ID:
                errors.append("AWS_ACCESS_KEY_ID is required in production")
            
            if not self.AWS_SECRET_ACCESS_KEY:
                errors.append("AWS_SECRET_ACCESS_KEY is required in production")
            
            if not self.CLOUDFRONT_DOMAIN:
                errors.append("CLOUDFRONT_DOMAIN is required in production")
            
            if not os.getenv("CLIENT_URLS"):
                errors.append("CLIENT_URLS is required in production")
            
            if self.SECRET_KEY == "dev-secret-key-change-in-production":
                errors.append("SECRET_KEY must be changed in production")
            
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
        print(f"CloudFront:       {self.CLOUDFRONT_DOMAIN or 'Not configured'}")
        print(f"Proxy Enabled:    {self.ENABLE_PROXY}")
        print(f"CORS Origins:     {len(self.ALLOWED_ORIGINS)} allowed")
        print(f"Log Level:        {self.LOG_LEVEL}")
        print("="*50 + "\n")


settings = Settings()
