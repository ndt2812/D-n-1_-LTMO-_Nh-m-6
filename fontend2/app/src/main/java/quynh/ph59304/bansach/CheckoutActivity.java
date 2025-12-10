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
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.textfield.TextInputEditText;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.reflect.TypeToken;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CartResponse;
import quynh.ph59304.bansach.models.Order;
import quynh.ph59304.bansach.models.PromotionInfo;
import quynh.ph59304.bansach.models.PromotionListResponse;
import quynh.ph59304.bansach.models.PromotionPreviewResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CheckoutActivity extends AppCompatActivity {
    private static final String TAG = "CheckoutActivity";
    private static final int REQUEST_CODE_VNPAY = 2001;
    
    private View radioGroupPayment;
    private RadioButton radioCash;
    private RadioButton radioVnPay;
    private CardView cardCash;
    private CardView cardVnPay;
    private TextView tvTotalAmount;
    private TextView tvSubtotal;
    private TextView tvShippingFee;
    private TextView tvDiscountAmount;
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
    private String selectedPaymentMethod = "cash_on_delivery"; // Default: Cash on delivery
    private String selectedPromotionCode = null;
    private boolean isSubmitting = false;
    private boolean isUpdatingPayment = false; // Flag để tránh vòng lặp khi update payment

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
        loadPromotions();
        loadOrderInfoFromIntent(); // Load thông tin từ đơn hàng cũ (nếu có)
        loadUserProfileToForm();
    }

    private void initViews() {
        // Setup toolbar
        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
        }
        toolbar.setNavigationOnClickListener(v -> finish());
        
        radioGroupPayment = findViewById(R.id.radioGroupPayment);
        radioCash = findViewById(R.id.radioCash);
        radioVnPay = findViewById(R.id.radioVnPay);
        cardCash = findViewById(R.id.cardCash);
        cardVnPay = findViewById(R.id.cardVnPay);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvSubtotal = findViewById(R.id.tvSubtotal);
        tvShippingFee = findViewById(R.id.tvShippingFee);
        tvDiscountAmount = findViewById(R.id.tvDiscountAmount);
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
        // Click listener cho CardView - khi click vào card thì chọn RadioButton tương ứng
        // Và đảm bảo uncheck RadioButton kia
        cardCash.setOnClickListener(v -> {
            if (!radioCash.isChecked()) {
                isUpdatingPayment = true;
                radioCash.setChecked(true);
                radioVnPay.setChecked(false);
                selectedPaymentMethod = "cash_on_delivery";
                updatePaymentCardColors();
                isUpdatingPayment = false;
            }
        });
        
        cardVnPay.setOnClickListener(v -> {
            if (!radioVnPay.isChecked()) {
                isUpdatingPayment = true;
                radioVnPay.setChecked(true);
                radioCash.setChecked(false);
                selectedPaymentMethod = "vnpay";
                updatePaymentCardColors();
                isUpdatingPayment = false;
            }
        });
        
        // Listener cho RadioButton để cập nhật payment method khi thay đổi
        radioCash.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked && !isUpdatingPayment) {
                isUpdatingPayment = true;
                radioVnPay.setChecked(false);
                selectedPaymentMethod = "cash_on_delivery";
                updatePaymentCardColors();
                isUpdatingPayment = false;
            }
        });
        
        radioVnPay.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked && !isUpdatingPayment) {
                isUpdatingPayment = true;
                radioCash.setChecked(false);
                selectedPaymentMethod = "vnpay";
                updatePaymentCardColors();
                isUpdatingPayment = false;
            }
        });
        
        // Khởi tạo màu ban đầu
        updatePaymentCardColors();
        
        btnApplyPromotion.setOnClickListener(v -> applyPromotionCode());
        btnPlaceOrder.setOnClickListener(v -> placeOrder());
    }
    
    private void updatePaymentCardColors() {
        // Cập nhật màu nền của CardView dựa trên RadioButton nào được chọn
        if (radioCash.isChecked()) {
            cardCash.setCardBackgroundColor(getResources().getColor(R.color.colorPrimaryContainer, null));
            cardVnPay.setCardBackgroundColor(getResources().getColor(R.color.colorSecondaryContainer, null));
        } else if (radioVnPay.isChecked()) {
            cardCash.setCardBackgroundColor(getResources().getColor(R.color.colorSecondaryContainer, null));
            cardVnPay.setCardBackgroundColor(getResources().getColor(R.color.colorPrimaryContainer, null));
        }
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
        tvPromotionStatus.setVisibility(View.GONE);
        
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
                        tvPromotionStatus.setTextColor(getResources().getColor(R.color.colorPrimary, null));
                        tvPromotionStatus.setVisibility(View.VISIBLE);
                        
                        Toast.makeText(CheckoutActivity.this, "Áp dụng mã khuyến mãi thành công", Toast.LENGTH_SHORT).show();
                    } else {
                        String errorMsg = previewResponse.getError() != null ? previewResponse.getError() : "Mã khuyến mãi không hợp lệ";
                        tvPromotionStatus.setText(errorMsg);
                        tvPromotionStatus.setTextColor(getResources().getColor(android.R.color.holo_red_dark, null));
                        tvPromotionStatus.setVisibility(View.VISIBLE);
                        discountAmount = 0;
                        selectedPromotionCode = null;
                        totalAmount = subtotal + shippingFee;
                        updateTotalDisplay();
                    }
                } else {
                    tvPromotionStatus.setText("Mã khuyến mãi không hợp lệ hoặc đã hết hạn");
                    tvPromotionStatus.setTextColor(getResources().getColor(android.R.color.holo_red_dark, null));
                    tvPromotionStatus.setVisibility(View.VISIBLE);
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
                tvPromotionStatus.setTextColor(getResources().getColor(android.R.color.holo_red_dark, null));
                tvPromotionStatus.setVisibility(View.VISIBLE);
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

        // Backend supports: 'cash_on_delivery', 'bank_transfer', 'credit_card', 'vnpay'
        String paymentMethod = selectedPaymentMethod;

        isSubmitting = true;
        btnPlaceOrder.setEnabled(false);
        showProgress(true);

        // Get user profile for shipping info
        loadUserProfileAndPlaceOrder(authHeader, paymentMethod);
    }

    private void loadOrderInfoFromIntent() {
        // Nhận thông tin từ Intent (khi mua lại đơn hàng)
        Intent intent = getIntent();
        if (intent != null) {
            String fullName = intent.getStringExtra("fullName");
            String phoneNumber = intent.getStringExtra("phoneNumber");
            String shippingAddress = intent.getStringExtra("shippingAddress");
            String city = intent.getStringExtra("city");
            String postalCode = intent.getStringExtra("postalCode");
            
            // Điền thông tin vào form nếu có (ưu tiên thông tin từ Intent)
            if (fullName != null && !fullName.trim().isEmpty()) {
                edtFullName.setText(fullName);
            }
            if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
                edtPhone.setText(phoneNumber);
            }
            if (shippingAddress != null && !shippingAddress.trim().isEmpty()) {
                edtAddress.setText(shippingAddress);
            }
            if (city != null && !city.trim().isEmpty()) {
                edtCity.setText(city);
            }
            if (postalCode != null && !postalCode.trim().isEmpty()) {
                edtPostalCode.setText(postalCode);
            }
        }
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
        // Log payment method being sent
        String paymentMethod = (String) body.get("paymentMethod");
        Log.d(TAG, "Submitting order with paymentMethod: " + paymentMethod);
        Log.d(TAG, "Request body: " + body.toString());
        
        // Use raw response to handle VNPay paymentUrl
        Call<ResponseBody> call = apiService.createOrderApiRaw(authHeader, body);
        call.enqueue(new Callback<ResponseBody>() {
            @Override
            public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                isSubmitting = false;
                btnPlaceOrder.setEnabled(true);
                showProgress(false);
                
                if (response.isSuccessful() && response.body() != null) {
                    try {
                        String responseString = response.body().string();
                        Log.d(TAG, "Order response: " + responseString);
                        
                        Gson gson = new Gson();
                        JsonObject jsonObject = gson.fromJson(responseString, JsonObject.class);
                        
                        if (jsonObject.has("success") && jsonObject.get("success").getAsBoolean()) {
                            String message = jsonObject.has("message") ? jsonObject.get("message").getAsString() : "";
                            Log.d(TAG, "Order response message: " + message);
                            Log.d(TAG, "Has paymentUrl: " + jsonObject.has("paymentUrl"));
                            
                            // Log order details if available
                            if (jsonObject.has("order")) {
                                JsonObject orderObj = jsonObject.getAsJsonObject("order");
                                if (orderObj.has("paymentMethod")) {
                                    String orderPaymentMethod = orderObj.get("paymentMethod").getAsString();
                                    Log.d(TAG, "Order paymentMethod from response: " + orderPaymentMethod);
                                }
                            }
                            
                            // Check if this is a VNPay response (has paymentUrl)
                            if (jsonObject.has("paymentUrl")) {
                                // VNPay payment - open WebView
                                String paymentUrl = jsonObject.get("paymentUrl").getAsString();
                                String orderId = null;
                                if (jsonObject.has("order")) {
                                    JsonObject orderObj = jsonObject.getAsJsonObject("order");
                                    if (orderObj.has("id")) {
                                        orderId = orderObj.get("id").getAsString();
                                    } else if (orderObj.has("_id")) {
                                        orderId = orderObj.get("_id").getAsString();
                                    }
                                }
                                
                                Log.d(TAG, "VNPay payment URL received: " + paymentUrl);
                                Log.d(TAG, "Order ID: " + orderId);
                                openVnPayWebView(paymentUrl, orderId);
                            } else {
                                // Regular payment - completed immediately
                                Log.d(TAG, "No paymentUrl in response - processing regular payment");
                                Log.d(TAG, "Response message: " + message);
                                
                                Order order = null;
                                String orderId = null;
                                
                                // Try to extract order from response
                                if (jsonObject.has("order")) {
                                    try {
                                        JsonObject orderObj = jsonObject.getAsJsonObject("order");
                                        // Parse order directly from JsonObject
                                        order = gson.fromJson(orderObj, Order.class);
                                        
                                        // Get order ID
                                        if (orderObj.has("id")) {
                                            orderId = orderObj.get("id").getAsString();
                                        } else if (orderObj.has("_id")) {
                                            if (orderObj.get("_id").isJsonPrimitive()) {
                                                orderId = orderObj.get("_id").getAsString();
                                            } else if (orderObj.get("_id").isJsonObject()) {
                                                JsonObject idObj = orderObj.getAsJsonObject("_id");
                                                if (idObj.has("$oid")) {
                                                    orderId = idObj.get("$oid").getAsString();
                                                }
                                            }
                                        }
                                        
                                        Log.d(TAG, "Order parsed successfully, ID: " + orderId);
                                    } catch (Exception e) {
                                        Log.e(TAG, "Error parsing order object", e);
                                    }
                                }
                                
                                // Fallback: Try parsing as ApiResponse<Order>
                                if (order == null) {
                                    try {
                                        ApiResponse<Order> apiResponse = gson.fromJson(responseString, 
                                            new TypeToken<ApiResponse<Order>>(){}.getType());
                                        order = apiResponse.getOrder();
                                        if (order == null && apiResponse.getData() != null) {
                                            order = (Order) apiResponse.getData();
                                        }
                                        if (order != null && order.getId() != null) {
                                            orderId = order.getId();
                                        }
                                        Log.d(TAG, "Order parsed from ApiResponse, ID: " + orderId);
                                    } catch (Exception e) {
                                        Log.e(TAG, "Error parsing as ApiResponse<Order>", e);
                                    }
                                }
                                
                                // If we have order but no orderId yet, try to get it from order object
                                if (order != null && orderId == null && order.getId() != null) {
                                    orderId = order.getId();
                                }

                                if (order != null && orderId != null) {
                                    // Check if payment method is VNPay but no paymentUrl
                                    if ("vnpay".equals(order.getPaymentMethod())) {
                                        Log.e(TAG, "ERROR: Payment method is VNPay but no paymentUrl received!");
                                        Toast.makeText(CheckoutActivity.this, 
                                            "Lỗi: Không thể tạo URL thanh toán VNPay. Vui lòng thử lại hoặc liên hệ hỗ trợ.", 
                                            Toast.LENGTH_LONG).show();
                                    } else {
                                        Toast.makeText(CheckoutActivity.this, "Đặt hàng thành công", Toast.LENGTH_SHORT).show();
                                    }
                                    Intent intent = new Intent(CheckoutActivity.this, OrderDetailActivity.class);
                                    intent.putExtra("order_id", orderId);
                                    intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                    startActivity(intent);
                                    finish();
                                } else {
                                    Log.e(TAG, "Failed to extract order from response. Order: " + (order != null ? "not null" : "null") + ", OrderId: " + orderId);
                                    Log.e(TAG, "Full response: " + responseString);
                                    String errorMsg = jsonObject.has("error") 
                                        ? jsonObject.get("error").getAsString()
                                        : jsonObject.has("message")
                                        ? jsonObject.get("message").getAsString()
                                        : "Đặt hàng thất bại: Không thể xử lý phản hồi từ server";
                                    Toast.makeText(CheckoutActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                                }
                            }
                        } else {
                            String errorMsg = jsonObject.has("error") 
                                    ? jsonObject.get("error").getAsString()
                                    : jsonObject.has("message")
                                    ? jsonObject.get("message").getAsString()
                                    : "Đặt hàng thất bại";
                            Toast.makeText(CheckoutActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error parsing order response", e);
                        Toast.makeText(CheckoutActivity.this, "Lỗi xử lý phản hồi từ server", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                    String errorMsg = "Đặt hàng thất bại";
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
            public void onFailure(Call<ResponseBody> call, Throwable t) {
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

    private void openVnPayWebView(String paymentUrl, String orderId) {
        Intent intent = new Intent(this, VnPayWebViewActivity.class);
        intent.putExtra("paymentUrl", paymentUrl);
        intent.putExtra("orderId", orderId);
        intent.putExtra("isOrderPayment", true); // Flag để phân biệt với coin top-up
        startActivityForResult(intent, REQUEST_CODE_VNPAY);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == REQUEST_CODE_VNPAY) {
            if (resultCode == RESULT_OK) {
                // VNPay payment successful
                String orderId = data != null ? data.getStringExtra("orderId") : null;
                Toast.makeText(this, "Thanh toán VNPay thành công!", Toast.LENGTH_SHORT).show();
                
                // Navigate to order detail
                if (orderId != null && !orderId.isEmpty()) {
                    Intent intent = new Intent(this, OrderDetailActivity.class);
                    intent.putExtra("order_id", orderId);
                    intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(intent);
                } else {
                    // If no orderId, go to order history
                    startActivity(new Intent(this, OrderHistoryActivity.class));
                }
                finish();
            } else if (resultCode == RESULT_CANCELED) {
                // VNPay payment failed or cancelled
                if (data != null) {
                    String errorMsg = data.getStringExtra("errorMessage");
                    if (errorMsg != null) {
                        Toast.makeText(this, errorMsg, Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(this, "Thanh toán VNPay thất bại hoặc bị hủy", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        }
    }
}
