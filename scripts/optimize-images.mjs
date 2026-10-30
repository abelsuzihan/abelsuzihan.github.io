import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const imagesDir = path.join(rootDir, 'images');
const manifestPath = path.join(rootDir, 'image-manifest.json');
const ignorePath = path.join(imagesDir, 'image-ignore.txt');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function sitePath(filePath) {
  return toPosix(path.relative(rootDir, filePath));
}

function isGeneratedName(fileName) {
  return /\.preview\.(jpg|jpeg|png)$/i.test(fileName) || /\.webp$/i.test(fileName);
}

async function readIgnoreList() {
  try {
    const content = await fs.readFile(ignorePath, 'utf8');
    return new Set(content.split(/\r?\n/)
      .map(line => line.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map(toPosix));
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}

async function collectSourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'generated' || entry.name.startsWith('.')) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (supportedExtensions.has(extension) && !isGeneratedName(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function removePreviousGeneratedFiles(previousManifest) {
  for (const item of Object.values(previousManifest)) {
    for (const generatedPath of [item.preview, item.webp]) {
      if (!generatedPath) continue;
      const absolutePath = path.resolve(rootDir, generatedPath);
      if (!absolutePath.startsWith(imagesDir + path.sep)) continue;

      try {
        await fs.unlink(absolutePath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
}

async function removeFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function readPreviousManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function collectHtmlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (['.git', 'node_modules', 'images', 'scripts'].includes(entry.name)) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(entryPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.html') {
      files.push(entryPath);
    }
  }

  return files;
}

function resolveHtmlImagePath(htmlFile, imageSource) {
  const htmlDirectory = path.dirname(path.relative(rootDir, htmlFile));
  const normalized = path.posix.normalize(path.posix.join(
    toPosix(htmlDirectory),
    imageSource,
  ));

  return normalized.replace(/^\.\//, '');
}

async function updateHtmlImageDimensions(manifest) {
  const htmlFiles = await collectHtmlFiles(rootDir);
  let updatedCount = 0;

  for (const htmlFile of htmlFiles) {
    const source = await fs.readFile(htmlFile, 'utf8');
    const updated = source.replace(
      /<img\b[^>]*\bdata-image-original="([^"]+)"[^>]*>/gi,
      (tag, imageSource) => {
        const manifestPath = resolveHtmlImagePath(htmlFile, imageSource);
        const entry = manifest[manifestPath];
        if (!entry?.width || !entry?.height) return tag;

        const withWidth = /\bwidth="\d+"/i.test(tag)
          ? tag.replace(/\bwidth="\d+"/i, `width="${entry.width}"`)
          : tag.replace(/\s*\/?>(\s*)$/, ` width="${entry.width}"$&`);
        const withHeight = /\bheight="\d+"/i.test(withWidth)
          ? withWidth.replace(/\bheight="\d+"/i, `height="${entry.height}"`)
          : withWidth.replace(/\s*\/?>(\s*)$/, ` height="${entry.height}"$&`);

        if (withHeight !== tag) updatedCount++;
        return withHeight;
      },
    );

    if (updated !== source) await fs.writeFile(htmlFile, updated);
  }

  return updatedCount;
}

async function main() {
  const ignoredFiles = await readIgnoreList();
  const previousManifest = await readPreviousManifest();
  await removePreviousGeneratedFiles(previousManifest);

  const manifest = {};
  const sourceFiles = await collectSourceFiles(imagesDir);
  let webpSkippedCount = 0;

  for (const sourceFile of sourceFiles) {
    const original = sitePath(sourceFile);
    const metadata = await sharp(sourceFile).metadata();
    const extension = path.extname(sourceFile).toLowerCase();
    const ignored = ignoredFiles.has(original);

    const entry = {
      original,
      preview: null,
      webp: null,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      format: extension.slice(1),
      ignored,
    };

    if (!ignored && metadata.width && metadata.height) {
      const directory = path.dirname(sourceFile);
      const baseName = path.basename(sourceFile, extension);
      const previewFile = path.join(directory, `${baseName}.preview${extension}`);
      const webpFile = path.join(directory, `${baseName}.webp`);

      const preview = sharp(sourceFile).resize({
        width: 480,
        withoutEnlargement: true,
      });

      if (extension === '.png') {
        await preview.png({ compressionLevel: 9 }).toFile(previewFile);
        await sharp(sourceFile).webp({ lossless: true, effort: 5 }).toFile(webpFile);
      } else {
        await preview.jpeg({ quality: 35, progressive: true }).toFile(previewFile);
        await sharp(sourceFile).webp({ quality: 92, effort: 5 }).toFile(webpFile);
      }

      entry.preview = sitePath(previewFile);

      const [sourceStats, webpStats] = await Promise.all([
        fs.stat(sourceFile),
        fs.stat(webpFile),
      ]);

      if (webpStats.size < sourceStats.size) {
        entry.webp = sitePath(webpFile);
      } else {
        await removeFileIfExists(webpFile);
        webpSkippedCount++;
      }
    }

    manifest[original] = entry;
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const updatedHtmlCount = await updateHtmlImageDimensions(manifest);

  const generatedCount = Object.values(manifest)
    .filter(item => item.preview || item.webp).length;
  const ignoredCount = Object.values(manifest)
    .filter(item => item.ignored).length;

  console.log(`图片扫描完成：${sourceFiles.length} 张原图`);
  console.log(`已生成 preview + WebP：${generatedCount} 张`);
  console.log(`因 WebP 未小于原图而改用原图：${webpSkippedCount} 张`);
  console.log(`已忽略：${ignoredCount} 张`);
  console.log(`已自动更新 HTML 图片尺寸：${updatedHtmlCount} 处`);
  console.log(`清单已写入：${path.relative(rootDir, manifestPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
