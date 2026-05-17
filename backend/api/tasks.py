import json
import re
import time
import requests
import threading
from .models import Anime

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

def upsert_anime(mal_id, title, url, current_category):
    safe_title = title.encode('ascii', 'ignore').decode('ascii')
    
    anime, created = Anime.objects.get_or_create(
        mal_id=mal_id,
        defaults={
            'title': title,
            'url': url,
            'category': current_category
        }
    )
    
    if not created:
        anime.category = current_category
        anime.save()
        return

    try:
        time.sleep(1.5)
        response = requests.get(f'https://api.jikan.moe/v4/anime/{mal_id}')
        
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
            
        else:
            # Jikan failed — try Kitsu as fallback
            kitsu_image, kitsu_synopsis = fetch_kitsu_fallback(title)
            image_url = kitsu_image
            synopsis = kitsu_synopsis
            if response.status_code == 429:
                time.sleep(10)
            
        anime.image_url = image_url
        anime.score = score
        anime.year = year
        anime.type = type_
        anime.synopsis = synopsis
        anime.save()
    except Exception as e:
        pass

def process_uploaded_file(file_content):
    try:
        data = json.loads(file_content)
        for category, items in data.items():
            for item in items:
                mal_id = item.get('mal_id')
                title = item.get('name')
                url = item.get('link')
                if mal_id and title:
                    upsert_anime(mal_id, title, url, category)
        return
    except json.JSONDecodeError:
        pass

    lines = file_content.splitlines()
    current_category = 'Uncategorized'
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith('#'):
            current_category = line[1:].strip()
            continue
            
        if '|' in line:
            title, url = [part.strip() for part in line.split('|', 1)]
            
            match = re.search(r'/anime/(\d+)', url)
            if match:
                mal_id = int(match.group(1))
                upsert_anime(mal_id, title, url, current_category)

def start_processing_thread(file_content):
    thread = threading.Thread(target=process_uploaded_file, args=(file_content,))
    thread.daemon = True
    thread.start()
