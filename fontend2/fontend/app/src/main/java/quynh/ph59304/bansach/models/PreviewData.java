package quynh.ph59304.bansach.models;

import java.util.List;

public class PreviewData {
    private BookInfo book;
    private int totalChapters;
    private List<PreviewChapter> chapters;

    public BookInfo getBook() {
        return book;
    }

    public void setBook(BookInfo book) {
        this.book = book;
    }

    public int getTotalChapters() {
        return totalChapters;
    }

    public void setTotalChapters(int totalChapters) {
        this.totalChapters = totalChapters;
    }

    public List<PreviewChapter> getChapters() {
        return chapters;
    }

    public void setChapters(List<PreviewChapter> chapters) {
        this.chapters = chapters;
    }

    public static class BookInfo {
        private String id;
        private String title;
        private String author;

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

        public String getAuthor() {
            return author;
        }

        public void setAuthor(String author) {
            this.author = author;
        }
    }
}

