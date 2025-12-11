package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.RatingBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import quynh.ph59304.bansach.api.ApiConfig;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.adapters.ReviewAdapter;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.Book;
import quynh.ph59304.bansach.models.CartResponse;
import quynh.ph59304.bansach.models.CoinBalanceResponse;
import quynh.ph59304.bansach.models.User;
import quynh.ph59304.bansach.models.PreviewChapter;
import quynh.ph59304.bansach.models.PreviewResponse;
import quynh.ph59304.bansach.models.Review;
import quynh.ph59304.bansach.models.ReviewCreateResponse;
import quynh.ph59304.bansach.models.ReviewListResponse;
import quynh.ph59304.bansach.models.ReviewSummary;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BookDetailActivity extends AppCompatActivity {
    private static final String TAG = "BookDetailActivity";
    private ImageView imgBookCover;
    private TextView tvTitle, tvAuthor, tvCategory, tvPrice, tvDescription;
    private ProgressBar progressBar;
    private Button btnAddToCart;
    private Button btnPreview;
    private View cardPreviewSample;
    private ProgressBar previewSampleProgress;
    private TextView tvPreviewSampleError;
    private View layoutPreviewSampleContent;
    private TextView tvPreviewSampleTitle;
    private TextView tvPreviewSampleContent;
    private TextView tvAverageRating, tvTotalReviews, tvReviewEmpty, tvCoinBalance;
    private RatingBar ratingBarAverage;
    private Button btnWriteReview;
    private RecyclerView recyclerViewReviews;
    private ProgressBar reviewProgressBar;
    private ReviewAdapter reviewAdapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String bookId;
    private Book currentBook;
    private final List<Review> reviewList = new ArrayList<>();
    private boolean canReview = false;
    private Review userReview;
    private static final int REVIEW_LIMIT = 10;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_book_detail);

        bookId = getIntent().getStringExtra("book_id");
        if (bookId == null) {
            Toast.makeText(this, "Không tìm thấy thông tin sách", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        initViews();
        setupToolbar();
        setupCoinBalanceClick();
        loadBookDetail();
        loadCoinBalance();
    }

    private void updateReviewSummaryFromBook(Book book) {
        if (book == null || tvAverageRating == null) {
            return;
        }
        double avg = book.getAverageRating();
        tvAverageRating.setText(String.format(Locale.getDefault(), "%.1f", avg));
        ratingBarAverage.setRating((float) avg);
        tvTotalReviews.setText(String.format(Locale.getDefault(), "(%d đánh giá)", book.getTotalReviews()));
        btnPreview.setVisibility(View.VISIBLE);
    }

    private void initViews() {
        imgBookCover = findViewById(R.id.imgBookCover);
        tvTitle = findViewById(R.id.tvTitle);
        tvAuthor = findViewById(R.id.tvAuthor);
        tvCategory = findViewById(R.id.tvCategory);
        tvPrice = findViewById(R.id.tvPrice);
        tvDescription = findViewById(R.id.tvDescription);
        progressBar = findViewById(R.id.progressBar);
        btnAddToCart = findViewById(R.id.btnAddToCart);
        btnPreview = findViewById(R.id.btnPreview);
        cardPreviewSample = findViewById(R.id.cardPreviewSample);
        previewSampleProgress = findViewById(R.id.previewSampleProgress);
        tvPreviewSampleError = findViewById(R.id.tvPreviewSampleError);
        layoutPreviewSampleContent = findViewById(R.id.layoutPreviewSampleContent);
        tvPreviewSampleTitle = findViewById(R.id.tvPreviewSampleTitle);
        tvPreviewSampleContent = findViewById(R.id.tvPreviewSampleContent);
        tvAverageRating = findViewById(R.id.tvAverageRating);
        tvTotalReviews = findViewById(R.id.tvTotalReviews);
        tvReviewEmpty = findViewById(R.id.tvReviewEmpty);
        ratingBarAverage = findViewById(R.id.ratingBarAverage);
        btnWriteReview = findViewById(R.id.btnWriteReview);
        recyclerViewReviews = findViewById(R.id.recyclerViewReviews);
        reviewProgressBar = findViewById(R.id.reviewProgressBar);
        tvCoinBalance = findViewById(R.id.tvCoinBalance);

        reviewAdapter = new ReviewAdapter(reviewList);
        recyclerViewReviews.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewReviews.setAdapter(reviewAdapter);

        btnWriteReview.setOnClickListener(v -> handleReviewButtonClick());
        btnPreview.setOnClickListener(v -> openPreview());

        btnAddToCart.setOnClickListener(v -> {
            if (currentBook != null) {
                addToCart();
            }
        });

        if (!prefManager.isLoggedIn()) {
            btnWriteReview.setVisibility(View.GONE);
        }
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

    private void loadBookDetail() {
        showProgress(true);
        Call<ApiResponse<Book>> call = apiService.getBookDetail(bookId);
        call.enqueue(new Callback<ApiResponse<Book>>() {
            @Override
            public void onResponse(Call<ApiResponse<Book>> call, Response<ApiResponse<Book>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    Book book = response.body().getBook();
                    if (book != null) {
                        displayBook(book);
                    } else {
                        Toast.makeText(BookDetailActivity.this, "Không tìm thấy thông tin sách", Toast.LENGTH_SHORT).show();
                        finish();
                    }
                } else {
                    Toast.makeText(BookDetailActivity.this, "Không thể tải thông tin sách", Toast.LENGTH_SHORT).show();
                    finish();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Book>> call, Throwable t) {
                showProgress(false);
                Toast.makeText(BookDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void displayBook(Book book) {
        currentBook = book;
        tvTitle.setText(book.getTitle());
        tvAuthor.setText(book.getAuthor());
        tvPrice.setText(String.format("%,.0f đ", book.getPrice()));
        tvDescription.setText(book.getDescription());

        if (book.getCategory() != null) {
            tvCategory.setText(book.getCategory().getName());
        } else {
            tvCategory.setText("Không phân loại");
        }

        // Load image
        String imageUrl = ApiConfig.buildAbsoluteUrl(book.getCoverImage());
        if (imageUrl != null && !imageUrl.isEmpty()) {
            Glide.with(this)
                    .load(imageUrl)
                    .placeholder(R.drawable.ic_launcher_background)
                    .error(R.drawable.ic_launcher_background)
                    .into(imgBookCover);
        }

        // Check if user is logged in to show add to cart button
        if (prefManager.isLoggedIn()) {
            btnAddToCart.setVisibility(View.VISIBLE);
            btnWriteReview.setVisibility(View.VISIBLE);
        } else {
            btnAddToCart.setVisibility(View.GONE);
            btnWriteReview.setVisibility(View.GONE);
        }
        btnPreview.setVisibility(View.VISIBLE);

        updateReviewSummaryFromBook(book);
        loadReviews();
        loadPreviewSample();
    }

    private void loadReviews() {
        if (bookId == null) {
            return;
        }
        showReviewLoading(true);
        String authHeader = getOptionalAuthHeader();
        Call<ReviewListResponse> call = apiService.getBookReviews(bookId, 1, REVIEW_LIMIT, authHeader);
        call.enqueue(new Callback<ReviewListResponse>() {
            @Override
            public void onResponse(Call<ReviewListResponse> call, Response<ReviewListResponse> response) {
                showReviewLoading(false);
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    ReviewListResponse body = response.body();
                    reviewList.clear();
                    if (body.getReviews() != null) {
                        reviewList.addAll(body.getReviews());
                    }
                    reviewAdapter.updateReviews(reviewList);
                    updateReviewEmptyState();
                    updateReviewSummary(body.getSummary());
                } else if (response.code() == 401) {
                    updateReviewSummary(null);
                    updateReviewEmptyState();
                } else {
                    Toast.makeText(BookDetailActivity.this, "Không thể tải đánh giá", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ReviewListResponse> call, Throwable t) {
                showReviewLoading(false);
                Log.e("BookDetailActivity", "Load reviews error: " + t.getMessage(), t);
            }
        });
    }

    private void openPreview() {
        if (currentBook == null) {
            Toast.makeText(this, "Không tìm thấy thông tin sách", Toast.LENGTH_SHORT).show();
            return;
        }
        Intent intent = new Intent(this, PreviewActivity.class);
        intent.putExtra(PreviewActivity.EXTRA_BOOK_ID, currentBook.getId());
        intent.putExtra(PreviewActivity.EXTRA_BOOK_TITLE, currentBook.getTitle());
        startActivity(intent);
    }

    private void loadPreviewSample() {
        if (cardPreviewSample == null) {
            return;
        }
        cardPreviewSample.setVisibility(View.VISIBLE);
        if (previewSampleProgress != null) {
            previewSampleProgress.setVisibility(View.VISIBLE);
        }
        if (layoutPreviewSampleContent != null) {
            layoutPreviewSampleContent.setVisibility(View.GONE);
        }
        if (tvPreviewSampleError != null) {
            tvPreviewSampleError.setVisibility(View.GONE);
        }

        apiService.getPreviewContent(bookId, getOptionalAuthHeader()).enqueue(new Callback<PreviewResponse>() {
            @Override
            public void onResponse(Call<PreviewResponse> call, Response<PreviewResponse> response) {
                if (previewSampleProgress != null) {
                    previewSampleProgress.setVisibility(View.GONE);
                }
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()
                        && response.body().getPreview() != null
                        && response.body().getPreview().getChapters() != null
                        && !response.body().getPreview().getChapters().isEmpty()) {
                    PreviewChapter firstChapter = response.body().getPreview().getChapters().get(0);
                    if (tvPreviewSampleTitle != null) {
                        tvPreviewSampleTitle.setText(firstChapter.getTitle());
                    }
                    if (tvPreviewSampleContent != null) {
                        tvPreviewSampleContent.setText(firstChapter.getContent());
                    }
                    if (layoutPreviewSampleContent != null) {
                        layoutPreviewSampleContent.setVisibility(View.VISIBLE);
                    }
                    btnPreview.setVisibility(View.VISIBLE);
                } else {
                    showPreviewSampleError("Nội dung đọc thử đang được cập nhật.");
                }
            }

            @Override
            public void onFailure(Call<PreviewResponse> call, Throwable t) {
                if (previewSampleProgress != null) {
                    previewSampleProgress.setVisibility(View.GONE);
                }
                showPreviewSampleError("Không thể tải nội dung đọc thử.");
                Log.e(TAG, "Preview sample load error: " + t.getMessage(), t);
            }
        });
    }

    private void showPreviewSampleError(String message) {
        if (tvPreviewSampleError != null) {
            tvPreviewSampleError.setText(message);
            tvPreviewSampleError.setVisibility(View.VISIBLE);
        }
        if (layoutPreviewSampleContent != null) {
            layoutPreviewSampleContent.setVisibility(View.GONE);
        }
        btnPreview.setVisibility(View.VISIBLE);
    }

    private void showReviewLoading(boolean show) {
        if (reviewProgressBar != null) {
            reviewProgressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        }
    }

    private void updateReviewEmptyState() {
        if (tvReviewEmpty == null) {
            return;
        }
        boolean empty = reviewList.isEmpty();
        tvReviewEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
        recyclerViewReviews.setVisibility(empty ? View.GONE : View.VISIBLE);
    }

    private void updateReviewSummary(ReviewSummary summary) {
        if (summary == null) {
            canReview = false;
            userReview = null;
            updateReviewButtonState();
            return;
        }
        tvAverageRating.setText(String.format(Locale.getDefault(), "%.1f", summary.getAverageRating()));
        ratingBarAverage.setRating((float) summary.getAverageRating());
        tvTotalReviews.setText(String.format(Locale.getDefault(), "(%d đánh giá)", summary.getTotalReviews()));
        canReview = summary.isCanReview();
        userReview = summary.getUserReview();
        updateReviewButtonState();
    }

    private void updateReviewButtonState() {
        if (btnWriteReview == null) {
            return;
        }
        if (!prefManager.isLoggedIn()) {
            btnWriteReview.setVisibility(View.GONE);
            return;
        }
        btnWriteReview.setVisibility(View.VISIBLE);
        if (canReview) {
            btnWriteReview.setEnabled(true);
            btnWriteReview.setText("Viết đánh giá của bạn");
        } else if (userReview != null) {
            if (userReview.isCanEdit()) {
                btnWriteReview.setEnabled(true);
                btnWriteReview.setText("Chỉnh sửa đánh giá");
            } else {
                btnWriteReview.setEnabled(false);
                btnWriteReview.setText("Bạn đã đánh giá sách này");
            }
        } else {
            btnWriteReview.setEnabled(false);
            btnWriteReview.setText("Bạn chưa thể đánh giá");
        }
    }

    private void handleReviewButtonClick() {
        if (!prefManager.isLoggedIn()) {
            Toast.makeText(this, "Vui lòng đăng nhập để đánh giá", Toast.LENGTH_SHORT).show();
            return;
        }
        if (canReview) {
            showReviewDialog(false, null);
        } else if (userReview != null && userReview.isCanEdit()) {
            showReviewDialog(true, userReview);
        } else {
            Toast.makeText(this, userReview != null ? "Bạn đã đánh giá sách này" : "Bạn chỉ có thể đánh giá sau khi mua sách", Toast.LENGTH_SHORT).show();
        }
    }

    private void showReviewDialog(boolean isEditing, Review reviewToEdit) {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_add_review, null);
        RatingBar ratingBarInput = dialogView.findViewById(R.id.ratingBarInput);
        TextInputEditText edtReviewComment = dialogView.findViewById(R.id.edtReviewComment);
        if (isEditing && reviewToEdit != null) {
            ratingBarInput.setRating(reviewToEdit.getRating());
            edtReviewComment.setText(reviewToEdit.getComment());
        } else {
            ratingBarInput.setRating(5);
        }

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .setPositiveButton(isEditing ? "Cập nhật" : "Gửi", null)
                .setNegativeButton("Hủy", (d, which) -> d.dismiss())
                .create();

        dialog.setOnShowListener(d -> {
            Button positiveButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            positiveButton.setOnClickListener(v -> {
                int rating = (int) ratingBarInput.getRating();
                String comment = edtReviewComment.getText() != null ? edtReviewComment.getText().toString().trim() : "";
                if (rating < 1 || rating > 5) {
                    Toast.makeText(BookDetailActivity.this, "Vui lòng đánh giá từ 1 đến 5 sao", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (TextUtils.isEmpty(comment)) {
                    edtReviewComment.setError("Vui lòng nhập nhận xét");
                    return;
                }
                submitReview(rating, comment, dialog, isEditing, reviewToEdit != null ? reviewToEdit.getId() : null);
            });
        });

        dialog.show();
    }

    private void submitReview(int rating, String comment, AlertDialog dialog, boolean isEditing, String reviewId) {
        String authHeader = getAuthHeaderOrPrompt();
        if (authHeader == null) {
            dialog.dismiss();
            return;
        }

        btnWriteReview.setEnabled(false);
        Map<String, Object> body = new HashMap<>();
        body.put("rating", rating);
        body.put("comment", comment);

        Callback<ReviewCreateResponse> callback = new Callback<ReviewCreateResponse>() {
            @Override
            public void onResponse(Call<ReviewCreateResponse> call, Response<ReviewCreateResponse> response) {
                btnWriteReview.setEnabled(true);
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    Toast.makeText(BookDetailActivity.this, isEditing ? "Đánh giá đã được cập nhật" : "Đánh giá đã được gửi", Toast.LENGTH_SHORT).show();
                    dialog.dismiss();
                    loadReviews();
                } else if (response.body() != null && response.body().getError() != null) {
                    Toast.makeText(BookDetailActivity.this, response.body().getError(), Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(BookDetailActivity.this, "Không thể gửi đánh giá", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ReviewCreateResponse> call, Throwable t) {
                btnWriteReview.setEnabled(true);
                Toast.makeText(BookDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        };

        if (isEditing && reviewId != null) {
            apiService.updateReview(authHeader, bookId, reviewId, body).enqueue(callback);
        } else {
            apiService.createReview(authHeader, bookId, body).enqueue(callback);
        }
    }

    private void addToCart() {
        if (!prefManager.isLoggedIn()) {
            Toast.makeText(this, "Vui lòng đăng nhập để thêm vào giỏ hàng", Toast.LENGTH_SHORT).show();
            return;
        }

        String authHeader = getAuthHeaderOrPrompt();
        if (authHeader == null) {
            return;
        }

        btnAddToCart.setEnabled(false);
        Map<String, Object> body = new HashMap<>();
        body.put("bookId", currentBook.getId());
        body.put("quantity", 1);

        Call<ApiResponse<CartResponse>> call = apiService.addToCart(authHeader, body);
        call.enqueue(new Callback<ApiResponse<CartResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<CartResponse>> call, Response<ApiResponse<CartResponse>> response) {
                btnAddToCart.setEnabled(true);
                if (response.isSuccessful() && response.body() != null) {
                    Toast.makeText(BookDetailActivity.this, "Đã thêm vào giỏ hàng", Toast.LENGTH_SHORT).show();
                    return;
                }

                String errorMsg = "Không thể thêm vào giỏ hàng";
                try {
                    if (response.body() != null && response.body().getError() != null) {
                        errorMsg = response.body().getError();
                    } else if (response.errorBody() != null) {
                        String raw = response.errorBody().string();
                        errorMsg = "HTTP " + response.code() + ": " + raw;
                    } else {
                        errorMsg = "HTTP " + response.code();
                    }
                } catch (Exception e) {
                    Log.e("BookDetailActivity", "Error reading errorBody", e);
                    errorMsg = "HTTP " + response.code();
                }

                if (response.code() == 401) {
                    Toast.makeText(BookDetailActivity.this, "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_LONG).show();
                    return;
                }

                Log.e("BookDetailActivity", "Add to cart failed: " + errorMsg);
                Toast.makeText(BookDetailActivity.this, errorMsg, Toast.LENGTH_LONG).show();
            }

            @Override
            public void onFailure(Call<ApiResponse<CartResponse>> call, Throwable t) {
                btnAddToCart.setEnabled(true);
                Log.e("BookDetailActivity", "Add to cart error: " + t.getMessage(), t);
                Toast.makeText(BookDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    private String getAuthHeaderOrPrompt() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_LONG).show();
            prefManager.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return null;
        }
        return "Bearer " + token;
    }

    private String getOptionalAuthHeader() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        return "Bearer " + token;
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        loadCoinBalance();
    }
    
    private void loadCoinBalance() {
        if (!prefManager.isLoggedIn()) {
            return;
        }
        
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            return;
        }
        
        String authHeader = "Bearer " + token;
        
        // Try getCoinBalance first
        Call<CoinBalanceResponse> coinCall = apiService.getCoinBalance(authHeader);
        coinCall.enqueue(new Callback<CoinBalanceResponse>() {
            @Override
            public void onResponse(Call<CoinBalanceResponse> call, Response<CoinBalanceResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    CoinBalanceResponse balanceResponse = response.body();
                    double balance = balanceResponse.getBalance();
                    updateCoinBalance(balance);
                } else {
                    // Fallback to getProfile
                    loadCoinFromProfile(authHeader);
                }
            }

            @Override
            public void onFailure(Call<CoinBalanceResponse> call, Throwable t) {
                // Fallback to getProfile
                loadCoinFromProfile(authHeader);
            }
        });
    }
    
    private void loadCoinFromProfile(String authHeader) {
        Call<ApiResponse<User>> profileCall = apiService.getProfile(authHeader);
        profileCall.enqueue(new Callback<ApiResponse<User>>() {
            @Override
            public void onResponse(Call<ApiResponse<User>> call, Response<ApiResponse<User>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<User> apiResponse = response.body();
                    User user = apiResponse.getUser();
                    if (user == null && apiResponse.getData() != null) {
                        user = (User) apiResponse.getData();
                    }
                    if (user != null) {
                        updateCoinBalance(user.getCoinBalance());
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<User>> call, Throwable t) {
                Log.e(TAG, "Failed to load coin balance: " + t.getMessage());
            }
        });
    }
    
    private void updateCoinBalance(double balance) {
        if (tvCoinBalance != null) {
            tvCoinBalance.setText(String.format("%,.0f Coin", balance));
        }
    }
    
    private void setupCoinBalanceClick() {
        if (tvCoinBalance != null) {
            tvCoinBalance.setOnClickListener(v -> {
                Intent intent = new Intent(BookDetailActivity.this, CoinWalletActivity.class);
                startActivity(intent);
            });
        }
    }
}
