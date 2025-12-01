package quynh.ph59304.bansach;

import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

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
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String orderId;
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
        // Order info
        tvOrderId.setText(getShortOrderId(order.getId()));
        
        tvStatus.setText(order.getStatusDisplayName());
        
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
            String paymentMethod = order.getPaymentMethod().equals("coin") ? "Coin" : "Thanh toán khi nhận hàng";
            tvPaymentMethod.setText(paymentMethod);
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


