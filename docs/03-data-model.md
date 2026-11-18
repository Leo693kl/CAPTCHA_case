# Модель данных

Типы описаны в `src/types.ts`. Все идентификаторы — строки; даты в данных — строки вида YYYY-MM-DD. Числовые ограничения применяются в формах, но сами типы TypeScript не ограничивают диапазон.

| Сущность | Поля и смысл |
|---|---|
| Company | `id`, `name`, `industry`, `initiative`, `description`: идентификатор, имя, отрасль, инициатива, описание; все string |
| Person | `id`, `companyId`, `name`, `department`, `title`, `owner`: string; `decisionRole`: Role; `stance`: Stance; `influence`, `warmth`: number; `interests`: string[]; `consentMarketing`: boolean |
| Relation | `id`, `companyId`, `from`, `to`: string; `type`: RelationType; `strength`: number |
| Interaction | `id`, `personId`, `date`, `channel`, `ourOwner`, `ourDepartment`, `summary`, `sentiment`: string |
| PersonSnapshot | `personId`, `date`: string; `person`: Person; `deleted?`: boolean |
| CRMData | массивы `companies`, `people`, `relations`, `interactions`, `snapshots` соответствующих сущностей |

Role: `decision_maker`, `influencer`, `evaluator`, `user`, `blocker`. Stance: `champion`, `supporter`, `neutral`, `skeptic`. RelationType: `reports_to`, `works_with`, `informal`. В формах оценки — 1–5; подразделения: ИТ, ИБ, Закупки, Финансы, Бизнес, Прочее (`src/types.ts`, `src/App.tsx`). Отдельной сущности Observation нет.

```mermaid
erDiagram
  Company ||--o{ Person : contains
  Company ||--o{ Relation : contains
  Person ||--o{ Interaction : receives
  Person ||--o{ PersonSnapshot : has
  Person ||--o{ Relation : from
  Person ||--o{ Relation : to
```

Пример реального контакта из `src/data/crm.json`:

```json
{"id":"bank-p0","companyId":"bank","name":"Александр Белов","department":"ИТ","title":"Руководитель ИТ-направления","decisionRole":"decision_maker","stance":"champion","influence":1,"warmth":4,"owner":"Ирина Белова","interests":["Цифровая трансформация","Надёжность"],"consentMarketing":false}
```

В файле три компании, 90 контактов, 87 связей, 270 взаимодействий и 103 снимка: на каждую компанию приходится по 30 контактов, 29 связей и 90 взаимодействий (`src/data/crm.json`). Банк демонстрирует облачную платформу, ритейл — платформу данных, промышленная группа — модернизацию инфраструктуры; подробные авторские замыслы сценариев требуют уточнения.

При создании контакта форма требует имя, должность и владельца; форма связи запрещает выбрать одного человека дважды. Удаление человека удаляет его текущие связи и добавляет снимок удаления, но не удаляет взаимодействия (`src/App.tsx`). Импортированные и сохранённые JSON-данные не проходят полную runtime-валидацию; некорректный JSON заменяется базовыми данными при обработке ошибки (`src/api/crmApi.ts`).
