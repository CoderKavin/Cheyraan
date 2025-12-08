"use client";

import { useState } from "react";
import { getQuestionHistory } from "@/lib/progress";

export default function QuestionHistory({ onSelectConcept, onViewExplanation }) {
  const [expandedId, setExpandedId] = useState(null);
  const history = getQuestionHistory();

  if (history.length === 0) {
    return (
      <div className="question-history">
        <h3>Recent Questions</h3>
        <p className="empty-state">No questions attempted yet. Start practicing to see your history here.</p>
      </div>
    );
  }

  const formatTime = (seconds) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="question-history">
      <h3>Recent Questions</h3>
      <div className="history-list">
        {history.map((entry) => (
          <div
            key={entry.id}
            className={`history-item ${entry.isCorrect ? "correct" : "incorrect"}`}
          >
            <div
              className="history-summary"
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            >
              <div className="history-status">
                <span className={`status-indicator ${entry.isCorrect ? "correct" : "incorrect"}`}>
                  {entry.isCorrect ? "✓" : "✗"}
                </span>
              </div>
              <div className="history-info">
                <span className="history-concept">{entry.conceptName}</span>
                <span className="history-meta">
                  {formatDate(entry.timestamp)}
                  {entry.timeTaken && ` · ${formatTime(entry.timeTaken)}`}
                </span>
              </div>
              <span className="expand-indicator">
                {expandedId === entry.id ? "▼" : "▶"}
              </span>
            </div>

            {expandedId === entry.id && (
              <div className="history-details">
                <div className="history-question">
                  <strong>Question:</strong>
                  <p>{entry.question}</p>
                </div>

                <div className="history-answers">
                  <div className={`answer-row ${entry.isCorrect ? "correct" : "student"}`}>
                    <span className="answer-label">Your answer:</span>
                    <span className="answer-text">
                      {entry.studentAnswer}. {entry.options?.[entry.studentAnswer]}
                    </span>
                  </div>
                  {!entry.isCorrect && (
                    <div className="answer-row correct">
                      <span className="answer-label">Correct answer:</span>
                      <span className="answer-text">
                        {entry.correctAnswer}. {entry.options?.[entry.correctAnswer]}
                      </span>
                    </div>
                  )}
                </div>

                {entry.explanation && (
                  <div className="history-explanation">
                    <strong>Original Explanation:</strong>
                    <p>{entry.explanation}</p>
                  </div>
                )}

                {entry.personalizedExplanation && (
                  <div className="history-personalized">
                    <strong>Personalized Feedback:</strong>
                    <div className="personalized-content">
                      <p><em>Why you chose this:</em> {entry.personalizedExplanation.likelyReasoning}</p>
                      <p><em>Key insight:</em> {entry.personalizedExplanation.keyInsight}</p>
                    </div>
                  </div>
                )}

                <div className="history-actions">
                  <button
                    className="btn-small"
                    onClick={() => onSelectConcept(entry.conceptId)}
                  >
                    Practice This Concept
                  </button>
                  {!entry.isCorrect && !entry.personalizedExplanation && (
                    <button
                      className="btn-small btn-explain"
                      onClick={() => onViewExplanation(entry)}
                    >
                      Get Detailed Explanation
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
