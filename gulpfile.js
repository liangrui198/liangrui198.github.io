const gulp = require('gulp');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');

// CSS处理管道
function css() {
  return gulp.src('assets/css/main.scss')
    .pipe(postcss([autoprefixer()]))
    .pipe(gulp.dest('_site/assets/css'));
}