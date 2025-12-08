"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProgressDashboard from "@/components/ProgressDashboard";
import PrerequisiteChain from "@/components/PrerequisiteChain";
import QuestionHistory from "@/components/QuestionHistory";
import ConceptReview from "@/components/ConceptReview";
import PersonalizedExplanation from "@/components/PersonalizedExplanation";
import EnhancedStats from "@/components/EnhancedStats";
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
  addQuestionToHistory,
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
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Timer for question
  const questionStartTime = useRef(null);

  // Load knowledge graph on mount
  useEffect(() => {
    fetch("/data/knowledge_graph.json")
      .then((res) => res.json())
      .then((data) => {
        setConcepts(data);
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
    setShowExplanation(false);
    setCurrentHistoryId(null);

    try {
      const response = await fetch("/api/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      questionStartTime.current = Date.now();
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
    const timeTaken = questionStartTime.current
      ? Math.round((Date.now() - questionStartTime.current) / 1000)
      : null;

    // Update progress
    updateConceptProgress(selectedConceptId, isCorrect);

    // Add to history
    const historyEntry = addQuestionToHistory({
      conceptId: selectedConceptId,
      conceptName: selectedConcept.name,
      question: question.question,
      options: question.options,
      studentAnswer: selectedAnswer,
      correctAnswer: question.correct,
      isCorrect,
      timeTaken,
      explanation: question.explanation,
    });

    setCurrentHistoryId(historyEntry.id);
    setRefreshKey((prev) => prev + 1);
  };

  const handleSelectConcept = (conceptId) => {
    setSelectedConceptId(conceptId);
    setQuestion(null);
    setSelectedAnswer("");
    setIsSubmitted(false);
    setError(null);
    setShowDashboard(false);
    setShowHistory(false);
    setShowStats(false);
    setShowExplanation(false);
    setCurrentHistoryId(null);
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

  const handleViewExplanationFromHistory = (entry) => {
    // Find the concept
    const concept = concepts.find((c) => c.id === entry.conceptId);
    if (concept) {
      setSelectedConceptId(entry.conceptId);
      setQuestion({
        question: entry.question,
        options: entry.options,
        correct: entry.correctAnswer,
        explanation: entry.explanation,
      });
      setSelectedAnswer(entry.studentAnswer);
      setIsSubmitted(true);
      setCurrentHistoryId(entry.id);
      setShowHistory(false);
      setShowExplanation(true);
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

  const groupedConcepts = concepts.reduce((acc, concept) => {
    if (!acc[concept.unit]) {
      acc[concept.unit] = [];
    }
    acc[concept.unit].push(concept);
    return acc;
  }, {});

  const isIncorrect = isSubmitted && selectedAnswer !== question?.correct;

  return (
    <div className="container" key={refreshKey}>
      <header className="app-header">
        <h1>IB Economics HL Adaptive Learning</h1>
        <div className="header-actions">
          <button
            className={`btn-secondary ${showStats ? "active" : ""}`}
            onClick={() => {
              setShowStats(!showStats);
              setShowDashboard(false);
              setShowHistory(false);
            }}
          >
            Analytics
          </button>
          <button
            className={`btn-secondary ${showHistory ? "active" : ""}`}
            onClick={() => {
              setShowHistory(!showHistory);
              setShowDashboard(false);
              setShowStats(false);
            }}
          >
            History
          </button>
          <button
            className={`btn-secondary ${showDashboard ? "active" : ""}`}
            onClick={() => {
              setShowDashboard(!showDashboard);
              setShowHistory(false);
              setShowStats(false);
            }}
          >
            Dashboard
          </button>
          <button className="btn-danger-small" onClick={handleResetProgress}>
            Reset
          </button>
        </div>
      </header>

      {stats && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-value">{stats.conceptsMastered}</span>
            <span className="stat-label">Mastered</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalConcepts}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.overallAccuracy}%</span>
            <span className="stat-label">Accuracy</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalAttempts}</span>
            <span className="stat-label">Questions</span>
          </div>
          <div className="progress-mini">
            <div
              className="progress-mini-fill"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {showStats && (
        <EnhancedStats
          concepts={concepts}
          onSelectConcept={handleSelectConcept}
        />
      )}

      {showHistory && (
        <QuestionHistory
          onSelectConcept={handleSelectConcept}
          onViewExplanation={handleViewExplanationFromHistory}
        />
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
              Practice Weakest
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
                  ({conceptProgress.confidence}%)
                </span>
                {conceptProgress.attempts < 3 && (
                  <span className="attempts-note">
                    ({3 - conceptProgress.attempts} more for mastery check)
                  </span>
                )}
              </div>
            )}

            <div className="concept-actions">
              <button
                className="btn-link"
                onClick={() => setShowPrereqChain(!showPrereqChain)}
              >
                {showPrereqChain ? "Hide" : "Show"} Learning Path
              </button>
              <button className="btn-link" onClick={() => setShowReview(true)}>
                Review Concept
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
                    Complete these first:{" "}
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
            <span>Generating adaptive question...</span>
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
                  Difficulty: {question.adaptedDifficulty}/5
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
                <div className="post-submit-actions">
                  <button onClick={generateQuestion} className="btn-primary">
                    Next Question
                  </button>
                  {isIncorrect && !showExplanation && (
                    <button
                      onClick={() => setShowExplanation(true)}
                      className="btn-explain"
                    >
                      Get Detailed Explanation
                    </button>
                  )}
                </div>
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
                      <span className="result-icon">✗</span> Incorrect - Answer
                      is {question.correct}
                    </>
                  )}
                </h3>
                <div className="explanation">
                  <strong>Explanation:</strong>
                  <p>{question.explanation}</p>
                </div>
                {conceptProgress && (
                  <div className="updated-progress">
                    Progress: {conceptProgress.correct}/
                    {conceptProgress.attempts} ({conceptProgress.confidence}%)
                    {isConceptLearned(selectedConceptId) && (
                      <span className="mastered-badge">Mastered!</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {showExplanation && isIncorrect && (
              <PersonalizedExplanation
                concept={selectedConcept}
                question={question.question}
                studentAnswer={selectedAnswer}
                correctAnswer={question.correct}
                options={question.options}
                historyId={currentHistoryId}
                onClose={() => setShowExplanation(false)}
              />
            )}
          </div>
        )}
      </div>

      {showReview && selectedConcept && (
        <ConceptReview
          concept={selectedConcept}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
