"use client";

import { useState, useEffect } from "react";
import { updateHistoryWithExplanation } from "@/lib/progress";

export default function PersonalizedExplanation({
  concept,
  question,
  studentAnswer,
  correctAnswer,
  options,
  historyId,
  onClose,
}) {
  const [explanation, setExplanation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getExplanation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          question,
          studentAnswer,
          correctAnswer,
          options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get explanation");
      }

      const data = await response.json();
      setExplanation(data);

      // Save to history if we have a history ID
      if (historyId) {
        updateHistoryWithExplanation(historyId, data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (!explanation && !isLoading) {
      getExplanation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="personalized-explanation">
      <div className="explanation-header">
        <h3>Understanding Your Answer</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      {isLoading && (
        <div className="explanation-loading">
          <div className="spinner" />
          <p>Analyzing your answer...</p>
        </div>
      )}

      {error && (
        <div className="explanation-error">
          <p>{error}</p>
          <button className="btn-secondary" onClick={getExplanation}>
            Try Again
          </button>
        </div>
      )}

      {!explanation && !isLoading && !error && (
        <div className="explanation-prompt">
          <p>
            Would you like a personalized explanation of why your answer was
            incorrect and how to approach similar questions?
          </p>
          <button className="btn-primary" onClick={getExplanation}>
            Get Explanation
          </button>
        </div>
      )}

      {explanation && (
        <div className="explanation-content">
          <section className="explanation-section reasoning">
            <h4>Why You Chose "{studentAnswer}"</h4>
            <p>{explanation.likelyReasoning}</p>
          </section>

          <section className="explanation-section misconception">
            <h4>The Misconception</h4>
            <p>{explanation.misconception}</p>
          </section>

          <section className="explanation-section correct">
            <h4>The Correct Reasoning</h4>
            <p>{explanation.correctExplanation}</p>
          </section>

          <section className="explanation-section insight">
            <div className="key-insight">
              <span className="insight-icon">💡</span>
              <p>
                <strong>Key Insight:</strong> {explanation.keyInsight}
              </p>
            </div>
          </section>

          <section className="explanation-section practice">
            <h4>Practice Advice</h4>
            <p>{explanation.practiceAdvice}</p>
          </section>
        </div>
      )}
    </div>
  );
}
