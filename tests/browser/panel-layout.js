async page => {
  const base = 'http://127.0.0.1:4188/?company=bank&demo=2026-11-19';
  const sizes = [[320, 700], [390, 844], [1366, 768], [1920, 1080], [2560, 1440]];
  const panel = page.locator('.app > .panel');
  const closePanel = panel.getByRole('button', { name: 'Закрыть панель' });
  const opener = page.locator('[data-id="bank-p3"] .person-hit');
  const mapTools = page.locator('#map-tool-panel');
  const results = [];

  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const checkWidth = async (surface, label) => {
    const size = await surface.evaluate(element => ({
      window: document.documentElement.scrollWidth - innerWidth,
      surface: element.scrollWidth - element.clientWidth,
    }));
    check(size.window <= 1 && size.surface <= 1, `${label}: переполнение ${JSON.stringify(size)}`);
  };

  page.setDefaultTimeout(8000);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await opener.press('Enter');
    await panel.getByRole('heading', { name: 'Анна Орлова', exact: true }).waitFor();
    if (width >= 1366) {
      await page.waitForFunction(() => {
        const label = document.querySelector('[data-id="bank-p3"] .node-name');
        const area = label?.closest('.map-area');
        if (!label || !area) return false;
        const l = label.getBoundingClientRect();
        const a = area.getBoundingClientRect();
        return l.width > 0 && l.left >= a.left && l.right <= a.right && l.top >= a.top && l.bottom <= a.bottom;
      });
    }

    const related = panel.locator('.contact-related-row').first();
    await related.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const row = await related.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const text = element.querySelector('strong').getBoundingClientRect();
      const arrow = element.querySelector('svg').getBoundingClientRect();
      return {
        left: text.left - bounds.left,
        right: bounds.right - arrow.right,
        focus: document.activeElement === element && element.matches(':focus-visible'),
        outline: getComputedStyle(element).outlineStyle,
      };
    });
    check(row.left >= 12 && row.right >= 12 && row.focus && row.outline === 'solid', `${width}: строка и фокус ${JSON.stringify(row)}`);
    await checkWidth(panel, `${width}: карточка`);

    if (width <= 560) {
      await closePanel.focus();
      await page.keyboard.press('Shift+Tab');
      check(await panel.evaluate(el => el.contains(document.activeElement)), `${width}: фокус ушёл под карточку`);
      await page.keyboard.press('Tab');
      check(await closePanel.evaluate(el => el === document.activeElement), `${width}: фокус не замкнулся`);
      check(await page.locator('.map-main').evaluate(el => el.inert), `${width}: карта доступна под карточкой`);
    }

    await panel.getByText('Все связанные контакты', { exact: true }).click();
    const last = panel.locator('.contact-related details .contact-related-row').last();
    await last.scrollIntoViewIfNeeded();
    const nextName = await last.locator('strong').innerText();
    await last.click();
    await panel.getByRole('heading', { name: nextName, exact: true }).waitFor();
    check(await panel.evaluate(el => el.scrollTop === 0), `${width}: следующая карточка открылась не с начала`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.closest('[data-id="bank-p3"]') !== null);

    const history = page.getByRole('button', { name: 'История карты', exact: true });
    await history.click();
    const closeHistory = mapTools.getByRole('button', { name: 'Закрыть: История карты' });
    await closeHistory.waitFor();
    await checkWidth(mapTools, `${width}: история`);
    if (width <= 560) {
      await closeHistory.focus();
      await page.keyboard.press('Shift+Tab');
      check(await mapTools.evaluate(el => el.contains(document.activeElement)), `${width}: фокус ушёл под историю`);
      await page.keyboard.press('Tab');
      check(await closeHistory.evaluate(el => el === document.activeElement), `${width}: фокус истории не замкнулся`);
    }
    await mapTools.locator('#history-date').fill('2026-11-10');
    await mapTools.getByRole('button', { name: 'Показать на карте' }).click();
    await mapTools.getByRole('status').getByText('10.11.2026').waitFor();
    await mapTools.getByRole('button', { name: 'Вернуться к текущей карте' }).click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.id === 'map-tool-history');

    await page.getByRole('button', { name: 'Коммуникации', exact: true }).click();
    await mapTools.getByRole('heading', { name: 'Каналы' }).waitFor();
    await checkWidth(mapTools, `${width}: коммуникации`);
    await mapTools.getByRole('button', { name: '90 дней' }).click();
    await checkWidth(mapTools, `${width}: коммуникации за 90 дней`);
    await page.keyboard.press('Escape');

    const filters = page.getByRole('button', { name: 'Легенда и фильтры' });
    if (await filters.isVisible()) await filters.click();
    await page.getByRole('textbox', { name: 'Поиск по имени' }).fill('Контактнеизвестный');
    if (width <= 560) {
      await checkWidth(page.locator('#map-sidebar'), `${width}: фильтры`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.activeElement.id === 'open-map-sidebar');
    }
    await page.getByText('По фильтрам контактов нет', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
    await page.getByRole('button', { name: 'Все связи', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge').length === 29);
    results.push({ width, height, row });
  }

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(base);
  const nav = page.getByRole('navigation', { name: 'Разделы приложения' });
  await nav.getByRole('button', { name: 'Входящие' }).click();
  await page.getByRole('button', { name: 'Подставить пример' }).click();
  await page.getByRole('button', { name: 'Разобрать текст' }).click();
  await nav.locator('.pending-count').waitFor();
  await nav.getByRole('button', { name: 'CRM', exact: true }).click();
  await page.getByRole('heading', { name: 'Интеграция с CRM' }).waitFor();
  await page.getByRole('button', { name: 'Горячие клавиши' }).click();
  const shortcuts = page.getByRole('dialog', { name: 'Горячие клавиши' });
  await shortcuts.waitFor();
  await checkWidth(shortcuts, '320: горячие клавиши');
  await page.keyboard.press('Escape');

  return results;
}
