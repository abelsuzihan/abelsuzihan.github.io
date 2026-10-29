const commonScript = document.currentScript;
const siteRootUrl = new URL('.', commonScript.src);
const currentPageDirectory = new URL('.', window.location.href);
const sitePathPrefix = currentPageDirectory.pathname === siteRootUrl.pathname ? '' : '../';
const validFilters = new Set(['all', 'ux', 'branding']);
let imageManifestPromise;
let imageObserver;

function resolveSitePath(path) {
  return `${sitePathPrefix}${path}`;
}

function getImageManifest() {
  if (!imageManifestPromise) {
    imageManifestPromise = fetch(resolveSitePath('image-manifest.json'))
      .then(response => response.ok ? response.json() : {})
      .catch(() => ({}));
  }

  return imageManifestPromise;
}

function getSiteRelativePath(source) {
  try {
    const absoluteUrl = new URL(source, document.baseURI);
    const rootPath = siteRootUrl.pathname;
    if (!absoluteUrl.pathname.startsWith(rootPath)) return null;
    return decodeURIComponent(absoluteUrl.pathname.slice(rootPath.length));
  } catch (error) {
    return null;
  }
}

function getImageEntry(image, manifest) {
  const source = image.dataset.imageOriginal || image.getAttribute('src');
  const path = getSiteRelativePath(source);
  return path ? manifest[path] : null;
}

function getImageUrl(path) {
  return path ? new URL(resolveSitePath(path), document.baseURI).href : null;
}

function getOriginalImageUrl(source) {
  return source ? new URL(source, document.baseURI).href : null;
}

function setImageDimensions(image, entry) {
  if (!entry?.width || !entry?.height) return;
  // 首页卡片由 CSS 固定为正方形；不要让原图比例覆盖这个视觉规则。
  if (image.closest('#container')) return;
  if (!image.hasAttribute('width')) image.width = entry.width;
  if (!image.hasAttribute('height')) image.height = entry.height;
}

function promoteImage(image) {
  if (!image || image.dataset.imageState === 'loading-final' || image.dataset.imageState === 'loaded') {
    return;
  }

  const finalSource = image.dataset.imageFinalSrc;
  if (!finalSource) return;

  image.dataset.imageState = 'loading-final';
  const preloader = new Image();
  image._finalImagePreloader = preloader;

  preloader.onload = () => {
    image.src = finalSource;
    image.dataset.imageState = 'loaded';
    image.classList.remove('image-previewing');
    image.classList.add('image-loaded');
  };

  preloader.onerror = () => {
    const fallbackSource = image.dataset.imageFallbackSrc;
    if (!fallbackSource || fallbackSource === finalSource) return;

    image.dataset.imageFinalSrc = fallbackSource;
    image.dataset.imageState = 'loading-final';
    const fallbackPreloader = new Image();
    image._finalImagePreloader = fallbackPreloader;
    fallbackPreloader.onload = () => {
      image.src = fallbackSource;
      image.dataset.imageState = 'loaded';
      image.classList.remove('image-previewing');
      image.classList.add('image-loaded');
    };
    fallbackPreloader.onerror = () => {
      image.dataset.imageState = 'error';
    };
    fallbackPreloader.src = fallbackSource;
  };

  preloader.src = finalSource;
}

function watchImage(image) {
  if (!('IntersectionObserver' in window)) {
    promoteImage(image);
    return;
  }

  if (!imageObserver) {
    imageObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        promoteImage(entry.target);
        imageObserver.unobserve(entry.target);
      });
    }, { rootMargin: '300px 0px' });
  }

  imageObserver.observe(image);
}

