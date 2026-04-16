// Analysis Logic for Lapor Jalan AI
const PCI_MAPPING = {
    'IMG_0756.PNG': 'Alligator Cracking (Retak Kulit Buaya)',
    'IMG_0757.PNG': 'Bleeding (Kegemukan)',
    'IMG_0758.PNG': 'Block Cracking (Retak Kotak-kotak)',
    'IMG_0759.PNG': 'Bumps and Sags (Cekungan/Benjolan)',
    'IMG_0760.PNG': 'Corrugation (Keriting)',
    'IMG_0761.PNG': 'Depression (Amblas)',
    'IMG_0762.PNG': 'Edge Cracking (Retak Pinggir)',
    'IMG_0763.PNG': 'Joint Reflection Cracking (Retak Sambung)',
    'IMG_0764.PNG': 'Lane/Shoulder Drop Off (Bahu Turun)',
    'IMG_0765.PNG': 'Patching (Tambalan)',
    'IMG_0766.PNG': 'Polished Aggregate (Pengausan)',
    'IMG_0767.PNG': 'Potholes (Lubang)'
};

let currentReports = [];
let selectedReport = null;
let analysisResult = null;

document.addEventListener('DOMContentLoaded', () => {
    loadPendingReports();
});

async function loadPendingReports() {
    const { data, error } = await sb
        .from('road_reports')
        .select('*')
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reports:', error);
        return;
    }

    currentReports = data;
    renderReportList();
    document.getElementById('pendingCount').innerText = `${data.length} laporan menunggu analisis`;
}

function renderReportList() {
    const container = document.getElementById('reportItems');
    if (currentReports.length === 0) {
        container.innerHTML = `<div style="padding: 2rem; text-align: center; color: #94a3b8;">
            <i class="fas fa-check-circle fa-2x" style="margin-bottom: 10px; color: #10b981;"></i>
            <p>Semua laporan telah dianalisis!</p>
        </div>`;
        return;
    }

    container.innerHTML = currentReports.map(report => `
        <div class="report-item ${selectedReport && selectedReport.id === report.id ? 'active' : ''}" 
             onclick="selectReport(${report.id})">
            <img src="${report.photo_url || 'images/placeholder.png'}" alt="Thumb">
            <div class="report-item-info">
                <h4>${report.reporter_name || 'Anonim'}</h4>
                <p><i class="fas fa-map-marker-alt"></i> ${report.district}</p>
                <p style="font-size: 0.7rem; opacity: 0.7;">${new Date(report.created_at).toLocaleDateString('id-ID')}</p>
            </div>
        </div>
    `).join('');
}

function selectReport(id) {
    selectedReport = currentReports.find(r => r.id === id);
    renderReportList();
    
    // UI Updates
    document.getElementById('emptyWorkspace').style.display = 'none';
    document.getElementById('activeWorkspace').style.display = 'block';
    document.getElementById('resultsPanel').style.display = 'none';
    
    // Reporter Info
    document.getElementById('repName').innerText = selectedReport.reporter_name || 'Warga';
    document.getElementById('repInitial').innerText = (selectedReport.reporter_name || 'W').charAt(0).toUpperCase();
    document.getElementById('repDistrict').innerText = selectedReport.district;
    
    // Photos
    document.getElementById('citizenPhoto').src = selectedReport.photo_url;
    
    // Reset Reference
    document.getElementById('refPhoto').style.display = 'none';
    document.getElementById('refPlaceholder').style.display = 'flex';
    
    // Reset Action Button
    document.getElementById('btnProcess').disabled = false;
    document.getElementById('btnProcess').innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Awali Analisis AI';
}

async function startAnalysis() {
    if (!selectedReport) return;
    
    const apiKey = localStorage.getItem('gemini_api_key');
    const btn = document.getElementById('btnProcess');
    const scanner = document.getElementById('scanner');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sedang Menganalisis...';
    scanner.style.display = 'block';
    
    if (!apiKey) {
        // Simulation Mode
        console.warn('API Key not found. Entering Simulation Mode.');
        setTimeout(() => performSimulation(), 2500);
    } else {
        // Real AI Mode
        try {
            await performRealAnalysis(apiKey);
        } catch (err) {
            console.error('AI Analysis failed:', err);
            alert('Gagal megintegrasi dengan AI. Masuk ke mode simulasi saja?');
            performSimulation();
        }
    }
}

function performSimulation() {
    const scanner = document.getElementById('scanner');
    scanner.style.display = 'none';
    
    // Simulate complex results for demo
    const keys = Object.keys(PCI_MAPPING);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const damageType = PCI_MAPPING[randomKey];
    
    showAnalysisResult(
        randomKey, 
        damageType, 
        "Deteksi visual menunjukkan pola retakan yang konsisten dengan standar PCI. Teramati adanya degradasi struktural pada lapisan pengikat aspal.", 
        88.5, // Similarity
        "High", // Severity
        "Beban lalu lintas kendaraan berat yang melebihi kapasitas desain jalan (Overload).", // Cause
        "Lakukan pengerukan (milling) pada lapisan yang rusak dan lapis ulang (overlay) dengan aspal panas.", // Recommendation
        4 // Priority
    );
}

