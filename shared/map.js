// shared/map.js
let mainMap = null;
let mapLayers = {
  sdi: null,
  pci: null,
  public: null,
  admin: null,
};

// Fungsi untuk inisialisasi peta
function initMap(mapId = "main-map", center = [-6.2088, 106.8456], zoom = 12) {
  if (!document.getElementById(mapId)) {
    console.error(`Map container #${mapId} not found`);
    return null;
  }

  mainMap = L.map(mapId).setView(center, zoom);

  // Tambahkan tile layer (OpenStreetMap)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(mainMap);

  // Inisialisasi layer groups
  mapLayers = {
    sdi: L.layerGroup().addTo(mainMap),
    pci: L.layerGroup().addTo(mainMap),
    public: L.layerGroup().addTo(mainMap),
    admin: L.layerGroup().addTo(mainMap),
  };

  // Tambahkan kontrol layer
  const baseLayers = {
    OpenStreetMap: L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
      }
    ),
    Satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "© Esri, Maxar, Earthstar Geographics",
      }
    ),
  };

  const overlayLayers = {
    "SDI Index": mapLayers.sdi,
    "PCI Index": mapLayers.pci,
    "Laporan Masyarakat": mapLayers.public,
    "Data Admin": mapLayers.admin,
  };

  L.control.layers(baseLayers, overlayLayers).addTo(mainMap);

  // Tambahkan kontrol zoom
  L.control
    .zoom({
      position: "topright",
    })
    .addTo(mainMap);

  return mainMap;
}

// Fungsi untuk update layer peta dengan data
function updateMapLayers(roads = [], reports = []) {
  if (!mainMap) return;

  // Clear semua layer
  Object.values(mapLayers).forEach((layer) => layer.clearLayers());

  // Tambahkan data jalan (SDI/PCI)
  roads.forEach((road) => {
    if (!road.latitude || !road.longitude) return;

    const latlng = [parseFloat(road.latitude), parseFloat(road.longitude)];
    const isAdminData = road.reported_by === "admin";

    let color, size, popupContent;

    // Tentukan warna berdasarkan kondisi
    if (road.condition_sdi) {
      color = getSDIColor(road.condition_sdi);
      size = 10;
      popupContent = createRoadPopup(road, "SDI");
      addMarker(latlng, color, size, popupContent, mapLayers.sdi, "circle");
    }

    if (road.condition_pci) {
      color = getPCIColor(road.condition_pci);
      size = 8;
      popupContent = createRoadPopup(road, "PCI");
      addMarker(latlng, color, size, popupContent, mapLayers.pci, "circle");
    }

    // Tambahkan ke layer admin jika data dari admin
    if (isAdminData) {
      const adminIcon = L.divIcon({
        className: "admin-marker",
        html: '<i class="fas fa-road" style="color: #8B5CF6;"></i>',
        iconSize: [24, 24],
      });

      L.marker(latlng, { icon: adminIcon })
        .addTo(mapLayers.admin)
        .bindPopup(createRoadPopup(road, "Admin"));
    }
  });

  // Tambahkan laporan masyarakat
  reports.forEach((report) => {
    if (!report.latitude || !report.longitude) return;

    const latlng = [parseFloat(report.latitude), parseFloat(report.longitude)];
    const status = report.status || "pending";
    const color = getStatusColor(status);

    const icon = L.divIcon({
      className: "report-marker",
      html: `<i class="fas fa-user" style="color: ${color};"></i>`,
      iconSize: [24, 24],
    });

    L.marker(latlng, { icon })
      .addTo(mapLayers.public)
      .bindPopup(createReportPopup(report));
  });

  // Fit bounds jika ada data
  const allMarkers = [];
  roads.forEach((road) => {
    if (road.latitude && road.longitude) {
      allMarkers.push([parseFloat(road.latitude), parseFloat(road.longitude)]);
    }
  });

  reports.forEach((report) => {
    if (report.latitude && report.longitude) {
      allMarkers.push([
        parseFloat(report.latitude),
        parseFloat(report.longitude),
      ]);
    }
  });

  if (allMarkers.length > 0) {
    mainMap.fitBounds(allMarkers);
  }
}

// Fungsi untuk menambahkan marker
function addMarker(latlng, color, size, popupContent, layer, type = "circle") {
  if (type === "circle") {
    L.circleMarker(latlng, {
      radius: size,
      fillColor: color,
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    })
      .addTo(layer)
      .bindPopup(popupContent);
  } else {
    L.marker(latlng).addTo(layer).bindPopup(popupContent);
  }
}

