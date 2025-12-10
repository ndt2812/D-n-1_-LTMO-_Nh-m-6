package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import java.util.HashMap;
import java.util.Map;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChangePasswordActivity extends AppCompatActivity {
    private LinearLayout stepSendCode, stepVerifyCode, stepResetPassword;
    private EditText edtCode, edtPassword, edtConfirmPassword;
    private Button btnSendCode, btnVerify, btnReset;
    private TextView tvResendCode;
    private TextView tvError;
    private ProgressBar progressBar;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private String resetToken;
    private int currentStep = 1; // 1: send code, 2: verify code, 3: reset password

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_change_password);

        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupClickListeners();
        
        // Tự động gửi mã khi mở activity
        performSendCode();
    }

    private void initViews() {
        stepSendCode = findViewById(R.id.stepSendCode);
        stepVerifyCode = findViewById(R.id.stepVerifyCode);
        stepResetPassword = findViewById(R.id.stepResetPassword);
        
        edtCode = findViewById(R.id.edtCode);
        edtPassword = findViewById(R.id.edtPassword);
        edtConfirmPassword = findViewById(R.id.edtConfirmPassword);
        
        btnSendCode = findViewById(R.id.btnSendCode);
        btnVerify = findViewById(R.id.btnVerify);
        btnReset = findViewById(R.id.btnReset);
        tvResendCode = findViewById(R.id.tvResendCode);
        
        tvError = findViewById(R.id.tvError);
        progressBar = findViewById(R.id.progressBar);

        // Giới hạn chỉ nhập 6 chữ số cho mã xác nhận
        edtCode.setInputType(InputType.TYPE_CLASS_NUMBER);
        edtCode.setFilters(new InputFilter[] { new InputFilter.LengthFilter(6) });
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

    private void setupClickListeners() {
        btnSendCode.setOnClickListener(v -> performSendCode());
        btnVerify.setOnClickListener(v -> performVerifyCode());
        btnReset.setOnClickListener(v -> performResetPassword());
        if (tvResendCode != null) {
            tvResendCode.setOnClickListener(v -> performSendCode());
        }
    }

    private void showStep(int step) {
        stepSendCode.setVisibility(step == 1 ? View.VISIBLE : View.GONE);
        stepVerifyCode.setVisibility(step == 2 ? View.VISIBLE : View.GONE);
        stepResetPassword.setVisibility(step == 3 ? View.VISIBLE : View.GONE);
        currentStep = step;
        hideError();
    }

    private void performSendCode() {
        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        hideError();
        showProgress(true);
        btnSendCode.setEnabled(false);

        Call<ApiResponse<Void>> call = apiService.sendChangePasswordCode(authHeader);
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                showProgress(false);
                btnSendCode.setEnabled(true);
                
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Void> apiResponse = response.body();
                    if (apiResponse.getSuccess() != null && apiResponse.getSuccess()) {
                        Toast.makeText(ChangePasswordActivity.this, 
                            "Mã xác nhận đã được gửi đến email của bạn", 
                            Toast.LENGTH_LONG).show();
                        showStep(2);
                    } else {
                        String errorMsg = apiResponse.getError() != null 
                            ? apiResponse.getError() 
                            : "Không thể gửi mã xác nhận";
                        showError(errorMsg);
                    }
                } else {
                    String errorMsg = "Không thể gửi mã xác nhận";
                    if (response.body() != null && response.body().getError() != null) {
                        errorMsg = response.body().getError();
                    }
                    showError(errorMsg);
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                showProgress(false);
                btnSendCode.setEnabled(true);
                showError("Lỗi kết nối: " + t.getMessage());
            }
        });
    }

    private void performVerifyCode() {
        String code = edtCode.getText().toString().trim();

        if (code.isEmpty()) {
            showError("Vui lòng nhập mã xác nhận");
            return;
        }

        if (code.length() != 6) {
            showError("Mã xác nhận phải có 6 chữ số");
            return;
        }

        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        hideError();
        showProgress(true);
        btnVerify.setEnabled(false);

        Map<String, String> body = new HashMap<>();
        body.put("code", code);

        Call<ApiResponse<Map<String, String>>> call = apiService.verifyChangePasswordCode(authHeader, body);
        call.enqueue(new Callback<ApiResponse<Map<String, String>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, String>>> call, Response<ApiResponse<Map<String, String>>> response) {
                showProgress(false);
                btnVerify.setEnabled(true);
                
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Map<String, String>> apiResponse = response.body();
                    if (apiResponse.getSuccess() != null && apiResponse.getSuccess()) {
                        // Lưu resetToken nếu có
                        if (apiResponse.getData() != null && apiResponse.getData().containsKey("resetToken")) {
                            resetToken = apiResponse.getData().get("resetToken");
                        }
                        Toast.makeText(ChangePasswordActivity.this, 
                            "Mã xác nhận hợp lệ!", 
                            Toast.LENGTH_SHORT).show();
                        showStep(3);
                    } else {
                        String errorMsg = apiResponse.getError() != null 
                            ? apiResponse.getError() 
                            : "Mã xác nhận không đúng";
                        showError(errorMsg);
                    }
                } else {
                    String errorMsg = "Mã xác nhận không đúng";
                    if (response.body() != null && response.body().getError() != null) {
                        errorMsg = response.body().getError();
                    }
                    showError(errorMsg);
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, String>>> call, Throwable t) {
                showProgress(false);
                btnVerify.setEnabled(true);
                showError("Lỗi kết nối: " + t.getMessage());
            }
        });
    }

    private void performResetPassword() {
        String password = edtPassword.getText().toString().trim();
        String confirmPassword = edtConfirmPassword.getText().toString().trim();

        if (password.isEmpty()) {
            showError("Vui lòng nhập mật khẩu mới");
            return;
        }

        if (password.length() < 6) {
            showError("Mật khẩu phải có ít nhất 6 ký tự");
            return;
        }

        if (!password.equals(confirmPassword)) {
            showError("Mật khẩu không khớp");
            return;
        }

        String authHeader = getAuthHeaderOrRedirect();
        if (authHeader == null) {
            return;
        }

        hideError();
        showProgress(true);
        btnReset.setEnabled(false);

        Map<String, String> body = new HashMap<>();
        body.put("newPassword", password);

        Call<ApiResponse<Void>> call = apiService.changePassword(authHeader, body);
        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                showProgress(false);
                btnReset.setEnabled(true);
                
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Void> apiResponse = response.body();
                    if (apiResponse.getSuccess() != null && apiResponse.getSuccess()) {
                        Toast.makeText(ChangePasswordActivity.this, 
                            "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.", 
                            Toast.LENGTH_LONG).show();
                        // Đăng xuất và chuyển đến màn hình đăng nhập
                        prefManager.clear();
                        Intent intent = new Intent(ChangePasswordActivity.this, LoginActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                        finish();
                    } else {
                        String errorMsg = apiResponse.getError() != null 
                            ? apiResponse.getError() 
                            : "Không thể đổi mật khẩu";
                        showError(errorMsg);
                    }
                } else {
                    String errorMsg = "Không thể đổi mật khẩu";
                    if (response.body() != null && response.body().getError() != null) {
                        errorMsg = response.body().getError();
                    }
                    showError(errorMsg);
                    if (handleUnauthorized(response.code())) {
                        return;
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                showProgress(false);
                btnReset.setEnabled(true);
                showError("Lỗi kết nối: " + t.getMessage());
            }
        });
    }

    private void showError(String message) {
        tvError.setText(message);
        tvError.setVisibility(View.VISIBLE);
    }

    private void hideError() {
        tvError.setVisibility(View.GONE);
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
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

    @Override
    public void onBackPressed() {
        if (currentStep == 2) {
            showStep(1);
        } else if (currentStep == 3) {
            showStep(2);
        } else {
            super.onBackPressed();
        }
    }
}

