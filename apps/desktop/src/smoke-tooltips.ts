import type {WebContents} from 'electron';

// Real renderer mouse/key events and computed styles; no image capture.
export async function smokeTooltips(view: WebContents): Promise<void> {
  const started = Date.now();
  const trace = (phase: string): void => console.log('DESKTOP_TOOLTIPS_STEP ' + JSON.stringify({phase, elapsedMs: Date.now() - started}));
  const backgroundThrottling = view.getBackgroundThrottling();
  view.setBackgroundThrottling(false);
  view.focus();
  const wait = async (source: string, reason: string): Promise<void> => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await view.executeJavaScript(source)) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const state = await view.executeJavaScript("(() => {const tip=document.querySelector('#desktop-tooltip');const target=document.querySelector('#tooltip-smoke-summary');return {hidden:tip.hidden,text:tip.textContent,active:document.activeElement.id,focused:document.hasFocus(),mapped:target?.matches('[data-section=triggers] summary'),rect:target?.getBoundingClientRect().toJSON()};})()");
    throw new Error('Tooltip smoke: ' + reason + ': ' + JSON.stringify(state));
  };
  const move = async (selector: string, offset = 0): Promise<{x: number; y: number}> => {
    const point = await view.executeJavaScript(`(() => {const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(rect.left+rect.width/2)+${offset},y:Math.round(rect.top+rect.height/2)};})()`);
    view.sendInputEvent({type: 'mouseMove', ...point}); return point;
  };
  const hasHint = (text: string) => `(() => {const tip=document.querySelector('#desktop-tooltip');return !tip.hidden && tip.textContent===${JSON.stringify(text)};})()`;
  const hidden = "document.querySelector('#desktop-tooltip').hidden";
  const remainsHidden = async (milliseconds: number): Promise<void> => {
    const end = Date.now() + milliseconds;
    do {
      if (!await view.executeJavaScript(hidden)) throw new Error('Tooltip smoke: a dismissed or cancelled hint reappeared');
      await new Promise(resolve => setTimeout(resolve, 20));
    } while (Date.now() < end);
  };
  let previous = 'en';
  try {
    previous = await view.executeJavaScript(`(async () => {
      const {bindAttribute,t}=await import('./localization.js');
      const fixture=document.createElement('section'); fixture.id='tooltip-smoke'; fixture.dataset.section='triggers';
      fixture.style.cssText='position:fixed;top:180px;left:8px;z-index:20000;padding:8px;display:flex;align-items:center;gap:12px;background:var(--surface)';
      const empty=document.createElement('span'); empty.id='tooltip-smoke-empty'; empty.textContent='·'; empty.style.cssText='display:block;width:24px;height:32px';
      const details=document.createElement('details'); const summary=document.createElement('summary'); summary.id='tooltip-smoke-summary'; summary.textContent='Tooltip probe'; details.append(summary);
      const native=document.createElement('button'); native.id='tooltip-smoke-native'; native.type='button';
      native.innerHTML='<span id="tooltip-smoke-first">A</span> <span id="tooltip-smoke-second">B</span>';
      native.setAttribute('aria-describedby','tooltip-smoke-context');
      bindAttribute(native,'title',()=>t('ui.create.a.new.action.sequence.26a16dfc'));
      const disabled=document.createElement('button'); disabled.id='tooltip-smoke-disabled'; disabled.type='button'; disabled.textContent='Disabled'; disabled.disabled=true;
      bindAttribute(disabled,'title',()=>t('desktop.tip.readOnly'));
      const context=document.createElement('span'); context.id='tooltip-smoke-context'; context.textContent='Synthetic context'; context.hidden=true;
      fixture.append(empty,details,native,disabled,context); document.body.append(fixture);
      return document.querySelector('#designer-language').value;
    })()`);
    for (const language of ['en', 'de']) {
      const expected = await view.executeJavaScript(`(async () => {
        const picker=document.querySelector('#designer-language');picker.value=${JSON.stringify(language)};picker.dispatchEvent(new Event('change',{bubbles:true}));
        const {t}=await import('./localization.js');
        document.querySelector('#tooltip-smoke-summary').focus();
        return {trigger:t('desktop.tip.triggers'),native:t('ui.create.a.new.action.sequence.26a16dfc'),disabled:t('desktop.tip.readOnly'),workingCopy:t('desktop.tip.workingCopy')};
      })()`);
      await wait(hasHint(expected.trigger), 'keyboard focus should show mapped help');
      trace(language + '-focus');
      const referenceFont = await view.executeJavaScript("getComputedStyle(document.querySelector('#desktop-tooltip')).font");
      // Exercise shared pointer/timing behavior once; repeat the localized
      // keyboard/title/modal checks in German within the existing smoke budget.
      if (language === 'en') {
        const point = await move('#tooltip-smoke-summary');
        view.sendInputEvent({type: 'mouseDown', button: 'left', clickCount: 1, ...point});
        view.sendInputEvent({type: 'mouseUp', button: 'left', clickCount: 1, ...point});
        await wait(hidden, 'click should dismiss the current hint');
        await move('#tooltip-smoke-summary', 2);
        await wait(hasHint(expected.trigger), 'moving inside the same focused control should restore hover help');
        trace(language + '-click-hover');
        await view.executeJavaScript("document.querySelector('#tooltip-smoke-summary').blur()");
        await move('#tooltip-smoke-empty'); await wait(hidden, 'leaving a control should dismiss its hint');
        await move('#tooltip-smoke-first');
        await wait(hasHint(expected.native), 'native title should use the app tooltip');
        if (!await view.executeJavaScript(`!document.querySelector('#tooltip-smoke-native').hasAttribute('title') && getComputedStyle(document.querySelector('#desktop-tooltip')).font===${JSON.stringify(referenceFont)}`)) throw new Error('Tooltip smoke: native and mapped help must use the same font');
        await move('#tooltip-smoke-second');
        await wait(hasHint(expected.native), 'moving between child spans must retain the hint');
        await move('#desktop-tooltip');
        await new Promise(resolve => setTimeout(resolve, 180));
        await wait(hasHint(expected.native), 'the tooltip must remain hoverable');
        await view.executeJavaScript("(() => {const button=document.querySelector('#tooltip-smoke-native');button.title='Superseded hint';button.title='Updated synthetic hint'})()");
        await wait(hasHint('Updated synthetic hint'), 'title updates should refresh the visible hint');
        await view.executeJavaScript("document.querySelector('#tooltip-smoke-native').title=" + JSON.stringify(expected.native));
        await wait(hasHint(expected.native), 'the original localized title should remain available');
        trace(language + '-native-title');
        await move('#tooltip-smoke-empty'); await wait(hidden, 'leaving the tooltip should dismiss it');
        await move('#tooltip-smoke-disabled');
        await wait(hasHint(expected.disabled), 'disabled controls should retain their explanation');
        await move('#tooltip-smoke-empty'); await wait(hidden, 'disabled hint should dismiss');
        await view.executeJavaScript("(() => {const button=document.querySelector('#tooltip-smoke-native');button.blur();button.focus()})()");
        await wait(hasHint(expected.native), 'native title should also support keyboard focus');
        view.sendInputEvent({type: 'keyDown', keyCode: 'Escape'}); view.sendInputEvent({type: 'keyUp', keyCode: 'Escape'});
        await wait(hidden, 'Escape should dismiss the hint');
        if (!await view.executeJavaScript("document.querySelector('#tooltip-smoke-native').getAttribute('aria-describedby')==='tooltip-smoke-context'")) throw new Error('Tooltip smoke: preserve existing accessibility descriptions');
        await move('#tooltip-smoke-native');
        await remainsHidden(450);
        await move('#tooltip-smoke-empty');
        await move('#tooltip-smoke-native');
        await move('#tooltip-smoke-empty');
        await remainsHidden(450);
      } else {
        await view.executeJavaScript("document.querySelector('#tooltip-smoke-native').focus()");
        await wait(hasHint(expected.native), 'German native titles should update on keyboard focus');
        if (!await view.executeJavaScript(`!document.querySelector('#tooltip-smoke-native').hasAttribute('title') && getComputedStyle(document.querySelector('#desktop-tooltip')).font===${JSON.stringify(referenceFont)}`)) throw new Error('Tooltip smoke: German native and mapped hints must use the same font');
        view.sendInputEvent({type: 'keyDown', keyCode: 'Escape'}); view.sendInputEvent({type: 'keyUp', keyCode: 'Escape'});
        await wait(hidden, 'Escape should dismiss German title help');
      }
      await view.executeJavaScript("document.querySelector('#desktop-nav-draft').focus()");
      await wait(hasHint(expected.workingCopy), 'working-copy navigation should explain its purpose');
      trace(language + '-keyboard');
      const modal = await view.executeJavaScript(`(async () => {
        const {bindAttribute,t}=await import('./localization.js');
        const dialog=document.createElement('dialog'); dialog.id='tooltip-smoke-modal'; dialog.className='creation-dialog'; dialog.style.cssText='font:700 28px monospace';
        const button=document.createElement('button');button.id='tooltip-smoke-modal-button';button.type='button';button.textContent='Modal probe';
        bindAttribute(button,'title',()=>t('desktop.tip.export'));dialog.append(button);document.querySelector('#tooltip-smoke').append(dialog);dialog.showModal();button.blur();button.focus();
        return t('desktop.tip.export');
      })()`);
      await wait(hasHint(modal), 'new modal controls should show help immediately on focus');
      if (!await view.executeJavaScript(`document.querySelector('#desktop-tooltip').parentElement.id==='tooltip-smoke-modal' && getComputedStyle(document.querySelector('#desktop-tooltip')).font===${JSON.stringify(referenceFont)}`)) throw new Error('Tooltip smoke: modal help must retain the same font in the top layer');
      if (!await view.executeJavaScript("(() => {const tip=document.querySelector('#desktop-tooltip');const rect=tip.getBoundingClientRect();return tip.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2))})()")) throw new Error('Tooltip smoke: modal help must be visible to the pointer');
      view.sendInputEvent({type: 'keyDown', keyCode: 'Escape'}); view.sendInputEvent({type: 'keyUp', keyCode: 'Escape'});
      await wait(hidden, 'Escape should dismiss modal help');
      if (!await view.executeJavaScript("document.querySelector('#tooltip-smoke-modal').open")) throw new Error('Tooltip smoke: first Escape should keep the dialog open');
      view.sendInputEvent({type: 'keyDown', keyCode: 'Escape'}); view.sendInputEvent({type: 'keyUp', keyCode: 'Escape'});
      await wait("!document.querySelector('#tooltip-smoke-modal').open", 'second Escape should reach the dialog');
      await view.executeJavaScript("document.querySelector('#tooltip-smoke-modal').remove();document.activeElement?.blur()");
      trace(language + '-modal');
      if (language === 'en') {
        await view.executeJavaScript("(() => {const button=document.querySelector('#tooltip-smoke-native');button.style.cssText='position:fixed;right:8px;top:180px';button.title='Short';button.focus()})()");
        await wait(hasHint('Short'), 'short edge hint should open');
        await view.executeJavaScript("document.querySelector('#tooltip-smoke-native').title=" + JSON.stringify(expected.trigger));
        await wait(hasHint(expected.trigger), 'long edge hint should update');
        if (!await view.executeJavaScript("(() => {const rect=document.querySelector('#desktop-tooltip').getBoundingClientRect();return rect.left>=7 && rect.right<=document.documentElement.clientWidth-7})()")) throw new Error('Tooltip smoke: keep long hints inside the viewport margin');
        await view.executeJavaScript("(() => {const button=document.querySelector('#tooltip-smoke-native');button.style.cssText='';button.title=" + JSON.stringify(expected.native) + "})()");
      }
    }
  } finally {
    await view.executeJavaScript(`(() => {document.querySelector('#tooltip-smoke-modal')?.close();document.querySelector('#tooltip-smoke')?.remove();const picker=document.querySelector('#designer-language');picker.value=${JSON.stringify(previous)};picker.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    view.setBackgroundThrottling(backgroundThrottling);
  }
  console.log('DESKTOP_TOOLTIPS_OK ' + JSON.stringify({languages: ['en', 'de'], mouse: true, keyboard: true, nativeTitles: true, uniformFont: true, disabled: true, dialogs: true, elapsedMs: Date.now() - started}));
}
