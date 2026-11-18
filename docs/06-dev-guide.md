# Руководство разработчика

Требования проекта: Node.js 22 и pnpm 10 (`README.md`); тесты импортируют TypeScript напрямую через Node. Установка: `pnpm install --frozen-lockfile`. При блокировке сценариев PowerShell используйте `pnpm.cmd`.

| Скрипт в package.json | Действие |
|---|---|
| `npm run dev` | Vite с прослушиванием 0.0.0.0 |
| `npm run build` | `tsc -b`, затем production-сборка Vite |
| `npm test` | `node --test tests/*.test.mjs` |

`src/api/` — имитация CRM, `src/data/` — JSON, `src/lib/` — вычисления, `src/components/` — экранные компоненты и UI, `src/styles/` — CSS и токены; `src/types.ts` содержит модель, `src/App.tsx` — главный экран, `src/main.tsx` — точку входа. Строгая типизация и правила оформления описаны в `AGENTS.md`, параметры сборки — в `tsconfig.json` и `vite.config.ts`. При разработке соблюдайте правила доступности и reduced motion из `AGENTS.md`.

## Расширение

1. Новый клиент: добавьте Company и связанные записи с уникальными id в `src/data/crm.json`, убедитесь в совпадении companyId и personId; добавьте снимки для истории. Клиент по умолчанию задан в `src/App.tsx`.
2. Новая линза: расширьте Lens, lensOptions и lensRing в `src/lib/lenses.ts`, проверьте отображение и тесты. Секции по подразделениям остаются в `src/App.tsx`.
3. Новый тип связи: расширьте RelationType и relationTypes в `src/types.ts`, проверьте форму и стили рёбер в `src/App.tsx`, разбор текста в `src/lib/llmExtractor.ts`, сравнение в `src/lib/crmDiff.ts` и тесты.
4. Новое поле человека: обновите `src/types.ts`, исходный JSON, форму и начальные значения в `src/App.tsx`, карточку `src/components/MapSurroundings.tsx`, отображение diff в `src/lib/crmDiff.ts`, снимки и сравнение в `src/lib/history.ts`, при необходимости миграцию в `src/api/crmApi.ts` и тестовые фикстуры. Проверьте старый localStorage.

Тесты и ручной чек-лист описаны в `docs/07-testing.md`. Если pnpm не найден, проверьте PATH и версию. Если PowerShell блокирует pnpm.ps1, вызовите pnpm.cmd. Если данные кажутся устаревшими, учитывайте рабочую и базовую копии localStorage (`src/api/crmApi.ts`).
