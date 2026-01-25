// Initialize Map
const map = L.map('map', {
    zoomControl: false // Move zoom control if needed, or keep default
}).setView([-6.8943, 110.6373], 11);

// Add Zoom Control to bottom right or custom position if needed
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Google Streets Layer
const googleStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps'
}).addTo(map);

// Storage
let allReports = [];
const layers = {
    markers: L.layerGroup().addTo(map),
    boundary: L.layerGroup().addTo(map)
};

// Demak Boundary (Simplified Polygon)
// In a real app, this would be a detailed GeoJSON loaded from file.
const demakBoundaryCoords = [
    [-6.82, 110.45], [-6.80, 110.55], [-6.78, 110.65], [-6.80, 110.75],
    [-6.85, 110.85], [-6.95, 110.82], [-7.05, 110.75], [-7.08, 110.60],
    [-7.00, 110.50], [-6.95, 110.42], [-6.82, 110.45]
];

function drawDemakBoundary() {
    const polygon = L.polygon(demakBoundaryCoords, {
        color: '#0056b3',
        weight: 3,
        opacity: 0.6,
        fillColor: '#0056b3',
        fillOpacity: 0.05,
        dashArray: '5, 10'
    });
    
    // Add "Kabupaten Demak" label center
    const center = polygon.getBounds().getCenter();
    // Optional: Add a text label marker
    
    layers.boundary.clearLayers();
    layers.boundary.addLayer(polygon);
}

// Color logic for Status
function getStatusColor(status) {
    if (status === 'verified') return '#10b981'; // Green
    if (status === 'rejected') return '#ef4444'; // Red
    return '#f59e0b'; // Yellow/Orange (Pending)
}

function createMarkerIcon(status) {
    const color = getStatusColor(status);
    return L.divIcon({
        className: 'custom-pin',
        html: `<div style="
            background-color: ${color};
            width: 16px; 
            height: 16px; 
            border-radius: 50%; 
            border: 2px solid white; 
            box-shadow: 0 0 10px ${color};"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function createPopup(report) {
    const statusLabel = report.status === 'verified' ? 'Terverifikasi' :
                       report.status === 'rejected' ? 'Ditolak' : 'Menunggu';
    
    const color = getStatusColor(report.status);

    return `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 5px;">${report.district || 'Lokasi'}</div>
            <div style="color: #64748b; font-size: 0.9rem; margin-bottom: 10px;">
                <i class="fas fa-map-marker-alt"></i> ${report.location_details || '-'}
            </div>
            
            ${report.photo_url ? `<img src="${report.photo_url}" style="width: 100%; border-radius: 8px; margin-bottom: 10px; max-height: 150px; object-fit: cover;">` : ''}
            
            <p style="margin: 0 0 10px 0; color: #334155; font-size: 0.95rem;">${report.description || '-'}</p>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                <span style="
                    background: ${color}20; 
                    color: ${color}; 
                    padding: 4px 10px; 
                    border-radius: 20px; 
                    font-size: 0.8rem; 
                    font-weight: 600;
                    border: 1px solid ${color}40;
                ">
                    ${statusLabel}
                </span>
                <span style="font-size: 0.8rem; color: #94a3b8;">${new Date(report.created_at).toLocaleDateString('id-ID')}</span>
            </div>
        </div>
    `;
}

async function loadMapData() {
    // Show rough boundary immediately
    drawDemakBoundary();
    
    if (!window.sb) {
        setTimeout(loadMapData, 500);
        return;
    }

    const { data, error } = await sb
        .from('road_reports')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading data", error);
        return;
    }

    allReports = data || [];
    
    populateDistrictFilter();
    applyFilters();
}

function populateDistrictFilter() {
    const districtSelect = document.getElementById('districtFilter');
    // Get unique districts
    const districts = [...new Set(allReports.map(r => r.district).filter(Boolean))].sort();
    
    districts.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        districtSelect.appendChild(option);
    });
}

function applyFilters() {
    const district = document.getElementById('districtFilter').value;
    const status = document.getElementById('statusFilter').value;
    
    layers.markers.clearLayers();
    
    const filtered = allReports.filter(r => {
        const matchDistrict = district ? r.district === district : true;
        const matchStatus = status === 'all' ? true : r.status === status;
        return matchDistrict && matchStatus;
    });

    filtered.forEach(r => {
        const marker = L.marker([r.latitude, r.longitude], {
            icon: createMarkerIcon(r.status)
        });
        marker.bindPopup(createPopup(r));
        layers.markers.addLayer(marker);
    });

    // If district selected, zoom to it
    if (district && filtered.length > 0) {
        const group = L.featureGroup(layers.markers.getLayers());
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    } else if (!district) {
        // Reset view to Demak
         map.setView([-6.8943, 110.6373], 11);
    }
}

document.addEventListener('DOMContentLoaded', loadMapData);