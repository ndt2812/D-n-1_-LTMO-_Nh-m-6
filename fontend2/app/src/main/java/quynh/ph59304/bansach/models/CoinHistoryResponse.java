package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

import java.util.Collections;
import java.util.List;

public class CoinHistoryResponse {
    private boolean success;
    private String message;
    private int currentPage;
    private int totalPages;
    private int totalTransactions;
    private double balance;
    @SerializedName(value = "coinBalance", alternate = {"walletBalance"})
    private double coinBalance;
    private List<CoinTransaction> transactions;

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public int getCurrentPage() {
        return currentPage;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public int getTotalTransactions() {
        return totalTransactions;
    }

    public double getBalance() {
        return balance;
    }

    public double getCoinBalance() {
        return coinBalance;
    }

    public List<CoinTransaction> getTransactions() {
        if (transactions == null) {
            return Collections.emptyList();
        }
        return transactions;
    }

    public double getEffectiveBalance() {
        if (coinBalance > 0) {
            return coinBalance;
        }
        return balance;
    }
}

