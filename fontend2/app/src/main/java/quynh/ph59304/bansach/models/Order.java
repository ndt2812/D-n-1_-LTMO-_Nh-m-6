package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Order {
    @SerializedName(value = "_id", alternate = {"id"})
    private String id;
    private User user;
    private List<OrderItem> items;
    private double totalAmount;
    @SerializedName("orderStatus")
    private String orderStatus; // pending, processing, shipped, delivered, cancelled (from backend)
    @SerializedName("status")
    private String status; // Deprecated - use orderStatus instead (for backward compatibility)
    private ShippingAddress shippingAddress;
    private String phone; // Deprecated - use shippingAddress.phone instead
    private String paymentMethod; // coin, cash, vnpay
    private String paymentStatus; // pending, paid
    private double shippingFee;
    private double subtotal;
    private double discountAmount;
    private double finalAmount;
    private PromotionInfo appliedPromotion;
    private String createdAt;
    private String updatedAt;

    public Order() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public void setItems(List<OrderItem> items) {
        this.items = items;
    }

    public double getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(double totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getOrderStatus() {
        return orderStatus;
    }

    public void setOrderStatus(String orderStatus) {
        this.orderStatus = orderStatus;
    }

    /**
     * Get status - ưu tiên orderStatus từ backend, fallback về status (backward compatibility)
     */
    public String getStatus() {
        return orderStatus != null ? orderStatus : status;
    }

    public void setStatus(String status) {
        this.status = status;
        // Nếu orderStatus chưa được set, set nó từ status
        if (this.orderStatus == null) {
            this.orderStatus = status;
        }
    }

    public ShippingAddress getShippingAddress() {
        return shippingAddress;
    }

    public void setShippingAddress(ShippingAddress shippingAddress) {
        this.shippingAddress = shippingAddress;
    }

    /**
     * Helper method để lấy địa chỉ dạng string (backward compatibility)
     */
    public String getShippingAddressString() {
        if (shippingAddress != null) {
            return shippingAddress.getFormattedAddress();
        }
        return "";
    }

    /**
     * Helper method để lấy số điện thoại từ shippingAddress hoặc phone field cũ
     */
    public String getPhoneNumber() {
        if (shippingAddress != null && shippingAddress.getPhone() != null) {
            return shippingAddress.getPhone();
        }
        return phone != null ? phone : "";
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public double getShippingFee() {
        return shippingFee;
    }

    public void setShippingFee(double shippingFee) {
        this.shippingFee = shippingFee;
    }

    public double getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(double subtotal) {
        this.subtotal = subtotal;
    }

    public double getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(double discountAmount) {
        this.discountAmount = discountAmount;
    }

    public double getFinalAmount() {
        return finalAmount;
    }

    public void setFinalAmount(double finalAmount) {
        this.finalAmount = finalAmount;
    }

    public PromotionInfo getAppliedPromotion() {
        return appliedPromotion;
    }

    public void setAppliedPromotion(PromotionInfo appliedPromotion) {
        this.appliedPromotion = appliedPromotion;
    }

    public String getStatusDisplayName() {
        String currentStatus = getStatus();
        if (currentStatus == null) return "Không xác định";
        switch (currentStatus.toLowerCase()) {
            case "pending":
                return "Chờ xác nhận";
            case "processing":
                return "Đang xử lý";
            case "shipped":
                return "Đã giao hàng";
            case "delivered":
                return "Đã nhận hàng";
            case "cancelled":
                return "Đã hủy";
            // Backward compatibility với các giá trị cũ
            case "confirmed":
                return "Đã xác nhận";
            case "shipping":
                return "Đang giao hàng";
            default:
                return currentStatus;
        }
    }
}


