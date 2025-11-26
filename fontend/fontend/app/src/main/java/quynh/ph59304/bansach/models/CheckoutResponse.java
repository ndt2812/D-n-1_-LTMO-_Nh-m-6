package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class CheckoutResponse {
    @SerializedName("_id")
    private String orderId;
    private String status;
    private String message;

    public CheckoutResponse() {
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}

