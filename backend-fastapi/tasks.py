import json
import re
import time
import threading
import requests
import base64
import xml.etree.ElementTree as ET
from models import Anime
from database import SessionLocal

# ──────────────────────────────────────────────
# Thread-safe global import progress state
# ──────────────────────────────────────────────
_import_lock = threading.Lock()
import_state = {
    'status': 'idle',   # idle | running | done | error
    'total': 0,
    'current': 0,
    'log': [],          # list of log message strings
}

def _log(msg):
    """Append a message to the import log (thread-safe, keep last 200 lines)."""
    with _import_lock:
        import_state['log'].append(msg)
        if len(import_state['log']) > 200:
            import_state['log'] = import_state['log'][-200:]

def get_import_state():
    with _import_lock:
        return dict(import_state)

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def download_image_as_base64(url):
    if not url:
        return None
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            base64_encoded = base64.b64encode(response.content).decode('utf-8')
            return f"data:{content_type};base64,{base64_encoded}"
    except Exception:
        pass
    return None

def fetch_kitsu_fallback(title):
    """Fallback to Kitsu API if Jikan is unavailable."""
    try:
        url = f"https://kitsu.io/api/edge/anime?filter[text]={requests.utils.quote(title)}&page[limit]=1"
        headers = {'Accept': 'application/vnd.api+json'}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json().get('data', [])
            if data:
                attrs = data[0].get('attributes', {})
                images = attrs.get('posterImage', {})
                image_url = images.get('large') or images.get('medium') or images.get('original')
                synopsis = attrs.get('synopsis', '')
                return image_url, synopsis
    except Exception:
        pass
    return None, None

# ──────────────────────────────────────────────
# Core upsert
# ──────────────────────────────────────────────
def upsert_anime(db, mal_id, title, url, current_category, personal_rating=None):
    safe_title = title.encode('ascii', 'ignore').decode('ascii')
    
    anime = db.query(Anime).filter(Anime.mal_id == mal_id).first()
    created = False
    
    if not anime:
        anime = Anime(
            mal_id=mal_id,
            title=title,
            url=url,
            category=current_category,
            personal_rating=personal_rating
        )
        db.add(anime)
        db.commit()
        db.refresh(anime)
        created = True
    else:
        anime.category = current_category
        if personal_rating is not None:
            anime.personal_rating = personal_rating
        db.commit()
        return anime, False

    try:
        time.sleep(1.5)
        response = requests.get(f'https://api.jikan.moe/v4/anime/{mal_id}', timeout=15)

        image_url, score, year, type_, synopsis = None, None, None, None, None

        if response.status_code == 200:
            data = response.json().get('data', {})
            if 'images' in data and 'webp' in data['images']:
                image_url = data['images']['webp'].get('large_image_url')
            elif 'images' in data and 'jpg' in data['images']:
                image_url = data['images']['jpg'].get('large_image_url')

            score = data.get('score')
            year = data.get('year')
            type_ = data.get('type')
            synopsis = data.get('synopsis')

            title_english = data.get('title_english') or data.get('title')
            if title_english:
                anime.title = title_english

        else:
            kitsu_image, kitsu_synopsis = fetch_kitsu_fallback(title)
            image_url = kitsu_image
            synopsis = kitsu_synopsis
            if response.status_code == 429:
                time.sleep(10)

        anime.image_url = image_url
        anime.image_base64 = download_image_as_base64(image_url)
        anime.score = score
        anime.year = year
        anime.type = type_
        anime.synopsis = synopsis
        db.commit()
    except Exception:
        db.rollback()
        pass

    return anime, True

MAL_STATUS_MAP = {
    'watching':      'Watching',
    'completed':     'Completed',
    'on-hold':       'On-Hold',
    'dropped':       'Dropped',
    'plan to watch': 'Plan to watch',
    'plantowatch':   'Plan to watch',
}

