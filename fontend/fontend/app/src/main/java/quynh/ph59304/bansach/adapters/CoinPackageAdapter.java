package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.cardview.widget.CardView;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.models.CoinTopUpPackage;

public class CoinPackageAdapter extends RecyclerView.Adapter<CoinPackageAdapter.PackageViewHolder> {
    private List<CoinTopUpPackage> packages;
    private OnPackageClickListener listener;

    public interface OnPackageClickListener {
        void onPackageClick(CoinTopUpPackage packageItem);
    }

    public CoinPackageAdapter(List<CoinTopUpPackage> packages, OnPackageClickListener listener) {
        this.packages = packages;
        this.listener = listener;
    }

    @NonNull
    @Override
    public PackageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_coin_package, parent, false);
        return new PackageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull PackageViewHolder holder, int position) {
        CoinTopUpPackage packageItem = packages.get(position);
        holder.bind(packageItem);
    }

    @Override
    public int getItemCount() {
        return packages != null ? packages.size() : 0;
    }

    public void updatePackages(List<CoinTopUpPackage> newPackages) {
        this.packages = newPackages;
        notifyDataSetChanged();
    }

    class PackageViewHolder extends RecyclerView.ViewHolder {
        private CardView cardPackage;
        private TextView tvPackageName;
        private TextView tvAmount;
        private TextView tvCoinAmount;
        private TextView tvBonus;

        public PackageViewHolder(@NonNull View itemView) {
            super(itemView);
            cardPackage = itemView.findViewById(R.id.cardPackage);
            tvPackageName = itemView.findViewById(R.id.tvPackageName);
            tvAmount = itemView.findViewById(R.id.tvAmount);
            tvCoinAmount = itemView.findViewById(R.id.tvCoinAmount);
            tvBonus = itemView.findViewById(R.id.tvBonus);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onPackageClick(packages.get(getAdapterPosition()));
                }
            });
        }

        public void bind(CoinTopUpPackage packageItem) {
            tvPackageName.setText(packageItem.getName());
            tvAmount.setText(String.format("%,.0f đ", packageItem.getAmount()));
            tvCoinAmount.setText(String.format("%,.0f Coin", packageItem.getCoinAmount()));

            if (packageItem.isBonus() && packageItem.getBonusAmount() > 0) {
                tvBonus.setVisibility(View.VISIBLE);
                tvBonus.setText(String.format("+%,.0f Coin", packageItem.getBonusAmount()));
            } else {
                tvBonus.setVisibility(View.GONE);
            }
        }
    }
}

