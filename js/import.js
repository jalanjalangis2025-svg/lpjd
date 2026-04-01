/**
 * GeoJSON Bulk Import Logic
 * Uses Turf.js for spatial calculations
 */

async function handleGeoJsonImport(input) {
    const file = input.files[0];
    if (!file) return;

    // Open Modal
    openImportModal();
    updateImportStatus("Membaca file...", 0);

    try {
        const text = await file.text();
        const geojson = JSON.parse(text);

        if (geojson.type !== 'FeatureCollection') {
            throw new Error("File bukan merupakan FeatureCollection GeoJSON yang valid.");
        }

        const features = geojson.features;
        const total = features.length;
        updateImportStatus(`Ditemukan ${total} data jalan. Menyiapkan batas wilayah...`, 5);

        // Load Districts for spatial check
        const districtBoundaries = await getDistrictBoundaries();
        
        let successCount = 0;
        let errorCount = 0;
        const batchSize = 50;

        for (let i = 0; i < total; i += batchSize) {
            const batch = features.slice(i, i + batchSize);
            const records = batch.map(feature => mapFeatureToRecord(feature, districtBoundaries));
            
            updateImportStatus(`Mengunggah data ${i + 1} - ${Math.min(i + batchSize, total)}...`, 10 + (i / total * 85));

            const { error } = await sb.from('road_reports').insert(records);

            if (error) {
                console.error("Batch insert error:", error);
                errorCount += batch.length;
            } else {
                successCount += batch.length;
            }

            updateImportStats(successCount, errorCount);
        }

        updateImportStatus("Import Selesai!", 100);
        finishImport(successCount, errorCount);
        
        // Refresh Table if on reports view
        if (typeof loadReports === 'function') loadReports();

    } catch (err) {
        console.error("Import error:", err);
        showImportError(err.message);
    } finally {
        input.value = ''; // Reset input
    }
}

async function getDistrictBoundaries() {
    const res = await fetch('/demak-districts-voronoi.geojson');
    if (!res.ok) throw new Error("Gagal memuat batas wilayah kecamatan.");
    return await res.json();
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

function mapFeatureToRecord(feature, districtBoundaries) {
    const props = feature.properties || {};
    
    // Calculate Point from Geometry (Midpoint/Center)
    let point;
    try {
        // turf.center handles LineStrings well
        const center = turf.center(feature);
        point = center.geometry.coordinates;
    } catch (e) {
        // Fallback to first coordinate
        if (feature.geometry.type === 'LineString') {
            point = feature.geometry.coordinates[Math.floor(feature.geometry.coordinates.length / 2)];
        } else if (feature.geometry.type === 'Point') {
            point = feature.geometry.coordinates;
        } else {
            point = [0, 0];
        }
    }

    const lng = point[0];
    const lat = point[1];

    // Detect District
    let districtName = "Unknown";
    if (districtBoundaries) {
        const pt = turf.point([lng, lat]);
        for (const dist of districtBoundaries.features) {
            if (turf.booleanPointInPolygon(pt, dist)) {
                districtName = dist.properties.kecamatan;
                break;
            }
        }
    }

    // Advanced Mapping for inconsistent property names
    const name = getRobustProperty(props, ['Name', 'Nama_Ruas', 'NAMRUA', 'Keterangan'], 'Tanpa Nama');
    const noRuas = getRobustProperty(props, ['No_Ruas', 'NO_RUA', 'No_Ruas_J', 'Ruas_ID'], '-');
    const length = parseFloat(getRobustProperty(props, ['SHAPE_Leng', 'Panjang', 'Lenth', 'Length', 'Shape_Length'], 0)) || 0;
    
    const sdiValue = parseFloat(getRobustProperty(props, ['SDI', 'sdi_value', 'Skor_kerus', 'skor_kerus', 'SKOR'], 0)) || 0;
    const sdiCategory = getRobustProperty(props, ['SDI_Category', 'Jenis_keru', 'jenis_keru', 'Kondisi', 'kondisi'], 'Unknown');
    
    const pciValue = parseFloat(getRobustProperty(props, ['PCI', 'pci_value', 'PCI_Index'], null));
    const pciCategory = getRobustProperty(props, ['PCI_Category', 'pci_cat'], null);

    return {
        report_source: 'admin',
        status: 'verified',
        district: districtName,
        latitude: lat,
        longitude: lng,
        description: `${name} (Ruas #${noRuas})`,
        damage_length: length,
        damage_width: 0,
        report_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        
        // Mapping SDI/PCI/Damage Score
        sdi_value: sdiValue,
        sdi_category: sdiCategory,
        pci_value: pciValue,
        pci_category: pciCategory
    };
}

// UI Helpers for Import
function openImportModal() {
    const modal = document.getElementById('importModal');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.classList.add('active');
    
    document.getElementById('importTitle').innerText = "Mengimport Data...";
    document.getElementById('importSpinner').style.display = 'block';
    document.getElementById('closeImportBtn').style.display = 'none';
    document.getElementById('importProgress').style.width = '0%';
    document.getElementById('importSuccessCount').innerText = '0';
    document.getElementById('importErrorCount').innerText = '0';
}

function updateImportStatus(text, percent) {
    document.getElementById('importStatus').innerText = text;
    document.getElementById('importProgress').style.width = `${percent}%`;
}

function updateImportStats(success, error) {
    document.getElementById('importSuccessCount').innerText = success;
    document.getElementById('importErrorCount').innerText = error;
}

function showImportError(msg) {
    document.getElementById('importTitle').innerText = "Gagal Import";
    document.getElementById('importStatus').innerText = msg;
    document.getElementById('importSpinner').style.display = 'none';
    document.getElementById('closeImportBtn').style.display = 'block';
}

function finishImport(success, error) {
    document.getElementById('importTitle').innerText = "Import Selesai";
    document.getElementById('importSpinner').innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i>';
    document.getElementById('importStatus').innerText = `Proses selesai. ${success} data berhasil dimasukkan.`;
    document.getElementById('closeImportBtn').style.display = 'block';
}

function closeImportModal() {
    const modal = document.getElementById('importModal');
    modal.style.opacity = '0';
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        // Reload icon
        document.getElementById('importSpinner').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    }, 300);
}
