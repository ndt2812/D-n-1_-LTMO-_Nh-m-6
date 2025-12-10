package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
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
import quynh.ph59304.bansach.models.CoinBalanceResponse;
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.models.CoinWalletResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CoinBalanceActivity extends AppCompatActivity {
    private TextView tvBalanceMain;
    private TextView tvBalanceSecondary;
    private RecyclerView recyclerViewTransactions;
    private ProgressBar progressBar;
    private Button btnRefresh;
    private Button btnTopUp;
    private Button btnHistory;
    private TextView tvEmptyTransactions;
    
    private CoinTransactionAdapter transactionAdapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private boolean isLoading = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_balance);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            navigateToLogin();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        setupActions();
        loadWallet();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh wallet when returning to this activity
        loadWallet();
    }

    private void initViews() {
        tvBalanceMain = findViewById(R.id.tvBalanceMain);
        tvBalanceSecondary = findViewById(R.id.tvBalanceSecondary);
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions);
        progressBar = findViewById(R.id.progressBar);
        btnRefresh = findViewById(R.id.btnRefresh);
        btnTopUp = findViewById(R.id.btnTopUp);
        btnHistory = findViewById(R.id.btnHistory);
        tvEmptyTransactions = findViewById(R.id.tvEmptyTransactions);
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
        transactionAdapter = new CoinTransactionAdapter(new ArrayList<>());
        recyclerViewTransactions.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewTransactions.setAdapter(transactionAdapter);
        recyclerViewTransactions.setNestedScrollingEnabled(false);
    }

    private void setupActions() {
        btnRefresh.setOnClickListener(v -> loadWallet());
        btnTopUp.setOnClickListener(v -> {
            Intent intent = new Intent(this, CoinTopUpActivity.class);
            startActivityForResult(intent, 100);
        });
        btnHistory.setOnClickListener(v -> startActivity(new Intent(this, CoinHistoryActivity.class)));
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 100 && resultCode == RESULT_OK) {
            // Refresh wallet after successful top-up
            loadWallet();
        }
    }

    private void loadWallet() {
        if (isLoading) {
            return;
        }
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        isLoading = true;
        showLoading(true);
        Call<CoinWalletResponse> call = apiService.getCoinWallet(authHeader);
        call.enqueue(new Callback<CoinWalletResponse>() {
            @Override
            public void onResponse(Call<CoinWalletResponse> call, Response<CoinWalletResponse> response) {
                isLoading = false;
                showLoading(false);
                if (response.isSuccessful() && response.body() != null) {
                    updateWallet(response.body());
                } else {
                    if (!handleUnauthorized(response.code())) {
                        fetchBalanceOnly(authHeader);
                    }
                }
            }

            @Override
            public void onFailure(Call<CoinWalletResponse> call, Throwable t) {
                isLoading = false;
                showLoading(false);
                fetchBalanceOnly(authHeader);
            }
        });
    }

    private void updateWallet(CoinWalletResponse walletResponse) {
        if (walletResponse == null) {
            tvBalanceMain.setText("0");
            tvBalanceSecondary.setText("0");
            transactionAdapter.updateTransactions(new ArrayList<>());
            toggleEmptyState(true);
            return;
        }
        
        // Get balance from response
        double balance = walletResponse.getEffectiveBalance();
        
        // Format balance for display
        String balanceStr = String.format(Locale.getDefault(), "%,.0f", balance);
        tvBalanceMain.setText(balanceStr);
        
        // For secondary balance, you can use a different calculation or same value
        // Based on the image, it seems to show a different number, but we'll use the same for now
        tvBalanceSecondary.setText(balanceStr);

        List<CoinTransaction> transactions = walletResponse.getDisplayTransactions();
        if (transactions == null) {
            transactions = new ArrayList<>();
        }
        transactionAdapter.updateTransactions(transactions);
        toggleEmptyState(transactions.isEmpty());
    }

    private void fetchBalanceOnly(String authHeader) {
        Call<CoinBalanceResponse> call = apiService.getCoinBalance(authHeader);
        call.enqueue(new Callback<CoinBalanceResponse>() {
            @Override
            public void onResponse(Call<CoinBalanceResponse> call, Response<CoinBalanceResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    CoinBalanceResponse balanceResponse = response.body();
                    double balance = balanceResponse.getBalance();
                    String balanceStr = String.format(Locale.getDefault(), "%,.0f", balance);
                    tvBalanceMain.setText(balanceStr);
                    tvBalanceSecondary.setText(balanceStr);
                    transactionAdapter.updateTransactions(new ArrayList<>());
                    toggleEmptyState(true);
                } else {
                    handleLoadError();
                }
            }

            @Override
            public void onFailure(Call<CoinBalanceResponse> call, Throwable t) {
                handleLoadError();
            }
        });
    }

    private void handleLoadError() {
        Toast.makeText(this, "Không thể tải thông tin ví coin", Toast.LENGTH_SHORT).show();
        transactionAdapter.updateTransactions(new ArrayList<>());
        toggleEmptyState(true);
    }

    private void toggleEmptyState(boolean showEmpty) {
        tvEmptyTransactions.setVisibility(showEmpty ? View.VISIBLE : View.GONE);
        recyclerViewTransactions.setVisibility(showEmpty ? View.GONE : View.VISIBLE);
    }

    private void showLoading(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        btnRefresh.setEnabled(!show);
        btnTopUp.setEnabled(!show);
        btnHistory.setEnabled(!show);
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
