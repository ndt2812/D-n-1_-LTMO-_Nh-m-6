package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

import java.util.Collections;
import java.util.List;

public class CoinWalletResponse {
    private boolean success;
    private String message;
    private String title;
    private User user;
    private double balance;
    @SerializedName(value = "coinBalance", alternate = {"walletBalance"})
    private double coinBalance;
    @SerializedName("totalBalance")
    private double totalBalance;
    @SerializedName(value = "recentTransactions", alternate = {"transactions"})
    private List<CoinTransaction> recentTransactions;
    private int totalTransactions;
    private CoinStats stats;

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public String getTitle() {
        return title;
    }

    public User getUser() {
        return user;
    }

    public double getBalance() {
        return balance;
    }

    public double getCoinBalance() {
        return coinBalance;
    }

    public double getTotalBalance() {
        return totalBalance;
    }

    public List<CoinTransaction> getRecentTransactions() {
        return recentTransactions;
    }

    public List<CoinTransaction> getTransactions() {
        return recentTransactions;
    }

    public int getTotalTransactions() {
        return totalTransactions;
    }

    public CoinStats getStats() {
        return stats;
    }

    public double getEffectiveBalance() {
        // Ưu tiên coinBalance (field chính từ backend)
        // Backend trả về cả coinBalance, balance, totalBalance với cùng giá trị
        // Nên ưu tiên coinBalance trước
        if (coinBalance >= 0) {
            return coinBalance;
        }
        // Fallback sang balance
        if (balance >= 0) {
            return balance;
        }
        // Fallback sang totalBalance
        if (totalBalance >= 0) {
            return totalBalance;
        }
        // Cuối cùng lấy từ user object
        if (user != null) {
            return user.getCoinBalance();
        }
        // Mặc định trả về 0
        return 0;
    }

    public List<CoinTransaction> getDisplayTransactions() {
        if (recentTransactions != null && !recentTransactions.isEmpty()) {
            return recentTransactions;
        }
        return Collections.emptyList();
    }

    public static class CoinStats {
        private double totalDeposits;
        private double totalSpent;
        private double totalBonus;
        private double pendingAmount;

        public double getTotalDeposits() {
            return totalDeposits;
        }

        public double getTotalSpent() {
            return totalSpent;
        }

        public double getTotalBonus() {
            return totalBonus;
        }

        public double getPendingAmount() {
            return pendingAmount;
        }
    }
}

