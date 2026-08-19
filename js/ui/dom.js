// Minimal element-builder helpers so UI modules read as markup, not as
// imperative createElement/setAttribute soup. No framework, no vdom diff —
// each render just rebuilds the DOM subtree it owns from scratch, which is
// cheap enough at this UI's scale and avoids a whole class of stale-view
// bugs a hand-rolled diff could introduce.
const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && node.namespaceURI !== SVG_NS) node[key] = value;
    else node.setAttribute(key, value);
  }
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
