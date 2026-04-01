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
        className: 'modern-pin',
        html: `
            <svg class="pin-svg" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg">
                <path fill="${color}" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"></path>
                <circle class="pin-dot" cx="192" cy="192" r="64"></circle>
            </svg>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -40],
        tooltipAnchor: [16, -20]
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
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 240px; padding: 5px;">
            <div style="font-weight: 800; font-size: 1.15rem; color: #1e293b; margin-bottom: 4px;">${report.district || 'Data Jalan'}</div>
            <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 12px; display: flex; align-items: center; gap: 5px;">
                <i class="fas fa-map-marker-alt" style="color: #64748b;"></i> ${report.location_details || 'Kabupaten Demak'}
            </div>
            
            ${report.photo_url ? `<img src="${report.photo_url}" style="width: 100%; border-radius: 12px; margin-bottom: 12px; max-height: 160px; object-fit: cover; border: 1px solid #f1f5f9;">` : ''}
            
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

            <div style="font-size: 0.9rem; color: #475569; line-height: 1.5; margin-bottom: 15px;">
                ${report.description || 'Tidak ada deskripsi tambahan.'}
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <a href="${googleMapsUrl}" target="_blank" class="btn-nav-google">
                    <i class="fas fa-directions"></i> Navigasi Maps
                </a>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                     <span style="background: ${color}15; color: ${color}; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${color}30;">
                        ${statusLabel}
                    </span>
                    <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">${new Date(report.created_at).toLocaleDateString('id-ID')}</span>
                </div>
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

// --- ROAD CONDITION LOGIC (ArcMap Style) ---

function getConditionColor(condition) {
    const c = condition.toLowerCase();
    if (c.includes('bagus') || c.includes('baik')) return '#22c55e'; // Green
    if (c.includes('sedang')) return '#eab308'; // Yellow
    if (c.includes('ringan')) return '#f97316'; // Orange
    if (c.includes('berat') || c.includes('rusak')) return '#ef4444'; // Red
    return '#94a3b8'; // Grey default
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
    try {
        const res = await fetch('/hasilclipgajah.geojson');
        if (!res.ok) return;
        const data = await res.json();

        // Clear existing to avoid duplicates
        layers.roadConditions.clearLayers();

        L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: getConditionColor(feature.properties.Jenis_keru),
                    weight: 6, // Thicker for priority
                    opacity: 1,
                    lineCap: 'round',
                    interactive: true
                };
            },
            onEachFeature: function (feature, layer) {
                // Pin logic: Use middle point of the sequence for better placement
                const coords = feature.geometry.type === 'LineString' 
                    ? feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)]
                    : feature.geometry.coordinates[0][Math.floor(feature.geometry.coordinates[0].length / 2)];
                
                const color = getConditionColor(feature.properties.Jenis_keru);
                const marker = L.marker(latLng, { 
                    icon: createModernPin(color),
                    interactive: true 
                });
                
                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng[0]},${latLng[1]}`;
                const popup = `
                    <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 240px; padding: 5px;">
                        <div style="font-weight: 800; color: #1e293b; margin-bottom: 4px; font-size: 1.15rem;">${feature.properties.Name}</div>
                        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                             <span style="background: ${color}15; color: ${color}; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${color}30;">
                                ${feature.properties.Jenis_keru}
                             </span>
                             <span style="background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800;">
                                Ruas #${feature.properties.No_Ruas}
                             </span>
                        </div>
                        
                        <div style="background: #f8fafc; border-radius: 10px; padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">SDI Score</div>
                                    <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${feature.properties.SDI || feature.properties.Skor_kerus || 0}</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">PCI Index</div>
                                    <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${feature.properties.PCI || 0}</div>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="font-size: 0.85rem; color: #64748b; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-ruler-horizontal"></i> Panjang Ruas: <strong>${(feature.properties.Panjang).toFixed(2)} km</strong>
                            </div>
                            <a href="${googleMapsUrl}" target="_blank" class="btn-nav-google">
                                <i class="fas fa-directions"></i> Navigasi Maps
                            </a>
                        </div>
                    </div>
                `;
                
                const tooltipText = `${feature.properties.Jenis_keru.toUpperCase()} - Ruas #${feature.properties.No_Ruas}`;
                layer.bindTooltip(tooltipText, { className: 'modern-tooltip', offset: [0, -10] });
                marker.bindTooltip(tooltipText, { className: 'modern-tooltip' });
                
                layer.bindPopup(popup);
                marker.bindPopup(popup);
                
                layers.roadConditions.addLayer(layer);
                layers.roadConditions.addLayer(marker);
            }
        }).addTo(layers.roadConditions); // Ensure the group is updated
        
        clipGajahLayer = true; 
    } catch (err) {
        console.error("Error loading clip gajah data:", err);
    }
}

function toggleConditionLayer() {
    const isChecked = document.getElementById('conditionToggle').checked;
    const statusLegend = document.getElementById('statusLegend');
    const conditionLegend = document.getElementById('conditionLegend');

    if (isChecked) {
        mapContainer.classList.add('paper-mode');
        googleStreets.setOpacity(0); // Hide satellite/streets
        
        if (!clipGajahLayer) {
            loadClipGajahData().then(() => {
                layers.roadConditions.addTo(map);
                drawGraticule();
                layers.graticule.addTo(map);
            });
        } else {
            layers.roadConditions.addTo(map);
            drawGraticule();
            layers.graticule.addTo(map);
        }
        
        // Faded context roads
        roadLayers.forEach(r => {
            r.layer.setStyle({ color: '#ccc', weight: 1.5, opacity: 0.2 });
        });
        
        layers.markers.remove();
        statusLegend.style.display = 'none';
        conditionLegend.style.display = 'block';
    } else {
        mapContainer.classList.remove('paper-mode');
        googleStreets.setOpacity(1); 
        
        layers.roadConditions.remove();
        layers.graticule.remove();
        layers.markers.addTo(map);
        
        applyFilters(); // Restore standard road styles and colorful lines
        
        statusLegend.style.display = 'block';
        conditionLegend.style.display = 'none';
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