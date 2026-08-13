# 1Panel 部署

## 1. 创建 PostgreSQL

在 1Panel 中安装 PostgreSQL，创建数据库和专用用户，例如 `velotrace`。不要使用数据库超级用户运行应用。

连接地址示例：

```text
postgresql://velotrace:强密码@postgresql:5432/velotrace
```

如果 Node 运行环境和数据库不在同一容器网络，主机名按 1Panel 实际显示填写。

## 2. 上传 monorepo 并创建 Node.js 运行环境

- Node.js：20 或 22
- 工作目录：仓库根目录
- 安装命令：`npm ci`
- 构建命令：`npm run build --workspace=@vychod/velotrace`
- 启动命令：`npm run start --workspace=@vychod/velotrace`
- 服务端口：`4173`

环境变量：

```env
NODE_ENV=production
DATABASE_URL=postgresql://velotrace:强密码@数据库主机:5432/velotrace
APP_URL=https://velotrace.demo.vychod.site
APP_ENCRYPTION_KEY=openssl-rand-hex-32-生成的64位值
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
```

首次启动前在 1Panel 终端、项目目录中执行：

```bash
npm run db:migrate --workspace=@vychod/velotrace
```

## 3. 创建网站

在「网站」中创建 Node.js 运行环境网站并绑定域名；若运行环境网站不可用，则创建反向代理网站，代理到 `http://127.0.0.1:4173`。

申请 SSL 证书，开启 HTTP 跳转 HTTPS 和自动续签。无需把 4173 暴露到公网，只允许 1Panel/OpenResty 从服务器内部访问。

## 4. 上线检查

- 注册两个测试账户，确认彼此看不到对方骑行。
- 上传一份 GPX 或 FIT，确认轨迹及分享图正常。
- 检查 Strava 授权回调域名。
- 为 PostgreSQL 建立每日备份并演练恢复。
- 更新代码时依次执行 `npm ci`、`npm run build --workspace=@vychod/velotrace`、`npm run db:migrate --workspace=@vychod/velotrace`，再重启运行环境。
