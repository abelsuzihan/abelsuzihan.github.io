const path = window.location.pathname;
const fileName = path.substring(path.lastIndexOf("/") + 1);

fetch('../projects.json')
  .then(res => res.json())
  .then(data => {
    const project = data.find(item => item.link.endsWith(fileName));
    if (project) {
      document.title = project.title;
      document.getElementById('project-title').textContent = project.title;

      const rawCategories = project.category.split(',').map(c => c.trim());
      const displayNames = rawCategories.map(cat => ({
        ux: "UI&UX"
      }[cat] || cat));
      const displayText = displayNames.join(', ');
      document.getElementById('project-category').textContent = displayText;

      document.getElementById('project-image').src = "../" + project.img;
      document.getElementById('project-image').alt = project.title;
    }
  });
