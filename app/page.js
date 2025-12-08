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
  international_economics: "International",
};

const unitShort = {
  microeconomics: "micro",
  macroeconomics: "macro",
  international_economics: "intl",
};

const conceptIcons = [
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
  const mastery = selectedConceptId ? getMasteryLevel(selectedConceptId) : null;
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
  };

  const handlePracticeWeakest = () => {
    const weakest = findWeakestConcept(concepts);
    if (weakest) handleSelectConcept(weakest.id);
  };

  const handlePracticeRecommended = () => {
    const recommended = getRecommendedConcept(concepts);
    if (recommended) handleSelectConcept(recommended.id);
  };

  const handleResetProgress = () => {
    if (window.confirm("Reset all progress? This cannot be undone.")) {
      clearProgress();
      setRefreshKey((prev) => prev + 1);
    }
  };

  const getOptionClass = (optionKey) => {
    let classes = "option-item";
    if (!isSubmitted) {
      if (selectedAnswer === optionKey) classes += " selected";
    } else {
      if (optionKey === question.correct) classes += " correct";
      else if (optionKey === selectedAnswer) classes += " incorrect";
    }
    return classes;
  };

  const getConceptIcon = (index) => conceptIcons[index % conceptIcons.length];

  const getCardColor = (index) => {
    const colors = ["pink", "green", "purple", "yellow"];
    return colors[index % colors.length];
  };

  const getProgressClass = (confidence) => {
    if (confidence >= 70) return "high";
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
    <div className="app-container" key={refreshKey}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">IB</div>
          <span className="sidebar-logo-text">EconMaster</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "practice" ? "active" : ""}`}
            onClick={() => setActiveTab("practice")}
          >
            <span className="nav-item-icon">📝</span>
            Practice
          </button>
          <button
            className={`nav-item ${activeTab === "concepts" ? "active" : ""}`}
            onClick={() => setActiveTab("concepts")}
          >
            <span className="nav-item-icon">📚</span>
            Concepts
          </button>
          <button
            className={`nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <span className="nav-item-icon">📋</span>
            History
          </button>
          <button
            className={`nav-item ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            <span className="nav-item-icon">📊</span>
            Analytics
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">S</div>
            <div className="user-info">
              <div className="user-name">IB Student</div>
              <div className="user-role">Economics HL</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <h1 className="page-title">
            {activeTab === "practice" && (
              <>
                My Learning Plan <span className="page-title-emoji">📖</span>
              </>
            )}
            {activeTab === "concepts" && (
              <>
                All Concepts <span className="page-title-emoji">📚</span>
              </>
            )}
            {activeTab === "history" && (
              <>
                Question History <span className="page-title-emoji">📋</span>
              </>
            )}
            {activeTab === "analytics" && (
              <>
                Analytics <span className="page-title-emoji">📊</span>
              </>
            )}
          </h1>
          <div className="header-actions">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search concepts..." />
            </div>
          </div>
        </header>

        {/* Stats Row */}
        {stats && (
          <div className="stats-row">
            <div className="stat-card purple">
              <div className="stat-value">{stats.conceptsMastered}</div>
              <div className="stat-label">Mastered</div>
            </div>
            <div className="stat-card green">
              <div className="stat-value">{stats.conceptsAttempted}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-card pink">
              <div className="stat-value">
                {stats.totalConcepts - stats.conceptsAttempted}
              </div>
              <div className="stat-label">Remaining</div>
            </div>
            <div className="stat-card yellow">
              <div className="stat-value">{stats.overallAccuracy}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="content-grid">
          {/* Left: Concept Cards */}
          <div className="learning-section">
            {activeTab === "practice" && (
              <>
                <div className="section-header">
                  <h2 className="section-title">Select a Concept</h2>
                  <span
                    className="section-action"
                    onClick={() => setActiveTab("concepts")}
                  >
                    View all →
                  </span>
                </div>

                <div className="concept-cards">
                  {Object.entries(groupedConcepts).map(([unit, unitConcepts]) =>
                    unitConcepts.slice(0, 2).map((concept, idx) => {
                      const progress = getConceptProgress(concept.id);
                      const masteryLevel = getMasteryLevel(concept.id);
                      const prereqs = arePrerequisitesMet(concept, concepts);
                      const isSelected = selectedConceptId === concept.id;
                      const globalIdx = concepts.findIndex(
                        (c) => c.id === concept.id,
                      );

                      return (
                        <div
                          key={concept.id}
                          className={`concept-card ${getCardColor(globalIdx)} ${isSelected ? "selected" : ""} ${!prereqs.met ? "locked" : ""}`}
                          onClick={() =>
                            prereqs.met && handleSelectConcept(concept.id)
                          }
                        >
                          <div className="concept-card-header">
                            <div className="concept-icon">
                              {getConceptIcon(globalIdx)}
                            </div>
                            <div
                              className={`concept-status ${masteryLevel.level}`}
                            >
                              {!prereqs.met ? "🔒 Locked" : masteryLevel.label}
                            </div>
                          </div>
                          <h3 className="concept-title">{concept.name}</h3>
                          <p className="concept-description">
                            {concept.description}
                          </p>
                          <div className="concept-footer">
                            <div className="concept-progress">
                              <div className="progress-bar">
                                <div
                                  className={`progress-fill ${getProgressClass(progress.confidence)}`}
                                  style={{ width: `${progress.confidence}%` }}
                                />
                              </div>
                              <span className="progress-text">
                                {progress.confidence}%
                              </span>
                            </div>
                            <span className={`unit-tag ${unitShort[unit]}`}>
                              {unitLabels[unit]}
                            </span>
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              </>
            )}

            {activeTab === "concepts" && (
              <>
                {Object.entries(groupedConcepts).map(([unit, unitConcepts]) => (
                  <div key={unit}>
                    <div className="section-header">
                      <h2 className="section-title">{unitLabels[unit]}</h2>
                      <span className="section-action">
                        {unitConcepts.length} concepts
                      </span>
                    </div>
                    <div className="concept-cards">
                      {unitConcepts.map((concept, idx) => {
                        const progress = getConceptProgress(concept.id);
                        const masteryLevel = getMasteryLevel(concept.id);
                        const prereqs = arePrerequisitesMet(concept, concepts);
                        const isSelected = selectedConceptId === concept.id;

                        return (
                          <div
                            key={concept.id}
                            className={`concept-card ${getCardColor(idx)} ${isSelected ? "selected" : ""} ${!prereqs.met ? "locked" : ""}`}
                            onClick={() =>
                              prereqs.met && handleSelectConcept(concept.id)
                            }
                          >
                            <div className="concept-card-header">
                              <div className="concept-icon">
                                {getConceptIcon(idx)}
                              </div>
                              <div
                                className={`concept-status ${masteryLevel.level}`}
                              >
                                {!prereqs.met
                                  ? "🔒 Locked"
                                  : masteryLevel.label}
                              </div>
                            </div>
                            <h3 className="concept-title">{concept.name}</h3>
                            <p className="concept-description">
                              {concept.description}
                            </p>
                            <div className="concept-footer">
                              <div className="concept-progress">
                                <div className="progress-bar">
                                  <div
                                    className={`progress-fill ${getProgressClass(progress.confidence)}`}
                                    style={{ width: `${progress.confidence}%` }}
                                  />
                                </div>
                                <span className="progress-text">
                                  {progress.confidence}%
                                </span>
                              </div>
                              <span className="concept-level">
                                Level {concept.difficulty}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeTab === "history" && (
              <>
                <div className="section-header">
                  <h2 className="section-title">Recent Questions</h2>
                </div>
                {history.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
                    <p className="empty-state-text">
                      No questions attempted yet
                    </p>
                  </div>
                ) : (
                  <div className="history-list">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className={`history-item ${entry.isCorrect ? "correct" : "incorrect"}`}
                      >
                        <div className="history-status">
                          {entry.isCorrect ? "✓" : "✗"}
                        </div>
                        <div className="history-content">
                          <div className="history-concept">
                            {entry.conceptName}
                          </div>
                          <div className="history-time">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "analytics" && (
              <>
                <div className="section-header">
                  <h2 className="section-title">Performance Overview</h2>
                </div>
                <div className="dashboard-grid">
                  <div className="dashboard-card">
                    <div className="dashboard-card-title">
                      Questions Answered
                    </div>
                    <div className="stat-value">
                      {stats?.totalAttempts || 0}
                    </div>
                  </div>
                  <div className="dashboard-card">
                    <div className="dashboard-card-title">Correct Answers</div>
                    <div className="stat-value">{stats?.totalCorrect || 0}</div>
                  </div>
                  <div className="dashboard-card">
                    <div className="dashboard-card-title">
                      Concepts Mastered
                    </div>
                    <div className="stat-value">
                      {stats?.conceptsMastered || 0}
                    </div>
                  </div>
                  <div className="dashboard-card">
                    <div className="dashboard-card-title">Completion</div>
                    <div className="stat-value">
                      {stats?.progressPercent || 0}%
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleResetProgress}
                  style={{ marginTop: 20 }}
                >
                  Reset All Progress
                </button>
              </>
            )}
          </div>

          {/* Right: Practice Panel */}
          <div className="practice-panel">
            <div className="practice-card">
              <div className="practice-header">
                <h2 className="practice-title">
                  Practice <span className="page-title-emoji">✨</span>
                </h2>
                {selectedConcept && (
                  <span className="question-badge">
                    Level {selectedConcept.difficulty}
                  </span>
                )}
              </div>

              {/* Quick Actions */}
              <div className="quick-actions">
                <button
                  className="quick-action-btn"
                  onClick={handlePracticeWeakest}
                >
                  <div className="quick-action-icon">🎯</div>
                  <div className="quick-action-label">Weakest Topic</div>
                </button>
                <button
                  className="quick-action-btn"
                  onClick={handlePracticeRecommended}
                >
                  <div className="quick-action-icon">⭐</div>
                  <div className="quick-action-label">Recommended</div>
                </button>
              </div>

              {/* Selected Concept Info */}
              {selectedConcept && !question && !isLoading && (
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 8 }}>
                    {selectedConcept.name}
                  </h3>
                  <span
                    className={`unit-tag ${unitShort[selectedConcept.unit]}`}
                  >
                    {unitLabels[selectedConcept.unit]}
                  </span>
                  {conceptProgress?.attempts > 0 && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        marginTop: 12,
                      }}
                    >
                      Progress: {conceptProgress.correct}/
                      {conceptProgress.attempts} ({conceptProgress.confidence}%)
                    </p>
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowReview(true)}
                    style={{ marginTop: 12, marginRight: 8 }}
                  >
                    Review Concept
                  </button>
                </div>
              )}

              {/* Generate Button */}
              {!question && !isLoading && (
                <button
                  className="btn btn-primary btn-full"
                  onClick={generateQuestion}
                  disabled={!selectedConcept || !prereqStatus.met}
                >
                  Generate Question
                </button>
              )}

              {/* Loading */}
              {isLoading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span className="loading-text">Generating question...</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="error-state">
                  <span className="error-icon">⚠️</span>
                  <span className="error-message">{error}</span>
                </div>
              )}

              {/* Question */}
              {question && (
                <>
                  <div className="question-text">{question.question}</div>

                  <div className="options-list">
                    {Object.entries(question.options).map(([key, value]) => (
                      <div
                        key={key}
                        className={getOptionClass(key)}
                        onClick={() => !isSubmitted && setSelectedAnswer(key)}
                      >
                        <div className="option-letter">{key}</div>
                        <div className="option-text">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Submit / Next */}
                  <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                    {!isSubmitted ? (
                      <button
                        className="btn btn-primary btn-full"
                        onClick={handleSubmit}
                        disabled={!selectedAnswer}
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={generateQuestion}
                        >
                          Next Question
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
                      className={`result-card ${selectedAnswer === question.correct ? "correct" : "incorrect"}`}
                    >
                      <div className="result-header">
                        <span className="result-icon">
                          {selectedAnswer === question.correct ? "✅" : "❌"}
                        </span>
                        <span className="result-title">
                          {selectedAnswer === question.correct
                            ? "Correct!"
                            : `Incorrect — Answer: ${question.correct}`}
                        </span>
                      </div>
                      <div className="result-explanation">
                        {question.explanation}
                      </div>
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
        </div>
      </main>

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
