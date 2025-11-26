// Coin Transactions Admin Page JavaScript

// Coin Transactions Admin Page JavaScript

// Initialize daily stats chart
function initializeDailyChart() {
    const chartCanvas = document.getElementById('dailyChart');
    if (!chartCanvas) return;
    
    const chartDataAttr = chartCanvas.getAttribute('data-chart-data');
    if (!chartDataAttr) return;
    
    try {
        const dailyStatsData = JSON.parse(decodeURIComponent(chartDataAttr));
        
        if (dailyStatsData && dailyStatsData.length > 0) {
            const ctx = chartCanvas.getContext('2d');
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyStatsData.map(function(d) { return d._id.date; }),
                    datasets: [{
                        label: 'Nạp Coin',
                        data: dailyStatsData.map(function(d) { return d.deposits; }),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        tension: 0.1
                    }, {
                        label: 'Chi tiêu Coin',
                        data: dailyStatsData.map(function(d) { return d.purchases; }),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error parsing chart data:', error);
    }
}

// Initialize user search functionality
function initializeUserSearch() {
    var searchTimeout;
    var userSearchInput = document.getElementById('userSearch');
    var userSearchResults = document.getElementById('userSearchResults');
    var userIdInput = document.getElementById('userId');

    if (!userSearchInput) return;

    userSearchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        var query = this.value.trim();
        
        if (query.length < 2) {
            userSearchResults.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(function() {
            fetch('/admin/api/coin-transactions/search-users?q=' + encodeURIComponent(query))
                .then(function(response) { 
                    return response.json(); 
                })
                .then(function(users) {
                    var html = '';
                    if (users.length > 0) {
                        users.forEach(function(user) {
                            html += '<div class="border p-2 mb-1 rounded user-option" style="cursor: pointer;" data-user-id="' + user.id + '" data-username="' + user.username + '">' +
                                '<strong>' + user.username + '</strong> (' + user.email + ')' +
                                '<small class="text-muted d-block">' + user.fullName + ' | Số dư: ' + user.coinBalance.toLocaleString() + ' coin</small>' +
                                '</div>';
                        });
                    } else {
                        html = '<div class="text-muted">Không tìm thấy người dùng</div>';
                    }
                    
                    userSearchResults.innerHTML = html;
                    
                    // Add click handlers
                    var userOptions = document.querySelectorAll('.user-option');
                    userOptions.forEach(function(option) {
                        option.addEventListener('click', function() {
                            var userId = this.dataset.userId;
                            var username = this.dataset.username;
                            
                            userIdInput.value = userId;
                            userSearchInput.value = username;
                            userSearchResults.innerHTML = '';
                        });
                    });
                })
                .catch(function(error) {
                    console.error('Error searching users:', error);
                    userSearchResults.innerHTML = '<div class="text-danger">Lỗi khi tìm kiếm người dùng</div>';
                });
        }, 300);
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeUserSearch();
    initializeDailyChart();
});