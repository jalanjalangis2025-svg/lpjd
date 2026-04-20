/**
 * GeoJSON Bulk Import Logic
 * Uses Turf.js for spatial calculations
 */

async function handleGeoJsonImport(input, type = 'all') {
    const file = input.files[0];
    if (!file) return;

    // Open Modal
    openImportModal(type);
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
            const records = batch.map(feature => mapFeatureToRecord(feature, districtBoundaries, type));
            
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

function mapFeatureToRecord(feature, districtBoundaries, type = 'all') {
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
    
    console.log(`Importing feature as type: ${type}`);

    let rawPciKey = ['PCI', 'pci_value', 'PCI_Index', 'Skor_kerus', 'Skor_Kerus', 'skor_kerus', 'SKOR', 'Actual_PCI', 'PCI_Score', 'Score', 'Nilai_PCI'];
    let rawCatKey = ['PCI_Category', 'pci_cat', 'Jenis_keru', 'Jenis_ke_1', 'jenis_keru', 'Kondisi', 'kondisi', 'Keterangan', 'status'];

    if (type === 'sdi') {
        sdiValue = parseFloat(getRobustProperty(props, rawPciKey, 0)) || 0;
        sdiCategory = getRobustProperty(props, rawCatKey, 'Unknown');
        pciValue = null;
        pciCategory = null;
    } else if (type === 'pci') {
        pciValue = parseFloat(getRobustProperty(props, rawPciKey, 0)) || 0;
        pciCategory = getRobustProperty(props, rawCatKey, 'Unknown');
        sdiValue = null;
        sdiCategory = null;
    } else {
        sdiValue = parseFloat(getRobustProperty(props, rawPciKey, null));
        sdiCategory = getRobustProperty(props, rawCatKey, null);
        pciValue = parseFloat(getRobustProperty(props, rawPciKey, null));
        pciCategory = getRobustProperty(props, rawCatKey, null);
    }

    // --- Extreme Robustness Fix for Table rendering ---
    // Handle specific cases for large numbers that should be decimals (e.g., 9025 -> 90.25)
    if (sdiValue > 150) sdiValue = Math.round((sdiValue / 100) * 100) / 100;
    if (pciValue > 150) pciValue = Math.round((pciValue / 100) * 100) / 100;

    // If the label clearly says "Tidak Rusak", force the value to 0
    if (sdiCategory && typeof sdiCategory === 'string' && sdiCategory.toLowerCase().includes('tidak rusak')) {
        sdiValue = 0;
        sdiCategory = 'Tidak Rusak';
    }
    if (pciCategory && typeof pciCategory === 'string' && pciCategory.toLowerCase().includes('tidak rusak')) {
        pciValue = 0;
        pciCategory = 'Tidak Rusak';
    }

    // Force 0 value to always carry the explicitly named 'Tidak Rusak' category.
    if (sdiValue === 0) sdiCategory = 'Tidak Rusak';
    if (pciValue === 0) pciCategory = 'Tidak Rusak';

    // Add type to description for easier identification
    const typeLabel = type === 'sdi' ? '[SDI]' : (type === 'pci' ? '[PCI]' : '');
    const finalDescription = `${typeLabel} ${name} (Ruas #${noRuas})`;

    return {
        report_source: 'admin',
        status: 'verified',
        district: districtName,
        latitude: lat,
        longitude: lng,
        description: finalDescription,
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
function openImportModal(type = 'all') {
    const modal = document.getElementById('importModal');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.classList.add('active');
    
    const typeLabel = type === 'sdi' ? 'SDI' : (type === 'pci' ? 'PCI' : '');
    document.getElementById('importTitle').innerText = `Mengimport Data ${typeLabel}...`;
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
