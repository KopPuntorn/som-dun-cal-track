"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import { useLanguage } from "@/context/LanguageContext";

const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

interface Props {
  value: string; // yyyy-MM-dd
  onChange: (date: string) => void;
  onClose: () => void;
}

export default function CalendarPicker({ value, onChange, onClose }: Props) {
  const { language } = useLanguage();
  const weekdays = language === "th" ? WEEKDAYS_TH : WEEKDAYS_EN;
  const months = language === "th" ? MONTHS_TH : MONTHS_EN;

  const selected = value ? new Date(value + "T00:00:00") : new Date();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selected));
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const result: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      result.push(day);
      day = addDays(day, 1);
    }
    return result;
  }, [currentMonth]);

  const handleSelect = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"));
    onClose();
  };

  const monthLabel = `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <div ref={calendarRef} className="calendar-picker">
      {/* Header */}
      <div className="calendar-header">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="calendar-nav-btn"
        >
          ◂
        </button>
        <span className="calendar-month-label">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="calendar-nav-btn"
        >
          ▸
        </button>
      </div>

      {/* Weekday headers */}
      <div className="calendar-weekdays">
        {weekdays.map((d) => (
          <div key={d} className="calendar-wd">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="calendar-days">
        {days.map((day, i) => {
          const isSelected = isSameDay(day, selected);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <button
              type="button"
              key={i}
              onClick={() => handleSelect(day)}
              className={`calendar-day-btn 
                ${isSelected ? 'selected' : ''} 
                ${!isCurrentMonth ? 'not-current' : ''} 
                ${isTodayDate ? 'today' : ''}
              `}
            >
              {format(day, "d")}
              {isTodayDate && !isSelected && (
                <span className="calendar-today-dot" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
