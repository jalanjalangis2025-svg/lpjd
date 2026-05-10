// Helper to get location
function getLocation() {
    const status = document.getElementById('location-status');
    if (status) status.innerText = "Mencari lokasi...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('latitude').value = position.coords.latitude;
            document.getElementById('longitude').value = position.coords.longitude;
            if (status) status.innerText = "Lokasi ditemukan!";
        }, (error) => {
            alert("Gagal mengambil lokasi. Pastikan GPS aktif.");
            if (status) status.innerText = "";
        });
    } else {
        alert("Browser tidak mendukung Geolocation.");
    }
}

// Toggle Location Options (GPS vs GMaps)
function toggleLocOption() {
    const isGps = document.querySelector('input[name="loc_option"][value="gps"]')?.checked ?? true;
    
    const locGps = document.getElementById('loc-gps');
    const locGmaps = document.getElementById('loc-gmaps');
    const cardGps = document.getElementById('card-gps');
    const cardGmaps = document.getElementById('card-gmaps');
    
    if (locGps) locGps.style.display = isGps ? 'block' : 'none';
    if (locGmaps) locGmaps.style.display = isGps ? 'none' : 'block';
    
    if (cardGps) isGps ? cardGps.classList.add('active') : cardGps.classList.remove('active');
    if (cardGmaps) !isGps ? cardGmaps.classList.add('active') : cardGmaps.classList.remove('active');
    
    // Handle photo input capture behavior
    const photoInput = document.getElementById('photo');
    if (photoInput) {
        if (isGps) {
            photoInput.setAttribute('capture', 'environment');
        } else {
            photoInput.removeAttribute('capture');
        }
    }
    
    // Clear status
    const status = document.getElementById('location-status');
    if (status) status.innerText = "";
    const gmapsStatus = document.getElementById('gmaps-status');
    if (gmapsStatus) gmapsStatus.innerText = "";
}

// Extract location from GMaps link
async function getLocFromGmaps() {
    let rawInput = document.getElementById('gmaps_link').value.trim();
    const status = document.getElementById('gmaps-status');
    const allBtns = document.querySelectorAll('#loc-gmaps button');
    const btn = allBtns[allBtns.length - 1];

    if (!rawInput) {
        window.open('https://maps.google.com', '_blank');
        if (status) {
            status.innerText = "Google Maps dibuka. Cari lokasi, lalu salin link dan tempel di atas.";
            status.style.color = "var(--primary-blue, #2563eb)";
        }
        return;
    }

    if (btn) btn.disabled = true;
    if (status) {
        status.innerText = "⏳ Mengekstrak koordinat...";
        status.style.color = "#64748b";
    }

    try {
        let link = rawInput;
        const urlMatch = rawInput.match(/https?:\/\/[^\s]+/);
        if (urlMatch) link = urlMatch[0];

        // 1. Instant check: Try to find coordinates in the input link itself before calling server
        const instantLat = _extractFromText(link);
        if (instantLat) {
            _setCoords(instantLat.lat, instantLat.lng, status, btn);
            return;
        }

        // 2. Server-side resolve for short links
        const isShortLink = link.includes('maps.app.goo.gl') || link.includes('goo.gl/maps') || link.includes('g.co/');
        if (isShortLink) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

                const response = await fetch(`/api/resolve?url=${encodeURIComponent(link)}`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (data.lat && data.lng) {
                        _setCoords(data.lat, data.lng, status, btn);
                        return;
                    }
                    if (data.finalUrl) link = data.finalUrl;
                }
            } catch (e) {
                console.warn("Resolve gagal/timeout, lanjut ke regex:", e.name);
            }
        }

        // 3. Final Regex Check on the resolved link
        const finalCoords = _extractFromText(link);
        if (finalCoords) {
            _setCoords(finalCoords.lat, finalCoords.lng, status, btn);
        } else {
            _setCoords(null, null, status, btn);
        }

    } catch (err) {
        console.error("Error in getLocFromGmaps:", err);
        _setCoords(null, null, status, btn);
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Internal helper for regex extraction
function _extractFromText(text) {
    const regexps = [
        /!3d(-?[\d.]+)!4d(-?[\d.]+)/,
        /@(-?[\d.]+),(-?[\d.]+)/,
        /place\/.*\/@(-?[\d.]+),(-?[\d.]+)/,
        /[?&]q=(-?[\d.]+),(-?[\d.]+)/,
        /[?&]ll=(-?[\d.]+),(-?[\d.]+)/,
        /[?&]query=(-?[\d.]+),(-?[\d.]+)/,
        /[?&]center=(-?[\d.]+),(-?[\d.]+)/,
        /search\/(-?[\d.]+),(-?[\d.]+)/,
        /[?&]daddr=(-?[\d.]+),(-?[\d.]+)/,
        /\/(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/,
    ];

    for (const r of regexps) {
        const match = text.match(r);
        if (match && match[1] && match[2]) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return { lat, lng };
            }
        }
    }

    // Try URLSearchParams
    try {
        const urlObj = new URL(text);
        const q = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || urlObj.searchParams.get('ll');
        if (q) {
            const parts = q.split(',');
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return { lat: parts[0].trim(), lng: parts[1].trim() };
            }
        }
    } catch(e) {}
    
    return null;
}

