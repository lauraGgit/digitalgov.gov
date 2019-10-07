var gulp          = require("gulp"),

    // logging
    log            = require("fancy-log"),

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
      log('----------');
      log('Cleaning up filename');
      log('- from: ' + path.basename + path.extname);
      path.basename = changeCase.lowerCase(path.basename);
      path.extname = changeCase.lowerCase(path.extname);
      log('- to: ' + path.basename + path.extname);
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
      var uid = /([^\/]+)(?=\.\w+$)/g; // gets the slug/filename from the path
      var uid = file.path.match(uid);
      log('----------');
      log('Getting image Data:');
      log('- uid: ' + uid);
      var dimensions = sizeOf(file.path);
      log('- width: ' + dimensions.width);
      log('- height: ' + dimensions.height);
      var format = file.path.split('.').pop();
      log('- format: ' + format);
      var image_data = [
        "date     : " + get_curr_date(),
        "uid      : " + uid,
        "width    : " + dimensions.width,
        "height   : " + dimensions.height,
        "format   : " + format,
        "credit   : \"\"",
        "caption  : \"\"",
        "alt      : \"\""
      ].join("\n");
      log('writing data file: data/images/'+ uid +'.yml ...');
      fs.writeFile('content/images/'+ uid +'.yml', image_data, function(){
      });
      log('----------');
    }))
}));

function resizeImages(data){
  return data.forEach(function(transform) {

    if (transform.src) {
      // if dist folder does not exist, create it with all parent folders
      if (!fs.existsSync(transform.dist)) {
        fs.mkdirSync(transform.dist, { recursive: true }, (err) => {
          if (err) throw err;
        });
      }

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
            log('----------');
            log('cropping w'+ transform.options.width);
            // if the image is greater than or equal to the crop size
            if (metadata.width >= transform.options.width) {
              return image
                .resize(transform.options) // resizes the image
                .toFormat(transform.options.format)
                .toFile(`${transform.dist}/${filename}${transform.options.suffix}${newext}`)
                .catch(err => {
                  console.log(err);
                });
            } else {
              log('skipping w' + transform.options.width);
            }
          })
          .then(function(data) {
            // data contains a WebP image half the width and height of the original JPEG
          });
      });
    } else {
      log('there are no images!');
    }
  });
}

gulp.task("resize-all", gulp.series('file-tidy', function(done){
  return Promise.all([
    new Promise(function(resolve, reject) {
      gulp.src(src + '/*.md')
        .pipe(resizeImages(dg_image_sizes))
        .on('error', reject)
        .pipe(gulp.dest(dist))
        .on('end', resolve)
    }),
  ]).then(function () {
    // Other actions
  });
}));

gulp.task("resize", gulp.series('file-tidy', function(done){
  return gulp.src('content/images/_working/processed/*')
  // return new Promise(function(resizeImages, reject) {
    // resizeImages(dg_image_sizes);
    // console.log("resizeImages");
    // loop through configuration array of objects
    // console.log('starting resize');
    dg_image_sizes.forEach(function(transform) {

      if (transform.src) {
        // if dist folder does not exist, create it with all parent folders
        if (!fs.existsSync(transform.dist)) {
          fs.mkdirSync(transform.dist, { recursive: true }, (err) => {
            if (err) throw err;
          });
        }

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
              log('----------');
              log('cropping w'+ transform.options.width);
              // if the image is greater than or equal to the crop size
              if (metadata.width >= transform.options.width) {
                return image
                  .resize(transform.options) // resizes the image
                  .toFormat(transform.options.format)
                  .toFile(`${transform.dist}/${filename}${transform.options.suffix}${newext}`)
                  .catch(err => {
                    console.log(err);
                  });
              } else {
                log('skipping w' + transform.options.width);
              }
            })
            .then(function(data) {
              // data contains a WebP image half the width and height of the original JPEG
            });
        });
      } else {
        log('there are no images!');
      }
    });
    // done();
    // return 'done';
}));

// Upload the images to S3
gulp.task("upload", gulp.series('resize', function (done) {
  return gulp.src("content/images/_working/processed/*", {buffer:false})
    .pipe(s3({
      Bucket: 'digitalgov',   //  Required
      ACL:    'public-read'   //  Needs to be user-defined
    }, {
      // S3 Constructor Options, ie:
      maxRetries: 5
    }))
  ;
}));


gulp.task("cleanup", gulp.series('upload', function (done) {
  return del(['content/images/_working/**']);
}));
