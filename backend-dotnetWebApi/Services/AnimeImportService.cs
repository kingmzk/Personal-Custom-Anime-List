using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml.Linq;
using backend_dotnetWebApi.Data;
using backend_dotnetWebApi.Models;
using Microsoft.Extensions.DependencyInjection;

namespace backend_dotnetWebApi.Services
{
    public class AnimeImportService
    {
        private readonly ImportState _importState;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly HttpClient _httpClient;

        private static readonly Dictionary<string, string> MalStatusMap = new(StringComparer.OrdinalIgnoreCase)
        {
            {"watching", "Watching"},
            {"completed", "Completed"},
            {"on-hold", "On-Hold"},
            {"dropped", "Dropped"},
            {"plan to watch", "Plan to watch"},
            {"plantowatch", "Plan to watch"}
        };

        public AnimeImportService(ImportState importState, IServiceScopeFactory scopeFactory)
        {
            _importState = importState;
            _scopeFactory = scopeFactory;
            _httpClient = new HttpClient();
        }

        public void StartProcessing(string fileContent)
        {
            Task.Run(async () => await ProcessUploadedFileAsync(fileContent));
        }

        private async Task ProcessUploadedFileAsync(string fileContent)
        {
            _importState.Reset();
            int added = 0, updated = 0, errors = 0;

            string content = fileContent.Trim();
            if (content.StartsWith("\uFEFF"))
            {
                content = content.Substring(1).Trim();
            }

            // 1. Try XML
            if (content.StartsWith("<?xml") || content.StartsWith("<myanimelist>"))
            {
                try
                {
                    var doc = XDocument.Parse(content);
                    var entries = doc.Descendants("anime").ToList();
                    _importState.Total = entries.Count;
                    _importState.Log($"📄 Found {entries.Count} anime entries in MAL XML export.");

                    for (int i = 0; i < entries.Count; i++)
                    {
                        var animeElem = entries[i];
                        string malIdStr = animeElem.Element("series_animedb_id")?.Value;
                        string title = animeElem.Element("series_title")?.Value?.Trim();
                        string status = animeElem.Element("my_status")?.Value?.Trim();
                        string scoreStr = animeElem.Element("my_score")?.Value?.Trim();

                        if (int.TryParse(malIdStr, out int malId) && !string.IsNullOrEmpty(title))
                        {
                            string category = MalStatusMap.TryGetValue(status ?? "", out string cat) ? cat : (status ?? "Uncategorized");
                            string url = $"https://myanimelist.net/anime/{malId}";
                            
                            double? personalRating = null;
                            if (double.TryParse(scoreStr, out double s) && s != 0)
                            {
                                personalRating = s;
                            }

                            try
                            {
                                bool created = await UpsertAnimeAsync(malId, title, url, category, personalRating);
                                if (created) { added++; _importState.Log($"[{i + 1}/{_importState.Total}] ✅ Added — {title}"); }
                                else { updated++; _importState.Log($"[{i + 1}/{_importState.Total}] 🔄 Updated — {title}"); }
                            }
                            catch (Exception e)
                            {
                                errors++;
                                _importState.Log($"[{i + 1}/{_importState.Total}] ❌ Error for mal_id={malId}: {e.Message}");
                            }
                        }
                        _importState.Current = i + 1;
                    }
                    FinishImport(added, updated, errors);
                    return;
                }
                catch (Exception e)
                {
                    _importState.Log($"❌ XML parse error: {e.Message}");
                    _importState.Status = "error";
                    return;
                }
            }

            // 2. Try JSON
            try
            {
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var data = JsonSerializer.Deserialize<Dictionary<string, List<JsonElement>>>(content, options);
                
                if (data != null)
                {
                    int total = data.Values.Sum(v => v.Count);
                    _importState.Total = total;
                    _importState.Log($"📄 Found {total} anime entries in JSON format.");

                    int current = 0;
                    foreach (var kvp in data)
                    {
                        string category = kvp.Key;
                        foreach (var item in kvp.Value)
                        {
                            int? malId = item.TryGetProperty("mal_id", out var malIdProp) && malIdProp.ValueKind == JsonValueKind.Number ? malIdProp.GetInt32() : null;
                            string title = item.TryGetProperty("name", out var titleProp) ? titleProp.GetString() : null;
                            string url = item.TryGetProperty("link", out var urlProp) ? urlProp.GetString() : null;

                            if (malId.HasValue && !string.IsNullOrEmpty(title))
                            {
                                try
                                {
                                    bool created = await UpsertAnimeAsync(malId.Value, title, url, category, null);
                                    if (created) { added++; _importState.Log($"[{current + 1}/{total}] ✅ Added — {title}"); }
                                    else { updated++; _importState.Log($"[{current + 1}/{total}] 🔄 Updated — {title}"); }
                                }
                                catch (Exception) { errors++; }
                            }
                            current++;
                            _importState.Current = current;
                        }
                    }
                    FinishImport(added, updated, errors);
                    return;
                }
            }
            catch { }

            // 3. Fallback TXT
            var lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            var parsedEntries = new List<(int MalId, string Title, string Url, string Category)>();
            string currentCat = "Uncategorized";

            foreach (var line in lines)
            {
                string l = line.Trim();
                if (string.IsNullOrEmpty(l)) continue;
                if (l.StartsWith("#"))
                {
                    currentCat = l.Substring(1).Trim();
                    continue;
                }
                
                if (l.Contains("|"))
                {
                    var parts = l.Split('|', 2);
                    string title = parts[0].Trim();
                    string url = parts[1].Trim();
                    var match = Regex.Match(url, @"/anime/(\d+)");
                    if (match.Success && int.TryParse(match.Groups[1].Value, out int malId))
                    {
                        parsedEntries.Add((malId, title, url, currentCat));
                    }
                }
            }

            _importState.Total = parsedEntries.Count;
            _importState.Log($"📄 Found {parsedEntries.Count} anime entries in TXT format.");

            for (int i = 0; i < parsedEntries.Count; i++)
            {
                var entry = parsedEntries[i];
                try
                {
                    bool created = await UpsertAnimeAsync(entry.MalId, entry.Title, entry.Url, entry.Category, null);
                    if (created) { added++; _importState.Log($"[{i + 1}/{_importState.Total}] ✅ Added — {entry.Title}"); }
                    else { updated++; _importState.Log($"[{i + 1}/{_importState.Total}] 🔄 Updated — {entry.Title}"); }
                }
                catch (Exception) { errors++; }
                _importState.Current = i + 1;
            }

            FinishImport(added, updated, errors);
        }

