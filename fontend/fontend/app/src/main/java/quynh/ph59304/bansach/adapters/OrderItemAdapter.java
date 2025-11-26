package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;

import java.util.List;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.api.RetrofitClient;
import quynh.ph59304.bansach.models.Book;
import quynh.ph59304.bansach.models.OrderItem;

public class OrderItemAdapter extends RecyclerView.Adapter<OrderItemAdapter.OrderItemViewHolder> {
    private List<OrderItem> orderItems;

    public OrderItemAdapter(List<OrderItem> orderItems) {
        this.orderItems = orderItems;
    }

    @NonNull
    @Override
    public OrderItemViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order_item, parent, false);
        return new OrderItemViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderItemViewHolder holder, int position) {
        OrderItem item = orderItems.get(position);
        holder.bind(item);
    }

    @Override
    public int getItemCount() {
        return orderItems != null ? orderItems.size() : 0;
    }

    public void updateOrderItems(List<OrderItem> newItems) {
        this.orderItems = newItems;
        notifyDataSetChanged();
    }

    class OrderItemViewHolder extends RecyclerView.ViewHolder {
        private ImageView imgBookCover;
        private TextView tvTitle, tvAuthor, tvPrice, tvQuantity, tvSubtotal;

        public OrderItemViewHolder(@NonNull View itemView) {
            super(itemView);
            imgBookCover = itemView.findViewById(R.id.imgBookCover);
            tvTitle = itemView.findViewById(R.id.tvTitle);
            tvAuthor = itemView.findViewById(R.id.tvAuthor);
            tvPrice = itemView.findViewById(R.id.tvPrice);
            tvQuantity = itemView.findViewById(R.id.tvQuantity);
            tvSubtotal = itemView.findViewById(R.id.tvSubtotal);
        }

        public void bind(OrderItem orderItem) {
            Book book = orderItem.getBook();
            if (book != null) {
                tvTitle.setText(book.getTitle());
                tvAuthor.setText(book.getAuthor());
                tvPrice.setText(String.format("%,.0f đ", orderItem.getPrice()));
                tvQuantity.setText("x" + orderItem.getQuantity());
                tvSubtotal.setText(String.format("%,.0f đ", orderItem.getSubtotal()));
                
                // Load image
                String imageUrl = book.getCoverImage();
                if (imageUrl != null && !imageUrl.isEmpty()) {
                    if (!imageUrl.startsWith("http")) {
                        String base = RetrofitClient.getBaseUrl();
                        if (imageUrl.startsWith("/")) {
                            imageUrl = base + imageUrl.substring(1);
                        } else {
                            imageUrl = base + imageUrl;
                        }
                    }
                    Glide.with(itemView.getContext())
                            .load(imageUrl)
                            .placeholder(R.drawable.ic_launcher_background)
                            .error(R.drawable.ic_launcher_background)
                            .into(imgBookCover);
                }
            }
        }
    }
}


