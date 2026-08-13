# VELOTRACE

面向真实用户的骑行生涯产品：导入 Strava 或 iGPSPORT 数据，查看生涯/年度/月度视图、目标、GPS 轨迹和隐私分享图。

## 技术栈

- Next.js 15 + React 19 + TypeScript
- PostgreSQL
- Argon2 密码哈希、数据库会话、AES-256-GCM Strava token 加密
- FIT / GPX / CSV / JSON 导入

## 本地启动

需要 Node.js 20+ 和 PostgreSQL 14+。

```bash
cp .env.example .env.local
# 编辑 DATABASE_URL、APP_URL 与 APP_ENCRYPTION_KEY
npm install
set -a; source .env.local; set +a
npm run db:migrate
npm run dev
```

生成安全的加密密钥：

```bash
openssl rand -hex 32
```

打开 <http://localhost:4173>，先注册账户，再导入数据。

## 生产构建

```bash
npm run build
npm start
```

生产环境必须使用 HTTPS，并确保 `APP_URL` 与公开域名完全一致。详细的 1Panel 步骤见 [1panel/README.md](1panel/README.md)。

## Strava

在 Strava API Application 中将 Authorization Callback Domain 设置为站点域名，并配置：

```env
APP_URL=https://ride.example.com
STRAVA_CLIENT_ID=你的客户端 ID
STRAVA_CLIENT_SECRET=你的客户端密钥
```

回调地址由应用自动生成：`https://ride.example.com/api/strava/callback`。每位用户独立授权，token 加密后存入 PostgreSQL。

## iGPSPORT

用户可以在导入弹窗中粘贴 iGPSPORT 活动页面的 `Copy as cURL` 内容。服务端只解析官方接口地址和 Bearer Token，不执行 shell 命令，也不保存 curl 原文；随后异步分页读取活动、下载原始 FIT，并写入当前登录用户的数据库。Token 过期后需要重新粘贴。

## 数据安全

- 每次活动读写都必须携带登录用户的 `user_id`。
- 密码只保存 Argon2 哈希；会话 cookie 为 HttpOnly、SameSite=Lax，生产环境启用 Secure。
- OAuth state 单次使用且 10 分钟失效。
- 分享图默认裁去轨迹首尾 8%。
- PostgreSQL 应配置自动备份；`APP_ENCRYPTION_KEY` 需要在 1Panel 之外另行安全备份。

## 测试

```bash
npm test
npm run build
```
