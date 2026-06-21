using Microsoft.EntityFrameworkCore;
using backend_dotnetWebApi.Models;

namespace backend_dotnetWebApi.Data
{
    public class AnimeContext : DbContext
    {
        public AnimeContext(DbContextOptions<AnimeContext> options) : base(options) { }

        public DbSet<Anime> Animes { get; set; }
        
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Anime>().ToTable("api_anime"); // Match Django table
            modelBuilder.Entity<Anime>().HasIndex(a => a.MalId).IsUnique();
        }
    }
}
