package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.ChapterContent;
import quynh.ph59304.bansach.models.ChapterContentResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PreviewReaderActivity extends AppCompatActivity {
    private TextView tvChapterTitle;
    private TextView tvChapterContent;
    private ProgressBar progressBar;
    private ApiService apiService;
    private String bookId;
    private String chapterId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_preview_reader);

        bookId = getIntent().getStringExtra("bookId");
        chapterId = getIntent().getStringExtra("chapterId");
        if (bookId == null || chapterId == null) {
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance(this).getApiService();

        initViews();
        setupToolbar();
        loadChapter();
    }

    private void initViews() {
        tvChapterTitle = findViewById(R.id.tvChapterTitle);
        tvChapterContent = findViewById(R.id.tvChapterContent);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            getSupportActionBar().setTitle("Xem trước");
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
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
                    ChapterContent chapter = contentResponse.getChapter();
                    if (chapter != null) {
                        tvChapterTitle.setText(chapter.getTitle());
                        if (chapter.isFree() || chapter.isPurchased()) {
                            tvChapterContent.setText(chapter.getContent());
                        } else {
                            tvChapterContent.setText("Bạn cần mua chương này để đọc nội dung.");
                        }
                    }
                } else {
                    Toast.makeText(PreviewReaderActivity.this, "Không thể tải nội dung", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<ChapterContentResponse>> call, Throwable t) {
                showProgress(false);
                Toast.makeText(PreviewReaderActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
    }
}

