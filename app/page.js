"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ConceptReview from "@/components/ConceptReview";
import PersonalizedExplanation from "@/components/PersonalizedExplanation";
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
  getQuestionHistory,
} from "@/lib/progress";

const unitLabels = {
  microeconomics: "Microeconomics",
  macroeconomics: "Macroeconomics",
  international_economics: "International Economics",
};

const icons = [
  "📊",
  "📈",
  "💹",
  "🏦",
  "💰",
  "📉",
  "🌍",
  "🏭",
  "💵",
  "📋",
  "🎯",
  "📦",
];

export default function Home() {
  const [concepts, setConcepts] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("practice");
  const [showReview, setShowReview] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [panelExpanded, setPanelExpanded] = useState(false);

  const questionStartTime = useRef(null);

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
  const stats = concepts.length > 0 ? getOverallStats(concepts) : null;
  const history = getQuestionHistory();

  const getLearnedConceptNames = useCallback(() => {
    return concepts.filter((c) => isConceptLearned(c.id)).map((c) => c.name);
  }, [concepts]);

  const generateQuestion = async () => {
    if (!selectedConcept) return;
    if (!prereqStatus.met) {
      setError(
        `Complete prerequisites first: ${prereqStatus.missing.map((c) => c.name).join(", ")}`,
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

    updateConceptProgress(selectedConceptId, isCorrect);

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
    setShowExplanation(false);
    setCurrentHistoryId(null);
    setPanelExpanded(true);
  };

  const handlePracticeWeakest = () => {
    const weakest = findWeakestConcept(concepts);
    if (weakest) handleSelectConcept(weakest.id);
  };

  const handlePracticeRecommended = () => {
    const recommended = getRecommendedConcept(concepts);
    if (recommended) handleSelectConcept(recommended.id);
  };

  const getOptionClass = (optionKey) => {
    let classes = "option";
    if (!isSubmitted) {
      if (selectedAnswer === optionKey) classes += " selected";
    } else {
      if (optionKey === question.correct) classes += " correct";
      else if (optionKey === selectedAnswer) classes += " incorrect";
    }
    return classes;
  };

  const getBadgeInfo = (concept) => {
    const progress = getConceptProgress(concept.id);
    const prereqs = arePrerequisitesMet(concept, concepts);

    if (!prereqs.met) return { class: "locked", label: "Locked" };
    if (progress.confidence >= 70 && progress.attempts >= 3)
      return { class: "mastered", label: "Mastered" };
    if (progress.attempts > 0)
      return { class: "learning", label: `${progress.confidence}%` };
    return { class: "new", label: "New" };
  };

  const getProgressClass = (confidence) => {
    if (confidence >= 70) return "";
    if (confidence >= 40) return "medium";
    return "low";
  };

  // Group concepts by unit
  const groupedConcepts = concepts.reduce((acc, concept) => {
    if (!acc[concept.unit]) acc[concept.unit] = [];
    acc[concept.unit].push(concept);
    return acc;
  }, {});

  const isIncorrect = isSubmitted && selectedAnswer !== question?.correct;

  return (
    <div className="app" key={refreshKey}>
      {/* Header */}
      <header className="header">
        <div className="logo">
          IB <span>Economics</span>
        </div>

        <nav className="nav">
          <button
            className={`nav-btn ${activeTab === "practice" ? "active" : ""}`}
            onClick={() => setActiveTab("practice")}
          >
            Practice
          </button>
          <button
            className={`nav-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
          <button
            className={`nav-btn ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            Stats
          </button>
        </nav>

        <button className="user-btn">S</button>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-label">Mastered</div>
            <div className="stat-value success">{stats.conceptsMastered}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In Progress</div>
            <div className="stat-value">
              {stats.conceptsAttempted - stats.conceptsMastered}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Remaining</div>
            <div className="stat-value">
              {stats.totalConcepts - stats.conceptsAttempted}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Accuracy</div>
            <div className="stat-value accent">{stats.overallAccuracy}%</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {activeTab === "practice" && (
        <div className="main-grid">
          {/* Concepts List */}
          <div className="concepts-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Concepts</h2>
                <p className="section-subtitle">Select a concept to practice</p>
              </div>
            </div>

            {Object.entries(groupedConcepts).map(([unit, unitConcepts]) => (
              <div key={unit} className="unit-group">
                <div className="unit-label">{unitLabels[unit]}</div>
                <div className="concept-list">
                  {unitConcepts.map((concept, idx) => {
                    const progress = getConceptProgress(concept.id);
                    const badge = getBadgeInfo(concept);
                    const prereqs = arePrerequisitesMet(concept, concepts);
                    const isSelected = selectedConceptId === concept.id;
                    const globalIdx = concepts.findIndex(
                      (c) => c.id === concept.id,
                    );

                    return (
                      <div
                        key={concept.id}
                        className={`concept-item ${isSelected ? "selected" : ""} ${!prereqs.met ? "locked" : ""}`}
                        onClick={() =>
                          prereqs.met && handleSelectConcept(concept.id)
                        }
                      >
                        <div className="concept-icon">
                          {icons[globalIdx % icons.length]}
                        </div>
                        <div className="concept-info">
                          <div className="concept-name">{concept.name}</div>
                          <div className="concept-desc">
                            {concept.description}
                          </div>
                        </div>
                        <div className="concept-meta">
                          <div className="concept-progress">
                            <div
                              className={`concept-progress-fill ${getProgressClass(progress.confidence)}`}
                              style={{ width: `${progress.confidence}%` }}
                            />
                          </div>
                          <span className={`concept-badge ${badge.class}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Practice Panel */}
          <div className={`practice-panel ${panelExpanded ? "expanded" : ""}`}>
            <div
              className="practice-header"
              onClick={() => setPanelExpanded(!panelExpanded)}
            >
              <h2 className="practice-title">Practice</h2>
              <p className="practice-subtitle">
                {selectedConcept ? selectedConcept.name : "Select a concept"}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <button className="quick-btn" onClick={handlePracticeWeakest}>
                Weakest
              </button>
              <button className="quick-btn" onClick={handlePracticeRecommended}>
                Recommended
              </button>
            </div>

            {/* Selected Concept Info */}
            {selectedConcept && conceptProgress && !question && !isLoading && (
              <div className="selected-info">
                <div className="selected-name">{selectedConcept.name}</div>
                <div className="selected-stats">
                  <span>
                    {conceptProgress.correct}/{conceptProgress.attempts} correct
                  </span>
                  <span>{conceptProgress.confidence}% confidence</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Generate Button */}
            {!question && !isLoading && (
              <>
                <button
                  className="btn btn-primary btn-full"
                  onClick={generateQuestion}
                  disabled={!selectedConcept || !prereqStatus.met}
                >
                  Generate Question
                </button>
                {selectedConcept && (
                  <button
                    className="btn btn-secondary btn-full"
                    onClick={() => setShowReview(true)}
                    style={{ marginTop: 8 }}
                  >
                    Review Concept
                  </button>
                )}
              </>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="loading">
                <div className="spinner"></div>
                <span className="loading-text">Generating question...</span>
              </div>
            )}

            {/* Question */}
            {question && (
              <>
                <div className="question-box">
                  <div className="question-text">{question.question}</div>
                </div>

                <div className="options">
                  {Object.entries(question.options).map(([key, value]) => (
                    <div
                      key={key}
                      className={getOptionClass(key)}
                      onClick={() => !isSubmitted && setSelectedAnswer(key)}
                    >
                      <div className="option-key">{key}</div>
                      <div className="option-text">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  {!isSubmitted ? (
                    <button
                      className="btn btn-primary btn-full"
                      onClick={handleSubmit}
                      disabled={!selectedAnswer}
                    >
                      Submit
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={generateQuestion}
                      >
                        Next
                      </button>
                      {isIncorrect && !showExplanation && (
                        <button
                          className="btn btn-warning"
                          onClick={() => setShowExplanation(true)}
                        >
                          Get Help
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Result */}
                {isSubmitted && (
                  <div
                    className={`result ${selectedAnswer === question.correct ? "correct" : "incorrect"}`}
                  >
                    <div className="result-header">
                      <span className="result-icon">
                        {selectedAnswer === question.correct ? "✓" : "✗"}
                      </span>
                      <span className="result-title">
                        {selectedAnswer === question.correct
                          ? "Correct!"
                          : `Answer: ${question.correct}`}
                      </span>
                    </div>
                    <div className="result-text">{question.explanation}</div>
                  </div>
                )}

                {/* Personalized Explanation */}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div style={{ maxWidth: 600 }}>
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            Question History
          </h2>
          {history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📝</div>
              <p className="empty-text">No questions attempted yet</p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={`history-item ${entry.isCorrect ? "correct" : "incorrect"}`}
                >
                  <div className="history-icon">
                    {entry.isCorrect ? "✓" : "✗"}
                  </div>
                  <div className="history-info">
                    <div className="history-concept">{entry.conceptName}</div>
                    <div className="history-date">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && stats && (
        <div style={{ maxWidth: 600 }}>
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            Statistics
          </h2>
          <div className="stats-bar" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="stat-card">
              <div className="stat-label">Total Questions</div>
              <div className="stat-value">{stats.totalAttempts}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Correct Answers</div>
              <div className="stat-value success">{stats.totalCorrect}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Concepts Mastered</div>
              <div className="stat-value accent">{stats.conceptsMastered}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Completion</div>
              <div className="stat-value">{stats.progressPercent}%</div>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (
                window.confirm("Reset all progress? This cannot be undone.")
              ) {
                clearProgress();
                setRefreshKey((prev) => prev + 1);
              }
            }}
            style={{ marginTop: 24 }}
          >
            Reset Progress
          </button>
        </div>
      )}

      {/* Concept Review Modal */}
      {showReview && selectedConcept && (
        <ConceptReview
          concept={selectedConcept}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
