// 图片点击放大功能，适用于所有博客正文图片
// 图片点击弹窗放大（全局适用，兼容所有页面结构）
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('article img, .blog-content img, img').forEach(function(img) {
    if (img.classList.contains('no-popup')) return;
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function(e) {
      if (img.closest('.img-popup-mask')) return;
      var mask = document.createElement('div');
      mask.className = 'img-popup-mask';
      var big = document.createElement('img');
      big.src = img.src;
      mask.appendChild(big);
      mask.onclick = function() { document.body.removeChild(mask); };
      document.body.appendChild(mask);
    });
  });
});

// 支持点击二级标题时，收起其下所有内容（包括三级及更深标题和内容）
// 并自动生成大纲目录
document.addEventListener('DOMContentLoaded', function() {
  // 折叠功能
  function getFoldContent(header) {
    let content = [];
    let el = header.nextElementSibling;
    while (el && !(el.tagName && /^H[1-6]$/.test(el.tagName) && el.tagName <= header.tagName)) {
      content.push(el);
      el = el.nextElementSibling;
    }
    return content;
  }
  document.querySelectorAll('h2, h3, h4').forEach(function(h) {
    h.classList.add('fold-title');
    let content = getFoldContent(h);
    if (content.length) {
      content.forEach(e => e.classList.add('fold-content'));
      h.addEventListener('click', function() {
        const collapsed = !h.classList.contains('collapsed');
        content.forEach(e => e.classList.toggle('collapsed', collapsed));
        h.classList.toggle('collapsed', collapsed);
      });
    }
  });




    // 大纲功能
  var outline = document.getElementById('outline-list');
  if (outline) {
    document.querySelectorAll('h2').forEach(function(h, i) {
      if (!h.id) h.id = 'outline-h2-' + i;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/^#+/, '').trim();
      li.appendChild(a);
      outline.appendChild(li);
    });
  }
});

function toggleBlogNav() {
  var nav = document.querySelector('.blog-nav');
  nav.classList.toggle('collapsed');
}