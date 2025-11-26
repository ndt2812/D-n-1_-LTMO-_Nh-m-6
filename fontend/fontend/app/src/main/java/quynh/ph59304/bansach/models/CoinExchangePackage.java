package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class CoinExchangePackage {
    @SerializedName("_id")
    private String id;
    private String name;
    private double coinAmount;
    private double discount;
    private String description;

    public CoinExchangePackage() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getCoinAmount() {
        return coinAmount;
    }

    public void setCoinAmount(double coinAmount) {
        this.coinAmount = coinAmount;
    }

    public double getDiscount() {
        return discount;
    }

    public void setDiscount(double discount) {
        this.discount = discount;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}

