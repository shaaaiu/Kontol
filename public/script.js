// === GLOBAL CONFIG (CLIENT) ===
const global = {
  domain: "https://panel.xiao-store.web.id",

  // QRIS Ryuuxiao
  qrisBaseUrl: "https://apii.ryuuxiao.biz.id",
  qrisApiToken: "RyuuXiao",
  qrisUsername: "adjie22",
  qrisOrderToken: "1451589:fsoScMnGEp6kjIQav2L7l0ZWgd1NXVer",

  CURRENT_QRIS_KEY: "current_qris_session",
  STORAGE_KEY: "riwayat_transaksi_panel",
  PANEL_LOGIN_LINK: "https://panel.xiao-store.web.id",

  // TELEGRAM BOT OWNER
  TELEGRAM_BOT_TOKEN: "8105677831:AAFRyE6rRbIi3E9riMBIkaSA0Ya_lfT9tWg",
  TELEGRAM_CHAT_ID: "5254873680",
};

// Paket
const PACKAGE_CONFIG = {
  '1':      { nama: '500mb', harga: 1,      memo: 1048,  disk: 2000, cpu: 30  },
  '2000':   { nama: '1gb',   harga: 2000,   memo: 1048,  disk: 2000, cpu: 30  },
  '3000':   { nama: '2gb',   harga: 3000,   memo: 2048,  disk: 2000, cpu: 50  },
  '4000':   { nama: '3gb',   harga: 4000,   memo: 3048,  disk: 2000, cpu: 75  },
  '5000':   { nama: '4gb',   harga: 5000,   memo: 4048,  disk: 2000, cpu: 100 },
  '6000':   { nama: '5gb',   harga: 6000,   memo: 5048,  disk: 2000, cpu: 130 },
  '7000':   { nama: '6gb',   harga: 7000,   memo: 6048,  disk: 2000, cpu: 150 },
  '8000':   { nama: '7gb',   harga: 8000,   memo: 7048,  disk: 2000, cpu: 175 },
  '9000':   { nama: '8gb',   harga: 9000,   memo: 8048,  disk: 2000, cpu: 200 },
  '10000':  { nama: '9gb',   harga: 10000,  memo: 9048,  disk: 2000, cpu: 225 },
  '12000':  { nama: '10gb',  harga: 12000,  memo: 10048, disk: 2000, cpu: 250 },
  '15000':  { nama: 'unli',  harga: 15000,  memo: 0,     disk: 0,    cpu: 0 } 
};

function $(id){return document.getElementById(id);}

function toRupiah(number) {
  if (isNaN(number) || number === null) return 'RpN/A';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number).replace('Rp', 'Rp');
}

// kode unik FIX 120
function getKodeUnik() {
  return 120;
}

function getSelectedRamInfo() {
  const selectEl = $("ram");
  const selectedValue = selectEl.value;
  const config = PACKAGE_CONFIG[selectedValue];
  return config || { nama: 'N/A', harga: 0, memo: 0, disk: 0, cpu: 0 };
}

function updateTotalHarga() {
  const { harga } = getSelectedRamInfo();
  $("totalHarga").textContent = `Total Harga: ${toRupiah(harga)}`;
}

function refreshInput() {
  const teleponEl = $("telepon");
  const usernameEl = $("username");
  const ramEl = $("ram");
  if (teleponEl) teleponEl.value = "";
  if (usernameEl) usernameEl.value = "";
  if (ramEl) ramEl.selectedIndex = 0;
  updateTotalHarga();
  alert("Input berhasil di-reset.");
}

// load qris aktif dari localstorage
function loadSavedQris() {
  const savedQris = localStorage.getItem(global.CURRENT_QRIS_KEY);
  if (!savedQris) return false;

  try {
    const qrisData = JSON.parse(savedQris);
    const now = Date.now();

    if (qrisData.waktuKadaluarsa && qrisData.waktuKadaluarsa < now) {
      localStorage.removeItem(global.CURRENT_QRIS_KEY);
      return false;
    }

    $("telepon").value = qrisData.telepon || '';
    $("username").value = qrisData.username || '';
    $("ram").value = qrisData.hargaTanpaUnik ? qrisData.hargaTanpaUnik.toString() : '';
    updateTotalHarga();

    $("qrisImage").src = qrisData.qrUrl;
    $("detailPembayaran").textContent = qrisData.detailText;
    $("qrisSection").classList.remove("hidden");
    $("btnBatal").classList.remove("hidden");

    mulaiCekMutasi(
      qrisData.paymentId,
      qrisData.username,
      qrisData.totalHargaDibayar,
      qrisData.telepon,
      qrisData.hargaTanpaUnik
    );
    return true;

  } catch (e) {
    console.error("Gagal memuat QRIS tersimpan:", e);
    localStorage.removeItem(global.CURRENT_QRIS_KEY);
    return false;
  }
}

