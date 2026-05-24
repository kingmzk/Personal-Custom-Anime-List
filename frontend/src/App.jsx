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
  const [importProgress, setImportProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isMalModalOpen, setIsMalModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState("-updated_at");
  const [filterType, setFilterType] = useState("");
  const [filterScore, setFilterScore] = useState("");
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Poll for import status
  useEffect(() => {
    let intervalId;
    const checkStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/animes/import_status/');
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'running') {
            setImportProgress({
              total: data.total,
              current: data.current,
              log: data.log
            });
            setUploadStatus(null); // Clear static message while running
          } else if (data.status === 'done' || data.status === 'error') {
            if (importProgress) {
              setImportProgress(null);
              if (data.status === 'done') {
                setUploadStatus('Import complete!');
                setTimeout(() => setUploadStatus(null), 5000);
                // Trigger reload
                setReloadTrigger(prev => prev + 1);
              } else {
                setUploadStatus('Import failed or encountered an error.');
                setTimeout(() => setUploadStatus(null), 5000);
              }
            }
          }
        }
      } catch (e) {
        // ignore errors if backend is down
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 1500);
    return () => clearInterval(intervalId);
  }, [importProgress]);

  // Reset page to 1 when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, sortBy, filterType, filterScore]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        let url = `http://localhost:8000/api/animes/?category=${encodeURIComponent(activeCategory)}&page=${currentPage}&ordering=${sortBy}`;
        if (searchQuery) {
          url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        if (filterType) {
          url += `&type=${encodeURIComponent(filterType)}`;
        }
        if (filterScore) {
          url += `&min_score=${encodeURIComponent(filterScore)}`;
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
  }, [activeCategory, currentPage, searchQuery, sortBy, filterType, filterScore, reloadTrigger]);

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

  const requestDeleteAnime = (id) => {
    const item = items.find(a => a.id === id);
    if (item) setDeleteConfirmItem(item);
  };

  const confirmDeleteAnime = async () => {
    if (!deleteConfirmItem) return;
    try {
      const response = await fetch(`http://localhost:8000/api/animes/${deleteConfirmItem.id}/`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setItems(items.filter(item => item.id !== deleteConfirmItem.id));
        setTotalCount(prev => prev - 1);
      }
    } catch (err) {
      console.error('Failed to delete anime', err);
    }
    setDeleteConfirmItem(null);
  };

  const cancelDeleteAnime = () => {
    setDeleteConfirmItem(null);
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
        setUploadStatus('Upload successful. Starting processing...');
        // The background polling will take over here
      } else {
        setUploadStatus('Error: ' + data.error);
        setTimeout(() => setUploadStatus(null), 5000);
      }
    } catch (err) {
      setUploadStatus('Upload failed. Ensure backend is running.');
      setTimeout(() => setUploadStatus(null), 5000);
    }
    
    // clear input
    e.target.value = null;
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
              <input type="file" accept=".txt,.json,.xml" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>
      
      {uploadStatus && !importProgress && (
        <div style={{ textAlign: 'center', background: uploadStatus.includes('Error') || uploadStatus.includes('failed') ? '#ef4444' : '#10b981', color: 'white', padding: '0.75rem', margin: '1rem', borderRadius: '8px' }}>
          {uploadStatus}
        </div>
      )}

      {importProgress && (
        <div style={{ margin: '1rem', padding: '1rem', background: '#1f2937', borderRadius: '8px', border: '1px solid #374151' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'bold', color: '#e5e7eb' }}>Importing Anime...</span>
            <span style={{ color: '#9ca3af' }}>{importProgress.current} / {importProgress.total} ({(importProgress.current / (importProgress.total || 1) * 100).toFixed(1)}%)</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#374151', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(importProgress.current / (importProgress.total || 1)) * 100}%`, background: '#3b82f6', transition: 'width 0.3s ease' }}></div>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#9ca3af', height: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {importProgress.log && importProgress.log.length > 0 ? importProgress.log[importProgress.log.length - 1] : 'Initializing...'}
          </div>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', background: '#222', color: 'white', border: '1px solid #333' }}
              >
                <option value="">All Types</option>
                <option value="TV">TV</option>
                <option value="Movie">Movie</option>
                <option value="OVA">OVA</option>
                <option value="Special">Special</option>
                <option value="ONA">ONA</option>
                <option value="Music">Music</option>
              </select>

              <select 
                value={filterScore} 
                onChange={e => setFilterScore(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', background: '#222', color: 'white', border: '1px solid #333' }}
              >
                <option value="">All Scores</option>
                <option value="9">9+ (Masterpiece)</option>
                <option value="8">8+ (Great)</option>
                <option value="7">7+ (Good)</option>
                <option value="6">6+ (Fine)</option>
              </select>

              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '8px', background: '#222', color: 'white', border: '1px solid #333' }}
              >
                <option value="-updated_at">Recently Updated</option>
                <option value="-score">Highest Score</option>
                <option value="-personal_rating">Highest Rating</option>
                <option value="-year">Newest Release</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
            
            <AnimeGrid items={items} onUpdateCategory={updateCategory} onUpdateRating={updateRating} onDelete={requestDeleteAnime} categories={CATEGORIES} />
            
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

      {deleteConfirmItem && (
        <div className="modal-overlay" onClick={cancelDeleteAnime}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', textAlign: 'center', background: '#1f2937', color: 'white', borderRadius: '8px', maxWidth: '400px', width: '100%' }}>
            <h2 style={{ marginBottom: '1rem' }}>Confirm Deletion</h2>
            <p style={{ color: '#d1d5db', marginBottom: '2rem' }}>Are you sure you want to remove <strong style={{ color: '#fff' }}>{deleteConfirmItem.title}</strong> from your list?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button 
                onClick={cancelDeleteAnime}
                style={{ padding: '0.75rem 1.5rem', background: '#4b5563', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteAnime}
                style={{ padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
