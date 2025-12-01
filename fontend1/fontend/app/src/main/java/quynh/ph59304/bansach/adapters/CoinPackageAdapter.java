package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.card.MaterialCardView;

import java.util.List;
import java.util.Locale;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.models.CoinTopUpPackage;

public class CoinPackageAdapter extends RecyclerView.Adapter<CoinPackageAdapter.PackageViewHolder> {
    public interface OnPackageSelectedListener {
        void onPackageSelected(CoinTopUpPackage coinPackage);
    }

    private final List<CoinTopUpPackage> packages;
    private final OnPackageSelectedListener listener;
    private int selectedPosition = RecyclerView.NO_POSITION;

    public CoinPackageAdapter(List<CoinTopUpPackage> packages, OnPackageSelectedListener listener) {
        this.packages = packages;
        this.listener = listener;
    }

    @NonNull
    @Override
    public PackageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_coin_package, parent, false);
        return new PackageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull PackageViewHolder holder, int position) {
        holder.bind(packages.get(position), position == selectedPosition);
    }

    @Override
    public int getItemCount() {
        return packages != null ? packages.size() : 0;
    }

    class PackageViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvCoins;
        private final TextView tvPrice;
        private final TextView tvBonus;
        private final MaterialCardView cardView;

        PackageViewHolder(@NonNull View itemView) {
            super(itemView);
            tvCoins = itemView.findViewById(R.id.tvPackageCoins);
            tvPrice = itemView.findViewById(R.id.tvPackagePrice);
            tvBonus = itemView.findViewById(R.id.tvPackageBonus);
            cardView = (MaterialCardView) itemView;
        }

        void bind(CoinTopUpPackage coinPackage, boolean selected) {
            tvCoins.setText(String.format(Locale.getDefault(), "%,d coin", coinPackage.getCoins()));
            tvPrice.setText(String.format(Locale.getDefault(), "%,d đ", coinPackage.getVnd()));
            if (coinPackage.getBonus() > 0) {
                tvBonus.setVisibility(View.VISIBLE);
                tvBonus.setText(String.format(Locale.getDefault(), "+%,d coin bonus", coinPackage.getBonus()));
            } else {
                tvBonus.setVisibility(View.GONE);
            }

            int backgroundColor = ContextCompat.getColor(itemView.getContext(),
                    selected ? R.color.colorPrimaryContainer : android.R.color.white);
            int strokeColor = ContextCompat.getColor(itemView.getContext(),
                    selected ? R.color.colorPrimary : R.color.colorSubtitle);
            cardView.setCardBackgroundColor(backgroundColor);
            cardView.setStrokeColor(strokeColor);

            itemView.setOnClickListener(v -> {
                int previousSelected = selectedPosition;
                selectedPosition = getBindingAdapterPosition();
                if (selectedPosition == RecyclerView.NO_POSITION) {
                    return;
                }
                if (previousSelected != RecyclerView.NO_POSITION) {
                    notifyItemChanged(previousSelected);
                }
                notifyItemChanged(selectedPosition);
                if (listener != null) {
                    listener.onPackageSelected(coinPackage);
                }
            });
        }
    }

    public CoinTopUpPackage getSelectedPackage() {
        if (selectedPosition >= 0 && selectedPosition < packages.size()) {
            return packages.get(selectedPosition);
        }
        return null;
    }
}

