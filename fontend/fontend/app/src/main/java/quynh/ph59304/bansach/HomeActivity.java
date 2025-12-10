package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.MenuItem;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.navigation.NavigationBarView;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.List;

import quynh.ph59304.bansach.adapters.HomeBookAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.Book;
import quynh.ph59304.bansach.models.BooksResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HomeActivity extends AppCompatActivity {
    private static final String TAG = "HomeActivity";
    
    private RecyclerView recyclerViewRecommendation;
    private RecyclerView recyclerViewPopular;
    private RecyclerView recyclerViewTopSell;
    private RecyclerView recyclerViewToRead;
    private HomeBookAdapter recommendationAdapter;
    private HomeBookAdapter popularAdapter;
    private HomeBookAdapter topSellAdapter;
    private HomeBookAdapter toReadAdapter;
    private TextInputEditText edtSearch;
    private ProgressBar progressBar;
    private BottomNavigationView bottomNavigationView;
    
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private List<Book> allBooks = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_home);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        // Kiểm tra đăng nhập
        if (!prefManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupRecyclerViews();
        setupSearch();
        setupBottomNavigation();
        loadBooks();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Ensure home is selected when returning to this activity
        if (bottomNavigationView != null) {
            bottomNavigationView.setSelectedItemId(R.id.nav_home);
        }
    }

    private void initViews() {
        recyclerViewRecommendation = findViewById(R.id.recyclerViewRecommendation);
        recyclerViewPopular = findViewById(R.id.recyclerViewPopular);
        recyclerViewTopSell = findViewById(R.id.recyclerViewTopSell);
        recyclerViewToRead = findViewById(R.id.recyclerViewToRead);
        edtSearch = findViewById(R.id.edtSearch);
        progressBar = findViewById(R.id.progressBar);
        bottomNavigationView = findViewById(R.id.bottomNavigationView);
    }

    private void setupRecyclerViews() {
        // Setup Recommendation RecyclerView
        recommendationAdapter = new HomeBookAdapter(new ArrayList<>(), book -> {
            Intent intent = new Intent(HomeActivity.this, BookDetailActivity.class);
            intent.putExtra("book_id", book.getId());
            startActivity(intent);
        });
        recyclerViewRecommendation.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        recyclerViewRecommendation.setAdapter(recommendationAdapter);

        // Setup Popular RecyclerView
        popularAdapter = new HomeBookAdapter(new ArrayList<>(), book -> {
            Intent intent = new Intent(HomeActivity.this, BookDetailActivity.class);
            intent.putExtra("book_id", book.getId());
            startActivity(intent);
        });
        recyclerViewPopular.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        recyclerViewPopular.setAdapter(popularAdapter);

        // Setup Top Sell RecyclerView
        topSellAdapter = new HomeBookAdapter(new ArrayList<>(), book -> {
            Intent intent = new Intent(HomeActivity.this, BookDetailActivity.class);
            intent.putExtra("book_id", book.getId());
            startActivity(intent);
        });
        recyclerViewTopSell.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        recyclerViewTopSell.setAdapter(topSellAdapter);

        // Setup To Read RecyclerView
        toReadAdapter = new HomeBookAdapter(new ArrayList<>(), book -> {
            Intent intent = new Intent(HomeActivity.this, BookDetailActivity.class);
            intent.putExtra("book_id", book.getId());
            startActivity(intent);
        });
        recyclerViewToRead.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        recyclerViewToRead.setAdapter(toReadAdapter);
    }

    private void setupSearch() {
        edtSearch.setOnEditorActionListener((v, actionId, event) -> {
            // Navigate to BookListActivity with search query
            Intent intent = new Intent(HomeActivity.this, BookListActivity.class);
            intent.putExtra("search_query", edtSearch.getText().toString());
            startActivity(intent);
            return true;
        });
    }

    private void setupBottomNavigation() {
        bottomNavigationView.setOnItemSelectedListener(new NavigationBarView.OnItemSelectedListener() {
            @Override
            public boolean onNavigationItemSelected(@NonNull MenuItem item) {
                int itemId = item.getItemId();
                if (itemId == R.id.nav_home) {
                    // Already on home
                    return true;
                } else if (itemId == R.id.nav_notifications) {
                    startActivity(new Intent(HomeActivity.this, NotificationActivity.class));
                    return true;
                } else if (itemId == R.id.nav_cart) {
                    startActivity(new Intent(HomeActivity.this, CartActivity.class));
                    return true;
                } else if (itemId == R.id.nav_profile) {
                    startActivity(new Intent(HomeActivity.this, ProfileActivity.class));
                    return true;
                }
                return false;
            }
        });
        
        // Set home as selected
        bottomNavigationView.setSelectedItemId(R.id.nav_home);
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
                    if (books != null && !books.isEmpty()) {
                        allBooks = books;
                        updateBookLists();
                    } else {
                        Log.w(TAG, "No books found");
                    }
                } else {
                    String msg = "Không thể tải danh sách sách (HTTP " + response.code() + ")";
                    Log.e(TAG, msg);
                    Toast.makeText(HomeActivity.this, msg, Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<BooksResponse> call, Throwable t) {
                showProgress(false);
                String msg = "Lỗi kết nối: " + t.getMessage();
                Log.e(TAG, msg, t);
                Toast.makeText(HomeActivity.this, msg, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateBookLists() {
        if (allBooks.isEmpty()) {
            return;
        }

        // Recommendation: Show first 4-6 books
        int recommendationCount = Math.min(6, allBooks.size());
        List<Book> recommendationBooks = new ArrayList<>(allBooks.subList(0, recommendationCount));
        recommendationAdapter.updateBooks(recommendationBooks);

        // Popular: Show next 4-6 books
        int popularStart = recommendationCount;
        int popularEnd = Math.min(popularStart + 6, allBooks.size());
        List<Book> popularBooks;
        if (popularStart < allBooks.size()) {
            popularBooks = new ArrayList<>(allBooks.subList(popularStart, popularEnd));
        } else {
            // If not enough books, show from beginning again
            popularBooks = new ArrayList<>(allBooks.subList(0, Math.min(6, allBooks.size())));
        }
        popularAdapter.updateBooks(popularBooks);

        // Top Sell: Show next 4-6 books (or books with highest ratings/prices)
        int topSellStart = popularEnd;
        int topSellEnd = Math.min(topSellStart + 6, allBooks.size());
        List<Book> topSellBooks;
        if (topSellStart < allBooks.size()) {
            topSellBooks = new ArrayList<>(allBooks.subList(topSellStart, topSellEnd));
        } else {
            // If not enough books, cycle back or use first books
            int cycleStart = (topSellStart % allBooks.size());
            int cycleEnd = Math.min(cycleStart + 6, allBooks.size());
            if (cycleStart < allBooks.size()) {
                topSellBooks = new ArrayList<>(allBooks.subList(cycleStart, cycleEnd));
            } else {
                topSellBooks = new ArrayList<>(allBooks.subList(0, Math.min(6, allBooks.size())));
            }
        }
        topSellAdapter.updateBooks(topSellBooks);

        // To Read: Show next 4-6 books
        int toReadStart = topSellEnd;
        int toReadEnd = Math.min(toReadStart + 6, allBooks.size());
        List<Book> toReadBooks;
        if (toReadStart < allBooks.size()) {
            toReadBooks = new ArrayList<>(allBooks.subList(toReadStart, toReadEnd));
        } else {
            // If not enough books, cycle back
            int cycleStart = (toReadStart % allBooks.size());
            int cycleEnd = Math.min(cycleStart + 6, allBooks.size());
            if (cycleStart < allBooks.size()) {
                toReadBooks = new ArrayList<>(allBooks.subList(cycleStart, cycleEnd));
            } else {
                toReadBooks = new ArrayList<>(allBooks.subList(0, Math.min(6, allBooks.size())));
            }
        }
        toReadAdapter.updateBooks(toReadBooks);
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
    }
}

