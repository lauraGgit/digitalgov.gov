var gulp          = require("gulp"),

    // file-tidy
    replace       = require("gulp-replace-name"),
    rename        = require("gulp-rename"),
    changeCase    = require('change-case'),

    // clean-inbox
    del           = require("del"),

    // write files
    tap           = require('gulp-tap'),
    sizeOf        = require('image-size'),

    // resize
    fs            = require("fs"),
    glob          = require("glob"),
    path          = require("path"),
    sharp         = require("sharp"),

    // upload
    s3config      = JSON.parse(fs.readFileSync('.env')),
    s3            = require('gulp-s3-upload')(s3config);



// specify transforms
const dg_image_sizes = [
  {
    src: "content/images/_working/to-process/*",
    dist: "content/images/_working/processed/",
    options: {
      width: 200,
      height: null,
      suffix: '_w200',
      quality: 1,
      format: 'png'
    }
  },
  {
    src: "content/images/_working/to-process/*",
    dist: "content/images/_working/processed/",
    options: {
      width: 400,
      height: null,
      suffix: '_w400',
      quality: 80,
      format: 'png'
    }
  },
  {
    src: "content/images/_working/to-process/*",
    dist: "content/images/_working/processed/",
    options: {
      width: 600,
      height: null,
      suffix: '_w600',
      quality: 80,
      format: 'png'
    }
  },
  {
    src: "content/images/_working/to-process/*",
    dist: "content/images/_working/processed/",
    options: {
      width: 800,
      height: null,
      suffix: '_w800',
      quality: 80,
      format: 'png'
    }
  },
  {
    src: "content/images/_working/to-process/*",
    dist: "content/images/_working/processed/",
    options: {
      width: 1000,
      height: null,
      suffix: '_w1000',
      quality: 80,
      format: 'png'
    }
  },
  {
    src: "content/images/_working/to-process/*",
    dist: "content/images/_working/processed/",
    options: {
      width: 1200,
      height: null,
      suffix: '_w1200',
      quality: 80,
      format: 'png'
    }
  }
];

// specify transforms
const dg_proxy_image_sizes = [
  {
    src: "content/images/_working/to-process/*",
    dist: "content/images/_working/processed/",
    options: {
      width: 200,
      suffix: '_w200',
      quality: 1,
      format: 'png'
    }
  }
];


function get_curr_date(){
  var d = new Date();
  var month = d.getMonth()+1;
  var day = d.getDate();
  var output = d.getFullYear() + '-' +
      (month<10 ? '0' : '') + month + '-' +
      (day<10 ? '0' : '') + day + ' ' +
      (d.getHours()<10 ? '0' : '') + d.getHours() + ":" +
      (d.getMinutes()<10 ? '0' : '') + d.getMinutes() + ":" +
      (d.getSeconds()<10 ? '0' : '') + d.getSeconds() +
      ' -0400';
  return output;
}

function get_image_uid(path){
  var uid = /([^\/]+)(?=\.\w+$)/g; // gets the slug/filename from the path
  return path.match(uid);
}

function get_image_format(path){
  var format = path.split('.').pop(); // gets the file extension from the path
  return format;
}

function get_image_data(uid, width, height, format){
  console.log('getting the image data...');
  console.log('uid: ' + uid);
  console.log('width: ' + width);
  console.log('height: ' + height);
  console.log('format: ' + format);
  var data = [
    "date     : " + get_curr_date(),
    "uid      : " + uid,
    "width    : " + width,
    "height   : " + height,
    "format   : " + format,
    "credit   : \"\"",
    "caption  : \"\"",
    "alt      : \"\""
  ].join("\n");
  return data;
}

function get_image_sq(path){
  var dimensions = sizeOf(path); // gets the file extension from the path
  var sq_dim = Math.min(dimensions.width, dimensions.height);
  return sq_dim;
}


