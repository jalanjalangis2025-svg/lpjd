// Secret Management Logic
let allReports = [];
const districts = [
    "Mranggen", "Karangawen", "Guntur", "Sayung", "Karangtengah",
    "Bonang", "Demak", "Wonosalam", "Dempet", "Kebonagung",
    "Gajah", "Karanganyar", "Mijen", "Wedung"
];

document.addEventListener('DOMContentLoaded', () => {
    populateDistricts();
    loadReports();

    document.getElementById('editForm').addEventListener('submit', handleUpdate);
});

function populateDistricts() {
    const select = document.getElementById('edit-district');
    select.innerHTML = districts.map(d => `<option value="${d}">${d}</option>`).join('');
}

async function loadReports() {
    const tbody = document.getElementById('reportsBody');
    if (!window.sb) {
        setTimeout(loadReports, 500);
        return;
    }

    const { data, error } = await sb
        .from('road_reports')
        .select('*')
        .eq('report_source', 'public')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal: ${error.message}</td></tr>`;
        return;
    }

    allReports = data;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('reportsBody');
    if (allReports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada laporan warga.</td></tr>`;
        return;
    }

    tbody.innerHTML = allReports.map(item => {
        const dateObj = new Date(item.created_at);
        const dateStr = dateObj.toLocaleDateString('id-ID', { 
            day: '2-digit', month: 'short', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });

        return `
            <tr>
                <td>${item.id}</td>
                <td><span style="font-family: monospace; font-size: 0.85rem;">${dateStr}</span></td>
                <td style="font-weight: 600;">${item.reporter_name || 'Anonim'}</td>
                <td>${item.district}</td>
                <td><span class="badge badge-${item.status}">${item.status.toUpperCase()}</span></td>
                <td style="text-align: center;">
                    <button onclick="openEditModal(${item.id})" class="btn btn-outline" style="padding: 5px 10px; font-size: 0.8rem; margin: auto;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openEditModal(id) {
    const report = allReports.find(r => r.id === id);
    if (!report) return;

    document.getElementById('edit-id').value = report.id;
    document.getElementById('edit-name').value = report.reporter_name || '';
    document.getElementById('edit-desc').value = report.description || '';
    document.getElementById('edit-district').value = report.district;
    document.getElementById('edit-report-date').value = report.report_date || '';
    document.getElementById('edit-status').value = report.status || 'pending';

    // Format created_at for datetime-local (YYYY-MM-DDTHH:MM)
    if (report.created_at) {
        const date = new Date(report.created_at);
        // Correct for timezone offset to get local time for the input
        const localISO = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('edit-created-at').value = localISO;
    }

    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function handleUpdate(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const btn = e.target.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.innerText = "Menyimpan...";

    const createdAtLocal = document.getElementById('edit-created-at').value;
    let createdAtISO = null;
    if (createdAtLocal) {
        createdAtISO = new Date(createdAtLocal).toISOString();
    }

    let reportDate = document.getElementById('edit-report-date').value;
    if (reportDate === "") reportDate = null;

    const updateData = {
        reporter_name: document.getElementById('edit-name').value,
        description: document.getElementById('edit-desc').value,
        district: document.getElementById('edit-district').value,
        report_date: reportDate,
        status: document.getElementById('edit-status').value,
        created_at: createdAtISO
    };

    const { error } = await sb
        .from('road_reports')
        .update(updateData)
        .eq('id', id);

    if (error) {
        alert("Gagal update: " + error.message);
    } else {
        alert("Data berhasil diperbarui!");
        closeEditModal();
        loadReports();
    }

    btn.disabled = false;
    btn.innerText = "Simpan Perubahan";
}
