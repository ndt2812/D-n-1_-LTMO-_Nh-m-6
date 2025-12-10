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
import quynh.ph59304.bansach.models.NotificationInfo;

public class NotificationAdapter extends RecyclerView.Adapter<NotificationAdapter.NotificationViewHolder> {
    private final List<NotificationInfo> notifications;
    private OnNotificationClickListener listener;
    private final SimpleDateFormat inputFormatWithMs = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
    private final SimpleDateFormat inputFormatNoMs = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault());
    private final SimpleDateFormat outputFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());

    public interface OnNotificationClickListener {
        void onNotificationClick(NotificationInfo notification);
    }

    public NotificationAdapter(List<NotificationInfo> notifications) {
        this.notifications = notifications;
        inputFormatWithMs.setTimeZone(TimeZone.getTimeZone("UTC"));
        inputFormatNoMs.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    public void setOnNotificationClickListener(OnNotificationClickListener listener) {
        this.listener = listener;
    }

    @NonNull
    @Override
    public NotificationViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_notification, parent, false);
        return new NotificationViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull NotificationViewHolder holder, int position) {
        NotificationInfo notification = notifications.get(position);
        holder.bind(notification);
    }

    @Override
    public int getItemCount() {
        return notifications != null ? notifications.size() : 0;
    }

    @SuppressLint("NotifyDataSetChanged")
    public void updateNotifications(List<NotificationInfo> newNotifications) {
        notifications.clear();
        if (newNotifications != null) {
            notifications.addAll(newNotifications);
        }
        notifyDataSetChanged();
    }

    class NotificationViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvTitle;
        private final TextView tvMessage;
        private final TextView tvTime;
        private final View viewUnread;

        public NotificationViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tvTitle);
            tvMessage = itemView.findViewById(R.id.tvMessage);
            tvTime = itemView.findViewById(R.id.tvTime);
            viewUnread = itemView.findViewById(R.id.viewUnread);

            itemView.setOnClickListener(v -> {
                int position = getAdapterPosition();
                if (position != RecyclerView.NO_POSITION && listener != null) {
                    listener.onNotificationClick(notifications.get(position));
                }
            });
        }

        public void bind(NotificationInfo notification) {
            tvTitle.setText(notification.getTitle());
            tvMessage.setText(notification.getMessage());

            // Format time
            String timeText = "Vừa xong";
            if (notification.getCreatedAt() != null) {
                try {
                    Date date = null;
                    String dateStr = notification.getCreatedAt();
                    if (dateStr.contains(".")) {
                        date = inputFormatWithMs.parse(dateStr);
                    } else {
                        date = inputFormatNoMs.parse(dateStr);
                    }
                    if (date != null) {
                        timeText = outputFormat.format(date);
                    }
                } catch (ParseException e) {
                    timeText = notification.getCreatedAt();
                }
            }
            tvTime.setText(timeText);

            // Show unread indicator
            if (!notification.isRead()) {
                viewUnread.setVisibility(View.VISIBLE);
                itemView.setAlpha(1.0f);
            } else {
                viewUnread.setVisibility(View.GONE);
                itemView.setAlpha(0.7f);
            }
        }
    }
}

