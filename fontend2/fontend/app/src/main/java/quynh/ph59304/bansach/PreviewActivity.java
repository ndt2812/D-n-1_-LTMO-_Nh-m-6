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
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.cardview.widget.CardView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import quynh.ph59304.bansach.adapters.PreviewChapterAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.PreviewChapter;
import quynh.ph59304.bansach.models.PreviewData;
import quynh.ph59304.bansach.models.PreviewResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PreviewActivity extends AppCompatActivity {
    public static final String EXTRA_BOOK_ID = "book_id";
    public static final String EXTRA_BOOK_TITLE = "book_title";
    private static final String TAG = "PreviewActivity";

    private String bookId;
    private String bookTitle;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;

    private TextView tvPreviewSubtitle;
    private TextView tvPreviewError;
    private ProgressBar previewProgressBar;
    private RecyclerView recyclerViewChapters;
    private PreviewChapterAdapter chapterAdapter;
    private final List<PreviewChapter> chapters = new ArrayList<>();
    
    // Purchase views
    private CardView cardPurchase;
    private TextView tvPurchaseTitle;
    private TextView tvPurchasePrice;
    private Button btnPurchaseWithCoin;
    
    private boolean hasAccess = false;
    private Double coinPrice = null;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_preview);

        bookId = getIntent().getStringExtra(EXTRA_BOOK_ID);
        bookTitle = getIntent().getStringExtra(EXTRA_BOOK_TITLE);
        if (bookId == null) {
            Toast.makeText(this, "Không tìm thấy sách để đọc thử", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        initViews();
        setupToolbar();
        loadPreviewContent();
    }

    private void initViews() {
        tvPreviewSubtitle = findViewById(R.id.tvPreviewSubtitle);
        tvPreviewError = findViewById(R.id.tvPreviewError);
        previewProgressBar = findViewById(R.id.previewProgressBar);
        recyclerViewChapters = findViewById(R.id.recyclerViewChapters);
        recyclerViewChapters.setLayoutManager(new LinearLayoutManager(this));
        chapterAdapter = new PreviewChapterAdapter(chapters);
        recyclerViewChapters.setAdapter(chapterAdapter);
        
        // Purchase views
        cardPurchase = findViewById(R.id.cardPurchase);
        tvPurchaseTitle = findViewById(R.id.tvPurchaseTitle);
        tvPurchasePrice = findViewById(R.id.tvPurchasePrice);
        btnPurchaseWithCoin = findViewById(R.id.btnPurchaseWithCoin);
        
        btnPurchaseWithCoin.setOnClickListener(v -> handlePurchaseWithCoin());
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            if (bookTitle != null) {
                getSupportActionBar().setTitle("Đọc thử: " + bookTitle);
            }
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void loadPreviewContent() {
        showLoading(true);
        
        // First check if user has access
        if (prefManager.isLoggedIn()) {
            checkBookAccess();
        }
        
        Call<PreviewResponse> call = apiService.getPreviewContent(bookId, getOptionalToken());
        call.enqueue(new Callback<PreviewResponse>() {
            @Override
            public void onResponse(Call<PreviewResponse> call, Response<PreviewResponse> response) {
                showLoading(false);
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    PreviewResponse previewResponse = response.body();
                    if (previewResponse.getPreview() != null) {
                        updateUI(previewResponse);
                    } else {
                        showError("Không tìm thấy nội dung đọc thử");
                    }
                } else {
                    showError("Không thể tải nội dung đọc thử");
                }
            }

            @Override
            public void onFailure(Call<PreviewResponse> call, Throwable t) {
                showLoading(false);
                Log.e(TAG, "Load preview error: " + t.getMessage(), t);
                showError("Lỗi kết nối: " + t.getMessage());
            }
        });
    }
    
    private void checkBookAccess() {
        if (!prefManager.isLoggedIn()) {
            return;
        }
        
        String authHeader = getAuthHeader();
        if (authHeader == null) {
            return;
        }
        
        Call<ApiResponse<Map<String, Object>>> call = apiService.checkBookAccess(authHeader, bookId);
        call.enqueue(new Callback<ApiResponse<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, Object>>> call, Response<ApiResponse<Map<String, Object>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Map<String, Object> data = response.body().getData();
                    if (data != null) {
                        Object hasAccessObj = data.get("hasAccess");
                        hasAccess = hasAccessObj instanceof Boolean ? (Boolean) hasAccessObj : false;
                        updatePurchaseUI();
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, Object>>> call, Throwable t) {
                Log.e(TAG, "Check access error: " + t.getMessage());
            }
        });
    }

    private void updateUI(PreviewResponse response) {
        if (response.getPreview().getBook() != null) {
            String author = response.getPreview().getBook().getAuthor();
            String title = response.getPreview().getBook().getTitle();
            tvPreviewSubtitle.setText(author != null
                    ? title + " • " + author
                    : title);
        } else {
            tvPreviewSubtitle.setText("");
        }

        chapters.clear();
        if (response.getPreview().getChapters() != null) {
            chapters.addAll(response.getPreview().getChapters());
        }
        chapterAdapter.updateChapters(chapters);

        if (chapters.isEmpty()) {
            showError("Nội dung đọc thử đang được cập nhật");
        } else {
            tvPreviewError.setVisibility(View.GONE);
            recyclerViewChapters.setVisibility(View.VISIBLE);
        }
        
        // Check if book has coin price (need to get from book detail)
        loadBookDetailForCoinPrice();
    }
    
    private void loadBookDetailForCoinPrice() {
        Call<ApiResponse<quynh.ph59304.bansach.models.Book>> call = apiService.getBookDetail(bookId);
        call.enqueue(new Callback<ApiResponse<quynh.ph59304.bansach.models.Book>>() {
            @Override
            public void onResponse(Call<ApiResponse<quynh.ph59304.bansach.models.Book>> call, Response<ApiResponse<quynh.ph59304.bansach.models.Book>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    quynh.ph59304.bansach.models.Book book = response.body().getBook();
                    if (book != null && book.getCoinPrice() != null && book.getCoinPrice() > 0) {
                        coinPrice = book.getCoinPrice();
                        updatePurchaseUI();
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<quynh.ph59304.bansach.models.Book>> call, Throwable t) {
                Log.e(TAG, "Load book detail error: " + t.getMessage());
            }
        });
    }
    
    private void updatePurchaseUI() {
        if (hasAccess) {
            // User already has access, hide purchase card
            cardPurchase.setVisibility(View.GONE);
        } else if (coinPrice != null && coinPrice > 0) {
            // Show purchase card
            cardPurchase.setVisibility(View.VISIBLE);
            tvPurchasePrice.setText(String.format(Locale.getDefault(), 
                "Giá: %,.0f Coin", coinPrice));
            btnPurchaseWithCoin.setText(String.format(Locale.getDefault(), 
                "Mua bằng %,.0f Coin", coinPrice));
        } else {
            // No coin price, hide purchase card
            cardPurchase.setVisibility(View.GONE);
        }
    }
    
    private void handlePurchaseWithCoin() {
        if (!prefManager.isLoggedIn()) {
            Toast.makeText(this, "Vui lòng đăng nhập để mua sách", Toast.LENGTH_SHORT).show();
            startActivity(new Intent(this, LoginActivity.class));
            return;
        }
        
        if (coinPrice == null || coinPrice <= 0) {
            Toast.makeText(this, "Sách này không có bán bản số", Toast.LENGTH_SHORT).show();
            return;
        }
        
        // Show confirmation dialog
        new AlertDialog.Builder(this)
            .setTitle("Xác nhận mua sách")
            .setMessage(String.format(Locale.getDefault(), 
                "Bạn có muốn mua quyền đọc toàn bộ sách này với giá %,.0f Coin?", coinPrice))
            .setPositiveButton("Mua", (dialog, which) -> purchaseBookAccess())
            .setNegativeButton("Hủy", null)
            .show();
    }
    
    private void purchaseBookAccess() {
        String authHeader = getAuthHeader();
        if (authHeader == null) {
            Toast.makeText(this, "Vui lòng đăng nhập", Toast.LENGTH_SHORT).show();
            startActivity(new Intent(this, LoginActivity.class));
            return;
        }
        
        btnPurchaseWithCoin.setEnabled(false);
        showLoading(true);
        
        Map<String, Object> body = new HashMap<>();
        body.put("accessType", "full_access");
        
        Call<ApiResponse<Map<String, Object>>> call = apiService.purchaseBookAccess(authHeader, bookId, body);
        call.enqueue(new Callback<ApiResponse<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, Object>>> call, Response<ApiResponse<Map<String, Object>>> response) {
                showLoading(false);
                btnPurchaseWithCoin.setEnabled(true);
                
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Map<String, Object>> apiResponse = response.body();
                    Boolean success = apiResponse.getSuccess();
                    if (success != null && success) {
                        String message = apiResponse.getMessage() != null 
                            ? apiResponse.getMessage() 
                            : "Mua sách thành công!";
                        Toast.makeText(PreviewActivity.this, message, Toast.LENGTH_SHORT).show();
                        
                        // Update access status
                        hasAccess = true;
                        updatePurchaseUI();
                        
                        // Load full content
                        loadFullContent();
                    } else {
                        String errorMsg = apiResponse.getMessage() != null 
                            ? apiResponse.getMessage() 
                            : "Không thể mua sách. Vui lòng thử lại.";
                        Toast.makeText(PreviewActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                        
                        // If insufficient balance, redirect to coin wallet
                        if (errorMsg.contains("coin") || errorMsg.contains("Coin")) {
                            startActivity(new Intent(PreviewActivity.this, CoinWalletActivity.class));
                        }
                    }
                } else {
                    String errorMsg = "Không thể mua sách. Vui lòng thử lại.";
                    if (response.body() != null && response.body().getMessage() != null) {
                        errorMsg = response.body().getMessage();
                    }
                    Toast.makeText(PreviewActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, Object>>> call, Throwable t) {
                showLoading(false);
                btnPurchaseWithCoin.setEnabled(true);
                Log.e(TAG, "Purchase error: " + t.getMessage(), t);
                Toast.makeText(PreviewActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void loadFullContent() {
        if (!prefManager.isLoggedIn()) {
            return;
        }
        
        String authHeader = getAuthHeader();
        if (authHeader == null) {
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
                                // Show full content in a new activity or update current UI
                                showFullContent(content);
                            } else {
                                Toast.makeText(PreviewActivity.this, 
                                    "Nội dung sách đang được cập nhật", Toast.LENGTH_SHORT).show();
                            }
                        }
                    } else {
                        String errorMsg = apiResponse.getMessage() != null 
                            ? apiResponse.getMessage() 
                            : "Không thể tải nội dung đầy đủ";
                        Toast.makeText(PreviewActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                    }
                } else {
                    Toast.makeText(PreviewActivity.this, 
                        "Không thể tải nội dung đầy đủ", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, Object>>> call, Throwable t) {
                showLoading(false);
                Log.e(TAG, "Load full content error: " + t.getMessage(), t);
                Toast.makeText(PreviewActivity.this, 
                    "Lỗi kết nối khi tải nội dung", Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void showFullContent(String content) {
        // Open BookReaderActivity to show full content
        Intent intent = new Intent(this, BookReaderActivity.class);
        intent.putExtra(BookReaderActivity.EXTRA_BOOK_ID, bookId);
        intent.putExtra(BookReaderActivity.EXTRA_BOOK_TITLE, bookTitle);
        startActivity(intent);
    }
    
    private String getAuthHeader() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        return "Bearer " + token;
    }

    private void showLoading(boolean show) {
        previewProgressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewChapters.setVisibility(show ? View.GONE : View.VISIBLE);
        if (show) {
            tvPreviewError.setVisibility(View.GONE);
        }
    }

    private void showError(String message) {
        tvPreviewError.setText(message);
        tvPreviewError.setVisibility(View.VISIBLE);
        recyclerViewChapters.setVisibility(View.GONE);
    }

    private String getOptionalToken() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        return "Bearer " + token;
    }
}

