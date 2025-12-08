"use client";

import {
  getPrerequisiteChain,
  getConceptProgress,
  getMasteryLevel,
  isConceptLearned,
  arePrerequisitesMet,
} from "@/lib/progress";

export default function PrerequisiteChain({
  concept,
  concepts,
  onSelectConcept,
}) {
  if (!concept) return null;

  const prereqStatus = arePrerequisitesMet(concept, concepts);
  const chain = getPrerequisiteChain(concept, concepts);

  // Remove duplicates while preserving order
  const uniqueChain = chain.filter(
    (item, index, self) => index === self.findIndex((t) => t.id === item.id)
  );

  if (uniqueChain.length === 0 && prereqStatus.met) {
    return (
      <div className="prereq-chain">
        <div className="prereq-status success">
          <span className="status-icon">✓</span>
          <span>No prerequisites required - ready to practice!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="prereq-chain">
      <h3>Learning Path for: {concept.name}</h3>

      {!prereqStatus.met && (
        <div className="prereq-status warning">
          <span className="status-icon">⚠️</span>
          <span>
            Complete the prerequisites below before practicing this concept
          </span>
        </div>
      )}

      {prereqStatus.met && uniqueChain.length > 0 && (
        <div className="prereq-status success">
          <span className="status-icon">✓</span>
          <span>All prerequisites met - ready to practice!</span>
        </div>
      )}

      {uniqueChain.length > 0 && (
        <div className="chain-container">
          {uniqueChain.map((prereq, index) => {
            const progress = getConceptProgress(prereq.id);
            const mastery = getMasteryLevel(prereq.id);
            const learned = isConceptLearned(prereq.id);

            return (
              <div key={prereq.id} className="chain-item-wrapper">
                <div
                  className={`chain-item ${learned ? "completed" : "pending"}`}
                  onClick={() => onSelectConcept(prereq.id)}
                  style={{ borderColor: mastery.color }}
                >
                  <div className="chain-item-header">
                    <span
                      className="chain-status-icon"
                      style={{ color: mastery.color }}
                    >
                      {learned ? "✓" : "○"}
                    </span>
                    <span className="chain-item-name">{prereq.name}</span>
                  </div>
                  <div className="chain-item-details">
                    <span className="chain-unit">{prereq.unit.replace("_", " ")}</span>
                    <span className="chain-difficulty">Lvl {prereq.difficulty}</span>
                    {progress.attempts > 0 && (
                      <span
                        className="chain-confidence"
                        style={{ color: mastery.color }}
                      >
                        {progress.confidence}%
                      </span>
                    )}
                  </div>
                </div>
                {index < uniqueChain.length - 1 && (
                  <div className="chain-arrow">↓</div>
                )}
              </div>
            );
          })}

          <div className="chain-arrow">↓</div>

          <div className="chain-item target">
            <div className="chain-item-header">
              <span className="chain-status-icon">★</span>
              <span className="chain-item-name">{concept.name}</span>
            </div>
            <div className="chain-item-details">
              <span className="chain-unit">{concept.unit.replace("_", " ")}</span>
              <span className="chain-difficulty">Lvl {concept.difficulty}</span>
            </div>
          </div>
        </div>
      )}

      {!prereqStatus.met && prereqStatus.missing.length > 0 && (
        <div className="missing-prereqs">
          <h4>Missing Prerequisites:</h4>
          <div className="missing-list">
            {prereqStatus.missing.map((prereq) => {
              const progress = getConceptProgress(prereq.id);
              return (
                <button
                  key={prereq.id}
                  className="missing-prereq-btn"
                  onClick={() => onSelectConcept(prereq.id)}
                >
                  <span>{prereq.name}</span>
                  {progress.attempts > 0 && (
                    <span className="missing-progress">
                      ({progress.confidence}% - need 70%)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
