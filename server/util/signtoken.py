from jose import jwt
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta , UTC

load_dotenv()



def sign_token(data: dict):
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        return None 
    
    to_encode = data.copy()

    expire = datetime.now(UTC) + timedelta(days=7)
    to_encode.update({"exp": expire})

    encode_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm='HS256')
    
    return encode_jwt