function enhanceImage(image, manifest, index) {
  if (image.dataset.imageEnhanced === 'true' || image.closest('#header, #footer, #lightbox-overlay')) {
    return;
  }

  const declaredSource = image.getAttribute('src') || image.dataset.imageOriginal;
  if (!declaredSource || declaredSource.endsWith('.svg')) return;

  image.dataset.imageEnhanced = 'true';
  image.dataset.imageOriginal = declaredSource;
  image.loading = index < 2 ? 'eager' : 'lazy';
  image.decoding = 'async';

  const entry = getImageEntry(image, manifest);
  setImageDimensions(image, entry);
  if (!entry) {
    image.src = getOriginalImageUrl(declaredSource);
    return;
  }

  const originalSource = getImageUrl(entry.original);
  const webpSource = getImageUrl(entry.webp);
  const previewSource = getImageUrl(entry.preview);
  const finalSource = webpSource || originalSource;

  image.dataset.imageFinalSrc = finalSource;
  image.dataset.imageFallbackSrc = originalSource;
  image.dataset.imageState = 'initial';

  if (!previewSource) {
    image.addEventListener('load', () => {
      image.dataset.imageState = 'loaded';
      image.classList.add('image-loaded');
    }, { once: true });
    image.addEventListener('error', () => {
      if (image.src === webpSource && originalSource !== webpSource) {
        image.dataset.imageFinalSrc = originalSource;
        image.src = originalSource;
      }
    });
    image.src = finalSource;
    return;
  }

  image.classList.add('image-previewing');
  image.src = previewSource;

  image.addEventListener('error', () => {
    if (image.src !== previewSource) return;
    image.classList.remove('image-previewing');
    promoteImage(image);
  });

  watchImage(image);
}

async function enhanceImages(root = document) {
  const manifest = await getImageManifest();
  const images = [
    ...(root.matches?.('img') ? [root] : []),
    ...root.querySelectorAll('img'),
  ].filter(image => image.closest('#main, #container'));
  images.forEach((image, index) => enhanceImage(image, manifest, index));
}

window.enhanceImages = enhanceImages;
window.promoteImage = promoteImage;

function applySitePaths(root) {
  root.querySelectorAll('[data-site-path]').forEach(element => {
    const path = element.getAttribute('data-site-path');
    const resolvedPath = resolveSitePath(path);

    if (element.tagName === 'IMG') {
      element.src = resolvedPath;
    } else if (element.tagName === 'A') {
      element.href = resolvedPath;
    }
  });
}

function showComponentError(container, message) {
  container.innerHTML = `<p class="site-error">${message}</p>`;
}

function getPageType() {
  const path = window.location.pathname;

  if (path.endsWith('/about.html')) return 'about';
  if (path.includes('/resume/')) return 'resume';
  if (path.includes('/detail/')) return 'detail';
  return 'home';
}

function getHomeFilter() {
  const filter = new URLSearchParams(window.location.search).get('filter');
  return validFilters.has(filter) ? filter : 'all';
}

function setSharedNavigationState() {
  const pageType = getPageType();
  const activeFilter = pageType === 'home' ? getHomeFilter() : null;

  document.querySelectorAll('#nav a').forEach(link => {
    const isAbout = pageType === 'about' && link.dataset.page === 'about';
    const isWorks = pageType === 'home' && link.dataset.filter === activeFilter;

    link.classList.toggle('active', isAbout || isWorks);
  });
}

async function loadPartial(container, path) {
  try {
    const response = await fetch(resolveSitePath(path));
    if (!response.ok) throw new Error(`Unable to load ${path}`);

    container.innerHTML = await response.text();
    applySitePaths(container);
  } catch (error) {
    console.error(error);
    showComponentError(container, 'This shared section could not be loaded. Please refresh and try again.');
  }
}

async function loadSharedPartials() {
  const partials = [
    ['[data-site-include="header"]', 'components/header.html'],
    ['[data-site-include="footer"]', 'components/footer.html']
  ];

  await Promise.all(partials.map(([selector, path]) => {
    const container = document.querySelector(selector);
    return container ? loadPartial(container, path) : Promise.resolve();
  }));

  document.querySelectorAll('[data-current-year]').forEach(element => {
    element.textContent = new Date().getFullYear();
  });
  setSharedNavigationState();
  await enhanceImages();
  document.dispatchEvent(new CustomEvent('site:ready'));
}

window.siteReady = loadSharedPartials().catch(error => {
  console.error('Unable to initialize shared site components.', error);
});
