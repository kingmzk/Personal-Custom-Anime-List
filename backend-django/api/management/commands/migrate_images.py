from django.core.management.base import BaseCommand
from api.models import Anime
from api.tasks import download_image_as_base64
import time

class Command(BaseCommand):
    help = 'Downloads existing images and converts them to base64 strings in the database'

    def handle(self, *args, **kwargs):
        animes = Anime.objects.filter(image_url__isnull=False, image_base64__isnull=True)
        total = animes.count()
        self.stdout.write(f"Found {total} animes to migrate.")

        for i, anime in enumerate(animes):
            safe_title = anime.title.encode('ascii', 'replace').decode('ascii')
            self.stdout.write(f"[{i+1}/{total}] Migrating image for {safe_title}...")
            base64_data = download_image_as_base64(anime.image_url)
            if base64_data:
                anime.image_base64 = base64_data
                anime.save()
                self.stdout.write(self.style.SUCCESS(f"Successfully migrated {safe_title}"))
            else:
                self.stdout.write(self.style.WARNING(f"Failed to download image for {safe_title}"))
            
            # small delay to prevent rate limits or blocking
            time.sleep(0.5)

        self.stdout.write(self.style.SUCCESS('Migration complete!'))
