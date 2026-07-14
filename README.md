# 党员党务积分助手

产品研发部党支部党员积分管理 Web 应用，替代 Excel 手工统计，支持季度管理、自动计算、报表导出。

## 技术栈

- **前端**: React 19 + Ant Design 6 + Vite
- **后端**: Node.js + Express + Prisma ORM + SQLite
- **导出**: ExcelJS（保留模板格式）

## 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0

## 快速开始

### 1. 克隆仓库

```bash
git clone git@github.com:rubyliu1203/party-points-assistant.git
cd party-points-assistant
```

### 2. 安装依赖

```bash
# 安装根目录依赖 + 前后端依赖
npm run install:all
```

### 3. 初始化数据库

```bash
cd apps/server
# 推送数据库模型
npx prisma db push
# 生成 Prisma Client
npx prisma generate
# 导入种子数据（26名党员 + 2026年Q2示例数据）
npx tsx src/seed.ts
cd ../..
```

### 4. 启动服务

```bash
# 方式一：一键启动前后端
npm run dev

# 方式二：分别启动
# 终端1 - 后端
cd apps/server && npm run dev
# 终端2 - 前端
cd apps/web && npm run dev
```

启动后访问：
- 前端: http://localhost:3000
- 后端 API: http://localhost:3001/api/v1

### 5. 生产环境构建

```bash
# 构建后端 + 前端
npm run build

# 启动生产服务（仅后端，前端通过 Vite preview 或部署到静态服务器）
npm start
```

## 项目结构

```
party-points-assistant/
├── apps/
│   ├── server/          # 后端服务
│   │   ├── src/
│   │   │   ├── controllers/    # API 控制器
│   │   │   ├── services/       # 业务逻辑
│   │   │   ├── routes/         # 路由
│   │   │   ├── utils/          # 工具函数
│   │   │   └── app.ts          # 入口
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # 数据库模型
│   │   │   └── seed.ts         # 种子数据
│   │   └── package.json
│   └── web/             # 前端应用
│       ├── src/
│       │   ├── pages/          # 页面组件
│       │   ├── components/     # 公共组件
│       │   ├── api/            # API 封装
│       │   └── App.tsx         # 入口
│       └── package.json
├── data/                # SQLite 数据库（本地，git忽略）
├── template/            # Excel 导出模板
├── start.sh             # 一键启动脚本（Mac/Linux）
└── package.json         # 根目录 workspace 配置
```

## 核心功能

- 党员管理（转入/转出时间、职务、党务工作者身份）
- 季度管理（Q1-Q4，按转入/转出时间自动过滤）
- 党员积分台账（基础分60 + 履职分40，100分制）
- 党务积分台账（基础分95 + 基础加分 + 任务加分，季度汇总归一化5分）
- 履职台账（5个维度：攻坚克难、技术分享、双优评选、文化宣传、中国故事）
- 加分台账 / 扣分台账
- 批量添加分享心得
- Excel 导出（按模板格式，保留样式）

## 注意事项

1. **首次运行** 必须执行 `npm run install:all` 和 `npx prisma db push`
2. **数据库** 使用 SQLite，数据文件在 `data/database.sqlite`（已加入 .gitignore）
3. **Excel 模板** 文件在 `template/` 目录下，导出时依赖这些模板
4. **党员时间规则**：
   - `joinDate` <= 季度开始日期 → 算入该季度
   - `transferDate` <= 季度开始日期 → 不算入该季度
   - 历史数据不受影响

## License

MIT
