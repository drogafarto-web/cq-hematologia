import { PERIODO_LABEL, type EscalaDiaria } from '../types/Escala';
import { EscalaDayCell } from './EscalaDayCell';

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

interface EscalaCalendarProps {
  weekDays: Date[];
  escalasByDay: Map<string, EscalaDiaria[]>;
  diasSemCobertura: Date[];
  onDayClick: (day: Date, existing?: EscalaDiaria) => void;
}

export function EscalaCalendar({ weekDays, escalasByDay, diasSemCobertura, onDayClick }: EscalaCalendarProps) {
  const missingSet = new Set(diasSemCobertura.map((d) => d.toDateString()));
  const today = new Date().toDateString();

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day, idx) => {
        const key = day.toDateString();
        const dayEscalas = escalasByDay.get(key) ?? [];
        const isMissing = missingSet.has(key);
        const isToday = key === today;

        return (
          <EscalaDayCell
            key={idx}
            day={day}
            dayLabel={DIAS_SEMANA[idx]}
            escalas={dayEscalas}
            isMissing={isMissing}
            isToday={isToday}
            onAdd={() => onDayClick(day)}
            onEdit={(escala) => onDayClick(day, escala)}
          />
        );
      })}
    </div>
  );
}
