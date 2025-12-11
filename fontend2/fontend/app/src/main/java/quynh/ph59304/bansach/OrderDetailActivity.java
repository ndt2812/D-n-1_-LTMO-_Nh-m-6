package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.button.MaterialButton;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import quynh.ph59304.bansach.adapters.OrderItemAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.Order;
import quynh.ph59304.bansach.models.OrderItem;
import quynh.ph59304.bansach.models.PromotionInfo;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderDetailActivity extends AppCompatActivity {
    private static final String TAG = "OrderDetailActivity";
    private TextView tvOrderId, tvStatus, tvCreatedAt, tvPaymentMethod;
    private TextView tvShippingAddress, tvPhone;
    private TextView tvSubtotal, tvShippingFee, tvDiscountAmount, tvTotalAmount, tvPromotionCode;
    private RecyclerView recyclerViewOrderItems;
    private OrderItemAdapter orderItemAdapter;
    private ProgressBar progressBar;
    private MaterialButton btnCancelOrder, btnReturnOrder, btnReorder;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String orderId;
    private Order currentOrder;
    private List<OrderItem> orderItems = new ArrayList<>();
    private double shippingFee = 30000;
    private boolean isLoading = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_detail);

        orderId = getIntent().getStringExtra("order_id");
        if (orderId == null) {
            Toast.makeText(this, "Không tìm thấy thông tin đơn hàng", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        // Kiểm tra đăng nhập
        if (!prefManager.isLoggedIn()) {
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        loadOrderDetail(true);
    }

    private void initViews() {
        tvOrderId = findViewById(R.id.tvOrderId);
        tvStatus = findViewById(R.id.tvStatus);
        tvCreatedAt = findViewById(R.id.tvCreatedAt);
        tvPaymentMethod = findViewById(R.id.tvPaymentMethod);
        tvShippingAddress = findViewById(R.id.tvShippingAddress);
        tvPhone = findViewById(R.id.tvPhone);
        tvSubtotal = findViewById(R.id.tvSubtotal);
        tvShippingFee = findViewById(R.id.tvShippingFee);
        tvDiscountAmount = findViewById(R.id.tvDiscountAmount);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvPromotionCode = findViewById(R.id.tvPromotionCode);
        recyclerViewOrderItems = findViewById(R.id.recyclerViewOrderItems);
        progressBar = findViewById(R.id.progressBar);
        btnCancelOrder = findViewById(R.id.btnCancelOrder);
        btnReturnOrder = findViewById(R.id.btnReturnOrder);
        btnReorder = findViewById(R.id.btnReorder);
        
        // Setup button listeners
        btnCancelOrder.setOnClickListener(v -> cancelOrder());
        btnReturnOrder.setOnClickListener(v -> returnOrder());
        btnReorder.setOnClickListener(v -> reorder());
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void setupRecyclerView() {
        orderItemAdapter = new OrderItemAdapter(orderItems);
        recyclerViewOrderItems.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewOrderItems.setAdapter(orderItemAdapter);
    }

    private void loadOrderDetail(boolean useApiEndpoint) {
        if (isLoading) {
            return; // Prevent duplicate calls
        }
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        isLoading = true;
        showProgress(true);
        Call<ApiResponse<Order>> call = useApiEndpoint
                ? apiService.getOrderDetailApi(authHeader, orderId)
                : apiService.getOrderDetailLegacy(authHeader, orderId);
        call.enqueue(new Callback<ApiResponse<Order>>() {
            @Override
            public void onResponse(Call<ApiResponse<Order>> call, Response<ApiResponse<Order>> response) {
                isLoading = false;
                if (response.isSuccessful() && response.body() != null) {
                    showProgress(false);
                    ApiResponse<Order> apiResponse = response.body();
                    Order order = apiResponse.getOrder();
                    if (order == null && apiResponse.getData() != null) {
                        order = (Order) apiResponse.getData();
                    }
                    
                    if (order != null) {
                        displayOrder(order);
                    } else {
                        Toast.makeText(OrderDetailActivity.this, "Không tìm thấy thông tin đơn hàng", Toast.LENGTH_SHORT).show();
                        finish();
                    }
                } else {
                    // Only fallback to legacy if API endpoint returns 404
                    if (response.code() == 404 && useApiEndpoint) {
                        loadOrderDetail(false);
                        return;
                    }
                    showProgress(false);
                    // Don't handle unauthorized for legacy endpoint (it will always fail)
                    if (useApiEndpoint && handleUnauthorized(response.code())) {
                        return;
                    }
                    // Only log error if not using API endpoint (legacy will always fail with JWT)
                    if (!useApiEndpoint) {
                        Log.e(TAG, "Load order detail failed: " + response.code());
                        Toast.makeText(OrderDetailActivity.this, "Không thể tải chi tiết đơn hàng", Toast.LENGTH_SHORT).show();
                        finish();
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Order>> call, Throwable t) {
                isLoading = false;
                // Only fallback to legacy on network error, not on API endpoint success
                if (useApiEndpoint) {
                    loadOrderDetail(false);
                    return;
                }
                showProgress(false);
                Log.e(TAG, "Load order detail error: " + t.getMessage(), t);
                Toast.makeText(OrderDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void displayOrder(Order order) {
        currentOrder = order;
        
        // Order info
        tvOrderId.setText(getShortOrderId(order.getId()));
        
        tvStatus.setText(order.getStatusDisplayName());
        setStatusColor(order);
        
        // Format date
        if (order.getCreatedAt() != null) {
            try {
                SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
                SimpleDateFormat outputFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());
                Date date = inputFormat.parse(order.getCreatedAt());
                if (date != null) {
                    tvCreatedAt.setText(outputFormat.format(date));
                } else {
                    tvCreatedAt.setText(order.getCreatedAt());
                }
            } catch (ParseException e) {
                tvCreatedAt.setText(order.getCreatedAt());
            }
        }
        
        // Payment method
        if (order.getPaymentMethod() != null) {
            String paymentMethodText;
            String paymentMethod = order.getPaymentMethod();
            if ("coin".equals(paymentMethod)) {
                paymentMethodText = "Coin";
            } else if ("vnpay".equals(paymentMethod)) {
                paymentMethodText = "VNPay";
            } else if ("cash_on_delivery".equals(paymentMethod)) {
                paymentMethodText = "Thanh toán khi nhận hàng";
            } else if ("bank_transfer".equals(paymentMethod)) {
                paymentMethodText = "Chuyển khoản ngân hàng";
            } else if ("credit_card".equals(paymentMethod)) {
                paymentMethodText = "Thẻ tín dụng";
            } else {
                paymentMethodText = paymentMethod; // Fallback: hiển thị giá trị gốc
            }
            tvPaymentMethod.setText(paymentMethodText);
        }
        
        // Shipping info
        tvShippingAddress.setText(order.getShippingAddressString());
        tvPhone.setText(order.getPhoneNumber());
        
        // Order items
        double computedSubtotal = order.getSubtotal();
        if (computedSubtotal <= 0) {
            computedSubtotal = order.getTotalAmount();
        }
        double resolvedShippingFee = order.getShippingFee() > 0 ? order.getShippingFee() : shippingFee;
        if (order.getItems() != null) {
            orderItems = order.getItems();
            orderItemAdapter.updateOrderItems(orderItems);

            double subtotalFromItems = 0;
            for (OrderItem item : orderItems) {
                subtotalFromItems += item.getSubtotal();
            }
            if (computedSubtotal <= 0) {
                computedSubtotal = subtotalFromItems;
            }
        }

        double discount = Math.max(0, order.getDiscountAmount());
        double finalAmount = order.getFinalAmount();
        if (finalAmount <= 0) {
            finalAmount = Math.max(0, computedSubtotal + resolvedShippingFee - discount);
        } else if (computedSubtotal <= 0) {
            computedSubtotal = Math.max(0, finalAmount + discount - resolvedShippingFee);
        }

        tvSubtotal.setText(String.format("%,.0f đ", computedSubtotal));
        tvShippingFee.setText(String.format("%,.0f đ", resolvedShippingFee));
        tvDiscountAmount.setText(discount > 0
                ? String.format("-%,.0f đ", discount)
                : "0 đ");
        tvTotalAmount.setText(String.format("%,.0f đ", finalAmount));

        PromotionInfo promotion = order.getAppliedPromotion();
        if (promotion != null && !TextUtils.isEmpty(promotion.getCode())) {
            StringBuilder builder = new StringBuilder("Áp dụng mã: ")
                    .append(promotion.getCode());
            if (!TextUtils.isEmpty(promotion.getDescription())) {
                builder.append(" - ").append(promotion.getDescription());
            }
            tvPromotionCode.setText(builder.toString());
            tvPromotionCode.setVisibility(View.VISIBLE);
        } else {
            tvPromotionCode.setVisibility(View.GONE);
        }
        
        // Hiển thị/ẩn nút action dựa trên trạng thái đơn hàng
        updateActionButtons(order);
    }
    
    private void setStatusColor(Order order) {
        String status = order.getStatus();
        if (status == null) {
            status = order.getOrderStatus();
        }
        if (status == null) {
            status = "pending";
        }
        
        int backgroundColor;
        int textColor = 0xFFFFFFFF; // White text
        
        switch (status.toLowerCase()) {
            case "pending":
                backgroundColor = 0xFFFF9800; // Cam
                break;
            case "processing":
            case "confirmed":
                backgroundColor = 0xFF2196F3; // Xanh dương
                break;
            case "shipping":
            case "shipped":
                backgroundColor = 0xFF4CAF50; // Xanh lá
                break;
            case "delivered":
                backgroundColor = 0xFF2E7D32; // Xanh lá đậm
                break;
            case "cancelled":
                backgroundColor = 0xFFF44336; // Đỏ
                break;
            default:
                backgroundColor = 0xFF9E9E9E; // Xám
                break;
        }
        
        // Tạo GradientDrawable với màu nền và bo góc
        android.graphics.drawable.GradientDrawable drawable = new android.graphics.drawable.GradientDrawable();
        drawable.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        drawable.setCornerRadius(20f);
        drawable.setColor(backgroundColor);
        
        tvStatus.setBackground(drawable);
        tvStatus.setTextColor(textColor);
    }
    
    private void updateActionButtons(Order order) {
        String status = order.getStatus();
        if (status == null) {
            status = order.getOrderStatus();
        }
        if (status == null) {
            status = "pending";
        }
        
        String statusLower = status.toLowerCase();
        
        // Hiển thị nút "Hủy đơn hàng" chỉ khi status là "pending"
        if ("pending".equals(statusLower)) {
            btnCancelOrder.setVisibility(View.VISIBLE);
            btnReturnOrder.setVisibility(View.GONE);
            btnReorder.setVisibility(View.GONE);
        }
        // Ẩn cả 3 nút khi đang giao hàng (shipping, shipped, processing)
        else if ("shipping".equals(statusLower) || "shipped".equals(statusLower) || 
                 "processing".equals(statusLower) || "confirmed".equals(statusLower)) {
            btnCancelOrder.setVisibility(View.GONE);
            btnReturnOrder.setVisibility(View.GONE);
            btnReorder.setVisibility(View.GONE);
        }
        // Hiển thị nút "Hoàn trả hàng" và "Mua lại" khi đã nhận hàng (delivered)
        else if ("delivered".equals(statusLower)) {
            btnCancelOrder.setVisibility(View.GONE);
            btnReturnOrder.setVisibility(View.VISIBLE);
            btnReorder.setVisibility(View.VISIBLE);
        }
        // Hiển thị nút "Mua lại" khi đã hủy (cancelled)
        else if ("cancelled".equals(statusLower)) {
            btnCancelOrder.setVisibility(View.GONE);
            btnReturnOrder.setVisibility(View.GONE);
            btnReorder.setVisibility(View.VISIBLE);
        }
        // Ẩn cả 3 nút cho các trạng thái khác
        else {
            btnCancelOrder.setVisibility(View.GONE);
            btnReturnOrder.setVisibility(View.GONE);
            btnReorder.setVisibility(View.GONE);
        }
    }
    
    private void cancelOrder() {
        if (currentOrder == null || orderId == null) {
            return;
        }
        
        // Kiểm tra phương thức thanh toán để hiển thị thông báo phù hợp
        String paymentMethod = currentOrder.getPaymentMethod();
        String paymentStatus = currentOrder.getPaymentStatus();
        String message = "Bạn có chắc chắn muốn hủy đơn hàng này?";
        
        // Nếu đã thanh toán bằng VNPay, thông báo sẽ chuyển thành Coin
        if ("vnpay".equals(paymentMethod) && (paymentStatus == null || "paid".equals(paymentStatus))) {
            double finalAmount = currentOrder.getFinalAmount();
            long coinAmount = Math.round(finalAmount / 1000); // 1000 VND = 1 Coin
            message = String.format(
                "Bạn có chắc chắn muốn hủy đơn hàng này?\n\n" +
                "Số tiền đã thanh toán (%s đ) sẽ được chuyển thành %d Coin và cộng vào tài khoản của bạn.",
                String.format("%,.0f", finalAmount),
                coinAmount
            );
        }
        
        // Hiển thị dialog xác nhận
        new androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Xác nhận hủy đơn hàng")
            .setMessage(message)
            .setPositiveButton("Hủy đơn", (dialog, which) -> {
                performCancelOrder();
            })
            .setNegativeButton("Không", null)
            .show();
    }
    
    private void performCancelOrder() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        
        showProgress(true);
        btnCancelOrder.setEnabled(false);
        
        retrofit2.Call<quynh.ph59304.bansach.models.ApiResponse<Order>> call = 
            apiService.cancelOrder(authHeader, orderId);
        call.enqueue(new retrofit2.Callback<quynh.ph59304.bansach.models.ApiResponse<Order>>() {
            @Override
            public void onResponse(retrofit2.Call<quynh.ph59304.bansach.models.ApiResponse<Order>> call, 
                                 retrofit2.Response<quynh.ph59304.bansach.models.ApiResponse<Order>> response) {
                showProgress(false);
                btnCancelOrder.setEnabled(true);
                
                if (response.isSuccessful() && response.body() != null) {
                    // Kiểm tra nếu đã thanh toán bằng VNPay để hiển thị thông báo về Coin
                    String paymentMethod = currentOrder != null ? currentOrder.getPaymentMethod() : null;
                    if ("vnpay".equals(paymentMethod)) {
                        double finalAmount = currentOrder != null ? currentOrder.getFinalAmount() : 0;
                        long coinAmount = Math.round(finalAmount / 1000);
                        Toast.makeText(OrderDetailActivity.this, 
                            String.format("Đã hủy đơn hàng thành công. %d Coin đã được cộng vào tài khoản của bạn.", coinAmount), 
                            Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(OrderDetailActivity.this, "Đã hủy đơn hàng thành công", Toast.LENGTH_SHORT).show();
                    }
                    // Reload order detail để cập nhật trạng thái
                    loadOrderDetail(true);
                } else {
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                    String errorMsg = "Không thể hủy đơn hàng";
                    try {
                        if (response.errorBody() != null) {
                            String errorBody = response.errorBody().string();
                            Log.e(TAG, "Cancel order error: " + errorBody);
                        }
                    } catch (java.io.IOException e) {
                        Log.e(TAG, "Error reading error body", e);
                    }
                    Toast.makeText(OrderDetailActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                }
            }
            
            @Override
            public void onFailure(retrofit2.Call<quynh.ph59304.bansach.models.ApiResponse<Order>> call, 
                                Throwable t) {
                showProgress(false);
                btnCancelOrder.setEnabled(true);
                Log.e(TAG, "Cancel order error: " + t.getMessage(), t);
                Toast.makeText(OrderDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void returnOrder() {
        if (currentOrder == null || orderId == null) {
            return;
        }
        
        // Hiển thị dialog xác nhận
        new androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Xác nhận hoàn trả hàng")
            .setMessage("Bạn có chắc chắn muốn hoàn trả đơn hàng này?")
            .setPositiveButton("Hoàn trả", (dialog, which) -> {
                performReturnOrder();
            })
            .setNegativeButton("Không", null)
            .show();
    }
    
    private void performReturnOrder() {
        // TODO: Implement return order API call when backend supports it
        Toast.makeText(this, "Tính năng hoàn trả hàng đang được phát triển", Toast.LENGTH_SHORT).show();
    }
    
    private void reorder() {
        if (currentOrder == null || currentOrder.getItems() == null || currentOrder.getItems().isEmpty()) {
            Toast.makeText(this, "Đơn hàng không có sản phẩm để mua lại", Toast.LENGTH_SHORT).show();
            return;
        }
        
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        
        showProgress(true);
        btnReorder.setEnabled(false);
        
        // Thêm từng sản phẩm vào giỏ hàng
        addItemsToCartSequentially(authHeader, currentOrder.getItems(), 0);
    }
    
    private void addItemsToCartSequentially(String authHeader, List<OrderItem> items, int index) {
        if (index >= items.size()) {
            // Đã thêm hết tất cả sản phẩm
            showProgress(false);
            btnReorder.setEnabled(true);
            
            // Chuyển đến trang thanh toán
            Intent intent = new Intent(this, CheckoutActivity.class);
            // Truyền thông tin đơn hàng cũ để tự động điền form (nếu có)
            if (currentOrder != null && currentOrder.getShippingAddress() != null) {
                quynh.ph59304.bansach.models.ShippingAddress shippingAddress = currentOrder.getShippingAddress();
                if (shippingAddress.getFullName() != null) {
                    intent.putExtra("fullName", shippingAddress.getFullName());
                }
                if (shippingAddress.getPhone() != null) {
                    intent.putExtra("phoneNumber", shippingAddress.getPhone());
                }
                if (shippingAddress.getAddress() != null) {
                    intent.putExtra("shippingAddress", shippingAddress.getAddress());
                }
                if (shippingAddress.getCity() != null) {
                    intent.putExtra("city", shippingAddress.getCity());
                }
                if (shippingAddress.getPostalCode() != null) {
                    intent.putExtra("postalCode", shippingAddress.getPostalCode());
                }
            }
            startActivity(intent);
            finish(); // Đóng màn hình chi tiết đơn hàng
            return;
        }
        
        OrderItem item = items.get(index);
        String bookId = null;
        
        // Lấy bookId từ item
        if (item.getBook() != null) {
            quynh.ph59304.bansach.models.Book book = item.getBook();
            if (book.getId() != null) {
                bookId = book.getId();
            }
        }
        
        if (bookId == null || bookId.isEmpty()) {
            // Bỏ qua item này và tiếp tục với item tiếp theo
            Log.w(TAG, "Skipping item at index " + index + " - no book ID");
            addItemsToCartSequentially(authHeader, items, index + 1);
            return;
        }
        
        // Tạo request body để thêm vào giỏ hàng
        Map<String, Object> body = new HashMap<>();
        body.put("bookId", bookId);
        body.put("quantity", item.getQuantity());
        
        Log.d(TAG, "Adding item to cart: bookId=" + bookId + ", quantity=" + item.getQuantity());
        
        // Gọi API thêm vào giỏ hàng
        retrofit2.Call<quynh.ph59304.bansach.models.ApiResponse<quynh.ph59304.bansach.models.CartResponse>> call = 
            apiService.addToCart(authHeader, body);
        call.enqueue(new retrofit2.Callback<quynh.ph59304.bansach.models.ApiResponse<quynh.ph59304.bansach.models.CartResponse>>() {
            @Override
            public void onResponse(
                retrofit2.Call<quynh.ph59304.bansach.models.ApiResponse<quynh.ph59304.bansach.models.CartResponse>> call,
                retrofit2.Response<quynh.ph59304.bansach.models.ApiResponse<quynh.ph59304.bansach.models.CartResponse>> response) {
                
                if (response.isSuccessful()) {
                    Log.d(TAG, "Item added to cart successfully, index: " + index);
                    // Tiếp tục thêm item tiếp theo
                    addItemsToCartSequentially(authHeader, items, index + 1);
                } else {
                    // Nếu lỗi, vẫn tiếp tục với item tiếp theo
                    Log.w(TAG, "Failed to add item to cart: " + response.code());
                    if (handleUnauthorized(response.code())) {
                        showProgress(false);
                        btnReorder.setEnabled(true);
                        return;
                    }
                    addItemsToCartSequentially(authHeader, items, index + 1);
                }
            }
            
            @Override
            public void onFailure(
                retrofit2.Call<quynh.ph59304.bansach.models.ApiResponse<quynh.ph59304.bansach.models.CartResponse>> call,
                Throwable t) {
                Log.e(TAG, "Error adding item to cart: " + t.getMessage(), t);
                // Vẫn tiếp tục với item tiếp theo
                addItemsToCartSequentially(authHeader, items, index + 1);
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    private String getAuthHeaderOrRedirect() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            Toast.makeText(this, "Vui lòng đăng nhập để xem đơn hàng", Toast.LENGTH_SHORT).show();
            finish();
            return null;
        }
        return "Bearer " + token;
    }

    private boolean handleUnauthorized(int statusCode) {
        if (statusCode == 401 || statusCode == 403) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_SHORT).show();
            prefManager.clear();
            finish();
            return true;
        }
        return false;
    }

    private String getShortOrderId(String orderId) {
        if (orderId == null || orderId.isEmpty()) {
            return "";
        }
        return orderId.length() > 8 ? orderId.substring(orderId.length() - 8) : orderId;
    }
}


