// Admin Map Logic (Synced with Public Map)
let adminMap = null;
let districtLayers = {};
let roadLayers = [];
const layers = {
    markers: L.layerGroup(),
    boundary: L.layerGroup(),
    roads: L.layerGroup(),
    labels: L.layerGroup()
};

const districtColors = {
    "Mranggen": "#ef4444", "Karangawen": "#f97316", "Guntur": "#eab308",
    "Sayung": "#84cc16", "Karangtengah": "#22c55e", "Bonang": "#10b981",
    "Demak": "#14b8a6", "Wonosalam": "#06b6d4", "Dempet": "#0ea5e9",
    "Kebonagung": "#3b82f6", "Gajah": "#6366f1", "Karanganyar": "#8b5cf6",
    "Mijen": "#d946ef", "Wedung": "#f43f5e", "Unknown": "#94a3b8"
};

function initAdminMap() {
    // Only init if container is visible and not already initialized
    const container = document.getElementById('admin-map');
    if (adminMap || !container || container.offsetParent === null) return;

    // Initialize Map with Canvas for performance
    adminMap = L.map('admin-map', {
        zoomControl: false,
        preferCanvas: true
    }).setView([-6.8943, 110.6373], 12);

    L.control.zoom({ position: 'bottomright' }).addTo(adminMap);

    // Google Maps Layer
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }).addTo(adminMap);

    // Add layers to map
    layers.boundary.addTo(adminMap);
    layers.roads.addTo(adminMap);
    layers.markers.addTo(adminMap);
    layers.labels.addTo(adminMap);

    // Initial boundary draw
    drawDemakBoundary();
}

async function drawDemakBoundary() {
    layers.boundary.clearLayers();
    layers.roads.clearLayers();
    districtLayers = {};
    roadLayers = [];

    try {
        /*
        // Load the mask
        const maskRes = await fetch('/demak-mask.geojson');
        if (maskRes.ok) {
            const maskData = await maskRes.json();
            L.geoJSON(maskData, {
                style: {
                    color: 'transparent',
                    fillColor: '#cbd5e1',
                    fillOpacity: 0.9
                },
                interactive: false
            }).addTo(layers.boundary);
        }
        */

        // Load Districts
        const distRes = await fetch('/demak-districts-voronoi.geojson');
        if (distRes.ok) {
            const distData = await distRes.json();
            L.geoJSON(distData, {
                style: function (feature) {
                    const name = feature.properties.kecamatan;
                    return {
                        color: 'white',
                        weight: 1.5,
                        opacity: 0.8,
                        fillColor: districtColors[name] || '#94a3b8',
                        fillOpacity: 0.25
                    };
                },
                onEachFeature: function (feature, layer) {
                    const name = feature.properties.kecamatan;
                    districtLayers[name] = layer;
                    layer.bindTooltip("Kecamatan " + name, { sticky: true, className: 'map-tooltip' });
                }
            }).addTo(layers.boundary);
        }

        // Load Roads
        const roadsRes = await fetch('/demak-roads-attributed.geojson');
        if (roadsRes.ok) {
            const roadsData = await roadsRes.json();
            L.geoJSON(roadsData, {
                style: function (feature) {
                    const name = feature.properties.kecamatan;
                    return {
                        color: districtColors[name] || '#64748b',
                        weight: feature.properties.type === 'primary' ? 3 : (feature.properties.type === 'secondary' ? 2 : 1),
                        opacity: 0.8,
                        lineCap: 'round'
                    };
                },
                onEachFeature: function (feature, layer) {
                    roadLayers.push({ layer: layer, kecamatan: feature.properties.kecamatan });
                }
            }).addTo(layers.roads);
        }
    } catch (err) {
        console.error("Error loading GeoJSON data:", err);
    }
}

function createModernPin(color) {
    return L.divIcon({
        className: 'modern-pin',
        html: `
            <svg class="pin-svg" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg">
                <path fill="${color}" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"></path>
                <circle class="pin-dot" cx="192" cy="192" r="64"></circle>
            </svg>
        `,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -40],
        tooltipAnchor: [15, -20]
    });
}

function getMarkerColor(report) {
    // Prioritize SDI/PCI category for color
    const category = (report.sdi_category || report.pci_category || '').toLowerCase();
    
    if (category.includes('baik') || category.includes('bagus')) return '#22c55e'; // Hijau
    if (category.includes('sedang')) return '#eab308'; // Kuning
    if (category.includes('ringan')) return '#f97316'; // Orange
    if (category.includes('berat') || category.includes('rusak')) return '#ef4444'; // Merah
    
    // Fallback to status color if category is empty
    if (report.status === 'verified') return '#22c55e';
    if (report.status === 'rejected') return '#ef4444';
    return '#f59e0b'; // Default Yellow for pending without category
}

function getStatusColor(status) {
    if (status === 'verified') return '#22c55e'; // Green
    if (status === 'rejected') return '#ef4444'; // Red
    return '#eab308'; // Yellow
}

function renderAdminMap(reports) {
    initAdminMap();
    if (!adminMap) return;

    layers.markers.clearLayers();

    reports.forEach(report => {
        const { latitude, longitude, status, id, district, reporter_name } = report;
        const color = getMarkerColor(report);
        const marker = L.marker([latitude, longitude], {
            icon: createModernPin(color)
        });

        let statusLabel = status === 'verified' ? 'Verified' : (status === 'rejected' ? 'Rejected' : 'Pending');

        const popupContent = `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 240px; padding: 5px;">
                <div style="font-weight: 800; margin-bottom: 4px; font-size: 1.15rem; color: #1e293b;">${district || 'Lokasi'}</div>
                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-user-edit"></i> Pelapor: ${reporter_name || 'Admin'}
                </div>

                <div style="background: #f8fafc; border-radius: 10px; padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">PCI Index</div>
                            <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${(report.pci_value !== null && report.pci_value !== undefined) ? report.pci_value : 0}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">SDI Index</div>
                            <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${(report.sdi_value !== null && report.sdi_value !== undefined) ? report.sdi_value : 0}</div>
                        </div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button onclick="openActionModal(${id})" 
                        style="width: 100%; background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.2s; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                        <i class="fas fa-cog"></i> Kelola Laporan
                    </button>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                         <span style="background: ${color}15; color: ${color}; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${color}30;">
                            ${statusLabel}
                        </span>
                        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">ID #${id}</span>
                    </div>
                </div>
            </div>
        `;

        marker.bindTooltip(`ADMIN VIEW: ${district}`, { className: 'modern-tooltip' });
        marker.bindPopup(popupContent);
        layers.markers.addLayer(marker);
    });


}

function refreshMapSize() {
    if (adminMap) {
        setTimeout(() => {
            adminMap.invalidateSize();
        }, 200);
    }
}