// kirim notif telegram
async function sendTelegramNotification(message) {
  if (!global.TELEGRAM_BOT_TOKEN || !global.TELEGRAM_CHAT_ID) {
    console.warn("Bot token / chat id belum di-set.");
    return;
  }

  const url = `https://api.telegram.org/bot${global.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const params = {
    chat_id: global.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'Markdown'
  };

  const queryString = new URLSearchParams(params).toString();

  try {
    await fetch(`${url}?${queryString}`);
  } catch (e) {
    console.error("Kesalahan jaringan saat mengirim notifikasi Telegram:", e);
  }
}

// random neon accent setiap order
function applyRandomAccentColor() {
  const pairs = [
    ['#00ff6a', '#00f0ff'],
    ['#00f0ff', '#a855f7'],
    ['#a3ff00', '#22c55e'],
    ['#f97316', '#22c55e'],
    ['#22c55e', '#14b8a6'],
  ];
  const pick = pairs[Math.floor(Math.random() * pairs.length)];
  document.documentElement.style.setProperty('--accent', pick[0]);
  document.documentElement.style.setProperty('--accent2', pick[1]);
}

// BUAT QRIS
async function buatQris() {
  const telepon = $("telepon").value.trim();
  const username = $("username").value.trim();
  const { harga: ramHarga, nama: ramNama } = getSelectedRamInfo();

  if (!telepon) { alert("Nomor Telepon tidak boleh kosong."); return; }
  if (!username) { alert("Username tidak boleh kosong."); return; }
  if (ramHarga <= 0) { alert("Pilih paket RAM terlebih dahulu."); return; }

  // simple username validate
  if (!/^[a-zA-Z0-9]{3,15}$/.test(username)) {
    alert("Username harus 3-15 karakter alfanumerik tanpa spasi.");
    return;
  }

  const kodeUnik = getKodeUnik();
  const totalHargaDibayar = ramHarga + kodeUnik;

  const loadingText = $("loadingText");
  const qrisSection = $("qrisSection");
  const btnBatal = $("btnBatal");

  loadingText.classList.remove("hidden");

  try {
    if (localStorage.getItem(global.CURRENT_QRIS_KEY)) {
      alert("Selesaikan atau batalkan pembayaran QRIS yang sedang berjalan terlebih dahulu.");
      loadingText.classList.add("hidden");
      return;
    }

    applyRandomAccentColor();

    const url = `${global.qrisBaseUrl}/orderkuota/createpayment?apikey=${global.qrisApiToken}&username=${global.qrisUsername}&token=${global.qrisOrderToken}&amount=${totalHargaDibayar}`;
    const res = await fetch(url);
    const data = await res.json();

    loadingText.classList.add("hidden");

    if (!data.status || !data.result || !data.result.imageqris) {
      console.error("Gagal membuat QRIS. Respons API:", data);
      alert("Gagal membuat QRIS. Cek console log.");
      return;
    }

    const qrUrl = data.result.imageqris.url;
    const paymentId = data.result.trx_id || Math.random().toString(36).substring(2);

    qrisSection.classList.remove("hidden");
    btnBatal.classList.remove("hidden");

    $("qrisImage").src = qrUrl;

    const now = new Date();
    const expiredAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 menit

    const displayId = `RyuuXiao-${paymentId}`;
    const detailText =
`ID        : ${displayId}
Paket     : ${ramNama.toUpperCase()} (${toRupiah(ramHarga)})
Total     : ${toRupiah(totalHargaDibayar)}
Expired   : ${expiredAt.toLocaleString("id-ID")}
Username  : ${username}
Kode Unik : ${kodeUnik}`;

    $("detailPembayaran").textContent = detailText;

    localStorage.setItem(global.CURRENT_QRIS_KEY, JSON.stringify({
      paymentId,
      username,
      telepon,
      hargaTanpaUnik: ramHarga,
      totalHargaDibayar: totalHargaDibayar,
      ramNama,
      qrUrl,
      detailText,
      waktuKadaluarsa: expiredAt.getTime()
    }));

    mulaiCekMutasi(paymentId, username, totalHargaDibayar, telepon, ramHarga);

  } catch (err) {
    console.error(err);
    loadingText.classList.add("hidden");
    alert("Terjadi kesalahan membuat QRIS.");
  }
}

let mutasiInterval;

// cek mutasi
async function mulaiCekMutasi(paymentId, username, totalHargaDibayar, telepon, hargaTanpaUnik) {
  let counter = 0;
  const maxCheck = 30; // 5 menit (interval 10s)

  if (mutasiInterval) clearInterval(mutasiInterval);

  mutasiInterval = setInterval(async () => {
    counter++;

    try {
      const url = `${global.qrisBaseUrl}/orderkuota/mutasiqr?apikey=${global.qrisApiToken}&username=${global.qrisUsername}&token=${global.qrisOrderToken}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.result) {
        const found = data.result.find(tx => {
          const nominal = parseInt(tx.kredit.replace(/\./g, ""));
          return tx.status === "IN" && nominal === totalHargaDibayar;
        });

        if (found) {
          clearInterval(mutasiInterval);
          localStorage.removeItem(global.CURRENT_QRIS_KEY);

          const now = new Date();
          const expireDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          const config = PACKAGE_CONFIG[hargaTanpaUnik.toString()];
          const ramNama = config ? config.nama : 'N/A';

          simpanRiwayat({
            id: paymentId,
            username: username,
            telepon: telepon,
            harga: hargaTanpaUnik,
            waktu: new Date().toLocaleString("id-ID"),
            status: "Sukses",
            panelUser: username,
            panelPass: username + "001",
            panelLink: global.PANEL_LOGIN_LINK,
            exp: expireDate.toLocaleDateString("id-ID")
          });

          const notifMsg =
`💰 *TRANSAKSI BERHASIL (KODE UNIK)*

🆔 ID Transaksi : *${paymentId}*
👤 Username     : *${username}*
📱 No Pembeli   : *${telepon}*

📦 Paket        : *${ramNama.toUpperCase()}*
💰 Harga Dasar  : *${toRupiah(hargaTanpaUnik)}*
💵 Total Dibayar: *${toRupiah(totalHargaDibayar)}*

🕒 Waktu        : ${new Date().toLocaleString("id-ID")}

🔁 Proses pembuatan akun & server panel dimulai...
`;

          sendTelegramNotification(notifMsg);

          alert("Pembayaran diterima! Server akan segera dibuat.");

          panggilServerBuatAkun(username, hargaTanpaUnik, telepon);

          closeQris();
          return;
        }
      }

      const saved = localStorage.getItem(global.CURRENT_QRIS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.waktuKadaluarsa && parsed.waktuKadaluarsa < Date.now()) {
          clearInterval(mutasiInterval);
          localStorage.removeItem(global.CURRENT_QRIS_KEY);
          alert("Waktu pembayaran habis (5 menit). QRIS dibatalkan otomatis.");
          closeQris();
          return;
        }
      }

      if (counter >= maxCheck) {
        clearInterval(mutasiInterval);
        localStorage.removeItem(global.CURRENT_QRIS_KEY);
        alert("Waktu pembayaran habis (5 menit).");
        batalQris(true);
      }

    } catch (e) {
      console.error(e);
    }
  }, 10000);
}

