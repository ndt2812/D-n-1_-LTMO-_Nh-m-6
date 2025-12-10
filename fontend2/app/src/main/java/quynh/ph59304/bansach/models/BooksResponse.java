package quynh.ph59304.bansach.models;

import java.util.List;

public class BooksResponse {
    private List<Book> books;
    private List<Category> categories;

    public List<Book> getBooks() {
        return books;
    }

    public void setBooks(List<Book> books) {
        this.books = books;
    }

    public List<Category> getCategories() {
        return categories;
    }

    public void setCategories(List<Category> categories) {
        this.categories = categories;
    }
}
