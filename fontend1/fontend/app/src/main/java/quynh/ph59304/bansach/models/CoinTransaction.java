package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class CoinTransaction {
    @SerializedName(value = "_id", alternate = {"id"})
    private String id;
    @SerializedName(value = "type", alternate = {"transactionType"})
    private String type;
    private double amount;
    @SerializedName(value = "realMoneyAmount", alternate = {"moneyAmount"})
    private double realMoneyAmount;
    private double balanceBefore;
    private double balanceAfter;
    private String description;
    private String paymentMethod;
    private String status;
    private String createdAt;
    private String updatedAt;
    private String notes;
    private String paymentTransactionId;

    public String getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public double getAmount() {
        return amount;
    }

    public double getRealMoneyAmount() {
        return realMoneyAmount;
    }

    public double getBalanceBefore() {
        return balanceBefore;
    }

    public double getBalanceAfter() {
        return balanceAfter;
    }

    public String getDescription() {
        return description;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public String getStatus() {
        return status;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public String getNotes() {
        return notes;
    }

    public String getPaymentTransactionId() {
        return paymentTransactionId;
    }

    public boolean isCredit() {
        return matchesType("deposit", "bonus", "refund", "admin_bonus");
    }

    public boolean isPending() {
        return "pending".equalsIgnoreCase(status);
    }

    public boolean matchesType(String... compareTypes) {
        if (type == null || compareTypes == null) {
            return false;
        }
        for (String compare : compareTypes) {
            if (compare != null && compare.equalsIgnoreCase(type)) {
                return true;
            }
        }
        return false;
    }
}

