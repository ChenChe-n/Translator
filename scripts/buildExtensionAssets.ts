import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import type { Plugin } from 'vite';
import manifest from '../src/manifest/manifest';

/**
 * 构建插件后台、页面脚本并写入清单。
 *
 * @returns Vite 插件配置。
 */
export function buildExtensionAssets(): Plugin {
  return {
    name: 'build-extension-assets',
    async closeBundle() {
      const distDir = resolve(process.cwd(), 'dist');
      const assetsDir = resolve(distDir, 'assets');

      await mkdir(assetsDir, { recursive: true });
      await buildScript('src/background/index.ts', 'background.js');
      await buildScript('src/content/index.ts', 'content.js');
      await writeFile(
        resolve(distDir, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    },
  };
}

/**
 * 将插件脚本打包为单文件产物。
 *
 * @param entryPoint 源码入口路径。
 * @param fileName 输出文件名。
 * @returns 无返回值。
 */
async function buildScript(entryPoint: string, fileName: string): Promise<void> {
  await build({
    entryPoints: [resolve(process.cwd(), entryPoint)],
    outfile: resolve(process.cwd(), 'dist', 'assets', fileName),
    bundle: true,
    format: 'iife',
    target: 'chrome114',
    sourcemap: false,
  });
}
