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

// Native replaceChildren() (with no args, so it only removes) rather than
// a hand-rolled `while (firstChild) removeChild` loop — that loop re-reads
// `node.firstChild` on every iteration, which is exactly what makes it
// vulnerable to re-entrant mutation of the SAME node: removing a focused
// descendant fires 'blur' synchronously, and if a blur/change handler
// elsewhere triggers ANOTHER render() on this same container (e.g.
// clicking a button placed right after a still-focused field, without
// tabbing away first — an entirely ordinary interaction), the nested
// clear()+rebuild races the outer loop and "node to be removed is no
// longer a child of this node" is thrown. replaceChildren() removes from
// a list captured up front instead of re-querying live state, so it isn't
// exposed to that race.
export function clear(node) {
  node.replaceChildren();
}
