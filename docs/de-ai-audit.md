# Инвентаризация визуальных приёмов до правок

Снимок до изменений по задаче. Поиск `rg --json --pcre2` по `src/**/*.{css,ts,tsx}`; число — количество совпадений, не число отображаемых элементов. В минифицированном `src/style.css` одна строка содержит много правил. Границы и круглые формы включают функциональные элементы карты и не означают автоматически декоративность; переопределённые правила учтены. Строки в скобках — число совпадений на строке.

| Категория | Совпадений | Файлы и строки |
|---|---:|---|
| Границы (все CSS-декларации, включая функциональные линии) | 161 | `src/components/ui/ui.css`: 1 (1), 2 (11); `src/style.css`: 4 (30), 8 (7), 9 (6), 10 (4), 11 (15), 13 (10), 15 (1), 22 (2), 24 (4); `src/styles/advanced.css`: 1 (4), 2 (3), 3 (5), 4 (2), 5 (3), 6 (1), 7 (4); `src/styles/map.css`: 3 (1), 4 (2), 6 (2), 7 (9), 8 (1), 9 (2); `src/styles/motion.css`: 15 (1); `src/styles/surroundings.css`: 1 (1), 2 (1), 3 (2), 4 (6), 5 (12), 6 (4), 7 (2), 8 (2) |
| Радиусы больше 6 px и круглые формы | 26 | `src/components/ui/ui.css`: 2 (1); `src/style.css`: 4 (9), 9 (2), 13 (1); `src/styles/advanced.css`: 1 (1), 2 (1), 3 (1), 4 (1); `src/styles/map.css`: 4 (1), 6 (1), 7 (1), 9 (1); `src/styles/motion.css`: 15 (1); `src/styles/surroundings.css`: 2 (1), 6 (2), 7 (1) |
| Тени и свечение: декларации и inline | 17 | `src/App.tsx`: 41 (1); `src/style.css`: 4 (6), 10 (1), 13 (5); `src/styles/map.css`: 6 (1), 7 (1), 14 (1); `src/styles/surroundings.css`: 2 (1) |
| Backdrop-filter | 0 | не найдено |
| Градиенты | 4 | `src/styles/map.css`: 2 (4) |
| Цветные левые полосы: border-left | 17 | `src/style.css`: 4 (3), 9 (1), 10 (2), 11 (2); `src/styles/advanced.css`: 1 (1), 2 (1), 3 (1), 4 (1), 5 (1), 7 (2); `src/styles/surroundings.css`: 6 (1), 7 (1) |
| Uppercase в CSS | 1 | `src/style.css`: 11 (1) |
| Разрядка | 22 | `src/style.css`: 4 (11), 8 (1), 9 (1), 11 (4), 13 (1), 15 (1); `src/styles/map.css`: 3 (1), 5 (1); `src/styles/surroundings.css`: 2 (1) |
| Старые шрифты и system-ui (имена и пути пакетов) | 8 | `src/main.tsx`: 1–5 (5 импортов); `src/styles/tokens.css`: 21 (2), 22 (1) |
| Скруглённые бейджи rounded-full | 0 | не найдено |
| Pulse/glow/shimmer/flash/infinite | 22 | `src/App.tsx`: 97 (4); `src/components/ui/ui.css`: 2 (3); `src/style.css`: 4 (3), 13 (3); `src/styles/advanced.css`: 2 (1); `src/styles/map.css`: 6 (3); `src/styles/motion.css`: 7 (1), 15 (2), 16 (1), 20 (1) |
| Шаблонные формулировки | 3 | `src/App.tsx`: 140 (2); `src/components/MapSurroundings.tsx`: 27 (1) |
| Эмодзи | 0 | не найдено |

Дополнительная ручная классификация:
- Градиенты вне функциональной сетки: 2 радиальных пятна. Всего четыре определения в `src/styles/map.css:2`: две линии сетки и два статичных фоновых пятна. За пределами сцены карты совпадений нет.
- Роль/позиция используют `Badge` с фоном в `src/components/MapSurroundings.tsx`; `rounded-full` не найден. Круглые аватары и узлы — элементы идентификации и карты, а не статусные таблетки.
- Цветные контейнеры иконок: 0 фактически используемых цветных квадратов с иконкой; 4 места с круглыми аватарами (`profile-avatar` — 1, `mini-avatar` — 3). Исторические `company-icon`, `risk-symbol`, `mini-avatar` в `src/style.css` и `src/styles/surroundings.css`; часть CSS относится к более не используемым вариантам. В новых risk-card и proposal-top иконки стоят перед содержимым; они обозначают тип сигнала/предложения.
- Тени blur > 8 px: 8 определений, включая inline-свечение узлов и тень с `var(--space-5)` (24 px); присутствуют, в частности, в `.live-dot`, `.panel`, `.map-empty`, `.tour-card`, `.tour-spotlight`, `.on-path`; также inline-свечение узлов задаётся в `src/App.tsx`. `drop-shadow` в `src/styles/map.css` имеет blur 3 px и обозначает клавиатурный фокус.
- Капс в разметке присутствует непосредственно строками, в том числе в `src/App.tsx`, `src/components/TimeControls.tsx`, `Incoming.tsx`, `Integration.tsx`, `MeetingBrief.tsx`, `DemoTour.tsx`, а не только через `text-transform`.
- Эмодзи в диапазоне U+1F300–U+1FAFF поиском не обнаружены; декоративные символы `✳`, `◆`, `✦`, `▦`, `⌕`, стрелки и знаки встречаются в разметке и требуют отдельной оценки. Пустые состояния используют линейные иконки lucide (`MapSurroundings.tsx`).
- «Что делать» — подписи раскрытия рекомендаций риска, другие заданные примеры шаблонных фраз не найдены.
