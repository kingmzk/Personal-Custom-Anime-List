using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend_dotnetWebApi.Models
{
    public class Anime
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [Column("mal_id")]
        public int MalId { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        [Column("url")]
        public string Url { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        [Column("category")]
        public string Category { get; set; } = string.Empty;

        [MaxLength(500)]
        [Column("image_url")]
        public string? ImageUrl { get; set; }

        [Column("image_base64")]
        public string? ImageBase64 { get; set; }

        [Column("score")]
        public double? Score { get; set; }

        [Column("year")]
        public int? Year { get; set; }

        [MaxLength(50)]
        [Column("type")]
        public string? Type { get; set; }

        [Column("synopsis")]
        public string? Synopsis { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("personal_rating")]
        public double? PersonalRating { get; set; }

        [Column("watched_date")]
        public DateTime? WatchedDate { get; set; }
    }
}
