import { AnimeCard } from './AnimeCard';

export function AnimeGrid({ items, onUpdateCategory, onUpdateRating, onDelete, categories }) {
  if (!items || items.length === 0) {
    return <div className="empty-state">No anime found in this category.</div>;
  }

  return (
    <div className="anime-grid">
      {items.map((item, index) => (
        <AnimeCard 
          key={`${item.malId}-${index}`} 
          item={item} 
          onUpdateCategory={onUpdateCategory}
          onUpdateRating={onUpdateRating}
          onDelete={onDelete}
          categories={categories}
        />
      ))}
    </div>
  );
}
