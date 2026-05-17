import { useState, useEffect } from 'react';

const cache = {}; // Simple memory cache

export function useAnimeData(malId, isVisible) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!malId || !isVisible) return;

    if (cache[malId]) {
      setData(cache[malId]);
      return;
    }

    let isMounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Basic delay based on cache misses to respect 3req/sec roughly
        // We'll rely on Jikan's queueing mostly, but add a tiny delay
        const delay = Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));

        const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
        if (!res.ok) {
          if (res.status === 429) {
            throw new Error('Rate limited');
          }
          throw new Error('Network error');
        }
        
        const json = await res.json();
        
        if (isMounted) {
          cache[malId] = json.data;
          setData(json.data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [malId, isVisible]);

  return { data, loading, error };
}
