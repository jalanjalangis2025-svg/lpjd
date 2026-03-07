// Admin Map Logic
let adminMap = null;
let adminMapLayer = null;

function initAdminMap() {
    // Only init if container is visible and not already initialized
    const container = document.getElementById('admin-map');
    if (adminMap || !container || container.offsetParent === null) return; 

    // Initialize Map
    adminMap = L.map('admin-map').setView([-6.8943, 110.6373], 12);

    // Google Maps Layer for Admin
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }).addTo(adminMap);

    adminMapLayer = L.layerGroup().addTo(adminMap);
}

function renderAdminMap(reports) {
    // Try to init, but if hidden it will fail gracefully (due to check in initAdminMap)
    initAdminMap();
    
    if (!adminMap) return; // If still not initialized (e.g. hidden), stop.
    
    adminMapLayer.clearLayers();

    reports.forEach(report => {
        const { latitude, longitude, status, id, district, reporter_name } = report;
        
        // Color coding markers based on STATUS
        let markerColor = '#f59e0b'; // Default Pending (Yellow)
        
        if (status === 'verified') {
            markerColor = '#10b981'; // Green
        } else if (status === 'rejected') {
            markerColor = '#ef4444'; // Red
        } else if (report.report_source === 'admin') {
            // Optional: If you still want to distinguish admin inputs that are pending
            markerColor = '#8b5cf6'; // Purple (Admin Pending)
        }
        
        // Status indicator in popup
        let statusBadge = '';
        if(status === 'verified') statusBadge = '<span style="color:#10b981; font-weight:bold;">Verified</span>';
        else if(status === 'rejected') statusBadge = '<span style="color:#ef4444; font-weight:bold;">Rejected</span>';
        else statusBadge = '<span style="color:#f59e0b; font-weight:bold;">Pending</span>';

        const marker = L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: markerColor,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        const popupContent = `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 200px;">
                <div style="font-weight: 700; margin-bottom: 4px;">${district}</div>
                <div style="font-size: 0.9em; color: #64748b; margin-bottom: 8px;">
                    Oleh: ${reporter_name || 'Admin'} <br>
                    Status: ${statusBadge}
                </div>
                <button onclick="openActionModal(${id})" 
                    style="width: 100%; background: #3b82f6; color: white; border: none; padding: 6px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Kelola
                </button>
            </div>
        `;

        marker.bindPopup(popupContent);
        adminMapLayer.addLayer(marker);
    });

    // Fit bounds
    if (reports.length > 0) {
        const bounds = L.latLngBounds(reports.map(r => [r.latitude, r.longitude]));
        adminMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Fix map sizing when tab is switched
function refreshMapSize() {
    if (adminMap) {
        setTimeout(() => {
            adminMap.invalidateSize();
        }, 200);
    }
}
