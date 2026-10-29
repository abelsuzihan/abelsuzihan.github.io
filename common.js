const commonScript = document.currentScript;
const siteRootUrl = new URL('.', commonScript.src);
const currentPageDirectory = new URL('.', window.location.href);
const sitePathPrefix = currentPageDirectory.pathname === siteRootUrl.pathname ? '' : '../';
const validFilters = new Set(['all', 'ux', 'branding']);

function resolveSitePath(path) {
  return `${sitePathPrefix}${path}`;
}

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
  document.dispatchEvent(new CustomEvent('site:ready'));
}

window.siteReady = loadSharedPartials().catch(error => {
  console.error('Unable to initialize shared site components.', error);
});
