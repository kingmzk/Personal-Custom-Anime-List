import time
import requests
from django.core.management.base import BaseCommand
from api.models import Anime


class Command(BaseCommand):
    help = 'Updates all anime titles to English using the Jikan API'

    def handle(self, *args, **kwargs):
        animes = list(Anime.objects.all().values_list('id', 'mal_id', 'title'))
        total = len(animes)
        self.stdout.write(f'Updating English titles for {total} anime...')

        updated = 0
        for i, (pk, mal_id, current_title) in enumerate(animes):
            try:
                time.sleep(1.2)
                resp = requests.get(
                    f'https://api.jikan.moe/v4/anime/{mal_id}',
                    timeout=10
                )

                if resp.status_code == 429:
                    self.stdout.write(f'[{i+1}/{total}] Rate limited, sleeping 15s...')
                    time.sleep(15)
                    resp = requests.get(
                        f'https://api.jikan.moe/v4/anime/{mal_id}',
                        timeout=10
                    )

                if resp.status_code == 200:
                    data = resp.json().get('data', {})
                    eng = (data.get('title_english') or data.get('title') or '').strip()
                    if eng and eng != current_title:
                        Anime.objects.filter(pk=pk).update(title=eng)
                        safe = eng.encode('ascii', 'replace').decode('ascii')
                        self.stdout.write(self.style.SUCCESS(f'[{i+1}/{total}] {safe[:60]}'))
                        updated += 1
                    else:
                        safe = current_title.encode('ascii', 'replace').decode('ascii')
                        self.stdout.write(f'[{i+1}/{total}] (unchanged) {safe[:55]}')
                else:
                    self.stdout.write(self.style.WARNING(
                        f'[{i+1}/{total}] HTTP {resp.status_code} for mal_id={mal_id}'
                    ))

            except Exception as e:
                self.stdout.write(self.style.WARNING(f'[{i+1}/{total}] Error mal_id={mal_id}: {e}'))

        self.stdout.write(self.style.SUCCESS(f'Done! Updated {updated}/{total} titles to English.'))
