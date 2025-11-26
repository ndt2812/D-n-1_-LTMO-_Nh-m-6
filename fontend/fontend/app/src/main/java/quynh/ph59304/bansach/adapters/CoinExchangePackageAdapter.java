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
import quynh.ph59304.bansach.models.CoinExchangePackage;

public class CoinExchangePackageAdapter extends RecyclerView.Adapter<CoinExchangePackageAdapter.PackageViewHolder> {
    private List<CoinExchangePackage> packages;
    private OnPackageClickListener listener;

    public interface OnPackageClickListener {
        void onPackageClick(CoinExchangePackage packageItem);
    }

    public CoinExchangePackageAdapter(List<CoinExchangePackage> packages, OnPackageClickListener listener) {
        this.packages = packages;
        this.listener = listener;
    }

    @NonNull
    @Override
    public PackageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_coin_exchange_package, parent, false);
        return new PackageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull PackageViewHolder holder, int position) {
        CoinExchangePackage packageItem = packages.get(position);
        holder.bind(packageItem);
    }

    @Override
    public int getItemCount() {
        return packages != null ? packages.size() : 0;
    }

    public void updatePackages(List<CoinExchangePackage> newPackages) {
        this.packages = newPackages;
        notifyDataSetChanged();
    }

    class PackageViewHolder extends RecyclerView.ViewHolder {
        private CardView cardPackage;
        private TextView tvPackageName;
        private TextView tvCoinAmount;
        private TextView tvDiscount;

        public PackageViewHolder(@NonNull View itemView) {
            super(itemView);
            cardPackage = itemView.findViewById(R.id.cardPackage);
            tvPackageName = itemView.findViewById(R.id.tvPackageName);
            tvCoinAmount = itemView.findViewById(R.id.tvCoinAmount);
            tvDiscount = itemView.findViewById(R.id.tvDiscount);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onPackageClick(packages.get(getAdapterPosition()));
                }
            });
        }

        public void bind(CoinExchangePackage packageItem) {
            tvPackageName.setText(packageItem.getName());
            tvCoinAmount.setText(String.format("%,.0f Coin", packageItem.getCoinAmount()));
            
            if (packageItem.getDiscount() > 0) {
                tvDiscount.setVisibility(View.VISIBLE);
                tvDiscount.setText(String.format("Giảm %.0f%%", packageItem.getDiscount()));
            } else {
                tvDiscount.setVisibility(View.GONE);
            }
        }
    }
}

