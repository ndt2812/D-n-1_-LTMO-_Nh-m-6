package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.models.CoinTransaction;

public class CoinTransactionAdapter extends RecyclerView.Adapter<CoinTransactionAdapter.TransactionViewHolder> {
    private List<CoinTransaction> transactions;
    private SimpleDateFormat dateFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());

    public CoinTransactionAdapter() {
        this.transactions = new ArrayList<>();
    }

    @NonNull
    @Override
    public TransactionViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_coin_transaction, parent, false);
        return new TransactionViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull TransactionViewHolder holder, int position) {
        CoinTransaction transaction = transactions.get(position);
        holder.bind(transaction);
    }

    @Override
    public int getItemCount() {
        return transactions != null ? transactions.size() : 0;
    }

    public void setItems(List<CoinTransaction> newTransactions) {
        this.transactions = newTransactions != null ? newTransactions : new ArrayList<>();
        notifyDataSetChanged();
    }

    class TransactionViewHolder extends RecyclerView.ViewHolder {
        private TextView tvType;
        private TextView tvDescription;
        private TextView tvAmount;
        private TextView tvDate;
        private TextView tvStatus;

        public TransactionViewHolder(@NonNull View itemView) {
            super(itemView);
            tvType = itemView.findViewById(R.id.tvType);
            tvDescription = itemView.findViewById(R.id.tvDescription);
            tvAmount = itemView.findViewById(R.id.tvAmount);
            tvDate = itemView.findViewById(R.id.tvDate);
            tvStatus = itemView.findViewById(R.id.tvStatus);
        }

        public void bind(CoinTransaction transaction) {
            String typeText = getTypeText(transaction.getType());
            tvType.setText(typeText);
            tvDescription.setText(transaction.getDescription());

            String amountText = String.format("%,.0f Coin", transaction.getCoinAmount());
            if (transaction.getType().equals("topup") || transaction.getType().equals("refund")) {
                amountText = "+" + amountText;
                tvAmount.setTextColor(itemView.getContext().getResources().getColor(android.R.color.holo_green_dark));
            } else {
                amountText = "-" + amountText;
                tvAmount.setTextColor(itemView.getContext().getResources().getColor(android.R.color.holo_red_dark));
            }
            tvAmount.setText(amountText);

            if (transaction.getCreatedAt() != null) {
                tvDate.setText(dateFormat.format(transaction.getCreatedAt()));
            } else {
                tvDate.setText("");
            }

            String statusText = getStatusText(transaction.getStatus());
            tvStatus.setText(statusText);
        }

        private String getTypeText(String type) {
            switch (type) {
                case "topup":
                    return "Nạp Coin";
                case "exchange":
                    return "Đổi Coin";
                case "purchase":
                    return "Mua hàng";
                case "refund":
                    return "Hoàn tiền";
                default:
                    return type;
            }
        }

        private String getStatusText(String status) {
            switch (status) {
                case "pending":
                    return "Đang xử lý";
                case "completed":
                    return "Hoàn thành";
                case "failed":
                    return "Thất bại";
                default:
                    return status;
            }
        }
    }
}

