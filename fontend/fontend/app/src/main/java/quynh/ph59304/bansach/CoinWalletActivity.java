package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
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
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.models.CoinWalletResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CoinWalletActivity extends AppCompatActivity {
    private TextView tvBalance;
    private TextView tvEmpty;
    private Button btnTopUp;
    private Button btnHistory;
    private RecyclerView recyclerViewTransactions;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private CoinTransactionAdapter adapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_wallet);

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
        setupListeners();
        loadWalletData();
    }

    @Override
    protected void onResume() {
        super.onResume();
        loadWalletData();
    }

    private void initViews() {
        tvBalance = findViewById(R.id.tvBalance);
        tvEmpty = findViewById(R.id.tvEmpty);
        btnTopUp = findViewById(R.id.btnTopUp);
        btnHistory = findViewById(R.id.btnHistory);
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions);
        swipeRefreshLayout = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            getSupportActionBar().setTitle("Ví Coin");
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void setupRecyclerView() {
        adapter = new CoinTransactionAdapter();
        recyclerViewTransactions.setLayoutManager(new LinearLayoutManager(this));
        recyclerViewTransactions.setAdapter(adapter);
    }

    private void setupListeners() {
        btnTopUp.setOnClickListener(v -> {
            Intent intent = new Intent(this, CoinTopUpActivity.class);
            startActivityForResult(intent, 100);
        });
        btnHistory.setOnClickListener(v -> {
            startActivity(new Intent(this, CoinHistoryActivity.class));
        });
        swipeRefreshLayout.setOnRefreshListener(() -> loadWalletData());
    }

    private void loadWalletData() {
        showProgress(true);
        Call<ApiResponse<CoinWalletResponse>> call = apiService.getCoinWallet();
        call.enqueue(new Callback<ApiResponse<CoinWalletResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<CoinWalletResponse>> call, Response<ApiResponse<CoinWalletResponse>> response) {
                showProgress(false);
                swipeRefreshLayout.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null && response.body().getData() != null) {
                    CoinWalletResponse wallet = response.body().getData();
                    tvBalance.setText(String.format("%,.0f", wallet.getCoinBalance()));
                    if (wallet.getRecentTransactions() != null && !wallet.getRecentTransactions().isEmpty()) {
                        adapter.setItems(wallet.getRecentTransactions());
                        tvEmpty.setVisibility(View.GONE);
                        recyclerViewTransactions.setVisibility(View.VISIBLE);
                    } else {
                        tvEmpty.setVisibility(View.VISIBLE);
                        recyclerViewTransactions.setVisibility(View.GONE);
                    }
                } else {
                    tvBalance.setText("0");
                    tvEmpty.setVisibility(View.VISIBLE);
                    recyclerViewTransactions.setVisibility(View.GONE);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<CoinWalletResponse>> call, Throwable t) {
                showProgress(false);
                swipeRefreshLayout.setRefreshing(false);
                Toast.makeText(CoinWalletActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        swipeRefreshLayout.setVisibility(show ? View.GONE : View.VISIBLE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 100 && resultCode == RESULT_OK) {
            loadWalletData();
        }
    }
}

