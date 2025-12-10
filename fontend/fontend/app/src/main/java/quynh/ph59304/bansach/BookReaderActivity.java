package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.Map;

public class BookReaderActivity extends AppCompatActivity {
    private static final String TAG = "BookReaderActivity";
    public static final String EXTRA_BOOK_ID = "book_id";
    public static final String EXTRA_BOOK_TITLE = "book_title";

    private String bookId;
    private String bookTitle;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;

    private TextView tvContent;
    private ScrollView scrollView;
    private ProgressBar progressBar;
    private TextView tvError;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_book_reader);

        bookId = getIntent().getStringExtra(EXTRA_BOOK_ID);
        bookTitle = getIntent().getStringExtra(EXTRA_BOOK_TITLE);
        if (bookId == null) {
            Toast.makeText(this, "Không tìm thấy sách", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            Toast.makeText(this, "Vui lòng đăng nhập", Toast.LENGTH_SHORT).show();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupToolbar();
        loadFullContent();
    }

    private void initViews() {
        tvContent = findViewById(R.id.tvBookContent);
        scrollView = findViewById(R.id.scrollViewContent);
        progressBar = findViewById(R.id.progressBar);
        tvError = findViewById(R.id.tvError);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            if (bookTitle != null) {
                getSupportActionBar().setTitle(bookTitle);
            }
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void loadFullContent() {
        String authHeader = getAuthHeader();
        if (authHeader == null) {
            navigateToLogin();
            return;
        }

        showLoading(true);
        Call<ApiResponse<Map<String, Object>>> call = apiService.getFullBookContent(authHeader, bookId);
        call.enqueue(new Callback<ApiResponse<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, Object>>> call, Response<ApiResponse<Map<String, Object>>> response) {
                showLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Map<String, Object>> apiResponse = response.body();
                    Boolean success = apiResponse.getSuccess();
                    if (success != null && success) {
                        Map<String, Object> data = apiResponse.getData();
                        if (data != null) {
                            String content = (String) data.get("content");
                            if (content != null && !content.isEmpty()) {
                                displayContent(content);
                            } else {
                                showError("Nội dung sách đang được cập nhật");
                            }
                        } else {
                            showError("Không tìm thấy nội dung");
                        }
                    } else {
                        String errorMsg = apiResponse.getMessage() != null 
                            ? apiResponse.getMessage() 
                            : "Không thể tải nội dung sách";
                        showError(errorMsg);
                    }
                } else {
                    if (response.code() == 403) {
                        showError("Bạn cần mua quyền truy cập để đọc sách này");
                    } else {
                        showError("Không thể tải nội dung sách");
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, Object>>> call, Throwable t) {
                showLoading(false);
                Log.e(TAG, "Load full content error: " + t.getMessage(), t);
                showError("Lỗi kết nối: " + t.getMessage());
            }
        });
    }

    private void displayContent(String content) {
        tvContent.setText(content);
        tvError.setVisibility(View.GONE);
        scrollView.setVisibility(View.VISIBLE);
    }

    private void showLoading(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        scrollView.setVisibility(show ? View.GONE : View.VISIBLE);
        if (show) {
            tvError.setVisibility(View.GONE);
        }
    }

    private void showError(String message) {
        tvError.setText(message);
        tvError.setVisibility(View.VISIBLE);
        scrollView.setVisibility(View.GONE);
    }

    private String getAuthHeader() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        return "Bearer " + token;
    }

    private void navigateToLogin() {
        prefManager.clear();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }
}

