package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import java.util.HashMap;
import java.util.Map;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.ChapterContent;
import quynh.ph59304.bansach.models.ChapterContentResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChapterReaderActivity extends AppCompatActivity {
    private TextView tvChapterTitle;
    private TextView tvChapterContent;
    private Button btnPrevious;
    private Button btnNext;
    private Button btnPurchase;
    private ScrollView scrollView;
    private ProgressBar progressBar;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String bookId;
    private String chapterId;
    private ChapterContent currentChapter;
    private ChapterContent previousChapter;
    private ChapterContent nextChapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chapter_reader);

        bookId = getIntent().getStringExtra("bookId");
        chapterId = getIntent().getStringExtra("chapterId");
        if (bookId == null || chapterId == null) {
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        initViews();
        setupToolbar();
        setupListeners();
        loadChapter();
    }

    private void initViews() {
        tvChapterTitle = findViewById(R.id.tvChapterTitle);
        tvChapterContent = findViewById(R.id.tvChapterContent);
        btnPrevious = findViewById(R.id.btnPrevious);
        btnNext = findViewById(R.id.btnNext);
        btnPurchase = findViewById(R.id.btnPurchase);
        scrollView = findViewById(R.id.scrollView);
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

    private void setupListeners() {
        btnPrevious.setOnClickListener(v -> {
            if (previousChapter != null) {
                chapterId = previousChapter.getId();
                loadChapter();
            }
        });

        btnNext.setOnClickListener(v -> {
            if (nextChapter != null) {
                chapterId = nextChapter.getId();
                loadChapter();
            }
        });

        btnPurchase.setOnClickListener(v -> purchaseChapter());
    }

    private void loadChapter() {
        showProgress(true);
        Call<ApiResponse<ChapterContentResponse>> call = apiService.getChapterContent(bookId, chapterId);
        call.enqueue(new Callback<ApiResponse<ChapterContentResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<ChapterContentResponse>> call, Response<ApiResponse<ChapterContentResponse>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null && response.body().getData() != null) {
                    ChapterContentResponse contentResponse = response.body().getData();
                    currentChapter = contentResponse.getChapter();
                    previousChapter = contentResponse.getPreviousChapter();
                    nextChapter = contentResponse.getNextChapter();

                    if (currentChapter != null) {
                        if (getSupportActionBar() != null) {
                            getSupportActionBar().setTitle("Chương " + currentChapter.getChapterNumber());
                        }
                        tvChapterTitle.setText(currentChapter.getTitle());
                        
                        boolean canRead = currentChapter.isFree() || currentChapter.isPurchased();
                        if (canRead) {
                            tvChapterContent.setText(currentChapter.getContent());
                            btnPurchase.setVisibility(View.GONE);
                        } else {
                            tvChapterContent.setText("Bạn cần mua chương này để đọc nội dung.");
                            btnPurchase.setVisibility(View.VISIBLE);
                        }

                        btnPrevious.setEnabled(previousChapter != null);
                        btnNext.setEnabled(nextChapter != null);
                    }
                } else {
                    Toast.makeText(ChapterReaderActivity.this, "Không thể tải nội dung chương", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<ChapterContentResponse>> call, Throwable t) {
                showProgress(false);
                Toast.makeText(ChapterReaderActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void purchaseChapter() {
        if (currentChapter == null) return;
        showProgress(true);
        Call<ApiResponse<Object>> call = apiService.purchaseChapter(bookId, chapterId);
        call.enqueue(new Callback<ApiResponse<Object>>() {
            @Override
            public void onResponse(Call<ApiResponse<Object>> call, Response<ApiResponse<Object>> response) {
                showProgress(false);
                if (response.isSuccessful()) {
                    Toast.makeText(ChapterReaderActivity.this, "Mua chương thành công!", Toast.LENGTH_SHORT).show();
                    loadChapter();
                } else {
                    Toast.makeText(ChapterReaderActivity.this, "Mua chương thất bại", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Object>> call, Throwable t) {
                showProgress(false);
                Toast.makeText(ChapterReaderActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        scrollView.setVisibility(show ? View.GONE : View.VISIBLE);
    }
}