// Helper: set coordinate fields and update status message
function _setCoords(lat, lng, status, btn) {
    if (lat && lng) {
        document.getElementById('latitude').value = parseFloat(lat);
        document.getElementById('longitude').value = parseFloat(lng);
        if (status) {
            status.innerHTML = `<span style="color:green;">✓ Koordinat ditemukan: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</span>`;
            status.style.color = "green";
        }
    } else {
        if (status) {
            status.innerHTML = `
                <span style="color:var(--danger,#ef4444);">
                ⚠️ Koordinat tidak ditemukan dari link ini.<br>
                Coba cara lain:<br>
                &nbsp;• Buka Google Maps di <b>browser</b> (bukan aplikasi HP)<br>
                &nbsp;• Klik kanan lokasi → <b>Salin koordinat</b><br>
                &nbsp;• Atau gunakan tombol <b>GPS Saat Ini</b> di atas.
                </span>`;
            status.style.color = "var(--danger, #ef4444)";
        }
    }
    if (btn) btn.disabled = false;
}

// Open the pasted Google Maps link in a new tab (so browser resolves short link naturally)
function openGmapsLink() {
    const input = document.getElementById('gmaps_link');
    const status = document.getElementById('gmaps-status');
    let link = (input?.value || '').trim();

    if (!link) {
        window.open('https://maps.google.com', '_blank');
        return;
    }

    // Extract URL if mixed with text
    const m = link.match(/https?:\/\/[^\s]+/);
    if (m) link = m[0];

    window.open(link, '_blank');

    if (status) {
        status.innerHTML = `<span style="color:#2563eb;">
            <i class="fas fa-info-circle"></i> Link dibuka di tab baru.<br>
            Setelah halaman terbuka, <b>salin URL lengkap dari address bar</b>,<br>
            kembali ke sini, <b>tempel di kolom di atas</b>, lalu klik <b>"Ambil Koordinat"</b>.
        </span>`;
    }
}

// Auto-try extracting coordinates when user pastes a link (for direct/long URLs)
function onGmapsLinkInput(value) {
    const status = document.getElementById('gmaps-status');
    if (!value || !value.includes('google.com/maps')) return;

    // Silently try to extract if it's already a full URL
    const regexps = [
        /!3d(-?[\d.]+)!4d(-?[\d.]+)/,
        /@(-?[\d.]+),(-?[\d.]+)/,
        /[?&]q=(-?[\d.]+),(-?[\d.]+)/,
        /[?&]ll=(-?[\d.]+),(-?[\d.]+)/,
    ];

    for (const r of regexps) {
        const match = value.match(r);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                document.getElementById('latitude').value = lat;
                document.getElementById('longitude').value = lng;
                if (status) {
                    status.innerHTML = `<span style="color:green;"><i class="fas fa-check-circle"></i> Koordinat terdeteksi otomatis: ${lat.toFixed(6)}, ${lng.toFixed(6)}</span>`;
                }
                return;
            }
        }
    }
}

