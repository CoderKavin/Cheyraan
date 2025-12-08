"use client";

import { useState } from "react";
import {
  getConceptProgress,
  getMasteryLevel,
  isConceptLearned,
  arePrerequisitesMet,
  getOverallStats,
} from "@/lib/progress";

const unitLabels = {
  microeconomics: "Microeconomics",
  macroeconomics: "Macroeconomics",
  international_economics: "International Economics",
};

const unitColors = {
  microeconomics: "#3b82f6",
  macroeconomics: "#22c55e",
  international_economics: "#f59e0b",
};

export default function ProgressDashboard({
  concepts,
  onSelectConcept,
  selectedConceptId,
}) {
  const [expandedUnit, setExpandedUnit] = useState(null);

  const stats = getOverallStats(concepts);

  // Group concepts by unit
  const groupedConcepts = concepts.reduce((acc, concept) => {
    if (!acc[concept.unit]) {
      acc[concept.unit] = [];
    }
    acc[concept.unit].push(concept);
    return acc;
  }, {});

  // Get unit stats
  const getUnitStats = (unitConcepts) => {
    let mastered = 0;
    let attempted = 0;
    for (const concept of unitConcepts) {
      const progress = getConceptProgress(concept.id);
      if (progress.attempts > 0) attempted++;
      if (isConceptLearned(concept.id)) mastered++;
    }
    return { mastered, attempted, total: unitConcepts.length };
  };

  return (
    <div className="progress-dashboard">
      <div className="dashboard-header">
        <h2>Progress Dashboard</h2>
        <div className="overall-stats">
          <div className="stat-pill">
            <span className="stat-number">{stats.conceptsMastered}</span>
            <span className="stat-text">/ {stats.totalConcepts} Mastered</span>
          </div>
          <div className="stat-pill">
            <span className="stat-number">{stats.overallAccuracy}%</span>
            <span className="stat-text">Accuracy</span>
          </div>
          <div className="stat-pill">
            <span className="stat-number">{stats.totalAttempts}</span>
            <span className="stat-text">Questions</span>
          </div>
        </div>
      </div>

      <div className="progress-bar-overall">
        <div
          className="progress-bar-fill"
          style={{ width: `${stats.progressPercent}%` }}
        />
        <span className="progress-bar-text">
          {stats.progressPercent}% Complete
        </span>
      </div>

      <div className="unit-sections">
        {Object.entries(groupedConcepts).map(([unit, unitConcepts]) => {
          const unitStats = getUnitStats(unitConcepts);
          const isExpanded = expandedUnit === unit;

          return (
            <div key={unit} className="unit-section">
              <div
                className="unit-header"
                onClick={() => setExpandedUnit(isExpanded ? null : unit)}
                style={{ borderLeftColor: unitColors[unit] }}
              >
                <div className="unit-title">
                  <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
                  <span>{unitLabels[unit]}</span>
                </div>
                <div className="unit-stats">
                  <span className="unit-progress">
                    {unitStats.mastered}/{unitStats.total}
                  </span>
                  <div className="mini-progress-bar">
                    <div
                      className="mini-progress-fill"
                      style={{
                        width: `${(unitStats.mastered / unitStats.total) * 100}%`,
                        backgroundColor: unitColors[unit],
                      }}
                    />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="concept-grid">
                  {unitConcepts.map((concept) => {
                    const progress = getConceptProgress(concept.id);
                    const mastery = getMasteryLevel(concept.id);
                    const prereqStatus = arePrerequisitesMet(concept, concepts);
                    const isSelected = selectedConceptId === concept.id;

                    return (
                      <div
                        key={concept.id}
                        className={`concept-card ${isSelected ? "selected" : ""} ${!prereqStatus.met ? "locked" : ""}`}
                        onClick={() => prereqStatus.met && onSelectConcept(concept.id)}
                        style={{ borderColor: mastery.color }}
                      >
                        <div className="concept-card-header">
                          <span
                            className="mastery-dot"
                            style={{ backgroundColor: mastery.color }}
                          />
                          <span className="concept-name">{concept.name}</span>
                          {!prereqStatus.met && (
                            <span className="lock-icon" title="Prerequisites not met">
                              🔒
                            </span>
                          )}
                        </div>
                        <div className="concept-card-stats">
                          <span className="difficulty-label">
                            Lvl {concept.difficulty}
                          </span>
                          {progress.attempts > 0 && (
                            <span className="confidence-label">
                              {progress.confidence}% ({progress.correct}/
                              {progress.attempts})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mastery-legend">
        <span className="legend-title">Legend:</span>
        <span className="legend-item">
          <span
            className="legend-dot"
            style={{ backgroundColor: "#22c55e" }}
          />
          Mastered (≥70%)
        </span>
        <span className="legend-item">
          <span
            className="legend-dot"
            style={{ backgroundColor: "#eab308" }}
          />
          Learning (40-70%)
        </span>
        <span className="legend-item">
          <span
            className="legend-dot"
            style={{ backgroundColor: "#ef4444" }}
          />
          Needs Practice (&lt;40%)
        </span>
        <span className="legend-item">
          <span
            className="legend-dot"
            style={{ backgroundColor: "#9ca3af" }}
          />
          Not Attempted
        </span>
      </div>
    </div>
  );
}
