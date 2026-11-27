import type { ReactNode } from 'react';
import { ArrowRight, FilePenLine, MapPin, UserRoundCheck } from 'lucide-react';
import type { DemoScenario } from '../api/demoSession';
import { Button } from './ui';

const scenarios = {
 contact: { title:'Найти контакт', description:'Выберите подразделение и узнайте роль и последнее касание человека.', action:'Открыть карту', icon:MapPin },
 observation: { title:'Добавить наблюдение', description:'Сохраните интервью Титова, проверьте сигнал на карте и предпросмотр CRM.', action:'Открыть карточку Титова', icon:FilePenLine },
 hypothesis: { title:'Проверить гипотезу о ЛПР', description:'Посмотрите основание и сравните результат двух решений по Ершову.', action:'Открыть кандидата', icon:UserRoundCheck },
} satisfies Record<DemoScenario, {title:string; description:string; action:string; icon:typeof MapPin}>;

export function DemoWorkspace({start, tour}:{start:(scenario:DemoScenario)=>void; tour:()=>void}) {
 return <main className="demo-workspace" aria-labelledby="demo-heading">
  <h1 id="demo-heading" tabIndex={-1}>Демо</h1>
  <p>Сценарии используют отдельные учебные данные.</p>
  <div className="demo-scenarios">
   {(Object.keys(scenarios) as DemoScenario[]).map(id => {
    const item = scenarios[id];
    const Icon = item.icon;
    return <section className="demo-scenario" key={id}>
     <Icon aria-hidden="true" size={23} strokeWidth={1.75} />
     <h2>{item.title}</h2>
     <p>{item.description}</p>
     <Button variant="primary" onClick={()=>start(id)}>{item.action}<ArrowRight size={16} aria-hidden="true"/></Button>
    </section>;
   })}
  </div>
  <Button id="demo-tour-button" variant="ghost" onClick={tour}>Экскурсия по карте</Button>
 </main>;
}

export function DemoGuide({scenario, children, back, reset, announce=false}: {
 scenario:DemoScenario; children?:ReactNode; back?:()=>void; reset?:()=>void; announce?:boolean;
}) {
 return <section className="demo-guide" aria-label={scenarios[scenario].title}>
  <strong>{scenarios[scenario].title}</strong>
  {children && <div className="demo-guide-content" role={announce?'status':undefined}>{children}</div>}
  {(back||reset)&&<div className="demo-guide-actions">
   {back&&<Button variant="ghost" onClick={back}>К сценариям Демо</Button>}
   {reset&&<Button variant="ghost" onClick={reset}>Начать заново</Button>}
  </div>}
 </section>;
}