// Parse manually entered coordinates like "-6.9012, 110.6234"
function parseManualCoords() {
    const input = document.getElementById('manual_coords');
    const status = document.getElementById('gmaps-status');
    const raw = (input?.value || '').trim();

    // Accept formats: "-6.9012, 110.6234" or "-6.9012 110.6234" or "-6.9012,110.6234"
    const m = raw.match(/^(-?[\d.]+)[,\s]+(-?[\d.]+)$/);
    if (m) {
        const lat = parseFloat(m[1]);
        const lng = parseFloat(m[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            document.getElementById('latitude').value = lat;
            document.getElementById('longitude').value = lng;
            if (status) {
                status.innerHTML = `<span style="color:green;"><i class="fas fa-check-circle"></i> Koordinat manual digunakan: ${lat.toFixed(6)}, ${lng.toFixed(6)}</span>`;
            }
            return;
        }
    }

    if (status) {
        status.innerHTML = `<span style="color:var(--danger,#ef4444);">Format tidak valid. Contoh: <b>-6.9012, 110.6234</b></span>`;
    }
}

// Handle Form Submission and Data Loading
document.addEventListener('DOMContentLoaded', () => {
    const publicForm = document.getElementById('reportForm');
    const adminForm = document.getElementById('adminForm');

    // Check if Edit Mode (Admin Only)
    const urlParams = new URLSearchParams(window.location.search);
    const reportId = urlParams.get('id');

    if (adminForm && reportId) {
        document.querySelector('h1').innerText = "Validasi / Edit Data Jalan";
        document.getElementById('submitBtn').innerText = "Update & Verifikasi Data";
        loadReportData(reportId);
    }

    if (publicForm) {
        publicForm.addEventListener('submit', (e) => submitReport(e, 'public'));
    }
    
    if (adminForm) {
        adminForm.addEventListener('submit', (e) => submitReport(e, 'admin', reportId));
    }

    // Auto-set Date for Public Form
    const dateField = document.getElementById('report_date_display');
    if (dateField) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateField.value = now.toLocaleDateString('id-ID', options);
    }
});

async function loadReportData(id) {
    if (!window.sb) {
        setTimeout(() => loadReportData(id), 500);
        return;
    }

    const { data, error } = await sb
        .from('road_reports')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error || !data) {
        alert("Data tidak ditemukan");
        return;
    }

    // Prefill form
    document.getElementById('district').value = data.district || '';
    document.getElementById('description').value = data.description || '';
    document.getElementById('latitude').value = data.latitude || '';
    document.getElementById('longitude').value = data.longitude || '';
    
    // Admin specific / details
    if(document.getElementById('report_date')) document.getElementById('report_date').value = data.report_date || new Date().toISOString().split('T')[0];
    if(document.getElementById('damage_length')) document.getElementById('damage_length').value = data.damage_length || '';
    if(document.getElementById('damage_width')) document.getElementById('damage_width').value = data.damage_width || '';
    
    // Robust SDI Loading
    let sdiVal = (data.sdi_value !== null && data.sdi_value !== undefined) ? data.sdi_value : 0;
    let sdiCat = data.sdi_category || '';
    if (sdiVal === 0) sdiCat = 'Tidak Rusak';
    if(document.getElementById('sdi_value')) document.getElementById('sdi_value').value = sdiVal;
    if(document.getElementById('sdi_category')) document.getElementById('sdi_category').value = sdiCat;
    
    // Robust PCI Loading
    let pciVal = (data.pci_value !== null && data.pci_value !== undefined) ? data.pci_value : 0;
    let pciCat = data.pci_category || '';
    if (pciVal === 0) pciCat = 'Tidak Rusak';
    if(document.getElementById('pci_value')) document.getElementById('pci_value').value = pciVal;
    if(document.getElementById('pci_category')) document.getElementById('pci_category').value = pciCat;
}

