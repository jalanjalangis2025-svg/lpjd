// Landing Page Logic

async function fetchStats() {
    if (!window.sb) {
        setTimeout(fetchStats, 500);
        return;
    }

    try {
        const { data, error } = await sb
            .from('road_reports')
            .select('status')
            .is('deleted_at', null);

        if (error) throw error;

        const total = data.length;
        const verified = data.filter(r => r.status === 'verified').length;
        const rejected = data.filter(r => r.status === 'rejected').length;

        animateValue("totalReports", 0, total, 1500);
        animateValue("verifiedReports", 0, verified, 1500);
        animateValue("rejectedReports", 0, rejected, 1500);

    } catch (err) {
        console.error("Error fetching stats:", err);
    }
}

// Simple counter animation
function animateValue(id, start, end, duration) {
    if (start === end) {
         document.getElementById(id).textContent = end;
         return;
    }
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const obj = document.getElementById(id);
    const timer = setInterval(function() {
        current += increment;
        obj.textContent = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime > 0 ? stepTime : 10);
}

document.addEventListener('DOMContentLoaded', fetchStats);
