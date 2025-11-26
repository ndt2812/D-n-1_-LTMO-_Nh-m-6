package quynh.ph59304.bansach;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;

import quynh.ph59304.bansach.models.Order;

public class OrderSuccessActivity extends AppCompatActivity {
    private TextView tvOrderId;
    private TextView tvMessage;
    private Button btnViewOrder;
    private Button btnContinueShopping;
    private String orderId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_success);

        orderId = getIntent().getStringExtra("orderId");

        initViews();
        setupToolbar();
        setupListeners();
        displayOrderInfo();
    }

    private void initViews() {
        tvOrderId = findViewById(R.id.tvOrderId);
        tvMessage = findViewById(R.id.tvMessage);
        btnViewOrder = findViewById(R.id.btnViewOrder);
        btnContinueShopping = findViewById(R.id.btnContinueShopping);
    }

    private void setupToolbar() {
        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            getSupportActionBar().setTitle("Đặt hàng thành công");
        }
        toolbar.setNavigationOnClickListener(v -> finish());
    }

    private void setupListeners() {
        btnViewOrder.setOnClickListener(v -> {
            if (orderId != null) {
                Intent intent = new Intent(this, OrderDetailActivity.class);
                intent.putExtra("orderId", orderId);
                startActivity(intent);
            }
            finish();
        });

        btnContinueShopping.setOnClickListener(v -> {
            Intent intent = new Intent(this, BookListActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            finish();
        });
    }

    private void displayOrderInfo() {
        if (orderId != null) {
            tvOrderId.setText("Mã đơn hàng: " + orderId);
        } else {
            tvOrderId.setText("Đặt hàng thành công!");
        }
        tvMessage.setText("Cảm ơn bạn đã đặt hàng. Chúng tôi sẽ xử lý đơn hàng của bạn sớm nhất có thể.");
    }
}

