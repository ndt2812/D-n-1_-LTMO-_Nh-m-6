package quynh.ph59304.bansach.adapters;

import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.models.Order;

public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.OrderViewHolder> {
    private List<Order> orders;
    private OnOrderClickListener listener;

    public interface OnOrderClickListener {
        void onOrderClick(Order order);
    }

    public OrderAdapter(List<Order> orders, OnOrderClickListener listener) {
        this.orders = orders;
        this.listener = listener;
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        Order order = orders.get(position);
        holder.bind(order);
    }

    @Override
    public int getItemCount() {
        return orders != null ? orders.size() : 0;
    }

    public void updateOrders(List<Order> newOrders) {
        this.orders = newOrders;
        notifyDataSetChanged();
    }

    class OrderViewHolder extends RecyclerView.ViewHolder {
        private TextView tvOrderId, tvStatus, tvTotalAmount, tvItemCount, tvCreatedAt;

        public OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tvOrderId);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            tvTotalAmount = itemView.findViewById(R.id.tvTotalAmount);
            tvItemCount = itemView.findViewById(R.id.tvItemCount);
            tvCreatedAt = itemView.findViewById(R.id.tvCreatedAt);
        }

        public void bind(Order order) {
            tvOrderId.setText("Đơn hàng #" + getShortOrderId(order.getId()));
            tvStatus.setText(order.getStatusDisplayName());
            tvTotalAmount.setText(String.format("%,.0f đ", order.getTotalAmount()));
            
            if (order.getItems() != null) {
                tvItemCount.setText(order.getItems().size() + " sản phẩm");
            } else {
                tvItemCount.setText("0 sản phẩm");
            }

            // Format date
            if (order.getCreatedAt() != null) {
                try {
                    SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
                    SimpleDateFormat outputFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());
                    Date date = inputFormat.parse(order.getCreatedAt());
                    if (date != null) {
                        tvCreatedAt.setText(outputFormat.format(date));
                    } else {
                        tvCreatedAt.setText(order.getCreatedAt());
                    }
                } catch (ParseException e) {
                    tvCreatedAt.setText(order.getCreatedAt());
                }
            } else {
                tvCreatedAt.setText("");
            }

            // Set màu và background cho status dựa trên trạng thái đơn hàng
            setStatusColor(order);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onOrderClick(order);
                }
            });
        }

        private void setStatusColor(Order order) {
            String status = order.getStatus();
            if (status == null) {
                status = order.getOrderStatus();
            }
            if (status == null) {
                status = "pending";
            }
            
            int backgroundColor;
            int textColor = 0xFFFFFFFF; // White text
            
            switch (status.toLowerCase()) {
                case "pending":
                    // Chờ xác nhận - Cam
                    backgroundColor = 0xFFFF9800;
                    break;
                case "processing":
                case "confirmed":
                    // Đang xử lý / Đã xác nhận - Xanh dương
                    backgroundColor = 0xFF2196F3;
                    break;
                case "shipping":
                case "shipped":
                    // Đang giao hàng - Xanh nước biển nhạt
                    backgroundColor = 0xFF64B5F6; // Blue 300
                    break;
                case "delivered":
                    // Đã nhận hàng - Xanh lá đậm
                    backgroundColor = 0xFF2E7D32;
                    break;
                case "cancelled":
                    // Đã hủy - Đỏ
                    backgroundColor = 0xFFF44336;
                    break;
                default:
                    // Mặc định - Xám
                    backgroundColor = 0xFF9E9E9E;
                    break;
            }
            
            // Tạo GradientDrawable với màu nền và bo góc
            GradientDrawable drawable = new GradientDrawable();
            drawable.setShape(GradientDrawable.RECTANGLE);
            drawable.setCornerRadius(20f);
            drawable.setColor(backgroundColor);
            
            tvStatus.setBackground(drawable);
            tvStatus.setTextColor(textColor);
        }
    }

    private String getShortOrderId(String orderId) {
        if (orderId == null || orderId.isEmpty()) {
            return "";
        }
        return orderId.length() > 8 ? orderId.substring(orderId.length() - 8) : orderId;
    }
}


