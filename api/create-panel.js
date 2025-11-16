import moment from "moment-timezone";

const CONFIG = {
  PTERO_DOMAIN: process.env.PTERO_DOMAIN,
  PTERO_APP_KEY: process.env.PTERO_APP_KEY,
  NEST_ID: parseInt(process.env.PTERO_NEST_ID || "5", 10),
  EGG_ID: parseInt(process.env.PTERO_EGG_ID || "15", 10),
  LOCATION_ID: parseInt(process.env.PTERO_LOCATION_ID || "1", 10),
  TIMEZONE: "Asia/Jakarta",
};

const PAKET = {
  "500mb": { memo: 1048, cpu: 30 },
  "1gb": { memo: 1048, cpu: 30 },
  "2gb": { memo: 2048, cpu: 50 },
  "3gb": { memo: 3048, cpu: 75 },
  "4gb": { memo: 4048, cpu: 100 },
  "5gb": { memo: 5048, cpu: 130 },
  "6gb": { memo: 6048, cpu: 150 },
  "7gb": { memo: 7048, cpu: 175 },
  "8gb": { memo: 8048, cpu: 200 },
  "9gb": { memo: 9048, cpu: 225 },
  "10gb": { memo: 10048, cpu: 250 },
  "unli": { memo: 0, cpu: 0 },
};

function isValidUsername(u) {
  return /^[a-zA-Z0-9]{3,15}$/.test(u || "");
}

async function pteroCreateOrGetUser({ email, username, password }) {
  const createRes = await fetch(`${CONFIG.PTERO_DOMAIN}/api/application/users`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.PTERO_APP_KEY}`,
    },
    body: JSON.stringify({
      email,
      username,
      first_name: username,
      last_name: username,
      language: "en",
      password,
    }),
  });

  const createJson = await createRes.json().catch(() => ({}));
  if (createRes.ok && !createJson?.errors) return createJson.attributes;

  const listRes = await fetch(
    `${CONFIG.PTERO_DOMAIN}/api/application/users?filter[email]=${encodeURIComponent(
      email
    )}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${CONFIG.PTERO_APP_KEY}`,
      },
    }
  );
  const listJson = await listRes.json().catch(() => ({}));
  const user = listJson?.data?.[0]?.attributes;
  if (!user) {
    const msg = createJson?.errors?.[0]?.detail || "failed to create/find user";
    throw new Error(`Pterodactyl user error: ${msg}`);
  }
  return user;
}

async function pteroGetEggStartup() {
  const res = await fetch(
    `${CONFIG.PTERO_DOMAIN}/api/application/nests/${CONFIG.NEST_ID}/eggs/${CONFIG.EGG_ID}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${CONFIG.PTERO_APP_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Pterodactyl egg error HTTP ${res.status}`);
  const json = await res.json().catch(() => ({}));
  return json?.attributes?.startup || "npm start";
}

async function pteroCreateServer({ userId, name, memo, cpu, startup }) {
  const res = await fetch(`${CONFIG.PTERO_DOMAIN}/api/application/servers`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.PTERO_APP_KEY}`,
    },
    body: JSON.stringify({
      name,
      description: "Auto panel QRIS",
      user: userId,
      egg: CONFIG.EGG_ID,
      docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
      startup,
      environment: {
        INST: "npm",
        USER_UPLOAD: "0",
        AUTO_UPDATE: "0",
        CMD_RUN: "npm start",
      },
      limits: {
        memory: memo,
        swap: 0,
        disk: 0,
        io: 500,
        cpu: cpu,
      },
      feature_limits: {
        databases: 5,
        backups: 5,
        allocations: 1,
      },
      deploy: {
        locations: [CONFIG.LOCATION_ID],
        dedicated_ip: false,
        port_range: [],
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.errors) {
    const msg = json?.errors?.[0]?.detail || `HTTP ${res.status}`;
    throw new Error(`Pterodactyl server error: ${msg}`);
  }
  return json.attributes;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ ok: false, error: "Method Not Allowed" });
    }

    if (!CONFIG.PTERO_DOMAIN || !CONFIG.PTERO_APP_KEY) {
      return res.status(500).json({
        ok: false,
        error:
          "PTERO_DOMAIN / PTERO_APP_KEY belum dikonfigurasi di environment.",
      });
    }

    const body = req.body || {};
    const { username, paket } = body;

    if (!isValidUsername(username)) {
      return res.status(400).json({
        ok: false,
        error: "Username 3–15 alfanumerik tanpa spasi.",
      });
    }

    const key = String(paket || "").toLowerCase();
    const paketConf = PAKET[key];
    if (!paketConf) {
      return res.status(400).json({ ok: false, error: "Paket tidak dikenal." });
    }

    const email = `${username}@panel.com`;
    const password = `${username}001`;
    const name = `${username}-${key.toUpperCase()}`;

    const user = await pteroCreateOrGetUser({ email, username, password });
    const startup = await pteroGetEggStartup();
    const server = await pteroCreateServer({
      userId: user.id,
      name,
      memo: paketConf.memo,
      cpu: paketConf.cpu,
      startup,
    });

    const waktuBuat = moment()
      .tz(CONFIG.TIMEZONE)
      .format("DD/MM/YYYY HH:mm");
    const waktuExpired = moment()
      .add(30, "days")
      .tz(CONFIG.TIMEZONE)
      .format("DD/MM/YYYY");

    return res.status(200).json({
      ok: true,
      result: {
        login: CONFIG.PTERO_DOMAIN,
        username: user.username,
        password,
        memory: server?.limits?.memory ?? paketConf.memo,
        cpu: server?.limits?.cpu ?? paketConf.cpu,
        dibuat: waktuBuat,
        expired: waktuExpired,
        paket: key,
      },
    });
  } catch (e) {
    console.error("create-panel error:", e);
    return res.status(500).json({
      ok: false,
      error: e.message || "server error",
    });
  }
}
