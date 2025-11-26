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

import quynh.ph59304.bansach.adapters.CoinExchangePackageAdapter;
import quynh.ph59304.bansach.api.ApiService;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.ApiResponse;
import quynh.ph59304.bansach.models.CoinExchangePackage;
import quynh.ph59304.bansach.utils.SharedPreferencesManager;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CoinExchangeActivity extends AppCompatActivity {
    private RecyclerView recyclerViewPackages;
    private ProgressBar progressBar;
    private CoinExchangePackageAdapter adapter;
    private ApiService apiService;
    private SharedPreferencesManager prefManager;
    private List<CoinExchangePackage> packages = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_coin_exchange);

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
            getSupportActionBar().setTitle("Đổi Coin");
        }
        toolbar.setNavigationOnClickListener(v -> onBackPressed());
    }

    private void setupRecyclerView() {
        adapter = new CoinExchangePackageAdapter(packages, packageItem -> {
            processExchange(packageItem);
        });
        recyclerViewPackages.setLayoutManager(new GridLayoutManager(this, 2));
        recyclerViewPackages.setAdapter(adapter);
    }

    private void loadPackages() {
        showProgress(true);
        Call<ApiResponse<List<CoinExchangePackage>>> call = apiService.getCoinExchangePackages();
        call.enqueue(new Callback<ApiResponse<List<CoinExchangePackage>>>() {
            @Override
            public void onResponse(Call<ApiResponse<List<CoinExchangePackage>>> call, Response<ApiResponse<List<CoinExchangePackage>>> response) {
                showProgress(false);
                if (response.isSuccessful() && response.body() != null && response.body().getData() != null) {
                    packages.clear();
                    packages.addAll(response.body().getData());
                    adapter.updatePackages(packages);
                } else {
                    loadDefaultPackages();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<List<CoinExchangePackage>>> call, Throwable t) {
                showProgress(false);
                loadDefaultPackages();
            }
        });
    }

    private void loadDefaultPackages() {
        packages.clear();
        CoinExchangePackage p1 = new CoinExchangePackage();
        p1.setName("Gói 10K Coin");
        p1.setCoinAmount(10000);
        p1.setDiscount(5);

        CoinExchangePackage p2 = new CoinExchangePackage();
        p2.setName("Gói 20K Coin");
        p2.setCoinAmount(20000);
        p2.setDiscount(10);

        packages.add(p1);
        packages.add(p2);
        adapter.updatePackages(packages);
    }

    private void processExchange(CoinExchangePackage packageItem) {
        showProgress(true);
        Map<String, Object> body = new HashMap<>();
        body.put("packageId", packageItem.getId());
        body.put("coinAmount", packageItem.getCoinAmount());

        Call<ApiResponse<Object>> call = apiService.exchangeCoins(body);
        call.enqueue(new Callback<ApiResponse<Object>>() {
            @Override
            public void onResponse(Call<ApiResponse<Object>> call, Response<ApiResponse<Object>> response) {
                showProgress(false);
                if (response.isSuccessful()) {
                    Toast.makeText(CoinExchangeActivity.this, "Đổi Coin thành công!", Toast.LENGTH_SHORT).show();
                    setResult(RESULT_OK);
                    finish();
                } else {
                    Toast.makeText(CoinExchangeActivity.this, "Đổi Coin thất bại", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Object>> call, Throwable t) {
                showProgress(false);
                Toast.makeText(CoinExchangeActivity.this, "Lỗi: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showProgress(boolean show) {
        progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        recyclerViewPackages.setVisibility(show ? View.GONE : View.VISIBLE);
    }
}

