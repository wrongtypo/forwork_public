type Translation = { original: string; translated: string };

// React child components can update without rerendering the app shell. Observe
// those commits too, without overwriting React's newer text with cached content.
export function observeSimplifiedChinese(root: HTMLElement, convert: (value: string) => string) {
  const texts = new Map<Text, Translation>();
  const attributes = new Map<Element, Map<string, Translation>>();
  const originalLang = root.lang;
  const translatedAttributes = ["placeholder", "aria-label", "alt", "title"];
  let stopped = false;
  function translate(value: string, previous?: Translation): Translation {
    const original = previous && value === previous.translated ? previous.original : value;
    return { original, translated: convert(original) };
  }
  function visit(element: Element) {
    if (element.classList.contains("ignore-opencc") || ["SCRIPT", "STYLE", "TEXTAREA"].includes(element.tagName)) return;
    const language = element.getAttribute("lang");
    if (element !== root && language && !["zh-TW", "zh-CN", "zh-Hant", "zh-Hans"].includes(language)) return;
    for (const name of translatedAttributes) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      let values = attributes.get(element);
      if (!values) { values = new Map(); attributes.set(element, values); }
      const translated = translate(value, values.get(name));
      values.set(name, translated);
      if (value !== translated.translated) element.setAttribute(name, translated.translated);
    }
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child as Text;
        const translated = translate(text.data, texts.get(text));
        texts.set(text, translated);
        if (text.data !== translated.translated) text.data = translated.translated;
      } else if (child.nodeType === Node.ELEMENT_NODE) visit(child as Element);
    }
  }
  const observer = new MutationObserver(update);
  function update() {
    if (stopped) return;
    // Do not observe our own text/attribute writes or create a feedback loop.
    observer.disconnect();
    for (const node of texts.keys()) if (!root.contains(node)) texts.delete(node);
    for (const node of attributes.keys()) if (!root.contains(node)) attributes.delete(node);
    root.lang = "zh-CN";
    visit(root);
    observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: translatedAttributes });
  }
  update();
  return () => {
    stopped = true;
    observer.disconnect();
    // Restore only our own translations, never a newer value written by React.
    for (const [node, value] of texts) if (root.contains(node) && node.data === value.translated) node.data = value.original;
    for (const [element, values] of attributes) if (root.contains(element)) {
      for (const [name, value] of values) if (element.getAttribute(name) === value.translated) element.setAttribute(name, value.original);
    }
    root.lang = originalLang;
    texts.clear();
    attributes.clear();
  };
}
