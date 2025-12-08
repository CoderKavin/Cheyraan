"use client";

import { useState } from "react";
import {
  getOverallStats,
  getLearningVelocity,
  getStudyPath,
  buildDependencyGraph,
  getConceptsByMasteryStatus,
} from "@/lib/progress";

const unitLabels = {
  microeconomics: "Micro",
  macroeconomics: "Macro",
  international_economics: "Intl",
};

const unitColors = {
  microeconomics: "#3b82f6",
  macroeconomics: "#22c55e",
  international_economics: "#f59e0b",
};

export default function EnhancedStats({ concepts, onSelectConcept }) {
  const [daysUntilExam, setDaysUntilExam] = useState(30);
  const [showGraph, setShowGraph] = useState(false);

  const stats = getOverallStats(concepts);
  const velocity = getLearningVelocity(concepts);
  const studyPath = getStudyPath(concepts, daysUntilExam);
  const graphData = buildDependencyGraph(concepts);
  const byStatus = getConceptsByMasteryStatus(concepts);

  return (
    <div className="enhanced-stats">
      <h2>Learning Analytics</h2>

      {/* Velocity Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{velocity.velocity}</div>
          <div className="stat-label">Concepts/Day</div>
          <div className="stat-subtitle">Learning velocity</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{velocity.daysActive}</div>
          <div className="stat-label">Active Days</div>
          <div className="stat-subtitle">Days with progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.conceptsMastered}</div>
          <div className="stat-label">Mastered</div>
          <div className="stat-subtitle">of {stats.totalConcepts} concepts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.overallAccuracy}%</div>
          <div className="stat-label">Accuracy</div>
          <div className="stat-subtitle">{stats.totalAttempts} questions</div>
        </div>
      </div>

      {/* Mastery Breakdown */}
      <div className="mastery-breakdown">
        <h3>Concept Mastery</h3>
        <div className="mastery-bars">
          <div className="mastery-bar-row">
            <span className="bar-label">Mastered</span>
            <div className="bar-container">
              <div
                className="bar-fill mastered"
                style={{
                  width: `${(byStatus.mastered.length / concepts.length) * 100}%`,
                }}
              />
            </div>
            <span className="bar-count">{byStatus.mastered.length}</span>
          </div>
          <div className="mastery-bar-row">
            <span className="bar-label">Learning</span>
            <div className="bar-container">
              <div
                className="bar-fill learning"
                style={{
                  width: `${(byStatus.learning.length / concepts.length) * 100}%`,
                }}
              />
            </div>
            <span className="bar-count">{byStatus.learning.length}</span>
          </div>
          <div className="mastery-bar-row">
            <span className="bar-label">Struggling</span>
            <div className="bar-container">
              <div
                className="bar-fill struggling"
                style={{
                  width: `${(byStatus.struggling.length / concepts.length) * 100}%`,
                }}
              />
            </div>
            <span className="bar-count">{byStatus.struggling.length}</span>
          </div>
          <div className="mastery-bar-row">
            <span className="bar-label">Not Started</span>
            <div className="bar-container">
              <div
                className="bar-fill not-started"
                style={{
                  width: `${(byStatus.notStarted.length / concepts.length) * 100}%`,
                }}
              />
            </div>
            <span className="bar-count">{byStatus.notStarted.length}</span>
          </div>
        </div>
      </div>

      {/* Study Path Planner */}
      <div className="study-path-section">
        <h3>Study Path Planner</h3>
        <div className="exam-countdown">
          <label>Days until exam:</label>
          <input
            type="number"
            min="1"
            max="365"
            value={daysUntilExam}
            onChange={(e) => setDaysUntilExam(parseInt(e.target.value) || 30)}
          />
        </div>

        <div className="path-summary">
          <p>
            <strong>{studyPath.totalRemaining}</strong> concepts remaining ·{" "}
            <strong>{studyPath.conceptsPerDay}</strong> concepts/day needed ·{" "}
            <strong>{studyPath.daysNeeded}</strong> days to complete
          </p>
        </div>

        {studyPath.urgentConcepts.length > 0 && (
          <div className="urgent-concepts">
            <h4>Priority Focus (Struggling Concepts)</h4>
            <div className="concept-chips">
              {studyPath.urgentConcepts.slice(0, 5).map((concept) => (
                <button
                  key={concept.id}
                  className="concept-chip urgent"
                  onClick={() => onSelectConcept(concept.id)}
                >
                  {concept.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {studyPath.dailyTargets.length > 0 && (
          <div className="daily-targets">
            <h4>Today's Targets</h4>
            <div className="concept-chips">
              {studyPath.dailyTargets[0]?.map((concept) => (
                <button
                  key={concept.id}
                  className="concept-chip"
                  onClick={() => onSelectConcept(concept.id)}
                >
                  {concept.name}
                  <span className="chip-level">Lvl {concept.difficulty}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dependency Graph */}
      <div className="dependency-graph-section">
        <div className="graph-header">
          <h3>Concept Dependencies</h3>
          <button
            className="btn-secondary btn-small"
            onClick={() => setShowGraph(!showGraph)}
          >
            {showGraph ? "Hide Graph" : "Show Graph"}
          </button>
        </div>

        {showGraph && (
          <div className="dependency-graph">
            <div className="graph-legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#22c55e" }} />
                Mastered
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#eab308" }} />
                Learning
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#ef4444" }} />
                Struggling
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#9ca3af" }} />
                Not Started
              </span>
            </div>

            <div className="graph-units">
              {["microeconomics", "macroeconomics", "international_economics"].map(
                (unit) => {
                  const unitNodes = graphData.nodes.filter((n) => n.unit === unit);
                  return (
                    <div key={unit} className="graph-unit">
                      <h4 style={{ color: unitColors[unit] }}>
                        {unitLabels[unit]}
                      </h4>
                      <div className="graph-nodes">
                        {unitNodes.map((node) => {
                          const incomingEdges = graphData.edges.filter(
                            (e) => e.to === node.id
                          );
                          const outgoingEdges = graphData.edges.filter(
                            (e) => e.from === node.id
                          );

                          return (
                            <div
                              key={node.id}
                              className="graph-node"
                              style={{ borderColor: node.color }}
                              onClick={() => onSelectConcept(node.id)}
                              title={`${node.name}\nPrereqs: ${incomingEdges.length} | Unlocks: ${outgoingEdges.length}`}
                            >
                              <span
                                className="node-dot"
                                style={{ background: node.color }}
                              />
                              <span className="node-name">{node.name}</span>
                              <span className="node-stats">
                                {node.attempts > 0 ? `${node.confidence}%` : "—"}
                              </span>
                              {outgoingEdges.length > 0 && (
                                <span className="node-unlocks">
                                  → {outgoingEdges.length}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
