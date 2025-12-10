package quynh.ph59304.bansach.models;

import java.util.List;

public class ReviewListResponse {
    private boolean success;
    private List<Review> reviews;
    private ReviewPagination pagination;
    private ReviewSummary summary;
    private String error;

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public List<Review> getReviews() {
        return reviews;
    }

    public void setReviews(List<Review> reviews) {
        this.reviews = reviews;
    }

    public ReviewPagination getPagination() {
        return pagination;
    }

    public void setPagination(ReviewPagination pagination) {
        this.pagination = pagination;
    }

    public ReviewSummary getSummary() {
        return summary;
    }

    public void setSummary(ReviewSummary summary) {
        this.summary = summary;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}

