package quynh.ph59304.bansach.models;

import com.google.gson.annotations.SerializedName;

public class PreviewChapter {
    @SerializedName("_id")
    private String id;
    private String title;
    private int chapterNumber;
    private boolean isFree;
    private boolean isPurchased;

    public PreviewChapter() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getChapterNumber() {
        return chapterNumber;
    }

    public void setChapterNumber(int chapterNumber) {
        this.chapterNumber = chapterNumber;
    }

    public boolean isFree() {
        return isFree;
    }

    public void setFree(boolean free) {
        isFree = free;
    }

    public boolean isPurchased() {
        return isPurchased;
    }

    public void setPurchased(boolean purchased) {
        isPurchased = purchased;
    }
}

