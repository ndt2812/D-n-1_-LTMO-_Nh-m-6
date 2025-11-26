package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.List;

import quynh.ph59304.bansach.adapters.BookAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.Book;
import quynh.ph59304.bansach.models.BooksResponse;
import quynh.ph59304.bansach.models.CategoriesResponse;
import quynh.ph59304.bansach.models.Category;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BookListActivity extends AppCompatActivity {
    private static final String TAG = "BookListActivity";
    private RecyclerView recyclerViewBooks;
    private BookAdapter bookAdapter;
    private TextInputEditText edtSearch;
    private Spinner spinnerCategory;
    private Button btnFilter;
    private ProgressBar progressBar;
    private TextView tvEmpty;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private List<Book> allBooks = new ArrayList<>();
    private List<Category> categories = new ArrayList<>();
    private String selectedCategoryId = null;
    private String searchQuery = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_book_list);

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        // Kiểm tra đăng nhập
        if (!prefManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        setupSearch();
        setupFilter();
        loadCategories();
        loadBooks();

        findViewById(R.id.fabProfile).setOnClickListener(v -> {
            startActivity(new Intent(this, ProfileActivity.class));
        });
    }

    private void initViews() {
        recyclerViewBooks = findViewById(R.id.recyclerViewBooks);
        edtSearch = findViewById(R.id.edtSearch);
        spinnerCategory = findViewById(R.id.spinnerCategory);
        btnFilter = findViewById(R.id.btnFilter);
        progressBar = findViewById(R.id.progressBar);
        tvEmpty = findViewById(R.id.tvEmpty);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayShowTitleEnabled(true);
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_main, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        int itemId = item.getItemId();
        if (itemId == R.id.menu_cart) {
            startActivity(new Intent(this, CartActivity.class));
            return true;
        } else if (itemId == R.id.menu_orders) {
            startActivity(new Intent(this, OrderHistoryActivity.class));
            return true;
        } else if (itemId == R.id.menu_logout) {
            prefManager.clear();
            Toast.makeText(this, "Đã đăng xuất", Toast.LENGTH_SHORT).show();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void setupRecyclerView() {
        bookAdapter = new BookAdapter(allBooks, book -> {
            Intent intent = new Intent(BookListActivity.this, BookDetailActivity.class);
            intent.putExtra("book_id", book.getId());
            startActivity(intent);
        });
        recyclerViewBooks.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewBooks.setAdapter(bookAdapter);
    }

    private void setupSearch() {
        edtSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                searchQuery = s.toString().trim();
                filterBooks();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void setupFilter() {
        btnFilter.setOnClickListener(v -> {
            // Reset filter
            selectedCategoryId = null;
            spinnerCategory.setSelection(0);
            filterBooks();
        });
    }

    private void loadCategories() {
        Call<CategoriesResponse> call = apiService.getCategories();
        call.enqueue(new Callback<CategoriesResponse>() {
            @Override
            public void onResponse(Call<CategoriesResponse> call, Response<CategoriesResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    categories = response.body().getCategories();
                    if (categories != null) {
                        setupCategorySpinner();
                    }
                } else {
                    Log.w(TAG, "Load categories failed: code=" + response.code() + ", msg=" + response.message());
                }
            }

            @Override
            public void onFailure(Call<CategoriesResponse> call, Throwable t) {
                Log.w(TAG, "Load categories error: " + t.getMessage(), t);
            }
        });
    }

    private void setupCategorySpinner() {
        List<String> categoryNames = new ArrayList<>();
        categoryNames.add("Tất cả thể loại");
        for (Category category : categories) {
            categoryNames.add(category.getName());
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item, categoryNames);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerCategory.setAdapter(adapter);

        spinnerCategory.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position == 0) {
                    selectedCategoryId = null;
                } else {
                    selectedCategoryId = categories.get(position - 1).getId();
                }
                filterBooks();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });
    }

    private void loadBooks() {
        showProgress(true);
        Call<BooksResponse> call = apiService.getBooks(null, null, null, null);
        call.enqueue(new Callback<BooksResponse>() {
            @Override
            public void onResponse(Call<BooksResponse> call, Response<BooksResponse> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    List<Book> books = response.body().getBooks();
                    if (books != null) {
                        allBooks = books;
                        filterBooks();
                    } else {
                        showEmpty(true);
                    }
                } else {
                    showEmpty(true);
                    String msg = "Không thể tải danh sách sách (HTTP " + response.code() + " - " + response.message() + ")";
                    Log.e(TAG, msg);
                    Toast.makeText(BookListActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<BooksResponse> call, Throwable t) {
                showProgress(false);
                showEmpty(true);
                Log.e(TAG, "Lỗi kết nối khi tải sách: " + t.getMessage(), t);
                Toast.makeText(BookListActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void filterBooks() {
        List<Book> filteredBooks = new ArrayList<>();

        for (Book book : allBooks) {
            // Filter by search
            if (searchQuery.isEmpty() || 
                book.getTitle().toLowerCase().contains(searchQuery.toLowerCase()) ||
                book.getAuthor().toLowerCase().contains(searchQuery.toLowerCase())) {
                
                // Filter by category
                if (selectedCategoryId == null || 
                    (book.getCategory() != null && book.getCategory().getId().equals(selectedCategoryId))) {
                    filteredBooks.add(book);
                }
            }
        }

        bookAdapter.updateBooks(filteredBooks);
        showEmpty(filteredBooks.isEmpty());
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewBooks.setVisibility(show ? View.GONE : View.VISIBLE);
    }

    private void showEmpty(boolean show) {
        tvEmpty.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewBooks.setVisibility(show ? View.GONE : View.VISIBLE);
    }
}
