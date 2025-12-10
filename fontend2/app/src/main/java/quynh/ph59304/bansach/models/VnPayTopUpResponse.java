package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

/**
 * Response model cho VNPay top-up request
 * Backend trả về paymentUrl khi paymentMethod = 'vnpay'
 */
public class VnPayTopUpResponse {
    @SerializedName("success")
    private Boolean success;
    
    @SerializedName("message")
    private String message;
    
    @SerializedName("paymentUrl")
    private String paymentUrl;
    
    @SerializedName("transactionId")
    private String transactionId;
    
    @SerializedName("paymentTransactionId")
    private String paymentTransactionId;
    
    @SerializedName("data")
    private CoinTransaction data;

    public Boolean getSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public String getPaymentUrl() {
        return paymentUrl;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public String getPaymentTransactionId() {
        return paymentTransactionId;
    }

    public CoinTransaction getData() {
        return data;
    }

    public boolean hasPaymentUrl() {
        return paymentUrl != null && !paymentUrl.trim().isEmpty();
    }
}

