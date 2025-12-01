package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;

import java.util.List;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.api.ApiConfig;
import quynh.ph59304.bansach.models.Book;
import quynh.ph59304.bansach.models.CartItem;

public class CartAdapter extends RecyclerView.Adapter<CartAdapter.CartViewHolder> {
    private List<CartItem> cartItems;
    private OnCartItemClickListener listener;

    public interface OnCartItemClickListener {
        void onQuantityChanged(CartItem item, int newQuantity);
        void onItemRemoved(CartItem item);
    }

    public CartAdapter(List<CartItem> cartItems, OnCartItemClickListener listener) {
        this.cartItems = cartItems;
        this.listener = listener;
    }

    @NonNull
    @Override
    public CartViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_cart, parent, false);
        return new CartViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull CartViewHolder holder, int position) {
        CartItem item = cartItems.get(position);
        holder.bind(item);
    }

    @Override
    public int getItemCount() {
        return cartItems != null ? cartItems.size() : 0;
    }

    public void updateCartItems(List<CartItem> newItems) {
        this.cartItems = newItems;
        notifyDataSetChanged();
    }

    class CartViewHolder extends RecyclerView.ViewHolder {
        private ImageView imgBookCover;
        private TextView tvTitle, tvAuthor, tvPrice, tvQuantity, tvSubtotal;
        private TextView btnDecrease, btnIncrease;
        private ImageView btnRemove;

        public CartViewHolder(@NonNull View itemView) {
            super(itemView);
            imgBookCover = itemView.findViewById(R.id.imgBookCover);
            tvTitle = itemView.findViewById(R.id.tvTitle);
            tvAuthor = itemView.findViewById(R.id.tvAuthor);
            tvPrice = itemView.findViewById(R.id.tvPrice);
            tvQuantity = itemView.findViewById(R.id.tvQuantity);
            tvSubtotal = itemView.findViewById(R.id.tvSubtotal);
            btnDecrease = itemView.findViewById(R.id.btnDecrease);
            btnIncrease = itemView.findViewById(R.id.btnIncrease);
            btnRemove = itemView.findViewById(R.id.btnRemove);
        }

        public void bind(CartItem cartItem) {
            Book book = cartItem.getBook();
            if (book != null) {
                tvTitle.setText(book.getTitle());
                tvAuthor.setText(book.getAuthor());
                tvPrice.setText(String.format("%,.0f đ", book.getPrice()));
                
                // Load image
                String imageUrl = ApiConfig.buildAbsoluteUrl(book.getCoverImage());
                if (imageUrl != null && !imageUrl.isEmpty()) {
                    Glide.with(itemView.getContext())
                            .load(imageUrl)
                            .placeholder(R.drawable.ic_launcher_background)
                            .error(R.drawable.ic_launcher_background)
                            .into(imgBookCover);
                }

                tvQuantity.setText(String.valueOf(cartItem.getQuantity()));
                tvSubtotal.setText(String.format("%,.0f đ", cartItem.getSubtotal()));

                btnDecrease.setOnClickListener(v -> {
                    int newQuantity = cartItem.getQuantity() - 1;
                    if (newQuantity > 0) {
                        if (listener != null) {
                            listener.onQuantityChanged(cartItem, newQuantity);
                        }
                    } else {
                        Toast.makeText(itemView.getContext(), "Số lượng phải lớn hơn 0", Toast.LENGTH_SHORT).show();
                    }
                });

                btnIncrease.setOnClickListener(v -> {
                    int newQuantity = cartItem.getQuantity() + 1;
                    if (listener != null) {
                        listener.onQuantityChanged(cartItem, newQuantity);
                    }
                });

                btnRemove.setOnClickListener(v -> {
                    if (listener != null) {
                        listener.onItemRemoved(cartItem);
                    }
                });
            }
        }
    }
}


