// 调用腾讯云「AI绘画/混元生图」的图生图(ImageToImage)接口。
// 使用腾讯云 API v3 的 TC3-HMAC-SHA256 签名，纯 Node crypto 实现，无第三方依赖。

import crypto from "node:crypto";

function sha256hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}
function hmac(key, str) {
  return crypto.createHmac("sha256", key).update(str, "utf8").digest();
}

// 生成腾讯云 API v3 请求所需的签名头
export function tc3Headers({
  secretId,
  secretKey,
  service,
  host,
  region,
  action,
  version,
  payload,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // UTC YYYY-MM-DD

  // 1) 拼接规范请求串
  const signedHeaders = "content-type;host";
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const hashedPayload = sha256hex(payload);
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, hashedPayload].join("\n");

  // 2) 拼接待签名字符串
  const algorithm = "TC3-HMAC-SHA256";
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [algorithm, timestamp, credentialScope, sha256hex(canonicalRequest)].join("\n");

  // 3) 计算签名
  const secretDate = hmac("TC3" + secretKey, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = crypto.createHmac("sha256", secretSigning).update(stringToSign, "utf8").digest("hex");

  // 4) 拼接 Authorization
  const authorization =
    `${algorithm} Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    "Content-Type": "application/json; charset=utf-8",
    Host: host,
    "X-TC-Action": action,
    "X-TC-Timestamp": String(timestamp),
    "X-TC-Version": version,
    "X-TC-Region": region,
  };
}

export async function generateRenovationTencent({
  imageBase64, // 纯 base64（不含 data: 前缀）
  prompt,
  secretId,
  secretKey,
  region = "ap-guangzhou",
  endpoint = "aiart.tencentcloudapi.com",
}) {
  if (!secretId || !secretKey) {
    throw new Error("未配置腾讯云密钥 TENCENT_SECRET_ID / TENCENT_SECRET_KEY");
  }

  const service = "aiart";
  const action = "ImageToImage";
  const version = "2022-12-29";

  const payload = JSON.stringify({
    InputImage: imageBase64,
    Prompt: prompt,
    RspImgType: "base64",
    LogoAdd: 0,
  });

  const headers = tc3Headers({
    secretId,
    secretKey,
    service,
    host: endpoint,
    region,
    action,
    version,
    payload,
  });

  const res = await fetch(`https://${endpoint}`, {
    method: "POST",
    headers,
    body: payload,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`腾讯云返回了非 JSON 响应（${res.status}）：${text.slice(0, 300)}`);
  }

  const r = data.Response;
  if (!r) throw new Error("腾讯云返回异常：" + text.slice(0, 300));
  if (r.Error) throw new Error(`腾讯云接口错误：${r.Error.Code} - ${r.Error.Message}`);
  if (!r.ResultImage) throw new Error("腾讯云未返回图片数据");
  return r.ResultImage; // base64 字符串
}
