package quynh.ph59304.bansach.adapters;

import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.RatingBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.api.ApiConfig;
import quynh.ph59304.bansach.models.Review;
import quynh.ph59304.bansach.models.ReviewUser;

public class ReviewAdapter extends RecyclerView.Adapter<ReviewAdapter.ReviewViewHolder> {
    private List<Review> reviews;
    private final SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
    private final SimpleDateFormat outputFormat = new SimpleDateFormat("dd/MM/yyyy", Locale.getDefault());

    public ReviewAdapter(List<Review> reviews) {
        this.reviews = reviews;
    }

    public void updateReviews(List<Review> newReviews) {
        this.reviews = newReviews;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ReviewViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_review, parent, false);
        return new ReviewViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ReviewViewHolder holder, int position) {
        holder.bind(reviews.get(position));
    }

    @Override
    public int getItemCount() {
        return reviews != null ? reviews.size() : 0;
    }

    class ReviewViewHolder extends RecyclerView.ViewHolder {
        private final ImageView imgAvatar;
        private final TextView tvReviewerName;
        private final TextView tvReviewDate;
        private final RatingBar ratingBar;
        private final TextView tvReviewComment;
        private final TextView tvEditedLabel;

        ReviewViewHolder(@NonNull View itemView) {
            super(itemView);
            imgAvatar = itemView.findViewById(R.id.imgReviewerAvatar);
            tvReviewerName = itemView.findViewById(R.id.tvReviewerName);
            tvReviewDate = itemView.findViewById(R.id.tvReviewDate);
            ratingBar = itemView.findViewById(R.id.ratingBarReview);
            tvReviewComment = itemView.findViewById(R.id.tvReviewComment);
            tvEditedLabel = itemView.findViewById(R.id.tvEditedLabel);
        }

        void bind(Review review) {
            ReviewUser user = review.getUser();
            if (user != null) {
                String displayName = !TextUtils.isEmpty(user.getFullName()) ? user.getFullName() : user.getUsername();
                tvReviewerName.setText(displayName != null ? displayName : "Người dùng");

                String avatarUrl = ApiConfig.buildAbsoluteUrl(user.getAvatar());
                Glide.with(itemView.getContext())
                        .load(avatarUrl)
                        .placeholder(R.drawable.ic_launcher_background)
                        .error(R.drawable.ic_launcher_background)
                        .circleCrop()
                        .into(imgAvatar);
            } else {
                tvReviewerName.setText("Người dùng");
                imgAvatar.setImageResource(R.drawable.ic_launcher_background);
            }

            tvReviewComment.setText(review.getComment());
            ratingBar.setRating(review.getRating());
            tvEditedLabel.setVisibility(review.isEdited() ? View.VISIBLE : View.GONE);

            String createdAt = review.getCreatedAt();
            if (!TextUtils.isEmpty(createdAt)) {
                try {
                    Date date = inputFormat.parse(createdAt);
                    if (date != null) {
                        tvReviewDate.setText(outputFormat.format(date));
                    } else {
                        tvReviewDate.setText(createdAt);
                    }
                } catch (ParseException e) {
                    tvReviewDate.setText(createdAt);
                }
            } else {
                tvReviewDate.setText("");
            }
        }
    }
}

