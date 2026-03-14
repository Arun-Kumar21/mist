from setuptools import setup, find_packages

setup(
    name="mist-shared",
    version="1.0.0",
    packages=find_packages(),
    py_modules=["config"],
    install_requires=[
        "sqlalchemy",
        "psycopg2-binary",
        "pgvector",
        "python-dotenv",
        "bcrypt",
        "python-jose[cryptography]",
        "passlib",
    ],
)
