const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = __dirname;
const DATA_DIR = path.resolve(process.env.MINI_HUB_DATA_DIR || path.join(ROOT_DIR, "data"));
const DATA_FILE = path.join(DATA_DIR, "storage.json");
const APP_TOKEN = process.env.MINI_HUB_TOKEN || "";
const TRACKED_PREFIX = "mini-tracker-";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

ensureDataFile().catch((error) => {
  console.error("Failed to initialize storage:", error);
  process.exit(1);
});

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendJson(res, 400, { error: "Bad request" });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error("Request failed:", error);
    sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Mini Hub app server running on http://${HOST}:${PORT}`);
});

async function handleApi(req, res, url) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/storage") {
    const storage = await readStorage();
    sendJson(res, 200, { storage });
    return;
  }

  if ((req.method === "PUT" || req.method === "DELETE") && url.pathname.startsWith("/api/storage/")) {
    const key = decodeURIComponent(url.pathname.slice("/api/storage/".length));
    if (!isAllowedKey(key)) {
      sendJson(res, 400, { error: "Invalid key" });
      return;
    }

    const storage = await readStorage();

    if (req.method === "DELETE") {
      delete storage[key];
      await writeStorage(storage);
      sendJson(res, 200, { ok: true });
      return;
    }

    const body = await readJsonBody(req);
    if (!body || typeof body.value !== "string") {
      sendJson(res, 400, { error: "Body must include a string value" });
      return;
    }

    storage[key] = body.value;
    await writeStorage(storage);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  let relativePath = pathname === "/" ? "/index.html" : pathname;
  relativePath = relativePath.replace(/\\/g, "/");
  if (relativePath.includes("..")) {
    sendJson(res, 400, { error: "Invalid path" });
    return;
  }

  const absolutePath = path.join(ROOT_DIR, relativePath);
  const normalizedRoot = path.resolve(ROOT_DIR);
  const normalizedFile = path.resolve(absolutePath);
  if (!normalizedFile.startsWith(normalizedRoot)) {
    sendJson(res, 400, { error: "Invalid path" });
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(normalizedFile);
  } catch {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (!stat.isFile()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(normalizedFile).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache"
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(normalizedFile).pipe(res);
}

function isAuthorized(req) {
  if (!APP_TOKEN) {
    return true;
  }

  const token = req.headers["x-mini-hub-token"];
  return typeof token === "string" && token === APP_TOKEN;
}

function isAllowedKey(key) {
  return typeof key === "string" && key.startsWith(TRACKED_PREFIX) && key.length < 200;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        resolve(null);
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });

    req.on("error", () => resolve(null));
  });
}

async function ensureDataFile() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(DATA_FILE);
  } catch {
    await fsp.writeFile(DATA_FILE, "{}", "utf8");
  }
}

async function readStorage() {
  try {
    const raw = await fsp.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

async function writeStorage(storage) {
  await fsp.writeFile(DATA_FILE, JSON.stringify(storage), "utf8");
}