async function performRealAnalysis(apiKey) {
    const imageUrl = selectedReport.photo_url;
    const scanner = document.getElementById('scanner');
    
    // Detailed technical descriptions for high accuracy
    const PCI_DESCRIPTIONS = {
        'Alligator Cracking (Retak Kulit Buaya)': 'Rangkaian retakan yang saling terhubung membentuk pola kulit buaya. Sebab: fatigue failure.',
        'Bleeding (Kegemukan)': 'Lapisan aspal cair di permukaan yang mengkilap dan lengket. Sebab: aspal berlebih.',
        'Block Cracking (Retak Kotak-kotak)': 'Retakan membentuk blok persegi/persegi panjang (0.1m2 - 10m2).',
        'Bumps and Sags (Cekungan/Benjolan)': 'Perpindahan lokal ke atas (benjolan) atau ke bawah (cekungan).',
        'Corrugation (Keriting)': 'Gelombang melintang pada permukaan jalan dengan interval teratur.',
        'Depression (Amblas)': 'Area rendah yang sering tergenang air. Sebab: penurunan lapis pondasi.',
        'Edge Cracking (Retak Pinggir)': 'Retakan sejajar pinggir jalan (jarak 0.3 - 0.5m).',
        'Joint Reflection Cracking (Retak Sambung)': 'Retakan aspal tepat di atas sambungan beton di bawahnya.',
        'Lane/Shoulder Drop Off (Bahu Turun)': 'Beda tinggi lajur lalu lintas dengan bahu jalan.',
        'Patching (Tambalan)': 'Area jalan yang telah diperbaiki dengan material baru.',
        'Polished Aggregate (Pengausan)': 'Butiran agregat menjadi licin/halus karena gesekan ban.',
        'Potholes (Lubang)': 'Depresi mangkuk dengan tepi tajam (diameter < 750mm).'
    };

    const prompt = `Analisis foto kerusakan jalan ini sebagai Pakar Forensik Jalan (Standard PCI).
    
    IDENTIFIKASI SECARA DETAIL:
    1. Kategori (Pilih 1): [${Object.keys(PCI_DESCRIPTIONS).join(', ')}]
    2. Tingkat Kemiripan (%) dengan Standar Referensi.
    3. Tingkat Keparahan (Low/Medium/High).
    4. Penyebab Klinis (Analisis penyebab kerusakan).
    5. Rekomendasi Penanganan (Saran perbaikan konkret).
    6. Skor Prioritas (1-5, 5 tertinggi).
    
    KEMBALIKAN HANYA JSON:
    {
        "category": "Exact Category",
        "similarity": numeral,
        "severity": "Low/Medium/High",
        "cause": "Analisis penyebab dalam Bahasa Indonesia (Indo)",
        "recommendation": "Saran perbaikan (Indo)",
        "priority": 1-5,
        "reasoning": "Penjelasan visual mendetail (Indo)"
    }`;

    const imageBase64 = await urlToBase64(imageUrl);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        })
    });

    const data = await response.json();
    scanner.style.display = 'none';

    if (data.candidates && data.candidates[0].content.parts[0].text) {
        let text = data.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const res = JSON.parse(text);
        
        const filename = Object.keys(PCI_MAPPING).find(key => PCI_MAPPING[key] === res.category);
        
        showAnalysisResult(
            filename || 'IMG_0767.PNG', 
            res.category, 
            res.reasoning, 
            res.similarity, 
            res.severity, 
            res.cause, 
            res.recommendation, 
            res.priority
        );
    } else {
        throw new Error('Invalid AI response');
    }
}

async function urlToBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function showAnalysisResult(filename, type, reason, similarity, severity, cause, recommendation, priority) {
    analysisResult = { filename, type, reason, similarity, severity, cause, recommendation, priority };
    
    // Update reference image
    const refPhoto = document.getElementById('refPhoto');
    refPhoto.src = `images/pci_params/${filename}`;
    refPhoto.style.display = 'block';
    document.getElementById('refPlaceholder').style.display = 'none';
    
    // Show results panel
    document.getElementById('resultsPanel').style.display = 'block';
    document.getElementById('damageType').innerText = type;
    
    // Forensic Updates
    document.getElementById('similarityText').innerText = `${similarity}%`;
    document.getElementById('similarityFill').style.width = `${similarity}%`;
    
    const badge = document.getElementById('severityBadge');
    badge.innerText = severity;
    badge.className = `severity-badge severity-${severity.toLowerCase()}`;
    
    document.getElementById('priorityScore').innerText = `Priority Score: ${priority}/5`;
    document.getElementById('aiCause').innerText = cause;
    document.getElementById('aiRec').innerText = recommendation;
    document.getElementById('aiReasoning').innerText = reason;
    
    // Scroll to results
    document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });

    // Update main button
    const btn = document.getElementById('btnProcess');
    btn.innerHTML = '<i class="fas fa-microscope"></i> Analisis Forensik Selesai';
}

async function saveAnalysis() {
    if (!selectedReport || !analysisResult) return;
    
    const btn = document.querySelector('.results-header .btn-primary');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    
    const detailedDesc = `
[FORENSIC ANALYSIS]
Tipe: ${analysisResult.type}
Similarity: ${analysisResult.similarity}%
Severity: ${analysisResult.severity}
Cause: ${analysisResult.cause}
Recommendation: ${analysisResult.recommendation}
Priority: ${analysisResult.priority}/5

Reasoning: ${analysisResult.reason}

-------------------
Original Desc: ${selectedReport.description || 'Tidak ada deskripsi.'}
    `.trim();

    const { error } = await sb
        .from('road_reports')
        .update({
            status: 'verified',
            pci_category: analysisResult.type,
            pci_value: analysisResult.priority, // Saving priority to pci_value
            description: detailedDesc
        })
        .eq('id', selectedReport.id);

    if (error) {
        alert('Gagal menyimpan: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        return;
    }

    alert('Analisis Forensik Berhasil Disimpan!');
    selectedReport = null;
    analysisResult = null;
    loadPendingReports();
}

