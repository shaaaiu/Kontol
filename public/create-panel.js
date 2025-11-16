const moment = require("moment-timezone");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { username, paket, telepon } = body;

    if (!username || !/^[a-zA-Z0-9]{3,15}$/.test(username)) {
      return res.status(400).json({ ok: false, error: "Username tidak valid (3–15 huruf/angka)." });
    }

    const PAKET = {
      '500mb': { memo: 1048, disk: 2000, cpu: 30 },
      '1gb': { memo: 1048, disk: 2000, cpu: 30 },
      '2gb': { memo: 2048, disk: 2000, cpu: 50 },
      '3gb': { memo: 3048, disk: 2000, cpu: 75 },
      '4gb': { memo: 4048, disk: 2000, cpu: 100 },
      '5gb': { memo: 5048, disk: 2000, cpu: 130 },
      '6gb': { memo: 6048, disk: 2000, cpu: 150 },
      '7gb': { memo: 7048, disk: 2000, cpu: 175 },
      '8gb': { memo: 8048, disk: 2000, cpu: 200 },
      '9gb': { memo: 9048, disk: 2000, cpu: 225 },
      '10gb': { memo: 10048, disk: 2000, cpu: 250 },
      'unli': { memo: 999999, disk: 0, cpu: 500 }
    };

    if (!paket || !PAKET[paket]) {
      return res.status(400).json({ ok: false, error: "Paket tidak ditemukan." });
    }

    const chosen = PAKET[paket];

    const PTERO_DOMAIN = process.env.PTERO_DOMAIN;
    const PTERO_APP_KEY = process.env.PTERO_APP_KEY;
    const NEST_ID = process.env.PTERO_NEST_ID || "5";
    const EGG_ID = process.env.PTERO_EGG_ID || "15";
    const LOCATION_ID = process.env.PTERO_LOCATION_ID || "1";

    if (!PTERO_DOMAIN || !PTERO_APP_KEY) {
      return res.status(500).json({ ok: false, error: "PTERO_DOMAIN / PTERO_APP_KEY belum dikonfigurasi di environment." });
    }

    const email = `${username}@panel.com`;
    const password = `${username}001`;
    const serverName = `${username}-${paket}`;

    // CREATE USER
    const createUser = await fetch(`${PTERO_DOMAIN}/api/application/users`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PTERO_APP_KEY}`
      },
      body: JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: username,
        language: "en",
        password
      })
    });

    const userText = await createUser.text();
    let userData = null;
    try {
      userData = JSON.parse(userText);
    } catch {
      return res.status(500).json({ ok: false, error: `Respon Pterodactyl (user) tidak valid:\n${userText}` });
    }

    if (userData.errors) {
      return res.status(400).json({ ok: false, error: userData.errors[0].detail });
    }

    const user = userData.attributes;

    // GET EGG STARTUP
    const eggRes = await fetch(`${PTERO_DOMAIN}/api/application/nests/${NEST_ID}/eggs/${EGG_ID}`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${PTERO_APP_KEY}`
      }
    });

    const eggText = await eggRes.text();
    let eggData = null;
    try {
      eggData = JSON.parse(eggText);
    } catch {
      return res.status(500).json({ ok: false, error: `Respon Pterodactyl (egg) tidak valid:\n${eggText}` });
    }

    const startup = eggData.attributes.startup;

    // CREATE SERVER
    const serverRes = await fetch(`${PTERO_DOMAIN}/api/application/servers`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PTERO_APP_KEY}`
      },
      body: JSON.stringify({
        name: serverName,
        description: "Auto Panel",
        user: user.id,
        egg: parseInt(EGG_ID),
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup,
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start"
        },
        limits: {
          memory: chosen.memo,
          swap: 0,
          disk: chosen.disk,
          io: 500,
          cpu: chosen.cpu
        },
        feature_limits: { databases: 5, backups: 5, allocations: 1 },
        deploy: {
          locations: [parseInt(LOCATION_ID)],
          dedicated_ip: false,
          port_range: []
        }
      })
    });

    const serverText = await serverRes.text();
    let serverData = null;
    try {
      serverData = JSON.parse(serverText);
    } catch {
      return res.status(500).json({ ok: false, error: `Respon Pterodactyl (server) tidak valid:\n${serverText}` });
    }

    if (serverData.errors) {
      return res.status(400).json({ ok: false, error: serverData.errors[0].detail });
    }

    const waktuBuat = moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm");
    const waktuExpired = moment().add(30, "days").tz("Asia/Jakarta").format("DD/MM/YYYY");

    return res.status(200).json({
      ok: true,
      result: {
        login: PTERO_DOMAIN,
        username,
        password,
        memory: chosen.memo,
        cpu: chosen.cpu,
        dibuat: waktuBuat,
        expired: waktuExpired,
        paket,
        telepon: telepon || null
      }
    });

  } catch (err) {
    console.error("Error /api/create-panel:", err);
    return res.status(500).json({ ok: false, error: err.message || "server error" });
  }
};
