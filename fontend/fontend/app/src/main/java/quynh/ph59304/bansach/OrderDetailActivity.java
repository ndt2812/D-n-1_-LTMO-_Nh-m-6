package quynh.ph59304.bansach;

import android.os.Bundle;
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
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderDetailActivity extends AppCompatActivity {
    private static final String TAG = "OrderDetailActivity";
    private TextView tvOrderId, tvStatus, tvCreatedAt, tvPaymentMethod;
    private TextView tvShippingAddress, tvPhone;
    private TextView tvSubtotal, tvShippingFee, tvTotalAmount;
    private RecyclerView recyclerViewOrderItems;
    private OrderItemAdapter orderItemAdapter;
    private ProgressBar progressBar;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String orderId;
    private List<OrderItem> orderItems = new ArrayList<>();
    private double shippingFee = 30000;

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

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        // Kiểm tra đăng nhập
        if (!prefManager.isLoggedIn()) {
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        loadOrderDetail();
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
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
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

    private void loadOrderDetail() {
        showProgress(true);
        Call<ApiResponse<Order>> call = apiService.getOrderDetail(orderId);
        call.enqueue(new Callback<ApiResponse<Order>>() {
            @Override
            public void onResponse(Call<ApiResponse<Order>> call, Response<ApiResponse<Order>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
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
                    Log.e(TAG, "Load order detail failed: " + response.code());
                    Toast.makeText(OrderDetailActivity.this, "Không thể tải chi tiết đơn hàng", Toast.LENGTH_SHORT).show();
                    finish();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Order>> call, Throwable t) {
                showProgress(false);
                Log.e(TAG, "Load order detail error: " + t.getMessage(), t);
                Toast.makeText(OrderDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void displayOrder(Order order) {
        // Order info
        if (order.getId() != null) {
            String shortId = order.getId().length() > 8 
                ? order.getId().substring(order.getId().length() - 8) 
                : order.getId();
            tvOrderId.setText(shortId);
        }
        
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
        tvShippingAddress.setText(order.getShippingAddress() != null ? order.getShippingAddress() : "");
        tvPhone.setText(order.getPhone() != null ? order.getPhone() : "");
        
        // Order items
        if (order.getItems() != null) {
            orderItems = order.getItems();
            orderItemAdapter.updateOrderItems(orderItems);
            
            // Calculate subtotal
            double subtotal = 0;
            for (OrderItem item : orderItems) {
                subtotal += item.getSubtotal();
            }
            
            double total = order.getTotalAmount();
            if (total > 0) {
                tvTotalAmount.setText(String.format("%,.0f đ", total));
                tvSubtotal.setText(String.format("%,.0f đ", total - shippingFee));
            } else {
                tvSubtotal.setText(String.format("%,.0f đ", subtotal));
                tvTotalAmount.setText(String.format("%,.0f đ", subtotal + shippingFee));
            }
        }
        
        tvShippingFee.setText(String.format("%,.0f đ", shippingFee));
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
    }
}


