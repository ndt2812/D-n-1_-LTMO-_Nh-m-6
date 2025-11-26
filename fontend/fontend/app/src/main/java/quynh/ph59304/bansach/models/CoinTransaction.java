package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

import java.util.Date;

public class CoinTransaction {
    @SerializedName("_id")
    private String id;
    private String type; // "topup", "exchange", "purchase", "refund"
    private double amount;
    private double coinAmount;
    private String description;
    private String status; // "pending", "completed", "failed"
    @SerializedName("createdAt")
    private Date createdAt;

    public CoinTransaction() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public double getCoinAmount() {
        return coinAmount;
    }

    public void setCoinAmount(double coinAmount) {
        this.coinAmount = coinAmount;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}