// Cleans up the file names before processing them
// You'd be surprised what people put in file names these days...
gulp.task("file-tidy", function (done) {
  return gulp.src("content/images/_inbox/*.{png,jpg,jpeg}")
    .pipe(replace(/[ &$_#!?.]/g, '-'))            // special chars to dashes
    .pipe(replace(/-+/g, '-'))                    // multiple dashes to a single dash
    .pipe(replace(/-(png|jpg|jpeg)/g, '.$1'))     // remove trailing dashes
    .pipe(replace(/\.jpeg$/g, '.jpg'))            // .jpeg to .jpg
    .pipe(replace(/-\d{2,4}x\d{2,4}(?=\.jpg)/g, ''))      // strip trailing dimensions
    .pipe(replace(/^\d{2,4}-*x-*\d{2,4}-*/g, ''))      // strip leading dimensions
    .pipe(replace(/-\./g, '.'))                   // remove leading dashes
    .pipe(replace(/^-/g, ''))                     // removes dashes from the start of filename
    .pipe(rename(function(path) { // make filename lowercase
      path.basename = changeCase.lowerCase(path.basename);
      path.extname = changeCase.lowerCase(path.extname);
    }))
    // Copies the original image to two new folders in content/images/_working/
    .pipe(gulp.dest("content/images/_working/originals/"))
    .pipe(gulp.dest("content/images/_working/to-process/"))

});

// Deletes the original image content/images/_inbox/
gulp.task("clean-inbox", gulp.series('file-tidy', function(done){
  return del(['content/images/_inbox/**', '!content/images/_inbox', '!content/images/_inbox/__add jpg and png files to this folder__']);
}));

gulp.task("write-file", gulp.series('clean-inbox', function(done){
  return gulp.src("content/images/_working/to-process/*.{png,jpg,jpeg,JPG,JPEG,PNG}")
    .pipe(tap(function (file) {
      var uid = get_image_uid(file.path);
      var format = get_image_format(file.path);
      var dimensions = sizeOf(file.path);
      fs.writeFile('content/images/'+ uid +'.yml', get_image_data(uid, dimensions.width, dimensions.height, format), function(){
      });
    }))
}));


gulp.task("resize", gulp.series('write-file', function(done){
  // resizeImages(dg_image_sizes);
  // loop through configuration array of objects
  dg_image_sizes.forEach(function(transform) {
    // if dist folder does not exist, create it with all parent folders
    if (!fs.existsSync(transform.dist)) {
      fs.mkdirSync(transform.dist, { recursive: true }, (err) => {
        if (err) throw err;
      });
    }

    if (transform.src) {
      // glob all files
      let files = glob.sync(transform.src);
      // for each file, apply transforms and save to file
      files.forEach(function(file) {
        let ext = path.extname(file); // gets the current file extension
        let newext = '.png';
        let filename = path.basename(file, ext); // gets the filename, without the extension
        const image = sharp(file);
        image
          .metadata()
          .then(function(metadata) {
            // if the image is greater than or equal to the crop size
            if (metadata.width >= transform.options.width) {
              return image
                .resize(transform.options) // resizes the image
                .toFormat(transform.options.format)
                .toFile(`${transform.dist}/${filename}${transform.options.suffix}${newext}`)
                .catch(err => {
                  console.log(err);
                });
            }
          })
          .then(function(data) {
            // data contains a WebP image half the width and height of the original JPEG
          });
      });
    }
  });
  done();
}));

gulp.task("proxy-img", gulp.series('resize', function(done){
  resizeImages(dg_proxy_image_sizes);
  done();
}));

// Upload the images to S3
gulp.task("upload", gulp.series('resize', function (done) {
  gulp.src("content/images/_working/processed/**/*")
    .pipe(s3({
      Bucket: 'digitalgov',   //  Required
      ACL:    'public-read'   //  Needs to be user-defined
    }, {
      // S3 Constructor Options, ie:
      maxRetries: 5
    }))
  ;
}));


gulp.task("proxy", gulp.series('upload', function (done) {
  // - - - - - - - - - - - - - - - - -
  // Create lorez version for Hugo to parse
  return gulp.src("content/images/_working/originals/*.{png,jpg}")
    .pipe(responsive({
      '*': {
        rename: {
          suffix: '',
          extname: '.jpg',
        },
        grayscale: true,
        quality: 1,
        flatten: true,
        blur: true,
      },
    }, {
      // Global configuration for all images
      progressive: true,
      withMetadata: false,
      errorOnUnusedConfig: false,
      skipOnEnlargement: true,
      errorOnEnlargement: false,
      silent: true,
    }))
    .pipe(responsive({
      '*': {
        rename: {
          suffix: '',
          extname: '.jpg',
        },
        grayscale: true,
        quality: 1,
        flatten: true,
        blur: true,
      },
    }, {
      // Global configuration for all images
      progressive: true,
      withMetadata: false,
      errorOnUnusedConfig: false,
      skipOnEnlargement: true,
      errorOnEnlargement: false,
      silent: true,
    }))
    .pipe(gulp.dest("static/img/proxy/"));
}));

gulp.task("done", gulp.series('proxy', function (done) {
  return gulp.src("content/images/_working/originals/*")
    .pipe(gulp.dest("content/images/uploaded/"));
}));

gulp.task("cleanup", gulp.series('done', function (done) {
  // return del(['content/images/_working/**']);
}));
