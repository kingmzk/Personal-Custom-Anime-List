package com.anime.backend.service;

import com.anime.backend.model.Anime;
import com.anime.backend.repository.AnimeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.w3c.dom.Element;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AnimeImportService {

    @Autowired
    private AnimeRepository animeRepository;

    @Autowired
    private ImportState importState;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Map<String, String> MAL_STATUS_MAP = new HashMap<>();
    static {
        MAL_STATUS_MAP.put("watching", "Watching");
        MAL_STATUS_MAP.put("completed", "Completed");
        MAL_STATUS_MAP.put("on-hold", "On-Hold");
        MAL_STATUS_MAP.put("dropped", "Dropped");
        MAL_STATUS_MAP.put("plan to watch", "Plan to watch");
        MAL_STATUS_MAP.put("plantowatch", "Plan to watch");
    }

    @Async
    public void startProcessing(String fileContent) {
        importState.reset();
        int added = 0, updated = 0, errors = 0;

        String content = fileContent.trim();
        if (content.startsWith("\uFEFF")) {
            content = content.substring(1).trim();
        }

        // 1. Try XML
        if (content.startsWith("<?xml") || content.startsWith("<myanimelist>")) {
            try {
                DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
                DocumentBuilder builder = factory.newDocumentBuilder();
                Document doc = builder.parse(new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)));
                
                NodeList entries = doc.getElementsByTagName("anime");
                int total = entries.getLength();
                importState.setTotal(total);
                importState.logMessage("📄 Found " + total + " anime entries in MAL XML export.");

                for (int i = 0; i < total; i++) {
                    Element animeElem = (Element) entries.item(i);
                    String malIdStr = getTagValue("series_animedb_id", animeElem);
                    String title = getTagValue("series_title", animeElem);
                    String status = getTagValue("my_status", animeElem);
                    String scoreStr = getTagValue("my_score", animeElem);

                    if (malIdStr != null && title != null && !title.trim().isEmpty()) {
                        try {
                            int malId = Integer.parseInt(malIdStr);
                            String rawStatus = status != null ? status.trim().toLowerCase() : "";
                            String category = MAL_STATUS_MAP.getOrDefault(rawStatus, status != null ? status : "Uncategorized");
                            String url = "https://myanimelist.net/anime/" + malId;

                            Double personalRating = null;
                            try {
                                if (scoreStr != null && !scoreStr.trim().equals("0")) {
                                    personalRating = Double.parseDouble(scoreStr.trim());
                                }
                            } catch (Exception ignored) {}

                            boolean created = upsertAnime(malId, title.trim(), url, category, personalRating);
                            if (created) {
                                added++;
                                importState.logMessage("[" + (i + 1) + "/" + total + "] ✅ Added — " + title);
                            } else {
                                updated++;
                                importState.logMessage("[" + (i + 1) + "/" + total + "] 🔄 Updated — " + title);
                            }
                        } catch (Exception e) {
                            errors++;
                            importState.logMessage("[" + (i + 1) + "/" + total + "] ❌ Error: " + e.getMessage());
                        }
                    }
                    importState.setCurrent(i + 1);
                }
                finishImport(added, updated, errors);
                return;
            } catch (Exception e) {
                importState.logMessage("❌ XML parse error: " + e.getMessage());
                importState.setStatus("error");
                return;
            }
        }

        // 2. Try JSON
        try {
            Map<String, List<Map<String, Object>>> data = objectMapper.readValue(
                content, 
                new TypeReference<Map<String, List<Map<String, Object>>>>() {}
            );
            
            int total = data.values().stream().mapToInt(List::size).sum();
            importState.setTotal(total);
            importState.logMessage("📄 Found " + total + " anime entries in JSON format.");

            int current = 0;
            for (Map.Entry<String, List<Map<String, Object>>> entry : data.entrySet()) {
                String category = entry.getKey();
                for (Map<String, Object> item : entry.getValue()) {
                    Object malIdObj = item.get("mal_id");
                    Object titleObj = item.get("name");
                    Object urlObj = item.get("link");

                    if (malIdObj != null && titleObj != null) {
                        try {
                            int malId = ((Number) malIdObj).intValue();
                            String title = titleObj.toString();
                            String url = urlObj != null ? urlObj.toString() : null;

                            boolean created = upsertAnime(malId, title, url, category, null);
                            if (created) {
                                added++;
                                importState.logMessage("[" + (current + 1) + "/" + total + "] ✅ Added — " + title);
                            } else {
                                updated++;
                                importState.logMessage("[" + (current + 1) + "/" + total + "] 🔄 Updated — " + title);
                            }
                        } catch (Exception e) {
                            errors++;
                        }
                    }
                    current++;
                    importState.setCurrent(current);
                }
            }
            finishImport(added, updated, errors);
            return;
        } catch (Exception ignored) { }

        // 3. Try TXT
        String[] lines = content.split("\\r?\\n");
        List<TxtEntry> txtEntries = new ArrayList<>();
        String currentCat = "Uncategorized";

        Pattern regex = Pattern.compile("/anime/(\\d+)");

        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;
            if (line.startsWith("#")) {
                currentCat = line.substring(1).trim();
                continue;
            }
            if (line.contains("|")) {
                String[] parts = line.split("\\|", 2);
                String title = parts[0].trim();
                String url = parts[1].trim();
                Matcher matcher = regex.matcher(url);
                if (matcher.find()) {
                    txtEntries.add(new TxtEntry(Integer.parseInt(matcher.group(1)), title, url, currentCat));
                }
            }
        }

        int total = txtEntries.size();
        importState.setTotal(total);
        importState.logMessage("📄 Found " + total + " anime entries in TXT format.");

        for (int i = 0; i < total; i++) {
            TxtEntry entry = txtEntries.get(i);
            try {
                boolean created = upsertAnime(entry.malId, entry.title, entry.url, entry.category, null);
                if (created) {
                    added++;
                    importState.logMessage("[" + (i + 1) + "/" + total + "] ✅ Added — " + entry.title);
                } else {
                    updated++;
                    importState.logMessage("[" + (i + 1) + "/" + total + "] 🔄 Updated — " + entry.title);
                }
            } catch (Exception e) {
                errors++;
            }
            importState.setCurrent(i + 1);
        }

        finishImport(added, updated, errors);
    }

    private void finishImport(int added, int updated, int errors) {
        importState.logMessage("");
        importState.logMessage("✔️  Import complete! Added: " + added + " | Updated: " + updated + " | Errors: " + errors);
        importState.setStatus("done");
    }

    private String getTagValue(String tag, Element element) {
        NodeList nlList = element.getElementsByTagName(tag);
        if (nlList != null && nlList.getLength() > 0) {
            NodeList subList = nlList.item(0).getChildNodes();
            if (subList != null && subList.getLength() > 0) {
                return subList.item(0).getNodeValue();
            }
        }
        return null;
    }

    private static class TxtEntry {
        int malId; String title; String url; String category;
        TxtEntry(int m, String t, String u, String c) { malId=m; title=t; url=u; category=c; }
    }

    @Transactional
    public boolean upsertAnime(int malId, String title, String url, String currentCategory, Double personalRating) {
        Optional<Anime> existingOpt = animeRepository.findByMalId(malId);
        Anime anime;
        boolean created = false;

        if (existingOpt.isPresent()) {
            anime = existingOpt.get();
            anime.setCategory(currentCategory);
            if (personalRating != null) anime.setPersonalRating(personalRating);
            animeRepository.save(anime);
            return false; // Not created, just updated DB
        } else {
            anime = new Anime();
            anime.setMalId(malId);
            anime.setTitle(title);
            anime.setUrl(url);
            anime.setCategory(currentCategory);
            anime.setPersonalRating(personalRating);
            animeRepository.save(anime);
            created = true;
        }

        // Fetch from external APIs
        try {
            Thread.sleep(1500); // Rate limiting
            ResponseEntity<String> response = restTemplate.getForEntity("https://api.jikan.moe/v4/anime/" + malId, String.class);
            
            String imageUrl = null;
            String synopsis = null;

            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode data = root.path("data");

                JsonNode images = data.path("images");
                if (images.has("webp") && images.path("webp").has("large_image_url")) {
                    imageUrl = images.path("webp").path("large_image_url").asText();
                } else if (images.has("jpg") && images.path("jpg").has("large_image_url")) {
                    imageUrl = images.path("jpg").path("large_image_url").asText();
                }

                if (data.has("score") && !data.path("score").isNull()) anime.setScore(data.path("score").asDouble());
                if (data.has("year") && !data.path("year").isNull()) anime.setYear(data.path("year").asInt());
                if (data.has("type") && !data.path("type").isNull()) anime.setType(data.path("type").asText());
                if (data.has("synopsis") && !data.path("synopsis").isNull()) {
                    synopsis = data.path("synopsis").asText();
                    anime.setSynopsis(synopsis);
                }
                
                if (data.has("title_english") && !data.path("title_english").isNull()) {
                    anime.setTitle(data.path("title_english").asText());
                }

            } else {
                String[] fallback = fetchKitsuFallback(title);
                imageUrl = fallback[0];
                anime.setSynopsis(fallback[1]);
                if (response.getStatusCode().value() == 429) {
                    Thread.sleep(10000);
                }
            }

            anime.setImageUrl(imageUrl);
            anime.setImageBase64(downloadImageAsBase64(imageUrl));
            animeRepository.save(anime);
        } catch (Exception ignored) {
            // Background fetch error ignored
        }

        return created;
    }

    private String[] fetchKitsuFallback(String title) {
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("Accept", "application/vnd.api+json");
            org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                "https://kitsu.io/api/edge/anime?filter[text]=" + java.net.URLEncoder.encode(title, "UTF-8") + "&page[limit]=1",
                org.springframework.http.HttpMethod.GET,
                entity,
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode data = root.path("data");
                if (data.isArray() && data.size() > 0) {
                    JsonNode attrs = data.get(0).path("attributes");
                    String img = null;
                    if (attrs.has("posterImage")) {
                        JsonNode poster = attrs.path("posterImage");
                        if (poster.has("large")) img = poster.path("large").asText();
                        else if (poster.has("medium")) img = poster.path("medium").asText();
                        else if (poster.has("original")) img = poster.path("original").asText();
                    }
                    String syn = attrs.has("synopsis") ? attrs.path("synopsis").asText() : null;
                    return new String[]{img, syn};
                }
            }
        } catch (Exception ignored) { }
        return new String[]{null, null};
    }

    public String downloadImageAsBase64(String url) {
        if (url == null || url.isEmpty()) return null;
        try {
            ResponseEntity<byte[]> response = restTemplate.getForEntity(url, byte[].class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String base64 = Base64.getEncoder().encodeToString(response.getBody());
                String contentType = response.getHeaders().getContentType() != null ? 
                    response.getHeaders().getContentType().toString() : "image/jpeg";
                return "data:" + contentType + ";base64," + base64;
            }
        } catch (Exception ignored) { }
        return null;
    }
}
