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
let currentMapConditionView = 'pci'; // Default to PCI as requested
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
    // Premium Palette for markers
    const PALETTE = {
        teal: '#14b8a6',
        orange: '#f59e0b',
        red: '#f43f5e',
        blue: '#3b82f6'
    };

    const category = (report.sdi_category || report.pci_category || '').toLowerCase();
    
    if (category.includes('baik') || category.includes('bagus')) return PALETTE.teal;
    if (category.includes('sedang')) return PALETTE.orange;
    if (category.includes('ringan')) return '#fb923c'; // Vivid Orange
    if (category.includes('berat') || category.includes('rusak')) return PALETTE.red;
    
    // Fallback to status color
    if (report.status === 'verified') return PALETTE.teal;
    if (report.status === 'rejected') return PALETTE.red;
    return PALETTE.orange; 
}

function getStatusColor(status) {
    if (status === 'verified') return '#14b8a6'; // Teal
    if (status === 'rejected') return '#f43f5e'; // Coral Red
    return '#f59e0b'; // Orange
}

function createPopup(report) {
    const statusLabel = report.status === 'verified' ? 'Terverifikasi' :
        report.status === 'rejected' ? 'Ditolak' : 'Menunggu';
    const color = getStatusColor(report.status);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;

    return `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 280px; padding: 12px; background: white; border-radius: 20px;">
            <div style="font-weight: 800; font-size: 1.2rem; color: #0f172a; margin-bottom: 8px; line-height: 1.2; letter-spacing: -0.5px;">${report.district || 'Data Jalan'}</div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                 <span style="background: ${color}15; color: ${color}; padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800; border: 1px solid ${color}30; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${statusLabel}
                 </span>
                 <span style="background: #f8fafc; color: #94a3b8; padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 700; border: 1px solid #f1f5f9;">
                    <i class="far fa-calendar-alt"></i> ${new Date(report.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                 </span>
            </div>
            
            ${report.photo_url ? `
                <div style="position: relative; margin-bottom: 16px;">
                    <img src="${report.photo_url}" style="width: 100%; border-radius: 16px; height: 180px; object-fit: cover; box-shadow: 0 12px 24px rgba(0,0,0,0.1);">
                    <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); color: white; padding: 4px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 600;">
                        Foto Lokasi
                    </div>
                </div>
            ` : ''}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <div style="background: #f8fafc; border-radius: 16px; padding: 12px; border: 1px solid #f1f5f9; text-align: center;">
                    <div style="font-size: 0.6rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.8px; margin-bottom: 4px;">SDI Index</div>
                    <div style="font-weight: 850; color: #1e293b; font-size: 1.2rem;">${(report.sdi_value !== null && report.sdi_value !== undefined) ? report.sdi_value : '0'}</div>
                </div>
                <div style="background: #f8fafc; border-radius: 16px; padding: 12px; border: 1px solid #f1f5f9; text-align: center;">
                    <div style="font-size: 0.6rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.8px; margin-bottom: 4px;">PCI Index</div>
                    <div style="font-weight: 850; color: #1e293b; font-size: 1.2rem;">${(report.pci_value !== null && report.pci_value !== undefined) ? report.pci_value : '0'}</div>
                </div>
            </div>

            <div style="font-size: 0.85rem; color: #475569; line-height: 1.6; margin-bottom: 20px; background: #fff; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                ${report.description || 'Analisis kondisi jalan terlampir dalam laporan ini.'}
            </div>

            <a href="${googleMapsUrl}" target="_blank" style="text-decoration: none; width: 100%; background: #3b82f6; color: white; text-align: center; padding: 14px; border-radius: 14px; font-weight: 800; font-size: 0.85rem; box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.4); display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s;">
                <i class="fas fa-location-arrow"></i> BUKA NAVIGASI MAPS
            </a>
        </div>
    `;
}

async function loadMapData() {
    // Show district boundary and base roads (visual parity with admin)
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
    
    // Hanya memuat marker public, jangan memuat layer GeoJSON khusus Admin map (PCI/SDI)
    
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
    if (c === 'tidak rusak' || c === 'bagus' || c === 'excellent') return '#0000FF'; // Blue for perfect
    if (c.includes('bagus') || c.includes('baik') || c.includes('good')) return '#22c55e'; // Green
    if (c.includes('sedang') || c.includes('fair')) return '#eab308'; // Yellow
    if (c.includes('ringan')) return '#f97316'; // Orange
    if (c.includes('berat') || c.includes('rusak') || c.includes('poor') || c.includes('very poor') || c.includes('failed')) return '#ef4444'; // Red
    return '#94a3b8'; // Grey default
}

function getPciCategory(score, semanticLabel = '') {
    if (score === null || score === undefined) return 'Unknown';
    const s = parseFloat(score);
    if (isNaN(s)) return 'Unknown';
    if (s === 0) return 'Tidak Rusak';

    const label = (semanticLabel || '').toLowerCase();
    const isBadLabel = label.includes('rusak') || label.includes('poor') || label.includes('failed') || label.includes('berat') || label.includes('sering');
    const isGoodLabel = label.includes('bagus') || label.includes('baik') || label.includes('good') || label.includes('excellent') || label.includes('satisfactory');

    // Handle SDI/PCI ambiguity: if score > 70 but label says damaged, it is SDI (high=bad)
    if (s > 70 && isBadLabel) return 'Serious';
    if (s < 50 && isGoodLabel && s > 0) return 'Excellent';

    if (s >= 85) return 'Excellent';
    if (s >= 70) return 'Satisfactory';
    if (s >= 55) return 'Fair';
    if (s >= 40) return 'Poor';
    if (s >= 10) return 'Serious';
    if (s >= 1) return 'Failed';
    return 'Failed';
}

