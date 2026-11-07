import { useEffect, useState } from 'react';
import { getDayHours, getMonthHours, getMonthsWithData, getYearsWithData } from '../services/forecastRepo.js';

const periodValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
const today = new Date();
const currentDate = periodValue(today);
const currentYear = today.getFullYear();
const FIRST_DATA_YEAR = 2020;
const availableDays = (year, month) => year === currentYear && month === today.getMonth() + 1 ? today.getDate() : daysInMonth(year, month);
const previousYear = periodValue(new Date(currentYear - 1, today.getMonth(), Math.min(today.getDate(), daysInMonth(currentYear - 1, today.getMonth() + 1))));
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function summarize(rows) {
  const values = (key) => rows.map((row) => row[key]).filter((value) => value != null && value !== '' && Number.isFinite(Number(value))).map(Number);
  const rainValues = values('chuva_mm');
  const temperatures = values('temperatura_c');

  return {
    rain: rainValues.length ? rainValues.reduce((sum, value) => sum + value, 0) : null,
    temperature: temperatures.length
      ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
      : null,
  };
}

function periodLabel(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function metric(value, unit) {
  return value == null ? 'Sem dados' : `${number.format(value)} ${unit}`;
}

function MetricBars({ title, values, unit }) {
  const maximum = Math.max(1, ...values.map(({ value }) => value ?? 0));

  return (
    <div className="period-chart" role="img" aria-label={`${title}: ${values.map(({ label, value }) => `${label}, ${metric(value, unit)}`).join('; ')}`}>
      <h3>{title}</h3>
      <div className="period-chart-bars" aria-hidden="true">
        {values.map(({ label, value }, index) => (
          <div className="period-chart-column" key={`${label}-${index}`}>
            <strong>{metric(value, unit)}</strong>
            <div className="period-chart-track">
              {value != null && <div className={`period-chart-bar period-chart-bar-${index}`} style={{ height: `${value === 0 ? 0 : Math.max(4, (value / maximum) * 100)}%` }} />}
            </div>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function initialPeriods(latestDate) {
  if (!latestDate) return [previousYear, currentDate];
  const [year, month, day] = latestDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return [previousYear, currentDate];
  const earlierDay = Math.min(day, daysInMonth(year - 1, month));
  return [periodValue(new Date(year - 1, month - 1, earlierDay)), latestDate.slice(0, 10)];
}

export default function PeriodComparison({ latestDate }) {
  const [periods, setPeriods] = useState(() => initialPeriods(latestDate));
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [datesWithData, setDatesWithData] = useState([[], []]);
  const [checkingDates, setCheckingDates] = useState([true, true]);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [userSelectedDate, setUserSelectedDate] = useState(false);
  const [previousLatestDate, setPreviousLatestDate] = useState(latestDate);
  const [yearsWithData, setYearsWithData] = useState([]);
  const [checkingYears, setCheckingYears] = useState(true);
  const [monthsWithData, setMonthsWithData] = useState([[], []]);
  const [checkingMonths, setCheckingMonths] = useState([true, true]);

  // Atualiza o estado do próprio componente apenas quando a referência muda.
  // Uma seleção já feita pelo usuário é preservada.
  if (latestDate !== previousLatestDate) {
    setPreviousLatestDate(latestDate);
    if (!userSelectedDate) setPeriods(initialPeriods(latestDate));
  }
  useEffect(() => {
    const controller = new AbortController();
    getYearsWithData(controller.signal, FIRST_DATA_YEAR, currentYear).then((years) => {
      if (controller.signal.aborted) return;
      setYearsWithData(years);
      setPeriods((current) => current.map((value) => {
        const [year, month, day] = value.split('-').map(Number);
        if (years.includes(year) || !years.length) return value;
        const fallbackYear = years.at(-1);
        const fallbackMonth = month;
        const fallbackDay = Math.min(day, daysInMonth(fallbackYear, fallbackMonth));
        return periodValue(new Date(fallbackYear, fallbackMonth - 1, fallbackDay));
      }));
      setAvailabilityError(null);
    }).catch((cause) => {
      if (!controller.signal.aborted) setAvailabilityError(cause.message || 'Não foi possível carregar os anos disponíveis.');
    }).finally(() => {
      if (!controller.signal.aborted) setCheckingYears(false);
    });
    return () => controller.abort();
  }, []);

  const year1 = Number(periods[0].slice(0, 4));
  const year2 = Number(periods[1].slice(0, 4));
  useEffect(() => {
    if (checkingYears) return undefined;
    const controller = new AbortController();
    const years = [year1, year2];
    Promise.all(years.map((year) => getMonthsWithData(controller.signal, year))).then((available) => {
      if (controller.signal.aborted) return;
      setMonthsWithData(available);
      setPeriods((current) => current.map((value, index) => {
        const [year, month, day] = value.split('-').map(Number);
        if (year !== years[index] || !available[index].length) return value;
        const selectedMonth = available[index].includes(month) ? month : available[index].at(-1);
        const validDay = Math.min(day, daysInMonth(year, selectedMonth));
        return periodValue(new Date(year, selectedMonth - 1, validDay));
      }));
      setAvailabilityError(null);
    }).catch((cause) => {
      if (!controller.signal.aborted) setAvailabilityError(cause.message || 'Não foi possível carregar os meses disponíveis.');
    }).finally(() => {
      if (!controller.signal.aborted) setCheckingMonths([false, false]);
    });
    return () => controller.abort();
  }, [checkingYears, year1, year2]);
  const monthKey1 = periods[0].slice(0, 7);
  const monthKey2 = periods[1].slice(0, 7);

  useEffect(() => {
    if (checkingYears || checkingMonths.some(Boolean)) return undefined;
    const controller = new AbortController();
    const monthKeys = [monthKey1, monthKey2];

    // Cada mês sem dados produz uma lista vazia no mesmo fluxo assíncrono.
    Promise.all(monthKeys.map(async (key, index) => {
      const [year, month] = key.split('-').map(Number);
      if (!monthsWithData[index].includes(month)) return [];
      const rows = await getMonthHours(controller.signal, year, month);
      return [...new Set(rows
        .filter((row) => row.horario && (row.chuva_mm != null || row.temperatura_c != null))
        .map((row) => Number(String(row.horario).slice(8, 10)))
        .filter(Number.isInteger))].sort((a, b) => a - b);
    })).then((available) => {
      if (controller.signal.aborted) return;
      setDatesWithData(available);
      setPeriods((current) => current.map((value, index) => {
        if (value.slice(0, 7) !== monthKeys[index] || !available[index].length) return value;
        const selectedDay = Number(value.slice(8, 10));
        const day = available[index].includes(selectedDay) ? selectedDay : available[index].at(-1);
        return `${monthKeys[index]}-${String(day).padStart(2, '0')}`;
      }));
      setAvailabilityError(null);
    }).catch((cause) => {
      if (!controller.signal.aborted) setAvailabilityError(cause.message || 'Não foi possível carregar as datas disponíveis.');
    }).finally(() => {
      if (!controller.signal.aborted) setCheckingDates([false, false]);
    });

    return () => controller.abort();
  }, [monthKey1, monthKey2, checkingYears, checkingMonths, monthsWithData]);

  async function compare(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const summaries = await Promise.all(periods.map(async (period) => {
        const [year, month, day] = period.split('-').map(Number);
        return summarize(await getDayHours(undefined, year, month, day));
      }));
      setResult(summaries);
    } catch (cause) {
      setError(cause.message || 'Não foi possível carregar os períodos.');
    } finally {
      setLoading(false);
    }
  }

  const delta = (a, b, unit) => a == null || b == null ? 'Sem dados para comparar' : `${number.format(b - a)} ${unit}`;
  const comparisonDisabled = loading || checkingYears || checkingMonths.some(Boolean) || checkingDates.some(Boolean) || datesWithData.some((days) => !days.length);

  return (
    <section className="period-compare" aria-labelledby="t-comparar-periodos">
      <h2 id="t-comparar-periodos">Comparar períodos</h2>
      <p className="note">Compare a chuva acumulada e a temperatura média de dois dias.</p>
      <form className="period-form" onSubmit={compare}>
        {periods.map((period, index) => {
          const [year, month, day] = period.split('-').map(Number);
          const updatePeriod = (nextYear, nextMonth, nextDay = day, reloadDates = false, reloadMonths = false) => {
            setUserSelectedDate(true);
            const validDay = Math.min(nextDay, availableDays(nextYear, nextMonth));
            setPeriods((current) => current.map((value, i) => i === index ? periodValue(new Date(nextYear, nextMonth - 1, validDay)) : value));
            if (reloadMonths) {
              setCheckingMonths((current) => current.map((value, i) => i === index ? true : value));
              setMonthsWithData((current) => current.map((value, i) => i === index ? [] : value));
              setCheckingDates((current) => current.map((value, i) => i === index ? true : value));
              setDatesWithData((current) => current.map((value, i) => i === index ? [] : value));
              setAvailabilityError(null);
            } else if (reloadDates) {
              setCheckingDates((current) => current.map((value, i) => i === index ? true : value));
              setDatesWithData((current) => current.map((value, i) => i === index ? [] : value));
            }
            setResult(null);
            setError(null);
          };

          return (
            <div className="period-selection" key={index}>
              <strong>Período {index + 1}</strong>
              <div className="period-fields">
                <div className="campo">
                  <label htmlFor={`period-day-${index}`}>Dia</label>
                  <select id={`period-day-${index}`} value={datesWithData[index].includes(day) ? day : ''} disabled={loading || checkingDates[index] || !datesWithData[index].length} onChange={(event) => updatePeriod(year, month, Number(event.target.value))}>
                    {checkingDates[index] && <option value="">Buscando datas…</option>}
                    {!checkingDates[index] && !datesWithData[index].length && <option value="">Sem datas com dados</option>}
                    {datesWithData[index].map((optionDay) => <option key={optionDay} value={optionDay}>{optionDay}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor={`period-month-${index}`}>Mês</label>
                  <select id={`period-month-${index}`} value={monthsWithData[index].includes(month) ? month : ''} disabled={loading || checkingYears || checkingMonths[index] || !monthsWithData[index].length} onChange={(event) => updatePeriod(year, Number(event.target.value), day, true)}>
                    {checkingMonths[index] && <option value="">Buscando meses…</option>}
                    {!checkingMonths[index] && !monthsWithData[index].length && <option value="">Sem meses com dados</option>}
                    {monthsWithData[index].map((availableMonth) => <option key={availableMonth} value={availableMonth}>{MONTHS[availableMonth - 1]}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor={`period-year-${index}`}>Ano</label>
                  <select id={`period-year-${index}`} value={yearsWithData.includes(year) ? year : ''} disabled={loading || checkingYears || !yearsWithData.length} onChange={(event) => updatePeriod(Number(event.target.value), month, day, true, true)}>
                    {checkingYears && <option value="">Buscando anos…</option>}
                    {!checkingYears && !yearsWithData.length && <option value="">Sem anos com dados</option>}
                    {yearsWithData.map((availableYear) => <option key={availableYear} value={availableYear}>{availableYear}</option>)}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        <button className="btn" type="submit" disabled={comparisonDisabled}>{loading ? 'Carregando…' : 'Comparar'}</button>
      </form>

      {availabilityError && <p className="err" role="alert">{availabilityError}</p>}
      {error && <p className="err" role="alert">{error}</p>}
      {result && (
        <div className="period-results" aria-live="polite">
          {result.map((summary, index) => (
            <div className="period-result" key={`${periods[index]}-${index}`}>
              <h4>{periodLabel(periods[index])}</h4>
              <p>Chuva acumulada: <strong>{metric(summary.rain, 'mm')}</strong></p>
              <p>Temperatura média: <strong>{metric(summary.temperature, '°C')}</strong></p>
            </div>
          ))}
          <div className="period-charts">
            <MetricBars
              title="Chuva acumulada"
              unit="mm"
              values={result.map((summary, index) => ({ label: periodLabel(periods[index]), value: summary.rain }))}
            />
            <MetricBars
              title="Temperatura média"
              unit="°C"
              values={result.map((summary, index) => ({ label: periodLabel(periods[index]), value: summary.temperature }))}
            />
          </div>
          <p className="period-difference">
            Diferença (período 2 − período 1): chuva {delta(result[0].rain, result[1].rain, 'mm')} · temperatura {delta(result[0].temperature, result[1].temperature, '°C')}
          </p>
        </div>
      )}
    </section>
  );
}
