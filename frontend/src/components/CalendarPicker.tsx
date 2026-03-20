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
    <div
      ref={calendarRef}
      className="calendar-picker"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        zIndex: 1000,
        background: "rgba(18, 22, 28, 0.95)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--panel-border)",
        borderRadius: "20px",
        padding: "20px",
        boxShadow: "0 20px 60px -15px rgba(0,0,0,0.8)",
        animation: "calendarFadeIn 0.2s ease-out",
        width: "300px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--panel-border)",
            borderRadius: "10px",
            width: "36px",
            height: "36px",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
        >
          ◂
        </button>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--panel-border)",
            borderRadius: "10px",
            width: "36px",
            height: "36px",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
        >
          ▸
        </button>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
          marginBottom: "4px",
        }}
      >
        {weekdays.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-secondary)",
              padding: "4px 0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
        }}
      >
        {days.map((day, i) => {
          const isSelected = isSameDay(day, selected);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <button
              type="button"
              key={i}
              onClick={() => handleSelect(day)}
              style={{
                width: "100%",
                aspectRatio: "1",
                border: "none",
                borderRadius: "10px",
                background: isSelected
                  ? "var(--accent-pro-gradient, linear-gradient(135deg, #82a67d, #6e9682))"
                  : isTodayDate
                  ? "rgba(130, 166, 125, 0.15)"
                  : "transparent",
                color: isSelected
                  ? "white"
                  : !isCurrentMonth
                  ? "rgba(255,255,255,0.15)"
                  : isTodayDate
                  ? "var(--accent-cal)"
                  : "var(--text-primary)",
                fontSize: "13px",
                fontWeight: isSelected || isTodayDate ? 800 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = isTodayDate
                    ? "rgba(130, 166, 125, 0.15)"
                    : "transparent";
                }
              }}
            >
              {format(day, "d")}
              {isTodayDate && !isSelected && (
                <span
                  style={{
                    position: "absolute",
                    bottom: "3px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "var(--accent-cal)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
