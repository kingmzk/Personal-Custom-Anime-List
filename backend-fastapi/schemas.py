from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime, date

class AnimeBase(BaseModel):
    mal_id: int
    title: str
    url: str
    category: str
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    score: Optional[float] = None
    year: Optional[int] = None
    type: Optional[str] = None
    synopsis: Optional[str] = None
    personal_rating: Optional[float] = None
    watched_date: Optional[date] = None

class AnimeCreate(AnimeBase):
    pass

class Anime(AnimeBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True

class PaginatedAnimeResponse(BaseModel):
    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: List[Anime]

class MalAddRequest(BaseModel):
    mal_id: int
    title: Optional[str] = "Unknown Title"
    url: Optional[str] = None
    category: Optional[str] = "Plan to watch"
    image_url: Optional[str] = None
    score: Optional[float] = None
    year: Optional[int] = None
    type: Optional[str] = None
    synopsis: Optional[str] = None
