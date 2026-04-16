// Admin Map Logic (Synced with Public Map)
let adminMap = null;
let districtLayers = {};
let roadLayers = [];
let currentMapConditionView = 'sdi'; // 'sdi' or 'pci'
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
                        color: 'transparent',
                        weight: 0,
                        opacity: 0,
                        fillColor: districtColors[name] || '#94a3b8',
                        fillOpacity: 0.15
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
    if (c.includes('bagus') || c.includes('baik') || c.includes('excellent') || c.includes('good')) return '#22c55e'; // Green
    if (c.includes('sedang') || c.includes('fair')) return '#eab308'; // Yellow
    if (c.includes('ringan') || c.includes('poor')) return '#f97316'; // Orange
    if (c.includes('berat') || c.includes('rusak') || c.includes('very poor') || c.includes('failed')) return '#ef4444'; // Red
    return '#94a3b8'; // Grey default
}

function getPciCategory(value) {
    if (value >= 85) return 'Bagus';
    if (value >= 70) return 'Sedang';
    if (value >= 55) return 'Rusak Ringan';
    return 'Rusak Berat';
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

async function loadClipGajahData() {
    // Clear existing layers first to ensure we aren't showing old/conflicting data
    layers.roadConditions.clearLayers();

    // --- DISTRICT FILTERING LOGIC ---
    // If a district is selected, we only show road segments that belong to that district.
    const filterDistrict = window.currentMapDistrict || 'all';
    let validRuas = new Set();

    if (filterDistrict !== 'all' && window.allReports) {
        window.allReports.forEach(r => {
            if (r.district === filterDistrict && r.no_ruas) {
                validRuas.add(String(r.no_ruas));
            }
        });
        console.log(`Filtering road lines for ${filterDistrict}. Valid Ruas count: ${validRuas.size}`);
    }

    // List of files to attempt loading (supports multiple GIS exports)
    const geojsonFiles = ['/hasilclipgajah.geojson', '/clipan.geojson', '/hasilgajahpci.geojson', '/hasildempetpci.geojson'];

    for (const file of geojsonFiles) {
        try {
            const res = await fetch(file);
            if (!res.ok) continue;

            const data = await res.json();
            console.log(`Successfully loaded road data from: ${file}`);

            const geojsonOptions = {
                filter: function (feature) {
                    if (filterDistrict === 'all') return true;
                    // Match by No_Ruas primary key
                    const noRuas = String(getRobustProperty(feature.properties, ['No_Ruas', 'NO_RUA', 'No_Ruas_J', 'Ruas_ID'], ''));
                    // Fallback to name-based lookup
                    const name = String(getRobustProperty(feature.properties, ['Name', 'Nama_Ruas'], '')).toLowerCase();
                    return validRuas.has(noRuas) || name.includes(filterDistrict.toLowerCase());
                }
            };


            // 2. Main Condition Layer
            L.geoJSON(data, {
                ...geojsonOptions,
                style: function (feature) {
                    let category = 'Unknown';
                    if (currentMapConditionView === 'sdi') {
                        category = getRobustProperty(feature.properties, ['SDI_Category', 'Jenis_keru', 'Jenis_ke_1', 'jenis_keru', 'Kondisi', 'kondisi'], 'Unknown');
                    } else if (currentMapConditionView === 'pci') {
                        const pciVal = parseFloat(getRobustProperty(feature.properties, ['PCI', 'pci_value', 'PCI_Index'], 0)) || 0;
                        category = getRobustProperty(feature.properties, ['PCI_Category', 'pci_cat'], getPciCategory(pciVal));
                    } else {
                        // 'warga' view - neutral roads
                        return {
                            color: '#cbd5e1',
                            weight: 4,
                            opacity: 0.5,
                            lineCap: 'round',
                            interactive: false
                        };
                    }

                    return {
                        color: getConditionColor(category),
                        weight: 8, // Refined thickness
                        opacity: 1,
                        lineCap: 'round',
                        lineJoin: 'round',
                        interactive: true
                    };
                },
                onEachFeature: function (feature, layer) {
                    if (currentMapConditionView === 'warga') return;

                    const props = feature.properties || {};
                    // Use midpoint for better popup/marker placement
                    const coords = feature.geometry.type === 'LineString'
                        ? feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)]
                        : (feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates[0][Math.floor(feature.geometry.coordinates[0].length / 2)] : null);

                    if (!coords) return;

                    const sdiValue = getRobustProperty(props, ['SDI', 'sdi_value', 'Skor_kerus', 'Skor_Kerus', 'skor_kerus', 'SKOR'], 0);
                    const sdiCategory = getRobustProperty(props, ['SDI_Category', 'Jenis_keru', 'Jenis_ke_1', 'jenis_keru', 'Kondisi', 'kondisi'], 'Unknown');
                    const pciValue = getRobustProperty(props, ['PCI', 'pci_value', 'PCI_Index'], 0);
                    const noRuas = getRobustProperty(props, ['No_Ruas', 'NO_RUA', 'No_Ruas_J', 'Ruas_ID'], '-');
                    const name = getRobustProperty(props, ['Name', 'Nama_Ruas', 'NAMRUA', 'Keterangan'], 'Tanpa Nama');

                    const color = getConditionColor(sdiCategory);
                    const latLng = [coords[1], coords[0]];

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

                    // Add midpoint marker for better clicking and label positioning
                    const marker = L.marker(latLng, { icon: createModernPin(color), interactive: true });
                    marker.bindTooltip(tooltipText, tooltipOptions);
                    marker.bindPopup(popup);
                    layers.roadConditions.addLayer(marker);

                    layer.bindPopup(popup);

                    let hoverText = '';
                    if (currentMapConditionView === 'sdi') {
                        hoverText = `SDI: ${sdiValue} (${sdiCategory})`;
                    } else {
                        const pciVal = getRobustProperty(props, ['PCI', 'pci_value', 'PCI_Index'], 0);
                        const pciCat = getRobustProperty(props, ['PCI_Category', 'pci_cat'], getPciCategory(pciVal));
                        hoverText = `PCI: ${pciVal} (${pciCat})`;
                    }
                    layer.bindTooltip(`RUAS: ${noRuas} | ${hoverText}`, { sticky: true });
                }
            }).addTo(layers.roadConditions);

            clipGajahLayer = true;

        } catch (err) {
            console.error(`Error loading GeoJSON from ${file}:`, err);
        }
    }
}

