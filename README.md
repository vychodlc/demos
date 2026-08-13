# Vychod Demos

用于维护和部署个人 Demo 的 npm workspace monorepo。每个 `apps/*` 目录都是一个可以独立运行、独立绑定域名的应用。

## 应用

| 应用 | 目录 | 本地地址 | 计划域名 |
| --- | --- | --- | --- |
| Demos Portal | `apps/portal` | `http://localhost:4174` | `demo.vychod.site` |
| VeloTrace | `apps/velotrace` | `http://localhost:4173` | `velotrace.demo.vychod.site` |

## 本地开发

需要 Node.js 20+。在仓库根目录安装一次依赖：

```bash
npm install
npm run dev:portal
```

另开一个终端运行 VeloTrace：

```bash
cp apps/velotrace/.env.example apps/velotrace/.env.local
npm run db:migrate --workspace=@vychod/velotrace
npm run dev:velotrace
```

## 验证

```bash
npm run typecheck
npm test
npm run build
```

VeloTrace 的数据源、数据库与备用自托管说明见 [`apps/velotrace/README.md`](apps/velotrace/README.md)。Vercel 中应从同一 GitHub 仓库创建两个 Project，并分别把 Root Directory 设置为 `apps/portal` 与 `apps/velotrace`。
