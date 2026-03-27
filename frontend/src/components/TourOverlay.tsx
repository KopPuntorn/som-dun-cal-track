"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TourStep {
  title: string;
  desc: string;
  target: string | null;
  icon?: string;
}

interface TourOverlayProps {
  show: boolean;
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
  highlightRect: DOMRect | null;
  stepLabel: string;
  nextLabel: string;
  backLabel: string;
  skipLabel: string;
  finishLabel: string;
}

export default function TourOverlay({
  show,
  steps,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onFinish,
  highlightRect,
  stepLabel,
  nextLabel,
  backLabel,
  skipLabel,
  finishLabel,
}: TourOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle keyboard navigation
  useEffect(() => {
    if (!show) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = tooltipRef.current;
      if (!dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onFinish();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (currentStep < steps.length - 1) {
          onNext();
        } else {
          onFinish();
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (currentStep > 0) {
          onPrev();
        }
        return;
      }

      if (event.key === "Tab") {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // Focus first button in tooltip
    const focusTimer = window.setTimeout(() => {
      const dialog = tooltipRef.current;
      if (dialog) {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable[0]?.focus();
      }
    }, 100);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [show, currentStep, steps.length, onNext, onPrev, onFinish]);

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!highlightRect || typeof window === "undefined") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "380px",
      };
    }

    const padding = 20;
    const tooltipHeight = 400;
    const spaceBelow = window.innerHeight - highlightRect.bottom;
    const spaceAbove = highlightRect.top;

    // Determine vertical position
    let top: number | undefined;
    let bottom: number | undefined;

    if (spaceBelow >= tooltipHeight + 24) {
      top = highlightRect.bottom + 24;
    } else if (spaceAbove >= tooltipHeight + 24) {
      bottom = window.innerHeight - highlightRect.top + 24;
    } else {
      top = Math.max(padding, (window.innerHeight - tooltipHeight) / 2);
    }

    // Determine horizontal position
    const tooltipWidth = Math.min(380, window.innerWidth - padding * 2);
    const centerX = highlightRect.left + highlightRect.width / 2;
    let left = centerX - tooltipWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    return {
      top: top !== undefined ? top : undefined,
      bottom: bottom !== undefined ? bottom : undefined,
      left: left,
      maxWidth: `${tooltipWidth}px`,
    };
  };

  if (!show) return null;

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        className="tour-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-desc"
        ref={tooltipRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* SVG Spotlight Mask Background */}
        <svg className="tour-spotlight" aria-hidden="true">
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {highlightRect && (
                <rect
                  x={highlightRect.x - 16}
                  y={highlightRect.y - 16}
                  width={highlightRect.width + 32}
                  height={highlightRect.height + 32}
                  rx="20"
                  fill="black"
                />
              )}
            </mask>
            <filter id="spotlight-blur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
            </filter>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.85)"
            mask="url(#spotlight-mask)"
          />
          {highlightRect && (
            <motion.rect
              x={highlightRect.x - 16}
              y={highlightRect.y - 16}
              width={highlightRect.width + 32}
              height={highlightRect.height + 32}
              rx="20"
              fill="none"
              stroke="var(--accent-cal)"
              strokeWidth="3"
              strokeDasharray="8 8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </svg>

        {/* Tooltip Content */}
        <motion.div
          className="glass-panel tour-tooltip"
          style={{
            ...getTooltipStyle(),
            padding: "28px",
            borderRadius: "24px",
            textAlign: "center",
            position: "absolute",
            zIndex: 10000,
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          key={currentStep}
        >
          {/* Header */}
          <div className="tour-tooltip-header">
            <span className="tour-step-label">{stepLabel} {currentStep + 1}/{steps.length}</span>
            <button onClick={onFinish} className="icon-btn tour-close" aria-label={skipLabel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Step Icon */}
          {currentStepData.icon && (
            <motion.div
              className="tour-step-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
            >
              {currentStepData.icon}
            </motion.div>
          )}

          {/* Title and Description */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="tour-title" id="tour-title">{currentStepData.title}</h2>
            <p className="tour-desc" id="tour-desc">{currentStepData.desc}</p>
          </motion.div>

          {/* Progress Bar */}
          <div className="tour-progress">
            <motion.div
              className="tour-progress-bar"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          {/* Action Buttons */}
          <div className="tour-actions">
            <button
              onClick={onSkip}
              className="glass-btn tour-btn"
            >
              {skipLabel}
            </button>
            <button
              onClick={onPrev}
              className="glass-btn tour-btn"
              disabled={isFirstStep}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              {backLabel}
            </button>
            <button
              onClick={isLastStep ? onFinish : onNext}
              className="primary-btn active tour-btn tour-btn-primary"
            >
              {isLastStep ? finishLabel : nextLabel}
              {!isLastStep && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 6 15 12 9 18"></polyline>
                </svg>
              )}
            </button>
          </div>

          {/* Step Dots */}
          <div className="tour-dots">
            {steps.map((_, i) => (
              <motion.button
                key={i}
                className={`tour-dot ${i === currentStep ? "active" : ""}`}
                onClick={() => {
                  if (i < currentStep) {
                    // Allow going back by clicking dots
                    for (let j = currentStep; j > i; j--) {
                      onPrev();
                    }
                  }
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
