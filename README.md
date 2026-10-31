# wps-raycast

在 Raycast 中搜索、创建、归类你有权限的 WPS 365 文档（智能文档/智能表格），回车在浏览器打开。

**零后端**：扩展直接调用 WPS 365 OpenAPI，无任何中间服务器。

## 设计文档

| 文档 | 内容 |
|---|---|
| [docs/overview.md](docs/overview.md) | 总体架构、核心决策（零后端）、技术选型 |
| [docs/auth-design.md](docs/auth-design.md) | 首次使用跳转登录、token 生命周期（时序图/状态图） |
| [docs/api-design.md](docs/api-design.md) | WPS OpenAPI 端点选型与验证状态 |
| [docs/commands-design.md](docs/commands-design.md) | 三个命令的交互设计 |
| [docs/security.md](docs/security.md) | 密钥/token 存储、信任边界、安全清单 |
| [docs/roadmap.md](docs/roadmap.md) | 里程碑、待实测清单、已知风险 |

## 状态

🚧 设计阶段——代码尚未开始实现。请从 [docs/overview.md](docs/overview.md) 开始阅读。
