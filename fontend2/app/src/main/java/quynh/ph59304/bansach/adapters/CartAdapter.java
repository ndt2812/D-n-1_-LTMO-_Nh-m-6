package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

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
        // Use DiffUtil for smoother updates if possible, otherwise use notifyDataSetChanged
        this.cartItems = newItems;
        notifyDataSetChanged();
        
        // Reset update state for all view holders
        // This will be handled by rebinding in onBindViewHolder
    }

    class CartViewHolder extends RecyclerView.ViewHolder {
        private ImageView imgBookCover;
        private TextView tvTitle, tvAuthor, tvPrice, tvQuantity, tvSubtotal;
        private TextView btnDecrease, btnIncrease;
        private ImageView btnRemove;
        private boolean isUpdating = false;

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
            // Reset update state when binding new item
            isUpdating = false;
            btnDecrease.setEnabled(true);
            btnIncrease.setEnabled(true);
            btnRemove.setEnabled(true);
            
            Book book = cartItem.getBook();
            if (book != null) {
                tvTitle.setText(book.getTitle());
                tvAuthor.setText(book.getAuthor());
                
                // Format price with proper locale - ALWAYS show price for each item
                NumberFormat numberFormat = NumberFormat.getNumberInstance(Locale.getDefault());
                numberFormat.setMaximumFractionDigits(0);
                
                // Get price - use book price or cartItem price
                double itemPrice = book.getPrice();
                if (itemPrice <= 0 && cartItem.getPrice() > 0) {
                    itemPrice = cartItem.getPrice();
                }
                
                String formattedPrice = "Giá: " + numberFormat.format(itemPrice) + " đ";
                tvPrice.setText(formattedPrice);
                tvPrice.setVisibility(View.VISIBLE); // Ensure it's visible
                
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
                double subtotal = cartItem.getSubtotal();
                if (subtotal <= 0) {
                    subtotal = itemPrice * cartItem.getQuantity();
                }
                String formattedSubtotal = "Tổng: " + numberFormat.format(subtotal) + " đ";
                tvSubtotal.setText(formattedSubtotal);
                tvSubtotal.setVisibility(View.VISIBLE); // Ensure it's visible

                // Clear previous listeners
                btnDecrease.setOnClickListener(null);
                btnIncrease.setOnClickListener(null);
                btnRemove.setOnClickListener(null);

                // Set new listeners
                btnDecrease.setOnClickListener(v -> {
                    if (isUpdating) return;
                    int newQuantity = cartItem.getQuantity() - 1;
                    if (newQuantity > 0) {
                        // Optimistic update: update UI immediately
                        isUpdating = true;
                        tvQuantity.setText(String.valueOf(newQuantity));
                        double newSubtotal = book.getPrice() * newQuantity;
                        NumberFormat nf = NumberFormat.getNumberInstance(Locale.getDefault());
                        nf.setMaximumFractionDigits(0);
                        tvSubtotal.setText(nf.format(newSubtotal) + " đ");
                        
                        // Add animation
                        Animation scaleAnimation = AnimationUtils.loadAnimation(itemView.getContext(), R.anim.scale_up);
                        tvQuantity.startAnimation(scaleAnimation);
                        
                        // Disable buttons during update
                        btnDecrease.setEnabled(false);
                        btnIncrease.setEnabled(false);
                        
                        if (listener != null) {
                            listener.onQuantityChanged(cartItem, newQuantity);
                        }
                    } else {
                        Toast.makeText(itemView.getContext(), "Số lượng phải lớn hơn 0", Toast.LENGTH_SHORT).show();
                    }
                });

                btnIncrease.setOnClickListener(v -> {
                    if (isUpdating) return;
                    int newQuantity = cartItem.getQuantity() + 1;
                    
                    // Optimistic update: update UI immediately
                    isUpdating = true;
                    tvQuantity.setText(String.valueOf(newQuantity));
                    double newSubtotal = book.getPrice() * newQuantity;
                    NumberFormat nf = NumberFormat.getNumberInstance(Locale.getDefault());
                    nf.setMaximumFractionDigits(0);
                    tvSubtotal.setText(nf.format(newSubtotal) + " đ");
                    
                    // Add animation
                    Animation scaleAnimation = AnimationUtils.loadAnimation(itemView.getContext(), R.anim.scale_up);
                    tvQuantity.startAnimation(scaleAnimation);
                    
                    // Disable buttons during update
                    btnDecrease.setEnabled(false);
                    btnIncrease.setEnabled(false);
                    
                    if (listener != null) {
                        listener.onQuantityChanged(cartItem, newQuantity);
                    }
                });

                btnRemove.setOnClickListener(v -> {
                    if (isUpdating) return;
                    isUpdating = true;
                    
                    // Add fade out animation
                    Animation fadeOut = AnimationUtils.loadAnimation(itemView.getContext(), android.R.anim.fade_out);
                    fadeOut.setAnimationListener(new Animation.AnimationListener() {
                        @Override
                        public void onAnimationStart(Animation animation) {
                            btnRemove.setEnabled(false);
                            btnDecrease.setEnabled(false);
                            btnIncrease.setEnabled(false);
                        }

                        @Override
                        public void onAnimationEnd(Animation animation) {
                            if (listener != null) {
                                listener.onItemRemoved(cartItem);
                            }
                        }

                        @Override
                        public void onAnimationRepeat(Animation animation) {}
                    });
                    itemView.startAnimation(fadeOut);
                });
            }
        }
    }
}


