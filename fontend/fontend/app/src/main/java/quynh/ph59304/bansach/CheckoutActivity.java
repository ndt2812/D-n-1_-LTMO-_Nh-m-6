package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import com.google.android.material.textfield.TextInputEditText;

import java.util.HashMap;
import java.util.Map;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CartResponse;
import quynh.ph59304.bansach.models.Order;
import quynh.ph59304.bansach.models.User;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CheckoutActivity extends AppCompatActivity {
    private static final String TAG = "CheckoutActivity";
    private TextInputEditText edtFullName, edtPhone, edtAddress;
    private RadioGroup radioGroupPayment;
    private RadioButton radioCoin, radioCash;
    private TextView tvItemCount, tvSubtotal, tvShippingFee, tvTotalAmount, tvCoinBalance;
    private Button btnPlaceOrder;
    private ProgressBar progressBar;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private double subtotal = 0;
    private double shippingFee = 30000;
    private double totalAmount = 0;
    private int itemCount = 0;
    private double coinBalance = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_checkout);

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
        loadCart();
        loadUserProfile();
        setupPaymentMethod();
    }

    private void initViews() {
        edtFullName = findViewById(R.id.edtFullName);
        edtPhone = findViewById(R.id.edtPhone);
        edtAddress = findViewById(R.id.edtAddress);
        radioGroupPayment = findViewById(R.id.radioGroupPayment);
        radioCoin = findViewById(R.id.radioCoin);
        radioCash = findViewById(R.id.radioCash);
        tvItemCount = findViewById(R.id.tvItemCount);
        tvSubtotal = findViewById(R.id.tvSubtotal);
        tvShippingFee = findViewById(R.id.tvShippingFee);
        tvTotalAmount = findViewById(R.id.tvTotalAmount);
        tvCoinBalance = findViewById(R.id.tvCoinBalance);
        btnPlaceOrder = findViewById(R.id.btnPlaceOrder);
        progressBar = findViewById(R.id.progressBar);

        btnPlaceOrder.setOnClickListener(v -> placeOrder());
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

    private void setupPaymentMethod() {
        radioGroupPayment.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.radioCoin) {
                tvCoinBalance.setVisibility(View.VISIBLE);
            } else {
                tvCoinBalance.setVisibility(View.GONE);
            }
        });
    }

    private void loadCart() {
        showProgress(true);
        Call<ApiResponse<CartResponse>> call = apiService.getCart();
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
                    
                    if (cartResponse != null && cartResponse.getItems() != null) {
                        itemCount = cartResponse.getItems().size();
                        subtotal = cartResponse.getTotalAmount();
                        calculateTotal();
                        updateUI();
                    } else {
                        Toast.makeText(CheckoutActivity.this, "Giỏ hàng trống", Toast.LENGTH_SHORT).show();
                        finish();
                    }
                } else {
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

    private void loadUserProfile() {
        // Optional: Implement if backend exposes an API profile endpoint
    }

    private void calculateTotal() {
        totalAmount = subtotal + shippingFee;
    }

    private void updateUI() {
        tvItemCount.setText(itemCount + " sản phẩm");
        tvSubtotal.setText(String.format("%,.0f đ", subtotal));
        tvShippingFee.setText(String.format("%,.0f đ", shippingFee));
        tvTotalAmount.setText(String.format("%,.0f đ", totalAmount));
    }

    private void placeOrder() {
        String fullName = edtFullName.getText().toString().trim();
        String phone = edtPhone.getText().toString().trim();
        String address = edtAddress.getText().toString().trim();
        // Map to backend-supported values
        String paymentMethod = radioCash.isChecked() ? "cash_on_delivery" : "cash_on_delivery";

        // Validation
        if (fullName.isEmpty()) {
            edtFullName.setError("Vui lòng nhập họ và tên");
            edtFullName.requestFocus();
            return;
        }

        if (phone.isEmpty()) {
            edtPhone.setError("Vui lòng nhập số điện thoại");
            edtPhone.requestFocus();
            return;
        }

        if (address.isEmpty()) {
            edtAddress.setError("Vui lòng nhập địa chỉ giao hàng");
            edtAddress.requestFocus();
            return;
        }

        showProgress(true);
        Map<String, Object> body = new HashMap<>();
        body.put("fullName", fullName);
        body.put("address", address);
        body.put("city", "");
        body.put("postalCode", "");
        body.put("phone", phone);
        body.put("paymentMethod", paymentMethod);
        body.put("notes", "");

        Call<ApiResponse<Order>> call = apiService.createOrder(body);
        call.enqueue(new Callback<ApiResponse<Order>>() {
            @Override
            public void onResponse(Call<ApiResponse<Order>> call, Response<ApiResponse<Order>> response) {
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
                    String errorMsg = "Đặt hàng thất bại";
                    if (response.body() != null && response.body().getError() != null) {
                        errorMsg = response.body().getError();
                    }
                    Toast.makeText(CheckoutActivity.this, errorMsg, Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Order>> call, Throwable t) {
                showProgress(false);
                Log.e(TAG, "Place order error: " + t.getMessage(), t);
                Toast.makeText(CheckoutActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        btnPlaceOrder.setEnabled(!show);
    }
}


