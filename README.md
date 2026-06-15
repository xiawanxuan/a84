# 点云标注系统

基于 PostgreSQL + PostGIS 的三维点云数据标注管理平台，支持多用户协作、标注版本控制与空间查询。

## 项目架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│  PostgreSQL DB  │
│  (Vue/React)    │◀────│  (Go/Node.js)   │◀────│  + PostGIS      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │     Redis       │
                        │  (Cache/Session)│
                        └─────────────────┘
```

### 架构说明

- **前端层**：负责点云可视化（使用 Three.js/Potree 等库）、标注交互工具、用户界面展示
- **后端 API 层**：提供 RESTful/Golang-gin 接口，处理业务逻辑、权限校验、空间数据转换
- **PostgreSQL + PostGIS**：持久化存储点云元数据、标注几何信息（PolygonZ）、用户与分类数据，支持空间索引与空间查询
- **Redis**：缓存热点数据（如分类列表、用户会话 Token），提升查询性能

## 数据流图（文字描述）

### 点云上传与存储流程

1. 用户在前端选择点云文件（LAS/LAZ/PCD 格式）并点击上传
2. 前端发送 HTTP POST 请求到后端 `/api/pointclouds/upload` 接口
3. 后端接收文件流，保存到对象存储或本地文件系统
4. 后端解析点云文件，计算点数量、包围盒（bounding_box）、元数据信息
5. 后端将点云记录写入 `pointclouds` 表，返回点云 ID 给前端
6. 前端跳转到点云标注页面，通过 WebGL 加载渲染点云数据

### 标注创建与版本管理流程

1. 用户在前端点云视图中使用多边形工具绘制三维标注区域
2. 前端将 PolygonZ 几何数据（WKT/GeoJSON 格式）、分类 ID、图层名称、属性信息发送到后端 `/api/annotations`
3. 后端校验数据合法性，将标注写入 `annotations` 表
4. 后端同时在 `annotation_versions` 表中创建版本 1 的快照记录（包含当时的 geometry 和 properties）
5. 后续用户修改标注时：后端更新 `annotations` 表的 `updated_at` 字段，并递增版本号在 `annotation_versions` 中插入新快照
6. 用户可通过 `/api/annotations/:id/versions` 查询历史版本，支持版本回滚

### 空间查询流程

1. 用户在前端框选查询区域或输入空间条件
2. 前端发送查询请求到后端 `/api/annotations/query`
3. 后端使用 PostGIS 空间函数（如 `ST_Intersects`、`ST_Within`）结合 GiST 空间索引执行高效查询
4. 后端返回满足条件的标注列表给前端展示

## 数据库表结构

| 表名 | 说明 |
|------|------|
| users | 用户账户信息 |
| categories | 标注分类（乔木、灌木、草地、裸地等） |
| pointclouds | 点云文件元数据与包围盒 |
| annotations | 标注主表（关联点云、用户、分类） |
| annotation_versions | 标注历史版本快照 |

## 快速开始

### 环境要求

- PostgreSQL 14+ （需安装 PostGIS 扩展）
- Redis 6+
- Go 1.21+ 或 Node.js 18+（根据后端实现选择）

### 数据库初始化

```bash
# 1. 创建数据库
createdb pointcloud_annotation

# 2. 按顺序执行迁移脚本
psql -d pointcloud_annotation -f database/migrations/001_init_schema.sql
psql -d pointcloud_annotation -f database/migrations/002_seed_categories.sql
psql -d pointcloud_annotation -f database/migrations/003_indexes.sql
```

### 后端启动（Go 示例）

```bash
cd backend

# 复制环境变量配置
cp ../configs/.env.example .env
# 编辑 .env 填入实际数据库密码、JWT 密钥等

# 安装依赖
go mod download

# 启动服务（默认端口 8080）
go run main.go
```

### 后端启动（Node.js 示例）

```bash
cd backend

# 复制环境变量配置
cp ../configs/.env.example .env

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器（默认端口 5173）
npm run dev
```

启动后访问 http://localhost:5173 即可使用系统。

## 配置文件

- `configs/.env.example`：环境变量模板（数据库连接、Redis、JWT 等）
- `configs/redis.yaml`：Redis 连接池详细配置
