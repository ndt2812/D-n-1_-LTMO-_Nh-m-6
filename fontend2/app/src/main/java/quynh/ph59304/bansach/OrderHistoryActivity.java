package quynh.ph59304.bansach;

import android.content.Intent;
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

import com.google.android.material.tabs.TabLayout;

import java.util.ArrayList;
import java.util.List;

import quynh.ph59304.bansach.adapters.OrderAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.Order;
import quynh.ph59304.bansach.models.OrdersResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderHistoryActivity extends AppCompatActivity {
    private static final String TAG = "OrderHistoryActivity";
    private RecyclerView recyclerViewOrders;
    private OrderAdapter orderAdapter;
    private TextView tvEmpty;
    private ProgressBar progressBar;
    private TabLayout tabLayout;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private List<Order> allOrders = new ArrayList<>(); // Tất cả đơn hàng
    private List<Order> filteredOrders = new ArrayList<>(); // Đơn hàng đã lọc
    private boolean isLoading = false;
    private String currentFilter = "all"; // all, pending, shipping, delivered, cancelled, returned

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_history);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        // Kiểm tra đăng nhập
        if (!prefManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupTabs();
        setupRecyclerView();
        loadOrders();
    }

    private void initViews() {
        recyclerViewOrders = findViewById(R.id.recyclerViewOrders);
        tvEmpty = findViewById(R.id.tvEmpty);
        progressBar = findViewById(R.id.progressBar);
        tabLayout = findViewById(R.id.tabLayout);
    }
    
    private void setupTabs() {
        // Thêm các tab
        tabLayout.addTab(tabLayout.newTab().setText("Tất cả"));
        tabLayout.addTab(tabLayout.newTab().setText("Chờ xác nhận"));
        tabLayout.addTab(tabLayout.newTab().setText("Đang giao"));
        tabLayout.addTab(tabLayout.newTab().setText("Đã nhận hàng"));
        tabLayout.addTab(tabLayout.newTab().setText("Đã hủy"));
        tabLayout.addTab(tabLayout.newTab().setText("Trả hàng"));
        
        // Listener khi chọn tab
        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                int position = tab.getPosition();
                switch (position) {
                    case 0:
                        currentFilter = "all";
                        break;
                    case 1:
                        currentFilter = "pending";
                        break;
                    case 2:
                        currentFilter = "shipping";
                        break;
                    case 3:
                        currentFilter = "delivered";
                        break;
                    case 4:
                        currentFilter = "cancelled";
                        break;
                    case 5:
                        currentFilter = "returned";
                        break;
                }
                filterOrders();
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {
            }

            @Override
            public void onTabReselected(TabLayout.Tab tab) {
            }
        });
    }
    
    private void filterOrders() {
        filteredOrders.clear();
        
        if (currentFilter.equals("all")) {
            filteredOrders.addAll(allOrders);
        } else {
            for (Order order : allOrders) {
                String status = order.getStatus() != null ? order.getStatus().toLowerCase() : "";
                
                switch (currentFilter) {
                    case "pending":
                        if ("pending".equals(status)) {
                            filteredOrders.add(order);
                        }
                        break;
                    case "shipping":
                        if ("shipping".equals(status) || "shipped".equals(status) || 
                            "processing".equals(status) || "confirmed".equals(status)) {
                            filteredOrders.add(order);
                        }
                        break;
                    case "delivered":
                        if ("delivered".equals(status)) {
                            filteredOrders.add(order);
                        }
                        break;
                    case "cancelled":
                        if ("cancelled".equals(status) || "canceled".equals(status)) {
                            filteredOrders.add(order);
                        }
                        break;
                    case "returned":
                        if ("returned".equals(status) || "return".equals(status)) {
                            filteredOrders.add(order);
                        }
                        break;
                }
            }
        }
        
        updateUI();
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
        orderAdapter = new OrderAdapter(filteredOrders, order -> {
            Intent intent = new Intent(OrderHistoryActivity.this, OrderDetailActivity.class);
            intent.putExtra("order_id", order.getId());
            startActivity(intent);
        });
        recyclerViewOrders.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewOrders.setAdapter(orderAdapter);
    }

    private void loadOrders() {
        if (isLoading) {
            return; // Prevent duplicate calls
        }
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        isLoading = true;
        showProgress(true);
        Call<ApiResponse<OrdersResponse>> call = apiService.getOrdersApi(authHeader);
        call.enqueue(new Callback<ApiResponse<OrdersResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<OrdersResponse>> call, Response<ApiResponse<OrdersResponse>> response) {
                isLoading = false;
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<OrdersResponse> apiResponse = response.body();
                    List<Order> ordersList = apiResponse.getOrders();
                    if (ordersList == null && apiResponse.getData() != null) {
                        OrdersResponse ordersResponse = (OrdersResponse) apiResponse.getData();
                        if (ordersResponse != null) {
                            ordersList = ordersResponse.getOrders();
                        }
                    }
                    
                    if (ordersList != null) {
                        allOrders = ordersList;
                        filterOrders(); // Lọc theo tab hiện tại
                    } else {
                        allOrders = new ArrayList<>();
                        filterOrders();
                    }
                } else {
                    // Handle error responses
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                    Log.e(TAG, "Load orders failed: " + response.code() + " - " + response.message());
                    Toast.makeText(OrderHistoryActivity.this, "Không thể tải danh sách đơn hàng", Toast.LENGTH_SHORT).show();
                    showEmpty(true);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<OrdersResponse>> call, Throwable t) {
                isLoading = false;
                showProgress(false);
                Log.e(TAG, "Load orders error: " + t.getMessage(), t);
                Toast.makeText(OrderHistoryActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                showEmpty(true);
            }
        });
    }

    private void updateUI() {
        orderAdapter.updateOrders(filteredOrders);
        showEmpty(filteredOrders.isEmpty());
    }
    
    private String getEmptyMessage() {
        switch (currentFilter) {
            case "pending":
                return "Chưa có đơn hàng chờ xác nhận";
            case "shipping":
                return "Chưa có đơn hàng đang giao";
            case "delivered":
                return "Chưa có đơn hàng đã nhận";
            case "cancelled":
                return "Chưa có đơn hàng đã hủy";
            case "returned":
                return "Chưa có đơn hàng trả hàng";
            default:
                return "Chưa có đơn hàng nào";
        }
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewOrders.setVisibility(show ? View.GONE : View.VISIBLE);
    }

    private void showEmpty(boolean show) {
        if (show) {
            tvEmpty.setText(getEmptyMessage());
        }
        tvEmpty.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewOrders.setVisibility(show ? View.GONE : View.VISIBLE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Only reload if not currently loading and we have no orders
        if (!isLoading && allOrders.isEmpty()) {
            loadOrders();
        }
    }

    private String getAuthHeaderOrRedirect() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            Toast.makeText(this, "Vui lòng đăng nhập để xem đơn hàng", Toast.LENGTH_LONG).show();
            prefManager.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return null;
        }
        return "Bearer " + token;
    }

    private boolean handleUnauthorized(int statusCode) {
        if (statusCode == 401 || statusCode == 403) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_SHORT).show();
            prefManager.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return true;
        }
        return false;
    }
}


