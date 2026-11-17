import type {BrowserWindow, WebContents} from 'electron';

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
  viewer.setContentSize(360, 700);
  await new Promise(resolve => setTimeout(resolve, 100));
  if (!await viewer.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth + 2')) throw new Error('Offline help overflow at 360px');
  view.focus();
  const preserved = await view.executeJavaScript(`(async () => {
    document.querySelector('#desktop-help').focus();
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
  console.log('DESKTOP_HELP_OK offline/de/en/f1/search/images/isolation/tooltips/input-preserved/360px');
}
