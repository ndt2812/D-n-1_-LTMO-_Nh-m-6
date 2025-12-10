package quynh.ph59304.bansach.models;

public class CoinBalanceResponse {
    private boolean success;
    private double balance;
    private String message;

    public boolean isSuccess() {
        return success;
    }

    public double getBalance() {
        return balance;
    }

    public String getMessage() {
        return message;
    }
}

