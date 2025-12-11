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

public class ExchangeRateAdapter extends RecyclerView.Adapter<ExchangeRateAdapter.ExchangeRateViewHolder> {
    public interface OnExchangeRateSelectedListener {
        void onExchangeRateSelected(int coins, int dollars);
    }

    private final List<ExchangeRate> exchangeRates;
    private final OnExchangeRateSelectedListener listener;
    private int selectedPosition = RecyclerView.NO_POSITION;

    public static class ExchangeRate {
        private final int coins;
        private final int dollars;

        public ExchangeRate(int coins, int dollars) {
            this.coins = coins;
            this.dollars = dollars;
        }

        public int getCoins() {
            return coins;
        }

        public int getDollars() {
            return dollars;
        }
    }

    public ExchangeRateAdapter(List<ExchangeRate> exchangeRates, OnExchangeRateSelectedListener listener) {
        this.exchangeRates = exchangeRates;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ExchangeRateViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_exchange_rate, parent, false);
        return new ExchangeRateViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ExchangeRateViewHolder holder, int position) {
        holder.bind(exchangeRates.get(position), position == selectedPosition);
    }

    @Override
    public int getItemCount() {
        return exchangeRates != null ? exchangeRates.size() : 0;
    }

    class ExchangeRateViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvCoinAmount;
        private final TextView tvDollarAmount;
        private final MaterialCardView cardView;

        ExchangeRateViewHolder(@NonNull View itemView) {
            super(itemView);
            tvCoinAmount = itemView.findViewById(R.id.tvCoinAmount);
            tvDollarAmount = itemView.findViewById(R.id.tvDollarAmount);
            cardView = (MaterialCardView) itemView;
        }

        void bind(ExchangeRate exchangeRate, boolean selected) {
            tvCoinAmount.setText(String.format(Locale.getDefault(), "%d", exchangeRate.getCoins()));
            tvDollarAmount.setText(String.format(Locale.getDefault(), "%,d$", exchangeRate.getDollars()));

            // Update visual state
            if (selected) {
                cardView.setCardBackgroundColor(ContextCompat.getColor(itemView.getContext(), R.color.colorPrimaryContainer));
                cardView.setStrokeWidth(2);
                cardView.setStrokeColor(ContextCompat.getColor(itemView.getContext(), R.color.colorPrimary));
            } else {
                cardView.setCardBackgroundColor(0xFFE5E5E5);
                cardView.setStrokeWidth(0);
            }

            itemView.setOnClickListener(v -> {
                int previousSelected = selectedPosition;
                selectedPosition = getBindingAdapterPosition();
                if (selectedPosition == RecyclerView.NO_POSITION) {
                    return;
                }
                if (previousSelected != RecyclerView.NO_POSITION && previousSelected < getItemCount()) {
                    notifyItemChanged(previousSelected);
                }
                notifyItemChanged(selectedPosition);
                if (listener != null) {
                    listener.onExchangeRateSelected(exchangeRate.getCoins(), exchangeRate.getDollars());
                }
            });
        }
    }

    public ExchangeRate getSelectedExchangeRate() {
        if (selectedPosition >= 0 && selectedPosition < exchangeRates.size()) {
            return exchangeRates.get(selectedPosition);
        }
        return null;
    }
}

