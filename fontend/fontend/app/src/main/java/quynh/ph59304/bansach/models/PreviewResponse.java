package quynh.ph59304.bansach.models;

public class PreviewResponse {
    private PreviewSummary summary;
    private boolean hasAccess;

    public PreviewResponse() {
    }

    public PreviewSummary getSummary() {
        return summary;
    }

    public void setSummary(PreviewSummary summary) {
        this.summary = summary;
    }

    public boolean isHasAccess() {
        return hasAccess;
    }

    public void setHasAccess(boolean hasAccess) {
        this.hasAccess = hasAccess;
    }
}

