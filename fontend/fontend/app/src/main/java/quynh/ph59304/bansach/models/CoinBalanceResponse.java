package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class CoinBalanceResponse {
    @SerializedName("coinBalance")
    private double coinBalance;

    public CoinBalanceResponse() {
    }

    public double getCoinBalance() {
        return coinBalance;
    }

    public void setCoinBalance(double coinBalance) {
        this.coinBalance = coinBalance;
    }
}

