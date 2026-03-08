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
let districtLayers = {}; // To store Polygon layers by name
let roadLayers = []; // To store all road layers
const layers = {
    markers: L.layerGroup().addTo(map),
    boundary: L.layerGroup().addTo(map),
    roads: L.layerGroup().addTo(map),
    labels: L.layerGroup().addTo(map)
};

const districtColors = {
    "Mranggen": "#ef4444", "Karangawen": "#f97316", "Guntur": "#eab308",
    "Sayung": "#84cc16", "Karangtengah": "#22c55e", "Bonang": "#10b981",
    "Demak": "#14b8a6", "Wonosalam": "#06b6d4", "Dempet": "#0ea5e9",
    "Kebonagung": "#3b82f6", "Gajah": "#6366f1", "Karanganyar": "#8b5cf6",
    "Mijen": "#d946ef", "Wedung": "#f43f5e", "Unknown": "#94a3b8"
};

async function drawDemakBoundary() {
    layers.boundary.clearLayers();
    layers.roads.clearLayers();
    districtLayers = {};
    roadLayers = [];

    try {
        /* 
        // Load the mask (inverted polygon) to hide outside areas
        const maskRes = await fetch('/demak-mask.geojson');
        if (maskRes.ok) {
            const maskData = await maskRes.json();
            L.geoJSON(maskData, {
                style: {
                    color: 'transparent',
                    fillColor: '#cbd5e1', // Grey out outside areas
                    fillOpacity: 0.9
                },
                interactive: false
            }).addTo(layers.boundary);
        }
        */

        // Load Districts (Voronoi bounded)
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
                        fillOpacity: 0.25,
                        className: 'district-poly'
                    };
                },
                onEachFeature: function (feature, layer) {
                    const name = feature.properties.kecamatan;
                    districtLayers[name] = layer;
                    layer.on('click', () => {
                        document.getElementById('districtFilter').value = name;
                        applyFilters(); // Trigger filter and animation on map click
                    });
                    layer.bindTooltip("Kecamatan " + name, { sticky: true, className: 'map-tooltip' });
                }
            }).addTo(layers.boundary);
        }

        // Load Attributed Roads
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
        .eq('report_source', 'public')
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
    districtSelect.innerHTML = '<option value="">Semua Kecamatan</option>'; // Reset

    // Explicitly populate from the colorful known districts
    const districts = Object.keys(districtColors).filter(d => d !== 'Unknown').sort();
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
    // 1. Process Pins (Markers)
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

    // 2. Interactive Map Visuals (Polygons & Roads)
    layers.labels.clearLayers(); // Clear old labels

    if (district) {
        const selectedLayer = districtLayers[district];
        if (selectedLayer) {
            // Smooth Camera Zoom (Fly)
            map.flyToBounds(selectedLayer.getBounds(), { duration: 1.5, padding: [30, 30] });

            // Add prominent label in center
            const center = selectedLayer.getBounds().getCenter();
            const labelIcon = L.divIcon({
                className: 'district-label-active',
                html: `<div style="
                    background: rgba(255,255,255,0.95); 
                    padding: 6px 14px; 
                    border-radius: 30px; 
                    font-weight: 700; 
                    font-size: 1rem;
                    color: ${districtColors[district]}; 
                    border: 2px solid ${districtColors[district]};
                    box-shadow: 0 4px 10px rgba(0,0,0,0.15); 
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    white-space: nowrap;
                    transform: translate(-50%, -50%);
                ">Kecamatan ${district}</div>`,
                iconSize: [0, 0] // Handled by CSS transform
            });
            L.marker(center, { icon: labelIcon, interactive: false }).addTo(layers.labels);
        }

        // Highlight Selected District Polygon, Dim Others
        Object.keys(districtLayers).forEach(name => {
            const layer = districtLayers[name];
            if (name === district) {
                layer.setStyle({ fillOpacity: 0.5, weight: 3, color: '#0f172a' }); // Highlighted
            } else {
                layer.setStyle({ fillOpacity: 0.05, weight: 1, color: 'white' }); // Dimmed
            }
        });

        // Highlight Selected Roads, Dim Others
        roadLayers.forEach(r => {
            if (r.kecamatan === district) {
                r.layer.setStyle({ opacity: 1, weight: 3 }); // Highlight roads
            } else {
                r.layer.setStyle({ opacity: 0.1, weight: 1 }); // Hidden/Ghosted roads
            }
        });

    } else {
        // Reset View to Default
        map.flyTo([-6.8943, 110.6373], 11, { duration: 1.5 });

        // Restore Polygons
        Object.keys(districtLayers).forEach(name => {
            districtLayers[name].setStyle({
                fillOpacity: 0.25,
                weight: 1.5,
                color: 'white'
            });
        });

        // Restore Roads
        roadLayers.forEach(r => {
            const originalWeight = r.layer.feature.properties.type === 'primary' ? 3 : (r.layer.feature.properties.type === 'secondary' ? 2 : 1);
            r.layer.setStyle({
                opacity: 0.8,
                weight: originalWeight
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', loadMapData);