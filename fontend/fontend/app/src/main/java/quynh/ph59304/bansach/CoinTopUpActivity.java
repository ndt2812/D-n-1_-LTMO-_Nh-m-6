package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import quynh.ph59304.bansach.adapters.CoinPackageAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CoinTopUpPackage;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CoinTopUpActivity extends AppCompatActivity {
    private RecyclerView recyclerViewPackages;
    private ProgressBar progressBar;
    private CoinPackageAdapter adapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private List<CoinTopUpPackage> packages = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_top_up);

        apiService = RetrofitClient.getInstance(this).getApiService();
        prefManager = new SharedPreferencesManager(this);

        if (!prefManager.isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupToolbar();
        setupRecyclerView();
        loadPackages();
    }

    private void initViews() {
        recyclerViewPackages = findViewById(R.id.recyclerViewPackages);
        progressBar = findViewById(R.id.progressBar);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            getSupportActionBar().setTitle("Nạp Coin");
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void setupRecyclerView() {
        adapter = new CoinPackageAdapter(packages, packageItem -> {
            processTopUp(packageItem);
        });
        recyclerViewPackages.setLayoutManager(new GridLayoutManager(this, 2));
        recyclerViewPackages.setAdapter(adapter);
    }

    private void loadPackages() {
        showProgress(true);
        // Giả sử API endpoint là /api/coin/packages
        // Nếu không có API, sử dụng dữ liệu mẫu
        Call<ApiResponse<List<CoinTopUpPackage>>> call = apiService.getCoinTopUpPackages();
        call.enqueue(new Callback<ApiResponse<List<CoinTopUpPackage>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<CoinTopUpPackage>>> call, Response<ApiResponse<List<CoinTopUpPackage>>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null && response.body().getData() != null) {
                    packages.clear();
                    packages.addAll(response.body().getData());
                    adapter.updatePackages(packages);
                } else {
                    // Load default packages if API fails
                    loadDefaultPackages();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<CoinTopUpPackage>>> call, Throwable t) {
                showProgress(false);
                loadDefaultPackages();
            }
        });
    }

    private void loadDefaultPackages() {
        packages.clear();
        // Default packages
        CoinTopUpPackage p1 = new CoinTopUpPackage();
        p1.setName("Gói 50K");
        p1.setAmount(50000);
        p1.setCoinAmount(50000);
        p1.setBonus(false);

        CoinTopUpPackage p2 = new CoinTopUpPackage();
        p2.setName("Gói 100K");
        p2.setAmount(100000);
        p2.setCoinAmount(110000);
        p2.setBonus(true);
        p2.setBonusAmount(10000);

        CoinTopUpPackage p3 = new CoinTopUpPackage();
        p3.setName("Gói 200K");
        p3.setAmount(200000);
        p3.setCoinAmount(230000);
        p3.setBonus(true);
        p3.setBonusAmount(30000);

        CoinTopUpPackage p4 = new CoinTopUpPackage();
        p4.setName("Gói 500K");
        p4.setAmount(500000);
        p4.setCoinAmount(600000);
        p4.setBonus(true);
        p4.setBonusAmount(100000);

        packages.add(p1);
        packages.add(p2);
        packages.add(p3);
        packages.add(p4);
        adapter.updatePackages(packages);
    }

    private void processTopUp(CoinTopUpPackage packageItem) {
        showProgress(true);
        Map<String, Object> body = new HashMap<>();
        body.put("packageId", packageItem.getId());
        body.put("amount", packageItem.getAmount());
        body.put("coinAmount", packageItem.getCoinAmount());

        Call<ApiResponse<Object>> call = apiService.topUpCoins(body);
        call.enqueue(new Callback<ApiResponse<Object>>() {
            @Override
            public void onResponse(Call<ApiResponse<Object>> call, Response<ApiResponse<Object>> response) {
                showProgress(false);
                if (response.isSuccessful()) {
                    Toast.makeText(CoinTopUpActivity.this, "Nạp Coin thành công!", Toast.LENGTH_SHORT).show();
                    setResult(RESULT_OK);
                    finish();
                } else {
                    Toast.makeText(CoinTopUpActivity.this, "Nạp Coin thất bại", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Object>> call, Throwable t) {
                showProgress(false);
                Toast.makeText(CoinTopUpActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewPackages.setVisibility(show ? View.GONE : View.VISIBLE);
    }
}

