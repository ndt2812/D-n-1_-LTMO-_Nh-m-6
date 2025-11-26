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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import quynh.ph59304.bansach.adapters.CoinTransactionAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CoinHistoryResponse;
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.util.ArrayList;
import java.util.List;

public class CoinHistoryActivity extends AppCompatActivity {
    private RecyclerView recyclerViewTransactions;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private TextView tvEmpty;
    private CoinTransactionAdapter adapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private int currentPage = 1;
    private boolean isLoading = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_history);

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        loadTransactions();
    }

    private void initViews() {
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions);
        swipeRefreshLayout = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressBar);
        tvEmpty = findViewById(R.id.tvEmpty);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            getSupportActionBar().setTitle("Lịch sử giao dịch");
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void setupRecyclerView() {
        adapter = new CoinTransactionAdapter();
        recyclerViewTransactions.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewTransactions.setAdapter(adapter);
        swipeRefreshLayout.setOnRefreshListener(() -> {
            currentPage = 1;
            loadTransactions();
        });
    }

    private void loadTransactions() {
        if (isLoading) return;
        isLoading = true;
        showProgress(true);
        Call<ApiResponse<CoinHistoryResponse>> call = apiService.getCoinTransactions(currentPage, 20, null);
        call.enqueue(new Callback<ApiResponse<CoinHistoryResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<CoinHistoryResponse>> call, Response<ApiResponse<CoinHistoryResponse>> response) {
                isLoading = false;
                showProgress(false);
                swipeRefreshLayout.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null && response.body().getData() != null) {
                    CoinHistoryResponse history = response.body().getData();
                    List<CoinTransaction> transactions = history.getTransactions();
                    if (transactions != null && !transactions.isEmpty()) {
                        adapter.setItems(transactions);
                        tvEmpty.setVisibility(View.GONE);
                        recyclerViewTransactions.setVisibility(View.VISIBLE);
                    } else {
                        tvEmpty.setVisibility(View.VISIBLE);
                        recyclerViewTransactions.setVisibility(View.GONE);
                    }
                } else {
                    tvEmpty.setVisibility(View.VISIBLE);
                    recyclerViewTransactions.setVisibility(View.GONE);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<CoinHistoryResponse>> call, Throwable t) {
                isLoading = false;
                showProgress(false);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(CoinHistoryActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        swipeRefreshLayout.setVisibility(show ? View.GONE : View.VISIBLE);
    }
}

