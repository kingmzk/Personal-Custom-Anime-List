import { useState, useRef, useEffect } from 'react';

export function AnimeCard({ item, onUpdateCategory, onUpdateRating, onUpdateWatchedDate, onDelete, categories }) {
  const [ratingOpen, setRatingOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const popoverRef = useRef(null);

  // Sync local input when popover opens
  useEffect(() => {
    if (ratingOpen) {
      setInputVal(item.personal_rating != null ? String(item.personal_rating) : '');
    }
  }, [ratingOpen, item.personal_rating]);

  // Close popover on outside click
  useEffect(() => {
    if (!ratingOpen) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setRatingOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ratingOpen]);

  const handleSave = () => {
    const parsed = parseFloat(inputVal);
    if (inputVal === '' || inputVal === null) {
      onUpdateRating(item.id, null);
    } else if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      onUpdateRating(item.id, parsed);
    }
    setRatingOpen(false);
  };

  const handleClear = () => {
    setInputVal('');
    onUpdateRating(item.id, null);
    setRatingOpen(false);
  };

  const rating = item.personal_rating;
  // How many full/partial stars to fill (out of 5 displayed)
  const starFill = rating != null ? rating : 0; // keep decimal for half-star support
  const [hoverStar, setHoverStar] = useState(null);

  return (
    <div className="anime-card">
      <div className="card-image-wrapper">
        {(item.image_base64 || item.image_url) ? (
          <img src={item.image_base64 || item.image_url} alt={item.title} className="card-image" loading="lazy" />
        ) : (
          <div className="card-image-placeholder">
            <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" width="60">
              <rect width="100" height="130" fill="#1e2128" rx="4"/>
              <text x="50" y="55" textAnchor="middle" fill="#6366f1" fontSize="28">🎬</text>
              <text x="50" y="80" textAnchor="middle" fill="#9ca3af" fontSize="9">No Image</text>
            </svg>
          </div>
        )}
        {item.score && <div className="card-score">⭐ {item.score}</div>}
        {rating != null && <div className="my-rating-badge">⭐ {rating}/10</div>}
      </div>

      <div className="card-content">
        <h3 className="card-title" title={item.title}>{item.title}</h3>
        <div className="card-meta">
          {item.score && <span className="score">★ {item.score}</span>}
          {item.year && <span className="year">{item.year}</span>}
          {item.type && <span className="type">{item.type}</span>}
        </div>
        <p className="card-synopsis">{item.synopsis || 'No synopsis available.'}</p>

        <div className="card-actions">
          {/* Rate Button + Popover */}
          <div className="rating-wrapper" ref={popoverRef}>
            <button
              className={`rate-btn ${rating != null ? 'rated' : ''}`}
              onClick={(e) => { e.stopPropagation(); setRatingOpen(prev => !prev); }}
            >
              {rating != null ? `★ My Rating: ${rating}/10` : '☆ Rate this anime'}
            </button>

            {ratingOpen && (
              <div className="rating-popover" onClick={e => e.stopPropagation()}>
                <p className="popover-title">Your Rating (0 – 10, decimals OK)</p>

                {/* Star visual guide — 10 stars representing 0–10 */}
                <div className="popover-stars">
                  {[...Array(10)].map((_, i) => {
                    const star = i + 1;
                    const current = hoverStar ?? starFill;
                    const fullStars = Math.floor(current);
                    const hasHalf = (current - fullStars) >= 0.5;
                    let starClass = 'star-empty';
                    if (star <= fullStars) {
                      starClass = 'star-filled';
                    } else if (star === fullStars + 1 && hasHalf) {
                      starClass = 'star-half';
                    }
                    return (
                      <button
                        key={star}
                        className={`star-btn ${starClass}`}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isLeftHalf = e.clientX < rect.left + rect.width / 2;
                          setHoverStar(isLeftHalf ? star - 0.5 : star);
                        }}
                        onMouseLeave={() => setHoverStar(null)}
                        onClick={() => {
                          setInputVal(String(hoverStar ?? star));
                        }}
                        title={`${hoverStar ?? star}/10`}
                      >★</button>
                    );
                  })}
                </div>

                {/* Decimal number input */}
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  placeholder="e.g. 7.5"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="rating-input"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  autoFocus
                />

                <div className="popover-actions">
                  <button className="popover-save-btn" onClick={handleSave}>Save</button>
                  <button className="popover-clear-btn" onClick={handleClear}>Clear</button>
                </div>
              </div>
            )}
          </div>


          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
            <select
              value={item.category}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onUpdateCategory(item.id, e.target.value); }}
              className="category-select"
              style={{ flex: 1 }}
            >
              {categories && categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            {item.category === 'Completed' && (
              <div className="watched-date-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  type="button"
                  title={item.watched_date ? `Watched on: ${item.watched_date}` : 'Set Watched Date'}
                  onClick={(e) => {
                    e.stopPropagation();
                    const inputEl = e.currentTarget.nextElementSibling;
                    if (inputEl) {
                      try {
                        inputEl.showPicker();
                      } catch (err) {
                        inputEl.focus();
                      }
                    }
                  }}
                  style={{
                    background: item.watched_date ? '#4f46e5' : '#374151',
                    border: '1px solid #4b5563',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    minWidth: '32px',
                    height: '32px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  {item.watched_date && (
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.35rem', fontWeight: 'bold' }}>
                      {item.watched_date.substring(5)} {/* Show mm-dd for compactness */}
                    </span>
                  )}
                </button>
                <input 
                  type="date" 
                  value={item.watched_date || ''} 
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); onUpdateWatchedDate(item.id, e.target.value); }} 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                />
              </div>
            )}

            
            <button 
              className="delete-btn" 
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              title="Remove from list"
              style={{ padding: '0.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
