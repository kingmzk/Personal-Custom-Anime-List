package com.anime.backend.controller;

import com.anime.backend.model.Anime;
import com.anime.backend.repository.AnimeRepository;
import com.anime.backend.service.AnimeImportService;
import com.anime.backend.service.ImportState;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/animes")
@CrossOrigin(origins = "*") // Allow all origins like Django
public class AnimesController {

    @Autowired
    private AnimeRepository animeRepository;

    @Autowired
    private AnimeImportService animeImportService;

    @Autowired
    private ImportState importState;

    @GetMapping({"", "/"})
    public ResponseEntity<?> getAnimes(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Double min_score,
            @RequestParam(defaultValue = "-updated_at") String ordering) {

        int pageSize = 20;

        Specification<Anime> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isEmpty()) {
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + search.toLowerCase() + "%"));
            }
            if (category != null && !category.isEmpty()) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (type != null && !type.isEmpty()) {
                predicates.add(cb.equal(root.get("type"), type));
            }
            if (min_score != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("score"), min_score));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Sort sort = Sort.unsorted();
        if (ordering != null && !ordering.isEmpty()) {
            boolean desc = ordering.startsWith("-");
            String field = ordering.replaceFirst("^-", "");
            if (field.equals("updated_at")) field = "updatedAt";
            if (field.equals("personal_rating")) field = "personalRating";
            
            sort = desc ? Sort.by(field).descending() : Sort.by(field).ascending();
        }

        Pageable pageable = PageRequest.of(page - 1, pageSize, sort);
        Page<Anime> animePage = animeRepository.findAll(spec, pageable);

        String next = animePage.hasNext() ? "?page=" + (page + 1) : null;
        String previous = animePage.hasPrevious() ? "?page=" + (page - 1) : null;

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("count", animePage.getTotalElements());
        response.put("next", next);
        response.put("previous", previous);
        response.put("results", animePage.getContent());

        return ResponseEntity.ok(response);
    }

    @PostMapping({"", "/"})
    public ResponseEntity<Anime> createAnime(@RequestBody Anime anime) {
        Anime saved = animeRepository.save(anime);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping({"/{id}", "/{id}/"})
    public ResponseEntity<Anime> getAnime(@PathVariable Long id) {
        Optional<Anime> anime = animeRepository.findById(id);
        return anime.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping({"/{id}", "/{id}/"})
    public ResponseEntity<Anime> updateAnime(@PathVariable Long id, @RequestBody Anime animeDetails) {
        return animeRepository.findById(id).map(anime -> {
            anime.setMalId(animeDetails.getMalId());
            anime.setTitle(animeDetails.getTitle());
            anime.setUrl(animeDetails.getUrl());
            anime.setCategory(animeDetails.getCategory());
            anime.setImageUrl(animeDetails.getImageUrl());
            anime.setImageBase64(animeDetails.getImageBase64());
            anime.setScore(animeDetails.getScore());
            anime.setYear(animeDetails.getYear());
            anime.setType(animeDetails.getType());
            anime.setSynopsis(animeDetails.getSynopsis());
            anime.setPersonalRating(animeDetails.getPersonalRating());
            Anime updated = animeRepository.save(anime);
            return ResponseEntity.ok(updated);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping({"/{id}", "/{id}/"})
    public ResponseEntity<Anime> patchAnime(@PathVariable Long id, @RequestBody Map<String, Object> updates) {
        return animeRepository.findById(id).map(anime -> {
            if (updates.containsKey("category")) {
                anime.setCategory((String) updates.get("category"));
            }
            if (updates.containsKey("personal_rating")) {
                Object rating = updates.get("personal_rating");
                if (rating == null) {
                    anime.setPersonalRating(null);
                } else if (rating instanceof Number) {
                    anime.setPersonalRating(((Number) rating).doubleValue());
                }
            }
            if (updates.containsKey("watched_date")) {
                Object date = updates.get("watched_date");
                if (date == null || ((String) date).isEmpty()) {
                    anime.setWatchedDate(null);
                } else {
                    anime.setWatchedDate(LocalDate.parse((String) date));
                }
            }
            Anime updated = animeRepository.save(anime);
            return ResponseEntity.ok(updated);
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping({"/{id}", "/{id}/"})
    public ResponseEntity<?> deleteAnime(@PathVariable Long id) {
        return animeRepository.findById(id).map(anime -> {
            animeRepository.delete(anime);
            return ResponseEntity.ok(Map.of("status", "success"));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping({"/upload_list", "/upload_list/"})
    public ResponseEntity<?> uploadList(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded."));
        }
        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            animeImportService.startProcessing(content);
            return ResponseEntity.ok(Map.of("message", "File uploaded successfully. Processing in background..."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    public static class MalAddRequest {
        public int mal_id;
        public String title;
        public String url;
        public String category = "Plan to watch";
        public String image_url;
        public Double score;
        public Integer year;
        public String type;
        public String synopsis;
    }

    @PostMapping({"/add_from_mal", "/add_from_mal/"})
    public ResponseEntity<?> addFromMal(@RequestBody MalAddRequest req) {
        String title = req.title != null ? req.title : "Unknown Title";
        String url = req.url != null ? req.url : "https://myanimelist.net/anime/" + req.mal_id;

        animeImportService.upsertAnime(req.mal_id, title, url, req.category, null);
        Optional<Anime> anime = animeRepository.findByMalId(req.mal_id);
        
        return anime.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
    }

    @GetMapping({"/import_status", "/import_status/"})
    public ResponseEntity<?> importStatus() {
        return ResponseEntity.ok(importState.getStateSnapshot());
    }
}
