"use client";

import { useState, useEffect, useCallback } from "react";
import ProgressDashboard from "@/components/ProgressDashboard";
import PrerequisiteChain from "@/components/PrerequisiteChain";
import {
  getConceptProgress,
  updateConceptProgress,
  getMasteryLevel,
  arePrerequisitesMet,
  findWeakestConcept,
  getRecommendedConcept,
  isConceptLearned,
  getOverallStats,
  clearProgress,
} from "@/lib/progress";

const unitLabels = {
  microeconomics: "Microeconomics",
  macroeconomics: "Macroeconomics",
  international_economics: "International Economics",
};

export default function Home() {
  const [concepts, setConcepts] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showPrereqChain, setShowPrereqChain] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render after progress update

  // Load knowledge graph on mount
  useEffect(() => {
    fetch("/data/knowledge_graph.json")
      .then((res) => res.json())
      .then((data) => {
        setConcepts(data);
        // Select recommended concept by default
        const recommended = getRecommendedConcept(data);
        if (recommended) {
          setSelectedConceptId(recommended.id);
        } else if (data.length > 0) {
          setSelectedConceptId(data[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load knowledge graph:", err);
        setError("Failed to load knowledge graph");
      });
  }, []);

  const selectedConcept = concepts.find((c) => c.id === selectedConceptId);
  const conceptProgress = selectedConceptId
    ? getConceptProgress(selectedConceptId)
    : null;
  const prereqStatus = selectedConcept
    ? arePrerequisitesMet(selectedConcept, concepts)
    : { met: true, missing: [] };
  const mastery = selectedConceptId ? getMasteryLevel(selectedConceptId) : null;
  const stats = concepts.length > 0 ? getOverallStats(concepts) : null;

  // Get list of learned concept names for API
  const getLearnedConceptNames = useCallback(() => {
    return concepts.filter((c) => isConceptLearned(c.id)).map((c) => c.name);
  }, [concepts]);

  const generateQuestion = async () => {
    if (!selectedConcept) return;

    if (!prereqStatus.met) {
      setError(
        `Please complete prerequisites first: ${prereqStatus.missing.map((c) => c.name).join(", ")}`,
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuestion(null);
    setSelectedAnswer("");
    setIsSubmitted(false);

    try {
      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          concept: selectedConcept,
          userPerformance: conceptProgress,
          learnedConcepts: getLearnedConceptNames(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate question");
      }

      const data = await response.json();
      setQuestion(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedAnswer || !question) return;

    setIsSubmitted(true);
    const isCorrect = selectedAnswer === question.correct;

    // Update progress in localStorage
    updateConceptProgress(selectedConceptId, isCorrect);
    setRefreshKey((prev) => prev + 1); // Force re-render
  };

  const handleSelectConcept = (conceptId) => {
    setSelectedConceptId(conceptId);
    setQuestion(null);
    setSelectedAnswer("");
    setIsSubmitted(false);
    setError(null);
    setShowDashboard(false);
  };

  const handlePracticeWeakest = () => {
    const weakest = findWeakestConcept(concepts);
    if (weakest) {
      handleSelectConcept(weakest.id);
    } else {
      setError("No concepts available to practice");
    }
  };

  const handlePracticeRecommended = () => {
    const recommended = getRecommendedConcept(concepts);
    if (recommended) {
      handleSelectConcept(recommended.id);
    } else {
      setError("No concepts available to practice");
    }
  };

  const handleResetProgress = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all progress? This cannot be undone.",
      )
    ) {
      clearProgress();
      setRefreshKey((prev) => prev + 1);
    }
  };

  const getOptionClass = (optionKey) => {
    if (!isSubmitted) {
      return selectedAnswer === optionKey ? "option selected" : "option";
    }
    if (optionKey === question.correct) {
      return "option correct";
    }
    if (optionKey === selectedAnswer && selectedAnswer !== question.correct) {
      return "option incorrect";
    }
    return "option";
  };

  // Group concepts by unit for dropdown
  const groupedConcepts = concepts.reduce((acc, concept) => {
    if (!acc[concept.unit]) {
      acc[concept.unit] = [];
    }
    acc[concept.unit].push(concept);
    return acc;
  }, {});

  return (
    <div className="container" key={refreshKey}>
      <header className="app-header">
        <h1>IB Economics HL Adaptive Learning</h1>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowDashboard(!showDashboard)}
          >
            {showDashboard ? "Hide Dashboard" : "Progress Dashboard"}
          </button>
          <button className="btn-danger-small" onClick={handleResetProgress}>
            Reset Progress
          </button>
        </div>
      </header>

      {stats && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.conceptsMastered}</span>
            <span className="stat-label">Concepts Mastered</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalConcepts}</span>
            <span className="stat-label">Total Concepts</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.overallAccuracy}%</span>
            <span className="stat-label">Overall Accuracy</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalAttempts}</span>
            <span className="stat-label">Questions Answered</span>
          </div>
          <div className="progress-mini">
            <div
              className="progress-mini-fill"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {showDashboard && (
        <ProgressDashboard
          concepts={concepts}
          onSelectConcept={handleSelectConcept}
          selectedConceptId={selectedConceptId}
        />
      )}

      <div className="main-content">
        <div className="controls-section">
          <div className="adaptive-buttons">
            <button className="btn-adaptive" onClick={handlePracticeWeakest}>
              Practice Weakest Concept
            </button>
            <button
              className="btn-adaptive"
              onClick={handlePracticeRecommended}
            >
              Recommended Next
            </button>
          </div>

          <div className="concept-selector">
            <label htmlFor="concept-select">Select Concept:</label>
            <select
              id="concept-select"
              value={selectedConceptId}
              onChange={(e) => handleSelectConcept(e.target.value)}
            >
              {Object.entries(groupedConcepts).map(([unit, unitConcepts]) => (
                <optgroup key={unit} label={unitLabels[unit] || unit}>
                  {unitConcepts.map((concept) => {
                    const cMastery = getMasteryLevel(concept.id);
                    const cProgress = getConceptProgress(concept.id);
                    const prereqMet = arePrerequisitesMet(
                      concept,
                      concepts,
                    ).met;
                    return (
                      <option
                        key={concept.id}
                        value={concept.id}
                        disabled={!prereqMet}
                      >
                        {!prereqMet ? "🔒 " : ""}
                        {concept.name} (Lvl {concept.difficulty})
                        {cProgress.attempts > 0
                          ? ` - ${cProgress.confidence}%`
                          : ""}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {selectedConcept && (
          <div className="concept-details">
            <div className="concept-header">
              <h2>{selectedConcept.name}</h2>
              <div className="concept-badges">
                <span className={`unit-badge ${selectedConcept.unit}`}>
                  {unitLabels[selectedConcept.unit]}
                </span>
                <span className="difficulty-badge">
                  Level {selectedConcept.difficulty}
                </span>
                {mastery && (
                  <span
                    className="mastery-badge"
                    style={{ backgroundColor: mastery.color }}
                  >
                    {mastery.label}
                  </span>
                )}
              </div>
            </div>

            <p className="concept-description">{selectedConcept.description}</p>

            {conceptProgress && conceptProgress.attempts > 0 && (
              <div className="concept-stats">
                <span>
                  Progress: {conceptProgress.correct}/{conceptProgress.attempts}{" "}
                  correct ({conceptProgress.confidence}%)
                </span>
                {conceptProgress.attempts < 3 && (
                  <span className="attempts-note">
                    ({3 - conceptProgress.attempts} more attempts needed for
                    mastery evaluation)
                  </span>
                )}
              </div>
            )}

            <div className="prereq-toggle">
              <button
                className="btn-link"
                onClick={() => setShowPrereqChain(!showPrereqChain)}
              >
                {showPrereqChain ? "Hide" : "Show"} Learning Path
              </button>
            </div>

            {showPrereqChain && (
              <PrerequisiteChain
                concept={selectedConcept}
                concepts={concepts}
                onSelectConcept={handleSelectConcept}
              />
            )}

            {!prereqStatus.met && (
              <div className="prereq-warning">
                <span className="warning-icon">⚠️</span>
                <div>
                  <strong>Prerequisites Required</strong>
                  <p>
                    Complete these concepts first:{" "}
                    {prereqStatus.missing.map((c, i) => (
                      <button
                        key={c.id}
                        className="prereq-link"
                        onClick={() => handleSelectConcept(c.id)}
                      >
                        {c.name}
                        {i < prereqStatus.missing.length - 1 ? ", " : ""}
                      </button>
                    ))}
                  </p>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <button
                onClick={generateQuestion}
                disabled={isLoading || !prereqStatus.met}
                className="btn-primary"
              >
                {isLoading ? "Generating..." : "Generate Practice Question"}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="loading">
            <div className="spinner" />
            <span>
              Generating {conceptProgress?.attempts >= 3 ? "adaptive" : ""}{" "}
              IB-style question...
            </span>
          </div>
        )}

        {error && (
          <div className="error">
            <span className="error-icon">❌</span>
            {error}
          </div>
        )}

        {question && (
          <div className="question-section">
            <div className="question-header">
              <h2>Question</h2>
              {question.adaptedDifficulty && (
                <span className="adapted-difficulty">
                  Adapted Difficulty: {question.adaptedDifficulty}/5
                </span>
              )}
            </div>
            <p className="question-text">{question.question}</p>

            <div className="options">
              {Object.entries(question.options).map(([key, value]) => (
                <div
                  key={key}
                  className={getOptionClass(key)}
                  onClick={() => !isSubmitted && setSelectedAnswer(key)}
                >
                  <input
                    type="radio"
                    id={`option-${key}`}
                    name="answer"
                    value={key}
                    checked={selectedAnswer === key}
                    onChange={() => setSelectedAnswer(key)}
                    disabled={isSubmitted}
                  />
                  <label htmlFor={`option-${key}`}>
                    <strong>{key}.</strong> {value}
                  </label>
                </div>
              ))}
            </div>

            <div className="submit-section">
              {!isSubmitted ? (
                <button
                  onClick={handleSubmit}
                  disabled={!selectedAnswer}
                  className="btn-primary"
                >
                  Submit Answer
                </button>
              ) : (
                <button onClick={generateQuestion} className="btn-primary">
                  Next Question
                </button>
              )}
            </div>

            {isSubmitted && (
              <div
                className={`result ${
                  selectedAnswer === question.correct ? "correct" : "incorrect"
                }`}
              >
                <h3>
                  {selectedAnswer === question.correct ? (
                    <>
                      <span className="result-icon">✓</span> Correct!
                    </>
                  ) : (
                    <>
                      <span className="result-icon">✗</span> Incorrect - The
                      correct answer is {question.correct}
                    </>
                  )}
                </h3>
                <div className="explanation">
                  <strong>Explanation:</strong>
                  <p>{question.explanation}</p>
                </div>
                {conceptProgress && (
                  <div className="updated-progress">
                    New progress: {conceptProgress.correct}/
                    {conceptProgress.attempts} ({conceptProgress.confidence}%)
                    {isConceptLearned(selectedConceptId) && (
                      <span className="mastered-badge">Mastered!</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
