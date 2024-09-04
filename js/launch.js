var chubLocation = "html"
var chubDev = true

// ---

ChubML.body = ChubML.parse(`
nav @*wrp=b @*wrp=i;
  "Please wait </b>";
  span;
    "while we load the page...";
`)

// ---

let pageSrc = 'beam.lmc'
ChubML.beamMake(pageSrc).then(
  ({ doc }) => ChubML.beamRender(doc, chubLocation)
)

// ---

function importStyle(href = '') {
  return document.head.appendChild(Object.assign(
    document.createElement('link'),
    { href, rel: 'stylesheet', type: 'text/css' }
  ))
}

function importScript(src = '', type = '', async = false) {
  return document.head.appendChild(Object.assign(
    document.createElement('script'),
    { src, type, async }
  ))
}

// On injectChub finished.
var chubinjected = (event) => {
  import('/js/entry.js')
  window.__cml_served = event

  { ['css/style.css'].map(importStyle) }
}