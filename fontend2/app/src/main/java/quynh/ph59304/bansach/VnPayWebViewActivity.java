package quynh.ph59304.bansach;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import android.net.Uri;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.IOException;

import quynh.ph59304.bansach.api.ApiConfig;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.CoinBalanceResponse;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Activity để hiển thị WebView cho thanh toán VNPay
 * Xử lý callback từ VNPay và redirect về ứng dụng
 */
public class VnPayWebViewActivity extends AppCompatActivity {
    private static final String TAG = "VnPayWebView";
    private WebView webView;
    private ProgressBar progressBar;
    private String paymentUrl;
    private String returnUrl;
    private String orderId;
    private boolean isOrderPayment;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vnpay_webview);

        // Get payment URL from intent
        paymentUrl = getIntent().getStringExtra("paymentUrl");
        if (paymentUrl == null || paymentUrl.trim().isEmpty()) {
            Toast.makeText(this, "Không tìm thấy URL thanh toán", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // Get order ID and payment type
        orderId = getIntent().getStringExtra("orderId");
        isOrderPayment = getIntent().getBooleanExtra("isOrderPayment", false);

        // Build return URL - backend will handle the callback
        if (isOrderPayment) {
            returnUrl = ApiConfig.getBaseUrl() + "orders/vnpay-return";
        } else {
            returnUrl = ApiConfig.getBaseUrl() + "coins/vnpay-return";
        }

        // Initialize API service
        apiService = RetrofitClient.getInstance().getApiService();
        prefManager = new SharedPreferencesManager(this);

        initViews();
        setupWebView();
        loadPaymentUrl();
    }

    private void initViews() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle("Thanh toán VNPay");
        }
        toolbar.setNavigationOnClickListener(v -> finish());

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setLoadWithOverviewMode(true);
        webView.getSettings().setUseWideViewPort(true);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.getSettings().setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                progressBar.setVisibility(View.VISIBLE);
                
                // Check if this is the return URL from VNPay (backend will redirect here)
                if (url != null && (url.contains("vnpay-return") || url.contains("vnp_ResponseCode"))) {
                    Log.d(TAG, "VNPay return URL detected: " + url);
                    // Extract parameters from URL before backend processes it
                    handleVnPayReturn(url);
                }
                
                // Also check for order vnpay-return
                if (url != null && url.contains("orders/vnpay-return")) {
                    Log.d(TAG, "VNPay order return URL detected: " + url);
                    handleVnPayReturn(url);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                
                // Check if this is the return URL after page finishes loading
                // Backend may redirect to payment-success page after processing
                if (url != null && (url.contains("vnpay-return") || url.contains("vnp_ResponseCode") || 
                    url.contains("payment-success") || url.contains("payment-failed"))) {
                    Log.d(TAG, "Page finished loading return URL: " + url);
                    
                    // If it's payment-success page, backend has already processed
                    if (url.contains("payment-success")) {
                        Log.d(TAG, "Payment success page detected, closing WebView");
                        // Extract response code if available, otherwise assume success
                        String responseCode = extractQueryParameter(url, "vnp_ResponseCode");
                        if (responseCode == null) {
                            responseCode = "00"; // Assume success if on success page
                        }
                        String txnRef = extractQueryParameter(url, "txn");
                        handleVnPayReturn(url);
                    } else if (url.contains("vnp_ResponseCode")) {
                        // Direct callback URL with response code
                        handleVnPayReturn(url);
                    }
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                progressBar.setVisibility(View.GONE);
                if (request.isForMainFrame()) {
                    Toast.makeText(VnPayWebViewActivity.this, 
                        "Lỗi tải trang: " + error.getDescription(), 
                        Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                
                // Check if this is VNPay return URL (backend endpoint)
                if (url.contains("vnpay-return") || url.contains("vnp_ResponseCode") || 
                    url.contains("orders/vnpay-return") || url.contains("coins/vnpay-return")) {
                    Log.d(TAG, "Intercepting VNPay return URL: " + url);
                    // Call backend API directly with proper headers to get JSON response
                    callVnPayCallbackApi(url);
                    // Don't load the page in WebView, we'll handle it via API
                    return true;
                }
                
                // Allow normal navigation for other URLs
                return false;
            }
        });
    }

    private void loadPaymentUrl() {
        Log.d(TAG, "Loading payment URL: " + paymentUrl);
        webView.loadUrl(paymentUrl);
    }
    
    private void callVnPayCallbackApi(String callbackUrl) {
        Log.d(TAG, "Calling VNPay callback API: " + callbackUrl);
        
        // Extract query parameters from URL
        Uri uri = Uri.parse(callbackUrl);
        String responseCode = uri.getQueryParameter("vnp_ResponseCode");
        String txnRef = uri.getQueryParameter("vnp_TxnRef");
        
        // Build API URL - determine if this is for coins or orders
        String apiEndpoint;
        if (callbackUrl.contains("orders/vnpay-return")) {
            // Order payment callback
            String baseUrl = callbackUrl.substring(0, callbackUrl.indexOf("/orders/vnpay-return"));
            apiEndpoint = baseUrl + "/orders/vnpay-return";
        } else if (callbackUrl.contains("coins/vnpay-return")) {
            // Coin top-up callback
            String baseUrl = callbackUrl.substring(0, callbackUrl.indexOf("/coins/vnpay-return"));
            apiEndpoint = baseUrl + "/coins/vnpay-return";
        } else if (callbackUrl.contains("vnpay-return")) {
            // Default to orders if not specified (for backward compatibility)
            String baseUrl = callbackUrl.substring(0, callbackUrl.indexOf("/vnpay-return"));
            apiEndpoint = baseUrl + "/orders/vnpay-return";
        } else {
            Log.e(TAG, "Unknown callback URL format: " + callbackUrl);
            handleVnPayReturn(callbackUrl);
            return;
        }
        
        Log.d(TAG, "API Endpoint: " + apiEndpoint);
        Log.d(TAG, "ResponseCode: " + responseCode + ", TxnRef: " + txnRef);
        
        // Call API with proper headers
        String authHeader = getAuthHeader();
        if (authHeader == null) {
            Log.w(TAG, "No auth token, handling return URL directly");
            handleVnPayReturn(callbackUrl);
            return;
        }
        
        // Build full URL with query parameters
        Uri.Builder uriBuilder = Uri.parse(apiEndpoint).buildUpon();
        for (String key : uri.getQueryParameterNames()) {
            uriBuilder.appendQueryParameter(key, uri.getQueryParameter(key));
        }
        // Add mobile parameter to help backend detect mobile app
        uriBuilder.appendQueryParameter("mobile", "true");
        String fullApiUrl = uriBuilder.build().toString();
        
        Log.d(TAG, "Full API URL: " + fullApiUrl);
        
        // Use OkHttp to call API with proper headers
        okhttp3.Request request = new okhttp3.Request.Builder()
                .url(fullApiUrl)
                .addHeader("Accept", "application/json")
                .addHeader("Authorization", authHeader)
                .addHeader("User-Agent", "Android-Mobile-App")
                .build();
        
        okhttp3.OkHttpClient client = new okhttp3.OkHttpClient();
        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call call, IOException e) {
                Log.e(TAG, "Failed to call VNPay callback API: " + e.getMessage());
                // Fallback to direct URL handling
                runOnUiThread(() -> handleVnPayReturn(callbackUrl));
            }

            @Override
            public void onResponse(okhttp3.Call call, okhttp3.Response response) throws IOException {
                String responseBody = response.body() != null ? response.body().string() : "";
                Log.d(TAG, "VNPay callback API response: " + response.code() + " - " + responseBody);
                
                if (response.isSuccessful()) {
                    try {
                        Gson gson = new Gson();
                        JsonObject jsonObject = gson.fromJson(responseBody, JsonObject.class);
                        
                        if (jsonObject.has("success") && jsonObject.get("success").getAsBoolean()) {
                            Log.d(TAG, "VNPay callback processed successfully via API");
                            Log.d(TAG, "Transaction details: " + jsonObject.toString());
                            
                            // Log balance info if available
                            if (jsonObject.has("balanceAfter")) {
                                double balanceAfter = jsonObject.get("balanceAfter").getAsDouble();
                                Log.d(TAG, "Balance after transaction: " + balanceAfter);
                            }
                            
                            // Handle success
                            runOnUiThread(() -> {
                                String responseCodeFromUrl = extractQueryParameter(callbackUrl, "vnp_ResponseCode");
                                String txnRefFromUrl = extractQueryParameter(callbackUrl, "vnp_TxnRef");
                                closeWithResult(responseCodeFromUrl, txnRefFromUrl, callbackUrl);
                            });
                        } else {
                            String errorMsg = jsonObject.has("message") ? jsonObject.get("message").getAsString() : "Unknown error";
                            Log.w(TAG, "VNPay callback API returned success=false: " + errorMsg);
                            runOnUiThread(() -> {
                                Toast.makeText(VnPayWebViewActivity.this, 
                                    "Lỗi xử lý thanh toán: " + errorMsg, 
                                    Toast.LENGTH_LONG).show();
                                handleVnPayReturn(callbackUrl);
                            });
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error parsing API response: " + e.getMessage());
                        runOnUiThread(() -> handleVnPayReturn(callbackUrl));
                    }
                } else {
                    Log.w(TAG, "VNPay callback API returned error: " + response.code());
                    runOnUiThread(() -> handleVnPayReturn(callbackUrl));
                }
            }
        });
    }

    private void handleVnPayReturn(String url) {
        Log.d(TAG, "Handling VNPay return: " + url);
        
        // Extract response code and transaction reference from URL
        String responseCode = extractQueryParameter(url, "vnp_ResponseCode");
        String txnRef = extractQueryParameter(url, "vnp_TxnRef");
        String amount = extractQueryParameter(url, "vnp_Amount");
        String transactionNo = extractQueryParameter(url, "vnp_TransactionNo");
        
        Log.d(TAG, "VNPay Return - ResponseCode: " + responseCode + ", TxnRef: " + txnRef + ", Amount: " + amount);
        
        // If this is payment-success page, backend has already processed
        // Wait a bit to ensure backend processing is complete
        if (url.contains("payment-success")) {
            Log.d(TAG, "Payment success page detected, waiting for backend processing...");
            // Wait 1 second to ensure backend has processed the callback
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                closeWithResult(responseCode, txnRef, url);
            }, 1000);
            return;
        }
        
        // For direct callback URLs, wait a bit for backend to process
        if ("00".equals(responseCode)) {
            Log.d(TAG, "Payment successful, waiting for backend processing...");
            // Wait 2 seconds to ensure backend has processed the callback
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                closeWithResult(responseCode, txnRef, url);
            }, 2000);
        } else {
            // Payment failed, close immediately
            closeWithResult(responseCode, txnRef, url);
        }
    }
    
    private void closeWithResult(String responseCode, String txnRef, String url) {
        // For coin top-up, verify balance was updated before closing
        if (!isOrderPayment && "00".equals(responseCode)) {
            verifyCoinBalanceUpdate();
            return;
        }
        
        // Close WebView and return result immediately for orders or failed payments
        closeWithResultImmediate(responseCode, txnRef, url);
    }
    
    private void verifyCoinBalanceUpdate() {
        String authHeader = getAuthHeader();
        if (authHeader == null) {
            Log.w(TAG, "No auth token, closing without verification");
            closeWithResultImmediate("00", null, null);
            return;
        }
        
        Log.d(TAG, "Verifying coin balance update...");
        Call<CoinBalanceResponse> call = apiService.getCoinBalance(authHeader);
        call.enqueue(new Callback<CoinBalanceResponse>() {
            @Override
            public void onResponse(Call<CoinBalanceResponse> call, Response<CoinBalanceResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    double balance = response.body().getBalance();
                    Log.d(TAG, "Coin balance verified: " + balance);
                } else {
                    Log.w(TAG, "Failed to verify balance, but payment was successful");
                }
                // Close regardless of verification result
                closeWithResultImmediate("00", null, null);
            }

            @Override
            public void onFailure(Call<CoinBalanceResponse> call, Throwable t) {
                Log.w(TAG, "Error verifying balance: " + t.getMessage());
                // Close anyway - backend should have processed
                closeWithResultImmediate("00", null, null);
            }
        });
    }
    
    private String getAuthHeader() {
        String token = prefManager.getToken();
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        return "Bearer " + token;
    }
    
    private void closeWithResultImmediate(String responseCode, String txnRef, String url) {
        // Close WebView and return result
        Intent resultIntent = new Intent();
        resultIntent.putExtra("responseCode", responseCode != null ? responseCode : "");
        resultIntent.putExtra("txnRef", txnRef != null ? txnRef : "");
        resultIntent.putExtra("returnUrl", url);
        
        // Add orderId if this is order payment
        if (isOrderPayment && orderId != null) {
            resultIntent.putExtra("orderId", orderId);
        }
        
        if ("00".equals(responseCode)) {
            // Payment successful
            setResult(RESULT_OK, resultIntent);
            // Don't show toast here, let CheckoutActivity/CoinTopUpActivity handle it
        } else {
            // Payment failed or cancelled
            setResult(RESULT_CANCELED, resultIntent);
            String errorMsg = getErrorMessage(responseCode);
            resultIntent.putExtra("errorMessage", errorMsg);
        }
        
        // Close the WebView activity
        finish();
    }

    private String extractQueryParameter(String url, String paramName) {
        try {
            int index = url.indexOf(paramName + "=");
            if (index == -1) return null;
            
            int start = index + paramName.length() + 1;
            int end = url.indexOf("&", start);
            if (end == -1) end = url.length();
            
            return url.substring(start, end);
        } catch (Exception e) {
            Log.e(TAG, "Error extracting parameter: " + paramName, e);
            return null;
        }
    }

    private String getErrorMessage(String responseCode) {
        if (responseCode == null) {
            return "Thanh toán thất bại";
        }
        
        switch (responseCode) {
            case "07":
                return "Trừ tiền thành công nhưng giao dịch bị nghi ngờ";
            case "09":
                return "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking";
            case "10":
                return "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần";
            case "11":
                return "Đã hết hạn chờ thanh toán";
            case "12":
                return "Thẻ/Tài khoản bị khóa";
            case "24":
                return "Giao dịch bị hủy";
            case "51":
                return "Tài khoản không đủ số dư để thực hiện giao dịch";
            case "65":
                return "Tài khoản đã vượt quá hạn mức giao dịch cho phép";
            case "75":
                return "Ngân hàng thanh toán đang bảo trì";
            default:
                return "Thanh toán VNPay thất bại (Mã lỗi: " + responseCode + ")";
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}

