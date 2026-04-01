// Admin Map Logic (Synced with Public Map)
let adminMap = null;
let districtLayers = {};
let roadLayers = [];
const layers = {
    markers: L.layerGroup(),
    boundary: L.layerGroup(),
    roads: L.layerGroup(),
    labels: L.layerGroup(),
    roadConditions: L.layerGroup()
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
    layers.roadConditions.addTo(adminMap);
    layers.markers.addTo(adminMap);
    layers.labels.addTo(adminMap);

    // Load data
    loadClipGajahData();

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

function getConditionColor(condition) {
    const c = (condition || '').toLowerCase();
    if (c.includes('bagus') || c.includes('baik')) return '#22c55e'; // Green
    if (c.includes('sedang')) return '#eab308'; // Yellow
    if (c.includes('ringan')) return '#f97316'; // Orange
    if (c.includes('berat') || c.includes('rusak')) return '#ef4444'; // Red
    return '#94a3b8'; // Grey default
}

async function loadClipGajahData() {
    try {
        const res = await fetch('/hasilclipgajah.geojson');
        if (!res.ok) return;
        const data = await res.json();

        // High-Visibility Outline Layer (White background)
        L.geoJSON(data, {
            style: function () {
                return {
                    color: 'white',
                    weight: 12, // Refined outline
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round',
                    interactive: false
                };
            }
        }).addTo(layers.roadConditions);

        // Main Condition Layer
        L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: getConditionColor(feature.properties.Jenis_keru),
                    weight: 8, // Refined thickness
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round',
                    interactive: true
                };
            },
            onEachFeature: function (feature, layer) {
                const coords = feature.geometry.type === 'LineString' 
                    ? feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)]
                    : feature.geometry.coordinates[0][Math.floor(feature.geometry.coordinates[0].length / 2)];
                
                const color = getConditionColor(feature.properties.Jenis_keru);
                const latLng = [coords[1], coords[0]];

                const popup = `
                    <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 260px; padding: 5px;">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 5px; font-size: 1.15rem; line-height: 1.2;">${feature.properties.Name}</div>
                        <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
                             <span style="background: ${color}15; color: ${color}; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid ${color}30;">${feature.properties.Jenis_keru}</span>
                             <span style="background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid #e2e8f0;">Ruas #${feature.properties.No_Ruas}</span>
                        </div>
                        <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px; display: flex; justify-content: space-around;">
                            <div style="text-align: center;">
                                <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">SDI INDEX</div>
                                <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${feature.properties.SDI || feature.properties.Skor_kerus || 0}</div>
                            </div>
                            <div style="width: 1px; background: #e2e8f0;"></div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">PCI INDEX</div>
                                <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${feature.properties.PCI || 0}</div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${latLng[0]},${latLng[1]}" target="_blank" style="text-decoration: none; width: 100%; background: #3b82f6; color: white; text-align: center; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i class="fas fa-directions"></i> Navigasi Maps
                            </a>
                        </div>
                    </div>
                `;
                layer.bindPopup(popup);
                
                layer.bindTooltip(`RUAS: ${feature.properties.No_Ruas}`, { sticky: true });
            }
        }).addTo(layers.roadConditions);
    } catch (err) {
        console.error("Error loading clip gajah data in admin map:", err);
    }
}

function createModernPin(color, source = null) {
    let iconHtml = '';
    if (source === 'public') {
        iconHtml = '<i class="fas fa-user" style="color: white; font-size: 10px; position: absolute; top: 22px; left: 50%; transform: translateX(-50%) rotate(20deg); text-shadow: 0 1px 2px rgba(0,0,0,0.5);"></i>';
    } else if (source === 'admin') {
        iconHtml = '<i class="fas fa-tools" style="color: white; font-size: 10px; position: absolute; top: 22px; left: 50%; transform: translateX(-50%) rotate(20deg); text-shadow: 0 1px 2px rgba(0,0,0,0.5);"></i>';
    }

    return L.divIcon({
        className: 'pushpin-marker',
        html: `
            <svg viewBox="0 0 100 100" class="pushpin-svg" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 95 L50 65" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round" />
                <path d="M50 95 L50 65" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" transform="translate(1,0)" />
                <g transform="rotate(-20 50 65)">
                    <ellipse cx="50" cy="58" rx="20" ry="10" fill="${color}" />
                    <ellipse cx="50" cy="56" rx="20" ry="10" fill="${color}" style="filter: brightness(1.2);" />
                    <rect x="36" y="30" width="28" height="26" fill="${color}" />
                    <rect x="36" y="30" width="6" height="26" fill="rgba(255,255,255,0.3)" /> 
                    <rect x="58" y="30" width="6" height="26" fill="rgba(0,0,0,0.15)" /> 
                    <ellipse cx="50" cy="30" rx="24" ry="12" fill="${color}" style="filter: brightness(0.85);" />
                    <ellipse cx="50" cy="25" rx="24" ry="12" fill="${color}" />
                    <ellipse cx="40" cy="22" rx="10" ry="4" fill="rgba(255,255,255,0.45)" />
                </g>
            </svg>
            ${iconHtml}
        `,
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -40],
        tooltipAnchor: [20, -20]
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
        const { latitude, longitude, status, id, district, reporter_name, report_source } = report;
        const color = getMarkerColor(report);
        const marker = L.marker([latitude, longitude], {
            icon: createModernPin(color, report_source)
        });

        let statusLabel = status === 'verified' ? 'Verified' : (status === 'rejected' ? 'Rejected' : 'Pending');

        const popupContent = `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 260px; padding: 5px;">
                <div style="font-weight: 800; font-size: 1.15rem; color: #1e293b; margin-bottom: 5px; line-height: 1.2;">${district || 'Lokasi'}</div>
                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-user-edit"></i> Pelapor: ${reporter_name || 'Admin'}
                </div>

                <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 15px; display: flex; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">SDI INDEX</div>
                        <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${(report.sdi_value !== null && report.sdi_value !== undefined) ? report.sdi_value : 0}</div>
                    </div>
                    <div style="width: 1px; background: #e2e8f0;"></div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">PCI INDEX</div>
                        <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${(report.pci_value !== null && report.pci_value !== undefined) ? report.pci_value : 0}</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="openActionModal(${id})" 
                        style="width: 100%; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-cog"></i> Kelola Laporan
                    </button>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px;">
                         <span style="background: ${color}15; color: ${color}; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${color}30;">
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
