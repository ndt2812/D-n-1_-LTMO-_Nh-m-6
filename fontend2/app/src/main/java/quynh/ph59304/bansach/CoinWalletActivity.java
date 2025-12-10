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
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import quynh.ph59304.bansach.adapters.CoinTransactionAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CoinBalanceResponse;
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.models.CoinWalletResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CoinWalletActivity extends AppCompatActivity {
    private TextView tvBalance;
    private TextView tvBalanceSubtitle;
    private TextView tvEmptyTransactions;
    private RecyclerView recyclerViewTransactions;
    private ProgressBar progressBar;
    private Button btnRefresh;
    private Button btnTopUp;
    private Button btnHistory;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private CoinTransactionAdapter transactionAdapter;
    private boolean isLoading = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_wallet);

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
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Luôn refresh wallet khi quay lại activity
        loadWallet();
        
        // Tự động refresh lại sau 5 giây để fix các transaction pending
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            if (!isFinishing()) {
                loadWallet();
            }
        }, 5000);
    }

    private void initViews() {
        tvBalance = findViewById(R.id.tvCoinBalance);
        tvBalanceSubtitle = findViewById(R.id.tvCoinSubtitle);
        tvEmptyTransactions = findViewById(R.id.tvEmptyTransactions);
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions);
        progressBar = findViewById(R.id.progressBar);
        btnRefresh = findViewById(R.id.btnRefreshBalance);
        btnTopUp = findViewById(R.id.btnTopUp);
        btnHistory = findViewById(R.id.btnHistory);
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
            // Refresh wallet sau khi nạp coin thành công
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
            tvBalance.setText("0 coin");
            tvBalanceSubtitle.setText("Không tải được thông tin ví");
            transactionAdapter.updateTransactions(new ArrayList<>());
            toggleEmptyState(true);
            return;
        }
        
        // Lấy số dư từ nhiều nguồn để đảm bảo hiển thị đúng
        double balance = walletResponse.getEffectiveBalance();
        
        // Log để debug
        android.util.Log.d("CoinWallet", "Balance from response: " + balance);
        android.util.Log.d("CoinWallet", "coinBalance: " + walletResponse.getCoinBalance());
        android.util.Log.d("CoinWallet", "balance: " + walletResponse.getBalance());
        android.util.Log.d("CoinWallet", "totalBalance: " + walletResponse.getTotalBalance());
        if (walletResponse.getUser() != null) {
            android.util.Log.d("CoinWallet", "user.coinBalance: " + walletResponse.getUser().getCoinBalance());
        }
        
        tvBalance.setText(String.format(Locale.getDefault(), "%,.0f coin", balance));
        if (walletResponse.getMessage() != null) {
            tvBalanceSubtitle.setText(walletResponse.getMessage());
        } else {
            tvBalanceSubtitle.setText("Sử dụng Coin để thanh toán hoặc nhận ưu đãi");
        }

        List<CoinTransaction> transactions = walletResponse.getDisplayTransactions();
        if (transactions == null) {
            transactions = new ArrayList<>();
        }
        transactionAdapter.updateTransactions(transactions);
        toggleEmptyState(transactions.isEmpty());
        
        // Tự động fix các transaction VNPay pending > 2 phút
        fixPendingVnPayTransactions(transactions);
    }
    
    private void fixPendingVnPayTransactions(List<CoinTransaction> transactions) {
        if (transactions == null || transactions.isEmpty()) {
            return;
        }
        
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        
        // Tìm các transaction VNPay pending > 30 giây (giảm từ 2 phút để fix nhanh hơn)
        long currentTime = System.currentTimeMillis();
        long thirtySecondsAgo = currentTime - (30 * 1000);
        
        for (CoinTransaction transaction : transactions) {
            if (transaction == null) continue;
            
            // Chỉ xử lý transaction VNPay deposit pending
            if ("vnpay".equalsIgnoreCase(transaction.getPaymentMethod()) &&
                "deposit".equalsIgnoreCase(transaction.getType()) &&
                transaction.isPending()) {
                
                try {
                    // Parse createdAt để kiểm tra thời gian
                    String createdAt = transaction.getCreatedAt();
                    if (createdAt != null && !createdAt.isEmpty()) {
                        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault());
                        sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                        try {
                            // Handle both formats: with milliseconds and without
                            String dateStr = createdAt.replace("Z", "");
                            if (dateStr.contains(".")) {
                                dateStr = dateStr.substring(0, dateStr.indexOf("."));
                            }
                            if (dateStr.length() > 19) {
                                dateStr = dateStr.substring(0, 19);
                            }
                            
                            java.util.Date createdDate = sdf.parse(dateStr);
                            if (createdDate != null) {
                                long transactionAge = currentTime - createdDate.getTime();
                                android.util.Log.d("CoinWallet", "Transaction " + transaction.getId() + 
                                    " age: " + (transactionAge / 1000) + " seconds");
                                
                                // Fix transaction nếu đã > 30 giây
                                if (createdDate.getTime() < thirtySecondsAgo) {
                                    android.util.Log.d("CoinWallet", "Auto-fixing pending VNPay transaction: " + transaction.getId());
                                    processPendingTransaction(transaction, authHeader);
                                } else {
                                    android.util.Log.d("CoinWallet", "Transaction " + transaction.getId() + 
                                        " is too recent, will retry later");
                                }
                            }
                        } catch (Exception e) {
                            android.util.Log.w("CoinWallet", "Error parsing date for transaction " + transaction.getId() + ": " + e.getMessage());
                            // Nếu không parse được date, vẫn thử fix (có thể là transaction cũ)
                            android.util.Log.d("CoinWallet", "Attempting to fix transaction anyway: " + transaction.getId());
                            processPendingTransaction(transaction, authHeader);
                        }
                    } else {
                        // Nếu không có createdAt, vẫn thử fix
                        android.util.Log.d("CoinWallet", "No createdAt, attempting to fix transaction: " + transaction.getId());
                        processPendingTransaction(transaction, authHeader);
                    }
                } catch (Exception e) {
                    android.util.Log.e("CoinWallet", "Error checking transaction: " + e.getMessage());
                }
            }
        }
    }
    
    private void processPendingTransaction(CoinTransaction transaction, String authHeader) {
        Map<String, Object> body = new HashMap<>();
        if (transaction.getId() != null) {
            body.put("transactionId", transaction.getId());
        }
        if (transaction.getPaymentTransactionId() != null) {
            body.put("vnp_TxnRef", transaction.getPaymentTransactionId());
        }
        
        Call<ApiResponse<Map<String, Object>>> call = apiService.manualCallback(authHeader, body);
        call.enqueue(new Callback<ApiResponse<Map<String, Object>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, Object>>> call, Response<ApiResponse<Map<String, Object>>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    android.util.Log.d("CoinWallet", "Successfully processed pending transaction: " + transaction.getId());
                    // Refresh wallet sau khi fix thành công
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        loadWallet();
                    }, 1000);
                } else {
                    android.util.Log.w("CoinWallet", "Failed to process pending transaction: " + response.code());
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, Object>>> call, Throwable t) {
                android.util.Log.e("CoinWallet", "Error processing pending transaction: " + t.getMessage());
            }
        });
    }

    private void fetchBalanceOnly(String authHeader) {
        Call<CoinBalanceResponse> call = apiService.getCoinBalance(authHeader);
        call.enqueue(new Callback<CoinBalanceResponse>() {
            @Override
            public void onResponse(Call<CoinBalanceResponse> call, Response<CoinBalanceResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    CoinBalanceResponse balanceResponse = response.body();
                    double balance = balanceResponse.getBalance();
                    tvBalance.setText(String.format(Locale.getDefault(), "%,.0f coin", balance));
                    tvBalanceSubtitle.setText("Không tải được lịch sử giao dịch. Vui lòng thử lại sau.");
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
            prefManager.clear();
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

