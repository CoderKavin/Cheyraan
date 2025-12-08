"use client";

import { useState } from "react";
import { getConceptProgress } from "@/lib/progress";

export default function ConceptReview({ concept, onClose }) {
  const [review, setReview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateReview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userPerformance = getConceptProgress(concept.id);

      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, userPerformance }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate review");
      }

      const data = await response.json();
      setReview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="concept-review-modal">
      <div className="review-overlay" onClick={onClose} />
      <div className="review-content">
        <div className="review-header">
          <h2>Concept Review: {concept.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {!review && !isLoading && (
          <div className="review-intro">
            <p>
              Generate a personalized mini-lesson for <strong>{concept.name}</strong>.
              This review will include:
            </p>
            <ul>
              <li>Clear, exam-ready definition</li>
              <li>Key points you must understand</li>
              <li>Diagram explanations (if applicable)</li>
              <li>Common mistakes to avoid</li>
              <li>IB exam tips</li>
              <li>Real-world example</li>
            </ul>
            <button className="btn-primary" onClick={generateReview}>
              Generate Review
            </button>
          </div>
        )}

        {isLoading && (
          <div className="review-loading">
            <div className="spinner" />
            <p>Generating personalized review...</p>
          </div>
        )}

        {error && (
          <div className="review-error">
            <p>{error}</p>
            <button className="btn-secondary" onClick={generateReview}>
              Try Again
            </button>
          </div>
        )}

        {review && (
          <div className="review-body">
            <section className="review-section definition">
              <h3>Definition</h3>
              <p className="definition-text">{review.definition}</p>
            </section>

            <section className="review-section">
              <h3>Key Points</h3>
              <ul className="key-points-list">
                {review.keyPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </section>

            {review.diagramExplanation && (
              <section className="review-section diagram">
                <h3>Diagram Notes</h3>
                <p>{review.diagramExplanation}</p>
              </section>
            )}

            <section className="review-section mistakes">
              <h3>Common Mistakes</h3>
              <ul className="mistakes-list">
                {review.commonMistakes.map((mistake, i) => (
                  <li key={i}>
                    <span className="mistake-icon">⚠</span>
                    {mistake}
                  </li>
                ))}
              </ul>
            </section>

            <section className="review-section tips">
              <h3>Exam Tips</h3>
              <ul className="tips-list">
                {review.examTips.map((tip, i) => (
                  <li key={i}>
                    <span className="tip-icon">💡</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </section>

            {review.realWorldExample && (
              <section className="review-section example">
                <h3>Real-World Example</h3>
                <p>{review.realWorldExample}</p>
              </section>
            )}

            <div className="review-actions">
              <button className="btn-secondary" onClick={generateReview}>
                Regenerate
              </button>
              <button className="btn-primary" onClick={onClose}>
                Close & Practice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
