# VeloTrace

面向真实用户的骑行生涯产品：导入 Strava 或 iGPSPORT 数据，查看生涯、年度、月度视图、目标、GPS 轨迹和隐私分享图。

## 技术栈

- Next.js 15 + React 19 + TypeScript
- PostgreSQL
- Argon2 密码哈希、数据库会话、AES-256-GCM Strava token 加密
- FIT / GPX / CSV / JSON 导入

## 本地启动

从仓库根目录执行：

```bash
cp apps/velotrace/.env.example apps/velotrace/.env.local
npm install
npm run db:migrate --workspace=@vychod/velotrace
npm run dev:velotrace
```

生成 `APP_ENCRYPTION_KEY`：

```bash
openssl rand -hex 32
```

打开 <http://localhost:4173>，先注册账户，再导入数据。

## Vercel 部署

从 monorepo 创建独立 Vercel Project，Root Directory 设为 `apps/velotrace`，并配置 `.env.example` 中列出的环境变量。公开域名为 `velotrace.demo.vychod.site` 时，`APP_URL` 必须使用同一完整 HTTPS 地址。

部署前先对生产数据库执行迁移：

```bash
npm run db:migrate --workspace=@vychod/velotrace
```

Strava 回调地址为 `https://velotrace.demo.vychod.site/api/strava/callback`。iGPSPORT 导入会解析用户粘贴的官方请求凭据，并将同步结果写入当前登录用户的数据空间。

如果需要继续部署到 1Panel，参见 [`1panel/README.md`](1panel/README.md)。
