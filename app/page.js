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

const cardColors = ["purple", "green", "yellow", "pink", "mint", "white"];
const cardIcons = ["📊", "📈", "💹", "🏦", "💰", "📉", "🌍", "🏭", "💵", "📋"];

// Floating card positions for the scattered layout
const cardPositions = [
  { top: 0, left: 0 },
  { top: 180, left: 360 },
  { top: 60, left: 720 },
  { top: 360, left: 80 },
  { top: 420, left: 440 },
  { top: 540, left: 160 },
];

export default function Home() {
  const [concepts, setConcepts] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPractice, setShowPractice] = useState(false);
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
  const stats = concepts.length > 0 ? getOverallStats(concepts) : null;

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
    setShowPractice(true);
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
    let classes = "option-item";
    if (!isSubmitted) {
      if (selectedAnswer === optionKey) classes += " selected";
    } else {
      if (optionKey === question.correct) classes += " correct";
      else if (optionKey === selectedAnswer) classes += " incorrect";
    }
    return classes;
  };

  const getStatusInfo = (concept) => {
    const progress = getConceptProgress(concept.id);
    const prereqs = arePrerequisitesMet(concept, concepts);

    if (!prereqs.met) return { class: "locked", label: "Locked 🔒" };
    if (progress.confidence >= 70 && progress.attempts >= 3)
      return { class: "completed", label: "Completed 👏" };
    if (progress.attempts > 0)
      return {
        class: "in-progress",
        label: `Watching ${Math.floor(progress.confidence / 10)}:${String(progress.confidence % 10).padStart(2, "0")}`,
      };
    return { class: "upcoming", label: "Upcoming ⏰" };
  };

  // Get 6 concepts to display as floating cards
  const displayConcepts = concepts.slice(0, 6);

  const isIncorrect = isSubmitted && selectedAnswer !== question?.correct;

  return (
    <div className="app-container" key={refreshKey}>
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-logo">IB Econ</div>

        <div className="nav-center">
          <button className="nav-item active">
            <span className="nav-item-icon">📖</span>
            Learning Plan
          </button>
          <button className="nav-item">
            <span className="nav-item-icon">👥</span>
          </button>
          <button className="nav-item">
            <span className="nav-item-icon">✓</span>
          </button>
          <button className="nav-item">
            <span className="nav-item-icon">📁</span>
          </button>
          <button className="nav-item">
            <span className="nav-item-icon">⚙️</span>
          </button>
        </div>

        <div className="nav-right">
          <div className="user-profile-nav">
            <div className="user-info-nav">
              <div className="user-name-nav">IB Student</div>
              <div className="user-email-nav">student@ib.edu</div>
            </div>
            <div className="user-avatar">S</div>
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Left Section - Learning Plan */}
        <div className="learning-section">
          <div className="page-header">
            <h1 className="page-title">
              My Learning Plan <span className="page-title-emoji">📚</span>
            </h1>
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search" />
            </div>
          </div>

          {/* Stats Summary */}
          {stats && (
            <div className="stats-summary">
              <span className="stats-summary-icon">🎉</span>
              <div className="stat-item">
                <div className="stat-number">{stats.totalConcepts}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-number">{stats.conceptsMastered}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-number">
                  {stats.totalConcepts - stats.conceptsAttempted}
                </div>
                <div className="stat-label">Upcoming</div>
              </div>
            </div>
          )}

          {/* Floating Concept Cards */}
          <div className="cards-container">
            {displayConcepts.map((concept, index) => {
              const status = getStatusInfo(concept);
              const isSelected = selectedConceptId === concept.id;
              const prereqs = arePrerequisitesMet(concept, concepts);
              const pos = cardPositions[index] || {
                top: index * 200,
                left: (index % 3) * 350,
              };

              return (
                <div
                  key={concept.id}
                  className={`concept-card ${cardColors[index % cardColors.length]} ${isSelected ? "selected" : ""} ${!prereqs.met ? "locked" : ""}`}
                  style={{ top: pos.top, left: pos.left }}
                  onClick={() => prereqs.met && handleSelectConcept(concept.id)}
                >
                  <div className="card-header">
                    <div className="card-icon">
                      {cardIcons[index % cardIcons.length]}
                    </div>
                    {index === 2 && <div className="card-badge">🧠</div>}
                    {index === 4 && <div className="card-badge">🔒</div>}
                  </div>

                  <h3 className="card-title">{concept.name}</h3>
                  <p className="card-description">{concept.description}</p>

                  <div className="card-footer">
                    <span className={`card-status ${status.class}`}>
                      {status.label}
                    </span>
                    <div className="card-actions">
                      <button className="card-action-btn secondary">•••</button>
                      <button className="card-action-btn secondary">✕</button>
                      <button className="card-action-btn primary">✓</button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Media Card Example */}
            {concepts[6] && (
              <div
                className="concept-card purple media-card"
                style={{ top: 120, left: 0 }}
                onClick={() => {
                  const prereqs = arePrerequisitesMet(concepts[6], concepts);
                  if (prereqs.met) handleSelectConcept(concepts[6].id);
                }}
              >
                <div className="media-preview">
                  <div className="media-play-btn">▶</div>
                  <div className="media-decorations">
                    <span className="media-decoration">🎵</span>
                    <span className="media-decoration">🎶</span>
                  </div>
                </div>
                <h3 className="card-title">{concepts[6].name}</h3>
                <p className="card-description">{concepts[6].description}</p>
                <div className="card-footer">
                  <div className="watching-badge">
                    <span className="icon">⏱</span>
                    Watching 00:30
                  </div>
                  <div className="avatar-stack">
                    <div className="avatar">👩</div>
                    <div className="avatar">👨</div>
                    <div className="avatar">👩‍🦱</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Events */}
        <div className="events-section">
          <div className="events-header">
            <h2 className="events-title">My Events</h2>
            <span className="events-emoji">🤯</span>
          </div>

          <div className="events-list">
            <div className="event-card">
              <div className="event-header">
                <div className="event-type">
                  <span className="event-type-icon">📹</span>
                  Webinar
                </div>
                <div className="event-date">Tu, 25.03</div>
              </div>
              <p className="event-description">
                Understanding economic research, critical appraisal skills, and
                applying evidence-based guidelines in practice
              </p>
              <div className="event-time">
                <span>⏰</span>
                Start at 12:30
              </div>
            </div>

            <div className="event-card">
              <div className="event-header">
                <div className="event-type">
                  <span className="event-type-icon">📊</span>
                  Lesson
                </div>
                <div className="event-date">We, 26.03</div>
              </div>
              <p className="event-description">
                Overview of market structures, price mechanisms, and their
                impact on resource allocation.
              </p>
            </div>

            <div className="event-card pink">
              <div className="event-header">
                <div className="event-type">
                  <span className="event-type-icon">✨</span>
                  Task
                </div>
                <div className="event-date">Th, 27.03</div>
              </div>
              <p className="event-description">
                Examination of major global economic issues, including trade
                policies, exchange rates, and balance of payments.
              </p>
            </div>

            <div className="event-card green">
              <div className="event-header">
                <div className="event-type">
                  <span className="event-type-icon">✨</span>
                  Task
                </div>
                <div className="event-date">Fr, 28.03</div>
              </div>
              <p className="event-description">
                Importance of fiscal and monetary policies for optimal economic
                outcomes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Side Mini Navigation */}
      <div className="side-mini-nav">
        <button className="mini-nav-btn active">🔑</button>
        <button className="mini-nav-btn">☰</button>
        <button className="mini-nav-btn">⊞</button>
        <button className="mini-nav-btn notification-badge" data-count="29">
          🔔
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button className="zoom-btn">+</button>
        <button className="zoom-btn">−</button>
      </div>

      {/* Floating Toolbar */}
      <div className="floating-toolbar">
        <button className="toolbar-btn blue">T</button>
        <button className="toolbar-btn purple">A</button>
        <button className="toolbar-btn red">💬</button>
        <button className="toolbar-btn green">📋</button>
        <button className="toolbar-btn yellow">🎧</button>
        <button className="toolbar-btn gray">😊</button>
        <button className="toolbar-btn gray">+</button>
      </div>

      {/* Practice Panel */}
      <div className={`practice-panel ${showPractice ? "active" : ""}`}>
        <div className="practice-header">
          <h2 className="practice-title">
            {selectedConcept ? selectedConcept.name : "Practice"}
          </h2>
          <button
            className="practice-close"
            onClick={() => setShowPractice(false)}
          >
            ✕
          </button>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={handlePracticeWeakest}>
            🎯 Weakest
          </button>
          <button
            className="quick-action-btn"
            onClick={handlePracticeRecommended}
          >
            ⭐ Recommended
          </button>
          <button
            className="quick-action-btn"
            onClick={() => setShowReview(true)}
          >
            📖 Review
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
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

        {/* Question */}
        {question && (
          <>
            <div className="question-box">
              <div className="question-text">{question.question}</div>
            </div>

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
            <div style={{ display: "flex", gap: 8 }}>
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
                <div className="result-explanation">{question.explanation}</div>
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
