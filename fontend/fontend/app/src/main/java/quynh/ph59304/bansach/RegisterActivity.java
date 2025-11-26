package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.User;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {
    private EditText edtFirstName, edtLastName, edtEmail, edtPassword;
    private Button btnRegister;
    private TextView tvError, tvGoToLogin;
    private ProgressBar progressBar;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        initViews();
        setupClickListeners();
    }

    private void initViews() {
        edtFirstName = findViewById(R.id.edtFirstName);
        edtLastName = findViewById(R.id.edtLastName);
        edtEmail = findViewById(R.id.edtEmail);
        edtPassword = findViewById(R.id.edtPassword);
        btnRegister = findViewById(R.id.btnRegister);
        tvGoToLogin = findViewById(R.id.tvGoToLogin);
        tvError = findViewById(R.id.tvError);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupClickListeners() {
        btnRegister.setOnClickListener(v -> performRegister());
        if (tvGoToLogin != null) {
            tvGoToLogin.setOnClickListener(v -> {
                startActivity(new Intent(RegisterActivity.this, LoginActivity.class));
                finish();
            });
        }
    }

    private void performRegister() {
        String firstName = edtFirstName.getText().toString().trim();
        String lastName = edtLastName.getText().toString().trim();
        String email = edtEmail.getText().toString().trim();
        String password = edtPassword.getText().toString().trim();

        if (firstName.isEmpty()) {
            showError("Vui lòng nhập First name");
            return;
        }

        if (lastName.isEmpty()) {
            showError("Vui lòng nhập Last name");
            return;
        }

        if (email.isEmpty()) {
            showError("Vui lòng nhập e-mail");
            return;
        }

        if (password.isEmpty()) {
            showError("Vui lòng nhập mật khẩu");
            return;
        }

        if (password.length() < 6) {
            showError("Mật khẩu phải có ít nhất 6 ký tự");
            return;
        }

        hideError();
        showProgress(true);

        // Tạm dùng email làm username để tương thích API hiện tại
        User user = new User(email, password);
        Call<ApiResponse<User>> call = apiService.register(user);

        call.enqueue(new Callback<ApiResponse<User>>() {
            @Override
            public void onResponse(Call<ApiResponse<User>> call, Response<ApiResponse<User>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<User> apiResponse = response.body();
                    if (apiResponse.getToken() != null && apiResponse.getUser() != null) {
                        // Lưu token và thông tin user
                        prefManager.saveToken(apiResponse.getToken());
                        User user = apiResponse.getUser();
                        prefManager.saveUserInfo(
                                user.getId(),
                                user.getUsername(),
                                user.getRole(),
                                user.getAvatar() != null ? user.getAvatar() : ""
                        );

                        // Chuyển đến BookListActivity
                        android.widget.Toast.makeText(RegisterActivity.this, "Đăng ký thành công!", android.widget.Toast.LENGTH_SHORT).show();
                        startActivity(new Intent(RegisterActivity.this, BookListActivity.class));
                        finish();
                    } else {
                        showError("Đăng ký thất bại. Vui lòng thử lại.");
                    }
                } else {
                    String errorMsg = "Đăng ký thất bại";
                    if (response.body() != null && response.body().getError() != null) {
                        errorMsg = response.body().getError();
                    } else if (response.code() == 400) {
                        errorMsg = "Tên đăng nhập đã tồn tại";
                    }
                    showError(errorMsg);
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<User>> call, Throwable t) {
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
        btnRegister.setEnabled(!show);
    }
}
