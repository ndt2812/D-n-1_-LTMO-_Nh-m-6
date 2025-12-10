package quynh.ph59304.bansach.models;

import java.util.List;

public class PromotionListResponse {
    private boolean success;
    private List<PromotionInfo> promotions;
    private String error;

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public List<PromotionInfo> getPromotions() {
        return promotions;
    }

    public void setPromotions(List<PromotionInfo> promotions) {
        this.promotions = promotions;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}

