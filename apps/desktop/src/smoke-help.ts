import type {BrowserWindow, WebContents} from 'electron';

async function verifyHelpLayout(viewer: BrowserWindow): Promise<void> {
  try {
    for (const width of [360, 600, 1120]) {
      viewer.setContentSize(width, 700);
      let viewport;
      for (let attempt = 0; attempt < 100; attempt++) {
        viewport = await viewer.webContents.executeJavaScript('({width: innerWidth, height: innerHeight})');
        if (viewport.width === width && viewport.height === 700) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (viewport.width !== width || viewport.height !== 700) throw new Error('Help viewport did not resize: ' + JSON.stringify({width, actual: viewport}));
      // Desktop font fallbacks differ. This stack selects Verdana on Windows and
      // DejaVu Sans on Linux, which exposed the overflowing German heading.
      for (const family of ['system-ui, sans-serif', 'Verdana, "DejaVu Sans", sans-serif']) {
        for (const theme of ['light', 'dark']) {
          const layout = await viewer.webContents.executeJavaScript(`(async () => {
            const root=document.documentElement;
            root.style.fontFamily=${JSON.stringify(family)}; root.style.colorScheme=${JSON.stringify(theme)};
            await document.fonts.ready;
            return {language:root.lang, viewport:innerWidth, available:root.clientWidth, scroll:root.scrollWidth,
              overflowing:[...document.querySelectorAll('header,header form,h1,h2,h3,p,li')]
                .filter(element => !element.closest('pre,.table-scroll') && element.clientWidth>0 && element.scrollWidth>element.clientWidth+1)
                .slice(0,8).map(element => ({tag:element.tagName,id:element.id,available:element.clientWidth,scroll:element.scrollWidth}))};
          })()`);
          if (layout.scroll > layout.available + 1 || layout.overflowing.length) {
            throw new Error('Offline help overflow: ' + JSON.stringify({width, family, theme, ...layout}));
          }
        }
      }
      console.log('DESKTOP_HELP_LAYOUT_OK ' + JSON.stringify({width, language: await viewer.webContents.executeJavaScript('document.documentElement.lang'), themes: ['light', 'dark'], fonts: ['system', 'wide']}));
    }
  } finally {
    await viewer.webContents.executeJavaScript("document.documentElement.style.fontFamily='';document.documentElement.style.colorScheme=''");
  }
}

// Exercises the shipped help boundary without recording any screen content.
export async function smokeHelp(view: WebContents, current: () => BrowserWindow | null): Promise<void> {
  const wait = async (condition: () => boolean): Promise<void> => {
    for (let n = 0; n < 150; n++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 30)); }
    throw new Error('Offline help did not settle.');
  };
  const before = await view.executeJavaScript(`(async () => {
    const picker = document.querySelector('#designer-language'); const previous = picker.value;
    picker.value = 'en'; picker.dispatchEvent(new Event('change', {bubbles:true}));
    for (let i=0;i<100 && document.documentElement.lang!=='en';i++) await new Promise(r=>setTimeout(r,20));
    return {previous, search: document.querySelector('#search').value, configuration: JSON.stringify((await window.z2maDesktop.snapshot()).configuration)};
  })()`);
  view.sendInputEvent({type: 'keyDown', keyCode: 'F1'});
  view.sendInputEvent({type: 'keyUp', keyCode: 'F1'});
  await wait(() => !!current() && current()!.webContents.getURL().includes('/help/en.html') && !current()!.webContents.isLoadingMainFrame());
  const viewer = current()!; const viewerId = viewer.id;
  // A hidden Windows smoke window must reflow like the visible user window.
  viewer.webContents.setBackgroundThrottling(false);
  // Wayland focus is defined only for mapped surfaces; mirror the normal help window.
  if (process.platform === 'linux') { viewer.show(); viewer.focus(); }
  viewer.webContents.focus();
  const initial = await viewer.webContents.executeJavaScript(`(async () => {
    const images=[...document.querySelectorAll('#manual img')]; images.forEach(image=>image.loading='eager');
    for(let i=0;i<150 && !images.every(image=>image.complete && image.naturalWidth>0);i++) await new Promise(r=>setTimeout(r,20));
    return {language:document.documentElement.lang, chapters:document.querySelectorAll('.chapter-anchor').length,
      images:images.length, loaded:images.every(image=>image.naturalWidth>0), bridge:typeof window.z2maDesktop, node:typeof require,
      url:location.href, header:document.documentElement.outerHTML.slice(0,160)};
  })()`);
  if (initial.language !== 'en' || initial.chapters !== 20 || initial.images !== 16 || !initial.loaded || initial.bridge !== 'undefined' || initial.node !== 'undefined') throw new Error('Offline help content or isolation failed: ' + JSON.stringify(initial));
  await verifyHelpLayout(viewer);
  const zoom = await viewer.webContents.executeJavaScript(`(async () => {
    document.querySelector('#manual img').click(); const dialog=document.querySelector('.image-dialog');
    const opened=dialog.open && dialog.querySelector('img').src===document.querySelector('#manual img').src;
    dialog.querySelector('button').click();
    for(let n=0;n<50 && document.activeElement!==document.querySelector('#manual img');n++) await new Promise(resolve=>setTimeout(resolve,20));
    return {opened, closed:!dialog.open, restored:document.activeElement===document.querySelector('#manual img')};
  })()`);
  if (!zoom.opened || !zoom.closed || !zoom.restored) throw new Error('Manual image enlargement or focus restoration failed: ' + JSON.stringify(zoom));
  await viewer.webContents.executeJavaScript("document.querySelector('#help-language').click()");
  await wait(() => !viewer.webContents.isLoadingMainFrame() && viewer.webContents.getURL().includes('/de.html'));
  const translated = await viewer.webContents.executeJavaScript(`(() => {
    document.querySelector('#help-query').value='Fenstergriff'; document.querySelector('#help-search').requestSubmit();
    return {language:document.documentElement.lang, matches:document.querySelectorAll('mark').length, status:document.querySelector('#help-search-status').textContent};
  })()`);
  if (translated.language !== 'de' || !translated.matches || !translated.status.startsWith('Treffer')) throw new Error('Offline manual language/search failed');
  await verifyHelpLayout(viewer);
  view.focus();
  const preserved = await view.executeJavaScript(`(async () => {
    const button=document.querySelector('#desktop-help'); button.blur(); button.focus();
    const tip=document.querySelector('#desktop-tooltip');
    const visible=tip && !tip.hidden && tip.textContent.includes('offline');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    return {visible,dismissed:tip.hidden,active:document.activeElement.id,focused:document.hasFocus(),tip:tip.textContent,search:document.querySelector('#search').value,configuration:JSON.stringify((await window.z2maDesktop.snapshot()).configuration)};
  })()`);
  if (!preserved.visible || !preserved.dismissed || preserved.search !== before.search || preserved.configuration !== before.configuration) throw new Error('Help/tooltip failed: ' + JSON.stringify({...preserved,search:undefined,configuration:undefined,searchPreserved:preserved.search===before.search,configurationPreserved:preserved.configuration===before.configuration}));
  if (!await view.executeJavaScript(`(() => {
    const button=document.querySelector('#desktop-help'); button.blur(); button.focus();
    const dialog=document.createElement('dialog'); const input=document.createElement('input'); dialog.append(input); document.body.append(dialog); dialog.showModal(); input.focus();
    const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}); input.dispatchEvent(escape);
    const allowed=!escape.defaultPrevented && document.querySelector('#desktop-tooltip').hidden;
    dialog.close(); dialog.remove(); return allowed;
  })()`)) throw new Error('A tooltip from the previous control intercepted modal Escape');
  await view.executeJavaScript("document.querySelector('#desktop-help').click()");
  await wait(() => !viewer.webContents.isLoadingMainFrame() && viewer.webContents.getURL().includes('/en.html'));
  if (current()?.id !== viewerId) throw new Error('Help should reuse its window');
  viewer.close();
  await view.executeJavaScript(`(() => {const picker=document.querySelector('#designer-language');picker.value=${JSON.stringify(before.previous)};picker.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  console.log('DESKTOP_HELP_OK offline/de/en/f1/search/images/isolation/tooltips/input-preserved/360/600/1120px/light/dark/wide-font');
}