        private void FinishImport(int added, int updated, int errors)
        {
            _importState.Log("");
            _importState.Log($"✔️  Import complete! Added: {added} | Updated: {updated} | Errors: {errors}");
            _importState.Status = "done";
        }

        public async Task<bool> UpsertAnimeAsync(int malId, string title, string url, string currentCategory, double? personalRating)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AnimeContext>();

            var anime = db.Animes.FirstOrDefault(a => a.MalId == malId);
            bool created = false;

            if (anime == null)
            {
                anime = new Anime
                {
                    MalId = malId,
                    Title = title,
                    Url = url,
                    Category = currentCategory,
                    PersonalRating = personalRating
                };
                db.Animes.Add(anime);
                db.SaveChanges();
                created = true;
            }
            else
            {
                anime.Category = currentCategory;
                if (personalRating.HasValue) anime.PersonalRating = personalRating.Value;
                db.SaveChanges();
                return false;
            }

            try
            {
                await Task.Delay(1500); // Rate limit
                using var response = await _httpClient.GetAsync($"https://api.jikan.moe/v4/anime/{malId}");
                
                string imageUrl = null;
                string synopsis = null;
                
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var data = doc.RootElement.GetProperty("data");

                    if (data.TryGetProperty("images", out var images))
                    {
                        if (images.TryGetProperty("webp", out var webp) && webp.TryGetProperty("large_image_url", out var largeImg))
                            imageUrl = largeImg.GetString();
                        else if (images.TryGetProperty("jpg", out var jpg) && jpg.TryGetProperty("large_image_url", out var jpgImg))
                            imageUrl = jpgImg.GetString();
                    }

                    anime.Score = data.TryGetProperty("score", out var scoreProp) && scoreProp.ValueKind == JsonValueKind.Number ? scoreProp.GetDouble() : null;
                    anime.Year = data.TryGetProperty("year", out var yearProp) && yearProp.ValueKind == JsonValueKind.Number ? yearProp.GetInt32() : null;
                    anime.Type = data.TryGetProperty("type", out var typeProp) && typeProp.ValueKind == JsonValueKind.String ? typeProp.GetString() : null;
                    anime.Synopsis = data.TryGetProperty("synopsis", out var synProp) && synProp.ValueKind == JsonValueKind.String ? synProp.GetString() : null;

                    string titleEnglish = data.TryGetProperty("title_english", out var titleEngProp) && titleEngProp.ValueKind == JsonValueKind.String ? titleEngProp.GetString() : null;
                    if (!string.IsNullOrEmpty(titleEnglish))
                    {
                        anime.Title = titleEnglish;
                    }
                }
                else
                {
                    var (kitsuImg, kitsuSyn) = await FetchKitsuFallback(title);
                    imageUrl = kitsuImg;
                    anime.Synopsis = kitsuSyn;
                    if ((int)response.StatusCode == 429)
                    {
                        await Task.Delay(10000);
                    }
                }

                anime.ImageUrl = imageUrl;
                anime.ImageBase64 = await DownloadImageAsBase64(imageUrl);
                db.SaveChanges();
            }
            catch
            {
                // Ignore API fetch errors
            }

            return true;
        }

        private async Task<(string ImageUrl, string Synopsis)> FetchKitsuFallback(string title)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"https://kitsu.io/api/edge/anime?filter[text]={Uri.EscapeDataString(title)}&page[limit]=1");
                request.Headers.Add("Accept", "application/vnd.api+json");
                
                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var data = doc.RootElement.GetProperty("data");
                    
                    if (data.GetArrayLength() > 0)
                    {
                        var attrs = data[0].GetProperty("attributes");
                        string imageUrl = null;
                        
                        if (attrs.TryGetProperty("posterImage", out var images))
                        {
                            if (images.TryGetProperty("large", out var large)) imageUrl = large.GetString();
                            else if (images.TryGetProperty("medium", out var med)) imageUrl = med.GetString();
                            else if (images.TryGetProperty("original", out var orig)) imageUrl = orig.GetString();
                        }
                        
                        string synopsis = attrs.TryGetProperty("synopsis", out var syn) ? syn.GetString() : null;
                        return (imageUrl, synopsis);
                    }
                }
            }
            catch { }
            return (null, null);
        }

        public async Task<string> DownloadImageAsBase64(string url)
        {
            if (string.IsNullOrEmpty(url)) return null;
            try
            {
                var response = await _httpClient.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    var bytes = await response.Content.ReadAsByteArrayAsync();
                    var base64 = Convert.ToBase64String(bytes);
                    var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
                    return $"data:{contentType};base64,{base64}";
                }
            }
            catch { }
            return null;
        }
    }
}
