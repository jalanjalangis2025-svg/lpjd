const map = L.map('map', {
    zoomControl: false,
    preferCanvas: true
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
    labels: L.layerGroup().addTo(map),
    roadConditions: L.layerGroup(),
    graticule: L.layerGroup() // New grid layer
};

let clipGajahLayer = null;
const mapContainer = document.getElementById('map');

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

function createModernPin(color) {
    return L.divIcon({
        className: 'pushpin-marker',
        html: `
            <svg viewBox="0 0 100 100" class="pushpin-svg" xmlns="http://www.w3.org/2000/svg">
                <!-- Metallic Needle -->
                <path d="M50 95 L50 65" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round" />
                <path d="M50 95 L50 65" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" transform="translate(1,0)" />
                
                <!-- Pushpin Cylinder & Caps (3D effect) -->
                <g transform="rotate(-20 50 65)">
                    <!-- Lower Cap -->
                    <ellipse cx="50" cy="58" rx="20" ry="10" fill="${color}" />
                    <ellipse cx="50" cy="56" rx="20" ry="10" fill="${color}" style="filter: brightness(1.2);" />
                    
                    <!-- Cylinder Body -->
                    <rect x="36" y="30" width="28" height="26" fill="${color}" />
                    <rect x="36" y="30" width="6" height="26" fill="rgba(255,255,255,0.3)" /> 
                    <rect x="58" y="30" width="6" height="26" fill="rgba(0,0,0,0.15)" /> 
                    
                    <!-- Upper Top Cap -->
                    <ellipse cx="50" cy="30" rx="24" ry="12" fill="${color}" style="filter: brightness(0.85);" />
                    <ellipse cx="50" cy="25" rx="24" ry="12" fill="${color}" />
                    
                    <!-- Highlights -->
                    <ellipse cx="40" cy="22" rx="10" ry="4" fill="rgba(255,255,255,0.45)" />
                </g>
            </svg>
        `,
        iconSize: [45, 45],
        iconAnchor: [22, 45], // Pointy end of the needle
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

function createPopup(report) {
    const statusLabel = report.status === 'verified' ? 'Terverifikasi' :
        report.status === 'rejected' ? 'Ditolak' : 'Menunggu';
    const color = getStatusColor(report.status);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;

    return `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 260px; padding: 5px;">
            <div style="font-weight: 800; font-size: 1.15rem; color: #1e293b; margin-bottom: 5px; line-height: 1.2;">${report.district || 'Data Jalan'}</div>
            <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
                 <span style="background: ${color}15; color: ${color}; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid ${color}30;">
                    ${statusLabel}
                 </span>
                 <span style="background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid #e2e8f0;">
                    ${new Date(report.created_at).toLocaleDateString('id-ID')}
                 </span>
            </div>
            
            ${report.photo_url ? `<img src="${report.photo_url}" style="width: 100%; border-radius: 12px; margin-bottom: 12px; max-height: 160px; object-fit: cover; border: 1px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">` : ''}
            
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

            <div style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin-bottom: 15px; background: #fff; padding: 10px; border-radius: 8px; border: 1px dashed #e2e8f0;">
                <i class="fas fa-quote-left" style="color: #cbd5e1; font-size: 0.7rem; margin-right: 5px;"></i>
                ${report.description || 'Tidak ada deskripsi tambahan.'}
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <a href="${googleMapsUrl}" target="_blank" style="text-decoration: none; width: 100%; background: #3b82f6; color: white; text-align: center; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-directions"></i> Navigasi Maps
                </a>
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
    
    // Load road segments by default alongside reports
    if (!clipGajahLayer) {
        await loadClipGajahData();
        layers.roadConditions.addTo(map);
    }
    
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

// --- ROAD CONDITION LOGIC (ArcMap Style) ---

function getConditionColor(condition) {
    const c = (condition || '').toLowerCase();
    if (c.includes('bagus') || c.includes('baik')) return '#22c55e'; // Green
    if (c.includes('sedang')) return '#eab308'; // Yellow
    if (c.includes('ringan')) return '#f97316'; // Orange
    if (c.includes('berat') || c.includes('rusak')) return '#ef4444'; // Red
    return '#94a3b8'; // Grey default
}

function getRobustProperty(props, keys, defaultValue = null) {
    if (!props) return defaultValue;
    const lowerKeys = keys.map(k => k.toLowerCase());
    for (const key in props) {
        if (lowerKeys.includes(key.toLowerCase())) {
            return props[key];
        }
    }
    return defaultValue;
}

function drawGraticule() {
    layers.graticule.clearLayers();
    const bounds = map.getBounds();
    const step = 0.05; // 0.05 degrees grid

    for (let lat = Math.floor(bounds.getSouth() / step) * step; lat <= bounds.getNorth(); lat += step) {
        L.polyline([[lat, bounds.getWest()], [lat, bounds.getEast()]], { color: '#e2e8f0', weight: 1, interactive: false }).addTo(layers.graticule);
    }
    for (let lng = Math.floor(bounds.getWest() / step) * step; lng <= bounds.getEast(); lng += step) {
        L.polyline([[bounds.getSouth(), lng], [bounds.getNorth(), lng]], { color: '#e2e8f0', weight: 1, interactive: false }).addTo(layers.graticule);
    }
}

async function loadClipGajahData() {
    // Clear existing to avoid duplicates
    layers.roadConditions.clearLayers();
    
    // List of files to attempt loading (supports multiple GIS exports)
    const geojsonFiles = ['/hasilclipgajah.geojson', '/clipan.geojson'];

    for (const file of geojsonFiles) {
        try {
            const res = await fetch(file);
            if (!res.ok) continue;
            
            const data = await res.json();
            console.log(`Successfully loaded public road data from: ${file}`);

            // 1. High-Visibility Outline Layer (White background)
            // Added for consistency with admin-map.js and better visibility
            L.geoJSON(data, {
                style: function () {
                    return {
                        color: 'white',
                        weight: 12,
                        opacity: 1,
                        lineCap: 'round',
                        lineJoin: 'round',
                        interactive: false
                    };
                }
            }).addTo(layers.roadConditions);

            // 2. Main Condition Layer (Colored top)
            L.geoJSON(data, {
                style: function (feature) {
                    const sdiCategory = getRobustProperty(feature.properties, ['SDI_Category', 'Jenis_keru', 'Jenis_ke_1', 'jenis_keru', 'Kondisi', 'kondisi'], 'Unknown');
                    return {
                        color: getConditionColor(sdiCategory),
                        weight: 8, // Refined thickness
                        opacity: 1,
                        lineCap: 'round',
                        lineJoin: 'round',
                        interactive: true
                    };
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties || {};
                    const coords = feature.geometry.type === 'LineString' 
                        ? feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)]
                        : (feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates[0][Math.floor(feature.geometry.coordinates[0].length / 2)] : null);
                    
                    if (!coords) return;

                    const sdiValue = getRobustProperty(props, ['SDI', 'sdi_value', 'Skor_kerus', 'Skor_Kerus', 'skor_kerus', 'SKOR'], 0);
                    const sdiCategory = getRobustProperty(props, ['SDI_Category', 'Jenis_keru', 'Jenis_ke_1', 'jenis_keru', 'Kondisi', 'kondisi'], 'Unknown');
                    const pciValue = getRobustProperty(props, ['PCI', 'pci_value', 'PCI_Index'], 0);
                    const noRuas = getRobustProperty(props, ['No_Ruas', 'NO_RUA', 'No_Ruas_J', 'Ruas_ID'], '-');
                    const name = getRobustProperty(props, ['Name', 'Nama_Ruas', 'NAMRUA', 'Keterangan'], 'Tanpa Nama');

                    const latLng = [coords[1], coords[0]];
                    const color = getConditionColor(sdiCategory);
                    const marker = L.marker(latLng, { 
                        icon: createModernPin(color),
                        interactive: true 
                    });
                    
                    const popup = `
                        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 260px; padding: 5px;">
                            <div style="font-weight: 800; color: #1e293b; margin-bottom: 5px; font-size: 1.15rem; line-height: 1.2;">${name}</div>
                            <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
                                 <span style="background: ${color}15; color: ${color}; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid ${color}30;">${sdiCategory}</span>
                                 <span style="background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid #e2e8f0;">Ruas #${noRuas}</span>
                            </div>
                            <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px; display: flex; justify-content: space-around;">
                                <div style="text-align: center;">
                                    <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">SDI INDEX</div>
                                    <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${sdiValue}</div>
                                </div>
                                <div style="width: 1px; background: #e2e8f0;"></div>
                                <div style="text-align: center;">
                                    <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">PCI INDEX</div>
                                    <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${pciValue}</div>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <a href="https://www.google.com/maps/dir/?api=1&destination=${latLng[0]},${latLng[1]}" target="_blank" style="text-decoration: none; width: 100%; background: #3b82f6; color: white; text-align: center; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="fas fa-directions"></i> Navigasi Maps
                                </a>
                            </div>
                        </div>
                    `;
                    
                    const tooltipText = `<div style="font-size: 0.8rem; opacity: 0.8;">KONDISI JALAN:</div><div style="font-size: 1rem;">${sdiCategory.toUpperCase()}</div>`;
                    
                    // Determine class for colored tooltip
                    let tooltipClass = 'modern-tooltip';
                    const c = sdiCategory.toLowerCase();
                    if (c.includes('bagus') || c.includes('baik')) tooltipClass += ' bagus';
                    else if (c.includes('sedang')) tooltipClass += ' sedang';
                    else if (c.includes('ringan')) tooltipClass += ' ringan';
                    else if (c.includes('berat') || c.includes('rusak')) tooltipClass += ' berat';

                    const tooltipOptions = { 
                        className: tooltipClass, 
                        offset: [0, -10],
                        sticky: true,
                        permanent: false, // Back to hover-only
                        direction: 'top',
                        opacity: 1
                    };

                    layer.bindTooltip(tooltipText, tooltipOptions);
                    marker.bindTooltip(tooltipText, tooltipOptions);
                    
                    layer.bindPopup(popup);
                    marker.bindPopup(popup);
                    
                    layers.roadConditions.addLayer(layer);
                    layers.roadConditions.addLayer(marker);
                }
            }).addTo(layers.roadConditions);
            
            clipGajahLayer = true;

        } catch (err) {
            console.error(`Error loading GeoJSON from ${file}:`, err);
        }
    }
}

function toggleConditionLayer() {
    const isChecked = document.getElementById('conditionToggle').checked;

    if (isChecked) {
        // Mode Fokus Kondisi Jalan (Garis Menonjol)
        mapContainer.classList.add('paper-mode');
        googleStreets.setOpacity(0); 
        
        layers.roadConditions.addTo(map);
        drawGraticule();
        layers.graticule.addTo(map);
        
        // Faded context roads
        roadLayers.forEach(r => {
            r.layer.setStyle({ color: '#ccc', weight: 1.5, opacity: 0.2 });
        });
        
        // Hide markers for focus
        layers.markers.remove();
    } else {
        // Mode Standar (Markers + Garis Ruas)
        mapContainer.classList.remove('paper-mode');
        googleStreets.setOpacity(1); 
        
        layers.roadConditions.addTo(map); // Keep lines visible but less dominant
        layers.graticule.remove();
        layers.markers.addTo(map);
        
        applyFilters(); 
    }
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
        const color = getMarkerColor(r);
        const marker = L.marker([r.latitude, r.longitude], {
            icon: createModernPin(color)
        });
        
        marker.bindTooltip(`LAPORAN: ${r.district}`, { className: 'modern-tooltip' });
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

map.on('moveend', () => {
    const toggle = document.getElementById('conditionToggle');
    if (toggle && toggle.checked) {
        drawGraticule();
    }
});

// Initial check after load
setTimeout(loadMapData, 500);