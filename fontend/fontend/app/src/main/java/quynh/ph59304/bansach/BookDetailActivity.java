package quynh.ph59304.bansach;

import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.bumptech.glide.Glide;

import java.util.HashMap;
import java.util.Map;

import okhttp3.ResponseBody;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.Book;
import quynh.ph59304.bansach.models.CartResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BookDetailActivity extends AppCompatActivity {
    private ImageView imgBookCover;
    private TextView tvTitle, tvAuthor, tvCategory, tvPrice, tvDescription;
    private ProgressBar progressBar;
    private Button btnAddToCart;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String bookId;
    private Book currentBook;

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

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        initViews();
        setupToolbar();
        loadBookDetail();
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

        btnAddToCart.setOnClickListener(v -> {
            if (currentBook != null) {
                addToCart();
            }
        });
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
        String imageUrl = book.getCoverImage();
        if (imageUrl != null && !imageUrl.isEmpty()) {
            if (!imageUrl.startsWith("http")) {
                imageUrl = "http://10.0.2.2:3000" + imageUrl;
            }
            Glide.with(this)
                    .load(imageUrl)
                    .placeholder(R.drawable.ic_launcher_background)
                    .error(R.drawable.ic_launcher_background)
                    .into(imgBookCover);
        }

        // Check if user is logged in to show add to cart button
        if (prefManager.isLoggedIn()) {
            btnAddToCart.setVisibility(View.VISIBLE);
        } else {
            btnAddToCart.setVisibility(View.GONE);
        }
    }

    private void addToCart() {
        if (!prefManager.isLoggedIn()) {
            Toast.makeText(this, "Vui lòng đăng nhập để thêm vào giỏ hàng", Toast.LENGTH_SHORT).show();
            return;
        }

        btnAddToCart.setEnabled(false);
        Map<String, Object> body = new HashMap<>();
        body.put("bookId", currentBook.getId());
        body.put("quantity", 1);

        Call<ApiResponse<CartResponse>> call = apiService.addToCart(body);
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

                // Fallbacks for common backend routes if first path 404
                if (response.code() == 404) {
                    tryFallbackAddToCart(body);
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

    private void tryFallbackAddToCart(Map<String, Object> body) {
        // Try POST api/cart (common)
        Call<ResponseBody> alt1 = apiService.postCartDynamic("api/cart", body);
        alt1.enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(BookDetailActivity.this, "Đã thêm vào giỏ hàng", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (response.code() == 404) {
                    // Try without 'api' prefix
                    Call<ResponseBody> alt2 = apiService.postCartDynamic("cart/add", body);
                    alt2.enqueue(new Callback<ResponseBody>() {
                        @Override
                        public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                            if (response.isSuccessful()) {
                                Toast.makeText(BookDetailActivity.this, "Đã thêm vào giỏ hàng", Toast.LENGTH_SHORT).show();
                                return;
                            }
                            String msg = "Không thể thêm vào giỏ hàng (fallback). HTTP " + response.code();
                            Toast.makeText(BookDetailActivity.this, msg, Toast.LENGTH_LONG).show();
                            Log.e("BookDetailActivity", msg);
                        }

                        @Override
                        public void onFailure(Call<ResponseBody> call, Throwable t) {
                            String msg = "Lỗi kết nối (fallback): " + t.getMessage();
                            Toast.makeText(BookDetailActivity.this, msg, Toast.LENGTH_LONG).show();
                            Log.e("BookDetailActivity", msg, t);
                        }
                    });
                    return;
                }
                String msg = "Không thể thêm vào giỏ hàng (alt1). HTTP " + response.code();
                Toast.makeText(BookDetailActivity.this, msg, Toast.LENGTH_LONG).show();
                Log.e("BookDetailActivity", msg);
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                String msg = "Lỗi kết nối (alt1): " + t.getMessage();
                Toast.makeText(BookDetailActivity.this, msg, Toast.LENGTH_LONG).show();
                Log.e("BookDetailActivity", msg, t);
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
    }
}
