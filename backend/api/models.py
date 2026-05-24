from django.db import models

class Anime(models.Model):
    mal_id = models.IntegerField(unique=True)
    title = models.CharField(max_length=500)
    url = models.URLField(max_length=500)
    category = models.CharField(max_length=100)
    
    # Optional fields from Jikan API
    image_url = models.URLField(max_length=500, blank=True, null=True)
    image_base64 = models.TextField(blank=True, null=True)
    score = models.FloatField(blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    type = models.CharField(max_length=50, blank=True, null=True)
    synopsis = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    personal_rating = models.FloatField(blank=True, null=True)  # 0.0-10.0 user rating

    def __str__(self):
        return self.title
