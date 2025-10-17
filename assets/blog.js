// 图片点击放大功能，适用于所有博客正文图片
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('img-popup-mask')) return;
  var mask = document.createElement('div');
  mask.id = 'img-popup-mask';
  mask.style = 'display:none;position:fixed;z-index:9999;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;';
  var img = document.createElement('img');
  img.style = 'max-width:90vw;max-height:90vh;box-shadow:0 2px 16px #000;border-radius:8px;background:#fff;padding:8px;';
  mask.appendChild(img);
  mask.addEventListener('click', function() { mask.style.display = 'none'; });
  document.body.appendChild(mask);
  document.querySelectorAll('.blog-content img, .post-content img, .outline ~ img, .outline + img, .outline img').forEach(function(im) {
    im.style.cursor = 'zoom-in';
    im.addEventListener('click', function(e) {
      img.src = im.src;
      mask.style.display = 'flex';
      e.stopPropagation();
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