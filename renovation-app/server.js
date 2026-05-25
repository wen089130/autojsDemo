import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrompt, buildPromptZh, SIZES, STYLES, ROOMS } from "./src/prompts.js";
import { generateRenovation } from "./src/openai.js";
import { generateRenovationTencent } from "./src/tencent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 极简 .env 加载（无需 dotenv 依赖） ----------
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const DEMO_MODE = process.env.DEMO_MODE === "1";
const PROVIDER = (process.env.PROVIDER || "openai").toLowerCase();
const PUBLIC_DIR = path.join(__dirname, "public");

// 没配密钥时自动进入演示模式（界面照样能体验，只是回显原图）
function isDemoMode() {
  if (DEMO_MODE) return true;
  if (PROVIDER === "tencent") {
    return !(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY);
  }
  return !process.env.OPENAI_API_KEY;
}
const DATA_DIR = path.join(__dirname, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");

fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- 工具函数 ----------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req, limit = 15 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("请求体过大（图片请控制在合理大小内）"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  // 防止路径穿越
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

// 解析前端传来的 dataURL: "data:image/jpeg;base64,xxxx"
function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!m) return null;
  return { mimeType: m[1], buffer: Buffer.from(m[2], "base64") };
}

// ---------- 路由 ----------
async function handleGenerate(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req)).toString("utf8"));
  } catch (e) {
    return sendJson(res, 400, { error: "请求格式错误：" + e.message });
  }

  const { imageBase64, style, roomType, customPrompt } = body;
  const parsed = parseDataUrl(imageBase64);
  if (!parsed) return sendJson(res, 400, { error: "请先上传一张房间照片" });

  let size = body.size && SIZES.has(body.size) ? body.size : "1024x1024";

  // 演示模式：不调用真实接口，直接回显原图，便于先体验整套流程
  if (isDemoMode()) {
    return sendJson(res, 200, { imageBase64, demo: true });
  }

  try {
    let b64;
    if (PROVIDER === "tencent") {
      b64 = await generateRenovationTencent({
        imageBase64: parsed.buffer.toString("base64"),
        prompt: buildPromptZh({ style, roomType, customPrompt }),
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
        region: process.env.TENCENT_REGION || "ap-guangzhou",
        endpoint: process.env.TENCENT_ENDPOINT || "aiart.tencentcloudapi.com",
      });
    } else {
      b64 = await generateRenovation({
        imageBuffer: parsed.buffer,
        mimeType: parsed.mimeType,
        prompt: buildPrompt({ style, roomType, customPrompt }),
        size,
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
        quality: process.env.OPENAI_IMAGE_QUALITY,
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      });
    }
    return sendJson(res, 200, { imageBase64: `data:image/png;base64,${b64}` });
  } catch (e) {
    return sendJson(res, 502, { error: e.message });
  }
}

async function handleLead(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req, 1024 * 1024)).toString("utf8"));
  } catch (e) {
    return sendJson(res, 400, { error: "请求格式错误" });
  }
  const phone = String(body.phone || "").trim();
  if (!/^\d{6,20}$/.test(phone)) {
    return sendJson(res, 400, { error: "请填写正确的手机号" });
  }
  const lead = {
    time: new Date().toISOString(),
    name: String(body.name || "").trim().slice(0, 40),
    phone,
    city: String(body.city || "").trim().slice(0, 40),
    style: String(body.style || "").trim().slice(0, 40),
    roomType: String(body.roomType || "").trim().slice(0, 40),
    note: String(body.note || "").trim().slice(0, 200),
  };
  fs.appendFileSync(LEADS_FILE, JSON.stringify(lead) + "\n");
  return sendJson(res, 200, { ok: true });
}

function handleLeadsView(req, res) {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || token !== expected) {
    return sendJson(res, 401, { error: "口令错误" });
  }
  if (!fs.existsSync(LEADS_FILE)) return sendJson(res, 200, { leads: [] });
  const leads = fs
    .readFileSync(LEADS_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
  return sendJson(res, 200, { count: leads.length, leads });
}

function handleConfig(req, res) {
  return sendJson(res, 200, {
    brandName: process.env.BRAND_NAME || "AI 装修效果图",
    brandContact: process.env.BRAND_CONTACT || "",
    demo: isDemoMode(),
    styles: Object.keys(STYLES),
    rooms: Object.keys(ROOMS),
  });
}

// ---------- 主服务器 ----------
const server = http.createServer(async (req, res) => {
  try {
    const pathname = req.url.split("?")[0];
    if (req.method === "POST" && pathname === "/api/generate") return await handleGenerate(req, res);
    if (req.method === "POST" && pathname === "/api/lead") return await handleLead(req, res);
    if (req.method === "GET" && pathname === "/api/leads") return handleLeadsView(req, res);
    if (req.method === "GET" && pathname === "/api/config") return handleConfig(req, res);
    if (req.method === "GET") return serveStatic(req, res);
    res.writeHead(405);
    res.end("Method Not Allowed");
  } catch (e) {
    sendJson(res, 500, { error: "服务器内部错误：" + e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  装修效果图工具已启动`);
  console.log(`  本机访问:    http://localhost:${PORT}`);
  console.log(`  手机访问:    用同一 WiFi 下的电脑局域网 IP 加 :${PORT}`);
  console.log(`  线索查看:    http://localhost:${PORT}/api/leads?token=你的ADMIN_TOKEN`);
  console.log(`  出图服务商:  ${PROVIDER}`);
  if (isDemoMode()) {
    console.log(`  [演示模式] 未配置密钥，将直接回显原图。配置 .env 后可真正出图。\n`);
  } else {
    console.log("");
  }
});
