import DOMPurify from "dompurify";

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
  if (node.tagName === "IMG") {
    node.setAttribute("loading", "lazy");
  }
});

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "style") {
    data.attrValue = sanitizeCssValue(data.attrValue);
  }
});

const ALLOWED_TAGS = [
  "div", "span", "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "a", "img",
  "strong", "b", "em", "i", "u", "s", "del", "ins",
  "blockquote", "code", "pre",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "figure", "figcaption",
  "article", "section", "header", "footer", "aside", "main",
  "details", "summary",
  "mark", "small", "sub", "sup",
  "svg", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "text", "tspan", "g", "defs", "use", "symbol", "clipPath",
  "linearGradient", "radialGradient", "stop",
];

const ALLOWED_ATTR = [
  "class", "id", "style", "title", "alt",
  "href", "target", "rel",
  "src", "width", "height", "loading",
  "viewBox", "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
  "points", "transform", "xmlns", "opacity", "fill-opacity", "stroke-opacity",
  "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform",
  "preserveAspectRatio",
  "colspan", "rowspan", "scope",
  "open",
];

const FORBID_TAGS = [
  "script", "noscript",
  "iframe", "frame", "frameset",
  "object", "embed", "applet",
  "form", "input", "button", "select", "textarea", "option", "optgroup",
  "base", "meta", "link",
  "style",
  "math",
  "template",
  "slot",
  "dialog",
  "portal",
  "canvas",
  "audio", "video", "source", "track",
  "picture",
  "map", "area",
  "param",
  "marquee", "blink",
];

const FORBID_ATTR = [
  "onabort", "onafterprint", "onanimationend", "onanimationiteration", "onanimationstart",
  "onauxclick", "onbeforecopy", "onbeforecut", "onbeforeinput", "onbeforepaste",
  "onbeforeprint", "onbeforeunload", "onblur", "oncancel", "oncanplay",
  "oncanplaythrough", "onchange", "onclick", "onclose", "oncontextmenu",
  "oncopy", "oncuechange", "oncut", "ondblclick", "ondrag", "ondragend",
  "ondragenter", "ondragleave", "ondragover", "ondragstart", "ondrop",
  "ondurationchange", "onemptied", "onended", "onerror", "onfocus",
  "onformdata", "onfullscreenchange", "onfullscreenerror", "ongotpointercapture",
  "onhashchange", "oninput", "oninvalid", "onkeydown", "onkeypress", "onkeyup",
  "onlanguagechange", "onload", "onloadeddata", "onloadedmetadata", "onloadstart",
  "onlostpointercapture", "onmessage", "onmessageerror", "onmousedown",
  "onmouseenter", "onmouseleave", "onmousemove", "onmouseout", "onmouseover",
  "onmouseup", "onmousewheel", "onoffline", "ononline", "onpagehide", "onpageshow",
  "onpaste", "onpause", "onplay", "onplaying", "onpointercancel", "onpointerdown",
  "onpointerenter", "onpointerleave", "onpointermove", "onpointerout",
  "onpointerover", "onpointerup", "onpopstate", "onprogress", "onratechange",
  "onreset", "onresize", "onscroll", "onsearch", "onseeked", "onseeking",
  "onselect", "onselectionchange", "onselectstart", "onshow", "onstalled",
  "onstorage", "onsubmit", "onsuspend", "ontimeupdate", "ontoggle",
  "ontouchcancel", "ontouchend", "ontouchmove", "ontouchstart", "ontransitionend",
  "onunhandledrejection", "onunload", "onvolumechange", "onwaiting", "onwheel",
  "download",
  "ping",
  "srcdoc",
  "action", "formaction",
  "data",
  "dynsrc", "lowsrc",
  "background",
  "poster",
  "srcset",
  "usemap",
  "ismap",
  "longdesc",
  "contenteditable",
  "draggable",
  "spellcheck",
  "autocomplete", "autofocus", "autoplay",
  "formenctype", "formmethod", "formnovalidate", "formtarget",
  "http-equiv",
  "integrity",
  "nonce",
  "referrerpolicy",
  "sandbox",
  "allow",
];

function sanitizeCssValue(css: string): string {
  if (!css) return "";

  return css
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/behavior\s*:\s*[^;]+/gi, "")
    .replace(/-moz-binding\s*:\s*[^;]+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/-o-link\s*:/gi, "")
    .replace(/-o-link-source\s*:/gi, "")
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, "url(")
    .replace(/url\s*\(\s*['"]?\s*vbscript:/gi, "url(")
    .replace(/url\s*\(\s*['"]?\s*data:(?!image\/(png|jpg|jpeg|gif|svg\+xml|webp))/gi, "url(");
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let cleaned = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/vbscript\s*:/gi, "blocked:")
    .replace(/data\s*:\s*text\/html/gi, "blocked:")
    .replace(/\bon\w+\s*=/gi, "data-blocked=");

  const sanitized = DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOW_ARIA_ATTR: true,
    ALLOW_SELF_CLOSE_IN_ATTR: false,
    SAFE_FOR_TEMPLATES: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    FORCE_BODY: false,
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    KEEP_CONTENT: true,
    IN_PLACE: false,
  });

  return sanitized;
}

export function sanitizeCss(css: string): string {
  if (!css) return "";

  let sanitized = css
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/@charset\s+[^;]+;?/gi, "")
    .replace(/@namespace\s+[^;]+;?/gi, "")
    .replace(/@document\s+[^{]+\{[\s\S]*?\}/gi, "")
    .replace(/@supports\s+[^{]+\{[\s\S]*?\}/gi, "")
    .replace(/@page\s*\{[\s\S]*?\}/gi, "")
    .replace(/@font-face\s*\{[^}]*src\s*:[^}]*url\s*\([^)]*\)[^}]*\}/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "none")
    .replace(/behavior\s*:\s*[^;]+;?/gi, "")
    .replace(/-moz-binding\s*:\s*[^;]+;?/gi, "")
    .replace(/-ms-behavior\s*:\s*[^;]+;?/gi, "")
    .replace(/binding\s*:\s*[^;]+;?/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/vbscript\s*:/gi, "blocked:")
    .replace(/-o-link\s*:\s*[^;]+;?/gi, "")
    .replace(/-o-link-source\s*:\s*[^;]+;?/gi, "")
    .replace(/url\s*\(\s*['"]?\s*javascript:[^)]*\)/gi, "url()")
    .replace(/url\s*\(\s*['"]?\s*vbscript:[^)]*\)/gi, "url()")
    .replace(/url\s*\(\s*['"]?\s*data:(?!image\/(png|jpg|jpeg|gif|svg\+xml|webp))[^)]*\)/gi, "url()");

  sanitized = sanitized.replace(/\\[0-9a-fA-F]{1,6}\s?/g, (match) => {
    const codePoint = parseInt(match.trim().slice(1), 16);
    const char = String.fromCodePoint(codePoint);
    if (/[<>"'&\\(){}[\];:@]/.test(char)) {
      return "";
    }
    return match;
  });

  let depth = 0;
  let result = "";
  for (const char of sanitized) {
    if (char === "{") {
      depth++;
      result += char;
    } else if (char === "}") {
      if (depth > 0) {
        depth--;
        result += char;
      }
    } else {
      result += char;
    }
  }

  while (depth > 0) {
    result += "}";
    depth--;
  }

  return result;
}

