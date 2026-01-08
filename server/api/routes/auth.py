from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import sys
from pathlib import Path

from util.signtoken import sign_token


sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))


from db.models.user import User
from db.controllers.user_controller import UserRepository, UserCreate

import logging

logger = logging.getLogger(__name__)


router = APIRouter(prefix='/auth', tags=['Auth'])

@router.post("/register")
def register(req: UserCreate):
    """
    Create new user

    Return: user_id: str
    """
    try:

        if not req.username or not req.password:
            raise HTTPException(status_code=400, detail="Validation failed")

        if (len(req.username) < 3):
            raise HTTPException(status_code=400, detail="Username must be atleast 3 character long") 
        
        if (len(req.password) < 8):
            raise HTTPException(status_code=400, detail="Password must be atleast 8 character long")

        exists = UserRepository.get_by_username(req.username)
        if exists:
            raise HTTPException(status_code=400, detail="User already exists")

        user_id = UserRepository.create_user(req)

        return {"success": True, "user_id": user_id} 
    
    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"USER REGISTER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/login")
def login(req:UserCreate):
    """
    Return Token 
    """

    try:
        if not req.username or not req.password:
            raise HTTPException(status_code=400, detail="Validation failed")

        if (len(req.username) < 3):
            raise HTTPException(status_code=400, detail="Username must be atleast 3 character long") 
        
        if (len(req.password) < 8):
            raise HTTPException(status_code=400, detail="Password must be atleast 8 character long")

        exists = UserRepository.verify_credentials(req.username, req.password)        
        if not exists:
            raise HTTPException(status_code=400, detail="Invalid credentials") 
         
        
        data = {
            "username": exists.username,
            "role": exists.role
        }
        token = sign_token(data)

        if not token:
            logger.error("Failed to sign token")
            raise 

        return {
                "token": token,
                "type": "bearer"
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"USER LOGIN ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


