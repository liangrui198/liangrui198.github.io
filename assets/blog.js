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