package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import quynh.ph59304.bansach.adapters.PreviewChapterAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.PreviewChapter;
import quynh.ph59304.bansach.models.PreviewResponse;
import quynh.ph59304.bansach.models.PreviewSummary;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.ArrayList;
import java.util.List;

public class BookPreviewActivity extends AppCompatActivity {
    private TextView tvBookTitle;
    private TextView tvChapterCount;
    private RecyclerView recyclerViewChapters;
    private ProgressBar progressBar;
    private PreviewChapterAdapter adapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String bookId;
    private List<PreviewChapter> chapters = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_book_preview);

        bookId = getIntent().getStringExtra("bookId");
        if (bookId == null) {
            finish();
            return;
        }

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        initViews();
        setupToolbar();
        setupRecyclerView();
        loadPreview();
    }

    private void initViews() {
        tvBookTitle = findViewById(R.id.tvBookTitle);
        tvChapterCount = findViewById(R.id.tvChapterCount);
        recyclerViewChapters = findViewById(R.id.recyclerViewChapters);
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

    private void setupRecyclerView() {
        adapter = new PreviewChapterAdapter(chapters, chapter -> {
            if (chapter.isFree() || chapter.isPurchased()) {
                openChapter(chapter);
            } else {
                Toast.makeText(this, "Bạn cần mua chương này để đọc", Toast.LENGTH_SHORT).show();
            }
        });
        recyclerViewChapters.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewChapters.setAdapter(adapter);
    }

    private void loadPreview() {
        showProgress(true);
        Call<ApiResponse<PreviewResponse>> call = apiService.getBookPreview(bookId);
        call.enqueue(new Callback<ApiResponse<PreviewResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<PreviewResponse>> call, Response<ApiResponse<PreviewResponse>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null && response.body().getData() != null) {
                    PreviewResponse preview = response.body().getData();
                    PreviewSummary summary = preview.getSummary();
                    if (summary != null) {
                        tvBookTitle.setText(summary.getBookTitle());
                        tvChapterCount.setText(String.format("Tổng %d chương (%d chương miễn phí)", 
                                summary.getTotalChapters(), summary.getFreeChapters()));
                        if (summary.getChapters() != null) {
                            chapters.clear();
                            chapters.addAll(summary.getChapters());
                            adapter.updateChapters(chapters);
                        }
                    }
                } else {
                    Toast.makeText(BookPreviewActivity.this, "Không thể tải thông tin xem trước", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<PreviewResponse>> call, Throwable t) {
                showProgress(false);
                Toast.makeText(BookPreviewActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void openChapter(PreviewChapter chapter) {
        Intent intent = new Intent(this, ChapterReaderActivity.class);
        intent.putExtra("bookId", bookId);
        intent.putExtra("chapterId", chapter.getId());
        startActivity(intent);
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewChapters.setVisibility(show ? View.GONE : View.VISIBLE);
    }
}

