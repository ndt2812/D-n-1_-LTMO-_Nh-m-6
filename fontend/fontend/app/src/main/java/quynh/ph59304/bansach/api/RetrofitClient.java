package quynh.ph59304.bansach.api;

import android.content.Context;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.net.CookieManager;
import java.net.CookiePolicy;

import okhttp3.OkHttpClient;
import okhttp3.JavaNetCookieJar;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;

public class RetrofitClient {
    private static final String BASE_URL = "http://172.20.10.2.100:3000/"; // 10.0.2.2 là IP của localhost trên Android Emulator
    // Nếu dùng thiết bị thật, thay bằng IP máy tính của bạn, ví dụ: "http://192.168.1.100:3000/"
    
    private static RetrofitClient instance;
    private ApiService apiService;
    private Context context;

    private RetrofitClient(Context context) {
        this.context = context;
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
        logging.setLevel(HttpLoggingInterceptor.Level.BODY);

        // Cookie jar to persist session cookies (Passport session)
        CookieManager cookieManager = new CookieManager();
        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

        // Interceptor to ensure JSON responses from backend controllers
        Interceptor acceptJsonInterceptor = chain -> {
            Request original = chain.request();
            Request request = original.newBuilder()
                    .header("Accept", "application/json")
                    .build();
            return chain.proceed(request);
        };

        // JWT Token interceptor - tự động thêm Authorization header cho các request cần xác thực
        Interceptor authInterceptor = chain -> {
            Request original = chain.request();
            String url = original.url().toString();
            
            // Chỉ thêm token cho các API cần xác thực (không thêm cho login/register)
            if (url.contains("/api/") && !url.contains("/api/login") && !url.contains("/api/register")) {
                SharedPreferencesManager prefManager = new SharedPreferencesManager(context);
                String token = prefManager.getToken();
                if (token != null && !token.isEmpty()) {
                    Request.Builder requestBuilder = original.newBuilder()
                            .header("Authorization", "Bearer " + token);
                    return chain.proceed(requestBuilder.build());
                }
            }
            return chain.proceed(original);
        };

        OkHttpClient okHttpClient = new OkHttpClient.Builder()
                .cookieJar(new JavaNetCookieJar(cookieManager))
                .addInterceptor(acceptJsonInterceptor)
                .addInterceptor(authInterceptor)
                .addInterceptor(logging)
                .build();

        // Cấu hình Gson với lenient mode để xử lý response không chuẩn
        Gson gson = new GsonBuilder()
                .setLenient()
                .create();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build();

        apiService = retrofit.create(ApiService.class);
    }

    public static synchronized RetrofitClient getInstance(Context context) {
        if (instance == null) {
            instance = new RetrofitClient(context.getApplicationContext());
        } else if (instance.context == null) {
            // Nếu instance đã tồn tại nhưng chưa có context, cập nhật context
            instance.context = context.getApplicationContext();
        }
        return instance;
    }
    
    // Overload method để tương thích với code cũ (sẽ cần Context từ Activity)
    public static synchronized RetrofitClient getInstance() {
        if (instance == null) {
            throw new IllegalStateException("RetrofitClient.getInstance() requires Context. Use getInstance(Context) instead.");
        }
        return instance;
    }

    public ApiService getApiService() {
        return apiService;
    }

    public static String getBaseUrl() {
        return BASE_URL;
    }
}
