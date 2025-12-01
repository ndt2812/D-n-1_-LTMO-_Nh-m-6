package quynh.ph59304.bansach.adapters;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;
import java.util.Locale;

import quynh.ph59304.bansach.R;
import quynh.ph59304.bansach.models.PreviewChapter;

public class PreviewChapterAdapter extends RecyclerView.Adapter<PreviewChapterAdapter.PreviewViewHolder> {
    private List<PreviewChapter> chapters;

    public PreviewChapterAdapter(List<PreviewChapter> chapters) {
        this.chapters = chapters;
    }

    public void updateChapters(List<PreviewChapter> newChapters) {
        this.chapters = newChapters;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public PreviewViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_preview_chapter, parent, false);
        return new PreviewViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull PreviewViewHolder holder, int position) {
        holder.bind(chapters.get(position));
    }

    @Override
    public int getItemCount() {
        return chapters != null ? chapters.size() : 0;
    }

    static class PreviewViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvChapterTitle;
        private final TextView tvChapterContent;

        PreviewViewHolder(@NonNull View itemView) {
            super(itemView);
            tvChapterTitle = itemView.findViewById(R.id.tvChapterTitle);
            tvChapterContent = itemView.findViewById(R.id.tvChapterContent);
        }

        void bind(PreviewChapter chapter) {
            tvChapterTitle.setText(String.format(Locale.getDefault(), "Chương %d: %s",
                    chapter.getChapterNumber(), chapter.getTitle()));
            tvChapterContent.setText(chapter.getContent());
        }
    }
}