async function submitReport(e, source, id = null) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Memproses...";

    // Collect Data
    const formData = {
        district: document.getElementById('district').value,
        description: document.getElementById('description').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
    };

    // Only set source for NEW reports
    if (!id) {
        formData.report_source = source;
    }

    // Source specific fields
    if (source === 'public') {
        formData.reporter_name = document.getElementById('reporter_name').value;
        formData.reporter_contact = document.getElementById('reporter_contact').value;
        if (!id) formData.status = 'pending'; // New public reports are pending
    } else {
        formData.report_date = document.getElementById('report_date').value;
        formData.damage_length = parseFloat(document.getElementById('damage_length').value) || 0;
        formData.damage_width = parseFloat(document.getElementById('damage_width').value) || 0;
        // Jika Admin submits/edits, kita tetapkan category default bila empty/0
        let tempSdiVal = parseFloat(document.getElementById('sdi_value').value) || 0;
        let tempSdiCat = document.getElementById('sdi_category').value || '';
        if (tempSdiVal === 0 && tempSdiCat === '') tempSdiCat = 'Tidak Rusak';

        let tempPciVal = parseFloat(document.getElementById('pci_value').value) || 0;
        let tempPciCat = document.getElementById('pci_category').value || '';
        if (tempPciVal === 0 && tempPciCat === '') tempPciCat = 'Tidak Rusak';

        formData.sdi_value = tempSdiVal;
        formData.sdi_category = tempSdiCat;
        formData.pci_value = tempPciVal;
        formData.pci_category = tempPciCat;
        
        // If Admin submits/edits, we mark it as verified by default
        formData.status = 'verified';
    }

    // Handle Photo Upload
    const fileInput = document.getElementById('photo');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Update user feedback
        btn.innerText = "Mengkompresi foto...";
        
        try {
            const compressedFile = await processImageWithWatermark(file);
            const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            
            btn.innerText = "Mengupload foto...";
            
            const { data: uploadData, error: uploadError } = await sb
                .storage
                .from('photos')
                .upload(fileName, compressedFile);

            if (uploadError) {
                alert('Gagal upload foto: ' + uploadError.message);
                btn.disabled = false;
                btn.innerText = "Kirim / Simpan";
                return;
            }

            // Get Public URL
            const { data: { publicUrl } } = sb
                .storage
                .from('photos')
                .getPublicUrl(fileName);
                
            formData.photo_url = publicUrl;
        } catch (compError) {
            console.error("Compression error:", compError);
            alert("Gagal memproses foto. Silakan coba lagi.");
            btn.disabled = false;
            btn.innerText = "Kirim / Simpan";
            return;
        }
    }

    // DB Action: Insert or Update
    btn.innerText = "Menyimpan data...";
    let error;
    if (id) {
        // UPDATE
        const res = await sb.from('road_reports').update(formData).eq('id', id);
        error = res.error;
    } else {
        // INSERT
        const res = await sb.from('road_reports').insert([formData]);
        error = res.error;
    }

    if (error) {
        alert('Gagal menyimpan data: ' + error.message);
    } else {
        alert('Data Berhasil Disimpan!');
        if (source === 'public') {
            location.replace('/index.html'); 
            document.getElementById('reportForm').reset();
        } else {
            location.replace('/home'); // Back to Admin Dashboard
        }
    }
    
    btn.disabled = false;
    btn.innerText = "Kirim / Simpan";
}

// Utility: Image Processing with Watermark & Compression
function processImageWithWatermark(file) {
    const MAX_SIZE_MB = 1;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Max dimension for efficiency
                const MAX_DIMENSION = 1600; 
                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // --- DESIGN PREMIUM WATERMARK (Box Style) ---
                const scale = width / 1000; // base scale
                const boxW = width * 0.8;
                const boxH = 120 * scale;
                const boxX = (width - boxW) / 2;
                const boxY = height - boxH - (20 * scale);
                const radius = 15 * scale;

                // Rounded semi-transparent background
                ctx.beginPath();
                ctx.moveTo(boxX + radius, boxY);
                ctx.lineTo(boxX + boxW - radius, boxY);
                ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
                ctx.lineTo(boxX + boxW, boxY + boxH - radius);
                ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
                ctx.lineTo(boxX + radius, boxY + boxH);
                ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
                ctx.lineTo(boxX, boxY + radius);
                ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
                ctx.closePath();
                ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                ctx.fill();

                // Typography setup
                ctx.fillStyle = "white";
                ctx.font = `bold ${24 * scale}px 'Plus Jakarta Sans', sans-serif`;
                
                // Content
                const now = new Date();
                const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const lat = document.getElementById('latitude')?.value || 'N/A';
                const lng = document.getElementById('longitude')?.value || 'N/A';
                const district = document.getElementById('district')?.value || 'Kabupaten Demak';

                // Drawing text
                ctx.textAlign = "left";
                
                // Row 1: District / Brand
                ctx.font = `bold ${22 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.fillText(district, boxX + (20 * scale), boxY + (35 * scale));
                
                // Row 2: URL
                ctx.font = `${16 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.fillText("lpjd.vercel.app", boxX + (20 * scale), boxY + (60 * scale));

                // Row 3: Coordinates (Large)
                ctx.font = `bold ${26 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.fillText(`${lat}°N  ${lng}°E`, boxX + (20 * scale), boxY + (95 * scale));

                // Row 4: Date & Time (Right side)
                ctx.font = `${18 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.textAlign = "right";
                ctx.fillText(`${dateStr}, ${timeStr}`, boxX + boxW - (20 * scale), boxY + (95 * scale));

                // --- ITERATIVE COMPRESSION ---
                let quality = 0.85;
                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error("Canvas to Blob failed"));
                            return;
                        }

                        if (blob.size <= MAX_SIZE_BYTES || quality <= 0.1) {
                            resolve(blob);
                        } else {
                            quality -= 0.1;
                            tryCompress();
                        }
                    }, 'image/jpeg', quality);
                };

                tryCompress();
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
