package quynh.ph59304.bansach.models;

public class ChapterContentResponse {
    private ChapterContent chapter;
    private ChapterContent previousChapter;
    private ChapterContent nextChapter;

    public ChapterContentResponse() {
    }

    public ChapterContent getChapter() {
        return chapter;
    }

    public void setChapter(ChapterContent chapter) {
        this.chapter = chapter;
    }

    public ChapterContent getPreviousChapter() {
        return previousChapter;
    }

    public void setPreviousChapter(ChapterContent previousChapter) {
        this.previousChapter = previousChapter;
    }

    public ChapterContent getNextChapter() {
        return nextChapter;
    }

    public void setNextChapter(ChapterContent nextChapter) {
        this.nextChapter = nextChapter;
    }
}

