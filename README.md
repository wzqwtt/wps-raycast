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

✅ M1 代码已实现（OAuth 登录闭环 + 搜索 + 最近文件 + 创建智能表格），待联调：

1. 在 WPS 开放平台创建「企业自建应用」，登记回调 `https://raycast.com/redirect?packageName=Extension`，申请 scope `kso.file_search.readwrite` / `kso.file.readwrite` / `kso.user_base.read` 并经企业管理员审批（详见 [docs/roadmap.md](docs/roadmap.md)）；
2. `make install && make dev`，在扩展偏好里填 Client ID / Client Secret；
3. 第一次运行命令时会跳转浏览器完成授权。

## 开发

使用 [pnpm](https://pnpm.io) + Makefile：

```bash
make install    # 安装依赖
make dev        # 在 Raycast 中调试
make typecheck  # tsc --noEmit
make lint       # Raycast lint
make check      # typecheck + lint
```
