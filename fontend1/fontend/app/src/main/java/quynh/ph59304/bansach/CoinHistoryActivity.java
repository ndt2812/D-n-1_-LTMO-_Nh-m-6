package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import quynh.ph59304.bansach.adapters.CoinTransactionAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.CoinHistoryResponse;
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CoinHistoryActivity extends AppCompatActivity {
    private RecyclerView recyclerView;
    private ProgressBar progressBar;
    private TextView tvEmpty;
    private TextView tvPagination;
    private Button btnPrevious;
    private Button btnNext;
    private Spinner spinnerType;
    private CoinTransactionAdapter adapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private int currentPage = 1;
    private int totalPages = 1;
    private final List<CoinTransaction> transactions = new ArrayList<>();
    private boolean isLoading = false;
    private String selectedType = null;
    private boolean isFilterInitialized = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_history);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            navigateToLogin();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        setupFilter();
        setupPagination();
        loadHistory();
    }

    private void initViews() {
        recyclerView = findViewById(R.id.recyclerViewHistory);
        progressBar = findViewById(R.id.progressBar);
        tvEmpty = findViewById(R.id.tvEmpty);
        tvPagination = findViewById(R.id.tvPagination);
        btnPrevious = findViewById(R.id.btnPrevious);
        btnNext = findViewById(R.id.btnNext);
        spinnerType = findViewById(R.id.spinnerType);
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

    private void setupRecyclerView() {
        adapter = new CoinTransactionAdapter(transactions);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);
    }

    private void setupFilter() {
        String[] filters = {"Tất cả giao dịch", "Nạp coin", "Thanh toán", "Hoàn tiền", "Bonus"};
        ArrayAdapter<String> spinnerAdapter = new ArrayAdapter<>(this,
                android.R.layout.simple_spinner_item, filters);
        spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerType.setAdapter(spinnerAdapter);
        spinnerType.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                switch (position) {
                    case 1:
                        selectedType = "deposit";
                        break;
                    case 2:
                        selectedType = "purchase";
                        break;
                    case 3:
                        selectedType = "refund";
                        break;
                    case 4:
                        selectedType = "bonus";
                        break;
                    default:
                        selectedType = null;
                }
                if (isFilterInitialized) {
                    currentPage = 1;
                    loadHistory();
                } else {
                    isFilterInitialized = true;
                }
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });
    }

    private void setupPagination() {
        btnPrevious.setOnClickListener(v -> {
            if (currentPage > 1) {
                currentPage--;
                loadHistory();
            }
        });
        btnNext.setOnClickListener(v -> {
            if (currentPage < totalPages) {
                currentPage++;
                loadHistory();
            }
        });
    }

    private void loadHistory() {
        if (isLoading) {
            return;
        }
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        isLoading = true;
        showLoading(true);
        Call<CoinHistoryResponse> call = apiService.getCoinHistory(authHeader, currentPage, 20, selectedType);
        call.enqueue(new Callback<CoinHistoryResponse>() {
            @Override
            public void onResponse(Call<CoinHistoryResponse> call, Response<CoinHistoryResponse> response) {
                isLoading = false;
                showLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    updateHistory(response.body());
                } else {
                    if (!handleUnauthorized(response.code())) {
                        Toast.makeText(CoinHistoryActivity.this, "Không thể tải lịch sử coin", Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<CoinHistoryResponse> call, Throwable t) {
                isLoading = false;
                showLoading(false);
                Toast.makeText(CoinHistoryActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateHistory(CoinHistoryResponse response) {
        List<CoinTransaction> newTransactions = response.getTransactions();
        transactions.clear();
        transactions.addAll(newTransactions);
        adapter.notifyDataSetChanged();

        boolean isEmpty = newTransactions.isEmpty();
        recyclerView.setVisibility(isEmpty ? View.GONE : View.VISIBLE);
        tvEmpty.setVisibility(isEmpty ? View.VISIBLE : View.GONE);

        currentPage = response.getCurrentPage() > 0 ? response.getCurrentPage() : currentPage;
        totalPages = response.getTotalPages() > 0 ? response.getTotalPages() : 1;
        updatePaginationLabel();
    }

    private void updatePaginationLabel() {
        tvPagination.setText(String.format(Locale.getDefault(), "Trang %d / %d", currentPage, totalPages));
        btnPrevious.setEnabled(currentPage > 1);
        btnNext.setEnabled(currentPage < totalPages);
    }

    private void showLoading(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerView.setVisibility(show ? View.GONE : View.VISIBLE);
        if (show) {
            tvEmpty.setVisibility(View.GONE);
        }
    }

    private String getAuthHeaderOrRedirect() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            navigateToLogin();
            return null;
        }
        return "Bearer " + token;
    }

    private boolean handleUnauthorized(int statusCode) {
        if (statusCode == 401 || statusCode == 403) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_SHORT).show();
            navigateToLogin();
            return true;
        }
        return false;
    }

    private void navigateToLogin() {
        prefManager.clear();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }
}

