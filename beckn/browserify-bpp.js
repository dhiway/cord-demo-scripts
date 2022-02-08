var browserify = require('browserify');
var tsify = require('tsify');
var esmify = require('esmify');

browserify

browserify()
    .add('./beckn/beckn-bpp.ts', {
	standalone: 'cord',
    }) // main entry of an application
    .plugin(esmify, { noImplicitAny: true })
    .plugin(tsify, { noImplicitAny: true })
    .bundle()
    .on('error', function (error) { console.error(error.toString()); })
    .pipe(process.stdout);
