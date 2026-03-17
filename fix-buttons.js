const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// remove aqua-button from body
html = html.replace('<body class="aqua-button">', '<body>');

// replace all class="button" with class="aqua-button"
html = html.replace(/class="button"/g, 'class="aqua-button"');
html = html.replace(/class="button /g, 'class="aqua-button ');

fs.writeFileSync('index.html', html);
console.log('Fixed index.html buttons');
