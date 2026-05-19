# Translator

空白 Chromium 浏览器插件骨架，使用 TypeScript、Vue 3、Vite 与 Element Plus。

## 开发命令

```bash
npm install
npm run build
```

## 加载插件

在 Chromium 内核浏览器的扩展管理页开启开发者模式，加载 `dist` 目录。

## 目录结构

```text
src/background  后台服务脚本
src/content     当前网页脚本
src/manifest    插件清单配置
src/popup       插件弹窗
src/shared      共享类型与常量
scripts         构建辅助脚本
```
