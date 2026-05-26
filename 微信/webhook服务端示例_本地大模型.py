# -*- coding: utf-8 -*-
"""
微信 webhook 服务端示例(配合手机端脚本 微信webhook自动回复.js)

作用:
    跑在你电脑上, 接收手机发来的微信消息, 调用本地大模型生成回复, 再返回给手机。

约定:
    手机 POST 到 /wechat, body:
        { "from": "张三", "message": "在吗", "isGroup": false, "time": 1690000000000 }
    本服务返回:
        { "reply": "在的, 怎么了?" }
    reply 为空字符串则手机不回复这条。

特点:
    只用 Python 标准库, 不需要 pip install。
    默认对接 Ollama(本地大模型, OpenAI 兼容接口), 没装 Ollama 的话改 生成回复() 即可。

运行:
    1. 电脑装好 Ollama 并拉个模型, 例如:  ollama run qwen2.5
    2. python3 webhook服务端示例_本地大模型.py
    3. 看终端打印的局域网地址, 把手机脚本里的 WEBHOOK地址 改成它
    4. 确保手机和电脑在同一个 WiFi, 且电脑防火墙放行该端口
"""

import json
import socket
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ===================== 配置 =====================
监听端口 = 5000
OLLAMA地址 = "http://127.0.0.1:11434/v1/chat/completions"  # 本地大模型(OpenAI兼容)
模型 = "qwen2.5"
系统提示 = (
    "你在帮我自动回复微信消息。请用中文、口语化、简短自然地回复对方，"
    "像本人在聊天一样，一句话即可，不要带任何前缀或解释。"
)
请求超时 = 30  # 秒


def 生成回复(发信人, 消息):
    """调用本地大模型, 返回一句回复。可在这里加入你自己的 agent/记忆/检索逻辑。"""
    body = json.dumps({
        "model": 模型,
        "messages": [
            {"role": "system", "content": 系统提示},
            {"role": "user", "content": f"对方({发信人})对我说: {消息}"},
        ],
        "stream": False,
    }).encode("utf-8")

    req = urllib.request.Request(
        OLLAMA地址, data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=请求超时) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path.rstrip("/") != "/wechat":
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            发信人 = payload.get("from", "")
            消息 = payload.get("message", "")
            print(f"收到【{发信人}】: {消息}")

            回复 = 生成回复(发信人, 消息)
            print(f"回复【{发信人}】: {回复}")
            self._json(200, {"reply": 回复})
        except Exception as e:
            print(f"出错: {e}")
            # 出错就返回空 reply, 手机会跳过这条而不是乱发
            self._json(200, {"reply": ""})

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # 关掉默认的访问日志, 保持终端干净


def 取局域网IP():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    ip = 取局域网IP()
    print("微信 webhook 服务已启动")
    print(f"请把手机脚本里的 WEBHOOK地址 改成:  http://{ip}:{监听端口}/wechat")
    print("(手机和电脑要在同一个 WiFi, 电脑防火墙放行该端口)")
    ThreadingHTTPServer(("0.0.0.0", 监听端口), Handler).serve_forever()