def process_uploaded_file(file_content):
    with _import_lock:
        import_state['status'] = 'running'
        import_state['total'] = 0
        import_state['current'] = 0
        import_state['log'] = []

    added = updated = errors = 0
    file_content_stripped = file_content.strip()
    if file_content_stripped.startswith('\ufeff'):
        file_content_stripped = file_content_stripped[1:].strip()
        
    db = SessionLocal()
    
    # 1. Try XML
    if file_content_stripped.startswith('<?xml') or file_content_stripped.startswith('<myanimelist>'):
        try:
            root = ET.fromstring(file_content_stripped)
            entries = root.findall('anime')
            total = len(entries)
            with _import_lock: import_state['total'] = total
            _log(f'📄 Found {total} anime entries in MAL XML export.')

            for i, anime_elem in enumerate(entries):
                mal_id_elem = anime_elem.find('series_animedb_id')
                title_elem = anime_elem.find('series_title')
                status_elem = anime_elem.find('my_status')
                score_elem = anime_elem.find('my_score')

                if mal_id_elem is not None and title_elem is not None and mal_id_elem.text:
                    mal_id = int(mal_id_elem.text)
                    title = (title_elem.text or '').strip()
                    if not title:
                        continue

                    raw_status = (status_elem.text or '').strip() if status_elem is not None else ''
                    category = MAL_STATUS_MAP.get(raw_status.lower(), raw_status or 'Uncategorized')
                    url = f"https://myanimelist.net/anime/{mal_id}"

                    personal_rating = None
                    if score_elem is not None and score_elem.text and score_elem.text.strip() != '0':
                        try: personal_rating = float(score_elem.text.strip())
                        except ValueError: pass

                    try:
                        _, created = upsert_anime(db, mal_id, title, url, category, personal_rating)
                        safe_title = title.encode('ascii', 'replace').decode('ascii')
                        if created:
                            added += 1
                            _log(f'[{i+1}/{total}] ✅ Added — {safe_title}')
                        else:
                            updated += 1
                            _log(f'[{i+1}/{total}] 🔄 Updated — {safe_title}')
                    except Exception as e:
                        errors += 1
                        _log(f'[{i+1}/{total}] ❌ Error for mal_id={mal_id}: {e}')
                
                with _import_lock: import_state['current'] = i + 1
            
            _finish_import(db, added, updated, errors)
            return
        except ET.ParseError as e:
            _log(f'❌ XML parse error: {e}')
            with _import_lock: import_state['status'] = 'error'
            db.close()
            return

    # 2. Try JSON
    try:
        data = json.loads(file_content)
        total = sum(len(items) for items in data.values())
        with _import_lock: import_state['total'] = total
        _log(f'📄 Found {total} anime entries in JSON format.')
        
        current = 0
        for category, items in data.items():
            for item in items:
                mal_id = item.get('mal_id')
                title = item.get('name')
                url = item.get('link')
                if mal_id and title:
                    try:
                        _, created = upsert_anime(db, mal_id, title, url, category)
                        safe_title = title.encode('ascii', 'replace').decode('ascii')
                        if created:
                            added += 1
                            _log(f'[{current+1}/{total}] ✅ Added — {safe_title}')
                        else:
                            updated += 1
                            _log(f'[{current+1}/{total}] 🔄 Updated — {safe_title}')
                    except Exception as e:
                        errors += 1
                current += 1
                with _import_lock: import_state['current'] = current

        _finish_import(db, added, updated, errors)
        return
    except json.JSONDecodeError:
        pass

    # 3. Fallback to TXT
    lines = file_content.splitlines()
    entries = []
    current_category = 'Uncategorized'
    for line in lines:
        line = line.strip()
        if not line: continue
        if line.startswith('#'):
            current_category = line[1:].strip()
            continue
        if '|' in line:
            title, url = [part.strip() for part in line.split('|', 1)]
            match = re.search(r'/anime/(\d+)', url)
            if match:
                mal_id = int(match.group(1))
                entries.append((mal_id, title, url, current_category))
                
    total = len(entries)
    with _import_lock: import_state['total'] = total
    _log(f'📄 Found {total} anime entries in TXT format.')
    
    for i, (mal_id, title, url, category) in enumerate(entries):
        try:
            _, created = upsert_anime(db, mal_id, title, url, category)
            safe_title = title.encode('ascii', 'replace').decode('ascii')
            if created:
                added += 1
                _log(f'[{i+1}/{total}] ✅ Added — {safe_title}')
            else:
                updated += 1
                _log(f'[{i+1}/{total}] 🔄 Updated — {safe_title}')
        except Exception as e:
            errors += 1
            
        with _import_lock: import_state['current'] = i + 1

    _finish_import(db, added, updated, errors)

def _finish_import(db, added, updated, errors):
    _log(f'')
    _log(f'✔️  Import complete! Added: {added} | Updated: {updated} | Errors: {errors}')
    with _import_lock:
        import_state['status'] = 'done'
    db.close()

def start_processing_thread(file_content):
    thread = threading.Thread(target=process_uploaded_file, args=(file_content,))
    thread.daemon = True
    thread.start()
