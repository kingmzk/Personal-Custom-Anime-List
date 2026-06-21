from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Date
from datetime import datetime
from database import Base

class Anime(Base):
    __tablename__ = "api_anime" # Map to Django's table name

    id = Column(Integer, primary_key=True, index=True)
    mal_id = Column(Integer, unique=True, index=True)
    title = Column(String(500))
    url = Column(String(500))
    category = Column(String(100))
    
    # Optional fields
    image_url = Column(String(500), nullable=True)
    image_base64 = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    year = Column(Integer, nullable=True)
    type = Column(String(50), nullable=True)
    synopsis = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    personal_rating = Column(Float, nullable=True)
    watched_date = Column(Date, nullable=True)
