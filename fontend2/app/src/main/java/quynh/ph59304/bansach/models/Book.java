package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class Book {
    @SerializedName(value = "_id", alternate = {"id"})
    private String id;
    private String title;
    private String author;
    private String description;
    private double price;
    @SerializedName("coinPrice")
    private Double coinPrice;
    private Category category;
    @SerializedName("hasPreview")
    private boolean hasPreview;
    @SerializedName("isDigitalAvailable")
    private boolean isDigitalAvailable;
    private double averageRating;
    private int totalReviews;
    @SerializedName("coverImage")
    private String coverImage;
    private String createdAt;
    private String updatedAt;

    public Book() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public boolean hasPreview() {
        return hasPreview;
    }

    public void setHasPreview(boolean hasPreview) {
        this.hasPreview = hasPreview;
    }

    public double getAverageRating() {
        return averageRating;
    }

    public void setAverageRating(double averageRating) {
        this.averageRating = averageRating;
    }

    public int getTotalReviews() {
        return totalReviews;
    }

    public void setTotalReviews(int totalReviews) {
        this.totalReviews = totalReviews;
    }

    public String getCoverImage() {
        return coverImage;
    }

    public void setCoverImage(String coverImage) {
        this.coverImage = coverImage;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Double getCoinPrice() {
        return coinPrice;
    }

    public void setCoinPrice(Double coinPrice) {
        this.coinPrice = coinPrice;
    }

    public boolean isDigitalAvailable() {
        return isDigitalAvailable;
    }

    public void setDigitalAvailable(boolean digitalAvailable) {
        isDigitalAvailable = digitalAvailable;
    }
}
