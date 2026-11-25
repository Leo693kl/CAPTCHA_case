import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import '../styles/map-evidence.css';

const steps = [
  {
    role: 'Карта',
    title: 'Прочитайте легенду',
    text: 'Размер узла показывает влияние, заливка — теплоту, обводка — позицию. Звезда отмечает ЛПР. Толщина ребра показывает силу связи, пунктир — её тип или маршрут. Откройте легенду для образцов.',
    target: '[data-tour="legend"], .map-legend',
  },
  {
    role: 'Маркетинг и производство',
    title: 'Смените линзу',
    text: 'В «Маркетинге» кольца показывают согласие и интересы. В «Технологиях» они помогают найти технических экспертов. Откройте карточку человека, чтобы проверить детали.',
    target: '[data-tour="lenses"]',
  },
  {
    role: 'Проектный офис',
    title: 'Посмотрите историю клиента',
    text: 'Откройте «Историю карты» и выберите дату. Карта покажет снимки людей и касания на этот день. Линии между людьми взяты из текущей CRM.',
    target: '[data-tour="history"]',
  },
  {
    role: 'Ввод наблюдения',
    title: 'Добавьте интервью или обратную связь',
    text: 'Откройте «Входящие» для выбранного клиента. Выберите контакт и проверьте исходный фрагмент перед сохранением. После подтверждения запись можно открыть на карте.',
    target: '[data-tour="observation-entry"]',
    fallback: '.header-nav button:nth-child(2)',
  },
  {
    role: 'Продажи и руководитель',
    title: 'Оцените охват и найдите точку входа',
    text: 'Откройте индекс охвата, чтобы увидеть его составляющие. В сигналах проверьте зависимость от одного тёплого ЛПР. В «Маршруте знакомства» выберите контакт, к которому хотите выйти.',
    target: '[data-tour="coverage"]',
  },
] as const;

export function DemoTour({ step, onStep, onClose }: { step: number; onStep: (step: number) => void; onClose: () => void }) {
  const [layout, setLayout] = useState<{ rect: DOMRect | null; cardHeight: number }>({ rect: null, cardHeight: 0 });
  const dialog = useRef<HTMLDivElement>(null);
  const current = steps[step];
  const last = step === steps.length - 1;
  const next = () => last ? onClose() : onStep(step + 1);

  useLayoutEffect(() => {
    const preferred = document.querySelector(current.target);
    const anchor = preferred?.getClientRects().length ? preferred
      : 'fallback' in current ? document.querySelector(current.fallback) : null;
    const card = dialog.current;
    if (!card) return;

    const measure = () => setLayout({ rect: anchor?.getBoundingClientRect() ?? null, cardHeight: card.offsetHeight });
    anchor?.scrollIntoView({ block: 'center', behavior: 'instant' });
    measure();
    card.querySelector<HTMLButtonElement>('[data-tour-next]')?.focus({ preventScroll: true });
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    if (anchor) observer.observe(anchor);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [current]);

  const { rect, cardHeight } = layout;
  const inset = 16;
  const gap = 8;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const cardWidth = Math.min(390, viewportWidth - 2 * inset);
  const left = Math.max(0, (rect?.left ?? 0) - gap);
  const top = Math.max(0, (rect?.top ?? 0) - gap);
  const right = Math.min(viewportWidth, (rect?.right ?? 0) + gap);
  const bottom = Math.min(viewportHeight, (rect?.bottom ?? 0) + gap);
  const cardLeft = Math.max(inset, Math.min(viewportWidth - cardWidth - inset, rect?.left ?? inset));
  const below = bottom + inset;
  const above = top - cardHeight - inset;
  const cardTop = below + cardHeight <= viewportHeight - inset ? below : Math.max(inset, above);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft' && step > 0) onStep(step - 1);
    }
    if (event.key === 'Tab') {
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0];
      const final = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        final.focus();
      } else if (!event.shiftKey && document.activeElement === final) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return <div className="tour-overlay" onKeyDown={onKeyDown}>
    <div className="tour-blocker" aria-hidden="true"/>
    {rect && right > left && bottom > top && <div className="tour-spotlight"
      style={{ left, top, width: right - left, height: bottom - top }} aria-hidden="true"/>}
    <div className="tour-card map-tour-card" ref={dialog} role="dialog" aria-modal="true"
      aria-labelledby="tour-title" aria-describedby="tour-description" style={{ top: cardTop, left: cardLeft, width: cardWidth }}>
      <div className="tour-kicker"><span>{current.role}</span><span>{step + 1} / {steps.length}</span></div>
      <h2 id="tour-title">{current.title}</h2>
      <p id="tour-description">{current.text}</p>
      <div className="tour-controls">
        <button onClick={onClose}>Завершить</button>
        <div>
          <button disabled={step === 0} onClick={() => onStep(step - 1)}>Назад</button>
          <button className="primary" data-tour-next onClick={next}>{last ? 'Готово' : 'Далее'}</button>
        </div>
      </div>
      <small className="record-meta"><span>← → Между шагами</span><span>Esc Закрыть</span></small>
    </div>
  </div>;
}
