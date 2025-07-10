// 别名映射
const filterDisplayNameMap = {
  ux: "UI&UX",
};

// 解析 URL 参数
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

fetch('projects.json')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('container');
    const buttons = document.querySelectorAll('#nav button');

    // 渲染所有项目
    data.forEach(project => {
      const item = document.createElement('a');
      item.href = project.link;
      item.className = 'select-item';
      item.setAttribute('data-category', project.category);

      // 解析并映射别名
      const rawCategories = project.category.split(',').map(c => c.trim());
      const displayNames = rawCategories.map(cat => filterDisplayNameMap[cat] || cat);
      const displayText = displayNames.join(', ');

      item.innerHTML = `
        <img src="${project.img}" alt="${project.title}">
        <div class="item-text">
          <p class="tag">${displayText}</p>
          <p class="title">${project.title}</p>
        </div>
      `;
      container.appendChild(item);
    });

    // 获取初始筛选参数
    const initialFilter = getQueryParam('filter');

    if (initialFilter) {
      applyFilter(initialFilter);
    } else {
      // 显示所有 item
      const items = document.querySelectorAll('#container .select-item');
      items.forEach(item => item.style.display = "");
    }

    // 添加按钮点击事件
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.getAttribute('data-filter');
        applyFilter(filter);

        // 更新 URL
        history.pushState({}, '', `?filter=${filter}`);

        // 更新按钮高亮
        buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });

    // 支持多分类
    function applyFilter(filter) {
      const items = document.querySelectorAll('#container .select-item');
      items.forEach(item => {
        if (filter === 'all') {
          item.style.display = "";
        } else {
          const categories = item.getAttribute('data-category').split(',').map(c => c.trim());
          if (categories.includes(filter)) {
            item.style.display = "";
          } else {
            item.style.display = "none";
          }
        }
      });

      // 自动高亮按钮
      buttons.forEach(btn => {
        if (btn.getAttribute('data-filter') === filter) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // 浏览器后退/前进按钮监听
    window.addEventListener('popstate', () => {
      const newFilter = getQueryParam('filter') || 'all';
      applyFilter(newFilter);
    });
  });
