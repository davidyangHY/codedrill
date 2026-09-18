import React, { useEffect, useMemo, useRef } from 'react';

// Intensity scale: darker green = more activity, lighter = less (empty is neutral).
// Index 0 is an empty day; 1..4 run light -> dark as activity increases.
const LEVELS = ['#262c36', '#57d364', '#2ea043', '#15803a', '#0d3d20'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// Map a day's activity to a 0..4 intensity. Problems drive the ramp; a goal-met
// day is always at least a mid green.
function levelFor(c) {
  if (!c) return -1; // padding cell (before the range started)
  const practiced = c.practiceMs > 0 || c.problems > 0;
  if (!practiced) return 0;
  let lv;
  if (c.problems >= 5) lv = 4;
  else if (c.problems >= 3) lv = 3;
  else if (c.problems >= 1) lv = 2;
  else lv = 1; // practiced by time only
  if (c.goalMet && lv < 2) lv = 2;
  return lv;
}

export default function ContributionCalendar({ series }) {
  const scrollRef = useRef(null);

  const { weeks, monthLabels, activeDays } = useMemo(() => {
    if (!series || !series.length) return { weeks: [], monthLabels: [], activeDays: 0 };
    // Pad so column 0 starts on a Sunday and the final column is complete.
    const first = new Date(series[0].date + 'T00:00:00');
    const lead = first.getDay();
    const cells = [...Array(lead).fill(null), ...series];
    while (cells.length % 7 !== 0) cells.push(null);
    const cols = [];
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));

    // A month label sits above the first column whose first real day is in a new month.
    const labels = cols.map((week, ci) => {
      const firstReal = week.find(Boolean);
      if (!firstReal) return null;
      const mo = new Date(firstReal.date + 'T00:00:00').getMonth();
      const prev = ci > 0 ? cols[ci - 1].find(Boolean) : null;
      const prevMo = prev ? new Date(prev.date + 'T00:00:00').getMonth() : -1;
      return mo !== prevMo ? MONTHS[mo] : null;
    });

    const active = series.filter((d) => d.practiceMs > 0 || d.problems > 0).length;
    return { weeks: cols, monthLabels: labels, activeDays: active };
  }, [series]);

  // Open scrolled to the most recent weeks (like GitHub).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [weeks]);

  if (!weeks.length) return null;

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="inline-flex gap-[10px] text-[9px] text-base-500">
          {/* Weekday labels */}
          <div className="flex flex-col gap-[3px] pr-0.5" style={{ paddingTop: 15 }}>
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="h-[11px] leading-[11px] w-6 text-right pr-1">
                {d}
              </div>
            ))}
          </div>

          {/* Month labels + week columns */}
          <div>
            <div className="flex gap-[3px] h-[15px]">
              {weeks.map((_, ci) => (
                <div key={ci} className="w-[11px] relative">
                  {monthLabels[ci] && (
                    <span className="absolute left-0 top-0 whitespace-nowrap">{monthLabels[ci]}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {week.map((c, di) => {
                    const lv = levelFor(c);
                    return (
                      <div
                        key={di}
                        className="w-[11px] h-[11px] rounded-[2px]"
                        style={{ background: lv < 0 ? 'transparent' : LEVELS[lv] }}
                        title={
                          c
                            ? `${c.date}: ${Math.round(c.practiceMs / 60000)} min, ${c.problems} problem${
                                c.problems === 1 ? '' : 's'
                              }${c.goalMet ? ' — goal met' : ''}`
                            : ''
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2 text-[11px] text-base-500">
        <span>{activeDays} active days this year</span>
        <span className="flex items-center gap-1">
          Less
          {LEVELS.slice(1).map((c, i) => (
            <span key={i} className="w-[11px] h-[11px] rounded-[2px]" style={{ background: c }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