function closeQris() {
  if (mutasiInterval) clearInterval(mutasiInterval);
  localStorage.removeItem(global.CURRENT_QRIS_KEY);

  $("qrisSection").classList.add("hidden");
  $("btnBatal").classList.add("hidden");
  $("qrisImage").src = "";
  $("detailPembayaran").textContent = "";
  refreshInput();
}

function batalQris(show_alert = false) {
  if (mutasiInterval) clearInterval(mutasiInterval);
  localStorage.removeItem(global.CURRENT_QRIS_KEY);

  $("qrisSection").classList.add("hidden");
  $("btnBatal").classList.add("hidden");
  $("qrisImage").src = "";
  $("detailPembayaran").textContent = "";
  refreshInput();

  if (show_alert) {
    alert("Pembayaran QRIS dibatalkan.");
  }
}

// panggil backend buat panel
async function panggilServerBuatAkun(username, ramHarga, telepon) {
  try {
    const config = PACKAGE_CONFIG[ramHarga.toString()];
    if (!config) throw new Error("Konfigurasi paket RAM tidak ditemukan di client.");

    const res = await fetch("/api/create-panel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        paket: config.nama.toLowerCase(),
        telepon: telepon
      })
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("Respon backend bukan JSON:", text);
      throw new Error("Respon server tidak valid. Cek log backend.");
    }

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Gagal membuat panel di server.");
    }

    const info = data.result;

    alert(
`Akun Panel berhasil dibuat!

Login   : ${info.login}
Username: ${info.username}
Password: ${info.password}
RAM     : ${info.memory} MB
CPU     : ${info.cpu}%
Dibuat  : ${info.dibuat}
Expired : ${info.expired}`
    );

    const notifOwner =
