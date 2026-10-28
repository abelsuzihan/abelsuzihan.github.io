const filterDisplayNameMap = {
  ux: 'UI&UX',
};

const projectFilters = new Set(['all', 'ux', 'branding']);

function readFilterFromUrl() {
  const filter = new URLSearchParams(window.location.search).get('filter');
  return projectFilters.has(filter) ? filter : 'all';
}

function normalizeFilterUrl(filter, replace = false) {
  const url = new URL(window.location.href);

  if (filter === 'all') {
    url.searchParams.delete('filter');
  } else {
    url.searchParams.set('filter', filter);
  }

  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function normalizeInitialFilterUrl() {
  const filter = new URLSearchParams(window.location.search).get('filter');
  if (filter === 'all' || (filter && !projectFilters.has(filter))) {
    normalizeFilterUrl('all', true);
  }
}

function renderProject(project) {
  const item = document.createElement('a');
  const categories = project.category.split(',').map(category => category.trim());
  const displayNames = categories.map(category => filterDisplayNameMap[category] || category);

  item.href = project.link;
  item.className = 'select-item';
  item.dataset.category = project.category;
  item.innerHTML = `
    <img src="${project.img}" alt="${project.title}">
    <div class="item-text">
      <p class="tag">${displayNames.join(', ')}</p>
      <p class="title">${project.title}</p>
    </div>
  `;

  return item;
}

function applyFilter(filter) {
  const activeFilter = projectFilters.has(filter) ? filter : 'all';

  document.querySelectorAll('#container .select-item').forEach(item => {
    const categories = item.dataset.category.split(',').map(category => category.trim());
    item.style.display = activeFilter === 'all' || categories.includes(activeFilter) ? '' : 'none';
  });

  document.querySelectorAll('#nav [data-filter]').forEach(link => {
    link.classList.toggle('active', link.dataset.filter === activeFilter);
  });
}

function replayFilterTransition() {
  const container = document.getElementById('container');
  container.classList.remove('filter-transition');
  void container.offsetWidth;
  container.classList.add('filter-transition');
}

function initializeFilterNavigation() {
  document.querySelectorAll('#nav [data-filter]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const filter = projectFilters.has(link.dataset.filter) ? link.dataset.filter : 'all';
      normalizeFilterUrl(filter);
      applyFilter(filter);
      replayFilterTransition();
    });
  });

  window.addEventListener('popstate', () => {
    const filter = readFilterFromUrl();
    applyFilter(filter);
    replayFilterTransition();

    const rawFilter = new URLSearchParams(window.location.search).get('filter');
    if (rawFilter && !projectFilters.has(rawFilter)) normalizeFilterUrl('all', true);
  });
}

async function loadProjects() {
  const container = document.getElementById('container');

  try {
    const response = await fetch('projects.json');
    if (!response.ok) throw new Error('Unable to load projects.json');

    const projects = await response.json();
    projects.forEach(project => container.appendChild(renderProject(project)));

    normalizeInitialFilterUrl();
    initializeFilterNavigation();
    applyFilter(readFilterFromUrl());
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="load-error">Projects could not be loaded. Please refresh and try again.</p>';
  }
}

if (window.siteReady) {
  window.siteReady.then(loadProjects);
} else {
  loadProjects();
}
