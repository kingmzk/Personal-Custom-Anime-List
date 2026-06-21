from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
import urllib.parse

import models
import schemas
import tasks
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/animes/", response_model=schemas.PaginatedAnimeResponse)
def get_animes(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    search: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    min_score: Optional[float] = None,
    ordering: Optional[str] = "-updated_at"
):
    page_size = 20
    query = db.query(models.Anime)

    if search:
        query = query.filter(models.Anime.title.ilike(f"%{search}%"))
    if category:
        query = query.filter(models.Anime.category == category)
    if type:
        query = query.filter(models.Anime.type == type)
    if min_score is not None:
        query = query.filter(models.Anime.score >= min_score)

    # Ordering
    if ordering:
        descending = ordering.startswith("-")
        field = ordering.lstrip("-")
        order_col = getattr(models.Anime, field, None)
        if order_col is not None:
            if descending:
                query = query.order_by(desc(order_col))
            else:
                query = query.order_by(asc(order_col))

    total = query.count()
    offset = (page - 1) * page_size
    animes = query.offset(offset).limit(page_size).all()

    # Calculate pagination URLs roughly matching Django
    # In a real setup you would construct these based on the request URL
    next_url = f"?page={page+1}" if (offset + page_size) < total else None
    prev_url = f"?page={page-1}" if page > 1 else None

    return {
        "count": total,
        "next": next_url,
        "previous": prev_url,
        "results": animes
    }

@app.post("/api/animes/", response_model=schemas.Anime)
def create_anime(anime: schemas.AnimeCreate, db: Session = Depends(get_db)):
    db_anime = models.Anime(**anime.model_dump())
    db.add(db_anime)
    db.commit()
    db.refresh(db_anime)
    return db_anime

@app.get("/api/animes/{anime_id}/", response_model=schemas.Anime)
def get_anime(anime_id: int, db: Session = Depends(get_db)):
    db_anime = db.query(models.Anime).filter(models.Anime.id == anime_id).first()
    if db_anime is None:
        raise HTTPException(status_code=404, detail="Anime not found")
    return db_anime

@app.put("/api/animes/{anime_id}/", response_model=schemas.Anime)
def update_anime(anime_id: int, anime: schemas.AnimeCreate, db: Session = Depends(get_db)):
    db_anime = db.query(models.Anime).filter(models.Anime.id == anime_id).first()
    if db_anime is None:
        raise HTTPException(status_code=404, detail="Anime not found")
    
    for key, value in anime.model_dump().items():
        setattr(db_anime, key, value)
        
    db.commit()
    db.refresh(db_anime)
    return db_anime

@app.delete("/api/animes/{anime_id}/")
def delete_anime(anime_id: int, db: Session = Depends(get_db)):
    db_anime = db.query(models.Anime).filter(models.Anime.id == anime_id).first()
    if db_anime is None:
        raise HTTPException(status_code=404, detail="Anime not found")
    db.delete(db_anime)
    db.commit()
    return {"status": "success"}

@app.post("/api/animes/upload_list/")
def upload_list(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded.")
    try:
        raw_content = file.file.read()
        try:
            content = raw_content.decode('utf-8-sig') # Handles BOM
        except UnicodeDecodeError:
            content = raw_content.decode('latin-1') # Fallback
            
        tasks.start_processing_thread(content)
        return {"message": "File uploaded successfully. Processing in background..."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/animes/add_from_mal/")
def add_from_mal(req: schemas.MalAddRequest, db: Session = Depends(get_db)):
    anime_obj, created = tasks.upsert_anime(
        db=db,
        mal_id=req.mal_id,
        title=req.title,
        url=req.url or f"https://myanimelist.net/anime/{req.mal_id}",
        current_category=req.category
    )
    
    # Reload from DB
    db.refresh(anime_obj)
    return anime_obj

@app.get("/api/animes/import_status/")
def import_status():
    return tasks.get_import_state()
