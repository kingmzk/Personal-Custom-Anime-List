package com.anime.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "api_anime")
public class Anime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "mal_id", unique = true, nullable = false)
    private Integer malId;

    @Column(length = 500, nullable = false)
    private String title;

    @Column(length = 500, nullable = false)
    private String url;

    @Column(length = 100, nullable = false)
    private String category;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "image_base64", columnDefinition = "NVARCHAR(MAX)")
    private String imageBase64;

    private Double score;

    @Column(name = "[year]")
    private Integer year;

    @Column(name = "[type]", length = 50)
    private String type;

    @Column(columnDefinition = "NVARCHAR(MAX)")
    private String synopsis;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "personal_rating")
    private Double personalRating;

    @Column(name = "watched_date")
    private LocalDate watchedDate;

    @PrePersist
    @PreUpdate
    public void prePersist() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getMalId() { return malId; }
    public void setMalId(Integer malId) { this.malId = malId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getImageBase64() { return imageBase64; }
    public void setImageBase64(String imageBase64) { this.imageBase64 = imageBase64; }

    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }

    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSynopsis() { return synopsis; }
    public void setSynopsis(String synopsis) { this.synopsis = synopsis; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Double getPersonalRating() { return personalRating; }
    public void setPersonalRating(Double personalRating) { this.personalRating = personalRating; }

    public LocalDate getWatchedDate() { return watchedDate; }
    public void setWatchedDate(LocalDate watchedDate) { this.watchedDate = watchedDate; }
}
