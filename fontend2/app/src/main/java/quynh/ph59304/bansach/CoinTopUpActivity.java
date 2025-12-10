package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import android.util.Log;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import quynh.ph59304.bansach.adapters.ExchangeRateAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CoinBalanceResponse;
import quynh.ph59304.bansach.models.CoinTransaction;
import quynh.ph59304.bansach.models.VnPayTopUpResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CoinTopUpActivity extends AppCompatActivity {
    private TextView tvBalance;
    private RecyclerView recyclerViewExchangeRates;
    private MaterialCardView cardMasterCard;
    private MaterialCardView cardVisa;
    private ImageButton btnClose;
    private MaterialButton btnTopUp;
    private BottomNavigationView bottomNavigationView;
    
    private ExchangeRateAdapter exchangeRateAdapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private boolean isMasterCardSelected = true; // true = VNPay, false = Bank Transfer
    private ExchangeRateAdapter.ExchangeRate selectedExchangeRate;
    private double pendingCoinsToAdd = 0; // Số coin sẽ được cộng khi VNPay thành công
    private static final int REQUEST_CODE_VNPAY = 1001;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_top_up);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            navigateToLogin();
            return;
        }

        initViews();
        setupExchangeRates();
        setupActions();
        setupBottomNavigation();
        updateCardSelection(); // Initialize card selection
        loadBalance();
        
        // Initially disable button until package is selected
        btnTopUp.setEnabled(false);
    }

    private void initViews() {
        tvBalance = findViewById(R.id.tvBalance);
        recyclerViewExchangeRates = findViewById(R.id.recyclerViewExchangeRates);
        cardMasterCard = findViewById(R.id.cardMasterCard);
        cardVisa = findViewById(R.id.cardVisa);
        btnClose = findViewById(R.id.btnClose);
        btnTopUp = findViewById(R.id.btnTopUp);
        bottomNavigationView = findViewById(R.id.bottomNavigationView);
    }

    private void setupExchangeRates() {
        // Exchange rates - all amounts must be >= 50,000 VND (backend minimum requirement)
        // Format: coins = VND amount (1,000 VND = 1 coin)
        List<ExchangeRateAdapter.ExchangeRate> exchangeRates = new ArrayList<>();
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(50, 50000));      // 50 coins = 50,000 VND
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(100, 100000));    // 100 coins = 100,000 VND
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(200, 200000));     // 200 coins = 200,000 VND (bonus: 10)
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(300, 300000));     // 300 coins = 300,000 VND
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(500, 500000));     // 500 coins = 500,000 VND (bonus: 50)
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(700, 700000));      // 700 coins = 700,000 VND
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(1000, 1000000));   // 1000 coins = 1,000,000 VND (bonus: 150)
        exchangeRates.add(new ExchangeRateAdapter.ExchangeRate(2000, 2000000));   // 2000 coins = 2,000,000 VND (bonus: 400)

        exchangeRateAdapter = new ExchangeRateAdapter(exchangeRates, (coins, dollars) -> {
            selectedExchangeRate = new ExchangeRateAdapter.ExchangeRate(coins, dollars);
            // Enable button when package is selected
            btnTopUp.setEnabled(true);
        });
        
        recyclerViewExchangeRates.setLayoutManager(new GridLayoutManager(this, 2));
        recyclerViewExchangeRates.setAdapter(exchangeRateAdapter);
    }

    private void setupActions() {
        btnClose.setOnClickListener(v -> finish());
        
        // MasterCard = VNPay payment method
        cardMasterCard.setOnClickListener(v -> {
            isMasterCardSelected = true;
            updateCardSelection();
        });
        
        // VISA = Bank Transfer payment method
        cardVisa.setOnClickListener(v -> {
            isMasterCardSelected = false;
            updateCardSelection();
        });
        
        btnTopUp.setOnClickListener(v -> {
            ExchangeRateAdapter.ExchangeRate selected = exchangeRateAdapter.getSelectedExchangeRate();
            if (selected == null) {
                Toast.makeText(this, "Vui lòng chọn gói nạp", Toast.LENGTH_SHORT).show();
                return;
            }
            selectedExchangeRate = selected;
            submitTopUp();
        });
    }

    private void updateCardSelection() {
        if (isMasterCardSelected) {
            cardMasterCard.setStrokeWidth(2);
            cardMasterCard.setStrokeColor(getResources().getColor(R.color.colorPrimary));
            cardVisa.setStrokeWidth(0);
        } else {
            cardVisa.setStrokeWidth(2);
            cardVisa.setStrokeColor(getResources().getColor(R.color.colorPrimary));
            cardMasterCard.setStrokeWidth(0);
        }
    }

    private void setupBottomNavigation() {
        bottomNavigationView.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_home) {
                startActivity(new Intent(this, HomeActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_notifications) {
                startActivity(new Intent(this, NotificationActivity.class));
                return true;
            } else if (itemId == R.id.nav_cart) {
                startActivity(new Intent(this, CartActivity.class));
                finish();
                return true;
            } else if (itemId == R.id.nav_profile) {
                startActivity(new Intent(this, ProfileActivity.class));
                finish();
                return true;
            }
            return false;
        });
    }

    private void loadBalance() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        Call<CoinBalanceResponse> call = apiService.getCoinBalance(authHeader);
        call.enqueue(new Callback<CoinBalanceResponse>() {
            @Override
            public void onResponse(Call<CoinBalanceResponse> call, Response<CoinBalanceResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    double balance = response.body().getBalance();
                    tvBalance.setText(String.format(Locale.getDefault(), "%,.0f", balance));
                } else {
                    if (!handleUnauthorized(response.code())) {
                        tvBalance.setText("100.000");
                    }
                }
            }

            @Override
            public void onFailure(Call<CoinBalanceResponse> call, Throwable t) {
                tvBalance.setText("100.000");
            }
        });
    }

    private void submitTopUp() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        if (selectedExchangeRate == null) {
            Toast.makeText(this, "Vui lòng chọn gói nạp", Toast.LENGTH_SHORT).show();
            return;
        }

        // Convert dollars to VND (the dollar amount is already in VND format based on the image)
        // Backend expects amount in VND (minimum 50,000 VND)
        double amount = selectedExchangeRate.getDollars();
        
        // Validate minimum amount
        if (amount < 50000) {
            Toast.makeText(this, "Số tiền nạp phải từ 50,000 VNĐ", Toast.LENGTH_SHORT).show();
            btnTopUp.setEnabled(true);
            return;
        }

        // Calculate coins that will be added (including bonus)
        // Backend formula: baseCoins = amount / 1000, bonus based on amount
        double baseCoins = amount / 1000;
        double bonusCoins = 0;
        if (amount >= 2000000) bonusCoins = 400;
        else if (amount >= 1000000) bonusCoins = 150;
        else if (amount >= 500000) bonusCoins = 50;
        else if (amount >= 200000) bonusCoins = 10;
        double totalCoins = baseCoins + bonusCoins;
        
        // Store pending coins to add immediately when VNPay succeeds
        pendingCoinsToAdd = totalCoins;
        
        Log.d("CoinTopUp", "Submitting top-up - Amount: " + amount + ", TotalCoins: " + totalCoins + 
              " (Base: " + baseCoins + ", Bonus: " + bonusCoins + ")");

        // Backend supports: 'momo', 'vnpay', 'bank_transfer'
        // Both MasterCard and VISA use VNPay for payment
        String paymentMethod = "vnpay";

        btnTopUp.setEnabled(false);
        Map<String, Object> body = new HashMap<>();
        body.put("amount", amount);
        body.put("paymentMethod", paymentMethod);

        // Use raw response to handle both VNPay (with paymentUrl) and regular responses
        Call<ResponseBody> call = apiService.topUpCoinsRaw(authHeader, body);
        call.enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                btnTopUp.setEnabled(true);
                if (response.isSuccessful() && response.body() != null) {
                    try {
                        String responseString = response.body().string();
                        Log.d("CoinTopUp", "Response: " + responseString);
                        
                        Gson gson = new Gson();
                        JsonObject jsonObject = gson.fromJson(responseString, JsonObject.class);
                        
                        if (jsonObject.has("success") && jsonObject.get("success").getAsBoolean()) {
                            // Check if this is a VNPay response (has paymentUrl)
                            if (jsonObject.has("paymentUrl")) {
                                // VNPay payment - open WebView
                                String paymentUrl = jsonObject.get("paymentUrl").getAsString();
                                Log.d("CoinTopUp", "VNPay payment URL received: " + paymentUrl);
                                openVnPayWebView(paymentUrl);
                            } else {
                                // Regular payment (bank_transfer, momo) - completed immediately
                                // This should NOT happen if paymentMethod = "vnpay"
                                Log.w("CoinTopUp", "No paymentUrl in response! Response: " + responseString);
                                Log.w("CoinTopUp", "This might be a bank_transfer or momo payment, or VNPay config issue");
                                
                                ApiResponse<CoinTransaction> apiResponse = gson.fromJson(responseString, 
                                    new com.google.gson.reflect.TypeToken<ApiResponse<CoinTransaction>>(){}.getType());
                                String message = apiResponse.getMessage() != null
                                        ? apiResponse.getMessage()
                                        : "Nạp coin thành công";
                                Toast.makeText(CoinTopUpActivity.this, message, Toast.LENGTH_SHORT).show();
                                
                                setResult(RESULT_OK);
                                finish();
                            }
                        } else {
                            String errorMsg = jsonObject.has("message") 
                                    ? jsonObject.get("message").getAsString()
                                    : "Không thể nạp coin. Vui lòng thử lại.";
                            Toast.makeText(CoinTopUpActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                        }
                    } catch (Exception e) {
                        Log.e("CoinTopUp", "Error parsing response", e);
                        Toast.makeText(CoinTopUpActivity.this, "Lỗi xử lý phản hồi từ server", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    if (!handleUnauthorized(response.code())) {
                        String errorMsg = "Không thể nạp coin";
                        if (response.errorBody() != null) {
                            try {
                                String errorString = response.errorBody().string();
                                Log.e("CoinTopUp", "Error response: " + errorString);
                            } catch (Exception e) {
                                Log.e("CoinTopUp", "Error reading error body", e);
                            }
                        }
                        Toast.makeText(CoinTopUpActivity.this, errorMsg + ". Mã lỗi: " + response.code(), Toast.LENGTH_LONG).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<ResponseBody> call, Throwable t) {
                btnTopUp.setEnabled(true);
                Log.e("CoinTopUp", "Request failed", t);
                Toast.makeText(CoinTopUpActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
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

    private void openVnPayWebView(String paymentUrl) {
        Intent intent = new Intent(this, VnPayWebViewActivity.class);
        intent.putExtra("paymentUrl", paymentUrl);
        startActivityForResult(intent, REQUEST_CODE_VNPAY);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == REQUEST_CODE_VNPAY) {
            if (resultCode == RESULT_OK) {
                // VNPay payment successful - cộng coin ngay lập tức
                addCoinsImmediately();
            } else if (resultCode == RESULT_CANCELED) {
                // VNPay payment failed or cancelled
                if (data != null) {
                    String responseCode = data.getStringExtra("responseCode");
                    String errorMsg = data.getStringExtra("errorMessage");
                    if (errorMsg != null) {
                        Toast.makeText(this, errorMsg, Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(this, "Thanh toán VNPay thất bại", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        }
    }
    
    private void addCoinsImmediately() {
        // Cộng coin ngay lập tức vào balance hiển thị
        if (pendingCoinsToAdd > 0) {
            try {
                // Lấy balance hiện tại từ TextView
                String currentBalanceText = tvBalance.getText().toString().replace(",", "").replace(".", "");
                double currentBalance = Double.parseDouble(currentBalanceText);
                
                // Cộng coin mới
                double newBalance = currentBalance + pendingCoinsToAdd;
                tvBalance.setText(String.format(Locale.getDefault(), "%,.0f", newBalance));
                
                Log.d("CoinTopUp", "Coins added immediately: " + pendingCoinsToAdd + 
                      " coins. Balance: " + currentBalance + " -> " + newBalance);
                
                Toast.makeText(CoinTopUpActivity.this, 
                    "Đã cộng " + String.format(Locale.getDefault(), "%,.0f", pendingCoinsToAdd) + " coins!", 
                    Toast.LENGTH_SHORT).show();
                
                // Reset pending coins
                pendingCoinsToAdd = 0;
            } catch (Exception e) {
                Log.e("CoinTopUp", "Error adding coins immediately: " + e.getMessage());
                // Fallback: refresh from backend and finish
                refreshBalanceFromBackend();
                setResult(RESULT_OK);
                finish();
                return;
            }
        }
        
        // Đóng activity ngay để UX tốt hơn
        // Parent activity (CoinWalletActivity) sẽ refresh khi nhận RESULT_OK
        setResult(RESULT_OK);
        finish();
        
        // Refresh từ backend sau khi đóng (chạy background)
        refreshBalanceFromBackend();
    }
    
    private void refreshBalanceFromBackend() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        // Refresh từ backend sau một chút để đảm bảo sync (chạy background, không block UI)
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            Call<CoinBalanceResponse> call = apiService.getCoinBalance(authHeader);
            call.enqueue(new Callback<CoinBalanceResponse>() {
                @Override
                public void onResponse(Call<CoinBalanceResponse> call, Response<CoinBalanceResponse> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        double balance = response.body().getBalance();
                        // Chỉ update nếu activity vẫn còn mở (trường hợp user chưa đóng)
                        if (!isFinishing()) {
                            tvBalance.setText(String.format(Locale.getDefault(), "%,.0f", balance));
                            Log.d("CoinTopUp", "Balance synced from backend: " + balance);
                        }
                    }
                }

                @Override
                public void onFailure(Call<CoinBalanceResponse> call, Throwable t) {
                    Log.w("CoinTopUp", "Failed to sync balance from backend: " + t.getMessage());
                    // Không cần xử lý lỗi, balance đã được cộng ở frontend
                }
            });
        }, 2000); // Refresh sau 2 giây để backend xử lý xong
    }
}
