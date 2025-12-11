package quynh.ph59304.bansach.models;

public class PreviewResponse {
    private boolean success;
    private PreviewData preview;
    private String message;

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public PreviewData getPreview() {
        return preview;
    }

    public void setPreview(PreviewData preview) {
        this.preview = preview;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}

