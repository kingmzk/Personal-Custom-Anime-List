import { useState } from 'react';

// Normalize a Jikan result into a common format
function normalizeJikan(anime) {
  return {
    id: `jikan-${anime.mal_id}`,
    mal_id: anime.mal_id,
    source: 'jikan',
    title: anime.title,
    url: anime.url || `https://myanimelist.net/anime/${anime.mal_id}`,
    image_url: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url || null,
    score: anime.score,
    year: anime.year,
    type: anime.type,
    synopsis: anime.synopsis,
  };
}

// Normalize a Kitsu result into a common format
// Uses negative kitsu ID as mal_id to avoid DB collisions with real MAL IDs
function normalizeKitsu(anime) {
  const kitsuId = parseInt(anime.id);
  const attrs = anime.attributes || {};
  const images = attrs.posterImage || {};
  return {
    id: `kitsu-${kitsuId}`,
    mal_id: -kitsuId,   // negative to avoid collision with real MAL IDs
    source: 'kitsu',
    title: attrs.canonicalTitle || attrs.titles?.en || 'Unknown',
    url: `https://kitsu.io/anime/${anime.id}`,
    image_url: images.large || images.medium || images.original || null,
    score: attrs.averageRating ? (parseFloat(attrs.averageRating) / 10).toFixed(1) : null,
    year: attrs.startDate ? attrs.startDate.substring(0, 4) : null,
    type: attrs.showType || null,
    synopsis: attrs.synopsis || null,
  };
}

export function AddFromMalModal({ isOpen, onClose, categories, onAddSuccess }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('');
  const [addedIds, setAddedIds] = useState(new Set()); // track added to prevent duplicate clicks

  if (!isOpen) return null;

  const searchJikan = async (q) => {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Jikan HTTP ${res.status}`);
    const data = await res.json();
    return (data.data || []).map(normalizeJikan);
  };

  const searchKitsu = async (q) => {
    const res = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=10`, {
      headers: { 'Accept': 'application/vnd.api+json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`Kitsu HTTP ${res.status}`);
    const data = await res.json();
    return (data.data || []).map(normalizeKitsu);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);

    // Try Jikan first, fallback to Kitsu
    try {
      const jikanResults = await searchJikan(query);
      setResults(jikanResults);
      setSource('MyAnimeList (Jikan)');
    } catch (jikanErr) {
      try {
        const kitsuResults = await searchKitsu(query);
        setResults(kitsuResults);
        setSource('Kitsu');
        setError('MyAnimeList is unavailable. Showing results from Kitsu instead.');
      } catch (kitsuErr) {
        setError('Both MyAnimeList and Kitsu are currently unavailable. Please try again in a moment.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (anime, category) => {
    const uniqueId = anime.id;
    if (addedIds.has(uniqueId)) return; // prevent duplicate clicks

    try {
      const payload = {
        mal_id: anime.mal_id,
        title: anime.title,
        url: anime.url,
        category: category,
        image_url: anime.image_url,
        score: anime.score,
        year: anime.year,
        type: anime.type,
        synopsis: anime.synopsis
      };

      const res = await fetch('http://localhost:8000/api/animes/add_from_mal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to add anime');

      const savedAnime = await res.json();
      setAddedIds(prev => new Set(prev).add(uniqueId));
      onAddSuccess(savedAnime);
    } catch (err) {
      alert("Error adding anime: " + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Anime to My List</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSearch} className="modal-search">
          <input
            type="text"
            placeholder="Search anime by title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {source && results.length > 0 && (
          <div style={{ padding: '0 1.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
            Showing results from <strong style={{ color: '#6366f1' }}>{source}</strong>
          </div>
        )}
        {error && <div className="modal-info-message">{error}</div>}

        <div className="modal-results">
          {results.map(anime => {
            const isAdded = addedIds.has(anime.id);
            return (
              <div key={anime.id} className="mal-result-item">
                {anime.image_url ? (
                  <img src={anime.image_url} alt={anime.title} className="mal-result-img" />
                ) : (
                  <div className="mal-result-img-placeholder">🎬</div>
                )}
                <div className="mal-result-info">
                  <h4>{anime.title}</h4>
                  <div className="mal-result-meta">
                    {anime.year && <span>{anime.year}</span>}
                    {anime.type && <span>{anime.type}</span>}
                    {anime.score && <span>★ {anime.score}</span>}
                  </div>
                  <div className="mal-result-actions">
                    <select
                      id={`cat-${anime.id}`}
                      defaultValue={categories[0]}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      className={isAdded ? 'btn-added' : ''}
                      disabled={isAdded}
                      onClick={() => {
                        const sel = document.getElementById(`cat-${anime.id}`);
                        handleAdd(anime, sel.value);
                      }}
                    >
                      {isAdded ? '✓ Added' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {results.length === 0 && !loading && query && !error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No results found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
