import time
import requests
from django.core.management.base import BaseCommand
from api.models import Anime


def fetch_kitsu_image(title):
    """Search Kitsu API for anime poster image by title."""
    try:
        url = f"https://kitsu.io/api/edge/anime?filter[text]={requests.utils.quote(title)}&page[limit]=1"
        headers = {'Accept': 'application/vnd.api+json'}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json().get('data', [])
            if data:
                images = data[0].get('attributes', {}).get('posterImage', {})
                synopsis = data[0].get('attributes', {}).get('synopsis', '')
                image_url = images.get('large') or images.get('medium') or images.get('original')
                return image_url, synopsis
    except Exception as e:
        pass
    return None, None


class Command(BaseCommand):
    help = 'Fix missing images in the database using Kitsu API as a fallback.'

    def handle(self, *args, **options):
        missing = Anime.objects.filter(image_url__isnull=True)
        total = missing.count()
        self.stdout.write(self.style.WARNING(f'Found {total} anime with missing images. Fetching from Kitsu...'))

        fixed = 0
        for i, anime in enumerate(missing, 1):
            safe_title = anime.title.encode('ascii', 'ignore').decode('ascii')
            self.stdout.write(f'[{i}/{total}] Fetching: {safe_title}')

            image_url, synopsis = fetch_kitsu_image(anime.title)

            if image_url:
                anime.image_url = image_url
                if not anime.synopsis and synopsis:
                    anime.synopsis = synopsis
                anime.save()
                fixed += 1
                self.stdout.write(self.style.SUCCESS(f'  -> Fixed!'))
            else:
                self.stdout.write(self.style.ERROR(f'  -> Not found on Kitsu.'))

            time.sleep(0.5)  # Kitsu rate limit

        self.stdout.write(self.style.SUCCESS(f'\nDone! Fixed {fixed}/{total} missing images.'))
