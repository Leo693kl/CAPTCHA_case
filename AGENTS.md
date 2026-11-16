# Проект: «Карта ЛПР» (кейс КРОК, КАПЧА)

## Источник требований
Единственный источник истины: docs/case.pdf (текстовая копия: docs/case.md).
Перед ЛЮБОЙ задачей перечитай docs/case.md, особенно разделы
«Минимальный функционал», «Дополнительный функционал» и «Ожидаемое решение».
Если задача противоречит кейсу, остановись и сообщи об этом.
Если текст в case.md выглядит повреждённым, сверься с docs/case.pdf.




## Цель
Кликабельный прототип страницы «Карта ЛПР», которая открывается из карточки
компании в CRM. Показывает структуру принятия решений и отношений, а не оргструктуру.

## Стек
Vite, React, TypeScript, Tailwind, @xyflow/react, Zustand. Без бэкенда:
слой src/api/crmApi.ts имитирует REST CRM (async, задержка 150–400 мс),
данные в src/data/*.json, правки в localStorage.

## Правила
- Строгий TypeScript, без any. Компоненты маленькие, логика графа в src/lib/.
- Интерфейс на русском. Даты в формате ДД.ММ.ГГГГ.
- Никаких дефолтных «шаблонных» градиентов и фиолетово-синего AI-стиля.
- После каждой задачи: npm run build без ошибок, краткий отчёт что изменено.
- Не менять файлы вне задачи. Не добавлять зависимости без причины.
- Доступность: контраст, фокус с клавиатуры, aria-label на узлах.

## Доменная модель
Company, Person (department, title, decisionRole: decision_maker | influencer |
evaluator | user | blocker, stance: champion | supporter | neutral | skeptic,
influence 1–5, interests[], consentMarketing), Relation (from, to, type:
reports_to | works_with | informal, strength 1–5), Interaction (personId, date,
channel, ourOwner, ourDepartment, summary, sentiment), PersonSnapshot для истории.