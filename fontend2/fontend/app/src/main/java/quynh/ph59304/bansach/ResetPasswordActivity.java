package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
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

public class ResetPasswordActivity extends AppCompatActivity {
    private EditText edtPassword, edtConfirmPassword;
    private Button btnReset;
    private TextView tvError, tvEmail;
    private ProgressBar progressBar;
    private ApiService apiService;
    private String email;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reset_password);

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
        edtPassword = findViewById(R.id.edtPassword);
        edtConfirmPassword = findViewById(R.id.edtConfirmPassword);
        btnReset = findViewById(R.id.btnReset);
        tvError = findViewById(R.id.tvError);
        tvEmail = findViewById(R.id.tvEmail);
        progressBar = findViewById(R.id.progressBar);

        if (tvEmail != null) {
            tvEmail.setText("Email/Username: " + email);
        }
    }

    private void setupClickListeners() {
        btnReset.setOnClickListener(v -> performResetPassword());
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

        hideError();
        showProgress(true);

        Map<String, String> body = new HashMap<>();
        body.put("email", email);
        body.put("newPassword", password);

        Call<ApiResponse<Void>> call = apiService.resetPassword(body);

        call.enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Void> apiResponse = response.body();
                    if (apiResponse.getSuccess() != null && apiResponse.getSuccess()) {
                        // Đặt lại mật khẩu thành công
                        Toast.makeText(ResetPasswordActivity.this, 
                            "Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.", 
                            Toast.LENGTH_LONG).show();
                        Intent intent = new Intent(ResetPasswordActivity.this, LoginActivity.class);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(intent);
                        finish();
                    } else {
                        String errorMsg = apiResponse.getError() != null 
                            ? apiResponse.getError() 
                            : "Không thể đặt lại mật khẩu";
                        showError(errorMsg);
                    }
                } else {
                    String errorMsg = "Không thể đặt lại mật khẩu";
                    if (response.body() != null && response.body().getError() != null) {
                        errorMsg = response.body().getError();
                    }
                    showError(errorMsg);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                showProgress(false);
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
        btnReset.setEnabled(!show);
    }
}

