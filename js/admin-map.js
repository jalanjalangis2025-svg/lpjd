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

    // Initialize Map
    adminMap = L.map('admin-map', {
        zoomControl: false
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

function getStatusColor(status) {
    if (status === 'verified') return '#10b981';
    if (status === 'rejected') return '#ef4444';
    return '#f59e0b';
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

function renderAdminMap(reports) {
    initAdminMap();
    if (!adminMap) return;

    layers.markers.clearLayers();

    reports.forEach(report => {
        const { latitude, longitude, status, id, district, reporter_name } = report;
        const color = getStatusColor(status);

        const marker = L.marker([latitude, longitude], {
            icon: createMarkerIcon(status)
        });

        // Status indicator in popup
        let statusLabel = status === 'verified' ? 'Verified' : (status === 'rejected' ? 'Rejected' : 'Pending');

        const popupContent = `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 200px;">
                <div style="font-weight: 700; margin-bottom: 4px; font-size: 1.1rem;">${district || 'Lokasi'}</div>
                <div style="font-size: 0.9em; color: #64748b; margin-bottom: 12px;">
                    <i class="fas fa-user-edit"></i> Pelapor: ${reporter_name || 'Admin'} <br>
                    <span style="
                        display: inline-block; 
                        margin-top: 6px; 
                        background: ${color}20; 
                        color: ${color}; 
                        padding: 2px 8px; 
                        border-radius: 4px; 
                        font-weight: 700;
                        font-size: 0.8rem;
                        border: 1px solid ${color}40;
                    ">${statusLabel}</span>
                </div>
                <button onclick="openActionModal(${id})" 
                    style="width: 100%; background: #3b82f6; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.2s;">
                    <i class="fas fa-cog"></i> Kelola Laporan
                </button>
            </div>
        `;

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
