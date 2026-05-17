from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Anime
from .serializers import AnimeSerializer
from rest_framework.decorators import action
from rest_framework import filters
from .tasks import start_processing_thread

class AnimeViewSet(viewsets.ModelViewSet):
    queryset = Anime.objects.all()
    serializer_class = AnimeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['title']

    def get_queryset(self):
        queryset = Anime.objects.all().order_by('-updated_at')
        category = self.request.query_params.get('category', None)
        if category is not None:
            queryset = queryset.filter(category=category)
        return queryset

    @action(detail=False, methods=['post'])
    def upload_list(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=400)
            
        try:
            content = file_obj.read().decode('utf-8')
            start_processing_thread(content)
            return Response({'message': 'File uploaded successfully. Processing in background...'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def add_from_mal(self, request):
        mal_id = request.data.get('mal_id')
        category = request.data.get('category', 'Plan to watch')
        
        if not mal_id:
            return Response({'error': 'mal_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        anime, created = Anime.objects.get_or_create(
            mal_id=mal_id,
            defaults={
                'title': request.data.get('title', 'Unknown Title'),
                'url': request.data.get('url', f'https://myanimelist.net/anime/{mal_id}'),
                'category': category,
                'image_url': request.data.get('image_url'),
                'score': request.data.get('score'),
                'year': request.data.get('year'),
                'type': request.data.get('type'),
                'synopsis': request.data.get('synopsis'),
            }
        )
        
        if not created:
            anime.category = category
            anime.save()
            
        serializer = self.get_serializer(anime)
        return Response(serializer.data, status=status.HTTP_200_OK)