function getPciColor(category) {
    const c = (category || '').toLowerCase();
    if (c === 'tidak rusak') return '#0000FF'; // Pure Blue as requested
    if (c === 'excellent') return '#008000'; // Hijau Tua
    if (c === 'satisfactory') return '#90EE90'; // Hijau Muda
    if (c === 'fair') return '#FFFF00'; // Kuning
    if (c === 'poor') return '#FFA500'; // Oranye
    if (c === 'serious') return '#FF0000'; // Merah
    if (c === 'failed') return '#8B0000'; // Merah Gelap
    return '#94a3b8'; // Default Grey
}

function getRobustPci(props) {
    // 1. Find the score
    let rawVal = getRobustProperty(props, [
        'PCI_Index', 'Skor_Kerus', 'Skor_kerus', 'pci_value', 'PCI', 'PCI_Score', 'Score', 'Nilai_PCI', 'PCI_Score_1', 'PCI_Value'
    ], null);

    if (rawVal === null || rawVal === undefined) return { score: null, category: 'Unknown' };

    let score = parseFloat(rawVal);
    if (isNaN(score)) return { score: null, category: 'Unknown' };

    // 2. Handle Scaling (e.g. 9025 instead of 90.25)
    if (score > 150) score = score / 100;

    // 3. Normalize score to 2 decimal places
    score = Math.round(score * 100) / 100;

    // 4. Get Semantic context for SDI/PCI ambiguity
    const semanticLabel = getRobustProperty(props, ['Jenis_keru', 'Jenis_ke_1', 'kondisi', 'kondisi_jalan', 'status', 'Keterangan'], '');

    return {
        score: score,
        category: getPciCategory(score, semanticLabel)
    };
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
    const geojsonFiles = ['hasilclipgajah.geojson', 'clipan.geojson', 'hasildempetpci.geojson', 'hasilgajahpci.geojson'];

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
                    let category = 'Unknown';
                    let color = '#94a3b8';

                    if (currentMapConditionView === 'pci') {
                        const pciData = getRobustPci(feature.properties);
                        color = getPciColor(pciData.category);
                    } else {
                        category = getRobustProperty(feature.properties, ['SDI_Category', 'Jenis_keru', 'Jenis_ke_1', 'jenis_keru', 'Kondisi', 'kondisi'], 'Unknown');
                        color = getConditionColor(category);
                    }

                    return {
                        color: color,
                        weight: 8, // Refined thickness
                        opacity: 1,
                        lineCap: 'round',
                        lineJoin: 'round',
                        interactive: true
                    };
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties || {};
                    const pciData = getRobustPci(props);
                    if (!feature.geometry || !feature.geometry.coordinates) return;
                    
                    const coords = feature.geometry.type === 'LineString' 
                        ? feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)]
                        : (feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates[0][Math.floor(feature.geometry.coordinates[0].length / 2)] : null);
                    
                    if (!coords) return;

                    const sdiValue = getRobustProperty(props, ['SDI', 'sdi_value', 'Skor_kerus', 'Skor_Kerus', 'skor_kerus', 'SKOR'], 0);
                    const sdiCategory = getRobustProperty(props, ['SDI_Category', 'Jenis_keru', 'Jenis_ke_1', 'jenis_keru', 'Kondisi', 'kondisi'], 'Unknown');
                    const noRuas = getRobustProperty(props, ['No_Ruas', 'NO_RUA', 'No_Ruas_J', 'Ruas_ID'], '-');
                    const name = getRobustProperty(props, ['Name', 'Nama_Ruas', 'NAMRUA', 'Keterangan'], 'Tanpa Nama');
                    
                    const latLng = [coords[1], coords[0]];
                    
                    let color = '#94a3b8';
                    let displayCategory = 'Unknown';
                    
                    if (currentMapConditionView === 'pci') {
                        color = getPciColor(pciData.category);
                        displayCategory = pciData.category;
                    } else {
                        color = getConditionColor(sdiCategory);
                        displayCategory = sdiCategory;
                    }

                    const marker = L.marker(latLng, { 
                        icon: createModernPin(color),
                        interactive: true 
                    });
                    
                    const popup = `
                        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 260px; padding: 5px;">
                            <div style="font-weight: 800; color: #1e293b; margin-bottom: 5px; font-size: 1.15rem; line-height: 1.2;">${name}</div>
                            <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
                                 <span style="background: ${color}15; color: ${color}; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid ${color}30;">${displayCategory}</span>
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
                                    <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${pciData.score}</div>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <a href="https://www.google.com/maps/dir/?api=1&destination=${latLng[0]},${latLng[1]}" target="_blank" style="text-decoration: none; width: 100%; background: #3b82f6; color: white; text-align: center; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 0.9rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    <i class="fas fa-directions"></i> Navigasi Maps
                                </a>
                            </div>
                        </div>
                    `;
                    
                    const tooltipText = `<div style="font-size: 0.8rem; opacity: 0.8;">KONDISI JALAN:</div><div style="font-size: 1rem;">${displayCategory.toUpperCase()}</div>`;
                    
                    // Determine class for colored tooltip
                    let tooltipClass = 'modern-tooltip';
                    const c = displayCategory.toLowerCase();
                    if (c.includes('bagus') || c.includes('baik') || c.includes('good') || c.includes('satisfactory')) tooltipClass += ' bagus';
                    else if (c.includes('sedang') || c.includes('fair')) tooltipClass += ' sedang';
                    else if (c.includes('ringan') || c.includes('poor')) tooltipClass += ' ringan';
                    else if (c.includes('berat') || c.includes('rusak') || c.includes('failed') || c.includes('serious')) tooltipClass += ' berat';

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