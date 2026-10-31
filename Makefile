.PHONY: install dev build lint typecheck check clean

install: ## 安装依赖（pnpm）
	pnpm install

dev: ## 在 Raycast 中调试运行
	pnpm run dev

build: ## 构建扩展
	pnpm run build

lint: ## Raycast lint
	pnpm run lint

typecheck: ## TypeScript 类型检查
	pnpm run typecheck

check: typecheck lint ## 类型检查 + lint

clean: ## 清理构建产物与依赖
	rm -rf dist node_modules .raycast
