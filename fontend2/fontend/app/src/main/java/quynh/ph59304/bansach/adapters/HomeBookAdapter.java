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
import quynh.ph59304.bansach.api.ApiConfig;
import quynh.ph59304.bansach.models.Book;

public class HomeBookAdapter extends RecyclerView.Adapter<HomeBookAdapter.BookViewHolder> {
    private List<Book> books;
    private OnBookClickListener listener;

    public interface OnBookClickListener {
        void onBookClick(Book book);
    }

    public HomeBookAdapter(List<Book> books, OnBookClickListener listener) {
        this.books = books;
        this.listener = listener;
    }

    @NonNull
    @Override
    public BookViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_book_horizontal, parent, false);
        return new BookViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull BookViewHolder holder, int position) {
        Book book = books.get(position);
        holder.bind(book);
    }

    @Override
    public int getItemCount() {
        return books != null ? books.size() : 0;
    }

    public void updateBooks(List<Book> newBooks) {
        this.books = newBooks;
        notifyDataSetChanged();
    }

    class BookViewHolder extends RecyclerView.ViewHolder {
        private ImageView imgBookCover;
        private TextView tvTitle, tvAuthor, tvDescription, tvPrice;

        public BookViewHolder(@NonNull View itemView) {
            super(itemView);
            imgBookCover = itemView.findViewById(R.id.imgBookCover);
            tvTitle = itemView.findViewById(R.id.tvTitle);
            tvAuthor = itemView.findViewById(R.id.tvAuthor);
            tvDescription = itemView.findViewById(R.id.tvDescription);
            tvPrice = itemView.findViewById(R.id.tvPrice);

            itemView.setOnClickListener(v -> {
                if (listener != null && getAdapterPosition() != RecyclerView.NO_POSITION) {
                    listener.onBookClick(books.get(getAdapterPosition()));
                }
            });
        }

        public void bind(Book book) {
            tvTitle.setText(book.getTitle());
            tvAuthor.setText(book.getAuthor());
            
            // Set description snippet (first 60 characters)
            if (book.getDescription() != null && !book.getDescription().isEmpty()) {
                String description = book.getDescription();
                if (description.length() > 60) {
                    description = description.substring(0, 60) + "...";
                }
                tvDescription.setText(description);
            } else {
                tvDescription.setText("No description available");
            }
            
            // Format price as $XX.XX
            tvPrice.setText(String.format("$%.2f", book.getPrice()));

            // Load image
            String imageUrl = ApiConfig.buildAbsoluteUrl(book.getCoverImage());
            if (imageUrl != null && !imageUrl.isEmpty()) {
                Glide.with(itemView.getContext())
                        .load(imageUrl)
                        .placeholder(R.drawable.ic_launcher_background)
                        .error(R.drawable.ic_launcher_background)
                        .into(imgBookCover);
            } else {
                imgBookCover.setImageResource(R.drawable.ic_launcher_background);
            }
        }
    }
}

