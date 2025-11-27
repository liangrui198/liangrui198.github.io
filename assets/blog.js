// ...existing code...
// 图片点击放大功能，适用于所有博客正文图片
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('article img, .blog-content img, img').forEach(function(img) {
    if (img.classList.contains('no-popup')) return;
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function(e) {
      if (img.closest('.img-popup-mask')) return;
      var mask = document.createElement('div');
      mask.className = 'img-popup-mask';
      // 简单样式，建议将样式移到 CSS 文件中
      mask.style.position = 'fixed';
      mask.style.left = 0;
      mask.style.top = 0;
      mask.style.right = 0;
      mask.style.bottom = 0;
      mask.style.background = 'rgba(0,0,0,0.8)';
      mask.style.display = 'flex';
      mask.style.alignItems = 'center';
      mask.style.justifyContent = 'center';
      mask.style.zIndex = 9999;

      var big = document.createElement('img');
      big.src = img.src;
      big.style.maxWidth = '95%';
      big.style.maxHeight = '95%';
      big.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
      big.style.cursor = 'zoom-out';

      mask.appendChild(big);
      mask.addEventListener('click', function() { document.body.removeChild(mask); });
      document.body.appendChild(mask);
    });
  });
});

// 主功能：折叠标题 + 三级大纲（H2->一级, H3->二级, H4->三级），并为缺失 id 的标题生成锚点
document.addEventListener('DOMContentLoaded', function() {

  function slugify(text) {
    return (text || '').toString().trim().toLowerCase()
      .replace(/[^\w\s\-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/\-+/g, '-');
  }

  function ensureId(el, prefix) {
    if (el.id) return el.id;
    var base = (prefix ? (prefix + '-' + slugify(el.textContent || el.innerText || 'heading')) : slugify(el.textContent || el.innerText || 'heading')) || 'heading';
    var id = base, i = 1;
    while (document.getElementById(id)) {
      id = base + '-' + (i++);
    }
    el.id = id;
    return id;
  }

  // 返回 header 之后，直到遇到相同或更高级别标题为止的所有连续元素
  function getFoldContent(header) {
    var content = [];
    var el = header.nextElementSibling;
    var hdrLevel = /^H([1-6])$/i.test(header.tagName) ? parseInt(header.tagName.charAt(1), 10) : 0;
    while (el) {
      if (el.tagName && /^H[1-6]$/i.test(el.tagName)) {
        var curLevel = parseInt(el.tagName.charAt(1), 10);
        if (curLevel <= hdrLevel) break;
      }
      content.push(el);
      el = el.nextElementSibling;
    }
    return content;
  }

  // 为 H2/H3/H4 添加折叠交互（点击折叠其下所有内容直到下一个相同或更高级标题）
  var headings = document.querySelectorAll('article h2, article h3, article h4, .post-content h2, .post-content h3, .post-content h4, .blog-content h2, .blog-content h3, .blog-content h4');
  headings.forEach(function(h) {
    var content = getFoldContent(h);
    if (content.length) {
      h.classList.add('fold-title');
      content.forEach(function(e){ e.classList.add('fold-content'); });
      h.style.cursor = 'pointer';
      h.addEventListener('click', function() {
        var collapsed = !h.classList.contains('collapsed');
        content.forEach(function(e){ e.classList.toggle('collapsed', collapsed); });
        h.classList.toggle('collapsed', collapsed);
      });
    }
  });

  // 大纲构建（支持三级：H2,H3,H4）
  var outline = document.getElementById('outline-list');
  if (outline) {
    // 定位文章主体
    var contentRoot = document.querySelector('.post-content') || document.querySelector('article') || document.querySelector('.blog-content') || document.querySelector('main') || document.body;
    var hs = contentRoot.querySelectorAll('h2, h3, h4');
    if (hs.length) {
      outline.innerHTML = '';
      var parents = [outline]; // parents[0] 对应 H2 的 ul，parents[1] H3，parents[2] H4

      hs.forEach(function(h) {
        var level = /^H([1-6])$/i.test(h.tagName) ? parseInt(h.tagName.charAt(1), 10) : 0;
        if (level < 2 || level > 4) return;
        var idx = level - 2; // H2->0, H3->1, H4->2

        ensureId(h, 'outline');

        // 如果需要更深的层级，确保 parents 有对应的 ul（将上一个 li 作为父节点）
        while (parents.length <= idx) {
          var lastParent = parents[parents.length - 1];
          var lastLi = lastParent.lastElementChild;
          if (!lastLi) {
            lastLi = document.createElement('li');
            lastParent.appendChild(lastLi);
          }
          var newUl = document.createElement('ul');
          lastLi.appendChild(newUl);
          parents.push(newUl);
        }

        // 收缩到当前层级
        parents = parents.slice(0, idx + 1);

        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = (h.textContent || h.innerText || '').trim();
        a.addEventListener('click', function(e) {
          e.preventDefault();
          var target = document.getElementById(h.id);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            try { history.replaceState(null, null, '#' + h.id); } catch (e) {}
          }
        });
        li.appendChild(a);
        parents[parents.length - 1].appendChild(li);
      });

      // 简单样式（建议迁移到 assets/blog.css）
      outline.style.listStyle = 'none';
      outline.querySelectorAll('ul').forEach(function(u){ u.style.margin = '0 0 0 1em'; u.style.paddingLeft = '0.6em'; });
      outline.querySelectorAll('li').forEach(function(li){ li.style.margin = '0.15em 0'; });
      outline.querySelectorAll('a').forEach(function(a){ a.style.textDecoration = 'none'; a.style.color = 'inherit'; cursorPointer(a); });

      function cursorPointer(el){ el.style.cursor = 'pointer'; }
    }
  }

}); // DOMContentLoaded end

