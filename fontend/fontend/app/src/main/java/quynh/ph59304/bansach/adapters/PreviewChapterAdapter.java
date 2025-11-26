package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.models.PreviewChapter;

public class PreviewChapterAdapter extends RecyclerView.Adapter<PreviewChapterAdapter.ChapterViewHolder> {
    private List<PreviewChapter> chapters;
    private OnChapterClickListener listener;

    public interface OnChapterClickListener {
        void onChapterClick(PreviewChapter chapter);
    }

    public PreviewChapterAdapter(List<PreviewChapter> chapters, OnChapterClickListener listener) {
        this.chapters = chapters;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ChapterViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_preview_chapter, parent, false);
        return new ChapterViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ChapterViewHolder holder, int position) {
        PreviewChapter chapter = chapters.get(position);
        holder.bind(chapter);
    }

    @Override
    public int getItemCount() {
        return chapters != null ? chapters.size() : 0;
    }

    public void updateChapters(List<PreviewChapter> newChapters) {
        this.chapters = newChapters;
        notifyDataSetChanged();
    }

    class ChapterViewHolder extends RecyclerView.ViewHolder {
        private TextView tvChapterTitle;
        private TextView tvChapterNumber;
        private ImageView imgLock;
        private View viewFree;

        public ChapterViewHolder(@NonNull View itemView) {
            super(itemView);
            tvChapterTitle = itemView.findViewById(R.id.tvChapterTitle);
            tvChapterNumber = itemView.findViewById(R.id.tvChapterNumber);
            imgLock = itemView.findViewById(R.id.imgLock);
            viewFree = itemView.findViewById(R.id.viewFree);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    PreviewChapter chapter = chapters.get(getAdapterPosition());
                    if (chapter.isFree() || chapter.isPurchased()) {
                        listener.onChapterClick(chapter);
                    }
                }
            });
        }

        public void bind(PreviewChapter chapter) {
            tvChapterTitle.setText(chapter.getTitle());
            tvChapterNumber.setText(String.format("Chương %d", chapter.getChapterNumber()));

            boolean canRead = chapter.isFree() || chapter.isPurchased();
            imgLock.setVisibility(canRead ? View.GONE : View.VISIBLE);
            viewFree.setVisibility(chapter.isFree() ? View.VISIBLE : View.GONE);
            itemView.setAlpha(canRead ? 1.0f : 0.6f);
        }
    }
}

