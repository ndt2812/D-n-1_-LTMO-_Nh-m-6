package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.util.HashMap;
import java.util.Map;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class VerifyCodeActivity extends AppCompatActivity {
    private EditText edtCode;
    private Button btnVerify;
    private TextView tvError, tvEmail, tvResendCode;
    private ProgressBar progressBar;
    private ApiService apiService;
    private String email;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_verify_code);

        apiService = RetrofitClient.getInstance().getApiService();
        email = getIntent().getStringExtra("email");

        if (email == null || email.isEmpty()) {
            Toast.makeText(this, "Email không hợp lệ", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initViews();
        setupClickListeners();
    }

    private void initViews() {
        edtCode = findViewById(R.id.edtCode);
        btnVerify = findViewById(R.id.btnVerify);
        tvError = findViewById(R.id.tvError);
        tvEmail = findViewById(R.id.tvEmail);
        tvResendCode = findViewById(R.id.tvResendCode);
        progressBar = findViewById(R.id.progressBar);

        // Giới hạn chỉ nhập 6 chữ số
        edtCode.setInputType(InputType.TYPE_CLASS_NUMBER);
        edtCode.setFilters(new InputFilter[] { new InputFilter.LengthFilter(6) });
        
        if (tvEmail != null) {
            tvEmail.setText("Email/Username: " + email);
        }
    }

    private void setupClickListeners() {
        btnVerify.setOnClickListener(v -> performVerifyCode());
        if (tvResendCode != null) {
            tvResendCode.setOnClickListener(v -> resendCode());
        }
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

        hideError();
        showProgress(true);

        Map<String, String> body = new HashMap<>();
        body.put("email", email);
        body.put("code", code);

        Call<ApiResponse<Map<String, String>>> call = apiService.verifyResetCode(body);

        call.enqueue(new Callback<ApiResponse<Map<String, String>>>() {
            @Override
            public void onResponse(Call<ApiResponse<Map<String, String>>> call, Response<ApiResponse<Map<String, String>>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Map<String, String>> apiResponse = response.body();
                    if (apiResponse.getSuccess() != null && apiResponse.getSuccess()) {
                        // Mã hợp lệ - chuyển đến ResetPasswordActivity
                        Toast.makeText(VerifyCodeActivity.this, 
                            "Mã xác nhận hợp lệ!", 
                            Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(VerifyCodeActivity.this, ResetPasswordActivity.class);
                        intent.putExtra("email", email);
                        startActivity(intent);
                        finish();
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
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Map<String, String>>> call, Throwable t) {
                showProgress(false);
                showError("Lỗi kết nối: " + t.getMessage());
            }
        });
    }

    private void resendCode() {
        // Quay lại ForgotPasswordActivity để gửi lại mã
        Intent intent = new Intent(VerifyCodeActivity.this, ForgotPasswordActivity.class);
        intent.putExtra("email", email);
        startActivity(intent);
        finish();
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
        btnVerify.setEnabled(!show);
    }
}

