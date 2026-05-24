from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Anime
from .serializers import AnimeSerializer
from rest_framework.decorators import action
from rest_framework import filters
from .tasks import start_processing_thread, download_image_as_base64, get_import_state

class AnimeViewSet(viewsets.ModelViewSet):
    queryset = Anime.objects.all()
    serializer_class = AnimeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title']
    ordering_fields = ['updated_at', 'score', 'year', 'title', 'personal_rating']
    ordering = ['-updated_at']

    def get_queryset(self):
        queryset = Anime.objects.all()
        category = self.request.query_params.get('category', None)
        anime_type = self.request.query_params.get('type', None)
        min_score = self.request.query_params.get('min_score', None)
        
        if category is not None:
            queryset = queryset.filter(category=category)
        if anime_type:
            queryset = queryset.filter(type=anime_type)
        if min_score:
            try:
                queryset = queryset.filter(score__gte=float(min_score))
            except ValueError:
                pass
            
        return queryset

    @action(detail=False, methods=['post'])
    def upload_list(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=400)
            
        try:
            raw_content = file_obj.read()
            try:
                content = raw_content.decode('utf-8-sig') # Handles BOM
            except UnicodeDecodeError:
                content = raw_content.decode('latin-1') # Fallback
                
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
            
        image_url = request.data.get('image_url')
        
        anime, created = Anime.objects.get_or_create(
            mal_id=mal_id,
            defaults={
                'title': request.data.get('title', 'Unknown Title'),
                'url': request.data.get('url', f'https://myanimelist.net/anime/{mal_id}'),
                'category': category,
                'image_url': image_url,
                'image_base64': download_image_as_base64(image_url),
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

    @action(detail=False, methods=['get'])
    def import_status(self, request):
        state = get_import_state()
        return Response(state)

