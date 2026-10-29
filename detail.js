const detailPagePath = window.location.pathname;
const detailFileName = detailPagePath.substring(detailPagePath.lastIndexOf('/') + 1);
const detailDisplayNameMap = {
  ux: 'UI&UX',
};

function showDetailError(message) {
  const title = document.getElementById('project-title');
  const category = document.getElementById('project-category');

  if (title) title.textContent = message;
  if (category) category.textContent = '';
}

async function loadProjectDetails() {
  if (document.documentElement.dataset.template === 'project') return;

  try {
    const response = await fetch('../projects.json');
    if (!response.ok) throw new Error('Unable to load projects.json');

    const projects = await response.json();
    const project = projects.find(item => item.link.endsWith(detailFileName));
    if (!project) {
      showDetailError('Project not found');
      return;
    }

    document.title = project.title;

    const title = document.getElementById('project-title');
    const category = document.getElementById('project-category');
    const projectImage = document.getElementById('project-image');

    if (title) title.textContent = project.title;
    if (category) {
      category.textContent = project.category
        .split(',')
        .map(value => value.trim())
        .map(value => detailDisplayNameMap[value] || value)
        .join(', ');
    }
    if (projectImage) {
      projectImage.src = `../${project.img}`;
      projectImage.alt = project.title;
      if (window.enhanceImages) await window.enhanceImages(projectImage.parentElement || document);
    }
  } catch (error) {
    console.error(error);
    showDetailError('Project details could not be loaded');
  }
}

loadProjectDetails();
