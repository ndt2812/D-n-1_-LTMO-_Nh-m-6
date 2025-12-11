package quynh.ph59304.bansach.adapters;

import android.annotation.SuppressLint;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.models.CoinTransaction;

public class CoinTransactionAdapter extends RecyclerView.Adapter<CoinTransactionAdapter.TransactionViewHolder> {
    private final List<CoinTransaction> transactions;
    private final SimpleDateFormat inputFormatWithMs = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
    private final SimpleDateFormat inputFormatNoMs = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault());
    private final SimpleDateFormat outputFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());

    public CoinTransactionAdapter(List<CoinTransaction> transactions) {
        this.transactions = transactions;
        inputFormatWithMs.setTimeZone(TimeZone.getTimeZone("UTC"));
        inputFormatNoMs.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    @NonNull
    @Override
    public TransactionViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_coin_transaction, parent, false);
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

    @SuppressLint("NotifyDataSetChanged")
    public void updateTransactions(List<CoinTransaction> newTransactions) {
        transactions.clear();
        if (newTransactions != null) {
            transactions.addAll(newTransactions);
        }
        notifyDataSetChanged();
    }

    class TransactionViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvTitle;
        private final TextView tvDescription;
        private final TextView tvDate;
        private final TextView tvAmount;
        private final TextView tvStatus;

        TransactionViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tvTransactionTitle);
            tvDescription = itemView.findViewById(R.id.tvTransactionDescription);
            tvDate = itemView.findViewById(R.id.tvTransactionDate);
            tvAmount = itemView.findViewById(R.id.tvTransactionAmount);
            tvStatus = itemView.findViewById(R.id.tvTransactionStatus);
        }

        void bind(CoinTransaction transaction) {
            tvTitle.setText(getDisplayTitle(transaction));
            tvDescription.setText(transaction.getDescription() != null ? transaction.getDescription() : "Không có mô tả");
            tvDate.setText(formatDate(transaction.getCreatedAt()));
            tvAmount.setText(formatAmount(transaction));
            tvAmount.setTextColor(itemView.getResources().getColor(
                    transaction.isCredit() ? R.color.colorPrimary : android.R.color.holo_red_dark,
                    itemView.getContext().getTheme()
            ));

            String status = transaction.getStatus();
            if (status == null || status.isEmpty()) {
                status = transaction.isPending() ? "Đang xử lý" : "Hoàn tất";
            } else {
                status = mapStatus(status);
            }
            tvStatus.setText(status);
        }

        private String getDisplayTitle(CoinTransaction transaction) {
            if (transaction == null || transaction.getType() == null) {
                return "Giao dịch";
            }
            String type = transaction.getType().toLowerCase(Locale.getDefault());
            switch (type) {
                case "deposit":
                    return "Nạp coin";
                case "purchase":
                case "spend":
                    return "Thanh toán đơn hàng";
                case "bonus":
                case "admin_bonus":
                    return "Coin bonus";
                case "refund":
                    return "Hoàn tiền";
                case "withdraw":
                    return "Rút coin";
                default:
                    return "Giao dịch " + type;
            }
        }

        private String formatAmount(CoinTransaction transaction) {
            double amount = transaction.getAmount();
            String prefix = transaction.isCredit() ? "+" : "-";
            return prefix + String.format(Locale.getDefault(), "%,.0f coin", Math.abs(amount));
        }

        private String formatDate(String dateString) {
            if (dateString == null || dateString.isEmpty()) {
                return "";
            }
            try {
                Date date = inputFormatWithMs.parse(dateString);
                if (date == null) {
                    date = inputFormatNoMs.parse(dateString);
                }
                if (date != null) {
                    return outputFormat.format(date);
                }
            } catch (ParseException ignored) {
            }
            return dateString;
        }

        private String mapStatus(String status) {
            switch (status.toLowerCase(Locale.getDefault())) {
                case "pending":
                    return "Đang xử lý";
                case "completed":
                case "success":
                    return "Hoàn tất";
                case "failed":
                case "canceled":
                    return "Thất bại";
                default:
                    return status;
            }
        }
    }
}

