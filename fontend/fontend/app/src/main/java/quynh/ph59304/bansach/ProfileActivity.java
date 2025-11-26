package quynh.ph59304.bansach;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.bumptech.glide.Glide;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.User;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileActivity extends AppCompatActivity {
    private static final int REQUEST_CODE_PERMISSION = 100;
    private ImageView imgAvatar;
    private TextView tvUsername, tvRole, tvRoleDetail;
    private com.google.android.material.textfield.TextInputEditText edtUsername;
    private Button btnLogout, btnChangeAvatar, btnOrders;
    private ProgressBar progressBar;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private ActivityResultLauncher<Intent> imagePickerLauncher;
    private Uri selectedImageUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_profile);

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
        setupImagePicker();
        loadProfile();
        setupLogout();
        setupChangeAvatar();
        setupOrders();
    }

    private void initViews() {
        imgAvatar = findViewById(R.id.imgAvatar);
        tvUsername = findViewById(R.id.tvUsername);
        tvRole = findViewById(R.id.tvRole);
        tvRoleDetail = findViewById(R.id.tvRoleDetail);
        edtUsername = findViewById(R.id.edtUsername);
        btnLogout = findViewById(R.id.btnLogout);
        btnChangeAvatar = findViewById(R.id.btnChangeAvatar);
        btnOrders = findViewById(R.id.btnOrders);
        progressBar = findViewById(R.id.progressBar);
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

    private void loadProfile() {
        String token = prefManager.getToken();
        if (token == null) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn", Toast.LENGTH_SHORT).show();
            prefManager.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        showProgress(true);
        Call<ApiResponse<User>> call = apiService.getProfile("Bearer " + token);
        call.enqueue(new Callback<ApiResponse<User>>() {
            @Override
            public void onResponse(Call<ApiResponse<User>> call, Response<ApiResponse<User>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null) {
                    User user = response.body().getUser();
                    if (user != null) {
                        displayUser(user);
                    } else {
                        // Fallback to cached data
                        displayCachedUser();
                    }
                } else {
                    // Fallback to cached data
                    displayCachedUser();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<User>> call, Throwable t) {
                showProgress(false);
                // Fallback to cached data
                displayCachedUser();
            }
        });
    }

    private void displayUser(User user) {
        tvUsername.setText(user.getUsername());
        edtUsername.setText(user.getUsername());
        
        String role = user.getRole();
        if (role != null) {
            if (role.equals("admin")) {
                tvRole.setText("Quản trị viên");
                tvRoleDetail.setText("Quản trị viên");
            } else {
                tvRole.setText("Khách hàng");
                tvRoleDetail.setText("Khách hàng");
            }
        }

        // Load avatar
        String avatarUrl = user.getAvatar();
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            if (!avatarUrl.startsWith("http")) {
                avatarUrl = "http://10.0.2.2:3000" + avatarUrl;
            }
            Glide.with(this)
                    .load(avatarUrl)
                    .placeholder(R.drawable.ic_launcher_background)
                    .error(R.drawable.ic_launcher_background)
                    .circleCrop()
                    .into(imgAvatar);
        }

        // Update cached data
        prefManager.saveUserInfo(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.getAvatar() != null ? user.getAvatar() : ""
        );
    }

    private void displayCachedUser() {
        String username = prefManager.getUsername();
        String role = prefManager.getRole();
        String avatar = prefManager.getAvatar();

        if (username != null) {
            tvUsername.setText(username);
            edtUsername.setText(username);
        }

        if (role != null) {
            if (role.equals("admin")) {
                tvRole.setText("Quản trị viên");
                tvRoleDetail.setText("Quản trị viên");
            } else {
                tvRole.setText("Khách hàng");
                tvRoleDetail.setText("Khách hàng");
            }
        }

        if (avatar != null && !avatar.isEmpty()) {
            String avatarUrl = avatar;
            if (!avatarUrl.startsWith("http")) {
                avatarUrl = "http://10.0.2.2:3000" + avatarUrl;
            }
            Glide.with(this)
                    .load(avatarUrl)
                    .placeholder(R.drawable.ic_launcher_background)
                    .error(R.drawable.ic_launcher_background)
                    .circleCrop()
                    .into(imgAvatar);
        }
    }

    private void setupLogout() {
        btnLogout.setOnClickListener(v -> {
            prefManager.clear();
            Toast.makeText(this, "Đã đăng xuất", Toast.LENGTH_SHORT).show();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });
    }

    private void setupOrders() {
        btnOrders.setOnClickListener(v -> {
            startActivity(new Intent(this, OrderHistoryActivity.class));
        });
    }

    private void setupImagePicker() {
        imagePickerLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                new ActivityResultCallback<ActivityResult>() {
                    @Override
                    public void onActivityResult(ActivityResult result) {
                        if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                            selectedImageUri = result.getData().getData();
                            if (selectedImageUri != null) {
                                // Hiển thị ảnh đã chọn
                                Glide.with(ProfileActivity.this)
                                        .load(selectedImageUri)
                                        .placeholder(R.drawable.ic_launcher_background)
                                        .error(R.drawable.ic_launcher_background)
                                        .circleCrop()
                                        .into(imgAvatar);
                                
                                // Upload ảnh lên server
                                uploadAvatar(selectedImageUri);
                            }
                        }
                    }
                }
        );
    }

    private void setupChangeAvatar() {
        btnChangeAvatar.setOnClickListener(v -> {
            if (checkPermissions()) {
                openImagePicker();
            } else {
                requestPermissions();
            }
        });

        imgAvatar.setOnClickListener(v -> {
            if (checkPermissions()) {
                openImagePicker();
            } else {
                requestPermissions();
            }
        });
    }

    private boolean checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ (API 33+)
            return ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES)
                    == PackageManager.PERMISSION_GRANTED;
        } else {
            // Android 12 và thấp hơn
            return ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                    == PackageManager.PERMISSION_GRANTED;
        }
    }

    private void requestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.READ_MEDIA_IMAGES},
                    REQUEST_CODE_PERMISSION);
        } else {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.READ_EXTERNAL_STORAGE},
                    REQUEST_CODE_PERMISSION);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CODE_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                openImagePicker();
            } else {
                Toast.makeText(this, "Cần quyền truy cập ảnh để đổi ảnh đại diện", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void openImagePicker() {
        Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
        imagePickerLauncher.launch(intent);
    }

    private void uploadAvatar(Uri imageUri) {
        String token = prefManager.getToken();
        if (token == null) {
            Toast.makeText(this, "Phiên đăng nhập đã hết hạn", Toast.LENGTH_SHORT).show();
            prefManager.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        showProgress(true);
        
        File tempFile = null;
        try {
            // Đọc file từ URI
            InputStream inputStream = getContentResolver().openInputStream(imageUri);
            if (inputStream == null) {
                showProgress(false);
                Toast.makeText(this, "Không thể đọc ảnh", Toast.LENGTH_SHORT).show();
                return;
            }

            // Tạo file tạm
            tempFile = File.createTempFile("avatar", ".jpg", getCacheDir());
            FileOutputStream outputStream = new FileOutputStream(tempFile);
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }
            outputStream.close();
            inputStream.close();

            // Tạo RequestBody từ file
            RequestBody requestFile = RequestBody.create(
                    MediaType.parse("image/*"),
                    tempFile
            );

            // Tạo MultipartBody.Part với field name "myImage" (theo backend)
            MultipartBody.Part imagePart = MultipartBody.Part.createFormData("myImage", tempFile.getName(), requestFile);

            // Gọi API upload - sử dụng ResponseBody để đọc raw response trước
            final File finalTempFile = tempFile;
            Call<ResponseBody> call = apiService.uploadAvatarApiRaw("Bearer " + token, imagePart);
            call.enqueue(new retrofit2.Callback<ResponseBody>() {
                @Override
                public void onResponse(Call<ResponseBody> call, Response<ResponseBody> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        try {
                            // Đọc raw response
                            String responseString = response.body().string();
                            android.util.Log.d("UploadAvatar", "Raw response: " + responseString);
                            
                            // Kiểm tra xem có phải JSON không
                            if (responseString.trim().startsWith("{") || responseString.trim().startsWith("[")) {
                                // Parse JSON
                                com.google.gson.Gson gson = new com.google.gson.Gson();
                                ApiResponse apiResponse = gson.fromJson(responseString, ApiResponse.class);
                                
                                if (apiResponse != null && apiResponse.getUser() != null) {
                                    // Thành công - xóa file tạm
                                    if (finalTempFile != null && finalTempFile.exists()) {
                                        finalTempFile.delete();
                                    }
                                    showProgress(false);
                                    Toast.makeText(ProfileActivity.this, "Đổi ảnh đại diện thành công", Toast.LENGTH_SHORT).show();
                                    displayUser(apiResponse.getUser());
                                    // Reload profile để đảm bảo có data mới nhất từ server
                                    loadProfile();
                                    return;
                                }
                            }
                            
                            // Nếu không phải JSON hoặc không có user, thử reload profile
                            android.util.Log.w("UploadAvatar", "Response không phải JSON hợp lệ hoặc không có user data");
                            if (finalTempFile != null && finalTempFile.exists()) {
                                finalTempFile.delete();
                            }
                            showProgress(false);
                            // Có thể upload thành công nhưng response không đúng format
                            loadProfile();
                            Toast.makeText(ProfileActivity.this, "Đã upload ảnh, đang tải lại...", Toast.LENGTH_SHORT).show();
                            
                        } catch (Exception e) {
                            android.util.Log.e("UploadAvatar", "Error parsing response", e);
                            // Thử endpoint web nếu parse lỗi
                            tryFallbackUpload(finalTempFile, imagePart, token);
                        }
                    } else {
                        // Log error để debug
                        if (response.errorBody() != null) {
                            try {
                                String errorBody = response.errorBody().string();
                                android.util.Log.e("UploadAvatar", "API Error: " + errorBody + ", Code: " + response.code());
                            } catch (IOException e) {
                                android.util.Log.e("UploadAvatar", "Error reading response", e);
                            }
                        }
                        android.util.Log.e("UploadAvatar", "API failed, trying web endpoint");
                        // Thử endpoint web nếu API không thành công
                        tryFallbackUpload(finalTempFile, imagePart, token);
                    }
                }

                @Override
                public void onFailure(Call<ResponseBody> call, Throwable t) {
                    android.util.Log.e("UploadAvatar", "API upload failed", t);
                    android.util.Log.e("UploadAvatar", "Error message: " + t.getMessage());
                    if (t.getCause() != null) {
                        android.util.Log.e("UploadAvatar", "Cause: " + t.getCause().getMessage());
                    }
                    // Thử endpoint web nếu API thất bại
                    tryFallbackUpload(finalTempFile, imagePart, token);
                }
            });

        } catch (IOException e) {
            showProgress(false);
            Toast.makeText(this, "Lỗi xử lý ảnh: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            // Xóa file tạm nếu có lỗi
            if (tempFile != null && tempFile.exists()) {
                tempFile.delete();
            }
        }
    }

    private void tryFallbackUpload(File tempFile, MultipartBody.Part imagePart, String token) {
        // Thử endpoint web (session-based)
        android.util.Log.d("UploadAvatar", "Trying web endpoint");
        Call<ApiResponse<User>> webCall = apiService.uploadAvatar("Bearer " + token, imagePart);
        webCall.enqueue(new Callback<ApiResponse<User>>() {
            @Override
            public void onResponse(Call<ApiResponse<User>> call, Response<ApiResponse<User>> response) {
                // Xóa file tạm sau khi hoàn thành (thành công hoặc thất bại)
                if (tempFile != null && tempFile.exists()) {
                    tempFile.delete();
                }
                
                showProgress(false);
                
                if (response.isSuccessful() && response.body() != null) {
                    User user = response.body().getUser();
                    if (user != null) {
                        Toast.makeText(ProfileActivity.this, "Đổi ảnh đại diện thành công", Toast.LENGTH_SHORT).show();
                        displayUser(user);
                        loadProfile();
                    } else {
                        // Reload profile để lấy data mới
                        loadProfile();
                        Toast.makeText(ProfileActivity.this, "Đã upload ảnh, đang tải lại...", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    // Log error
                    String errorMessage = "Cập nhật ảnh thất bại";
                    if (response.errorBody() != null) {
                        try {
                            String errorBody = response.errorBody().string();
                            android.util.Log.e("UploadAvatar", "Web Error: " + errorBody + ", Code: " + response.code());
                            errorMessage = "Lỗi: " + response.code();
                        } catch (IOException e) {
                            android.util.Log.e("UploadAvatar", "Error reading response", e);
                        }
                    }
                    Toast.makeText(ProfileActivity.this, errorMessage, Toast.LENGTH_SHORT).show();
                    // Vẫn thử reload profile
                    loadProfile();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<User>> call, Throwable t) {
                // Xóa file tạm sau khi thất bại
                if (tempFile != null && tempFile.exists()) {
                    tempFile.delete();
                }
                showProgress(false);
                android.util.Log.e("UploadAvatar", "Web upload failed", t);
                android.util.Log.e("UploadAvatar", "Error message: " + t.getMessage());
                if (t.getCause() != null) {
                    android.util.Log.e("UploadAvatar", "Cause: " + t.getCause().getMessage());
                }
                
                // Hiển thị thông báo lỗi thân thiện hơn
                String errorMsg = "Không thể upload ảnh";
                if (t.getMessage() != null && t.getMessage().contains("JsonReader")) {
                    errorMsg = "Server trả về dữ liệu không hợp lệ. Vui lòng kiểm tra endpoint.";
                } else if (t.getMessage() != null) {
                    errorMsg = "Lỗi: " + t.getMessage();
                }
                Toast.makeText(ProfileActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                // Vẫn thử reload profile
                loadProfile();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
    }
}
