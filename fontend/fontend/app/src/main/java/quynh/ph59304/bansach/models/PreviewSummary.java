package quynh.ph59304.bansach.models;

import java.util.List;

public class PreviewSummary {
    private String bookId;
    private String bookTitle;
    private int totalChapters;
    private int freeChapters;
    private List<PreviewChapter> chapters;

    public PreviewSummary() {
    }

    public String getBookId() {
        return bookId;
    }

    public void setBookId(String bookId) {
        this.bookId = bookId;
    }

    public String getBookTitle() {
        return bookTitle;
    }

    public void setBookTitle(String bookTitle) {
        this.bookTitle = bookTitle;
    }

    public int getTotalChapters() {
        return totalChapters;
    }

    public void setTotalChapters(int totalChapters) {
        this.totalChapters = totalChapters;
    }

    public int getFreeChapters() {
        return freeChapters;
    }

    public void setFreeChapters(int freeChapters) {
        this.freeChapters = freeChapters;
    }

    public List<PreviewChapter> getChapters() {
        return chapters;
    }

    public void setChapters(List<PreviewChapter> chapters) {
        this.chapters = chapters;
    }
}

