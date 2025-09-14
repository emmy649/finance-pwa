import React, { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// =============================
// Finance PWA — „Моите финанси“ (месечно съхранение)
// Single-file React component, TailwindCSS v4
// =============================

const RADIAN = Math.PI / 180;
const renderInsideValue = ({
  cx, cy, midAngle, innerRadius, outerRadius, value,
}) => {
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fill="currentColor"
    >
      {`${Number(value).toFixed(0)} лв`}
    </text>
  );
};



const STORAGE_KEY = "finance_pwa_state_v2"; // нов ключ, за да не се бърка със стария формат

const defaultState = {
  month: new Date().toISOString().slice(0, 7), // YYYY-MM
  months: {}, // { 'YYYY-MM': { incomes: [], expenses: [] } }
  folders: { needs: 50, wants: 30, savings: 20 },
  debtPlan: [], // глобален план за дългове
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function loadState() {
  try {
    // опитай v2
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2);
      return { ...defaultState, ...parsedV2 };
    }

    // миграция от v1 (стар ключ/формат)
    const rawV1 = localStorage.getItem("finance_pwa_state_v1");
    if (!rawV1) return defaultState;
    const parsedV1 = JSON.parse(rawV1);

    const migrated = { ...defaultState };
    const key = parsedV1?.month || defaultState.month;
    migrated.month = key;
    migrated.folders = parsedV1?.folders || defaultState.folders;
    migrated.debtPlan = parsedV1?.debtPlan || [];
    migrated.months = { [key]: { incomes: parsedV1?.incomes || [], expenses: parsedV1?.expenses || [] } };
    return migrated;
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const SectionCard = ({ title, subtitle, children, right }) => (
  <div className="bg-white/70 dark:bg-neutral-900/70 backdrop-blur rounded-2xl shadow p-5 border border-neutral-200 dark:border-neutral-800">
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const Chip = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">{children}</span>
);

const money = (n) => (isNaN(n) ? "0.00" : Number(n).toFixed(2));

export default function App() {
  const [state, setState] = useState(loadState());
  const [tab, setTab] = useState("inventory");

  // гарантираме "коше" за текущия месец
  useEffect(() => {
    setState((s) => {
      const m = s.month;
      const nextMonths = { ...s.months };
      if (!nextMonths[m]) nextMonths[m] = { incomes: [], expenses: [] };
      return { ...s, months: nextMonths };
    });
  }, [state.month]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const current = useMemo(
    () => state.months[state.month] ?? { incomes: [], expenses: [] },
    [state.months, state.month]
  );

  const setCurrentMonthData = (updates) => {
    setState((s) => {
      const m = s.month;
      const cur = s.months[m] ?? { incomes: [], expenses: [] };
      return { ...s, months: { ...s.months, [m]: { ...cur, ...updates } } };
    });
  };

  // Derived values
  const incomeTotal = useMemo(() => current.incomes.reduce((s, i) => s + Number(i.amount || 0), 0), [current.incomes]);
  const expenseTotal = useMemo(() => current.expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [current.expenses]);

  const byFolder = useMemo(() => {
    const agg = { needs: 0, wants: 0, savings: 0 };
    current.expenses.forEach((e) => {
      if (e.folder && agg[e.folder] !== undefined) agg[e.folder] += Number(e.amount || 0);
    });
    return agg;
  }, [current.expenses]);

  const targetByFolder = useMemo(() => {
    return {
      needs: (state.folders.needs / 100) * incomeTotal,
      wants: (state.folders.wants / 100) * incomeTotal,
      savings: (state.folders.savings / 100) * incomeTotal,
    };
  }, [state.folders, incomeTotal]);

  const coverage = useMemo(() => {
    const denom = incomeTotal || 1;
    return {
      needs: (byFolder.needs / denom) * 100,
      wants: (byFolder.wants / denom) * 100,
      savings: (byFolder.savings / denom) * 100,
    };
  }, [byFolder, incomeTotal]);

  const net = incomeTotal - expenseTotal;

  // Желан доход, за да спазиш 50/30/20 при текущите разходи
  const desiredIncome = useMemo(() => {
    const perc = state.folders;
    const needsReq = perc.needs > 0 ? byFolder.needs / (perc.needs / 100) : 0;
    const wantsReq = perc.wants > 0 ? byFolder.wants / (perc.wants / 100) : 0;
    const savingsReq = perc.savings > 0 ? byFolder.savings / (perc.savings / 100) : 0;
    const candidates = [needsReq, wantsReq, savingsReq].filter((n) => n > 0);
    return candidates.length ? Math.max(...candidates) : 0;
  }, [byFolder, state.folders]);

  const desiredDelta = useMemo(() => Math.max(0, desiredIncome - incomeTotal), [desiredIncome, incomeTotal]);

  const pieData = [
    { name: "Нужди", value: byFolder.needs },
    { name: "Желания", value: byFolder.wants },
    { name: "Спестявания", value: byFolder.savings },
  ];

  const targetPie = [
    { name: "Нужди (цел)", value: targetByFolder.needs },
    { name: "Желания (цел)", value: targetByFolder.wants },
    { name: "Спестявания (цел)", value: targetByFolder.savings },
  ];

  const COLORS = ["#60a5fa", "#34d399", "#fbbf24"]; // палитра за графиките

  const resetMonth = () => {
    if (!confirm("Да изчистя ли текущите приходи и разходи само за този месец?")) return;
    setCurrentMonthData({ incomes: [], expenses: [] });
  };

  const deleteCurrentMonth = () => {
    if (!confirm("Сигурна ли си, че искаш да изтриеш целия избран месец? Това няма да засегне други месеци.")) return;
    setState((s) => {
      const m = s.month;
      const months = { ...s.months };
      delete months[m];
      // ако тъкмо изтрихме активния месец – премести към последно наличен
      const remaining = Object.keys(months).sort();
      const nextMonth = remaining[remaining.length - 1] || new Date().toISOString().slice(0, 7);
      if (!months[nextMonth]) months[nextMonth] = { incomes: [], expenses: [] };
      return { ...s, month: nextMonth, months };
    });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${state.month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        // умно сливане: пазим текущите настройки, добавяме/заменяме months
        setState((s) => ({
          ...s,
          month: parsed.month || s.month,
          folders: parsed.folders || s.folders,
          debtPlan: parsed.debtPlan || s.debtPlan,
          months: { ...s.months, ...(parsed.months || {}) },
        }));
      } catch (err) {
        alert("Невалиден JSON файл.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-neutral-50 to-emerald-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 text-neutral-900 dark:text-neutral-100">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Моите финанси</h1>
            <p className="text-neutral-600 dark:text-neutral-400">Лесно уеб приложение по модела 50/30/20 с месечен одит.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2"
              value={state.month}
              onChange={(e) => {
                const m = e.target.value;
                setState((s) => ({
                  ...s,
                  month: m,
                  months: { ...s.months, [m]: s.months[m] ?? { incomes: [], expenses: [] } },
                }));
              }}
            />
            <button onClick={resetMonth} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Изчисти месец</button>
            <button onClick={deleteCurrentMonth} className="px-3 py-2 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50">Изтрий месец</button>
            <button onClick={exportJSON} className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Експорт</button>
            <label className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
              Импорт
              <input type="file" className="hidden" accept="application/json" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
            </label>
          </div>
        </header>

        <nav className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
          {[
            { id: "inventory", label: "1. Инвентаризация" },
            { id: "structure", label: "2. Структуриране" },
            { id: "plan", label: "3. План" },
            { id: "automation", label: "4. Автоматизация" },
            { id: "audit", label: "5. Одит" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-2xl border text-sm transition ${
                tab === t.id
                  ? "border-neutral-900 dark:border-neutral-200 bg-white dark:bg-neutral-900 shadow"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-white/60 dark:hover:bg-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "inventory" && (
          <div className="grid md:grid-cols-2 gap-6">
            <SectionCard
              title="Приходи"
              subtitle="Заплата, хонорари, фрийланс, наеми, пасивни доходи"
              right={<Chip>Общо: {money(incomeTotal)} лв</Chip>}
            >
              <ItemEditor
                items={current.incomes}
                onAdd={(it) => setCurrentMonthData({ incomes: [...current.incomes, it] })}
                onChange={(items) => setCurrentMonthData({ incomes: items })}
                schema={[{ key: "label", label: "Етикет" }, { key: "amount", label: "Сума", type: "number" }]}
              />
              <p className="text-sm text-neutral-500 mt-2">💡 Прегледай банковите извлечения и кеш разписки, за да не пропуснеш нищо.</p>
            </SectionCard>

            <SectionCard
              title="Разходи"
              subtitle="Фиксирани, променливи, непредвидени"
              right={<Chip>Общо: {money(expenseTotal)} лв</Chip>}
            >
              <ItemEditor
                items={current.expenses}
                onAdd={(it) => setCurrentMonthData({ expenses: [...current.expenses, it] })}
                onChange={(items) => setCurrentMonthData({ expenses: items })}
                schema={[
                  { key: "label", label: "Етикет" },
                  { key: "amount", label: "Сума", type: "number" },
                  {
                    key: "type",
                    label: "Тип",
                    type: "select",
                    options: [
                      { value: "fixed", label: "Фиксиран" },
                      { value: "variable", label: "Променлив" },
                      { value: "unexpected", label: "Непредвиден" },
                    ],
                  },
                  {
                    key: "folder",
                    label: "Папка",
                    type: "select",
                    options: [
                      { value: "needs", label: "Нужди" },
                      { value: "wants", label: "Желания" },
                      { value: "savings", label: "Спестявания" },
                    ],
                  },
                ]}
              />
              <p className="text-sm text-neutral-500 mt-2">💡 Трик: често има забравени абонаменти. Провери ги и ги прекрати при нужда.</p>
            </SectionCard>
          </div>
        )}

        {tab === "structure" && (
          <div className="grid md:grid-cols-2 gap-6">
            <SectionCard title="Модел" subtitle="Можеш да адаптираш процентите според реалността си. ">
              <div className="grid grid-cols-4 gap-3">
                {["needs", "wants", "savings"].map((k) => (
                  <div key={k} className="space-y-2">
                    <label className="text-sm text-neutral-500 block">
                      {k === "needs" ? "Нужди %" : k === "wants" ? "Желания %" : "Спестявания %"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={state.folders[k]}
                      onChange={(e) =>
                        setState((s) => ({ ...s, folders: { ...s.folders, [k]: Number(e.target.value) } }))
                      }
                      className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-neutral-500">Целева сума за Нужди</div>
                  <div className="text-lg font-semibold">{money(targetByFolder.needs)} лв</div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-neutral-500">Целева сума за Желания</div>
                  <div className="text-lg font-semibold">{money(targetByFolder.wants)} лв</div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="text-neutral-500">Целева сума за Спестявания</div>
                  <div className="text-lg font-semibold">{money(targetByFolder.savings)} лв</div>
                </div>
              </div>
              <p className="text-sm text-neutral-500 mt-3">Съвет: започни с този модел, после коригирай според сезона и целите. </p>
              <p className="text-sm text-neutral-500 mt-3">Съвет: Моделът 50/30/20 е лесен старт </p>
              <p className="text-sm text-neutral-500 mt-3">50% → нужди (наем, сметки, храна, транспорт)</p>
              <p className="text-sm text-neutral-500 mt-3">30% → желания (развлечения, хобита, пътувания) </p>
              <p className="text-sm text-neutral-500 mt-3">20% → спестявания и инвестиции (включително фонд за непредвидени разходи) </p>
            </SectionCard>

            
              <SectionCard title="Сравнение реално vs цел">
                <div className="flex justify-center mb-4">
                  <ul className="flex gap-4 text-sm">
                    <li className="flex items-center gap-1">
                      <span className="inline-block w-4 h-4 rounded-sm" style={{ backgroundColor: COLORS[0] }}></span>
                        Нужди
                    </li>
                      <li className="flex items-center gap-1">
                     <span className="inline-block w-4 h-4 rounded-sm" style={{ backgroundColor: COLORS[1] }}></span>
                       Желания
                   </li>
                     <li className="flex items-center gap-1">
                   <span className="inline-block w-4 h-4 rounded-sm" style={{ backgroundColor: COLORS[2] }}></span>
                     Спестявания
                   </li>
                 </ul>
               </div>

               <div className="grid md:grid-cols-2 gap-1">
                <div className="h-72 md:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label={renderInsideValue} labelLine={false}>
                        {pieData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                         ))}
                    </Pie>
                  <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-sm text-center mt-1">Реално разпределение</div>
                </div>
                <div className="h-72 md:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={targetPie} dataKey="value" nameKey="name" outerRadius={100} label={renderInsideValue} labelLine={false}>
                        {targetPie.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                         ))}
                      </Pie>
                  <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-sm text-center mt-1">Целево разпределение</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-10 text-sm">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border"><div className="text-neutral-500">Покритие Нужди</div><div className="text-lg font-semibold">{coverage.needs.toFixed(1)}%</div></div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border"><div className="text-neutral-500">Покритие Желания</div><div className="text-lg font-semibold">{coverage.wants.toFixed(1)}%</div></div>
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border"><div className="text-neutral-500">Покритие Спестявания</div><div className="text-lg font-semibold">{coverage.savings.toFixed(1)}%</div></div>
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "plan" && (
          <div className="grid md:grid-cols-2 gap-6">
            <SectionCard title="Спешен фонд" subtitle="Цел: 3–6 месеца фиксирани разходи">
              <EmergencyFund expenses={current.expenses} />
            </SectionCard>

            <SectionCard title="Желан месечен доход" subtitle="Спрямо текущите разходи и зададените проценти">
              <div className="space-y-2">
                <div className="text-2xl font-bold">{money(desiredIncome)} лв / месец</div>
                <div className="text-sm text-neutral-500">Текущ доход: {money(incomeTotal)} лв</div>
                {desiredDelta > 0 ? (
                  <div className="text-sm">Недостиг: <b>{money(desiredDelta)} лв</b>, за да покриеш модела.</div>
                ) : (
                  <div className="text-sm text-emerald-600">Покриваш модела при текущите разходи.</div>
                )}
                <p className="text-xs text-neutral-500">Формула (по най-строгото изискване): max( Нужди/процент, Желания/процент{state.folders.savings ? ", Спестявания/процент" : ""} ).</p>
              </div>
            </SectionCard>

            <SectionCard title="Автоспестяване" subtitle="Прехвърляне на % от дохода всеки месец">
              <AutoSaving incomeTotal={incomeTotal} folders={state.folders} />
            </SectionCard>


            <SectionCard title="Нето резултат" subtitle="Приходи − Разходи">
              <div className={`text-3xl font-bold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{money(net)} лв</div>
              <p className="text-sm text-neutral-500 mt-2">Ако нетото е отрицателно, прегледай променливите разходи и абонаменти.</p>
            </SectionCard>

            <SectionCard title="Дългове – стратегия" subtitle="Започни от най-високата лихва">
              <DebtPlanner state={state} setState={setState} />
            </SectionCard>

          </div>
        )}

        {tab === "automation" && (
          <div className="grid md:grid-cols-2 gap-6">
            <SectionCard title="Шаблони за автоматизация" subtitle="Идеи – настройват се в твоето банкиране">
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Месечен автоматичен превод към спестовна сметка веднага след заплата (напр. {state.folders.savings}% от дохода).</li>
                <li>Постоянни поръчки за фиксирани разходи: наем, комунални, абонаменти.</li>
                <li>Известия при еднократно плащане над избран праг (напр. 200 лв).</li>
                <li>Правило „закръгляне“: закръгляй покупките до лев/5 лв и разликата – към спестявания.</li>
              </ul>
              <p className="text-xs text-neutral-500 mt-3">Тези настройки се правят в мобилното приложение на твоята банка. Тук ги планираме.</p>
            </SectionCard>

            <SectionCard title="Чеклист за изпълнение">
              <Checklist />
            </SectionCard>
          </div>
        )}

        {tab === "audit" && (
          <div className="grid md:grid-cols-3 gap-6">
            <SectionCard title="Месечен одит" subtitle="Какъв % е отишъл в нужди / желания / спестявания">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <KPI label="Нужди" value={`${coverage.needs.toFixed(1)}%`} hint={`цел ${state.folders.needs}%`} />
                <KPI label="Желания" value={`${coverage.wants.toFixed(1)}%`} hint={`цел ${state.folders.wants}%`} />
                <KPI label="Спестени" value={`${coverage.savings.toFixed(1)}%`} hint={`цел ${state.folders.savings}%`} />
              </div>
              <div className="mt-4">
                <p className="text-sm text-neutral-500">Къде има изтичане? Прегледай етикетите с най-големи суми.</p>
                <TopSpenders expenses={current.expenses} />
              </div>
            </SectionCard>

            <SectionCard title="Лични напомняния" subtitle="Малки стъпки, голям ефект">
               <div className="space-y-3 text-sm">
                     <p>✨ <b>Не всичко наведнъж.</b> Избери едно малко действие всеки месец. Постоянството е по-силно от ентусиазма.</p>
                     <p>💡 <b>Запомни:</b> спестеният лев = изкаран лев. Малките корекции в желанията носят голяма сигурност.</p>
                     <p>🌱 <b>Гледай напред:</b> всеки месец добавя нов слой спокойствие. Дори +50 лв към спестяванията е победа.</p>
                     <p>🛡️ <b>Спешният фонд е щит.</b> 1 месец → 3 месеца → 6 месеца. Когато имаш буфер, решенията стават по-свободни.</p>
                     <p>💚 <b>Празнувай малките успехи.</b> Отметни си, когато спазиш бюджета. Това е сигнал, че работиш за себе си.</p>
               </div>
             </SectionCard>

            <SectionCard title="График за месец">
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li><b>Ден 1:</b> Инвентаризация – въведи всички приходи и разходи.</li>
                <li><b>Ден 2:</b> Преглед и прекратяване на излишни абонаменти.</li>
                <li><b>Ден 3:</b> Създай/коригирай папките (50/30/20).</li>
                <li><b>Ден 4:</b> Настрой автоматични преводи.</li>
                <li><b>Ден 30:</b> Одит и корекция на бюджета.</li>
              </ul>
            </SectionCard>
            
            

          </div>
        )}

        <footer className="mt-10 text-center text-xs text-neutral-500">
          Построено за бърз старт. Данните се пазят локално в браузъра ти.
        </footer>
      </div>
    </div>
  );
}

function ItemEditor({ items, onAdd, onChange, schema }) {
  const empty = useMemo(() => Object.fromEntries(schema.map((f) => [f.key, ""]) ), [schema]);
  const [form, setForm] = useState({ ...empty });

  const add = () => {
    const payload = { id: uid(), ...form };
    // normalize numbers
    schema.forEach((f) => {
      if (f.type === "number") payload[f.key] = Number(payload[f.key] || 0);
    });
    onAdd(payload);
    setForm({ ...empty });
  };

  const updateItem = (id, key, value, type) => {
    onChange(
      items.map((it) =>
        it.id === id
          ? { ...it, [key]: type === "number" ? Number(value || 0) : value }
          : it
      )
    );
  };

  const remove = (id) => onChange(items.filter((it) => it.id !== id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        {schema.map((f, idx) => (
          <div key={f.key} className={`${idx === schema.length - 1 ? "md:col-span-3" : "md:col-span-3"}`}>
            <label className="text-xs text-neutral-500 block mb-1">{f.label}</label>
            {f.type === "select" ? (
              <select
                value={form[f.key] || ""}
                onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2"
              >
                <option value="">—</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                value={form[f.key] || ""}
                onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2"
                placeholder={f.placeholder || ""}
              />
            )}
          </div>
        ))}
        <div className="md:col-span-3 flex items-end">
          <button onClick={add} className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Добави</button>
        </div>
      </div>

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border rounded-xl border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {items.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">Няма данни. Добави първия елемент горе.</div>
        )}
        {items.map((it) => (
          <div key={it.id} className="p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            {schema.map((f) => (
              <div key={f.key} className="md:col-span-3">
                <label className="text-[11px] text-neutral-500 block">{f.label}</label>
                {f.type === "select" ? (
                  <select
                    value={it[f.key] || ""}
                    onChange={(e) => updateItem(it.id, f.key, e.target.value, f.type)}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-2 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={it[f.key]}
                    onChange={(e) => updateItem(it.id, f.key, e.target.value, f.type)}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            ))}
            <div className="md:col-span-3 flex gap-2">
              <button onClick={() => remove(it.id)} className="px-2 py-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50">Изтрий</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPI({ label, value, hint }) {
  return (
    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <div className="text-neutral-500 text-sm">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}

function TopSpenders({ expenses }) {
  const agg = useMemo(() => {
    const map = new Map();
    expenses.forEach((e) => {
      const key = `${e.folder || "—"} • ${e.label || "Без име"}`;
      const prev = map.get(key) || 0;
      map.set(key, prev + Number(e.amount || 0));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [expenses]);

  if (agg.length === 0) return <p className="text-sm text-neutral-500">Няма разходи за показване.</p>;

  return (
    <div className="mt-2 grid grid-cols-1 gap-2">
      {agg.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/60">
          <span className="text-sm">{k}</span>
          <span className="text-sm font-semibold">{money(v)} лв</span>
        </div>
      ))}
    </div>
  );
}

function EmergencyFund({ expenses }) {
  const fixed = useMemo(() => expenses.filter((e) => e.type === "fixed"), [expenses]);
  const fixedSum = useMemo(() => fixed.reduce((s, e) => s + Number(e.amount || 0), 0), [fixed]);

  const target1 = fixedSum * 1;
  const target3 = fixedSum * 3;
  const target6 = fixedSum * 6;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border">
          <div className="text-neutral-500">Фиксирани месечни</div>
          <div className="text-lg font-semibold">{money(fixedSum)} лв</div>
        </div>
        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border">
          <div className="text-neutral-500">Цел (1 месец)</div>
          <div className="text-lg font-semibold">{money(target1)} лв</div>
        </div>
        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border">
          <div className="text-neutral-500">Цел (3 месеца)</div>
          <div className="text-lg font-semibold">{money(target3)} лв</div>
        </div>
        <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border">
          <div className="text-neutral-500">Цел (6 месеца)</div>
          <div className="text-lg font-semibold">{money(target6)} лв</div>
        </div>
      </div>
      <p className="text-sm text-neutral-500 mt-3">
        Започни да отделяш малки суми, но регулярно. Последователността печели.
      </p>
    </div>
  );
}


function DebtPlanner({ state, setState }) {
  const add = (it) => setState((s) => ({ ...s, debtPlan: [...s.debtPlan, { id: uid(), ...it }] }));
  const update = (id, key, val, type) => setState((s) => ({
    ...s,
    debtPlan: s.debtPlan.map((d) => (d.id === id ? { ...d, [key]: type === "number" ? Number(val || 0) : val } : d)),
  }));
  const remove = (id) => setState((s) => ({ ...s, debtPlan: s.debtPlan.filter((d) => d.id !== id) }));

  const ordered = useMemo(() => [...state.debtPlan].sort((a, b) => (b.rate || 0) - (a.rate || 0)), [state.debtPlan]);

  const [form, setForm] = useState({ name: "", principal: 0, rate: 0 });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="md:col-span-5">
          <label className="text-xs text-neutral-500">Име</label>
          <input className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs text-neutral-500">Главница (лв)</label>
          <input type="number" className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2" value={form.principal} onChange={(e) => setForm({ ...form, principal: Number(e.target.value || 0) })} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-neutral-500">Лихва %</label>
          <input type="number" className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-3 py-2" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value || 0) })} />
        </div>
        <div className="md:col-span-2 flex items-end">
          <button onClick={() => { add(form); setForm({ name: "", principal: 0, rate: 0 }); }} className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800">Добави</button>
        </div>
      </div>

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border rounded-xl border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {ordered.length === 0 && <div className="p-4 text-sm text-neutral-500">Няма дългове. Добави отгоре.</div>}
        {ordered.map((d, idx) => (
          <div key={d.id} className="p-3 grid grid-cols-12 gap-2 items-center">
            <div className="col-span-1 text-sm text-neutral-500">#{idx + 1}</div>
            <div className="col-span-4">
              <input className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-2 py-1.5 text-sm" value={d.name} onChange={(e) => update(d.id, "name", e.target.value)} />
            </div>
            <div className="col-span-3">
              <input type="number" className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-2 py-1.5 text-sm" value={d.principal} onChange={(e) => update(d.id, "principal", e.target.value, "number")} />
            </div>
            <div className="col-span-2">
              <input type="number" className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-900/70 px-2 py-1.5 text-sm" value={d.rate} onChange={(e) => update(d.id, "rate", e.target.value, "number")} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button onClick={() => remove(d.id)} className="px-2 py-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50">Изтрий</button>
            </div>
          </div>
        ))}
      </div>

      {ordered.length > 0 && (
        <p className="text-sm text-neutral-500">Погасявай първо #{1} (най-висок процент), като внасяш минимум по останалите.</p>
      )}
    </div>
  );
}

function AutoSaving({ incomeTotal, folders }) {
  const monthly = (folders.savings / 100) * incomeTotal;
  return (
    <div className="space-y-2">
      <div className="text-sm">Препоръчителен автоматичен превод към спестовна сметка:</div>
      <div className="text-2xl font-bold">{money(monthly)} лв / месец</div>
      <p className="text-xs text-neutral-500">Настрой го за деня след заплата – така „плащаш първо на себе си“.</p>
    </div>
  );
}

function Checklist() {
  const [steps, setSteps] = useState([
    { id: 1, text: "Въведох всички приходи и разходи", done: false },
    { id: 2, text: "Прекратих излишни абонаменти", done: false },
    { id: 3, text: "Настроих 50/30/20 спрямо реалността ми", done: false },
    { id: 4, text: "Пуснах автоматичен превод към спестявания", done: false },
    { id: 5, text: "Завърших месечния одит", done: false },
  ]);

  const toggle = (id) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));

  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/60">
          <input type="checkbox" checked={s.done} onChange={() => toggle(s.id)} />
          <span className={s.done ? "line-through text-neutral-500" : ""}>{s.text}</span>
        </label>
      ))}
    </div>
  );
}
