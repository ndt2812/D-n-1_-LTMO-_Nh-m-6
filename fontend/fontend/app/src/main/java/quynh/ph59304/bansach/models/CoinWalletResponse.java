package quynh.ph59304.bansach.models;

import java.util.List;

public class CoinWalletResponse {
    private double coinBalance;
    private List<CoinTransaction> recentTransactions;

    public CoinWalletResponse() {
    }

    public double getCoinBalance() {
        return coinBalance;
    }

    public void setCoinBalance(double coinBalance) {
        this.coinBalance = coinBalance;
    }

    public List<CoinTransaction> getRecentTransactions() {
        return recentTransactions;
    }

    public void setRecentTransactions(List<CoinTransaction> recentTransactions) {
        this.recentTransactions = recentTransactions;
    }
}

