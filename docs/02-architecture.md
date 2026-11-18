# Архитектура

`package.json` задаёт React 19, TypeScript, Vite, `@xyflow/react`, Zustand, Tailwind и CSS. Их использование видно в `src/App.tsx`, `src/main.tsx`, `vite.config.ts`; причины выбора автора требуют уточнения.

```mermaid
flowchart LR
  UI[React App и компоненты] --> Store[Zustand: CRMData]
  UI --> Logic[Расчёты src/lib]
  UI --> Graph[React Flow]
  Store --> API[crmApi]
  API --> Storage[localStorage]
  API --> Seed[crm.json]
  UI --> Styles[CSS и токены]
```

`src/main.tsx` подключает шрифты, тему и React. `src/App.tsx` загружает данные, хранит состояние интерфейса и формирует узлы и рёбра; Zustand содержит `data` и `setData`. `src/lib/` содержит расчёты, `src/components/` — интерфейс, `src/styles/tokens.css` — токены.

```mermaid
sequenceDiagram
  participant U as Пользователь
  participant A as App
  participant C as crmApi
  participant S as localStorage или JSON
  A->>C: load()
  C->>S: прочитать данные
  S-->>C: CRMData
  C-->>A: CRMData
  U->>A: выбрать компанию и линзу
  A->>A: отбор, кольца и координаты
  A-->>U: карта React Flow
```

```mermaid
sequenceDiagram
  participant U as Пользователь
  participant A as App
  participant C as crmApi
  participant S as localStorage
  U->>A: сохранить контакт
  A->>A: обновить состояние и добавить снимок
  A->>C: save(CRMData)
  C->>S: записать рабочие данные
  C-->>A: завершение
```

Исходная загрузка показывает skeleton, при переключении клиента также есть временный skeleton (`src/components/LoadingSkeleton.tsx`, `src/App.tsx`). При ошибке разбора сохранённого JSON слой данных возвращает исходное состояние; начальная загрузка и сохранение не имеют общего обработчика ошибок, а раздел CRM отдельно показывает ошибки (`src/api/crmApi.ts`, `src/components/Integration.tsx`).

Применяются `memo`, `useMemo`, анимация позиций, React Flow и подсветка соседей через DOM (`src/App.tsx`). Раскладка проверяет пересечения; тестируется плотное размещение, но гарантий производительности для 40+ узлов нет (`src/lib/orbitLayout.ts`, `tests/orbitLayout.test.mjs`).
