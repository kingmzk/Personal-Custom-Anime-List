import os
import re
import time
import requests
from django.core.management.base import BaseCommand
from api.models import Anime

class Command(BaseCommand):
    help = 'Populate the database from Aniwatch.txt'

    def handle(self, *args, **options):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        file_path = os.path.join(os.path.dirname(base_dir), 'public', 'Aniwatch.txt')
        
        if not os.path.exists(file_path):
            file_path = os.path.join(os.path.dirname(base_dir), 'Aniwatch.txt')
            
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'Aniwatch.txt not found at {file_path}'))
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

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
                
                # Extract MAL ID
                match = re.search(r'/anime/(\d+)', url)
                if match:
                    mal_id = int(match.group(1))
                    
                    # Sanitize title for Windows console printing
                    safe_title = title.encode('ascii', 'ignore').decode('ascii')
                    
                    # Check if already in db
                    if Anime.objects.filter(mal_id=mal_id).exists():
                        self.stdout.write(self.style.SUCCESS(f'Already exists: {safe_title}'))
                        continue
                    
                    # Fetch from Jikan API
                    self.stdout.write(self.style.WARNING(f'Fetching {safe_title} (ID: {mal_id})...'))
                    
                    try:
                        # Sleep to avoid rate limiting (Jikan limit is 3/sec, 60/min)
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
                            
                        elif response.status_code == 429:
                            self.stdout.write(self.style.ERROR(f'RATE LIMITED on {safe_title}. Waiting 10 seconds...'))
                            time.sleep(10)
                        else:
                            self.stdout.write(self.style.ERROR(f'Jikan API failed for {safe_title}: HTTP {response.status_code}. Saving basic info only.'))
                            
                        # ALWAYS create the record so it doesn't get skipped
                        Anime.objects.create(
                            mal_id=mal_id,
                            title=title,
                            url=url,
                            category=current_category,
                            image_url=image_url,
                            score=score,
                            year=year,
                            type=type_,
                            synopsis=synopsis
                        )
                        self.stdout.write(self.style.SUCCESS(f'Saved: {safe_title}'))
                        
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'Error on {safe_title}: {e}'))
                        # Save basic info on exception
                        Anime.objects.create(
                            mal_id=mal_id,
                            title=title,
                            url=url,
                            category=current_category
                        )
                        self.stdout.write(self.style.SUCCESS(f'Saved (Basic): {safe_title}'))

        self.stdout.write(self.style.SUCCESS('Finished populating database.'))
