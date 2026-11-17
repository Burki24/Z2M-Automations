const main = document.querySelector('#manual');
const query = document.querySelector('#help-query');
const status = document.querySelector('#help-search-status');
const numbers = new Intl.NumberFormat(document.documentElement.lang);
let marks = []; let selected = -1; let previous = '';
document.querySelector('#help-search').addEventListener('submit', event => {
  event.preventDefault(); const value = query.value.trim();
  if (value !== previous) {
    for (const mark of marks) mark.replaceWith(document.createTextNode(mark.textContent));
    main.normalize(); marks = []; selected = -1; previous = value;
    if (value) {
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT); const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const text = node.textContent; const lower = text.toLocaleLowerCase(document.documentElement.lang);
        const needle = value.toLocaleLowerCase(document.documentElement.lang); let start = 0; let position;
        const fragment = document.createDocumentFragment();
        while ((position = lower.indexOf(needle, start)) !== -1 && marks.length < 500) {
          fragment.append(document.createTextNode(text.slice(start, position)));
          const mark = document.createElement('mark'); mark.textContent = text.slice(position, position + value.length); fragment.append(mark); marks.push(mark); start = position + value.length;
        }
        fragment.append(document.createTextNode(text.slice(start))); node.replaceWith(fragment);
      }
    }
  }
  marks[selected]?.removeAttribute('data-current'); selected = marks.length ? (selected + 1) % marks.length : -1;
  if (selected >= 0) { marks[selected].setAttribute('data-current', ''); marks[selected].scrollIntoView({block: 'center'}); }
  status.textContent = !value ? '' : !marks.length ? document.body.dataset.noMatches : document.body.dataset.matches.replace('{{current}}', numbers.format(selected + 1)).replace('{{count}}', numbers.format(marks.length));
});
query.addEventListener('keydown', event => { if (event.key === 'Escape') { query.value = ''; document.querySelector('#help-search').requestSubmit(); } });
document.querySelector('#help-language').addEventListener('click', event => {
  const chapters = [...main.querySelectorAll('.chapter-anchor')];
  const current = chapters.filter(node => node.getBoundingClientRect().top <= 180).at(-1)?.id ?? location.hash.slice(1);
  if (current) event.currentTarget.hash = current;
});
const enlargement = document.createElement('dialog'); enlargement.className = 'image-dialog';
const close = document.createElement('button'); close.textContent = document.body.dataset.close; close.type = 'button';
const enlarged = document.createElement('img'); let original;
enlargement.append(close, enlarged); document.body.append(enlargement);
close.addEventListener('click', () => enlargement.close());
enlargement.addEventListener('close', () => original?.focus({preventScroll: true}));
for (const image of main.querySelectorAll('img')) {
  image.tabIndex = 0; image.setAttribute('role', 'button');
  image.setAttribute('aria-label', document.body.dataset.imageLabel + ': ' + image.alt);
  function open() { original = image; image.focus({preventScroll: true}); enlarged.src = image.src; enlarged.alt = image.alt; enlargement.setAttribute('aria-label', image.alt); enlargement.showModal(); close.focus(); }
  image.addEventListener('click', open);
  image.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); open(); } });
}
