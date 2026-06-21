using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend_dotnetWebApi.Data;
using backend_dotnetWebApi.Models;
using backend_dotnetWebApi.Services;

namespace backend_dotnetWebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AnimesController : ControllerBase
    {
        private readonly AnimeContext _context;
        private readonly ImportState _importState;
        private readonly AnimeImportService _importService;

        public AnimesController(AnimeContext context, ImportState importState, AnimeImportService importService)
        {
            _context = context;
            _importState = importState;
            _importService = importService;
        }

        [HttpGet]
        public async Task<ActionResult<object>> GetAnimes(
            [FromQuery] int page = 1,
            [FromQuery] string? search = null,
            [FromQuery] string? category = null,
            [FromQuery] string? type = null,
            [FromQuery] double? min_score = null,
            [FromQuery] string? ordering = "-updated_at")
        {
            int pageSize = 20;
            var query = _context.Animes.AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(a => EF.Functions.Like(a.Title, $"%{search}%"));
            }
            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(a => a.Category == category);
            }
            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(a => a.Type == type);
            }
            if (min_score.HasValue)
            {
                query = query.Where(a => a.Score >= min_score.Value);
            }

            // Ordering
            if (!string.IsNullOrEmpty(ordering))
            {
                bool desc = ordering.StartsWith("-");
                string field = ordering.TrimStart('-');
                
                query = field.ToLower() switch
                {
                    "updated_at" => desc ? query.OrderByDescending(a => a.UpdatedAt) : query.OrderBy(a => a.UpdatedAt),
                    "score" => desc ? query.OrderByDescending(a => a.Score) : query.OrderBy(a => a.Score),
                    "year" => desc ? query.OrderByDescending(a => a.Year) : query.OrderBy(a => a.Year),
                    "title" => desc ? query.OrderByDescending(a => a.Title) : query.OrderBy(a => a.Title),
                    "personal_rating" => desc ? query.OrderByDescending(a => a.PersonalRating) : query.OrderBy(a => a.PersonalRating),
                    _ => query.OrderByDescending(a => a.UpdatedAt)
                };
            }

            int total = await query.CountAsync();
            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            string? next = (page * pageSize) < total ? $"?page={page + 1}" : null;
            string? prev = page > 1 ? $"?page={page - 1}" : null;

            return new
            {
                count = total,
                next = next,
                previous = prev,
                results = items
            };
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Anime>> GetAnime(long id)
        {
            var anime = await _context.Animes.FindAsync(id);
            if (anime == null) return NotFound();
            return anime;
        }

        [HttpPost]
        public async Task<ActionResult<Anime>> PostAnime(Anime anime)
        {
            _context.Animes.Add(anime);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAnime), new { id = anime.Id }, anime);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutAnime(long id, Anime anime)
        {
            if (id != anime.Id) return BadRequest();
            _context.Entry(anime).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPatch("{id}")]
        public async Task<IActionResult> PatchAnime(long id, [FromBody] System.Text.Json.Nodes.JsonObject updates)
        {
            var anime = await _context.Animes.FindAsync(id);
            if (anime == null) return NotFound();

            if (updates.TryGetPropertyValue("category", out var categoryNode) && categoryNode != null)
            {
                anime.Category = categoryNode.ToString();
            }
            if (updates.TryGetPropertyValue("personal_rating", out var ratingNode))
            {
                anime.PersonalRating = ratingNode == null ? null : (double?)ratingNode.AsValue();
            }
            if (updates.TryGetPropertyValue("watched_date", out var dateNode))
            {
                if (dateNode == null)
                {
                    anime.WatchedDate = null;
                }
                else
                {
                    string dateStr = dateNode.ToString();
                    anime.WatchedDate = string.IsNullOrEmpty(dateStr) ? null : DateTime.Parse(dateStr);
                }
            }

            anime.UpdatedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(anime);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAnime(long id)
        {
            var anime = await _context.Animes.FindAsync(id);
            if (anime == null) return NotFound();
            _context.Animes.Remove(anime);
            await _context.SaveChangesAsync();
            return Ok(new { status = "success" });
        }

        [HttpPost("upload_list")]
        public async Task<IActionResult> UploadList(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file uploaded." });

            using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8);
            var content = await reader.ReadToEndAsync();
            
            _importService.StartProcessing(content);
            return Ok(new { message = "File uploaded successfully. Processing in background..." });
        }

        public class MalAddRequest
        {
            public int mal_id { get; set; }
            public string? title { get; set; }
            public string? url { get; set; }
            public string? category { get; set; } = "Plan to watch";
            public string? image_url { get; set; }
            public double? score { get; set; }
            public int? year { get; set; }
            public string? type { get; set; }
            public string? synopsis { get; set; }
        }

        [HttpPost("add_from_mal")]
        public async Task<IActionResult> AddFromMal([FromBody] MalAddRequest req)
        {
            string url = req.url ?? $"https://myanimelist.net/anime/{req.mal_id}";
            string title = req.title ?? "Unknown Title";

            await _importService.UpsertAnimeAsync(req.mal_id, title, url, req.category, null);
            var anime = await _context.Animes.FirstOrDefaultAsync(a => a.MalId == req.mal_id);
            return Ok(anime);
        }

        [HttpGet("import_status")]
        public IActionResult ImportStatus()
        {
            return Ok(_importState.GetStateSnapshot());
        }
    }
}