function createModernPin(color, type = 'public') {
    let iconHtml = '';
    const iconStyle = 'color: white; font-size: 10px; position: absolute; top: 22px; left: 50%; transform: translateX(-50%) rotate(20deg); text-shadow: 0 1px 2px rgba(0,0,0,0.5);';

    if (type === 'public') {
        iconHtml = `<i class="fas fa-user" style="${iconStyle}"></i>`;
    } else if (type === 'sdi') {
        iconHtml = `<i class="fas fa-file-medical-alt" style="${iconStyle}"></i>`;
    } else if (type === 'pci') {
        iconHtml = `<i class="fas fa-chart-line" style="${iconStyle}"></i>`;
    } else if (type === 'admin') {
        iconHtml = `<i class="fas fa-tools" style="${iconStyle}"></i>`;
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

    // Report markers (verified/pending/rejected) disabled for admin map per user request
    reports.forEach(report => {
        const { latitude, longitude, status, id, district, reporter_name, report_source, description } = report;
        if (!latitude || !longitude) return;

        // Determine Type for Icon
        let type = report_source;
        const desc = (description || '').toUpperCase();
        if (report_source === 'admin') {
            if (desc.includes('[SDI]')) type = 'sdi';
            else if (desc.includes('[PCI]')) type = 'pci';
        }

        const color = getMarkerColor(report);
        const marker = L.marker([latitude, longitude], {
            icon: createModernPin(color, type)
        });

        let statusLabel = status === 'verified' ? 'Verified' : (status === 'rejected' ? 'Rejected' : 'Pending');
        let typeLabel = type === 'public' ? 'Laporan Warga' : (type === 'sdi' ? 'Data Teknis SDI' : 'Data Teknis PCI');

        const popupContent = `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 260px; padding: 5px;">
                <div style="font-size: 0.7rem; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-bottom: 2px;">${typeLabel}</div>
                <div style="font-weight: 800; font-size: 1.15rem; color: #1e293b; margin-bottom: 5px; line-height: 1.2;">${district || 'Lokasi'}</div>
                <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-user-edit"></i> Pelapor: ${reporter_name || 'Admin'}
                </div>

                <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border: 1px solid #e2e8f0; margin-bottom: 15px; display: flex; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">SDI INDEX</div>
                        <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${(report.sdi_value !== null && report.sdi_value !== undefined) ? report.sdi_value : '-'}</div>
                    </div>
                    <div style="width: 1px; background: #e2e8f0;"></div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">PCI INDEX</div>
                        <div style="font-weight: 800; color: #334155; font-size: 1.1rem;">${(report.pci_value !== null && report.pci_value !== undefined) ? report.pci_value : '-'}</div>
                    </div>
                </div>

                ${type !== 'public' ? `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="openActionModal(${id})" 
                        style="width: 100%; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: all 0.2s; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-cog"></i> Kelola Laporan
                    </button>
                </div>
                ` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px;">
                         <span style="background: ${color}15; color: ${color}; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${color}30;">
                            ${statusLabel}
                        </span>
                        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">ID #${id}</span>
                    </div>
                </div>
            </div>
        `;

        marker.bindTooltip(`${typeLabel}: ${district}`, { className: 'modern-tooltip' });
        marker.bindPopup(popupContent);
        layers.markers.addLayer(marker);
    });
}

function refreshMapSize() {
    if (adminMap) {
        setTimeout(() => {
            adminMap.invalidateSize();

            // Sync with zoom visibility
            if (adminMap.getZoom() < 14) {
                document.querySelectorAll('.modern-tooltip').forEach(el => el.style.display = 'none');
            }
        }, 200);
    }
}

// Control label visibility based on zoom for Admin Map
setTimeout(() => {
    if (adminMap) {
        adminMap.on('zoomend', function () {
            const zoomSize = adminMap.getZoom();
            const tooltips = document.querySelectorAll('.modern-tooltip');

            if (zoomSize < 14) {
                tooltips.forEach(el => el.style.display = 'none');
            } else {
                tooltips.forEach(el => el.style.display = 'block');
            }
        });

        // Initial check
        if (adminMap.getZoom() < 14) {
            document.querySelectorAll('.modern-tooltip').forEach(el => el.style.display = 'none');
        }
    }
}, 2000);


window.setMapConditionView = function (view) {
    currentMapConditionView = view;

    // Update buttons
    const allBtn = document.getElementById('btn-view-all');
    const sdiBtn = document.getElementById('btn-view-sdi');
    const pciBtn = document.getElementById('btn-view-pci');
    const wargaBtn = document.getElementById('btn-view-warga');
    const legendTitle = document.querySelector('.legend-section-title');
    const legendSection = document.querySelector('.legend-section');

    const resetBtns = () => {
        [allBtn, sdiBtn, pciBtn, wargaBtn].forEach(b => {
            if (b) { b.style.background = 'transparent'; b.style.color = '#64748b'; b.style.boxShadow = 'none'; }
        });
    };

    const setActive = (btn) => {
        if (btn) { btn.style.background = 'white'; btn.style.color = '#3b82f6'; btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }
    };

    resetBtns();

    if (view === 'all') {
        setActive(allBtn);
        legendTitle.innerText = "Data Semua Laporan";
        legendSection.innerHTML = `
            <h4 class="legend-section-title">Kombinasi Data & Laporan</h4>
            <div class="legend-item"><span class="marker-legend verified"></span><span style="color: #16a34a; font-weight: 800;">Verified (Hijau)</span></div>
            <div class="legend-item"><span class="marker-legend pending"></span><span style="color: #ca8a04; font-weight: 800;">Pending (Kuning)</span></div>
            <div class="legend-item"><span class="marker-legend rejected"></span><span style="color: #dc2626; font-weight: 800;">Rejected (Merah)</span></div>
        `;
        if (window.switchMapTab) window.switchMapTab('all');
    } else if (view === 'sdi') {
        setActive(sdiBtn);
        legendTitle.innerText = "Kondisi Jalan (SDI)";
        legendSection.innerHTML = `
            <h4 class="legend-section-title">Kondisi Jalan (SDI)</h4>
            <div class="legend-item"><span class="line-legend bagus"></span><span style="color: #15803d; font-weight: 800;">Bagus (0-50)</span></div>
            <div class="legend-item"><span class="line-legend sedang"></span><span style="color: #a16207; font-weight: 800;">Sedang (50-100)</span></div>
            <div class="legend-item"><span class="line-legend ringan"></span><span style="color: #c2410c; font-weight: 800;">Rusak Ringan (100-150)</span></div>
            <div class="legend-item"><span class="line-legend berat"></span><span style="color: #b91c1c; font-weight: 800;">Rusak Berat (>150)</span></div>
        `;
        if (window.switchMapTab) window.switchMapTab('sdi');
    } else if (view === 'pci') {
        setActive(pciBtn);
        legendTitle.innerText = "Kondisi Jalan (PCI)";
        legendSection.innerHTML = `
            <h4 class="legend-section-title">Kondisi Jalan (PCI)</h4>
            <div class="legend-item"><span class="line-legend bagus"></span><span style="color: #15803d; font-weight: 800;">Sangat Baik (80-100)</span></div>
            <div class="legend-item"><span class="line-legend sedang"></span><span style="color: #a16207; font-weight: 800;">Baik (60-80)</span></div>
            <div class="legend-item"><span class="line-legend ringan"></span><span style="color: #c2410c; font-weight: 800;">Kurang (40-60)</span></div>
            <div class="legend-item"><span class="line-legend berat"></span><span style="color: #b91c1c; font-weight: 800;">Hancur (<40)</span></div>
        `;
        if (window.switchMapTab) window.switchMapTab('pci');

    } else if (view === 'warga') {
        setActive(wargaBtn);
        legendTitle.innerText = "Data Laporan Warga";
        legendSection.innerHTML = `
            <h4 class="legend-section-title">Laporan Berdasarkan Status</h4>
            <div class="legend-item"><span class="marker-legend verified"></span><span style="color: #16a34a; font-weight: 800;">Verified (Diverifikasi)</span></div>
            <div class="legend-item"><span class="marker-legend pending"></span><span style="color: #ca8a04; font-weight: 800;">Pending (Menunggu)</span></div>
            <div class="legend-item"><span class="marker-legend rejected"></span><span style="color: #dc2626; font-weight: 800;">Rejected (Ditolak)</span></div>
        `;
        if (window.switchMapTab) window.switchMapTab('public');
    }

    // Refresh layers
    loadClipGajahData();
};
