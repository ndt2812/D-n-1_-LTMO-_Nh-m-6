package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

import quynh.ph59304.bansach.adapters.NotificationAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.NotificationInfo;
import quynh.ph59304.bansach.models.NotificationListResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class NotificationActivity extends AppCompatActivity {
    private static final String TAG = "NotificationActivity";
    
    private RecyclerView recyclerView;
    private ProgressBar progressBar;
    private TextView tvEmpty;
    private Button btnMarkAllRead;
    private NotificationAdapter adapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private final List<NotificationInfo> notifications = new ArrayList<>();
    private boolean isLoading = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notifications);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            navigateToLogin();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        loadNotifications();
    }

    private void initViews() {
        recyclerView = findViewById(R.id.recyclerViewNotifications);
        progressBar = findViewById(R.id.progressBar);
        tvEmpty = findViewById(R.id.tvEmpty);
        btnMarkAllRead = findViewById(R.id.btnMarkAllRead);
        
        btnMarkAllRead.setOnClickListener(v -> markAllAsRead());
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
        adapter = new NotificationAdapter(notifications);
        adapter.setOnNotificationClickListener(notification -> {
            // Mark as read when clicked
            if (!notification.isRead()) {
                markAsRead(notification.getId());
            }
            
            // Navigate to order detail if it's an order notification
            if (notification.getData() != null && notification.getData().containsKey("orderId")) {
                String orderId = (String) notification.getData().get("orderId");
                Intent intent = new Intent(this, OrderDetailActivity.class);
                intent.putExtra("order_id", orderId);
                startActivity(intent);
            }
        });
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);
    }

    private void loadNotifications() {
        if (isLoading) return;
        
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        isLoading = true;
        progressBar.setVisibility(View.VISIBLE);
        tvEmpty.setVisibility(View.GONE);

        Call<NotificationListResponse> call = apiService.getNotifications(authHeader, 1, 50, false);
        call.enqueue(new Callback<NotificationListResponse>() {
            @Override
            public void onResponse(Call<NotificationListResponse> call, Response<NotificationListResponse> response) {
                isLoading = false;
                progressBar.setVisibility(View.GONE);

                if (response.isSuccessful() && response.body() != null) {
                    NotificationListResponse notificationResponse = response.body();
                    if (notificationResponse.isSuccess() && notificationResponse.getNotifications() != null) {
                        notifications.clear();
                        notifications.addAll(notificationResponse.getNotifications());
                        adapter.notifyDataSetChanged();

                        if (notifications.isEmpty()) {
                            tvEmpty.setVisibility(View.VISIBLE);
                        } else {
                            tvEmpty.setVisibility(View.GONE);
                        }
                    } else {
                        tvEmpty.setVisibility(View.VISIBLE);
                    }
                } else {
                    tvEmpty.setVisibility(View.VISIBLE);
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                    Log.e(TAG, "Load notifications failed: " + response.code());
                }
            }

            @Override
            public void onFailure(Call<NotificationListResponse> call, Throwable t) {
                isLoading = false;
                progressBar.setVisibility(View.GONE);
                tvEmpty.setVisibility(View.VISIBLE);
                Log.e(TAG, "Load notifications error: " + t.getMessage(), t);
                Toast.makeText(NotificationActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void markAsRead(String notificationId) {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        Call<ApiResponse<Void>> call = apiService.markNotificationAsRead(authHeader, notificationId);
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                if (response.isSuccessful()) {
                    // Update local notification
                    for (NotificationInfo notification : notifications) {
                        if (notification.getId().equals(notificationId)) {
                            notification.setRead(true);
                            adapter.notifyDataSetChanged();
                            break;
                        }
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                Log.e(TAG, "Mark as read error: " + t.getMessage(), t);
            }
        });
    }

    private void markAllAsRead() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        Call<ApiResponse<Void>> call = apiService.markAllNotificationsAsRead(authHeader);
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                if (response.isSuccessful()) {
                    // Update all local notifications
                    for (NotificationInfo notification : notifications) {
                        notification.setRead(true);
                    }
                    adapter.notifyDataSetChanged();
                    Toast.makeText(NotificationActivity.this, "Đã đánh dấu tất cả là đã đọc", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                Log.e(TAG, "Mark all as read error: " + t.getMessage(), t);
                Toast.makeText(NotificationActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String getAuthHeaderOrRedirect() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            navigateToLogin();
            return null;
        }
        return "Bearer " + token;
    }

    private void navigateToLogin() {
        Toast.makeText(this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_LONG).show();
        prefManager.clear();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }

    private boolean handleUnauthorized(int statusCode) {
        if (statusCode == 401 || statusCode == 403) {
            navigateToLogin();
            return true;
        }
        return false;
    }
}

