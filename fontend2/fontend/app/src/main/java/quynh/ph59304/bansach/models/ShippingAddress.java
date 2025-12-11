package quynh.ph59304.bansach.models;

public class ShippingAddress {
    private String fullName;
    private String address;
    private String city;
    private String postalCode;
    private String phone;

    public ShippingAddress() {
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    /**
     * Format địa chỉ thành chuỗi để hiển thị
     */
    public String getFormattedAddress() {
        StringBuilder sb = new StringBuilder();
        if (fullName != null && !fullName.isEmpty()) {
            sb.append(fullName);
        }
        if (address != null && !address.isEmpty()) {
            if (sb.length() > 0) sb.append("\n");
            sb.append(address);
        }
        if (city != null && !city.isEmpty()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(city);
        }
        if (postalCode != null && !postalCode.isEmpty()) {
            if (sb.length() > 0) sb.append(" - ");
            sb.append(postalCode);
        }
        return sb.toString();
    }
}

