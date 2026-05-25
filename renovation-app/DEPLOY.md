# 部署指南

下面任选一种方式。**推荐 Docker**，最省事。

---

## 方式一：Docker 一键部署（推荐）

前提：服务器已装 Docker（`docker -v` 能输出版本）。没装的话：
```bash
curl -fsSL https://get.docker.com | sh
```

部署：
```bash
# 1. 拉代码
git clone <你的仓库地址>
cd autojsDemo/renovation-app

# 2. 建配置文件，填入你的 Key 和品牌信息
cp .env.example .env
vi .env            # 至少填 OPENAI_API_KEY；建议填 BRAND_NAME / BRAND_CONTACT / ADMIN_TOKEN

# 3. 启动
docker compose up -d --build

# 4. 看日志确认启动成功
docker compose logs -f
```

打开 `http://服务器IP:3000` 就能用了。

更新版本：
```bash
git pull && docker compose up -d --build
```

---

## 方式二：不用 Docker（Node + systemd）

```bash
# 装 Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 放好项目
mkdir -p /opt/renovation-app
cp -r renovation-app/* /opt/renovation-app/
cd /opt/renovation-app
cp .env.example .env && vi .env

# 注册为系统服务，开机自启
cp deploy/renovation.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now renovation
systemctl status renovation
```

---

## 配域名 + HTTPS（正式对外用，强烈建议）

直接用 `IP:3000` 只能 http，分享体验差，微信里也容易拦。配个域名 + HTTPS：

```bash
apt-get install -y nginx certbot python3-certbot-nginx

# 反向代理：把 deploy/nginx.conf.example 里的域名改成你的，放到 nginx
cp renovation-app/deploy/nginx.conf.example /etc/nginx/conf.d/renovation.conf
vi /etc/nginx/conf.d/renovation.conf      # 改 server_name 为你的域名
nginx -t && systemctl reload nginx

# 一键申请并自动配置 HTTPS 证书
certbot --nginx -d your.domain.com
```

完成后访问 `https://your.domain.com` 即可，这就是可以发到抖音/小红书主页的链接。

---

## 两个中国大陆的现实问题（很重要）

1. **域名要 ICP 备案**：用大陆服务器对外提供网页服务，域名必须备案，否则会被拦。
   备案在你买服务器的云厂商控制台办，通常 3-15 天。临时测试可以先用 `IP:3000`。

2. **服务器大概率连不上 OpenAI**：大陆服务器直连 `api.openai.com` 会失败。
   解决办法：在 `.env` 里把 `OPENAI_BASE_URL` 改成一个兼容 OpenAI 接口的中转地址。

---

## 查看收集到的客户线索

```
https://你的域名/api/leads?token=你在.env里设的ADMIN_TOKEN
```

按时间倒序返回所有留资客户（姓名、手机号、城市、想要的风格）。
