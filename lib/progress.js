// Progress tracking utility with localStorage persistence

const STORAGE_KEY = "ib_economics_progress";

// Get all progress data from localStorage
export function getProgress() {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

// Save progress data to localStorage
export function saveProgress(progress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// Get progress for a specific concept
export function getConceptProgress(conceptId) {
  const progress = getProgress();
  return (
    progress[conceptId] || {
      attempts: 0,
      correct: 0,
      confidence: 0,
      lastAttempt: null,
      history: [],
    }
  );
}

// Update progress after answering a question
export function updateConceptProgress(conceptId, isCorrect) {
  const progress = getProgress();
  const conceptProgress = progress[conceptId] || {
    attempts: 0,
    correct: 0,
    confidence: 0,
    lastAttempt: null,
    history: [],
  };

  conceptProgress.attempts += 1;
  if (isCorrect) {
    conceptProgress.correct += 1;
  }

  // Calculate confidence score
  conceptProgress.confidence = Math.round(
    (conceptProgress.correct / conceptProgress.attempts) * 100
  );

  conceptProgress.lastAttempt = new Date().toISOString();
  conceptProgress.history.push({
    timestamp: conceptProgress.lastAttempt,
    correct: isCorrect,
  });

  // Keep only last 20 attempts in history
  if (conceptProgress.history.length > 20) {
    conceptProgress.history = conceptProgress.history.slice(-20);
  }

  progress[conceptId] = conceptProgress;
  saveProgress(progress);

  return conceptProgress;
}

// Check if a concept is considered "learned"
// Requires >70% confidence with minimum 3 attempts
export function isConceptLearned(conceptId) {
  const progress = getConceptProgress(conceptId);
  return progress.attempts >= 3 && progress.confidence >= 70;
}

// Check if all prerequisites for a concept are met
export function arePrerequisitesMet(concept, concepts) {
  if (!concept.prerequisites || concept.prerequisites.length === 0) {
    return { met: true, missing: [] };
  }

  const missing = [];
  for (const prereqId of concept.prerequisites) {
    if (!isConceptLearned(prereqId)) {
      const prereqConcept = concepts.find((c) => c.id === prereqId);
      if (prereqConcept) {
        missing.push(prereqConcept);
      }
    }
  }

  return {
    met: missing.length === 0,
    missing,
  };
}

// Get the full prerequisite chain for a concept
export function getPrerequisiteChain(concept, concepts, visited = new Set()) {
  if (!concept || visited.has(concept.id)) return [];
  visited.add(concept.id);

  const chain = [];
  if (concept.prerequisites) {
    for (const prereqId of concept.prerequisites) {
      const prereqConcept = concepts.find((c) => c.id === prereqId);
      if (prereqConcept) {
        // Get prerequisites of this prerequisite first (depth-first)
        const subChain = getPrerequisiteChain(prereqConcept, concepts, visited);
        chain.push(...subChain);
        chain.push(prereqConcept);
      }
    }
  }

  return chain;
}

// Get mastery level for display
export function getMasteryLevel(conceptId) {
  const progress = getConceptProgress(conceptId);

  if (progress.attempts === 0) {
    return { level: "not_attempted", label: "Not Attempted", color: "#9ca3af" };
  }

  if (progress.confidence >= 70) {
    return { level: "mastered", label: "Mastered", color: "#22c55e" };
  }

  if (progress.confidence >= 40) {
    return { level: "learning", label: "Learning", color: "#eab308" };
  }

  return { level: "struggling", label: "Needs Practice", color: "#ef4444" };
}

// Find the weakest concept that can be practiced (prerequisites met)
export function findWeakestConcept(concepts) {
  const progress = getProgress();

  // First priority: concepts with attempts but low confidence
  const strugglingConcepts = concepts
    .filter((concept) => {
      const conceptProgress = progress[concept.id];
      if (!conceptProgress || conceptProgress.attempts === 0) return false;
      if (conceptProgress.confidence >= 70) return false;
      return arePrerequisitesMet(concept, concepts).met;
    })
    .sort((a, b) => {
      const aProgress = progress[a.id];
      const bProgress = progress[b.id];
      return aProgress.confidence - bProgress.confidence;
    });

  if (strugglingConcepts.length > 0) {
    return strugglingConcepts[0];
  }

  // Second priority: unattempted concepts with prerequisites met
  const unattempted = concepts
    .filter((concept) => {
      const conceptProgress = progress[concept.id];
      if (conceptProgress && conceptProgress.attempts > 0) return false;
      return arePrerequisitesMet(concept, concepts).met;
    })
    .sort((a, b) => a.difficulty - b.difficulty);

  if (unattempted.length > 0) {
    return unattempted[0];
  }

  // Third priority: any concept with prerequisites met, lowest confidence first
  const available = concepts
    .filter((concept) => arePrerequisitesMet(concept, concepts).met)
    .sort((a, b) => {
      const aProgress = progress[a.id] || { confidence: 0 };
      const bProgress = progress[b.id] || { confidence: 0 };
      return aProgress.confidence - bProgress.confidence;
    });

  return available[0] || null;
}

// Get next recommended concept based on learning path
export function getRecommendedConcept(concepts) {
  const progress = getProgress();

  // Find concepts that are ready to learn (prerequisites met but not mastered)
  const readyToLearn = concepts.filter((concept) => {
    const conceptProgress = progress[concept.id];
    const mastered =
      conceptProgress &&
      conceptProgress.attempts >= 3 &&
      conceptProgress.confidence >= 70;
    if (mastered) return false;
    return arePrerequisitesMet(concept, concepts).met;
  });

  // Sort by: 1) Started but not mastered, 2) Difficulty level
  return readyToLearn.sort((a, b) => {
    const aProgress = progress[a.id] || { attempts: 0, confidence: 0 };
    const bProgress = progress[b.id] || { attempts: 0, confidence: 0 };

    // Prioritize concepts user has started
    if (aProgress.attempts > 0 && bProgress.attempts === 0) return -1;
    if (bProgress.attempts > 0 && aProgress.attempts === 0) return 1;

    // Then by difficulty
    return a.difficulty - b.difficulty;
  })[0];
}

// Get overall progress statistics
export function getOverallStats(concepts) {
  const progress = getProgress();

  let totalAttempts = 0;
  let totalCorrect = 0;
  let conceptsAttempted = 0;
  let conceptsMastered = 0;

  for (const concept of concepts) {
    const conceptProgress = progress[concept.id];
    if (conceptProgress && conceptProgress.attempts > 0) {
      totalAttempts += conceptProgress.attempts;
      totalCorrect += conceptProgress.correct;
      conceptsAttempted += 1;

      if (conceptProgress.attempts >= 3 && conceptProgress.confidence >= 70) {
        conceptsMastered += 1;
      }
    }
  }

  return {
    totalAttempts,
    totalCorrect,
    overallAccuracy:
      totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    conceptsAttempted,
    conceptsMastered,
    totalConcepts: concepts.length,
    progressPercent: Math.round((conceptsMastered / concepts.length) * 100),
  };
}

// Clear all progress (for reset)
export function clearProgress() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