// Fungsi untuk membuat popup konten jalan
function createRoadPopup(road, indexType) {
  return `
        <div class="road-popup">
            <h4>${road.road_name || "Jalan Tanpa Nama"}</h4>
            <p><strong>Kecamatan:</strong> ${road.district || "-"}</p>
            ${
              road.condition_sdi && indexType === "SDI"
                ? `<p><strong>Kondisi SDI:</strong> ${getSDILabel(
                    road.condition_sdi
                  )}</p>`
                : ""
            }
            ${
              road.condition_pci && indexType === "PCI"
                ? `<p><strong>Kondisi PCI:</strong> ${getPCILabel(
                    road.condition_pci
                  )}</p>`
                : ""
            }
            ${
              road.description
                ? `<p><strong>Deskripsi:</strong> ${road.description}</p>`
                : ""
            }
            ${
              road.width && road.length
                ? `<p><strong>Dimensi:</strong> ${road.width}m × ${road.length}m</p>`
                : ""
            }
            <p><small>Dilaporkan oleh: ${
              road.reported_by || "admin"
            }</small></p>
        </div>
    `;
}

// Fungsi untuk membuat popup konten laporan
function createReportPopup(report) {
  const statusLabels = {
    pending: "Menunggu",
    verified: "Terverifikasi",
    rejected: "Ditolak",
    completed: "Selesai",
  };

  return `
        <div class="report-popup">
            <h4>Laporan Masyarakat</h4>
            <p><strong>Pelapor:</strong> ${report.reporter_name || "-"}</p>
            <p><strong>Kecamatan:</strong> ${report.district || "-"}</p>
            <p><strong>Status:</strong> ${
              statusLabels[report.status] || report.status
            }</p>
            <p><strong>Deskripsi:</strong> ${report.description || "-"}</p>
            ${
              report.photo_url
                ? `
                <img src="${report.photo_url}" 
                     alt="Foto kerusakan" 
                     style="max-width: 200px; max-height: 150px; border-radius: 5px; margin-top: 10px;">
            `
                : ""
            }
            <p><small>${formatDate(report.created_at)}</small></p>
        </div>
    `;
}

// Fungsi untuk mendapatkan warna berdasarkan kondisi SDI
function getSDIColor(condition) {
  switch (condition) {
    case "baik":
      return "#4CAF50";
    case "sedang":
      return "#8BC34A";
    case "rusak_ringan":
      return "#FFC107";
    case "rusak_berat":
      return "#F44336";
    default:
      return "#9E9E9E";
  }
}

function getSDILabel(condition) {
  const labels = {
    baik: "Baik",
    sedang: "Sedang",
    rusak_ringan: "Rusak Ringan",
    rusak_berat: "Rusak Berat",
  };
  return labels[condition] || condition;
}

// Fungsi untuk mendapatkan warna berdasarkan kondisi PCI
function getPCIColor(condition) {
  switch (condition) {
    case "excellent":
      return "#2196F3";
    case "good":
      return "#4CAF50";
    case "fair":
      return "#8BC34A";
    case "poor":
      return "#FFC107";
    case "very_poor":
      return "#FF9800";
    case "serious":
      return "#F44336";
    case "failed":
      return "#B71C1C";
    default:
      return "#9E9E9E";
  }
}

function getPCILabel(condition) {
  const labels = {
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    very_poor: "Very Poor",
    serious: "Serious",
    failed: "Failed",
  };
  return labels[condition] || condition;
}

// Fungsi untuk mendapatkan warna berdasarkan status laporan
function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "#F59E0B";
    case "verified":
      return "#10B981";
    case "rejected":
      return "#EF4444";
    case "completed":
      return "#3B82F6";
    default:
      return "#6B7280";
  }
}

// Fungsi untuk memformat tanggal
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Fungsi untuk mendapatkan peta instance
function getMap() {
  return mainMap;
}

// Fungsi untuk menambahkan marker custom
function addCustomMarker(latlng, options = {}) {
  if (!mainMap) return null;

  const defaultIcon = L.divIcon({
    className: "custom-marker",
    html: '<i class="fas fa-map-marker-alt"></i>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });

  const marker = L.marker(latlng, {
    icon: options.icon || defaultIcon,
    draggable: options.draggable || false,
    ...options,
  }).addTo(mainMap);

  if (options.popup) {
    marker.bindPopup(options.popup);
  }

  return marker;
}

// Ekspor fungsi
export {
  initMap,
  updateMapLayers,
  getMap,
  addCustomMarker,
  getSDIColor,
  getPCIColor,
  getStatusColor,
  formatDate,
};
