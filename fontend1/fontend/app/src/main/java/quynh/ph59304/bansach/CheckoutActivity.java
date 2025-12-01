package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.textfield.TextInputEditText;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CartResponse;
import quynh.ph59304.bansach.models.Order;
import quynh.ph59304.bansach.models.PromotionInfo;
import quynh.ph59304.bansach.models.PromotionListResponse;
import quynh.ph59304.bansach.models.PromotionPreviewResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CheckoutActivity extends AppCompatActivity {
    private static final String TAG = "CheckoutActivity";
    
    private RadioGroup radioGroupPayment;
    private RadioButton radioCoin;
    private RadioButton radioCash;
    private TextView tvTotalAmount;
    private TextView tvSubtotal;
    private TextView tvShippingFee;
    private TextView tvDiscountAmount;
    private TextView tvCoinBalance;
    private Button btnPlaceOrder;
    private ProgressBar progressBar;
    
    // Shipping info views
    private TextInputEditText edtFullName;
    private TextInputEditText edtPhone;
    private TextInputEditText edtAddress;
    private TextInputEditText edtCity;
    private TextInputEditText edtPostalCode;
    
    // Promotion views
    private TextInputEditText edtPromotionCode;
    private Button btnApplyPromotion;
    private TextView tvPromotionStatus;
    private ProgressBar promotionLoading;
    private TextView tvPromotionEmpty;
    private ChipGroup chipPromotionGroup;
    
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private double totalAmount = 0;
    private double subtotal = 0;
    private double shippingFee = 0;
    private double discountAmount = 0;
    private String selectedPaymentMethod = "coin"; // Default: Coin
    private String selectedPromotionCode = null;
    private boolean isSubmitting = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_checkout);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        // Kiểm tra đăng nhập
        if (!prefManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupActions();
        loadCart();
        loadCoinBalance();
        loadPromotions();
        loadUserProfileToForm();
    }

    private void initViews() {
        radioGroupPayment = findViewById(R.id.radioGroupPayment);
        radioCoin = findViewById(R.id.radioCoin);
        radioCash = findViewById(R.id.radioCash);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvSubtotal = findViewById(R.id.tvSubtotal);
        tvShippingFee = findViewById(R.id.tvShippingFee);
        tvDiscountAmount = findViewById(R.id.tvDiscountAmount);
        tvCoinBalance = findViewById(R.id.tvCoinBalance);
        btnPlaceOrder = findViewById(R.id.btnPlaceOrder);
        progressBar = findViewById(R.id.progressBar);
        
        // Shipping info views
        edtFullName = findViewById(R.id.edtFullName);
        edtPhone = findViewById(R.id.edtPhone);
        edtAddress = findViewById(R.id.edtAddress);
        edtCity = findViewById(R.id.edtCity);
        edtPostalCode = findViewById(R.id.edtPostalCode);
        
        // Promotion views
        edtPromotionCode = findViewById(R.id.edtPromotionCode);
        btnApplyPromotion = findViewById(R.id.btnApplyPromotion);
        tvPromotionStatus = findViewById(R.id.tvPromotionStatus);
        promotionLoading = findViewById(R.id.promotionLoading);
        tvPromotionEmpty = findViewById(R.id.tvPromotionEmpty);
        chipPromotionGroup = findViewById(R.id.chipPromotionGroup);
    }

    private void setupActions() {
        radioGroupPayment.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.radioCoin) {
                selectedPaymentMethod = "coin";
                tvCoinBalance.setVisibility(View.VISIBLE);
            } else if (checkedId == R.id.radioCash) {
                selectedPaymentMethod = "cash_on_delivery";
                tvCoinBalance.setVisibility(View.GONE);
            }
        });
        
        btnApplyPromotion.setOnClickListener(v -> applyPromotionCode());
        btnPlaceOrder.setOnClickListener(v -> placeOrder());
    }

    private void loadCoinBalance() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        // TODO: Load coin balance from API if needed
        // For now, just show/hide based on payment method
    }

    private void loadPromotions() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        
        promotionLoading.setVisibility(View.VISIBLE);
        tvPromotionEmpty.setVisibility(View.GONE);
        chipPromotionGroup.removeAllViews();
        
        Log.d(TAG, "Loading promotions...");
        Call<PromotionListResponse> call = apiService.getAvailablePromotions(authHeader);
        call.enqueue(new Callback<PromotionListResponse>() {
            @Override
            public void onResponse(Call<PromotionListResponse> call, Response<PromotionListResponse> response) {
                promotionLoading.setVisibility(View.GONE);
                
                Log.d(TAG, "Promotions response code: " + response.code());
                Log.d(TAG, "Promotions response body: " + (response.body() != null ? "not null" : "null"));
                
                if (response.isSuccessful() && response.body() != null) {
                    PromotionListResponse promotionResponse = response.body();
                    Log.d(TAG, "Promotion response success: " + promotionResponse.isSuccess());
                    Log.d(TAG, "Promotions list: " + (promotionResponse.getPromotions() != null ? promotionResponse.getPromotions().size() : "null"));
                    
                    // Try to get promotions even if success is false or null
                    List<PromotionInfo> promotions = promotionResponse.getPromotions();
                    
                    // Also check if response has promotions directly (in case structure is different)
                    if (promotions == null || promotions.isEmpty()) {
                        // Try to parse from error body for debugging
                        try {
                            if (response.errorBody() != null) {
                                String errorBody = response.errorBody().string();
                                Log.e(TAG, "Error body: " + errorBody);
                            }
                        } catch (IOException e) {
                            Log.e(TAG, "Error reading error body", e);
                        }
                    }
                    
                    if (promotions != null && !promotions.isEmpty()) {
                        tvPromotionEmpty.setVisibility(View.GONE);
                        chipPromotionGroup.setVisibility(View.VISIBLE);
                        Log.d(TAG, "Displaying " + promotions.size() + " promotions");
                        displayPromotionsAsChips(promotions);
                    } else {
                        tvPromotionEmpty.setVisibility(View.VISIBLE);
                        chipPromotionGroup.setVisibility(View.GONE);
                        Log.w(TAG, "No promotions available");
                    }
                } else {
                    tvPromotionEmpty.setVisibility(View.VISIBLE);
                    chipPromotionGroup.setVisibility(View.GONE);
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                    Log.e(TAG, "Load promotions failed: " + response.code());
                    try {
                        if (response.errorBody() != null) {
                            String errorBody = response.errorBody().string();
                            Log.e(TAG, "Error response body: " + errorBody);
                        }
                    } catch (IOException e) {
                        Log.e(TAG, "Error reading error body", e);
                    }
                }
            }

            @Override
            public void onFailure(Call<PromotionListResponse> call, Throwable t) {
                promotionLoading.setVisibility(View.GONE);
                tvPromotionEmpty.setVisibility(View.VISIBLE);
                chipPromotionGroup.setVisibility(View.GONE);
                Log.e(TAG, "Load promotions error: " + t.getMessage(), t);
                Toast.makeText(CheckoutActivity.this, "Không thể tải mã khuyến mãi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void displayPromotionsAsChips(List<PromotionInfo> promotions) {
        chipPromotionGroup.removeAllViews();
        
        for (PromotionInfo promotion : promotions) {
            Chip chip = new Chip(this);
            chip.setText(promotion.getCode());
            chip.setCheckable(true);
            chip.setClickable(true);
            
            // Set chip style - use a light background color
            chip.setChipBackgroundColorResource(R.color.colorPrimaryContainer);
            chip.setChipStrokeWidth(2);
            chip.setChipStrokeColorResource(R.color.colorPrimary);
            chip.setTextColor(getResources().getColor(R.color.colorPrimary, null));
            
            // Set minimum height
            chip.setMinHeight((int) (48 * getResources().getDisplayMetrics().density));
            
            // Set click listener
            chip.setOnClickListener(v -> {
                // Select this chip and fill the promotion code
                edtPromotionCode.setText(promotion.getCode());
                // Uncheck other chips
                for (int i = 0; i < chipPromotionGroup.getChildCount(); i++) {
                    View child = chipPromotionGroup.getChildAt(i);
                    if (child instanceof Chip && child != chip) {
                        ((Chip) child).setChecked(false);
                    }
                }
                chip.setChecked(true);
            });
            
            chipPromotionGroup.addView(chip);
        }
    }

    private void applyPromotionCode() {
        String code = edtPromotionCode.getText() != null ? edtPromotionCode.getText().toString().trim() : "";
        
        if (TextUtils.isEmpty(code)) {
            Toast.makeText(this, "Vui lòng nhập mã khuyến mãi", Toast.LENGTH_SHORT).show();
            return;
        }
        
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        
        promotionLoading.setVisibility(View.VISIBLE);
        btnApplyPromotion.setEnabled(false);
        tvPromotionStatus.setText("");
        
        Map<String, String> body = new HashMap<>();
        body.put("code", code.toUpperCase());
        
        Call<PromotionPreviewResponse> call = apiService.applyPromotion(authHeader, body);
        call.enqueue(new Callback<PromotionPreviewResponse>() {
            @Override
            public void onResponse(Call<PromotionPreviewResponse> call, Response<PromotionPreviewResponse> response) {
                promotionLoading.setVisibility(View.GONE);
                btnApplyPromotion.setEnabled(true);
                
                if (response.isSuccessful() && response.body() != null) {
                    PromotionPreviewResponse previewResponse = response.body();
                    if (previewResponse.isSuccess() && previewResponse.getDiscountAmount() > 0) {
                        discountAmount = previewResponse.getDiscountAmount();
                        selectedPromotionCode = code.toUpperCase();
                        totalAmount = subtotal + shippingFee - discountAmount;
                        updateTotalDisplay();
                        
                        String discountText = "";
                        PromotionInfo promotion = previewResponse.getPromotion();
                        if (promotion != null) {
                            if ("percentage".equals(promotion.getDiscountType())) {
                                discountText = String.format(Locale.getDefault(), 
                                    "Áp dụng thành công! Giảm %.0f%% - Tiết kiệm: %,.0f đ", 
                                    promotion.getDiscountValue(), discountAmount);
                            } else {
                                discountText = String.format(Locale.getDefault(), 
                                    "Áp dụng thành công! Giảm %,.0f đ", discountAmount);
                            }
                        } else {
                            discountText = String.format(Locale.getDefault(), 
                                "Áp dụng thành công! Tiết kiệm: %,.0f đ", discountAmount);
                        }
                        tvPromotionStatus.setText(discountText);
                        tvPromotionStatus.setTextColor(getResources().getColor(R.color.colorPrimary));
                        
                        Toast.makeText(CheckoutActivity.this, "Áp dụng mã khuyến mãi thành công", Toast.LENGTH_SHORT).show();
                    } else {
                        String errorMsg = previewResponse.getError() != null ? previewResponse.getError() : "Mã khuyến mãi không hợp lệ";
                        tvPromotionStatus.setText(errorMsg);
                        tvPromotionStatus.setTextColor(getResources().getColor(android.R.color.holo_red_dark));
                        discountAmount = 0;
                        selectedPromotionCode = null;
                        totalAmount = subtotal + shippingFee;
                        updateTotalDisplay();
                    }
                } else {
                    tvPromotionStatus.setText("Mã khuyến mãi không hợp lệ hoặc đã hết hạn");
                    tvPromotionStatus.setTextColor(getResources().getColor(android.R.color.holo_red_dark));
                    discountAmount = 0;
                    selectedPromotionCode = null;
                    totalAmount = subtotal + shippingFee;
                    updateTotalDisplay();
                    
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                }
            }

            @Override
            public void onFailure(Call<PromotionPreviewResponse> call, Throwable t) {
                promotionLoading.setVisibility(View.GONE);
                btnApplyPromotion.setEnabled(true);
                tvPromotionStatus.setText("Lỗi kết nối. Vui lòng thử lại.");
                tvPromotionStatus.setTextColor(getResources().getColor(android.R.color.holo_red_dark));
                Log.e(TAG, "Apply promotion error: " + t.getMessage(), t);
                Toast.makeText(CheckoutActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void loadCart() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        showProgress(true);
        Call<ApiResponse<CartResponse>> call = apiService.getCart(authHeader);
        call.enqueue(new Callback<ApiResponse<CartResponse>>() {
            @Override
            public void onResponse(Call<ApiResponse<CartResponse>> call, Response<ApiResponse<CartResponse>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<CartResponse> apiResponse = response.body();
                    CartResponse cartResponse = apiResponse.getCart();
                    if (cartResponse == null && apiResponse.getData() != null) {
                        cartResponse = apiResponse.getData();
                    }
                    
                    if (cartResponse != null && cartResponse.getItems() != null && !cartResponse.getItems().isEmpty()) {
                        // Calculate total with shipping fee
                        subtotal = cartResponse.getTotalAmount();
                        shippingFee = computeShippingFee(subtotal);
                        totalAmount = subtotal + shippingFee - discountAmount;
                        updateTotalDisplay();
                    } else {
                        Toast.makeText(CheckoutActivity.this, "Giỏ hàng trống", Toast.LENGTH_SHORT).show();
                        finish();
                    }
                } else {
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                    Log.e(TAG, "Load cart failed: " + response.code());
                    Toast.makeText(CheckoutActivity.this, "Không thể tải giỏ hàng", Toast.LENGTH_SHORT).show();
                    finish();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<CartResponse>> call, Throwable t) {
                showProgress(false);
                Log.e(TAG, "Load cart error: " + t.getMessage(), t);
                Toast.makeText(CheckoutActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private double computeShippingFee(double amount) {
        if (amount >= 500000) {
            return 0;
        } else if (amount >= 200000) {
            return 30000;
        }
        return 50000;
    }

    private void updateTotalDisplay() {
        // Format amounts in VND
        tvSubtotal.setText(String.format(Locale.getDefault(), "%,.0f đ", subtotal));
        tvShippingFee.setText(String.format(Locale.getDefault(), "%,.0f đ", shippingFee));
        tvDiscountAmount.setText(String.format(Locale.getDefault(), "-%,.0f đ", discountAmount));
        tvTotalAmount.setText(String.format(Locale.getDefault(), "%,.0f đ", totalAmount));
    }

    private void placeOrder() {
        if (isSubmitting) {
            return;
        }
        
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        // Backend expects: 'cash_on_delivery', 'bank_transfer', 'credit_card', 'coin'
        // Map selected card to payment method
        String paymentMethod = selectedPaymentMethod; // Already set to "credit_card"

        isSubmitting = true;
        btnPlaceOrder.setEnabled(false);
        showProgress(true);

        // Get user profile for shipping info
        loadUserProfileAndPlaceOrder(authHeader, paymentMethod);
    }

    private void loadUserProfileToForm() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }
        
        Call<ApiResponse<quynh.ph59304.bansach.models.User>> call = apiService.getProfile(authHeader);
        call.enqueue(new Callback<ApiResponse<quynh.ph59304.bansach.models.User>>() {
            @Override
            public void onResponse(Call<ApiResponse<quynh.ph59304.bansach.models.User>> call, Response<ApiResponse<quynh.ph59304.bansach.models.User>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<quynh.ph59304.bansach.models.User> apiResponse = response.body();
                    quynh.ph59304.bansach.models.User user = apiResponse.getUser();
                    if (user == null && apiResponse.getData() != null) {
                        user = (quynh.ph59304.bansach.models.User) apiResponse.getData();
                    }

                    if (user != null) {
                        quynh.ph59304.bansach.models.UserProfile profile = user.getProfile();
                        if (profile != null) {
                            // Fill form with profile data if fields are empty
                            if (edtFullName.getText() == null || edtFullName.getText().toString().trim().isEmpty()) {
                                edtFullName.setText(profile.getFullName() != null ? profile.getFullName() : "");
                            }
                            if (edtPhone.getText() == null || edtPhone.getText().toString().trim().isEmpty()) {
                                edtPhone.setText(profile.getPhone() != null ? profile.getPhone() : "");
                            }
                            if (edtAddress.getText() == null || edtAddress.getText().toString().trim().isEmpty()) {
                                edtAddress.setText(profile.getAddress() != null ? profile.getAddress() : "");
                            }
                            if (edtCity.getText() == null || edtCity.getText().toString().trim().isEmpty()) {
                                edtCity.setText(profile.getCity() != null ? profile.getCity() : "");
                            }
                            if (edtPostalCode.getText() == null || edtPostalCode.getText().toString().trim().isEmpty()) {
                                edtPostalCode.setText(profile.getPostalCode() != null ? profile.getPostalCode() : "");
                            }
                        }
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<quynh.ph59304.bansach.models.User>> call, Throwable t) {
                Log.e(TAG, "Load profile to form error: " + t.getMessage(), t);
            }
        });
    }

    private void loadUserProfileAndPlaceOrder(String authHeader, String paymentMethod) {
        // Read shipping info from EditText fields
        Map<String, Object> body = new HashMap<>();
        
        String fullName = edtFullName.getText() != null ? edtFullName.getText().toString().trim() : "";
        String phone = edtPhone.getText() != null ? edtPhone.getText().toString().trim() : "";
        String address = edtAddress.getText() != null ? edtAddress.getText().toString().trim() : "";
        String city = edtCity.getText() != null ? edtCity.getText().toString().trim() : "";
        String postalCode = edtPostalCode.getText() != null ? edtPostalCode.getText().toString().trim() : "";
        
        // Validate required fields
        if (TextUtils.isEmpty(fullName) || TextUtils.isEmpty(phone) || 
            TextUtils.isEmpty(address) || TextUtils.isEmpty(city)) {
            isSubmitting = false;
            btnPlaceOrder.setEnabled(true);
            showProgress(false);
            Toast.makeText(CheckoutActivity.this, "Vui lòng điền đầy đủ thông tin giao hàng (Họ tên, Số điện thoại, Địa chỉ, Thành phố)", Toast.LENGTH_LONG).show();
            return;
        }
        
        body.put("fullName", fullName);
        body.put("phone", phone);
        body.put("address", address);
        body.put("city", city);
        body.put("postalCode", postalCode);
        body.put("paymentMethod", paymentMethod);
        body.put("notes", "");
        
        // Add promotion code if applied
        if (selectedPromotionCode != null && !selectedPromotionCode.isEmpty()) {
            body.put("promotionCode", selectedPromotionCode);
        }
        
        submitOrderRequest(authHeader, body);
    }

    private void submitOrderRequest(String authHeader, Map<String, Object> body) {
        Call<ApiResponse<Order>> call = apiService.createOrderApi(authHeader, body);
        call.enqueue(new Callback<ApiResponse<Order>>() {
            @Override
            public void onResponse(Call<ApiResponse<Order>> call, Response<ApiResponse<Order>> response) {
                isSubmitting = false;
                btnPlaceOrder.setEnabled(true);
                showProgress(false);
                
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Order> apiResponse = response.body();
                    Order order = apiResponse.getOrder();
                    if (order == null && apiResponse.getData() != null) {
                        order = (Order) apiResponse.getData();
                    }

                    if (order != null) {
                        Toast.makeText(CheckoutActivity.this, "Đặt hàng thành công", Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(CheckoutActivity.this, OrderDetailActivity.class);
                        intent.putExtra("order_id", order.getId());
                        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        startActivity(intent);
                        finish();
                    } else {
                        Toast.makeText(CheckoutActivity.this, "Đặt hàng thất bại", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                    String errorMsg = "Đặt hàng thất bại";
                    if (response.body() != null) {
                        if (response.body().getError() != null) {
                            errorMsg = response.body().getError();
                        } else if (response.body().getMessage() != null) {
                            errorMsg = response.body().getMessage();
                        }
                    }
                    try {
                        if (response.errorBody() != null) {
                            String errorBody = response.errorBody().string();
                            Log.e(TAG, "Order error response body: " + errorBody);
                        }
                    } catch (IOException e) {
                        Log.e(TAG, "Error parsing error response: " + e.getMessage());
                    }
                    Toast.makeText(CheckoutActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Order>> call, Throwable t) {
                isSubmitting = false;
                btnPlaceOrder.setEnabled(true);
                showProgress(false);
                Log.e(TAG, "Place order error: " + t.getMessage(), t);
                Toast.makeText(CheckoutActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        if (progressBar != null) {
            progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        }
        if (btnPlaceOrder != null) {
            btnPlaceOrder.setEnabled(!show);
        }
    }

    private String getAuthHeaderOrRedirect() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_LONG).show();
            prefManager.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return null;
        }
        return "Bearer " + token;
    }

    private boolean handleUnauthorized(int statusCode) {
        if (statusCode == 401 || statusCode == 403) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", Toast.LENGTH_SHORT).show();
            prefManager.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return true;
        }
        return false;
    }
}