`🥳 *PEMBELIAN PANEL + CREATE SERVER BERHASIL*
━━━━━━━━━━━━━━
👤 Username Panel : *${info.username}*
📱 Nomor WA       : *${telepon || '-'}*

📦 Paket          : *${info.paket.toUpperCase()}*
💾 RAM            : *${info.memory} MB*
💻 CPU            : *${info.cpu}%*

🕒 Dibuat         : *${info.dibuat}*
📛 Expired        : *${info.expired}*

🔐 Password       : *${info.password}*
🌐 Login Panel    : ${info.login}

✅ Status         : *BERHASIL DIBUAT*`;

    sendTelegramNotification(notifOwner);

  } catch (e) {
    console.error(e);
    alert(`Gagal membuat user atau server. Cek console log & backend:\n${e.message}`);
  }
}

// RIWAYAT
function getRiwayat() {
  try {
    const raw = localStorage.getItem(global.STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function simpanRiwayat(d) {
  const list = getRiwayat();
  const item = {
    ...d,
    uniqueId: Date.now() + "_" + Math.random().toString(16).slice(2)
  };
  list.unshift(item);
  localStorage.setItem(global.STORAGE_KEY, JSON.stringify(list));
}

function renderRiwayat() {
  const container = $("riwayatList");
  const data = getRiwayat();

  if (!data.length) {
    container.innerHTML = '<p class="riwayat-empty">Riwayat masih kosong. Belum ada pembelian yang sukses.</p>';
    return;
  }

  const html = data.map((d, idx) => `
<div class="riwayat-item">
  <div class="riwayat-item-header">
    <strong>Transaksi #${data.length - idx}</strong>
    <span class="riwayat-badge">${d.status || "Sukses"}</span>
  </div>
  <div>
    <div>ID: ${d.id}</div>
    <div>Username: ${d.username}</div>
    <div>No WA: ${d.telepon || "-"}</div>
    <div>Harga: ${toRupiah(d.harga || 0)}</div>
    <div>Waktu: ${d.waktu}</div>
    <div>Expired: ${d.exp || "-"}</div>
  </div>
  <div class="riwayat-actions">
    <button class="btn btn-secondary" onclick="copyLogin('${d.panelUser}','${d.panelPass}','${d.panelLink}')">Copy Login</button>
    <button class="btn btn-ghost" onclick="hapusRiwayat('${d.uniqueId}')">Hapus</button>
  </div>
</div>`).join("");

  container.innerHTML = html;
}

function copyLogin(user, pass, link) {
  const text = `Login Panel: ${link}\nUsername: ${user}\nPassword: ${pass}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert("Detail login sudah disalin ke clipboard.");
    }).catch(() => {
      alert(text);
    });
  } else {
    alert(text);
  }
}

function hapusRiwayat(uniqueId) {
  const data = getRiwayat();
  const filtered = data.filter(d => d.uniqueId !== uniqueId);
  localStorage.setItem(global.STORAGE_KEY, JSON.stringify(filtered));
  renderRiwayat();
}

function openRiwayat() {
  renderRiwayat();
  const modal = $("riwayatModal");
  if (modal) modal.style.display = "flex";
}

function closeRiwayat() {
  const modal = $("riwayatModal");
  if (modal) modal.style.display = "none";
}

function setupPullToRefreshBlocker() {
  // kosong
}

window.addEventListener("load", () => {
  setupPullToRefreshBlocker();
  const qrisActive = loadSavedQris();
  if (!qrisActive) updateTotalHarga();
});
