// List of map files, in the order they appear in the map picker.
// To add a map: copy one of these files, give it a new id, and add its file name here.
(function (g) {
  g.PYB.MAP_FILES = [
    'map1-training.js',
    'map2-canyon.js'
  ];
  if (typeof document === 'undefined' && typeof importScripts === 'function') {
    importScripts.apply(null, g.PYB.MAP_FILES.map(f => 'maps/' + f));
  }
})(typeof self !== 'undefined' ? self : window);
