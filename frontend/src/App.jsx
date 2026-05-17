import { useState, useEffect } from 'react';
import { AnimeGrid } from './components/AnimeGrid';
import { AddFromMalModal } from './components/AddFromMalModal';

const CATEGORIES = ['Watching', 'Plan to watch', 'On-Hold', 'Dropped', 'Completed', 'New Anime to Watch Personal', 'Custom 1'];

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isMalModalOpen, setIsMalModalOpen] = useState(false);

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Reset page to 1 when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        let url = `http://localhost:8000/api/animes/?category=${encodeURIComponent(activeCategory)}&page=${currentPage}`;
        if (searchQuery) {
          url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch from backend');
        
        const data = await response.json();
        setItems(data.results);
        setTotalCount(data.count);
      } catch (err) {
        console.error(err);
        setError('Failed to load anime list. Ensure Django backend is running.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeCategory, currentPage, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchQuery(searchInput);
  };

  const updateCategory = async (id, newCategory) => {
    try {
      const response = await fetch(`http://localhost:8000/api/animes/${id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: newCategory }),
      });
      if (response.ok) {
        setItems(items.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };

  const updateRating = async (id, rating) => {
    try {
      await fetch(`http://localhost:8000/api/animes/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personal_rating: rating }),
      });
      setItems(items.map(item => item.id === id ? { ...item, personal_rating: rating } : item));
    } catch (err) {
      console.error('Failed to update rating', err);
    }
  };

  const handleMalAddSuccess = (newAnime) => {
    // If the added anime belongs to the current tab, add it to the top
    if (newAnime.category === activeCategory) {
      setItems([newAnime, ...items]);
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/animes/upload_list/', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setUploadStatus('Success! ' + data.message);
        setTimeout(() => setUploadStatus(null), 5000);
      } else {
        setUploadStatus('Error: ' + data.error);
        setTimeout(() => setUploadStatus(null), 5000);
      }
    } catch (err) {
      setUploadStatus('Upload failed. Ensure backend is running.');
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>MZK-LIST<span>.</span></h1>
            <p>Your Personal Anime Collection</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Search anime..." 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: '#fff' }}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer' }}>Search</button>
            </form>
            <button 
              onClick={() => setIsMalModalOpen(true)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
              Add from MAL
            </button>
            <label className="upload-button" style={{ cursor: 'pointer', background: 'var(--accent-color)', padding: '0.5rem 1rem', borderRadius: '8px', color: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload List
              <input type="file" accept=".txt,.json" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>
      
      {uploadStatus && (
        <div style={{ textAlign: 'center', background: uploadStatus.includes('Error') || uploadStatus.includes('failed') ? '#ef4444' : '#10b981', color: 'white', padding: '0.75rem', margin: '1rem', borderRadius: '8px' }}>
          {uploadStatus}
        </div>
      )}
      
      <main className="app-main">
        <div className="category-tabs">
          {CATEGORIES.map(category => (
            <button
              key={category}
              className={`tab-button ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
              {activeCategory === category && totalCount > 0 && (
                <span className="badge">{totalCount}</span>
              )}
            </button>
          ))}
        </div>
        
        {loading && <div className="loading-spinner">Loading {activeCategory} list...</div>}
        {error && <div className="error-message">{error}</div>}
        
        {!loading && !error && items.length === 0 && (
          <div className="empty-state">
            <p>No anime found in this category.</p>
            <p style={{fontSize: '0.9rem', marginTop: '1rem', color: '#9ca3af'}}>
              If the database is empty, wait for the background population script to finish.
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <section className="category-content">
            <AnimeGrid items={items} onUpdateCategory={updateCategory} onUpdateRating={updateRating} categories={CATEGORIES} />
            
            {/* Numbered Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '3rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button 
                  className="tab-button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Prev
                </button>
                
                {getPageNumbers().map(pageNum => (
                  <button
                    key={pageNum}
                    className={`tab-button ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {pageNum}
                  </button>
                ))}
                
                <button 
                  className="tab-button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <AddFromMalModal 
        isOpen={isMalModalOpen} 
        onClose={() => setIsMalModalOpen(false)} 
        categories={CATEGORIES}
        onAddSuccess={handleMalAddSuccess}
      />
    </div>
  );
}

export default App;