// ...existing code...

function toggleBlogNav() {
  const nav = document.querySelector('.blog-nav');
  if (!nav) return;
  const body = document.body;

  // 在桌面上用 .collapsed；在小屏用 body.blog-nav-open 来打开
  if (window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
    body.classList.toggle('blog-nav-open');
    if (body.classList.contains('blog-nav-open')) {
      localStorage.setItem('blogNavOpen', '1');
    } else {
      localStorage.removeItem('blogNavOpen');
    }
  } else {
    nav.classList.toggle('collapsed');
    body.classList.toggle('blog-nav-collapsed', nav.classList.contains('collapsed'));
    if (nav.classList.contains('collapsed')) {
      localStorage.setItem('blogNavCollapsed', '1');
    } else {
      localStorage.removeItem('blogNavCollapsed');
    }
  }
}

// 如果没有固定切换按钮，就创建一个，确保折叠后仍可恢复侧栏
document.addEventListener('DOMContentLoaded', function () {
  if (!document.querySelector('.nav-toggle-fixed')) {
    const btn = document.createElement('button');
    btn.className = 'nav-toggle-fixed';
    btn.type = 'button';
    btn.title = '切换侧栏';
    btn.innerText = '☰';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleBlogNav();
    });
    const nav = document.querySelector('.blog-nav');
    if (nav && nav.parentNode) {
      nav.parentNode.insertBefore(btn, nav.nextSibling);
    } else {
      document.body.appendChild(btn);
    }
  }
});


// 浮动大纲：把页面内 .outline 转为右侧可收起/展开的浮动菜单（会克隆原 ul，保留原位置以防兼容问题）
document.addEventListener('DOMContentLoaded', function() {
  var originalOutline = document.querySelector('.outline');
  if (!originalOutline) return;

  // 查找内部的 ul#outline-list 或第一个 ul
  var srcUl = originalOutline.querySelector('#outline-list') || originalOutline.querySelector('ul');
  if (!srcUl) return;

  // 创建浮动容器
  var floatWrap = document.createElement('aside');
  floatWrap.className = 'floating-outline';
  floatWrap.setAttribute('aria-hidden', 'false');

  var header = document.createElement('div');
  header.className = 'floating-outline-header';

  var title = document.createElement('strong');
  title.className = 'floating-outline-title';
  title.textContent = '大纲';
  header.appendChild(title);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'floating-outline-toggle';
  btn.title = '收起大纲';
  btn.innerHTML = '▾';
  header.appendChild(btn);

  // 可选：收起到小标签时也能打开
  var tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'floating-outline-tab';
  tab.title = '打开大纲';
  tab.innerHTML = '大纲';
  tab.style.display = 'none';

  var body = document.createElement('div');
  body.className = 'floating-outline-body';

  // 克隆原 ul，避免移动 DOM 导致页面布局变更
  var cloned = srcUl.cloneNode(true);
  // 给克隆的链接加上平滑滚动处理
  cloned.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function(e) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#') {
        e.preventDefault();
        var id = href.slice(1);
        var target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          try { history.replaceState(null, null, '#' + id); } catch (err) {}
        }
        // 小屏幕上点击后自动收起（可选）
        if (window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
          floatWrap.classList.add('collapsed');
          localStorage.setItem('outlineCollapsed', '1');
        }
      }
    });
  });

  body.appendChild(cloned);
  floatWrap.appendChild(header);
  floatWrap.appendChild(body);
  document.body.appendChild(floatWrap);
  document.body.appendChild(tab);

  // 隐藏原始位置的大纲（保留在 DOM 中以便 SEO/无 JS 用户）
  originalOutline.style.visibility = 'hidden';
  originalOutline.style.height = '0';
  originalOutline.style.overflow = 'hidden';

  // 读取上次状态
  var collapsed = localStorage.getItem('outlineCollapsed') === '1';
  if (collapsed) {
    floatWrap.classList.add('collapsed');
    tab.style.display = 'block';
  }

  function updateToggleUI() {
    var isCollapsed = floatWrap.classList.contains('collapsed');
    btn.title = isCollapsed ? '展开大纲' : '收起大纲';
    btn.innerHTML = isCollapsed ? '▸' : '▾';
    tab.style.display = isCollapsed ? 'block' : 'none';
  }
  updateToggleUI();

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isCollapsed = floatWrap.classList.toggle('collapsed');
    localStorage.setItem('outlineCollapsed', isCollapsed ? '1' : '0');
    updateToggleUI();
  });

  tab.addEventListener('click', function(e) {
    e.stopPropagation();
    floatWrap.classList.remove('collapsed');
    localStorage.setItem('outlineCollapsed', '0');
    updateToggleUI();
  });

  // 点击浮动外部时，根据需要自动收起（可选行为，注释掉可禁用）
  document.addEventListener('click', function(e) {
    if (!floatWrap.contains(e.target) && !e.target.classList.contains('floating-outline-toggle') && window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
      // 小屏自动收起
      floatWrap.classList.add('collapsed');
      localStorage.setItem('outlineCollapsed', '1');
      updateToggleUI();
    }
  });

  // 响应窗口大小：在窄屏时默认收起，宽屏时恢复上次状态
  function handleResize() {
    if (window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
      // 小屏收起
      if (!floatWrap.classList.contains('collapsed')) {
        floatWrap.classList.add('collapsed');
      }
    } else {
      // 桌面恢复上次存储状态
      var persisted = localStorage.getItem('outlineCollapsed') === '1';
      if (persisted) floatWrap.classList.add('collapsed'); else floatWrap.classList.remove('collapsed');
    }
    updateToggleUI();
  }
  window.addEventListener('resize', handleResize);
  handleResize();
});

